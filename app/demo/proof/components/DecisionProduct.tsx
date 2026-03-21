'use client';

import { useMemo, useState, type MutableRefObject } from 'react';

import type { ProofSummary, ProofWalletRow } from '@/lib/proofTypes';

import ProofFilters, { type ProofFilterState } from './ProofFilters';
import ProofTable from './ProofTable';

type FinalDecisionStatus = 'draft' | 'reviewed' | 'finalized';
type AllocationQuickFilter = 'all' | 'eligible' | 'high_score' | 'risky';

type DecisionConfidence = {
  score: number;
  reliabilityLabel: string;
};

type RiskAnalysisItem = {
  id: string;
  title: string;
  detail: string;
  severity: 'high' | 'medium';
  affectedWallets: number;
};

type ProofPackageManifest = {
  input: { hash: string };
  policy: { hash: string };
  engine_version: string;
  output: { hash: string };
};

type DecisionProductProps = {
  campaignId: string;
  finalDecisionStatus: FinalDecisionStatus;
  summary: ProofSummary;
  validEntries: number;
  decisionConfidence: DecisionConfidence | null;
  sortedResults: ProofWalletRow[];
  insightsEnabled: boolean;
  filters: ProofFilterState;
  setFilters: (next: ProofFilterState) => void;
  sortLabel: string;
  errorCount: number;
  topErrorHint: string | null;
  proofPackageManifest: ProofPackageManifest;
  riskAnalysis: RiskAnalysisItem[];
  loading: boolean;
  baseUrl: string | null;
  isDecisionLocked: boolean;
  filtersRef: MutableRefObject<HTMLDivElement | null>;
  shareStatus: string | null;
  proofCopyStatus: string | null;
  manifestCopyStatus: string | null;
  packageExportStatus: string | null;
  onFinalizeDecision: () => void;
  onRerunEvaluation: () => void;
  onExportResults: () => void;
  onCopyShareLink: () => void;
  onCopyProofs: () => void;
  onCopyManifest: () => void;
  onExportDecisionPackage: () => void;
  onApplySaferConfiguration: () => void;
  onDownloadInputHashReference: () => void;
  onDownloadPolicyJson: () => void;
  onDownloadEngineMetadata: () => void;
  onSelectWallet: (row: ProofWalletRow) => void;
};

const shortenHash = (value: string) => {
  if (value.length <= 18) {
    return value;
  }
  return `${value.slice(0, 12)}...${value.slice(-8)}`;
};

const isRiskyWallet = (entry: ProofWalletRow) => {
  const farmProbability = entry.insights?.farming_probability ?? 0;
  const behaviorTag = entry.insights?.behavior_tag;
  return farmProbability >= 0.5 || behaviorTag === 'suspected_farm';
};

const formatWholePercent = (value: number) => `${Math.round(value)}%`;

const getRiskLevel = (value: number): 'Low' | 'Medium' | 'High' => {
  if (value >= 30) {
    return 'High';
  }
  if (value >= 15) {
    return 'Medium';
  }
  return 'Low';
};

const riskLevelClass = (value: number) => {
  const level = getRiskLevel(value);
  if (level === 'High') {
    return 'border-rose-400/30 bg-rose-500/10 text-rose-100';
  }
  if (level === 'Medium') {
    return 'border-amber-400/30 bg-amber-500/10 text-amber-100';
  }
  return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100';
};

const decisionStatusClass = (status: FinalDecisionStatus) => {
  switch (status) {
    case 'finalized':
      return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100';
    case 'reviewed':
      return 'border-sky-400/30 bg-sky-500/10 text-sky-100';
    default:
      return 'border-amber-400/30 bg-amber-500/10 text-amber-100';
  }
};

const riskSeverityClass = (severity: RiskAnalysisItem['severity']) =>
  severity === 'high'
    ? 'border-rose-400/30 bg-rose-500/10 text-rose-100'
    : 'border-amber-400/30 bg-amber-500/10 text-amber-100';

const DecisionProduct = ({
  campaignId,
  finalDecisionStatus,
  summary,
  validEntries,
  decisionConfidence,
  sortedResults,
  insightsEnabled,
  filters,
  setFilters,
  sortLabel,
  errorCount,
  topErrorHint,
  proofPackageManifest,
  riskAnalysis,
  loading,
  baseUrl,
  isDecisionLocked,
  filtersRef,
  shareStatus,
  proofCopyStatus,
  manifestCopyStatus,
  packageExportStatus,
  onFinalizeDecision,
  onRerunEvaluation,
  onExportResults,
  onCopyShareLink,
  onCopyProofs,
  onCopyManifest,
  onExportDecisionPackage,
  onApplySaferConfiguration,
  onDownloadInputHashReference,
  onDownloadPolicyJson,
  onDownloadEngineMetadata,
  onSelectWallet
}: DecisionProductProps) => {
  const [allocationQuickFilter, setAllocationQuickFilter] =
    useState<AllocationQuickFilter>('all');

  const approvedCount = summary.verified_true;
  const rejectedCount = summary.verified_false;
  const approvedRate = summary.verified_rate * 100;
  const highRiskCount = summary.suspected_farm_count;
  const riskRate = summary.suspected_farm_rate * 100;
  const riskLevel = getRiskLevel(riskRate);
  const budgetUtilization = validEntries
    ? Math.max(0, Math.min(100, (approvedCount / Math.max(validEntries, 1)) * 100))
    : 0;
  const decisionHeroSummary = `This campaign approved ${Math.round(
    approvedRate
  )}% of wallets with ${riskLevel.toLowerCase()} risk and optimized allocation.`;

  const allocationRows = useMemo(() => {
    return sortedResults.filter((entry) => {
      if (!entry.output || entry.error) {
        return false;
      }
      switch (allocationQuickFilter) {
        case 'eligible':
          return entry.output.verified_usage;
        case 'high_score':
          return (entry.insights?.overall_score ?? 0) >= 70;
        case 'risky':
          return isRiskyWallet(entry);
        default:
          return true;
      }
    });
  }, [allocationQuickFilter, sortedResults]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-500">
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">
          01 Decision
        </span>
        <span className="text-slate-600">→</span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
          02 Allocation
        </span>
        <span className="text-slate-600">→</span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
          03 Risk
        </span>
        <span className="text-slate-600">→</span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
          04 Proof
        </span>
      </div>

      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.18),_transparent_36%),radial-gradient(circle_at_right,_rgba(245,158,11,0.14),_transparent_32%),linear-gradient(135deg,rgba(10,14,24,0.98),rgba(15,23,42,0.92))] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.35)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-400">
                Decision Hero
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${decisionStatusClass(
                  finalDecisionStatus
                )}`}
              >
                {finalDecisionStatus === 'finalized' ? 'Final' : 'Draft'}
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${riskLevelClass(
                  riskRate
                )}`}
              >
                {riskLevel} risk
              </span>
            </div>
            <p className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Campaign {campaignId}
            </p>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-200">
              {decisionHeroSummary}
            </p>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 xl:max-w-xl">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-5 sm:col-span-2">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                Eligible rate
              </p>
              <div className="mt-3 flex items-end gap-3">
                <span className="text-5xl font-semibold tracking-tight text-white">
                  {Math.round(approvedRate)}%
                </span>
                <span className="pb-2 text-sm text-emerald-200">
                  {approvedCount} wallets approved
                </span>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                Risk level
              </p>
              <p className="mt-3 text-2xl font-semibold text-white">{riskLevel}</p>
              <p className="mt-1 text-sm text-slate-400">{formatWholePercent(riskRate)} high-risk share</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                Budget utilization
              </p>
              <p className="mt-3 text-2xl font-semibold text-white">
                {formatWholePercent(budgetUtilization)}
              </p>
              <p className="mt-1 text-sm text-slate-400">Allocated against submitted wallets</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/10 pt-6">
          <button
            type="button"
            onClick={onFinalizeDecision}
            disabled={finalDecisionStatus !== 'reviewed'}
            className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100 hover:bg-emerald-500/20 hover:text-white disabled:cursor-not-allowed disabled:text-emerald-100/50"
          >
            Finalize decision
          </button>
          <button
            type="button"
            onClick={onRerunEvaluation}
            disabled={loading || validEntries === 0 || !baseUrl || isDecisionLocked}
            className="rounded-full border border-sky-400/30 bg-sky-500/10 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-sky-100 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:text-sky-100/50"
          >
            Re-run evaluation
          </button>
          <button
            type="button"
            onClick={onExportResults}
            disabled={!sortedResults.length}
            className="rounded-full border border-white/10 bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-black hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-white/30 disabled:text-slate-500"
          >
            Export results
          </button>
          <details className="group relative">
            <summary className="cursor-pointer list-none rounded-full border border-white/10 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300 hover:text-white">
              More actions
            </summary>
            <div className="absolute right-0 z-10 mt-3 flex min-w-64 flex-col gap-2 rounded-2xl border border-white/10 bg-slate-950/95 p-3 shadow-2xl backdrop-blur">
              <button
                type="button"
                onClick={onCopyShareLink}
                className="rounded-xl border border-white/10 px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/5"
              >
                Copy share link
              </button>
              <button
                type="button"
                onClick={onCopyProofs}
                className="rounded-xl border border-white/10 px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/5"
              >
                Copy proof hashes
              </button>
              <button
                type="button"
                onClick={onCopyManifest}
                className="rounded-xl border border-white/10 px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/5"
              >
                Copy manifest JSON
              </button>
              <button
                type="button"
                onClick={onExportDecisionPackage}
                className="rounded-xl border border-white/10 px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/5"
              >
                Export decision package
              </button>
            </div>
          </details>
          {(proofCopyStatus || manifestCopyStatus || packageExportStatus || shareStatus) && (
            <span className="text-xs text-slate-400">
              {proofCopyStatus ?? manifestCopyStatus ?? packageExportStatus ?? shareStatus}
            </span>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(15,23,42,0.7))] p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">01 Decision</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Decision summary</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Only the metrics that change the decision stay visible here.
            </p>
          </div>
          <div className="text-right text-sm text-slate-400">
            Showing {summary.total} evaluated wallets
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-5">
            <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-200/80">
              Eligible wallets
            </p>
            <p className="mt-3 text-3xl font-semibold text-white">{approvedCount}</p>
            <p className="mt-1 text-sm text-emerald-100">{formatWholePercent(approvedRate)}</p>
          </div>
          <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-5">
            <p className="text-[11px] uppercase tracking-[0.22em] text-rose-200/80">
              Rejected wallets
            </p>
            <p className="mt-3 text-3xl font-semibold text-white">{rejectedCount}</p>
            <p className="mt-1 text-sm text-rose-100">{formatWholePercent(100 - approvedRate)}</p>
          </div>
          <div className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-5">
            <p className="text-[11px] uppercase tracking-[0.22em] text-amber-200/80">
              High-risk wallets
            </p>
            <p className="mt-3 text-3xl font-semibold text-white">{highRiskCount}</p>
            <p className="mt-1 text-sm text-amber-100">{formatWholePercent(riskRate)}</p>
          </div>
          <div className="rounded-3xl border border-sky-400/20 bg-sky-500/10 p-5">
            <p className="text-[11px] uppercase tracking-[0.22em] text-sky-200/80">
              Confidence score
            </p>
            <p className="mt-3 text-3xl font-semibold text-white">
              {decisionConfidence?.score ?? '--'}
              {decisionConfidence ? '%' : ''}
            </p>
            <p className="mt-1 text-sm text-sky-100">
              {decisionConfidence?.reliabilityLabel ?? 'Unavailable'}
            </p>
          </div>
        </div>

        <details className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-5">
          <summary className="cursor-pointer list-none text-sm font-semibold text-white">
            Detailed metrics
          </summary>
          <div ref={filtersRef} className="mt-2" />
          <p className="mt-2 text-sm text-slate-400">
            Expanded metrics and threshold controls for deeper review.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Avg tx count</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {Math.round(summary.avg_tx_count)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Avg days active</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {Math.round(summary.avg_days_active)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                Avg unique contracts
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {Math.round(summary.avg_unique_contracts)}
              </p>
            </div>
          </div>
          <div className="mt-5">
            <ProofFilters
              value={filters}
              onChange={setFilters}
              disabled={loading || isDecisionLocked}
              insightsEnabled={insightsEnabled}
            />
          </div>
        </details>
      </section>

      <section className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.84),rgba(15,23,42,0.68))] p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">02 Allocation</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Allocation</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Scan eligibility, score bands, and risk posture without leaving the table.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {([
              ['all', 'All wallets'],
              ['eligible', 'Show only eligible'],
              ['high_score', 'Show only high score'],
              ['risky', 'Show only risky']
            ] as Array<[AllocationQuickFilter, string]>).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setAllocationQuickFilter(key)}
                className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${
                  allocationQuickFilter === key
                    ? 'border-white bg-white text-black'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-slate-200">Wallet distribution</span>
            <span>
              Showing {allocationRows.length} of {sortedResults.length} wallets
            </span>
            {errorCount > 0 && (
              <span className="text-rose-300">
                Errors: {errorCount}
                {topErrorHint ? ` (${topErrorHint})` : ''}
              </span>
            )}
          </div>
          <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Sort: {sortLabel}
          </span>
        </div>

        {allocationRows.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
            No wallets match the current allocation filters.
          </div>
        ) : (
          <div className="mt-4">
            <ProofTable
              results={allocationRows}
              insightsEnabled={insightsEnabled}
              onSelect={onSelectWallet}
            />
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(15,23,42,0.68))] p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">03 Risk</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Risk analysis</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {riskLevel === 'High' &&
                'High sybil exposure remains in the approved set and deserves a tighter policy before finalization.'}
              {riskLevel === 'Medium' &&
                'Some sybil-like behavior remains, but the current outcome is still manageable with targeted review.'}
              {riskLevel === 'Low' &&
                'The approved set shows limited sybil exposure and looks stable under the active policy.'}
            </p>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-xl">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-5 sm:col-span-2">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Sybil share</p>
              <div className="mt-3 flex items-end gap-3">
                <span className="text-5xl font-semibold tracking-tight text-white">
                  {Math.round(riskRate)}%
                </span>
                <span
                  className={`mb-2 inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${riskLevelClass(
                    riskRate
                  )}`}
                >
                  {riskLevel}
                </span>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                High-risk wallets
              </p>
              <p className="mt-3 text-2xl font-semibold text-white">{highRiskCount}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Confidence</p>
              <p className="mt-3 text-2xl font-semibold text-white">
                {decisionConfidence?.score ?? '--'}
                {decisionConfidence ? '%' : ''}
              </p>
            </div>
          </div>
        </div>

        <details className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-5">
          <summary className="cursor-pointer list-none text-sm font-semibold text-white">
            View detailed risk analysis
          </summary>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-400">
              Expand cohort-level signals and mitigation suggestions.
            </p>
            <button
              type="button"
              onClick={onApplySaferConfiguration}
              disabled={isDecisionLocked}
              className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100 transition hover:bg-emerald-500/20 hover:text-white disabled:cursor-not-allowed disabled:text-emerald-100/50"
            >
              Apply safer configuration
            </button>
          </div>
          {riskAnalysis.length > 0 ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {riskAnalysis.map((risk) => (
                <div
                  key={risk.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${riskSeverityClass(
                        risk.severity
                      )}`}
                    >
                      {risk.severity} risk
                    </span>
                    <span className="text-xs text-slate-400">
                      {risk.affectedWallets} wallets affected
                    </span>
                  </div>
                  <p className="mt-3 text-base font-semibold text-white">{risk.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{risk.detail}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              No elevated cohort-level risks were detected under the current insight coverage.
            </div>
          )}
        </details>
      </section>

      <section className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.8),rgba(15,23,42,0.64))] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">04 Proof</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Proof</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Keep the technical proof available, but out of the primary decision path.
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Proof hash</p>
            <p className="mt-3 font-mono text-sm text-slate-100" title={proofPackageManifest.output.hash}>
              {shortenHash(proofPackageManifest.output.hash)}
            </p>
            <div className="mt-3">
              <span className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
                Verified
              </span>
            </div>
          </div>
        </div>

        <details className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-5">
          <summary className="cursor-pointer list-none text-sm font-semibold text-white">
            View full proof details
          </summary>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Input hash</p>
              <p className="mt-2 font-mono text-sm text-slate-100" title={proofPackageManifest.input.hash}>
                {shortenHash(proofPackageManifest.input.hash)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Policy hash</p>
              <p className="mt-2 font-mono text-sm text-slate-100" title={proofPackageManifest.policy.hash}>
                {shortenHash(proofPackageManifest.policy.hash)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                Engine version
              </p>
              <p className="mt-2 text-sm font-semibold text-white">
                {proofPackageManifest.engine_version}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Output hash</p>
              <p className="mt-2 font-mono text-sm text-slate-100" title={proofPackageManifest.output.hash}>
                {shortenHash(proofPackageManifest.output.hash)}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onDownloadInputHashReference}
              className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 hover:text-white"
            >
              Input hash reference
            </button>
            <button
              type="button"
              onClick={onDownloadPolicyJson}
              className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 hover:text-white"
            >
              Policy JSON
            </button>
            <button
              type="button"
              onClick={onDownloadEngineMetadata}
              className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 hover:text-white"
            >
              Engine metadata
            </button>
          </div>
        </details>
      </section>
    </div>
  );
};

export default DecisionProduct;
