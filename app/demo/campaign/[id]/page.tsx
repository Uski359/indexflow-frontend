'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import PageHeader from '@/components/ui/PageHeader';
import { demoApiFetch, getDemoApiBaseUrl } from '@/lib/api';
import LaunchYourCampaignCard from '@/src/features/campaignLaunch/LaunchYourCampaignCard';
import {
  computeAllocationPlan,
  computeDecisionSummary
} from '@/src/features/campaignLaunch/preview';
import { createDefaultCampaignDraft } from '@/src/features/campaignLaunch/storage';
import type {
  AllocationTransform,
  CampaignDraft,
  CampaignPreviewParticipant
} from '@/src/features/campaignLaunch/types';
import type {
  CampaignCommentaryResponse,
  CampaignInsightsResponse,
  CampaignRunResponse,
  UsageWindow,
  WalletRowWithInsights
} from '@/lib/types';

import Filters, { type FilterState } from './components/Filters';
import KpiCards from './components/KpiCards';
import WalletTable from './components/WalletTable';

type WindowType = 'last_7_days' | 'last_14_days' | 'last_30_days';

type DataSource = 'commentary' | 'insights' | 'run';

const windowSeconds: Record<WindowType, number> = {
  last_7_days: 7 * 24 * 60 * 60,
  last_14_days: 14 * 24 * 60 * 60,
  last_30_days: 30 * 24 * 60 * 60
};

const defaultFilters: FilterState = {
  verified: 'all',
  minTxCount: 0,
  minDaysActive: 0,
  minUniqueContracts: 0,
  minOverallScore: 0,
  maxOverallScore: 100,
  minFarmingProbability: 0,
  maxFarmingProbability: 100,
  tag: 'all',
  sortBy: 'score_desc',
  cachedOnly: false
};

const isWindowType = (value: string | null): value is WindowType => {
  return value === 'last_7_days' || value === 'last_14_days' || value === 'last_30_days';
};

const simulationTransformOptions: AllocationTransform[] = ['linear', 'sqrt', 'log'];

const getClusterRiskLevel = (riskPercent: number): 'Low' | 'Medium' | 'High' => {
  if (riskPercent >= 20) {
    return 'High';
  }
  if (riskPercent >= 10) {
    return 'Medium';
  }
  return 'Low';
};

const riskLevelClassName: Record<'Low' | 'Medium' | 'High', string> = {
  Low: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100',
  Medium: 'border-amber-400/30 bg-amber-500/10 text-amber-100',
  High: 'border-rose-400/30 bg-rose-500/10 text-rose-100'
};

const formatPercent = (value: number): string =>
  `${value.toLocaleString(undefined, {
    minimumFractionDigits: value < 10 ? 1 : 0,
    maximumFractionDigits: 1
  })}%`;

const formatAmount = (value: number): string =>
  `${value.toLocaleString(undefined, {
    minimumFractionDigits: value < 100 ? 2 : 0,
    maximumFractionDigits: 2
  })} IFLW`;

const summarizeInsightResults = (
  results: WalletRowWithInsights[]
): CampaignInsightsResponse['summary'] => {
  const total = results.length;
  const verified_true = results.filter((entry) => entry.output.verified_usage).length;
  const verified_false = total - verified_true;
  const verified_rate = total ? verified_true / total : 0;

  const totals = results.reduce(
    (acc, entry) => {
      acc.tx += entry.output.usage_summary.tx_count;
      acc.days += entry.output.usage_summary.days_active;
      acc.uniq += entry.output.usage_summary.unique_contracts;
      return acc;
    },
    { tx: 0, days: 0, uniq: 0 }
  );

  const suspected_farm_count = results.filter(
    (entry) => entry.insights.behavior_tag === 'suspected_farm'
  ).length;
  const avg_score = total
    ? results.reduce((sum, entry) => sum + entry.insights.overall_score, 0) / total
    : 0;

  return {
    total,
    verified_true,
    verified_false,
    verified_rate,
    avg_tx_count: total ? totals.tx / total : 0,
    avg_days_active: total ? totals.days / total : 0,
    avg_unique_contracts: total ? totals.uniq / total : 0,
    suspected_farm_count,
    suspected_farm_rate: total ? suspected_farm_count / total : 0,
    avg_score
  };
};

const normalizeCampaignResponse = (
  campaignId: string,
  window: UsageWindow,
  response: CampaignInsightsResponse | CampaignCommentaryResponse
): CampaignInsightsResponse => {
  const summary = response.summary ?? summarizeInsightResults(response.results);

  return {
    campaign_id: response.campaign_id ?? campaignId,
    window: response.window ?? window,
    results: response.results,
    summary
  };
};

const DemoCampaignPage = () => {
  const params = useParams();
  const searchParams = useSearchParams();
  const windowParam = searchParams.get('window');
  const windowType: WindowType = isWindowType(windowParam) ? windowParam : 'last_30_days';
  const baseUrl = getDemoApiBaseUrl();

  const campaignId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [data, setData] = useState<CampaignRunResponse | CampaignInsightsResponse | null>(
    null
  );
  const [source, setSource] = useState<DataSource | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [simulationConfig, setSimulationConfig] = useState<CampaignDraft>(() => {
    const draft = createDefaultCampaignDraft();
    return {
      ...draft,
      budget: 1000,
      maxPerWallet: 25,
      minPerWallet: 0,
      maxSharePercent: 0.5,
      minScore: 60,
      walletAgeDays: 30,
      activeDaysLast14: 3,
      proofUsageMinEvents: 5,
      equalPercent: 20,
      transform: 'sqrt',
      termsAccepted: false
    };
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!campaignId || typeof campaignId !== 'string') {
        setError('Missing campaign id.');
        setData(null);
        setSource(null);
        return;
      }

      if (!baseUrl) {
        setError(
          'NEXT_PUBLIC_API_BASE_URL is not set. Add it to your frontend environment.'
        );
        setData(null);
        setSource(null);
        return;
      }

      setLoading(true);
      setError(null);
      setSource(null);

      try {
        const wallets = await demoApiFetch<string[]>(
          `/v1/campaign/${campaignId}/mock-wallets?count=320`
        );
        const end = Math.floor(Date.now() / 1000);
        const start = end - windowSeconds[windowType];

        const payload = {
          campaign_id: campaignId,
          window: {
            type: windowType,
            start,
            end
          },
          wallets,
          mode: 'sync' as const
        };

        let nextData: CampaignRunResponse | CampaignInsightsResponse;
        let nextSource: DataSource;

        try {
          const result = await demoApiFetch<CampaignCommentaryResponse>(
            '/v1/campaign/commentary',
            {
              method: 'POST',
              body: JSON.stringify(payload)
            }
          );
          nextData = normalizeCampaignResponse(campaignId, payload.window, result);
          nextSource = 'commentary';
        } catch {
          try {
            const result = await demoApiFetch<CampaignInsightsResponse>(
              '/v1/campaign/insights',
              {
                method: 'POST',
                body: JSON.stringify(payload)
              }
            );
            nextData = normalizeCampaignResponse(campaignId, payload.window, result);
            nextSource = 'insights';
          } catch {
            const result = await demoApiFetch<CampaignRunResponse>('/v1/campaign/run', {
              method: 'POST',
              body: JSON.stringify(payload)
            });
            nextData = result;
            nextSource = 'run';
          }
        }

        if (!cancelled) {
          setData(nextData);
          setSource(nextSource);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unexpected error.';
        if (!cancelled) {
          setError(message);
          setData(null);
          setSource(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [baseUrl, campaignId, windowType]);

  const showInsights = source === 'commentary' || source === 'insights';
  const filteredResults = useMemo<
    CampaignRunResponse['results'] | CampaignInsightsResponse['results']
  >(() => {
    if (!data || !source) {
      return [];
    }

    if (source === 'run') {
      const runResults = (data as CampaignRunResponse).results;
      return runResults.filter((entry) => {
        if (filters.cachedOnly && !entry.cached) {
          return false;
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

        return true;
      });
    }

    const insightResults = (data as CampaignInsightsResponse)
      .results as WalletRowWithInsights[];
    const minScore = Math.min(filters.minOverallScore, filters.maxOverallScore);
    const maxScore = Math.max(filters.minOverallScore, filters.maxOverallScore);
    const minFarmProbability =
      Math.min(filters.minFarmingProbability, filters.maxFarmingProbability) / 100;
    const maxFarmProbability =
      Math.max(filters.minFarmingProbability, filters.maxFarmingProbability) / 100;

    return insightResults.filter((entry) => {
      if (
        filters.cachedOnly &&
        !(entry.cached_core || entry.cached_insights || entry.cached_commentary)
      ) {
        return false;
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

      if (entry.insights.overall_score < minScore) {
        return false;
      }
      if (entry.insights.overall_score > maxScore) {
        return false;
      }
      if (entry.insights.farming_probability < minFarmProbability) {
        return false;
      }
      if (entry.insights.farming_probability > maxFarmProbability) {
        return false;
      }
      if (filters.tag !== 'all' && entry.insights.behavior_tag !== filters.tag) {
        return false;
      }

      return true;
    });
  }, [data, filters, source]);

  const sortedResults = useMemo<
    CampaignRunResponse['results'] | CampaignInsightsResponse['results']
  >(() => {
    if (!showInsights) {
      return filteredResults;
    }

    const sorted = [...(filteredResults as WalletRowWithInsights[])];
    sorted.sort((a, b) => {
      const walletCompare = a.wallet.localeCompare(b.wallet);
      let diff = 0;

      switch (filters.sortBy) {
        case 'score_asc':
          diff = a.insights.overall_score - b.insights.overall_score;
          break;
        case 'score_desc':
          diff = b.insights.overall_score - a.insights.overall_score;
          break;
        case 'farm_asc':
          diff = a.insights.farming_probability - b.insights.farming_probability;
          break;
        case 'farm_desc':
          diff = b.insights.farming_probability - a.insights.farming_probability;
          break;
        case 'tx_asc':
          diff = a.output.usage_summary.tx_count - b.output.usage_summary.tx_count;
          break;
        case 'tx_desc':
          diff = b.output.usage_summary.tx_count - a.output.usage_summary.tx_count;
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
  }, [filteredResults, filters.sortBy, showInsights]);

  const sortLabel = useMemo(() => {
    if (!showInsights) {
      return null;
    }
    switch (filters.sortBy) {
      case 'score_asc':
        return 'Score (low to high)';
      case 'score_desc':
        return 'Score (high to low)';
      case 'farm_asc':
        return 'Farm% (low to high)';
      case 'farm_desc':
        return 'Farm% (high to low)';
      case 'tx_asc':
        return 'Tx count (low to high)';
      case 'tx_desc':
        return 'Tx count (high to low)';
      default:
        return null;
    }
  }, [filters.sortBy, showInsights]);

  const total = data?.summary.total ?? 0;
  const sourceLabel = source ?? 'unknown';
  const previewParticipants = useMemo<CampaignPreviewParticipant[] | undefined>(() => {
    if (!data || !source) {
      return undefined;
    }

    if (source === 'run') {
      const runResults = data.results as CampaignRunResponse['results'];
      return runResults.map((entry) => ({
        wallet: entry.wallet,
        score:
          entry.output.usage_summary.tx_count * 4 +
          entry.output.usage_summary.days_active * 6 +
          entry.output.usage_summary.unique_contracts * 8,
        walletAgeDays:
          entry.output.usage_summary.days_active * 21 +
          entry.output.usage_summary.unique_contracts * 14,
        activeDaysLast14: Math.min(14, entry.output.usage_summary.days_active),
        proofUsageEvents: entry.output.usage_summary.tx_count
      }));
    }

    const insightResults = data.results as WalletRowWithInsights[];
    return insightResults.map((entry) => ({
      wallet: entry.wallet,
      score: entry.insights.overall_score,
      walletAgeDays:
        entry.output.usage_summary.days_active * 21 +
        entry.output.usage_summary.unique_contracts * 14,
      activeDaysLast14: Math.min(14, entry.output.usage_summary.days_active),
      proofUsageEvents: entry.output.usage_summary.tx_count
    }));
  }, [data, source]);

  const simulationResult = useMemo(() => {
    if (!previewParticipants || previewParticipants.length === 0) {
      return null;
    }

    const allocationPlan = computeAllocationPlan(simulationConfig, previewParticipants, {
      supportsProofUsageFilter: true
    });
    const decisionSummary = computeDecisionSummary(simulationConfig, previewParticipants, {
      supportsProofUsageFilter: true
    });
    const eligibleWallets = new Set(
      allocationPlan.participants.map((participant) => participant.wallet)
    );
    const eligibleRiskCount =
      source === 'commentary' || source === 'insights'
        ? (data?.results as WalletRowWithInsights[] | undefined)?.filter((entry) => {
            if (!eligibleWallets.has(entry.wallet)) {
              return false;
            }
            return (
              entry.insights.behavior_tag === 'suspected_farm' ||
              entry.insights.farming_probability >= 0.5
            );
          }).length ?? 0
        : 0;
    const eligibleRiskPercent = allocationPlan.preview.eligibleCount
      ? (eligibleRiskCount / allocationPlan.preview.eligibleCount) * 100
      : decisionSummary.highRiskWallets.percent;

    return {
      allocationPlan,
      decisionSummary,
      eligibleRiskCount,
      eligibleRiskPercent,
      clusterRiskLevel: getClusterRiskLevel(eligibleRiskPercent)
    };
  }, [data, previewParticipants, simulationConfig, source]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
      <PageHeader
        eyebrow="Campaign"
        title={`Campaign: ${campaignId}`}
        subtitle={`Window: ${windowType} | Mock mode`}
        actions={
          <>
            <Link
              href="/campaigns"
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
            >
              View campaigns
            </Link>
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-400">
              Base URL: {baseUrl ?? 'Not set'}
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-400">
              Data source: {sourceLabel}
            </div>
          </>
        }
      />

      <LaunchYourCampaignCard
        participants={previewParticipants}
        supportsProofUsageFilter
      />

      <Link href="/demo/proof" className="text-sm text-slate-400 hover:text-slate-200">
        Back to proof
      </Link>

      {error && (
        <ErrorState title="Campaign load failed" description={error} />
      )}

      {loading && <LoadingSkeleton lines={4} />}

      {data && !loading && <KpiCards summary={data.summary} showInsights={showInsights} />}

      {previewParticipants && previewParticipants.length > 0 && simulationResult && (
        <div className="rounded-3xl border border-sky-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_42%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,23,42,0.84))] p-6 shadow-[0_24px_80px_rgba(56,189,248,0.10)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.2em] text-sky-200/80">
                Simulate Changes
              </p>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-white">
                Adjust decision rules without rerunning the campaign
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-200">
                This simulation uses the current wallet dataset already loaded on the page. It
                updates eligibility, allocation output, and risk locally without another API run.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-200">
              Current sample: {previewParticipants.length.toLocaleString()} wallets
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                Min score
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={simulationConfig.minScore}
                  onChange={(event) =>
                    setSimulationConfig((prev) => ({
                      ...prev,
                      minScore: Number(event.target.value || 0)
                    }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-white outline-none transition focus:border-sky-400/40"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm text-slate-300">
                Wallet age threshold
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={simulationConfig.walletAgeDays}
                  onChange={(event) =>
                    setSimulationConfig((prev) => ({
                      ...prev,
                      walletAgeDays: Number(event.target.value || 0)
                    }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-white outline-none transition focus:border-sky-400/40"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm text-slate-300">
                Active days threshold
                <input
                  type="number"
                  min="0"
                  max="14"
                  step="1"
                  value={simulationConfig.activeDaysLast14}
                  onChange={(event) =>
                    setSimulationConfig((prev) => ({
                      ...prev,
                      activeDaysLast14: Number(event.target.value || 0)
                    }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-white outline-none transition focus:border-sky-400/40"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm text-slate-300">
                Proof usage threshold
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={simulationConfig.proofUsageMinEvents ?? 0}
                  onChange={(event) =>
                    setSimulationConfig((prev) => ({
                      ...prev,
                      proofUsageMinEvents: Number(event.target.value || 0)
                    }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-white outline-none transition focus:border-sky-400/40"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm text-slate-300">
                Allocation logic
                <select
                  value={simulationConfig.transform}
                  onChange={(event) =>
                    setSimulationConfig((prev) => ({
                      ...prev,
                      transform: event.target.value as AllocationTransform
                    }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-white outline-none transition focus:border-sky-400/40"
                >
                  {simulationTransformOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2 text-sm text-slate-300">
                Equal split %
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="5"
                  value={simulationConfig.equalPercent}
                  onChange={(event) =>
                    setSimulationConfig((prev) => ({
                      ...prev,
                      equalPercent: Number(event.target.value || 0)
                    }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-white outline-none transition focus:border-sky-400/40"
                />
              </label>
            </div>

            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    Updated eligible count
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {simulationResult.allocationPlan.preview.eligibleCount.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    Updated avg allocation
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {formatAmount(simulationResult.allocationPlan.preview.estAvg)}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    Updated utilization
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {formatPercent(
                      simulationResult.allocationPlan.preview.budgetUtilizationPercent
                    )}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    Updated risk
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {formatPercent(simulationResult.eligibleRiskPercent)}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    Simulated distribution
                  </p>
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${riskLevelClassName[simulationResult.clusterRiskLevel]}`}
                  >
                    {simulationResult.clusterRiskLevel} risk
                  </span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Decision output
                    </p>
                    <p className="mt-1 text-sm text-white">
                      Eligible {simulationResult.decisionSummary.eligibleWallets.count} | Rejected{' '}
                      {simulationResult.decisionSummary.rejectedWallets.count}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Risk distribution
                    </p>
                    <p className="mt-1 text-sm text-white">
                      {simulationResult.eligibleRiskCount.toLocaleString()} risky eligible wallets
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Top 3 simulated allocations
                    </p>
                    <div className="mt-1 space-y-1 text-sm text-white">
                      {simulationResult.allocationPlan.allocations
                        .slice(0, 3)
                        .map((allocation) => (
                          <div key={allocation.wallet} className="font-mono text-xs">
                            {allocation.wallet.slice(0, 8)}... {formatAmount(allocation.amount)}
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {data && !loading && total === 0 && (
        <EmptyState
          title="No wallets returned"
          description="This campaign did not return any wallets for the selected mock run."
        />
      )}

      {data && !loading && total > 0 && source && (
        <>
          <Filters
            value={filters}
            onChange={setFilters}
            disabled={loading}
            insightsEnabled={showInsights}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-slate-200">Wallets</span>
              <span>
                Showing {sortedResults.length} of {total} wallets
              </span>
            </div>
            {sortLabel && (
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Sort: {sortLabel}
              </span>
            )}
          </div>

          {sortedResults.length === 0 ? (
            <EmptyState
              title="No wallets match"
              description="Adjust the current filters to bring matching wallets back into view."
            />
          ) : (
            <WalletTable results={sortedResults} source={source} />
          )}
        </>
      )}
    </div>
  );
};

export default DemoCampaignPage;
