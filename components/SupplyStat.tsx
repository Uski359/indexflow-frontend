'use client';

import { Coins } from 'lucide-react';

import { useStats } from '@/hooks/useStats';
import { formatLargeNumber } from '@/lib/format';

import Card from './Card';

const SupplyStat = () => {
  const { supply, isLoading, error } = useStats();
  const value = supply?.totalSupply;

  const supplyDecimals = Number(process.env.NEXT_PUBLIC_SUPPLY_DECIMALS ?? 9);
  const display =
    error || supplyDecimals < 0
      ? 'Error'
      : isLoading
        ? '...'
        : formatLargeNumber(value, { decimals: supplyDecimals });
  const fullValueLabel =
    value === undefined || value === null
      ? 'N/A'
      : typeof value === 'number'
        ? value.toLocaleString(undefined, { maximumFractionDigits: 18 })
        : String(value);

  return (
    <Card title="Total Supply" subtitle="Indexed token supply" className="h-full">
      <div className="flex items-center justify-between">
        <div>
          <p
            className="text-3xl font-semibold tracking-tight text-white"
            title={error ? 'Failed to load supply' : isLoading ? 'Loading supply...' : fullValueLabel}
          >
            {display}
          </p>
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
