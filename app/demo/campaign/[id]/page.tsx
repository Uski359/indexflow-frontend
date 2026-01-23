'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { demoApiFetch, getDemoApiBaseUrl } from '@/lib/api';
import type { CampaignRunItem, CampaignRunResponse } from '@/lib/types';

import Filters, { type FilterState } from './components/Filters';
import KpiCards from './components/KpiCards';
import WalletTable from './components/WalletTable';

type WindowType = 'last_7_days' | 'last_14_days' | 'last_30_days';

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
  cachedOnly: false
};

const isWindowType = (value: string | null): value is WindowType => {
  return value === 'last_7_days' || value === 'last_14_days' || value === 'last_30_days';
};

const DemoCampaignPage = () => {
  const params = useParams();
  const searchParams = useSearchParams();
  const windowParam = searchParams.get('window');
  const windowType: WindowType = isWindowType(windowParam) ? windowParam : 'last_30_days';
  const baseUrl = getDemoApiBaseUrl();

  const campaignId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [data, setData] = useState<CampaignRunResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!campaignId || typeof campaignId !== 'string') {
        setError('Missing campaign id.');
        setData(null);
        return;
      }

      if (!baseUrl) {
        setError(
          'NEXT_PUBLIC_API_BASE_URL is not set. Add it to your frontend environment.'
        );
        setData(null);
        return;
      }

      setLoading(true);
      setError(null);

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

        const result = await demoApiFetch<CampaignRunResponse>('/v1/campaign/run', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        if (!cancelled) {
          setData(result);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unexpected error.';
        if (!cancelled) {
          setError(message);
          setData(null);
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

  const filteredResults = useMemo<CampaignRunItem[]>(() => {
    if (!data) {
      return [];
    }

    return data.results.filter((entry) => {
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
  }, [data, filters]);

  const total = data?.summary.total ?? 0;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/demo" className="text-sm text-slate-400 hover:text-slate-200">
            Back to demo
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-white">
            Campaign: {campaignId}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Window: {windowType} | Mock mode
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

      {loading && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          Loading campaign data...
        </div>
      )}

      {data && !loading && <KpiCards summary={data.summary} />}

      {data && !loading && total === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
          No wallets returned
        </div>
      )}

      {data && !loading && total > 0 && (
        <>
          <Filters value={filters} onChange={setFilters} disabled={loading} />

          <div className="flex items-center justify-between text-sm text-slate-400">
            <span>
              Showing {filteredResults.length} of {total} wallets
            </span>
          </div>

          {filteredResults.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
              No wallets match the current filters.
            </div>
          ) : (
            <WalletTable results={filteredResults} />
          )}
        </>
      )}
    </div>
  );
};

export default DemoCampaignPage;
