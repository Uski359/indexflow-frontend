'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import {
  loadCampaignAllocations,
  loadCampaignById
} from '@/src/features/campaignLaunch/storage';
import type {
  CampaignAllocation,
  CampaignRecord
} from '@/src/features/campaignLaunch/types';

const formatDateTime = (value: string): string => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Unknown' : parsed.toLocaleString();
};

const formatAmount = (value: number): string =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: value < 100 ? 2 : 0,
    maximumFractionDigits: 2
  });

const CampaignDetailPage = () => {
  const params = useParams();
  const campaignId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [campaign, setCampaign] = useState<CampaignRecord | null | undefined>(undefined);
  const [allocations, setAllocations] = useState<CampaignAllocation[]>([]);
  const [copyState, setCopyState] = useState<string | null>(null);

  useEffect(() => {
    if (!campaignId || typeof campaignId !== 'string') {
      setCampaign(null);
      setAllocations([]);
      return;
    }

    const nextCampaign = loadCampaignById(campaignId);
    setCampaign(nextCampaign);
    setAllocations(nextCampaign ? loadCampaignAllocations(campaignId) : []);
  }, [campaignId]);

  const topAllocations = useMemo(() => allocations.slice(0, 50), [allocations]);

  const exportCsv = () => {
    if (!campaign) {
      return;
    }

    const lines = [
      'wallet,amount,share_percent,score,wallet_age_days,active_days_last_14,proof_usage_events'
    ];

    allocations.forEach((allocation) => {
      lines.push(
        [
          allocation.wallet,
          allocation.amount,
          allocation.sharePercent,
          allocation.score,
          allocation.walletAgeDays,
          allocation.activeDaysLast14,
          allocation.proofUsageEvents ?? ''
        ].join(',')
      );
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${campaign.config.name || 'campaign'}-${campaign.id}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const copyCampaignId = async () => {
    if (!campaignId || !navigator?.clipboard?.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(campaignId);
      setCopyState('Campaign id copied');
      window.setTimeout(() => setCopyState(null), 1600);
    } catch {
      setCopyState('Copy failed');
      window.setTimeout(() => setCopyState(null), 1600);
    }
  };

  if (campaign === undefined) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <LoadingSkeleton lines={8} />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
        <PageHeader
          eyebrow="Campaigns"
          title="Campaign not found"
          subtitle="This campaign id does not exist in local storage."
        />
        <ErrorState
          title="Missing campaign"
          description="Launch a new campaign first, or return to the campaigns registry."
          action={
            <Link
              href="/campaigns"
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
            >
              Back to campaigns
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
      <PageHeader
        eyebrow="Campaign detail"
        title={campaign.config.name}
        subtitle={`Status ${campaign.status} | Snapshot ${formatDateTime(campaign.snapshotAt)}`}
        actions={
          <>
            <button
              type="button"
              onClick={exportCsv}
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/5"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => {
                void copyCampaignId();
              }}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
            >
              Copy campaign id
            </button>
          </>
        }
      />

      {copyState ? (
        <div className="rounded-2xl border border-white/5 bg-background/50 px-4 py-3 text-sm text-slate-300">
          {copyState}
        </div>
      ) : null}

      <Link href="/campaigns" className="text-sm text-slate-400 hover:text-slate-200">
        Back to campaigns
      </Link>

      <SectionCard
        title="Summary"
        description="Budget, utilization, and allocation distribution."
        eyebrow="Overview"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/5 bg-background/50 p-4 text-sm text-slate-300">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Budget</p>
            <p className="mt-2 text-xl font-semibold text-white">
              {formatAmount(campaign.config.budget)} IFLW
            </p>
          </div>
          <div className="rounded-2xl border border-white/5 bg-background/50 p-4 text-sm text-slate-300">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Eligible</p>
            <p className="mt-2 text-xl font-semibold text-white">
              {campaign.preview.eligibleCount.toLocaleString()}
            </p>
          </div>
          <div className="rounded-2xl border border-white/5 bg-background/50 p-4 text-sm text-slate-300">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Avg / wallet</p>
            <p className="mt-2 text-xl font-semibold text-white">
              {formatAmount(campaign.preview.estAvg)} IFLW
            </p>
          </div>
          <div className="rounded-2xl border border-white/5 bg-background/50 p-4 text-sm text-slate-300">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Utilization</p>
            <p className="mt-2 text-xl font-semibold text-white">
              {campaign.preview.budgetUtilizationPercent.toFixed(1)}%
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Configuration"
        description="Stored config values from launch time."
        eyebrow="Config"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 text-sm text-slate-300">
          <div>Type: <span className="text-white">{campaign.config.type}</span></div>
          <div>Max / wallet: <span className="text-white">{formatAmount(campaign.config.maxPerWallet)}</span></div>
          <div>Min / wallet: <span className="text-white">{formatAmount(campaign.config.minPerWallet)}</span></div>
          <div>Max share: <span className="text-white">{campaign.config.maxSharePercent}%</span></div>
          <div>Transform: <span className="text-white">{campaign.config.transform}</span></div>
          <div>Equal split: <span className="text-white">{campaign.config.equalPercent}%</span></div>
          <div>Rounding: <span className="text-white">{campaign.config.roundingRule}</span></div>
          <div>Min score: <span className="text-white">{campaign.config.minScore}</span></div>
          <div>Wallet age: <span className="text-white">{campaign.config.walletAgeDays} days</span></div>
          <div>Active days: <span className="text-white">{campaign.config.activeDaysLast14}</span></div>
          <div>Start: <span className="text-white">{formatDateTime(campaign.config.startDate)}</span></div>
          <div>End: <span className="text-white">{formatDateTime(campaign.config.endDate)}</span></div>
        </div>
      </SectionCard>

      <SectionCard
        title="Allocations"
        description="Top 50 wallets by allocation amount."
        eyebrow="Distribution"
      >
        {topAllocations.length === 0 ? (
          <EmptyState
            title="No allocations"
            description="This campaign has no persisted allocations."
            compact
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs uppercase tracking-[0.18em] text-slate-400">
                  <th className="px-3 py-2">Wallet</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Share</th>
                  <th className="px-3 py-2">Score</th>
                  <th className="px-3 py-2">Active</th>
                </tr>
              </thead>
              <tbody>
                {topAllocations.map((allocation) => (
                  <tr key={allocation.wallet} className="border-b border-white/5 last:border-0">
                    <td className="px-3 py-3 font-mono text-xs text-slate-200">{allocation.wallet}</td>
                    <td className="px-3 py-3 text-slate-200">{formatAmount(allocation.amount)}</td>
                    <td className="px-3 py-3 text-slate-300">{allocation.sharePercent.toFixed(2)}%</td>
                    <td className="px-3 py-3 text-slate-300">{allocation.score.toFixed(2)}</td>
                    <td className="px-3 py-3 text-slate-300">{allocation.activeDaysLast14}/14</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
};

export default CampaignDetailPage;
