import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import type { ReactNode } from 'react';

import Layout from '@/components/Layout';
import { ChainProvider } from '@/hooks/useChain';
import { AppProviders } from './providers';

import '../styles/globals.css';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope' });

export const metadata: Metadata = {
  title: 'IndexFlow',
  description: 'Minimal monitoring workspace for protocol indexing and proof checks'
};

const RootLayout = ({ children }: { children: ReactNode }) => {
  return (
    <html lang="en" className={manrope.variable}>
      <body className={`${manrope.className} bg-background text-slate-100 antialiased`}>
        <AppProviders>
          <ChainProvider>
            <Layout>{children}</Layout>
          </ChainProvider>
        </AppProviders>
      </body>
    </html>
  );
};

export default RootLayout;
