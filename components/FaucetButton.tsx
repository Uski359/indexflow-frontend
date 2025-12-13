"use client";

import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { useAccount } from "wagmi";

const buildFaucetUrl = () => {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
  const normalizedBase = base.endsWith("/api") ? base.slice(0, -4) : base;
  return `${normalizedBase || ""}/faucet`;
};

const FaucetButton = () => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(false);

  const faucetUrl = useMemo(() => buildFaucetUrl(), []);

  const requestFaucet = async () => {
    if (!isConnected || !address) {
      toast.error("Please connect your wallet");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(faucetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address })
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data?.error || "Faucet error");
        return;
      }

      toast.success("10 IFLW sent!");
      console.log("tx:", data.hash);
    } catch (err) {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={requestFaucet}
      disabled={loading}
      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-500"
    >
      {loading ? "Sending..." : "Get Test IFLW"}
    </button>
  );
};

export default FaucetButton;
