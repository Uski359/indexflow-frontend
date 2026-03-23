'use client';

import { useMemo, useState, type MutableRefObject, type ReactNode } from 'react';

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

type ImpactStatProps = {
  eyebrow: string;
  value: string;
  detail: string;
  tone?: 'emerald' | 'sky' | 'amber' | 'slate';
};

type ComparisonCardProps = {
  title: string;
  subtitle: string;
  accent: 'rose' | 'emerald';
  children: ReactNode;
};

type DecisionReasonProps = {
  title: string;
  detail: string;
};

type CtaPanelProps = {
  title: string;
  detail: string;
  primaryLabel: string;
  secondaryLabel: string;
  tertiaryLabel?: string;
  onPrimary: () => void;
  onSecondary: () => void;
  onTertiary?: () => void;
  primaryDisabled?: boolean;
  secondaryDisabled?: boolean;
  tertiaryDisabled?: boolean;
  statusText?: string | null;
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

const panelToneClass: Record<NonNullable<ImpactStatProps['tone']>, string> = {
  emerald: 'border-emerald-400/20 bg-emerald-500/10',
  sky: 'border-sky-400/20 bg-sky-500/10',
  amber: 'border-amber-400/20 bg-amber-500/10',
  slate: 'border-white/10 bg-white/5'
};

const comparisonToneClass: Record<ComparisonCardProps['accent'], string> = {
  rose: 'border-rose-400/20 bg-[linear-gradient(180deg,rgba(244,63,94,0.10),rgba(15,23,42,0.55))]',
  emerald:
    'border-emerald-400/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.10),rgba(15,23,42,0.55))]'
};

const ImpactStat = ({ eyebrow, value, detail, tone = 'slate' }: ImpactStatProps) => (
  <div className={`rounded-[1.75rem] border p-5 shadow-[0_12px_40px_rgba(15,23,42,0.18)] ${panelToneClass[tone]}`}>
    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{eyebrow}</p>
    <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{value}</p>
    <p className="mt-2 text-sm leading-6 text-slate-300">{detail}</p>
  </div>
);

const ComparisonCard = ({ title, subtitle, accent, children }: ComparisonCardProps) => (
  <div className={`rounded-[1.75rem] border p-6 ${comparisonToneClass[accent]}`}>
    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{title}</p>
    <p className="mt-2 text-xl font-semibold text-white">{subtitle}</p>
    <div className="mt-5 space-y-3 text-sm leading-6 text-slate-300">{children}</div>
  </div>
);

const DecisionReason = ({ title, detail }: DecisionReasonProps) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
    <p className="text-sm font-semibold text-white">{title}</p>
    <p className="mt-2 text-sm leading-6 text-slate-300">{detail}</p>
  </div>
);

const CtaPanel = ({
  title,
  detail,
  primaryLabel,
  secondaryLabel,
  tertiaryLabel,
  onPrimary,
  onSecondary,
  onTertiary,
  primaryDisabled,
  secondaryDisabled,
  tertiaryDisabled,
  statusText
}: CtaPanelProps) => (
  <div className="rounded-[1.75rem] border border-sky-400/20 bg-[linear-gradient(180deg,rgba(14,165,233,0.12),rgba(8,47,73,0.18))] p-5">
    <p className="text-[11px] uppercase tracking-[0.22em] text-sky-200/80">Campaign actions</p>
    <p className="mt-2 text-xl font-semibold text-white">{title}</p>
    <p className="mt-2 text-sm leading-6 text-slate-300">{detail}</p>
    <div className="mt-5 flex flex-wrap gap-3">
      <button
        type="button"
        onClick={onPrimary}
        disabled={primaryDisabled}
        className="rounded-full border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-100 transition hover:bg-sky-500/20 hover:text-white disabled:cursor-not-allowed disabled:text-sky-100/50"
      >
        {primaryLabel}
      </button>
      <button
        type="button"
        onClick={onSecondary}
        disabled={secondaryDisabled}
        className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:text-white disabled:cursor-not-allowed disabled:text-slate-500"
      >
        {secondaryLabel}
      </button>
      {tertiaryLabel && onTertiary ? (
        <button
          type="button"
          onClick={onTertiary}
          disabled={tertiaryDisabled}
          className="rounded-full border border-white/10 bg-transparent px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300 transition hover:text-white disabled:cursor-not-allowed disabled:text-slate-500"
        >
          {tertiaryLabel}
        </button>
      ) : null}
    </div>
    {statusText ? <p className="mt-3 text-xs text-slate-400">{statusText}</p> : null}
  </div>
);

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

  const totalWallets = Math.max(summary.total, 0);
  const approvedCount = summary.verified_true;
  const rejectedCount = summary.verified_false;
  const approvedRate = summary.verified_rate * 100;
  const filteredRate = Math.max(0, 100 - approvedRate);
  const highRiskCount = summary.suspected_farm_count;
  const riskRate = summary.suspected_farm_rate * 100;
  const riskLevel = getRiskLevel(riskRate);
  const normalizedTokenPool = 1000;
  const estimatedSavedTokens = Math.round((filteredRate / 100) * normalizedTokenPool);
  const approvedAllocationTokens = normalizedTokenPool - estimatedSavedTokens;
  const confidenceValue = decisionConfidence?.score ?? 88;
  const confidenceLabel = decisionConfidence?.reliabilityLabel ?? 'High reliability decision';
  const campaignStatusLabel =
    finalDecisionStatus === 'finalized'
      ? 'Finalized result'
      : finalDecisionStatus === 'reviewed'
        ? 'Reviewed result'
        : 'Draft result';

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

  const riskNarrative =
    riskLevel === 'High'
      ? 'High sybil exposure remains and this campaign should be tightened before rewards go live.'
      : riskLevel === 'Medium'
        ? 'Sybil-like behavior is contained, but targeted review can still improve distribution quality.'
        : 'Sybil exposure is limited under the current policy and the approved cohort looks stable.';

  const statusText =
    shareStatus ?? proofCopyStatus ?? manifestCopyStatus ?? packageExportStatus ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-500">
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200">
          Optimization result
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
          Wallet set {totalWallets}
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
          {campaignStatusLabel}
        </span>
      </div>

      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.18),_transparent_34%),radial-gradient(circle_at_right,_rgba(14,165,233,0.16),_transparent_30%),linear-gradient(135deg,rgba(7,12,22,0.98),rgba(15,23,42,0.92))] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.35)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-400">
                Airdrop optimization result
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${decisionStatusClass(
                  finalDecisionStatus
                )}`}
              >
                {campaignStatusLabel}
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${riskLevelClass(
                  riskRate
                )}`}
              >
                {formatWholePercent(riskRate)} sybil exposure
              </span>
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Stop reward leakage before distribution.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200">
              Without filtering, ~41% of reward budget would likely be wasted. Only{' '}
              {Math.round(approvedRate)}% of wallets qualified for optimized distribution, and
              sybil exposure is reduced to {Math.round(riskRate)}% under the current policy.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:max-w-2xl">
              <ImpactStat
                eyebrow="Budget waste prevented"
                value={formatWholePercent(filteredRate)}
                detail={`Estimated savings: ${estimatedSavedTokens} / ${normalizedTokenPool} tokens preserved under an equal-distribution model.`}
                tone="emerald"
              />
              <ImpactStat
                eyebrow="Eligible wallets"
                value={`${approvedCount} approved`}
                detail={`Only ${Math.round(approvedRate)}% of wallets qualified for optimized allocation.`}
                tone="sky"
              />
              <ImpactStat
                eyebrow="Wallets filtered out"
                value={`${rejectedCount} excluded`}
                detail={`${Math.round(filteredRate)}% of submitted wallets were removed before budget deployment.`}
                tone="amber"
              />
              <ImpactStat
                eyebrow="Decision trust"
                value={`${confidenceValue}% confidence`}
                detail="Decision based on activity consistency, contract diversity, and cluster detection."
                tone="slate"
              />
            </div>
          </div>

          <div className="w-full max-w-xl space-y-4">
            <CtaPanel
              title="Run this on your wallet set"
              detail="Use the current policy and proof flow on another campaign input, or share this result with the rest of the team."
              primaryLabel="Analyze your campaign"
              secondaryLabel="Copy share link"
              tertiaryLabel="Export result"
              onPrimary={onRerunEvaluation}
              onSecondary={onCopyShareLink}
              onTertiary={onExportResults}
              primaryDisabled={loading || validEntries === 0 || !baseUrl || isDecisionLocked}
              secondaryDisabled={false}
              tertiaryDisabled={!sortedResults.length}
              statusText={statusText}
            />

            <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                Allocation impact
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Approved allocation
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {approvedAllocationTokens} / {normalizedTokenPool}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    Normalized tokens directed to qualified wallets.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">High-risk flagged</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{highRiskCount} wallets</p>
                  <p className="mt-1 text-sm text-slate-400">
                    Clustering and farming exposure isolated before payout.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={onFinalizeDecision}
                  disabled={finalDecisionStatus !== 'reviewed'}
                  className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100 transition hover:bg-emerald-500/20 hover:text-white disabled:cursor-not-allowed disabled:text-emerald-100/50"
                >
                  Finalize decision
                </button>
                <details className="group relative">
                  <summary className="cursor-pointer list-none rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300 hover:text-white">
                    More actions
                  </summary>
                  <div className="absolute right-0 z-10 mt-3 flex min-w-64 flex-col gap-2 rounded-2xl border border-white/10 bg-slate-950/95 p-3 shadow-2xl backdrop-blur">
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
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(15,23,42,0.72))] p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">01 Before vs after</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">What changed after filtering</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Move the decision from equal wallet distribution to optimized budget deployment.
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.18em] text-slate-300">
            {rejectedCount} wallets removed from payout path
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <ComparisonCard
            title="Before filtering"
            subtitle={`${totalWallets} wallets, equal distribution, higher waste exposure`}
            accent="rose"
          >
            <p>All {totalWallets} wallets compete for the same budget share regardless of quality.</p>
            <p>Reward leakage risk is roughly {Math.round(filteredRate)}% under a flat distribution model.</p>
            <p>High-risk exposure is harder to isolate before campaign funds go live.</p>
          </ComparisonCard>

          <ComparisonCard
            title="After filtering"
            subtitle={`${approvedCount} wallets approved for optimized allocation`}
            accent="emerald"
          >
            <p>Only qualified wallets remain in the distribution set, preserving budget for real users.</p>
            <p>Sybil exposure reduced to {Math.round(riskRate)}% under current policy.</p>
            <p>
              Estimated savings are {estimatedSavedTokens} / {normalizedTokenPool} tokens in a normalized payout model.
            </p>
          </ComparisonCard>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.86),rgba(15,23,42,0.7))] p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">02 Decision summary</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Why this result is commercially useful</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              The screen now answers budget protection, eligibility quality, and trust in one pass.
            </p>
          </div>
          <div className="text-right text-sm text-slate-400">
            Campaign {campaignId} - {totalWallets} evaluated wallets
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.75rem] border border-rose-400/20 bg-rose-500/10 p-5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-rose-200/80">What was removed</p>
              <p className="mt-3 text-3xl font-semibold text-white">{rejectedCount} low-quality wallets</p>
              <p className="mt-2 text-sm leading-6 text-rose-50/90">
                {rejectedCount} low-quality wallets excluded. {highRiskCount} high-risk wallets identified. Clustering and farming exposure reduced before payout.
              </p>
            </div>
            <div className="rounded-[1.75rem] border border-emerald-400/20 bg-emerald-500/10 p-5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-200/80">
                Optimized outcome
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">{formatWholePercent(approvedRate)} eligible</p>
              <p className="mt-2 text-sm leading-6 text-emerald-50/90">
                Qualified wallets receive the budget that would otherwise be diluted across low-signal addresses.
              </p>
            </div>
            <DecisionReason
              title="Activity consistency"
              detail="Wallets are evaluated for sustained usage instead of one-off bursts that often accompany campaign farming."
            />
            <DecisionReason
              title="Contract diversity"
              detail="Interaction breadth helps separate real ecosystem participation from narrow reward-seeking behavior."
            />
            <DecisionReason
              title="Cluster detection"
              detail="Correlated wallet behavior is flagged to reduce farming rings and repeated allocation leakage."
            />
            <DecisionReason
              title="Risk-adjusted allocation"
              detail="Approval and payout posture reflect both quality signals and residual sybil risk, not just raw activity volume."
            />
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Decision logic</p>
            <p className="mt-3 text-xl font-semibold text-white">
              Decision based on activity consistency, contract diversity, and cluster detection.
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Confidence is supported by {confidenceLabel.toLowerCase()} and a current result of{' '}
              {confidenceValue}%. This gives teams a clear reason to trust why wallets were approved,
              excluded, or flagged for review.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <ImpactStat
                eyebrow="Budget waste prevented"
                value={formatWholePercent(filteredRate)}
                detail="Without filtering, this share of the reward pool would likely go to low-quality wallets."
                tone="slate"
              />
              <ImpactStat
                eyebrow="Residual sybil exposure"
                value={formatWholePercent(riskRate)}
                detail="Exposure remaining under the active policy after current filtering."
                tone="slate"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.84),rgba(15,23,42,0.68))] p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">03 Allocation table</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Wallet allocation detail</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Keep the row-level evidence visible, but secondary to the business result.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {([
              ['all', 'All wallets'],
              ['eligible', 'Approved only'],
              ['high_score', 'High score'],
              ['risky', 'Risky only']
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
            {errorCount > 0 ? (
              <span className="text-rose-300">
                Errors: {errorCount}
                {topErrorHint ? ` (${topErrorHint})` : ''}
              </span>
            ) : null}
          </div>
          <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Sort: {sortLabel}</span>
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
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">04 Risk analysis</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Risk posture after optimization</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{riskNarrative}</p>
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
              <p className="mt-2 text-sm text-slate-400">
                Sybil exposure reduced to {Math.round(riskRate)}% under current policy.
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Flagged wallets</p>
              <p className="mt-3 text-2xl font-semibold text-white">{highRiskCount}</p>
              <p className="mt-1 text-sm text-slate-400">Wallets identified with elevated farming risk.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Decision confidence</p>
              <p className="mt-3 text-2xl font-semibold text-white">{confidenceValue}%</p>
              <p className="mt-1 text-sm text-slate-400">{confidenceLabel}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-400">
            Expand cohort-level signals and mitigation suggestions when risk needs a tighter policy.
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
              <div key={risk.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${riskSeverityClass(
                      risk.severity
                    )}`}
                  >
                    {risk.severity} risk
                  </span>
                  <span className="text-xs text-slate-400">{risk.affectedWallets} wallets affected</span>
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
      </section>

      <section className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.8),rgba(15,23,42,0.64))] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">05 Detailed metrics</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Supporting metrics and proof package</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Lower-value metrics stay available for auditability, but outside the primary decision path.
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

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <details className="rounded-3xl border border-white/10 bg-black/20 p-5" open>
            <summary className="cursor-pointer list-none text-sm font-semibold text-white">
              Review detailed metrics
            </summary>
            <div ref={filtersRef} className="mt-2" />
            <p className="mt-2 text-sm text-slate-400">
              Expanded metrics and threshold controls for deeper review.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Avg tx count</p>
                <p className="mt-2 text-2xl font-semibold text-white">{Math.round(summary.avg_tx_count)}</p>
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

          <details className="rounded-3xl border border-white/10 bg-black/20 p-5" open>
            <summary className="cursor-pointer list-none text-sm font-semibold text-white">
              Review proof package
            </summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Engine version</p>
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
        </div>
      </section>
    </div>
  );
};

export default DecisionProduct;
