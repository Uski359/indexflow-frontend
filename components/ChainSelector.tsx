'use client';

import { ChevronDown } from 'lucide-react';
import classNames from 'classnames';

import { useChain } from '@/hooks/useChain';

const ChainSelector = () => {
  const { chain, chains, setChain } = useChain();

  return (
    <div className="relative w-44">
      <select
        value={chain}
        onChange={(event) => setChain(event.target.value as typeof chain)}
        className={classNames(
          'w-full appearance-none rounded-lg border border-[#1f1f2a] bg-[#111118] px-3 py-2 text-sm text-white shadow-sm outline-none transition',
          'focus:border-accent focus:ring-1 focus:ring-accent'
        )}
      >
        {chains.map((option) => (
          <option key={option} value={option} className="bg-[#0a0a0f] text-white">
            {option.toUpperCase()}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
      />
    </div>
  );
};

export default ChainSelector;
