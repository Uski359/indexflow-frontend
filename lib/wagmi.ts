"use client";

import { configureChains, createConfig } from "wagmi";
import { sepolia } from "wagmi/chains";
import { MetaMaskConnector } from "wagmi/connectors/metaMask";
import { WalletConnectConnector } from "wagmi/connectors/walletConnect";
import { jsonRpcProvider } from "wagmi/providers/jsonRpc";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "indexflow-demo";
const envRpcUrl = process.env.NEXT_PUBLIC_RPC_URL?.trim();
const resolvedRpcUrl = envRpcUrl && envRpcUrl.length > 0 ? envRpcUrl : sepolia.rpcUrls.default.http[0];

const { chains, publicClient, webSocketPublicClient } = configureChains(
  [sepolia],
  [
    jsonRpcProvider({
      rpc: () => ({ http: resolvedRpcUrl })
    })
  ]
);

export const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: [
    new MetaMaskConnector({
      chains,
      options: { shimDisconnect: true }
    }),
    new WalletConnectConnector({
      chains,
      options: {
        projectId,
        metadata: {
          name: "IndexFlow",
          description: "IndexFlow dashboard",
          url: "https://indexflow.io",
          icons: ["https://avatars.githubusercontent.com/u/86017344?s=200&v=4"]
        }
      }
    })
  ],
  publicClient,
  webSocketPublicClient
});

export { chains };
