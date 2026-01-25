'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';

import { getDemoApiBaseUrl } from '@/lib/api';
import { exportProofCsv } from '@/lib/proofCsv';
import {
  buildUsageWindow,
  fetchMockWallets,
  isAbortError,
  normalizeWalletInput,
  runProofEvaluation
} from '@/lib/proofClient';
import type { ProofSummary, ProofWalletRow, ProofWindowType } from '@/lib/proofTypes';
import {
  parseProofState,
  serializeProofState,
  type CriteriaSetId
} from '@/lib/proofUrlState';

import ProofFilters, { type ProofFilterState } from './components/ProofFilters';
import ProofKpis from './components/ProofKpis';
import ProofTable from './components/ProofTable';
import WalletDetailModal from './components/WalletDetailModal';
import WalletInput from './components/WalletInput';

const campaignId = 'airdrop_v1';
const fallbackSampleWallets = [
  '0x0000000000000000000000000000000000000001',
  '0x0000000000000000000000000000000000000002',
  '0x0000000000000000000000000000000000000003',
  '0x0000000000000000000000000000000000000004',
  '0x0000000000000000000000000000000000000005',
  '0x0000000000000000000000000000000000000006',
  '0x0000000000000000000000000000000000000007',
  '0x0000000000000000000000000000000000000008',
  '0x0000000000000000000000000000000000000009',
  '0x000000000000000000000000000000000000000a',
  '0x000000000000000000000000000000000000000b',
  '0x000000000000000000000000000000000000000c',
  '0x000000000000000000000000000000000000000d',
  '0x000000000000000000000000000000000000000e',
  '0x000000000000000000000000000000000000000f',
  '0x0000000000000000000000000000000000000010',
  '0x0000000000000000000000000000000000000011',
  '0x0000000000000000000000000000000000000012',
  '0x0000000000000000000000000000000000000013',
  '0x0000000000000000000000000000000000000014'
] as const;

const criteriaPresets: Record<
  CriteriaSetId,
  { label: string; filters: Partial<ProofFilterState> }
> = {
  default: {
    label: 'default',
    filters: {
      minTxCount: 0,
      minDaysActive: 0,
      minUniqueContracts: 0
    }
  },
  active: {
    label: 'active',
    filters: {
      minTxCount: 10,
      minDaysActive: 7,
      minUniqueContracts: 3
    }
  },
  strict: {
    label: 'strict',
    filters: {
      minTxCount: 25,
      minDaysActive: 14,
      minUniqueContracts: 7
    }
  },
  anti_farm: {
    label: 'anti_farm',
    filters: {
      minTxCount: 15,
      minDaysActive: 10,
      minUniqueContracts: 5,
      maxFarmPercent: 55,
      minScore: 40
    }
  }
};

const criteriaSetIds = Object.keys(criteriaPresets) as CriteriaSetId[];
const isCriteriaSetId = (value: string): value is CriteriaSetId => {
  return criteriaSetIds.includes(value as CriteriaSetId);
};

const defaultFilters: ProofFilterState = {
  verified: 'all',
  minTxCount: 0,
  minDaysActive: 0,
  minUniqueContracts: 0,
  minScore: 0,
  maxScore: 100,
  minFarmPercent: 0,
  maxFarmPercent: 100,
  tag: 'all',
  sortBy: 'score_desc'
};

const sortLabelMap: Record<ProofFilterState['sortBy'], string> = {
  score_desc: 'Score (high to low)',
  farm_desc: 'Farm% (high to low)',
  tx_desc: 'Tx count (high to low)',
  days_desc: 'Days active (high to low)',
  unique_desc: 'Unique contracts (high to low)',
  wallet_asc: 'Wallet (A to Z)'
};

const DemoProofPageInner = () => {
  const baseUrl = getDemoApiBaseUrl();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [inputValue, setInputValue] = useState('');
  const [windowType, setWindowType] = useState<ProofWindowType>('last_30_days');
  const [criteriaSetId, setCriteriaSetId] = useState<CriteriaSetId>('default');
  const [filters, setFilters] = useState<ProofFilterState>(defaultFilters);
  const [rows, setRows] = useState<ProofWalletRow[]>([]);
  const [selected, setSelected] = useState<ProofWalletRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [isHydrated, setIsHydrated] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [shareWarning, setShareWarning] = useState<string | null>(null);
  const [proofCopyStatus, setProofCopyStatus] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const initializedRef = useRef(false);
  const autoRunRef = useRef(false);
  const hasAutoRunRef = useRef(false);
  const skipNextPresetSyncRef = useRef(false);
  const lastSearchRef = useRef<string>('');

  const parsedWallets = useMemo(
    () => normalizeWalletInput(inputValue),
    [inputValue]
  );

  const insightsEnabled = useMemo(
    () => rows.some((row) => row.source === 'commentary' || row.source === 'insights'),
    [rows]
  );

  useEffect(() => {
    const allowedSorts: ProofFilterState['sortBy'][] = insightsEnabled
      ? ['score_desc', 'farm_desc', 'tx_desc', 'days_desc', 'unique_desc', 'wallet_asc']
      : ['tx_desc', 'days_desc', 'unique_desc', 'wallet_asc'];

    setFilters((prev) => {
      if (allowedSorts.includes(prev.sortBy)) {
        return prev;
      }
      return {
        ...prev,
        sortBy: insightsEnabled ? 'score_desc' : 'wallet_asc'
      };
    });
  }, [insightsEnabled]);

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }
    initializedRef.current = true;

    const parsed = parseProofState(searchParams);
    const hasFilterOverride = Boolean(parsed.filters);

    if (parsed.walletsRaw) {
      setInputValue(parsed.walletsRaw);
    }
    if (parsed.windowType) {
      setWindowType(parsed.windowType);
    }
    if (parsed.criteriaSetId && isCriteriaSetId(parsed.criteriaSetId)) {
      if (hasFilterOverride) {
        skipNextPresetSyncRef.current = true;
      }
      setCriteriaSetId(parsed.criteriaSetId);
    }
    if (parsed.filters) {
      skipNextPresetSyncRef.current = true;
      setFilters({ ...defaultFilters, ...parsed.filters });
    }
    if (parsed.autoRun) {
      autoRunRef.current = true;
    }

    setTimeout(() => setIsHydrated(true), 0);
  }, [searchParams]);

  useEffect(() => {
    if (skipNextPresetSyncRef.current) {
      skipNextPresetSyncRef.current = false;
      return;
    }
    const preset = criteriaPresets[criteriaSetId];
    if (!preset) {
      return;
    }
    setFilters((prev) => ({
      ...defaultFilters,
      sortBy: prev.sortBy,
      ...preset.filters
    }));
  }, [criteriaSetId]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const rawTooLong = inputValue.length > 1500 && parsedWallets.valid.length > 0;
    setShareWarning(
      rawTooLong ? 'Wallet list is long; share link uses normalized wallets.' : null
    );

    const params = serializeProofState({
      walletsRaw: inputValue,
      normalizedWallets: parsedWallets.valid,
      windowType,
      criteriaSetId,
      filters
    });

    const nextSearch = params.toString();
    const currentSearch =
      typeof window !== 'undefined'
        ? window.location.search.replace(/^\?/, '')
        : searchParams.toString();

    if (nextSearch === currentSearch || nextSearch === lastSearchRef.current) {
      return;
    }

    lastSearchRef.current = nextSearch;
    const nextUrl = nextSearch ? `${pathname}?${nextSearch}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [criteriaSetId, filters, isHydrated, pathname, router, searchParams, windowType]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    const timeout = setTimeout(() => {
      const rawTooLong = inputValue.length > 1500 && parsedWallets.valid.length > 0;
      setShareWarning(
        rawTooLong ? 'Wallet list is long; share link uses normalized wallets.' : null
      );

      const params = serializeProofState({
        walletsRaw: inputValue,
        normalizedWallets: parsedWallets.valid,
        windowType,
        criteriaSetId,
        filters
      });

      const nextSearch = params.toString();
      const currentSearch =
        typeof window !== 'undefined'
          ? window.location.search.replace(/^\?/, '')
          : searchParams.toString();

      if (nextSearch === currentSearch || nextSearch === lastSearchRef.current) {
        return;
      }

      lastSearchRef.current = nextSearch;
      const nextUrl = nextSearch ? `${pathname}?${nextSearch}` : pathname;
      router.replace(nextUrl, { scroll: false });
    }, 300);

    return () => clearTimeout(timeout);
  }, [criteriaSetId, filters, inputValue, isHydrated, pathname, router, searchParams, windowType, parsedWallets.valid]);

  useEffect(() => {
    if (!isHydrated || hasAutoRunRef.current || !autoRunRef.current) {
      return;
    }
    if (!baseUrl) {
      return;
    }
    if (!parsedWallets.valid.length) {
      return;
    }
    hasAutoRunRef.current = true;
    void handleRun();
  }, [baseUrl, criteriaSetId, isHydrated, parsedWallets.valid.length, windowType]);

  const filteredResults = useMemo<ProofWalletRow[]>(() => {
    return rows.filter((entry) => {
      if (entry.error || !entry.output) {
        return true;
      }

      if (filters.verified !== 'all') {
        const shouldBeVerified = filters.verified === 'true';
        if (entry.output.verified_usage !== shouldBeVerified) {
          return false;
        }
      }

      const summary = entry.output.usage_summary;
      if (summary.tx_count < filters.minTxCount) {
        return false;
      }
      if (summary.days_active < filters.minDaysActive) {
        return false;
      }
      if (summary.unique_contracts < filters.minUniqueContracts) {
        return false;
      }

      if (insightsEnabled && entry.insights) {
        const farmPercent = entry.insights.farming_probability * 100;
        if (entry.insights.overall_score < filters.minScore) {
          return false;
        }
        if (entry.insights.overall_score > filters.maxScore) {
          return false;
        }
        if (farmPercent < filters.minFarmPercent) {
          return false;
        }
        if (farmPercent > filters.maxFarmPercent) {
          return false;
        }
        if (filters.tag !== 'all' && entry.insights.behavior_tag !== filters.tag) {
          return false;
        }
      }

      return true;
    });
  }, [filters, rows, insightsEnabled]);

  const sortedResults = useMemo<ProofWalletRow[]>(() => {
    const sorted = [...filteredResults];

    sorted.sort((a, b) => {
      const walletCompare = a.wallet.localeCompare(b.wallet);

      if (a.error && !b.error) {
        return 1;
      }
      if (b.error && !a.error) {
        return -1;
      }

      let diff = 0;
      switch (filters.sortBy) {
        case 'score_desc':
          diff = (b.insights?.overall_score ?? 0) - (a.insights?.overall_score ?? 0);
          break;
        case 'farm_desc':
          diff =
            (b.insights?.farming_probability ?? 0) -
            (a.insights?.farming_probability ?? 0);
          break;
        case 'tx_desc':
          diff =
            (b.output?.usage_summary.tx_count ?? 0) -
            (a.output?.usage_summary.tx_count ?? 0);
          break;
        case 'days_desc':
          diff =
            (b.output?.usage_summary.days_active ?? 0) -
            (a.output?.usage_summary.days_active ?? 0);
          break;
        case 'unique_desc':
          diff =
            (b.output?.usage_summary.unique_contracts ?? 0) -
            (a.output?.usage_summary.unique_contracts ?? 0);
          break;
        case 'wallet_asc':
          diff = walletCompare;
          break;
        default:
          diff = 0;
      }

      if (diff === 0) {
        return walletCompare;
      }
      return diff;
    });

    return sorted;
  }, [filteredResults, filters.sortBy]);

  const summary = useMemo<ProofSummary>(() => {
    const validRows = filteredResults.filter((entry) => entry.output && !entry.error);
    const total = validRows.length;
    const verifiedTrue = validRows.filter((entry) => entry.output?.verified_usage).length;
    const verifiedFalse = total - verifiedTrue;
    const verifiedRate = total ? verifiedTrue / total : 0;

    const totals = validRows.reduce(
      (acc, entry) => {
        const usage = entry.output?.usage_summary;
        if (usage) {
          acc.tx += usage.tx_count;
          acc.days += usage.days_active;
          acc.uniq += usage.unique_contracts;
        }
        if (entry.insights) {
          acc.score += entry.insights.overall_score;
          if (entry.insights.behavior_tag === 'suspected_farm') {
            acc.suspected += 1;
          }
        }
        return acc;
      },
      { tx: 0, days: 0, uniq: 0, score: 0, suspected: 0 }
    );

    return {
      total,
      verified_true: verifiedTrue,
      verified_false: verifiedFalse,
      verified_rate: verifiedRate,
      avg_tx_count: total ? totals.tx / total : 0,
      avg_days_active: total ? totals.days / total : 0,
      avg_unique_contracts: total ? totals.uniq / total : 0,
      suspected_farm_count: totals.suspected,
      suspected_farm_rate: total ? totals.suspected / total : 0,
      avg_score: total ? totals.score / total : 0
    };
  }, [filteredResults]);

  const errorCount = useMemo(
    () => filteredResults.filter((entry) => entry.error).length,
    [filteredResults]
  );

  const syncUrlWith = (walletsRaw: string, normalizedWallets: string[]) => {
    if (!isHydrated) {
      return;
    }

    const rawTooLong = walletsRaw.length > 1500 && normalizedWallets.length > 0;
    setShareWarning(
      rawTooLong ? 'Wallet list is long; share link uses normalized wallets.' : null
    );

    const params = serializeProofState({
      walletsRaw,
      normalizedWallets,
      windowType,
      criteriaSetId,
      filters
    });

    const nextSearch = params.toString();
    const currentSearch =
      typeof window !== 'undefined'
        ? window.location.search.replace(/^\?/, '')
        : searchParams.toString();

    if (nextSearch === currentSearch || nextSearch === lastSearchRef.current) {
      return;
    }

    lastSearchRef.current = nextSearch;
    const nextUrl = nextSearch ? `${pathname}?${nextSearch}` : pathname;
    router.replace(nextUrl, { scroll: false });
  };

  const normalizeAndSet = (rawInput: string, syncNow = false) => {
    const normalized = normalizeWalletInput(rawInput);
    const nextValue = normalized.valid.join('\n');
    setInputValue(nextValue);
    if (syncNow) {
      syncUrlWith(nextValue, normalized.valid);
    }
  };

  const handleNormalize = () => {
    normalizeAndSet(inputValue, true);
  };

  const handlePasteSample = async () => {
    setSampleLoading(true);
    setError(null);

    try {
      const wallets = await fetchMockWallets(campaignId, 20);
      normalizeAndSet(wallets.join('\n'), true);
    } catch {
      normalizeAndSet(fallbackSampleWallets.join('\n'), true);
    } finally {
      setSampleLoading(false);
    }
  };

  const handleClear = () => {
    setInputValue('');
    setRows([]);
    setSelected(null);
    setError(null);
    setProgress({ processed: 0, total: 0 });
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const handleRun = async () => {
    if (!baseUrl) {
      setError(
        'NEXT_PUBLIC_API_BASE_URL is not set. Add it to your frontend environment.'
      );
      return;
    }

    const normalized = normalizeWalletInput(inputValue);
    if (!normalized.valid.length) {
      setError('Enter at least one valid wallet.');
      return;
    }

    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setRows([]);
    setSelected(null);
    setProgress({ processed: 0, total: normalized.valid.length });

    try {
      const result = await runProofEvaluation({
        wallets: normalized.valid,
        campaignId,
        window: buildUsageWindow(windowType),
        criteriaSetId,
        signal: controller.signal,
        onProgress: (nextProgress) => {
          setProgress({
            processed: nextProgress.processed,
            total: nextProgress.total
          });
          setRows(nextProgress.rows);
        }
      });

      if (!controller.signal.aborted) {
        setRows(result.rows);
      }
    } catch (err: unknown) {
      if (isAbortError(err)) {
        setError('Run cancelled.');
      } else {
        const message = err instanceof Error ? err.message : 'Unexpected error.';
        setError(message);
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const hasResults = rows.length > 0;
  const progressPercent = progress.total
    ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
    : 0;
  const handleExportCsv = () => {
    exportProofCsv({
      rows: sortedResults,
      campaignId,
      windowType,
      criteriaSetId
    });
  };
  const handleCopyShareLink = async () => {
    if (typeof window === 'undefined' || !navigator?.clipboard?.writeText) {
      return;
    }

    const rawTooLong = inputValue.length > 1500 && parsedWallets.valid.length > 0;
    setShareWarning(
      rawTooLong ? 'Wallet list is long; share link uses normalized wallets.' : null
    );

    const params = serializeProofState({
      walletsRaw: inputValue,
      normalizedWallets: parsedWallets.valid,
      windowType,
      criteriaSetId,
      filters
    });

    const nextSearch = params.toString();
    const nextUrl = nextSearch ? `${pathname}?${nextSearch}` : pathname;
    router.replace(nextUrl, { scroll: false });

    const url = nextSearch
      ? `${window.location.origin}${pathname}?${nextSearch}`
      : `${window.location.origin}${pathname}`;

    try {
      await navigator.clipboard.writeText(url);
      setShareStatus('Copied share link.');
    } catch {
      setShareStatus('Failed to copy link.');
    }

    setTimeout(() => setShareStatus(null), 1500);
  };
  const handleCopyProofs = async () => {
    if (!navigator?.clipboard?.writeText) {
      return;
    }
    if (!sortedResults.length) {
      setProofCopyStatus('No proofs to copy.');
      setTimeout(() => setProofCopyStatus(null), 1500);
      return;
    }

    let proofCount = 0;
    let missingCount = 0;
    const lines = sortedResults.map((row) => {
      const proofHash = row.output?.proof.canonical_hash;
      if (proofHash) {
        proofCount += 1;
        return `${row.wallet}  ${proofHash}`;
      }
      missingCount += 1;
      return `${row.wallet}  MISSING_PROOF`;
    });

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      const suffix = missingCount ? ` (${missingCount} missing)` : '';
      const label = proofCount ? `Copied ${proofCount} proofs${suffix}.` : 'No proofs to copy.';
      setProofCopyStatus(label);
    } catch {
      setProofCopyStatus('Failed to copy proofs.');
    }

    setTimeout(() => setProofCopyStatus(null), 1500);
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/demo" className="text-sm text-slate-400 hover:text-slate-200">
            Back to demo
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-white">Proof of usage</h1>
          <p className="mt-1 text-sm text-slate-400">
            Multi-wallet evaluation | Campaign: {campaignId}
          </p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-400">
          Base URL: {baseUrl ?? 'Not set'}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">
          {error}
        </div>
      )}

      <WalletInput
        value={inputValue}
        onChange={setInputValue}
        onNormalize={handleNormalize}
        onPasteSample={handlePasteSample}
        onClear={handleClear}
        validCount={parsedWallets.valid.length}
        invalidCount={parsedWallets.invalid.length}
        disabled={loading}
        loadingSample={sampleLoading}
      />

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Window
            <select
              value={windowType}
              onChange={(event) =>
                setWindowType(event.target.value as ProofWindowType)
              }
              disabled={loading}
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
            >
              <option value="last_7_days">Last 7 days</option>
              <option value="last_30_days">Last 30 days</option>
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Criteria set
            <select
              value={criteriaSetId}
              onChange={(event) => {
                const next = event.target.value;
                if (isCriteriaSetId(next)) {
                  setCriteriaSetId(next);
                }
              }}
              disabled={loading}
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
            >
              {criteriaSetIds.map((id) => (
                <option key={id} value={id}>
                  {criteriaPresets[id].label}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-500">
              Presets are UI-side filters for demo; verification proof remains deterministic.
            </span>
          </label>

          <div className="flex flex-col justify-end gap-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleRun}
                disabled={loading || parsedWallets.valid.length === 0 || !baseUrl}
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-black transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-white/40 disabled:text-slate-500"
              >
                {loading ? 'Running...' : 'Run'}
              </button>
              {loading && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-full border border-white/10 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={handleCopyShareLink}
                className="rounded-full border border-white/10 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300 hover:text-white"
              >
                Copy share link
              </button>
            </div>
            {(shareStatus || shareWarning) && (
              <div className="text-xs text-slate-400">
                {shareStatus ?? shareWarning}
              </div>
            )}
          </div>
        </div>

        {loading && (
          <div className="mt-4 space-y-2">
            <div className="text-sm text-slate-300">
              Processed {progress.processed} / {progress.total}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-400/80 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {hasResults && !loading && <ProofKpis summary={summary} insightsEnabled={insightsEnabled} />}

      {hasResults && !loading && (
        <>
          <ProofFilters
            value={filters}
            onChange={setFilters}
            disabled={loading}
            insightsEnabled={insightsEnabled}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-slate-200">Wallets</span>
              <span>
                Showing {sortedResults.length} of {rows.length} wallets
              </span>
              {errorCount > 0 && (
                <span className="text-rose-300">Errors: {errorCount}</span>
              )}
            </div>
            {sortedResults.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Sort: {sortLabelMap[filters.sortBy]}
                </span>
                <button
                  type="button"
                  onClick={handleCopyProofs}
                  className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300 hover:text-white"
                >
                  Copy proofs
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300 hover:text-white"
                >
                  Export CSV
                </button>
                {proofCopyStatus && (
                  <span className="text-xs text-slate-400">{proofCopyStatus}</span>
                )}
              </div>
            )}
          </div>

          {sortedResults.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
              No wallets match the current filters.
            </div>
          ) : (
            <ProofTable
              results={sortedResults}
              insightsEnabled={insightsEnabled}
              onSelect={(row) => setSelected(row)}
            />
          )}
        </>
      )}

      <WalletDetailModal
        row={selected}
        onClose={() => setSelected(null)}
        insightsEnabled={insightsEnabled}
      />
    </div>
  );
};

const DemoProofPage = () => {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
            Loading proof demo...
          </div>
        </div>
      }
    >
      <DemoProofPageInner />
    </Suspense>
  );
};

export default DemoProofPage;
