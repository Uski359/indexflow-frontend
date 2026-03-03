'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import EmptyState from '@/components/ui/EmptyState';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import { loadCampaigns } from '@/src/features/campaignLaunch/storage';
import type { CampaignRecord } from '@/src/features/campaignLaunch/types';

const formatDateTime = (value: string): string => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Unknown' : parsed.toLocaleString();
};

const CampaignsPage = () => {
  const [campaigns, setCampaigns] = useState<CampaignRecord[] | null>(null);

  useEffect(() => {
    setCampaigns(loadCampaigns());
  }, []);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
      <PageHeader
        eyebrow="Campaigns"
        title="Launched campaigns"
        subtitle="Browse locally persisted campaign runs, their budgets, and eligibility snapshots."
        actions={
          <Link
            href="/demo/campaign/airdrop_v1#launch-your-campaign"
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
          >
            New campaign
          </Link>
        }
      />

      {campaigns === null ? (
        <LoadingSkeleton lines={6} />
      ) : campaigns.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          description="Launch a campaign from the campaign utility to persist it here."
          action={
            <Link
              href="/demo/campaign/airdrop_v1#launch-your-campaign"
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
            >
              Open launcher
            </Link>
          }
        />
      ) : (
        <SectionCard
          title="Campaign registry"
          description="Stored campaigns with current budget and eligibility snapshots."
          eyebrow="Local storage"
        >
          <div className="space-y-3">
            {campaigns.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/campaigns/${campaign.id}`}
                className="block rounded-2xl border border-white/5 bg-background/50 px-4 py-4 transition hover:border-white/10 hover:bg-background/70"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white">{campaign.config.name}</p>
                    <p className="text-xs text-slate-300">
                      {campaign.config.type} | {campaign.status} | Created {formatDateTime(campaign.createdAt)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm text-slate-200 md:grid-cols-3">
                    <span>Budget: {campaign.config.budget.toLocaleString()}</span>
                    <span>Eligible: {campaign.preview.eligibleCount.toLocaleString()}</span>
                    <span>Avg: {campaign.preview.estAvg.toFixed(2)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
};

export default CampaignsPage;
