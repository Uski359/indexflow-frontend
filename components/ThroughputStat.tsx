'use client';

import { Activity } from 'lucide-react';

import { useStats } from '@/hooks/useStats';
import StatCard from './ui/StatCard';

const ThroughputStat = () => {
  const { throughput, activity, isLoading, error } = useStats();
  const count = throughput?.transferCount24h ?? activity?.transferCount24h;

  const display =
    error ? 'Error' : isLoading ? '...' : count !== undefined ? count.toLocaleString() : 'N/A';

  const status = error
    ? { label: 'Unavailable', tone: 'danger' as const }
    : isLoading
      ? { label: 'Syncing', tone: 'default' as const }
      : { label: 'Live', tone: 'success' as const };

  return (
    <StatCard
      title="Throughput"
      subtitle="Transfers in last 24h"
      value={display}
      helperText="Real-time feed from the indexer"
      icon={<Activity size={22} />}
      status={status}
      className="h-full"
    />
  );
};

export default ThroughputStat;
