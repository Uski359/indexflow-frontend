'use client';

import { Sparkles } from 'lucide-react';

import ChainSelector from './ChainSelector';
import FaucetButton from './FaucetButton';

const Topbar = () => {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-[#1f1f2a] bg-[#0a0a0f]/80 px-4 py-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20 text-accent">
          <Sparkles size={18} />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">IndexFlow Explorer</p>
          <h2 className="text-lg font-semibold text-white">Network dashboard</h2>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <FaucetButton />
        <ChainSelector />
      </div>
    </header>
  );
};

export default Topbar;
