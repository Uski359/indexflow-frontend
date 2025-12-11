'use client';

import useSWR from 'swr';

import {
  fetchActivityStats,
  fetchHolderCount,
  fetchSupply,
  fetchThroughputStats
} from '@/lib/api';
import type { ActivityStats, HolderCount, SupplyStat, ThroughputStats } from '@/types';

import { useChain } from './useChain';

export const useStats = () => {
  const { chain } = useChain();

  const supplySWR = useSWR<SupplyStat>(
    ['supply', chain],
    () => fetchSupply(chain),
    {
      refreshInterval: 15000,
      dedupingInterval: 3000
    }
  );

  const holdersSWR = useSWR<HolderCount>(
    ['holder-count', chain],
    () => fetchHolderCount(chain),
    {
      refreshInterval: 15000,
      dedupingInterval: 3000
    }
  );

  const activitySWR = useSWR<ActivityStats>(
    ['activity', chain],
    () => fetchActivityStats(chain),
    {
      refreshInterval: 20000,
      dedupingInterval: 3000
    }
  );

  const throughputSWR = useSWR<ThroughputStats>(
    ['throughput', chain],
    () => fetchThroughputStats(chain),
    {
      refreshInterval: 15000,
      dedupingInterval: 3000
    }
  );

  return {
    supply: supplySWR.data,
    holderCount: holdersSWR.data,
    activity: activitySWR.data,
    throughput: throughputSWR.data,
    isLoading:
      supplySWR.isLoading || holdersSWR.isLoading || activitySWR.isLoading || throughputSWR.isLoading,
    error: supplySWR.error || holdersSWR.error || activitySWR.error || throughputSWR.error
  };
};
