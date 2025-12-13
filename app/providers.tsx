"use client";

import { WagmiConfig, configureChains, createConfig } from "wagmi";
import { sepolia } from "wagmi/chains";
import { InjectedConnector } from "wagmi/connectors/injected";
import { jsonRpcProvider } from "wagmi/providers/jsonRpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL?.trim() || sepolia.rpcUrls.default.http[0];

const { chains, publicClient, webSocketPublicClient } = configureChains([sepolia], [
  jsonRpcProvider({
    rpc: () => ({ http: RPC_URL }),
  }),
]);

const config = createConfig({
  autoConnect: true,
  connectors: [new InjectedConnector({ chains })],
  publicClient,
  webSocketPublicClient,
});

const queryClient = new QueryClient();

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <WagmiConfig config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiConfig>
  );
}
