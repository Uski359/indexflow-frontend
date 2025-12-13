"use client";

import {
  useAccount,
  useConnect,
  useDisconnect,
  useChainId,
  useSwitchChain,
} from "wagmi";
import { sepolia } from "wagmi/chains";

const WalletButton = () => {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  if (!isConnected) {
    return (
      <button
        onClick={() => connect({ connector: connectors[0] })}
        className="px-3 py-2 rounded-lg bg-indigo-600 text-white"
      >
        Connect Wallet
      </button>
    );
  }

  if (chainId !== sepolia.id) {
    return (
      <button
        onClick={() => switchChain({ chainId: sepolia.id })}
        className="px-3 py-2 rounded-lg bg-yellow-600 text-white"
      >
        Switch to Sepolia
      </button>
    );
  }

  return (
    <button
      onClick={() => disconnect()}
      className="px-3 py-2 rounded-lg bg-green-600 text-white"
    >
      {address!.slice(0, 6)}…{address!.slice(-4)}
    </button>
  );
};

export default WalletButton;
