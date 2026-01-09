'use client';

import { useState } from 'react';

const ProofOfUsagePage = () => {
  const [wallet, setWallet] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown | null>(null);

  const handleCheckUsage = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('https://api.indexflow.network/api/proof-of-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet })
      });

      if (!response.ok) {
        throw new Error('Request failed');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError('Request failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-white">Deterministic Proof-of-Usage (Pilot)</h1>
        <p className="text-sm text-gray-400">Verify real protocol usage with explainable rules.</p>
      </header>

      <section className="space-y-3">
        <label className="text-sm font-medium text-gray-200" htmlFor="wallet-input">
          Wallet address
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="wallet-input"
            type="text"
            value={wallet}
            onChange={(event) => setWallet(event.target.value)}
            placeholder="0x..."
            className="w-full rounded-md border border-white/10 bg-[#0f1118] px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            type="button"
            onClick={handleCheckUsage}
            disabled={isLoading}
            className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Checking...' : 'Check usage'}
          </button>
        </div>
        {isLoading && <p className="text-sm text-gray-400">Loading...</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </section>

      <section className="space-y-2">
        <p className="text-sm font-medium text-gray-200">Response</p>
        <pre className="min-h-[140px] whitespace-pre-wrap rounded-md border border-white/10 bg-[#0f1118] p-4 text-xs text-gray-200">
          {result ? JSON.stringify(result, null, 2) : 'No response yet.'}
        </pre>
      </section>
    </div>
  );
};

export default ProofOfUsagePage;
