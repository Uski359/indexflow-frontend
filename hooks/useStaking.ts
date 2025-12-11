'use client';

import useSWR from 'swr';

import { fetchGlobalStaking, fetchUserStaking } from '@/lib/api';
import type { GlobalStakingStats, StakingUser } from '@/types';

import { useChain } from './useChain';

export const useGlobalStaking = () => {
  const { chain } = useChain();

  const { data, error, isLoading } = useSWR<GlobalStakingStats>(
    ['staking-global', chain],
    () => fetchGlobalStaking(chain),
    { refreshInterval: 12000, dedupingInterval: 4000 }
  );

  return {
    stats: data,
    isLoading,
    error
  };
};

export const useUserStaking = (address?: string) => {
  const { chain } = useChain();

  const { data, error, isLoading } = useSWR<StakingUser>(
    address ? ['staking-user', chain, address] : null,
    () => fetchUserStaking(address!, chain),
    { refreshInterval: 12000, dedupingInterval: 4000 }
  );

  return {
    stats: data,
    isLoading,
    error
  };
};
