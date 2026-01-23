'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Route } from 'next';
import {
  ActivitySquare,
  HeartPulse,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  Wallet
} from 'lucide-react';
import classNames from 'classnames';

const navItems: { href: Route; label: string; icon: typeof LayoutDashboard }[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transfers', label: 'Transfers', icon: ActivitySquare },
  { href: '/proof-of-usage', label: 'Proof-of-Usage', icon: ShieldCheck },
  { href: '/health', label: 'Health', icon: HeartPulse }
];

const Sidebar = () => {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-[#1f1f2a] bg-[#0a0a0f]/80 px-4 py-6 backdrop-blur lg:flex">
      <div className="mb-10 flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20 text-accent">
          <Wallet size={20} />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">IndexFlow</p>
          <h1 className="text-lg font-semibold text-white">Explorer</h1>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname?.startsWith(item.href + '/');

          return (
            <Link
              key={item.href}
              href={item.href}
              className={classNames(
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                active
                  ? 'bg-[#111118] text-white'
                  : 'text-gray-400 hover:bg-[#111118]/70 hover:text-white'
              )}
            >
              <Icon
                size={18}
                className={classNames(
                  'transition',
                  active ? 'text-accent' : 'text-gray-500 group-hover:text-accent'
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <a
          href="https://www.indexflow.network/demo"
          className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 transition hover:bg-[#111118]/70 hover:text-white"
        >
          <Sparkles size={18} className="text-gray-500 transition group-hover:text-accent" />
          <span>Demo</span>
        </a>
      </nav>

      <div className="rounded-lg border border-[#1f1f2a] bg-[#111118] px-3 py-4 text-sm text-gray-400">
        <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">Indexer</p>
        <p>Monitor token transfers across supported chains in real time.</p>
      </div>
    </aside>
  );
};

export default Sidebar;
