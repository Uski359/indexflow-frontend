'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { demoApiFetch, getDemoApiBaseUrl } from '@/lib/api';
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
          `/v1/campaign/${campaignId}/mock-wallets?count=200`
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

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/demo/proof" className="text-sm text-slate-400 hover:text-slate-200">
            Back to proof
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-white">
            Campaign: {campaignId}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Window: {windowType} | Mock mode
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-400">
            Base URL: {baseUrl ?? 'Not set'}
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-400">
            Data source: {sourceLabel}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">
          {error}
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          Loading campaign data...
        </div>
      )}

      {data && !loading && <KpiCards summary={data.summary} showInsights={showInsights} />}

      {data && !loading && total === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
          No wallets returned
        </div>
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
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
              No wallets match the current filters.
            </div>
          ) : (
            <WalletTable results={sortedResults} source={source} />
          )}
        </>
      )}
    </div>
  );
};

export default DemoCampaignPage;
