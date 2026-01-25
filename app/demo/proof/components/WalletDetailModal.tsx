"use client";

import { useState } from 'react';

import type { ProofWalletRow } from '@/lib/proofTypes';
import { farmRiskClass, scoreClass } from '@/lib/uiFormat';

type WalletDetailModalProps = {
  row: ProofWalletRow | null;
  onClose: () => void;
  insightsEnabled: boolean;
};

const formatNumber = (value: number) => new Intl.NumberFormat('en-US').format(value);
const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const shortenHash = (hash: string) => {
  if (hash.length <= 16) {
    return hash;
  }
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
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

const WalletDetailModal = ({ row, onClose, insightsEnabled }: WalletDetailModalProps) => {
  const [copied, setCopied] = useState(false);

  if (!row || !row.output || row.error) {
    return null;
  }

  const output = row.output;

  const handleCopy = async () => {
    if (!navigator?.clipboard?.writeText) {
      return;
    }
    try {
      await navigator.clipboard.writeText(output.proof.canonical_hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const criteria = output.criteria;
  const params = criteria?.params;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-slate-950 p-6 text-slate-100 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Wallet</p>
            <p className="mt-2 text-lg font-semibold" title={row.wallet}>
              {row.wallet}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                  output.verified_usage
                    ? 'bg-emerald-500/20 text-emerald-200'
                    : 'bg-rose-500/20 text-rose-200'
                }`}
              >
                {output.verified_usage ? 'Verified usage' : 'Not verified'}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${sourceStyles[row.source]}`}
              >
                {sourceLabels[row.source]}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-300 hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Core</p>
          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Tx count</p>
              <p className="mt-2 text-lg font-semibold">
                {formatNumber(output.usage_summary.tx_count)}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Days active</p>
              <p className="mt-2 text-lg font-semibold">
                {formatNumber(output.usage_summary.days_active)}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Unique contracts
              </p>
              <p className="mt-2 text-lg font-semibold">
                {formatNumber(output.usage_summary.unique_contracts)}
              </p>
            </div>
          </div>

          {criteria && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Criteria</p>
              <div className="mt-3 grid gap-2 text-slate-200 sm:grid-cols-2">
                <div>Set: {criteria.criteria_set_id}</div>
                {criteria.engine_version && <div>Engine: {criteria.engine_version}</div>}
                {params?.min_tx_count !== undefined && (
                  <div>Min tx count: {formatNumber(params.min_tx_count)}</div>
                )}
                {params?.min_days_active !== undefined && (
                  <div>Min days active: {formatNumber(params.min_days_active)}</div>
                )}
                {params?.min_unique_contracts !== undefined && (
                  <div>Min unique contracts: {formatNumber(params.min_unique_contracts)}</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Insights</p>
          {row.insights ? (
            <div className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Score</p>
                <p className="mt-2">
                  {insightsEnabled ? (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${scoreClass(
                        row.insights.overall_score
                      )}`}
                    >
                      {formatNumber(row.insights.overall_score)}
                    </span>
                  ) : (
                    <span className="text-lg font-semibold">
                      {formatNumber(row.insights.overall_score)}
                    </span>
                  )}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Farm %</p>
                <p className="mt-2">
                  {insightsEnabled ? (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${farmRiskClass(
                        Math.round(row.insights.farming_probability * 100)
                      )}`}
                    >
                      {formatPercent(row.insights.farming_probability)}
                    </span>
                  ) : (
                    <span className="text-lg font-semibold">
                      {formatPercent(row.insights.farming_probability)}
                    </span>
                  )}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Tag</p>
                <p className="mt-2 text-lg font-semibold capitalize">
                  {row.insights.behavior_tag.replace('_', ' ')}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-slate-300">
              Insights unavailable for this wallet.
            </div>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Commentary</p>
          {row.commentary ? (
            <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-emerald-200">
                <span className="rounded-full border border-emerald-400/30 px-2 py-1">
                  Experimental
                </span>
                <span className="text-emerald-200/80">Non-proof commentary</span>
              </div>
              <p className="mt-3 text-base text-slate-100">{row.commentary.text}</p>
              <p className="mt-2 text-xs text-slate-400">
                Model: {row.commentary.model}
              </p>
            </div>
          ) : (
            <div className="mt-4 text-sm text-slate-300">
              Commentary unavailable for this wallet.
            </div>
          )}
        </div>

        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Proof hash</p>
              <p
                className="mt-2 font-mono text-sm text-slate-200"
                title={output.proof.canonical_hash}
              >
                {shortenHash(output.proof.canonical_hash)}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-300 hover:text-white"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletDetailModal;
