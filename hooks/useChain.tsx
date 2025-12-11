'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CHAINS = ['sepolia', 'polygon', 'arbitrum', 'base', 'optimism'] as const;
const STORAGE_KEY = 'indexflow.chain';

type Chain = (typeof CHAINS)[number];

type ChainContextValue = {
  chain: Chain;
  chains: Chain[];
  setChain: (chain: Chain) => void;
};

const ChainContext = createContext<ChainContextValue | undefined>(undefined);

export const ChainProvider = ({ children }: { children: ReactNode }) => {
  const [chain, setChainState] = useState<Chain>('sepolia');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEY) as Chain | null;
    if (stored && CHAINS.includes(stored)) {
      setChainState(stored);
    }
  }, []);

  const setChain = (next: Chain) => {
    setChainState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  };

  const value = useMemo(() => ({ chain, setChain, chains: [...CHAINS] }), [chain]);

  return <ChainContext.Provider value={value}>{children}</ChainContext.Provider>;
};

export const useChain = () => {
  const context = useContext(ChainContext);
  if (!context) {
    throw new Error('useChain must be used within a ChainProvider');
  }
  return context;
};
