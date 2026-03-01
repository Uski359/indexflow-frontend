'use client';

import classNames from 'classnames';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { isRouteActive, visibleNavRoutes } from '@/config/features';

const AppNavigation = () => {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="flex flex-wrap items-center gap-2">
      {visibleNavRoutes.map((route) => {
        const active = isRouteActive(pathname, route);

        return (
          <Link
            key={route.href}
            href={route.href}
            className={classNames(
              'rounded-full px-4 py-2 text-sm font-medium transition',
              active
                ? 'bg-white text-slate-950'
                : 'text-slate-300 hover:bg-white/5 hover:text-white'
            )}
          >
            {route.label}
          </Link>
        );
      })}
    </nav>
  );
};

export default AppNavigation;
