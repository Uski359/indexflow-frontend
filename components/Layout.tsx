import type { ReactNode } from 'react';

import Topbar from './Topbar';

type LayoutProps = {
  children: ReactNode;
};

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen text-white">
      <Topbar />
      <div className="mx-auto flex w-full max-w-7xl flex-col px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
