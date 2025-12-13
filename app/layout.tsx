import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';

import Layout from '@/components/Layout';
import { ChainProvider } from '@/hooks/useChain';
import Providers from './providers';

import '../styles/globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'IndexFlow Explorer',
  description: 'Multi-chain IndexFlow dashboard for holders, supply, and transfers'
};

const RootLayout = ({ children }: { children: ReactNode }) => {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} bg-[#0a0a0f] text-white antialiased`}>
        <Providers>
          <ChainProvider>
            <Layout>{children}</Layout>
          </ChainProvider>
        </Providers>
      </body>
    </html>
  );
};

export default RootLayout;
