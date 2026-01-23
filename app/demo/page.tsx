'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

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
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-white">IndexFlow Demo</h1>
        <p className="mt-2 text-sm text-slate-400">
          Mock mode | Base URL: {baseUrl ?? 'Not set'}
        </p>
      </div>

      {!baseUrl && (
        <div className="mb-6 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">
          Set `NEXT_PUBLIC_API_BASE_URL` in your frontend environment to connect the
          demo dashboard to the backend.
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <label className="block text-sm text-slate-300">Campaign</label>
          <select
            value={campaignId}
            onChange={(event) => setCampaignId(event.target.value)}
            className="mt-3 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
          >
            <option value="airdrop_v1">airdrop_v1</option>
          </select>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <label className="block text-sm text-slate-300">Window</label>
          <select
            value={windowType}
            onChange={(event) => setWindowType(event.target.value as WindowType)}
            className="mt-3 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
          >
            {windowOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={handleOpen}
        disabled={!baseUrl}
        className="mt-8 inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-white/40 disabled:text-slate-500"
      >
        Open dashboard
      </button>
    </div>
  );
};

export default DemoPage;
