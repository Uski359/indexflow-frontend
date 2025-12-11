'use client';

import { Activity } from 'lucide-react';

import { useStats } from '@/hooks/useStats';

import Card from './Card';

const ThroughputStat = () => {
  const { throughput, activity, isLoading, error } = useStats();
  const count = throughput?.transferCount24h ?? activity?.transferCount24h;

  const display =
    error ? 'Error' : isLoading ? '...' : count !== undefined ? count.toLocaleString() : 'N/A';

  const tag = error ? 'Error' : isLoading ? 'Syncing' : 'Live';

  return (
    <Card title="Throughput" subtitle="Transfers in last 24h" className="h-full">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-3xl font-semibold tracking-tight text-white">{display}</p>
          <p className="text-sm text-gray-400">Real-time feed from the indexer</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/20 text-accent">
            <Activity size={22} />
          </div>
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
            {tag}
          </span>
        </div>
      </div>
    </Card>
  );
};

export default ThroughputStat;
