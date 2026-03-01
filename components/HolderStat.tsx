'use client';

import { Users } from 'lucide-react';

import { useStats } from '@/hooks/useStats';
import StatCard from './ui/StatCard';

const HolderStat = () => {
  const { holderCount, isLoading, error } = useStats();

  const total = holderCount?.totalHolders;
  const value =
    error ? 'Error' : isLoading ? '...' : total !== undefined ? total.toLocaleString() : 'N/A';
  const status = error
    ? { label: 'Unavailable', tone: 'danger' as const }
    : isLoading
      ? { label: 'Syncing', tone: 'default' as const }
      : { label: 'Live', tone: 'success' as const };

  return (
    <StatCard
      title="Holders"
      subtitle="Unique wallets with IFLW"
      value={value}
      helperText="Aggregate across supported chains"
      icon={<Users size={22} />}
      status={status}
      className="h-full"
    />
  );
};

export default HolderStat;
