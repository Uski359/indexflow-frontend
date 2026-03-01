'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';

import PageHeader from '@/components/ui/PageHeader';
import { demoApiFetch, getDemoApiBaseUrl } from '@/lib/api';
import {
  buildEvaluationWallets,
  normalizeWalletInputs,
  resolveEnsBatch,
  type EnsBatchResult,
  type EvaluationWalletGateResult
} from '@/lib/ens';
import { exportProofCsv } from '@/lib/proofCsv';
import {
  buildUsageWindow,
  fetchMockWallets,
  isAbortError,
  runProofEvaluation
} from '@/lib/proofClient';
import type {
  ProofEvaluateResponse,
  ProofSummary,
  ProofWalletRow,
  ProofWindowType
} from '@/lib/proofTypes';
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
  'etherium.eth',
  'vitalik.eth',
  'uniswap.eth'
] as const;

const sampleEnsNames = ['etherium.eth', 'vitalik.eth', 'uniswap.eth'] as const;

const injectEnsSamples = (wallets: string[], limit = 20) => {
  const combined = [...wallets];
  sampleEnsNames.forEach((name, index) => {
    if (combined.length < limit) {
      combined.push(name);
      return;
    }
    const targetIndex = Math.max(0, combined.length - 1 - index);
    combined[targetIndex] = name;
  });
  return combined.slice(0, limit);
};

const criteriaPresets: Record<
  CriteriaSetId,
  { label: string; enabled: boolean; hint?: string; filters: Partial<ProofFilterState> }
> = {
  default: {
    label: 'default',
    enabled: true,
    filters: {
      minTxCount: 0,
      minDaysActive: 0,
      minUniqueContracts: 0
    }
  },
  'airdrop/basic@1': {
    label: 'basic',
    enabled: false,
    hint: 'coming soon',
    filters: {
      minTxCount: 0,
      minDaysActive: 0,
      minUniqueContracts: 0
    }
  },
  'airdrop/strict@1': {
    label: 'strict',
    enabled: false,
    hint: 'coming soon',
    filters: {
      minTxCount: 25,
      minDaysActive: 14,
      minUniqueContracts: 7
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

const ensErrorHints: Record<string, string> = {
  rpc_missing: 'backend mainnet RPC not configured',
  resolver_error: 'provider error; retry',
  not_found: 'name not registered / no resolver'
};

const parseProofErrorHint = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const rpcMatch = value.match(/rpc_missing(?::([A-Z0-9_<>-]+))?/i);
  if (rpcMatch) {
    const envKey = rpcMatch[1];
    return envKey ? `rpc_missing (${envKey})` : 'rpc_missing';
  }

  const campaignMatch = value.match(/Unknown campaign_id:\s*([a-zA-Z0-9_@./-]+)/i);
  if (campaignMatch) {
    return `unknown campaign (${campaignMatch[1]})`;
  }

  if (/db_not_indexed_for_targets/i.test(value)) {
    return 'db_not_indexed_for_targets';
  }

  if (/db_not_indexed/i.test(value)) {
    return 'db_not_indexed';
  }

  return null;
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
  const [ensResolution, setEnsResolution] = useState<EnsBatchResult | null>(null);
  const [gateInvalids, setGateInvalids] = useState<Array<{ value: string; reason: string }>>([]);
  const [ensRetrying, setEnsRetrying] = useState(false);
  const [determinismCheck, setDeterminismCheck] = useState<{
    status: 'ok' | 'mismatch';
    address: string;
    ensName?: string;
  } | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [shareWarning, setShareWarning] = useState<string | null>(null);
  const [proofCopyStatus, setProofCopyStatus] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const initializedRef = useRef(false);
  const autoRunRef = useRef(false);
  const hasAutoRunRef = useRef(false);
  const skipNextPresetSyncRef = useRef(false);
  const lastSearchRef = useRef<string>('');
  const isDev = process.env.NODE_ENV !== 'production';

  const parsedWallets = useMemo(
    () => normalizeWalletInputs(inputValue),
    [inputValue]
  );

  const safeCriteriaSetId = useMemo(() => {
    return criteriaPresets[criteriaSetId]?.enabled ? criteriaSetId : 'default';
  }, [criteriaSetId]);

  const normalizedInputList = useMemo(
    () =>
      parsedWallets.inputs
        .filter((entry) => entry.kind !== 'invalid')
        .map((entry) => entry.normalized ?? entry.raw),
    [parsedWallets.inputs]
  );

  const totalEntries = parsedWallets.inputs.length;
  const validEntries = parsedWallets.addresses.length + parsedWallets.ensNames.length;
  const invalidEntries = parsedWallets.invalid.length;

  const ensStats = useMemo(() => {
    const total = parsedWallets.ensNames.length;
    if (!ensResolution) {
      return { total, resolved: 0, unresolved: 0 };
    }
    const resolvedCount = Object.values(ensResolution.resolved).filter(
      (entry) => Boolean(entry.address)
    ).length;
    return {
      total,
      resolved: resolvedCount,
      unresolved: ensResolution.unresolved.length
    };
  }, [ensResolution, parsedWallets.ensNames.length]);

  const invalidList = useMemo(() => {
    const entries: Array<{ value: string; reason: string }> = [];
    const seen = new Set<string>();
    const addEntry = (value: string, reason: string) => {
      const key = `${value}:${reason}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      entries.push({ value, reason });
    };

    parsedWallets.invalid.forEach((value) => addEntry(value, 'invalid_format'));
    gateInvalids.forEach((entry) => addEntry(entry.value, entry.reason));

    if (ensResolution) {
      for (const name of ensResolution.unresolved) {
        addEntry(name, ensResolution.resolved[name]?.error ?? 'not_found');
      }
    }

    return entries;
  }, [ensResolution, parsedWallets.invalid, gateInvalids]);

  const hasUnresolvedEns = Boolean(ensResolution?.unresolved.length);

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
    setEnsResolution(null);
    setGateInvalids([]);
    setDeterminismCheck(null);
  }, [inputValue]);

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

    const rawTooLong = inputValue.length > 1500 && validEntries > 0;
    setShareWarning(
      rawTooLong ? 'Wallet list is long; share link uses normalized wallets.' : null
    );

    const params = serializeProofState({
      walletsRaw: inputValue,
      normalizedWallets: normalizedInputList,
      windowType,
      criteriaSetId: safeCriteriaSetId,
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
  }, [filters, isHydrated, pathname, router, searchParams, safeCriteriaSetId, windowType]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    const timeout = setTimeout(() => {
      const rawTooLong = inputValue.length > 1500 && validEntries > 0;
      setShareWarning(
        rawTooLong ? 'Wallet list is long; share link uses normalized wallets.' : null
      );

      const params = serializeProofState({
        walletsRaw: inputValue,
        normalizedWallets: normalizedInputList,
        windowType,
        criteriaSetId: safeCriteriaSetId,
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
  }, [filters, inputValue, isHydrated, pathname, router, searchParams, safeCriteriaSetId, windowType, normalizedInputList, validEntries]);

  useEffect(() => {
    if (!isHydrated || hasAutoRunRef.current || !autoRunRef.current) {
      return;
    }
    if (!baseUrl) {
      return;
    }
    if (!validEntries) {
      return;
    }
    hasAutoRunRef.current = true;
    void handleRun();
  }, [baseUrl, isHydrated, safeCriteriaSetId, validEntries, windowType]);

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

  const topErrorHint = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of filteredResults) {
      const hint = parseProofErrorHint(row.error);
      if (!hint) {
        continue;
      }
      counts.set(hint, (counts.get(hint) ?? 0) + 1);
    }

    let best: string | null = null;
    let bestCount = 0;
    for (const [hint, count] of counts.entries()) {
      if (count > bestCount) {
        best = hint;
        bestCount = count;
      }
    }
    return best;
  }, [filteredResults]);

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
      criteriaSetId: safeCriteriaSetId,
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
    const normalized = normalizeWalletInputs(rawInput);
    const normalizedList = normalized.inputs
      .filter((entry) => entry.kind !== 'invalid')
      .map((entry) => entry.normalized ?? entry.raw);
    const nextValue = normalizedList.join('\n');
    setInputValue(nextValue);
    if (syncNow) {
      syncUrlWith(nextValue, normalizedList);
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
      const mixed = injectEnsSamples(wallets, 20);
      normalizeAndSet(mixed.join('\n'), true);
    } catch {
      normalizeAndSet(injectEnsSamples([...fallbackSampleWallets], 20).join('\n'), true);
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
    setEnsResolution(null);
    setGateInvalids([]);
    setDeterminismCheck(null);
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const handleRetryUnresolvedEns = async () => {
    if (!ensResolution?.unresolved.length) {
      return;
    }

    setEnsRetrying(true);
    setError(null);
    try {
      const retry = await resolveEnsBatch(ensResolution.unresolved, {
        concurrency: 5
      });
      setEnsResolution((prev) => {
        if (!prev) {
          return retry;
        }
        const mergedResolved = { ...prev.resolved, ...retry.resolved };
        const unresolved = Object.keys(mergedResolved).filter(
          (name) => !mergedResolved[name]?.address
        );
        return { resolved: mergedResolved, unresolved };
      });
    } catch (err) {
      if (!isAbortError(err)) {
        setError('Failed to retry ENS resolution.');
      }
    } finally {
      setEnsRetrying(false);
    }
  };

  const runDeterminismCheck = async (
    merged: ProofWalletRow[],
    gateResult: EvaluationWalletGateResult,
    usageWindow: ReturnType<typeof buildUsageWindow>,
    runId: number
  ) => {
    const candidate = gateResult.wallets.find((wallet) => {
      const source = gateResult.sourcesByAddress.get(wallet);
      return Boolean(source?.hasEns && source?.hasAddress);
    });
    if (!candidate) {
      setDeterminismCheck(null);
      return;
    }

    const source = gateResult.sourcesByAddress.get(candidate);
    const ensName = source?.ensNames[0];
    const row = merged.find((entry) => entry.wallet.toLowerCase() === candidate);
    const proofHash = row?.output?.proof?.canonical_hash;
    if (!proofHash) {
      setDeterminismCheck({ status: 'mismatch', address: candidate, ensName });
      return;
    }

    try {
      const response = await demoApiFetch<ProofEvaluateResponse>('/v1/evaluate', {
        method: 'POST',
        body: JSON.stringify({
          wallet: candidate,
          campaign_id: campaignId,
          window: usageWindow
        })
      });
      if (runIdRef.current !== runId) {
        return;
      }
      const match = response.output.proof.canonical_hash === proofHash;
      setDeterminismCheck({
        status: match ? 'ok' : 'mismatch',
        address: candidate,
        ensName
      });
    } catch {
      if (runIdRef.current !== runId) {
        return;
      }
      setDeterminismCheck({ status: 'mismatch', address: candidate, ensName });
    }
  };

  const handleRun = async () => {
    if (!baseUrl) {
      setError(
        'NEXT_PUBLIC_API_BASE_URL is not set. Add it to your frontend environment.'
      );
      return;
    }

    const normalized = normalizeWalletInputs(inputValue);
    if (!normalized.addresses.length && !normalized.ensNames.length) {
      setError('Enter at least one valid wallet or ENS name.');
      return;
    }

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;

    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setRows([]);
    setSelected(null);
    setEnsResolution(null);
    setGateInvalids([]);
    setDeterminismCheck(null);
    setProgress({ processed: 0, total: 0 });

    try {
      let ensResult: EnsBatchResult = { resolved: {}, unresolved: [] };
      if (normalized.ensNames.length) {
        ensResult = await resolveEnsBatch(normalized.ensNames, {
          concurrency: 5,
          signal: controller.signal
        });
        setEnsResolution(ensResult);

        if (isDev) {
          const errorCounts = ensResult.unresolved.reduce<Record<string, number>>(
            (acc, name) => {
              const reason = ensResult.resolved[name]?.error ?? 'not_found';
              acc[reason] = (acc[reason] ?? 0) + 1;
              return acc;
            },
            {}
          );
          const resolvedCount = Object.values(ensResult.resolved).filter(
            (entry) => Boolean(entry.address)
          ).length;
          console.info('[ens] resolve summary', {
            total: normalized.ensNames.length,
            resolved: resolvedCount,
            unresolved: ensResult.unresolved.length,
            errors: errorCounts
          });
        }
      }

      const gateResult: EvaluationWalletGateResult = buildEvaluationWallets(
        normalized.inputs,
        ensResult.resolved
      );
      setGateInvalids(gateResult.invalid);

      const orderedAddresses = gateResult.wallets;
      const addressMeta = gateResult.metaByAddress;

      if (!orderedAddresses.length) {
        setError('No resolvable wallets to evaluate.');
        return;
      }

      setProgress({ processed: 0, total: orderedAddresses.length });

      const applyMeta = (row: ProofWalletRow): ProofWalletRow => {
        const meta = addressMeta.get(row.wallet.toLowerCase());
        if (!meta) {
          return { ...row, input_source: row.input_source ?? 'address' };
        }
        return {
          ...row,
          display_name: meta.display_name ?? null,
          input_source: meta.input_source,
          ens_cached: meta.ens_cached ?? false
        };
      };

      const usageWindow = buildUsageWindow(windowType);
      const result = await runProofEvaluation({
        wallets: orderedAddresses,
        campaignId,
        window: usageWindow,
        criteriaSetId: safeCriteriaSetId,
        signal: controller.signal,
        onProgress: (nextProgress) => {
          setProgress({
            processed: nextProgress.processed,
            total: nextProgress.total
          });
          setRows(nextProgress.rows.map(applyMeta));
        }
      });

      if (!controller.signal.aborted) {
        const merged = result.rows.map(applyMeta);
        setRows(merged);
        if (isDev) {
          console.info('[proof] run summary', {
            evaluated: merged.length,
            source: result.source
          });
        }
        if (isDev) {
          void runDeterminismCheck(merged, gateResult, usageWindow, runId);
        }
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
      criteriaSetId: safeCriteriaSetId
    });
  };
  const handleCopyShareLink = async () => {
    if (typeof window === 'undefined' || !navigator?.clipboard?.writeText) {
      return;
    }

    const rawTooLong = inputValue.length > 1500 && validEntries > 0;
    setShareWarning(
      rawTooLong ? 'Wallet list is long; share link uses normalized wallets.' : null
    );

    const params = serializeProofState({
      walletsRaw: inputValue,
      normalizedWallets: normalizedInputList,
      windowType,
      criteriaSetId: safeCriteriaSetId,
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
      <PageHeader
        eyebrow="Proof"
        title="Proof of usage"
        subtitle={`Multi-wallet evaluation for campaign ${campaignId}.`}
        actions={
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-400">
            Base URL: {baseUrl ?? 'Not set'}
          </div>
        }
      />

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
        totalCount={totalEntries}
        validCount={validEntries}
        invalidCount={invalidEntries}
        ensTotal={ensStats.total}
        ensResolved={ensStats.resolved}
        ensUnresolved={ensStats.unresolved}
        disabled={loading}
        loadingSample={sampleLoading}
      />

      {invalidList.length > 0 && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs uppercase tracking-[0.2em] text-rose-200">
              Invalid entries
            </span>
            <div className="flex flex-wrap items-center gap-3 text-xs text-rose-200">
              {hasUnresolvedEns && (
                <button
                  type="button"
                  onClick={handleRetryUnresolvedEns}
                  disabled={ensRetrying || loading}
                  className="rounded-full border border-rose-400/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-100 transition hover:text-white disabled:cursor-not-allowed disabled:text-rose-300/60"
                >
                  {ensRetrying ? 'Retrying...' : 'Retry unresolved ENS'}
                </button>
              )}
              <span>{invalidList.length} items</span>
            </div>
          </div>
          <div className="mt-3 grid gap-2 text-xs">
            {invalidList.map((entry) => {
              const hint = ensErrorHints[entry.reason];
              return (
                <div
                  key={`${entry.value}-${entry.reason}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="font-mono text-rose-100">{entry.value}</span>
                    {hint && (
                      <span className="text-[10px] uppercase tracking-[0.2em] text-rose-200/70">
                        {hint}
                      </span>
                    )}
                  </div>
                  <span className="rounded-full border border-rose-400/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-rose-200">
                    {entry.reason}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isDev && determinismCheck && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="uppercase tracking-[0.2em]">
              {determinismCheck.status === 'ok'
                ? 'Determinism OK'
                : 'Determinism mismatch'}
            </span>
            <span className="font-mono text-emerald-200/80">
              {determinismCheck.ensName ?? determinismCheck.address}
            </span>
          </div>
        </div>
      )}

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
                <option
                  key={id}
                  value={id}
                  disabled={!criteriaPresets[id].enabled}
                  title={criteriaPresets[id].hint}
                >
                  {criteriaPresets[id].label}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-500">
              Criteria sets are sent to the API; additional presets are coming soon.
            </span>
          </label>

          <div className="flex flex-col justify-end gap-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleRun}
                disabled={loading || validEntries === 0 || !baseUrl}
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
                <span className="text-rose-300">
                  Errors: {errorCount}
                  {topErrorHint ? ` (${topErrorHint})` : ''}
                </span>
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
