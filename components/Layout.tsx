import type { ReactNode } from 'react';

import Sidebar from './Sidebar';
import Topbar from './Topbar';

type LayoutProps = {
  children: ReactNode;
};

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="flex min-h-screen bg-[#0a0a0f] text-white">
      <Sidebar />
      <div className="flex flex-1 flex-col lg:ml-64">
        <Topbar />
        <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
