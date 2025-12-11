'use client';

import useSWR from 'swr';

import { fetchOperatorProofs, fetchRecentProofs } from '@/lib/api';
import type { Proof } from '@/types';

import { useChain } from './useChain';

export const useRecentProofs = () => {
  const { chain } = useChain();

  const { data, error, isLoading } = useSWR<Proof[]>(
    ['poi-recent', chain],
    () => fetchRecentProofs(chain),
    { refreshInterval: 12000, dedupingInterval: 4000 }
  );

  return {
    proofs: data ?? [],
    isLoading,
    error
  };
};

export const useOperatorProofs = (address?: string) => {
  const { chain } = useChain();

  const { data, error, isLoading } = useSWR<Proof[]>(
    address ? ['poi-operator', chain, address] : null,
    () => fetchOperatorProofs(address!, chain),
    { refreshInterval: 12000, dedupingInterval: 4000 }
  );

  return {
    proofs: data ?? [],
    isLoading,
    error
  };
};
