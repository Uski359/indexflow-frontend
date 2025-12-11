'use client';

import { Medal, Sparkles, Users } from 'lucide-react';

import { useContributionLeaderboard } from '@/hooks/useContributions';
import type { ContributionLeaderboardEntry } from '@/types';

import Card from './Card';

type ContributionEntry = Partial<ContributionLeaderboardEntry>;

const formatWeight = (weight: string | number | undefined) => {
  if (weight === undefined || weight === null) return '0';

  const num = Number(weight);
  if (!Number.isFinite(num)) return String(weight);

  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;

  return num.toFixed(0);
};

const ContributionLeaderboard = () => {
  const { leaderboard, isLoading } = useContributionLeaderboard(8);

  const entries: ContributionEntry[] = isLoading
    ? Array.from({ length: 5 }).map(() => ({}))
    : leaderboard;

  return (
    <Card
      title="Data / Share-to-Earn"
      subtitle="Weighted contributions that feed reward campaigns"
      className="bg-gradient-to-br from-[#161521] via-[#0f0f18] to-[#0a0a12]"
    >
      <div className="space-y-3">
        {entries.map((entry: ContributionEntry, idx: number) => (
          <div
            key={idx}
            className="flex items-center justify-between rounded-lg border border-[#1f1f2a] bg-[#0e0e15] px-3 py-2"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-gray-200">
                {idx === 0 ? (
                  <Medal size={16} className="text-amber-400" />
                ) : (
                  <Users size={16} />
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-gray-500">Contributor</p>
                <p className="font-mono text-sm text-white">
                  {entry.user ?? `0x${''.padEnd(8, '0')}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-emerald-300" />
              <p className="text-sm font-semibold text-white">{formatWeight(entry.totalWeight)}</p>
            </div>
          </div>
        ))}

        {!isLoading && leaderboard.length === 0 && (
          <p className="py-2 text-center text-sm text-gray-500">No contributions recorded yet.</p>
        )}
      </div>
    </Card>
  );
};

export default ContributionLeaderboard;
