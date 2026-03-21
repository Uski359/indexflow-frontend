"use client";

import { useState } from 'react';

import type { ProofWalletRow } from '@/lib/proofTypes';

type ProofTableProps = {
  results: ProofWalletRow[];
  insightsEnabled: boolean;
  onSelect: (row: ProofWalletRow) => void;
};

const formatNumber = (value: number) => new Intl.NumberFormat('en-US').format(value);
const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const shortenWallet = (wallet: string) => {
  if (wallet.length <= 12) {
    return wallet;
  }
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
};

const sourceStyles: Record<ProofWalletRow['source'], string> = {
  commentary: 'bg-emerald-500/15 text-emerald-100',
  insights: 'bg-sky-500/15 text-sky-100',
  core: 'bg-white/10 text-slate-200'
};

const sourceLabels: Record<ProofWalletRow['source'], string> = {
  commentary: 'Commentary',
  insights: 'Insights',
  core: 'Core'
};

const getScoreBand = (score: number) => {
  if (score >= 70) {
    return {
      label: 'High',
      className: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100'
    };
  }
  if (score >= 40) {
    return {
      label: 'Medium',
      className: 'border-amber-400/30 bg-amber-500/15 text-amber-100'
    };
  }
  return {
    label: 'Low',
    className: 'border-rose-400/30 bg-rose-500/15 text-rose-100'
  };
};

const getRiskBand = (farmPercent: number) => {
  if (farmPercent >= 70) {
    return {
      label: 'High',
      className: 'border-rose-400/30 bg-rose-500/15 text-rose-100'
    };
  }
  if (farmPercent >= 40) {
    return {
      label: 'Medium',
      className: 'border-amber-400/30 bg-amber-500/15 text-amber-100'
    };
  }
  return {
    label: 'Low',
    className: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100'
  };
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
              <th className="px-5 py-4">Score band</th>
              <th className="px-5 py-4">Risk</th>
              <th className="px-5 py-4">Activity</th>
              <th className="px-5 py-4">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {results.map((entry, index) => {
              const summary = entry.output?.usage_summary;
              const hasError = Boolean(entry.error) || !entry.output;
              const verified = entry.output?.verified_usage ?? false;
              const score = entry.insights?.overall_score ?? 0;
              const farmPercent = Math.round((entry.insights?.farming_probability ?? 0) * 100);
              const scoreBand = getScoreBand(score);
              const riskBand = getRiskBand(farmPercent);
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
                      <div className="flex flex-col gap-2">
                        <span
                          className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${scoreBand.className}`}
                        >
                          {scoreBand.label}
                        </span>
                        <span className="text-sm font-medium text-white">
                          {insightsEnabled ? formatNumber(score) : '--'}
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
                          className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${riskBand.className}`}
                        >
                          {riskBand.label}
                        </span>
                        <span className="text-sm text-slate-300">{formatPercent((entry.insights?.farming_probability ?? 0))}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-5 text-slate-300">
                    {summary ? (
                      <div className="space-y-1.5">
                        <div>{formatNumber(summary.tx_count)} tx</div>
                        <div>{formatNumber(summary.days_active)} active days</div>
                        <div>{formatNumber(summary.unique_contracts)} contracts</div>
                      </div>
                    ) : (
                      <span className="text-slate-500">Unavailable</span>
                    )}
                  </td>
                  <td className="px-5 py-5">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${sourceStyles[entry.source]}`}
                    >
                      {sourceLabels[entry.source]}
                    </span>
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
