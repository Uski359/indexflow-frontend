'use client';

import { ArrowRight, FlaskConical } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import ErrorState from '@/components/ui/ErrorState';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import { getDemoApiBaseUrl } from '@/lib/api';

type WindowType = 'last_7_days' | 'last_14_days' | 'last_30_days';

const windowOptions: { value: WindowType; label: string }[] = [
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'last_14_days', label: 'Last 14 days' },
  { value: 'last_30_days', label: 'Last 30 days' }
];

const DemoPage = () => {
  const router = useRouter();
  const [campaignId, setCampaignId] = useState('airdrop_v1');
  const [windowType, setWindowType] = useState<WindowType>('last_30_days');
  const baseUrl = getDemoApiBaseUrl();

  const handleOpen = () => {
    router.push(`/demo/campaign/${campaignId}?window=${windowType}`);
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
      <PageHeader
        eyebrow="Demo"
        title="IndexFlow demo"
        subtitle="Configure your campaign, choose a window, and move directly into the campaign review flow."
        actions={
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-400">
            Base URL: {baseUrl ?? 'Not set'}
          </div>
        }
      />

      {!baseUrl ? (
        <ErrorState
          title="Backend URL missing"
          description="Set `NEXT_PUBLIC_API_BASE_URL` in the frontend environment to connect the demo flow to the backend."
        />
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <SectionCard
          title="Campaign"
          description="Select the campaign to review."
          eyebrow="Setup"
          actions={
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <FlaskConical size={18} />
            </div>
          }
        >
          <label className="block text-sm text-slate-300">Campaign</label>
          <select
            value={campaignId}
            onChange={(event) => setCampaignId(event.target.value)}
            className="mt-3 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-white"
          >
            <option value="airdrop_v1">airdrop_v1</option>
          </select>
        </SectionCard>

        <SectionCard
          title="Window"
          description="Choose the scoring window."
          eyebrow="Setup"
        >
          <label className="block text-sm text-slate-300">Window</label>
          <select
            value={windowType}
            onChange={(event) => setWindowType(event.target.value as WindowType)}
            className="mt-3 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-white"
          >
            {windowOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </SectionCard>
      </div>

      <button
        type="button"
        onClick={handleOpen}
        disabled={!baseUrl}
        className="inline-flex items-center justify-center gap-2 self-start rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-white/40 disabled:text-slate-500"
      >
        <span>Launch campaign</span>
        <ArrowRight size={16} />
      </button>
    </div>
  );
};

export default DemoPage;
