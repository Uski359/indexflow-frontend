'use client';

import classNames from 'classnames';
import { Home, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { isRouteActive, visibleNavRoutes } from '@/config/features';

const iconByRoute: Record<string, typeof Home> = {
  '/': Home,
  '/demo/proof': ShieldCheck
};

const Sidebar = () => {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border/70 bg-background/90 px-4 py-6 backdrop-blur lg:flex">
      <div className="mb-10 flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent">
          <Wallet size={20} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            IndexFlow
          </p>
          <h1 className="text-lg font-semibold text-white">Workspace</h1>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-2">
        {visibleNavRoutes.map((route) => {
          const Icon = iconByRoute[route.href] ?? Sparkles;
          const active = isRouteActive(pathname, route);

          return (
            <Link
              key={route.href}
              href={route.href}
              className={classNames(
                'group flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition',
                active
                  ? 'bg-white text-slate-950'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              )}
            >
              <Icon
                size={18}
                className={classNames(
                  'transition',
                  active ? 'text-slate-950' : 'text-slate-400 group-hover:text-accent'
                )}
              />
              <span>{route.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="rounded-2xl border border-border/70 bg-card/80 px-3 py-4 text-sm text-slate-300">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Minimal IA
        </p>
        <p>Only the core product views stay visible. Internal tooling remains behind the scenes.</p>
      </div>
    </aside>
  );
};

export default Sidebar;
