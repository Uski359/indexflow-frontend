"use client";

import { useState } from 'react';

import type { ProofWalletRow } from '@/lib/proofTypes';
import { farmRiskClass, scoreClass } from '@/lib/uiFormat';

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

const tagStyles: Record<'organic' | 'suspected_farm' | 'inactive' | 'mixed', string> = {
  organic: 'bg-emerald-500/20 text-emerald-200',
  suspected_farm: 'bg-rose-500/20 text-rose-200',
  inactive: 'bg-slate-500/30 text-slate-200',
  mixed: 'bg-amber-500/20 text-amber-200'
};

const tagLabels: Record<'organic' | 'suspected_farm' | 'inactive' | 'mixed', string> = {
  organic: 'Organic',
  suspected_farm: 'Suspected farm',
  inactive: 'Inactive',
  mixed: 'Mixed'
};

const sourceStyles: Record<ProofWalletRow['source'], string> = {
  commentary: 'bg-emerald-500/20 text-emerald-200',
  insights: 'bg-sky-500/20 text-sky-200',
  core: 'bg-white/10 text-slate-200'
};

const sourceLabels: Record<ProofWalletRow['source'], string> = {
  commentary: 'Commentary',
  insights: 'Insights',
  core: 'Core'
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
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
      <table className="min-w-full text-sm">
        <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.2em] text-slate-400">
          <tr>
            <th className="px-4 py-3">Wallet</th>
            <th className="px-4 py-3">Verified usage</th>
            <th className="px-4 py-3">Tx count</th>
            <th className="px-4 py-3">Days active</th>
            <th className="px-4 py-3">Unique contracts</th>
            <th className="px-4 py-3">Score</th>
            <th className="px-4 py-3">Farm%</th>
            <th className="px-4 py-3">Tag</th>
            <th className="px-4 py-3">Cached</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {results.map((entry) => {
            const summary = entry.output?.usage_summary;
            const verified = entry.output?.verified_usage;
            const hasCommentary =
              Boolean(entry.commentary) || entry.cached_commentary !== undefined;
            const farmPercent = Math.round((entry.insights?.farming_probability ?? 0) * 100);
            const hasError = Boolean(entry.error) || !entry.output;
            const displayName = entry.display_name?.trim();

            return (
              <tr
                key={entry.wallet}
                onClick={() => {
                  if (!hasError) {
                    onSelect(entry);
                  }
                }}
                className={hasError ? 'cursor-default bg-rose-500/5' : 'cursor-pointer hover:bg-white/5'}
              >
                <td className="px-4 py-3 text-slate-100" title={entry.wallet}>
                  <div className="flex flex-col gap-2">
                    {displayName ? (
                      <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{displayName}</span>
                        <span className="rounded-full border border-emerald-400/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                          ENS
                        </span>
                        {entry.ens_cached && (
                          <span className="rounded-full border border-sky-400/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200">
                            Cached
                          </span>
                        )}
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleCopy(displayName);
                            }}
                            className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300 hover:text-white"
                          >
                            {copiedValue === displayName ? 'Copied' : 'Copy name'}
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          <span>{shortenWallet(entry.wallet)}</span>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleCopy(entry.wallet);
                            }}
                            className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300 hover:text-white"
                          >
                            {copiedValue === entry.wallet ? 'Copied' : 'Copy address'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{shortenWallet(entry.wallet)}</span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleCopy(entry.wallet);
                          }}
                          className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300 hover:text-white"
                        >
                          {copiedValue === entry.wallet ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    )}
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${sourceStyles[entry.source]}`}
                    >
                      {sourceLabels[entry.source]}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {hasError ? (
                    <span
                      title={entry.error ?? 'Error'}
                      className="inline-flex items-center rounded-full bg-rose-500/20 px-2.5 py-1 text-xs font-semibold text-rose-200"
                    >
                      Error
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                        verified
                          ? 'bg-emerald-500/20 text-emerald-200'
                          : 'bg-rose-500/20 text-rose-200'
                      }`}
                    >
                      {verified ? 'Verified' : 'Not verified'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-200">
                  {summary ? formatNumber(summary.tx_count) : '--'}
                </td>
                <td className="px-4 py-3 text-slate-200">
                  {summary ? formatNumber(summary.days_active) : '--'}
                </td>
                <td className="px-4 py-3 text-slate-200">
                  {summary ? formatNumber(summary.unique_contracts) : '--'}
                </td>
                <td className="px-4 py-3 text-slate-200">
                  {summary ? (
                    insightsEnabled ? (
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${scoreClass(
                          entry.insights?.overall_score ?? 0
                        )}`}
                      >
                        {formatNumber(entry.insights?.overall_score ?? 0)}
                      </span>
                    ) : (
                      formatNumber(entry.insights?.overall_score ?? 0)
                    )
                  ) : (
                    '--'
                  )}
                </td>
                <td className="px-4 py-3 text-slate-200">
                  {summary ? (
                    insightsEnabled ? (
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${farmRiskClass(
                          farmPercent
                        )}`}
                      >
                        {formatPercent(entry.insights?.farming_probability ?? 0)}
                      </span>
                    ) : (
                      formatPercent(entry.insights?.farming_probability ?? 0)
                    )
                  ) : (
                    '--'
                  )}
                </td>
                <td className="px-4 py-3">
                  {summary ? (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                        tagStyles[entry.insights?.behavior_tag ?? 'mixed']
                      }`}
                    >
                      {tagLabels[entry.insights?.behavior_tag ?? 'mixed']}
                    </span>
                  ) : (
                    '--'
                  )}
                </td>
                <td className="px-4 py-3">
                  {summary ? (
                    <div className="flex flex-wrap gap-2">
                      <span
                        title={entry.cached_core ? 'Core cached' : 'Core live'}
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                          entry.cached_core
                            ? 'bg-sky-500/20 text-sky-200'
                            : 'bg-white/10 text-slate-200'
                        }`}
                      >
                        Core
                      </span>
                      <span
                        title={entry.cached_insights ? 'Insights cached' : 'Insights live'}
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                          entry.cached_insights
                            ? 'bg-sky-500/20 text-sky-200'
                            : 'bg-white/10 text-slate-200'
                        }`}
                      >
                        Insights
                      </span>
                      {hasCommentary && (
                        <span
                          title={
                            entry.cached_commentary ? 'Commentary cached' : 'Commentary live'
                          }
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                            entry.cached_commentary
                              ? 'bg-sky-500/20 text-sky-200'
                              : 'bg-white/10 text-slate-200'
                          }`}
                        >
                          Commentary
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">Unavailable</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ProofTable;
