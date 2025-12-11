'use client';

import useSWR from 'swr';

import { fetchRecentTransfers } from '@/lib/api';
import type { Transfer } from '@/types';

import { useChain } from './useChain';

type UseTransfersOptions = {
  address?: string;
  limit?: number;
};

export const useTransfers = (options?: UseTransfersOptions) => {
  const { chain } = useChain();
  const address = options?.address;

  const { data, error, isLoading, mutate } = useSWR<Transfer[]>(
    ['transfers', chain, address, options?.limit],
    () => fetchRecentTransfers({ chain, address, limit: options?.limit }),
    {
      refreshInterval: 10000,
      dedupingInterval: 2000
    }
  );

  return {
    transfers: data ?? [],
    isLoading,
    error,
    mutate
  };
};
