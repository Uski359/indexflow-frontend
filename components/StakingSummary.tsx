'use client';

import type { ReactNode } from 'react';
import { ShieldCheck, Sparkles } from 'lucide-react';
import classNames from 'classnames';

import { useGlobalStaking } from '@/hooks/useStaking';

import Card from './Card';

const formatTokenAmount = (value?: string) => {
  if (!value) return '0';
  const num = Number(value) / 1e18;
  if (!Number.isFinite(num)) return value;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toFixed(2);
};

const StatPill = ({
  label,
  value,
  accent,
  icon
}: {
  label: string;
  value: string;
  accent: string;
  icon: ReactNode;
}) => (
  <div
    className={classNames(
      'relative overflow-hidden rounded-xl border border-[#1f1f2a] bg-[#0d0d14]/80 p-4',
      accent
    )}
  >
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-accent">
        {icon}
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.12em] text-gray-400">{label}</p>
        <p className="text-xl font-semibold text-white">{value}</p>
      </div>
    </div>
  </div>
);

const StakingSummary = () => {
  const { stats, isLoading } = useGlobalStaking();

  const metrics = [
    {
      label: 'Total Staked',
      value: formatTokenAmount(stats?.totalStaked),
      accent: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
      icon: <ShieldCheck size={18} className="text-emerald-400" />
    },
    {
      label: 'Rewards Distributed',
      value: formatTokenAmount(stats?.totalRewardsDistributed),
      accent: 'from-amber-500/10 via-amber-500/5 to-transparent',
      icon: <Sparkles size={18} className="text-amber-300" />
    },
    {
      label: 'Active Stakers',
      value: stats?.totalStakers?.toLocaleString() ?? (isLoading ? '...' : '0'),
      accent: 'from-blue-500/10 via-blue-500/5 to-transparent',
      icon: <ShieldCheck size={18} className="text-blue-300" />
    }
  ];

  return (
    <Card
      title="IFLW Staking Pool"
      subtitle="Real-time staking and reward distribution"
      className="bg-gradient-to-br from-[#141427] via-[#0c0c16] to-[#090910]"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {metrics.map((metric) => (
          <StatPill key={metric.label} {...metric} />
        ))}
      </div>
      <p className="mt-4 text-sm text-gray-400">
        Staking rewards are funded from the protocol pool (non-inflationary) and accrue linearly
        based on your share of total stake over time.
      </p>
    </Card>
  );
};

export default StakingSummary;
