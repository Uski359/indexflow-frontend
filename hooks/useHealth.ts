'use client';

import useSWR from 'swr';

import { fetchHealth } from '@/lib/api';
import type { IndexerHealth } from '@/types';

import { useChain } from './useChain';

export const useHealth = () => {
  const { chain } = useChain();

  const { data, error, isLoading, mutate } = useSWR<IndexerHealth>(
    ['health', chain],
    () => fetchHealth(chain),
    {
      refreshInterval: 5000,
      dedupingInterval: 2000
    }
  );

  return {
    health: data,
    isLoading,
    error,
    mutate
  };
};
