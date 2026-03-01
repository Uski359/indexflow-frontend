'use client';

import { Coins } from 'lucide-react';

import { useStats } from '@/hooks/useStats';
import { formatLargeNumber } from '@/lib/format';
import StatCard from './ui/StatCard';

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
  const status = error
    ? { label: 'Unavailable', tone: 'danger' as const }
    : isLoading
      ? { label: 'Syncing', tone: 'default' as const }
      : { label: 'Live', tone: 'success' as const };

  return (
    <StatCard
      title="Total Supply"
      subtitle="Indexed token supply"
      value={display}
      helperText={error ? 'Failed to load supply' : isLoading ? 'Loading supply...' : fullValueLabel}
      icon={<Coins size={22} />}
      status={status}
      className="h-full"
    />
  );
};

export default SupplyStat;
