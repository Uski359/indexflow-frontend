"use client";

import {
  useAccount,
  useConnect,
  useDisconnect,
  useNetwork,
  useSwitchNetwork,
} from "wagmi";
import { sepolia } from "wagmi/chains";

const WalletButton = () => {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { chain } = useNetwork();
  const { switchNetwork } = useSwitchNetwork({
    chainId: sepolia.id,
  });

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

  if (chain?.id !== sepolia.id) {
    return (
      <button
        onClick={() => switchNetwork?.(sepolia.id)}
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
      {address!.slice(0, 6)}...{address!.slice(-4)}
    </button>
  );
};

export default WalletButton;
