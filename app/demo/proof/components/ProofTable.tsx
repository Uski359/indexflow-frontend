"use client";

import { useState } from 'react';

import type { ProofWalletRow } from '@/lib/proofTypes';

type ProofTableProps = {
  results: ProofWalletRow[];
  insightsEnabled: boolean;
  onSelect: (row: ProofWalletRow) => void;
};

const formatNumber = (value: number) => new Intl.NumberFormat('en-US').format(value);

const shortenWallet = (wallet: string) => {
  if (wallet.length <= 12) {
    return wallet;
  }
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
};

const getUserType = (score: number, farmProbability: number, verified: boolean) => {
  if (!verified || farmProbability >= 0.5) {
    return {
      label: 'Farmer',
      className: 'border-rose-400/30 bg-rose-500/15 text-rose-100'
    };
  }
  if (score >= 85) {
    return {
      label: 'Whale',
      className: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100'
    };
  }
  return {
    label: 'Real',
    className: 'border-sky-400/30 bg-sky-500/15 text-sky-100'
  };
};

const getExpectedValue = (score: number, farmProbability: number, verified: boolean) => {
  if (!verified || farmProbability >= 0.5) {
    return 'Low';
  }
  if (score >= 85) {
    return 'High';
  }
  if (score >= 60) {
    return 'Medium';
  }
  return 'Low';
};

const getScoreTone = (score: number) => {
  if (score >= 85) {
    return 'text-emerald-100';
  }
  if (score >= 60) {
    return 'text-amber-100';
  }
  return 'text-rose-100';
};

const ProofTable = ({ results, insightsEnabled, onSelect }: ProofTableProps) => {
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

  const handleCopy = async (value: string) => {
    if (!navigator?.clipboard?.writeText) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(value);
      setTimeout(() => setCopiedValue(null), 1500);
    } catch {
      setCopiedValue(null);
    }
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/20">
      <div className="max-h-[720px] overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-950/95 text-left text-[11px] uppercase tracking-[0.18em] text-slate-400 backdrop-blur">
            <tr className="border-b border-white/10">
              <th className="px-5 py-4">Wallet</th>
              <th className="px-5 py-4">Decision</th>
              <th className="px-5 py-4">User Type</th>
              <th className="px-5 py-4">Expected Value</th>
              <th className="px-5 py-4">Score (simplified)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {results.map((entry, index) => {
              const summary = entry.output?.usage_summary;
              const hasError = Boolean(entry.error) || !entry.output;
              const verified = entry.output?.verified_usage ?? false;
              const score = entry.insights?.overall_score ?? 0;
              const farmProbability = entry.insights?.farming_probability ?? 0;
              const userType = getUserType(score, farmProbability, verified);
              const expectedValue = getExpectedValue(score, farmProbability, verified);
              const isTopWallet = !hasError && index < 5;
              const displayName = entry.display_name?.trim();

              return (
                <tr
                  key={entry.wallet}
                  onClick={() => {
                    if (!hasError) {
                      onSelect(entry);
                    }
                  }}
                  className={
                    hasError
                      ? 'cursor-default bg-rose-500/5'
                      : `cursor-pointer transition hover:bg-white/5 ${
                          isTopWallet ? 'bg-emerald-500/[0.04]' : ''
                        }`
                  }
                >
                  <td className="px-5 py-5 text-slate-100">
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-white" title={entry.wallet}>
                          {displayName || shortenWallet(entry.wallet)}
                        </span>
                        {displayName && (
                          <span className="rounded-full border border-emerald-400/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                            ENS
                          </span>
                        )}
                        {isTopWallet && (
                          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
                            Top wallet
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span>{shortenWallet(entry.wallet)}</span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleCopy(displayName || entry.wallet);
                          }}
                          className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300 hover:text-white"
                        >
                          {copiedValue === (displayName || entry.wallet) ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-5">
                    {hasError ? (
                      <span
                        title={entry.error ?? 'Error'}
                        className="inline-flex items-center rounded-full border border-rose-400/30 bg-rose-500/15 px-3 py-1 text-xs font-semibold text-rose-100"
                      >
                        Error
                      </span>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <span
                          className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                            verified
                              ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100'
                              : 'border-rose-400/30 bg-rose-500/15 text-rose-100'
                          }`}
                        >
                          {verified ? 'Eligible' : 'Rejected'}
                        </span>
                        <span className="text-xs text-slate-400">
                          {verified ? 'Included in allocation' : 'Excluded from allocation'}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-5">
                    {hasError ? (
                      <span className="text-slate-500">--</span>
                    ) : (
                      <span
                        className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${userType.className}`}
                      >
                        {userType.label}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-5">
                    {hasError ? (
                      <span className="text-slate-500">--</span>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium text-white">{expectedValue}</span>
                        <span className="text-xs text-slate-400">
                          {verified ? 'Better reward candidate' : 'Low return candidate'}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-5">
                    {hasError ? (
                      <span className="text-slate-500">--</span>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <span
                          className={`text-lg font-semibold ${getScoreTone(score)}`}
                        >
                          {insightsEnabled ? Math.round(score) : '--'} / 100
                        </span>
                        <span className="text-xs text-slate-400">
                          {summary
                            ? `${formatNumber(summary.tx_count)} tx • ${formatNumber(summary.days_active)} active days`
                            : 'Activity unavailable'}
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProofTable;
