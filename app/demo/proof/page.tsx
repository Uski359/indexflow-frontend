'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import { getDemoApiBaseUrl } from '@/lib/api';
import {
  buildUsageWindow,
  fetchMockWallets,
  isAbortError,
  normalizeWalletInput,
  runProofEvaluation
} from '@/lib/proofClient';
import type { ProofSummary, ProofWalletRow, ProofWindowType } from '@/lib/proofTypes';

import ProofFilters, { type ProofFilterState } from './components/ProofFilters';
import ProofKpis from './components/ProofKpis';
import ProofTable from './components/ProofTable';
import WalletDetailModal from './components/WalletDetailModal';
import WalletInput from './components/WalletInput';

const campaignId = 'airdrop_v1';

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

const DemoProofPage = () => {
  const baseUrl = getDemoApiBaseUrl();
  const [inputValue, setInputValue] = useState('');
  const [windowType, setWindowType] = useState<ProofWindowType>('last_30_days');
  const criteriaSet = 'default';
  const [filters, setFilters] = useState<ProofFilterState>(defaultFilters);
  const [rows, setRows] = useState<ProofWalletRow[]>([]);
  const [selected, setSelected] = useState<ProofWalletRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const abortRef = useRef<AbortController | null>(null);

  const parsedWallets = useMemo(
    () => normalizeWalletInput(inputValue),
    [inputValue]
  );

  const insightsEnabled = useMemo(
    () => rows.some((row) => row.source === 'commentary' || row.source === 'insights'),
    [rows]
  );

  useEffect(() => {
    const allowedSorts = insightsEnabled
      ? (['score_desc', 'farm_desc', 'tx_desc', 'days_desc', 'unique_desc', 'wallet_asc'] as const)
      : (['tx_desc', 'days_desc', 'unique_desc', 'wallet_asc'] as const);

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

  const handleNormalize = () => {
    const normalized = normalizeWalletInput(inputValue);
    setInputValue(normalized.valid.join('\n'));
  };

  const handlePasteSample = async () => {
    setSampleLoading(true);
    setError(null);

    try {
      const wallets = await fetchMockWallets(campaignId, 20);
      setInputValue(wallets.join('\n'));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unexpected error.';
      setError(message);
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
        signal: controller.signal,
        onProgress: (processed) =>
          setProgress((prev) => ({ ...prev, processed }))
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
              value={criteriaSet}
              disabled
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
            >
              <option value="default">default</option>
            </select>
          </label>

          <div className="flex flex-col justify-end gap-2">
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
                className="rounded-full border border-white/10 px-6 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300 hover:text-white"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {loading && (
          <div className="mt-4 text-sm text-slate-300">
            Processed {progress.processed} / {progress.total}
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
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Sort: {sortLabelMap[filters.sortBy]}
              </span>
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

export default DemoProofPage;
