'use client';

import { Users } from 'lucide-react';

import { useStats } from '@/hooks/useStats';

import Card from './Card';

const HolderStat = () => {
  const { holderCount, isLoading, error } = useStats();

  const total = holderCount?.totalHolders;
  const value =
    error ? 'Error' : isLoading ? '...' : total !== undefined ? total.toLocaleString() : 'N/A';

  return (
    <Card title="Holders" subtitle="Unique wallets with IFLW">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/20 text-accent">
          <Users size={22} />
        </div>
        <div>
          <p className="text-2xl font-semibold text-white">{value}</p>
          <p className="text-sm text-gray-400">Aggregate across supported chains</p>
        </div>
      </div>
    </Card>
  );
};

export default HolderStat;
