'use client';

import { Binary, Link2, Router } from 'lucide-react';

import { useRecentProofs } from '@/hooks/usePoi';
import type { Proof } from '@/types';

import Card from './Card';

const shorten = (value: string, size = 4) =>
  value.length > size * 2 ? `${value.slice(0, size)}...${value.slice(-size)}` : value;

const formatTimestamp = (ts: number) => {
  if (!ts) return 'pending';
  return new Date(ts * 1000).toLocaleString();
};

const ProofTable = () => {
  const { proofs, isLoading } = useRecentProofs();
  const placeholderRows: Array<Proof | undefined> = Array.from({ length: 4 }).map(() => undefined);

  return (
    <Card
      title="Proof-of-Indexing"
      subtitle="Latest operator attestations by chain + block range"
      className="bg-gradient-to-br from-[#0c1624] via-[#0d1220] to-[#080a12]"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#1f1f2a] text-xs uppercase tracking-[0.12em] text-gray-500">
              <th className="px-3 py-2">Operator</th>
              <th className="px-3 py-2">Chain</th>
              <th className="px-3 py-2">Range</th>
              <th className="px-3 py-2">Proof</th>
              <th className="px-3 py-2 text-right">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {(isLoading ? placeholderRows : proofs).map((proof, idx) => (
              <tr
                key={proof?.txHash ?? `placeholder-${idx}`}
                className="border-b border-[#1f1f2a] last:border-0"
              >
                <td className="px-3 py-3 text-xs text-gray-200">
                  <div className="flex items-center gap-2">
                    <Binary size={14} className="text-blue-300" />
                    <span className="font-mono">{shorten(proof?.operator ?? '0x', 5)}</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-xs text-gray-300">
                  <div className="flex items-center gap-2">
                    <Router size={14} className="text-emerald-300" />
                    <span>{(proof?.chain ?? '...').toUpperCase()}</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-xs text-gray-300">
                  {proof ? (
                    `${proof.fromBlock} -> ${proof.toBlock}`
                  ) : (
                    <div className="h-3 w-24 animate-pulse rounded bg-[#1f1f2a]" />
                  )}
                </td>
                <td className="px-3 py-3 text-xs text-gray-300">
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <Link2 size={14} className="text-gray-500" />
                    <span>{shorten(proof?.proofHash ?? '0x', 6)}</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-right text-xs text-gray-400">
                  {proof ? (
                    formatTimestamp(proof.timestamp)
                  ) : (
                    <div className="ml-auto h-3 w-20 animate-pulse rounded bg-[#1f1f2a]" />
                  )}
                </td>
              </tr>
            ))}
            {!isLoading && proofs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-gray-500">
                  No proofs submitted yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default ProofTable;
