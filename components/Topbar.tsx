'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';

import { primaryCtaRoute } from '@/config/features';

import ChainSelector from './ChainSelector';
import WalletButton from './WalletButton';
import AppNavigation from './navigation/AppNavigation';

const Topbar = () => {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                IndexFlow
              </p>
              <h2 className="text-lg font-semibold text-white">Demo workspace</h2>
            </div>
          </Link>
          <AppNavigation />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={primaryCtaRoute.href}
            className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
          >
            Run proof check
          </Link>
          <ChainSelector />
          <WalletButton />
        </div>
      </div>
    </header>
  );
};

export default Topbar;
