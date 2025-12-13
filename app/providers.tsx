"use client";

import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { WagmiConfig } from "wagmi";

import { wagmiConfig } from "@/lib/wagmi";

type ProvidersProps = {
  children: ReactNode;
};

const queryClient = new QueryClient();

export default function Providers({ children }: ProvidersProps) {
  return (
    <WagmiConfig config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster position="bottom-right" />
      </QueryClientProvider>
    </WagmiConfig>
  );
}
