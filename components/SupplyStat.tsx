'use client';

import { Coins } from 'lucide-react';

import { useStats } from '@/hooks/useStats';

import Card from './Card';

const formatSupply = (raw?: number) => {
  if (raw === undefined || raw === null) return 'N/A';
  const num = Number(raw);
  if (Number.isNaN(num)) return String(raw);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toLocaleString();
};

const SupplyStat = () => {
  const { supply, isLoading, error } = useStats();
  const value = supply?.totalSupply;

  const display = error ? 'Error' : isLoading ? '...' : formatSupply(value);

  return (
    <Card title="Total Supply" subtitle="Indexed token supply" className="h-full">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-3xl font-semibold tracking-tight text-white">{display}</p>
          <p className="text-sm text-gray-400">Updated live from transfers</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/20 text-accent">
          <Coins size={22} />
        </div>
      </div>
    </Card>
  );
};

export default SupplyStat;
