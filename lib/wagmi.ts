"use client";

import { configureChains, createConfig } from "wagmi";
import { sepolia } from "wagmi/chains";
import { InjectedConnector } from "wagmi/connectors/injected";
import { jsonRpcProvider } from "wagmi/providers/jsonRpc";

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? sepolia.rpcUrls.default.http[0];

const { chains, publicClient, webSocketPublicClient } = configureChains(
  [sepolia],
  [
    jsonRpcProvider({
      rpc: () => ({ http: rpcUrl })
    })
  ]
);

export const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: [
    new InjectedConnector({
      chains,
      options: { shimDisconnect: true }
    })
  ],
  publicClient,
  webSocketPublicClient
});

export { chains };
