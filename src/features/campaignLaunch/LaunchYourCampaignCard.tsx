'use client';

import classNames from 'classnames';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAccount } from 'wagmi';

import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import SectionCard from '@/components/ui/SectionCard';

import { computeAllocationPreview } from './preview';
import { useCampaignLaunch } from './hooks';
import { toDateInputValue, toIsoDate } from './storage';
import type {
  CampaignChecklistItem,
  CampaignChecklistStatus,
  LaunchYourCampaignCardProps
} from './types';

type ConfigSection = 'basics' | 'allocation' | 'eligibility';
type FeedbackTone = 'neutral' | 'success' | 'danger';

const statusClassNames: Record<CampaignChecklistStatus, string> = {
  complete: 'bg-emerald-500/10 text-emerald-200',
  current: 'bg-accent/10 text-accent',
  pending: 'bg-white/5 text-slate-300'
};

const feedbackClassNames: Record<FeedbackTone, string> = {
  success: 'bg-emerald-500/10 text-emerald-200',
  danger: 'bg-rose-500/10 text-rose-100',
  neutral: 'bg-white/5 text-slate-200'
};

const sectionOptions: Array<{ key: ConfigSection; label: string }> = [
  { key: 'basics', label: 'Basics' },
  { key: 'allocation', label: 'Allocation' },
  { key: 'eligibility', label: 'Eligibility' }
];

const formatAmount = (value: number): string =>
  `${value.toLocaleString(undefined, {
    minimumFractionDigits: value < 100 ? 2 : 0,
    maximumFractionDigits: 2
  })} IFLW`;

const formatCompact = (value: number): string =>
  value.toLocaleString(undefined, { maximumFractionDigits: 0 });

const formatPercent = (value: number): string =>
  `${value.toLocaleString(undefined, {
    minimumFractionDigits: value < 10 ? 1 : 0,
    maximumFractionDigits: 1
  })}%`;

const StatusBadge = ({
  status,
  label
}: {
  status: CampaignChecklistStatus;
  label: string;
}) => {
  return (
    <span
      className={classNames(
        'inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]',
        statusClassNames[status]
      )}
    >
      {label}
    </span>
  );
};

const MetricCard = ({
  label,
  value,
  helper
}: {
  label: string;
  value: string;
  helper: string;
}) => {
  return (
    <div className="rounded-2xl border border-white/5 bg-background/50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-300">{helper}</p>
    </div>
  );
};

const ReviewRow = ({
  label,
  helper,
  complete
}: {
  label: string;
  helper: string;
  complete: boolean;
}) => {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/5 bg-background/50 px-4 py-3">
      <div className="space-y-1">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-slate-300">{helper}</p>
      </div>
      <StatusBadge status={complete ? 'complete' : 'current'} label={complete ? 'Ready' : 'Check'} />
    </div>
  );
};

const LaunchYourCampaignCard = ({
  participants,
  supportsProofUsageFilter = false
}: LaunchYourCampaignCardProps) => {
  const { isConnected } = useAccount();
  const cardRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<ConfigSection>('basics');
  const {
    draft,
    hasStoredDraft,
    feedback,
    draftValidationMessage,
    canLaunch: isDraftLaunchable,
    isLoading,
    isSaving,
    isLaunching,
    loadError,
    launchResult,
    updateDraft,
    saveDraft,
    launch,
    retryLoad
  } = useCampaignLaunch();

  useEffect(() => {
    if (window.location.hash === '#launch-your-campaign') {
      cardRef.current?.focus();
    }
  }, []);

  const preview = useMemo(
    () =>
      computeAllocationPreview(draft, participants, {
        supportsProofUsageFilter
      }),
    [draft, participants, supportsProofUsageFilter]
  );

  const basicsReady =
    draft.name.trim().length >= 3 &&
    draft.budget > 0 &&
    Boolean(draft.startDate) &&
    Boolean(draft.endDate) &&
    new Date(draft.endDate).getTime() > new Date(draft.startDate).getTime();
  const allocationReady =
    draft.maxPerWallet > 0 &&
    draft.minPerWallet >= 0 &&
    draft.minPerWallet <= draft.maxPerWallet;
  const eligibilityReady = draft.minScore > 0;
  const reviewConfirmed = draft.termsAccepted;
  const previewReady = preview.computedSuccessfully && preview.eligibleCount > 0;

  const checklist = useMemo<CampaignChecklistItem[]>(() => {
    const connectStatus: CampaignChecklistStatus = isConnected ? 'complete' : 'current';
    const typeStatus: CampaignChecklistStatus = draft.type ? 'complete' : 'pending';
    const configurationStatus: CampaignChecklistStatus =
      basicsReady && allocationReady && eligibilityReady
        ? 'complete'
        : isConnected
          ? 'current'
          : 'pending';
    const reviewStatus: CampaignChecklistStatus =
      previewReady && reviewConfirmed ? 'complete' : 'current';
    const launchStatus: CampaignChecklistStatus =
      isConnected && isDraftLaunchable && previewReady ? 'complete' : 'pending';

    return [
      {
        label: 'Connect wallet',
        status: connectStatus,
        helper: isConnected ? 'Wallet connected' : 'Connect to unlock launch'
      },
      {
        label: 'Choose campaign type',
        status: typeStatus,
        helper: `Selected: ${draft.type}`
      },
      {
        label: 'Configure params',
        status: configurationStatus,
        helper:
          basicsReady && allocationReady && eligibilityReady
            ? 'Basics, allocation, and eligibility are configured'
            : 'Complete the setup tabs'
      },
      {
        label: 'Review',
        status: reviewStatus,
        helper:
          preview.computedSuccessfully && reviewConfirmed
            ? 'Preview and confirmation are ready'
            : 'Validate the review checklist'
      },
      {
        label: 'Launch',
        status: launchStatus,
        helper: launchStatus === 'complete' ? 'Ready to launch' : 'Finalize the checks first'
      }
    ];
  }, [
    allocationReady,
    basicsReady,
    draft.type,
    eligibilityReady,
    isConnected,
    isDraftLaunchable,
    previewReady,
    reviewConfirmed
  ]);

  const reviewChecks = useMemo(
    () => [
      {
        label: 'Allocation caps set',
        helper: `Max per wallet cap is ${formatAmount(preview.effectiveMaxPerWallet)}.`,
        complete: draft.maxPerWallet > 0
      },
      {
        label: 'Eligibility threshold set',
        helper: `Minimum score is ${draft.minScore}.`,
        complete: draft.minScore > 0
      },
      {
        label: 'Preview computed successfully',
        helper:
          preview.eligibleCount > 0
            ? `${preview.previewLabel} is ready with ${formatCompact(preview.eligibleCount)} eligible wallets.`
            : 'Adjust the filters until the preview returns eligible wallets.',
        complete: previewReady
      },
      {
        label: 'Final confirmation',
        helper: 'Confirm the allocation and eligibility rules before launch.',
        complete: draft.termsAccepted
      }
    ],
    [
      draft.maxPerWallet,
      draft.minScore,
      draft.termsAccepted,
      preview.eligibleCount,
      previewReady,
      preview.effectiveMaxPerWallet,
      preview.previewLabel
    ]
  );

  const reviewReady = reviewChecks.every((item) => item.complete);
  const canSubmit = isConnected && isDraftLaunchable && reviewReady;
  const showEmptyState = !hasStoredDraft && draft.name.trim().length === 0;

  const summaryCards = [
    {
      label: 'Budget',
      value: formatAmount(draft.budget),
      helper: `${draft.type} distribution pool`
    },
    {
      label: 'Eligible wallets',
      value: formatCompact(preview.eligibleCount),
      helper: preview.previewLabel
    },
    {
      label: 'Est. avg / wallet',
      value: formatAmount(preview.estAvg),
      helper: `Utilization ${formatPercent(preview.budgetUtilizationPercent)}`
    },
    {
      label: 'Max / wallet',
      value: formatAmount(preview.effectiveMaxPerWallet),
      helper: `Includes ${formatPercent(draft.maxSharePercent)} share cap`
    }
  ];

  return (
    <div
      id="launch-your-campaign"
      ref={cardRef}
      tabIndex={-1}
      className="outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <SectionCard
        title="Launch your campaign"
        description="Configure score-based distribution, validate eligibility, and launch from one compact operator utility."
        eyebrow="Campaign Utility"
        actions={
          <Link
            href="#launch-your-campaign"
            className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/5"
          >
            Focus
          </Link>
        }
      >
        {isLoading ? (
          <LoadingSkeleton lines={8} />
        ) : loadError ? (
          <ErrorState
            title="Draft unavailable"
            description={loadError}
            action={
              <button
                type="button"
                onClick={() => {
                  void retryLoad();
                }}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
              >
                Retry
              </button>
            }
          />
        ) : (
          <div className="space-y-6">
            {showEmptyState ? (
              <EmptyState
                title="Not configured yet"
                description="Start with the basics, then add allocation caps and eligibility rules before launch."
                compact
              />
            ) : null}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((card) => (
                <MetricCard
                  key={card.label}
                  label={card.label}
                  value={card.value}
                  helper={card.helper}
                />
              ))}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-2xl border border-white/5 bg-background/50 px-4 py-3 text-xs text-slate-300">
              <span>Est. range: {formatAmount(preview.estMinAfterCap)} to {formatAmount(preview.estMaxAfterCap)}</span>
              <span>Top 10 share: {formatPercent(preview.top10SharePercent)}</span>
              <span>{preview.previewLabel}</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {checklist.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-white/5 bg-background/50 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{item.label}</p>
                    <StatusBadge
                      status={item.status}
                      label={
                        item.status === 'complete'
                          ? 'Done'
                          : item.status === 'current'
                            ? 'Active'
                            : 'Pending'
                      }
                    />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-300">{item.helper}</p>
                </div>
              ))}
            </div>

            <div className="space-y-4 rounded-2xl border border-white/5 bg-background/40 p-4">
              <div
                role="tablist"
                aria-label="Campaign configuration sections"
                className="flex flex-wrap gap-2"
              >
                {sectionOptions.map((section) => (
                  <button
                    key={section.key}
                    type="button"
                    role="tab"
                    aria-selected={activeSection === section.key}
                    onClick={() => setActiveSection(section.key)}
                    className={classNames(
                      'rounded-full px-4 py-2 text-sm font-medium transition',
                      activeSection === section.key
                        ? 'bg-white text-slate-950'
                        : 'border border-white/10 text-slate-300 hover:border-white/20 hover:bg-white/5'
                    )}
                  >
                    {section.label}
                  </button>
                ))}
              </div>

              {activeSection === 'basics' ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="campaign-name" className="text-sm font-medium text-slate-200">
                      Campaign name
                    </label>
                    <input
                      id="campaign-name"
                      type="text"
                      value={draft.name}
                      onChange={(event) => updateDraft('name', event.target.value)}
                      placeholder="Spring rewards"
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="campaign-type" className="text-sm font-medium text-slate-200">
                      Campaign type
                    </label>
                    <select
                      id="campaign-type"
                      value={draft.type}
                      onChange={(event) =>
                        updateDraft('type', event.target.value as typeof draft.type)
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                    >
                      <option value="quest">Quest</option>
                      <option value="airdrop">Airdrop</option>
                      <option value="referral">Referral</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="campaign-budget" className="text-sm font-medium text-slate-200">
                      Budget
                    </label>
                    <input
                      id="campaign-budget"
                      type="number"
                      min="1"
                      step="1"
                      value={Number.isFinite(draft.budget) ? draft.budget : ''}
                      onChange={(event) => updateDraft('budget', Number(event.target.value || 0))}
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="campaign-start" className="text-sm font-medium text-slate-200">
                      Start date
                    </label>
                    <input
                      id="campaign-start"
                      type="date"
                      value={toDateInputValue(draft.startDate)}
                      onChange={(event) => updateDraft('startDate', toIsoDate(event.target.value))}
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="campaign-end" className="text-sm font-medium text-slate-200">
                      End date
                    </label>
                    <input
                      id="campaign-end"
                      type="date"
                      value={toDateInputValue(draft.endDate)}
                      onChange={(event) => updateDraft('endDate', toIsoDate(event.target.value))}
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                    />
                  </div>
                </div>
              ) : null}

              {activeSection === 'allocation' ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="max-per-wallet" className="text-sm font-medium text-slate-200">
                      Max per wallet
                    </label>
                    <input
                      id="max-per-wallet"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={draft.maxPerWallet}
                      onChange={(event) =>
                        updateDraft('maxPerWallet', Number(event.target.value || 0))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="min-per-wallet" className="text-sm font-medium text-slate-200">
                      Min per wallet
                    </label>
                    <input
                      id="min-per-wallet"
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.minPerWallet}
                      onChange={(event) =>
                        updateDraft('minPerWallet', Number(event.target.value || 0))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="max-share-percent"
                      className="text-sm font-medium text-slate-200"
                    >
                      Max share %
                    </label>
                    <input
                      id="max-share-percent"
                      type="number"
                      min="0"
                      max="5"
                      step="0.1"
                      value={draft.maxSharePercent}
                      onChange={(event) =>
                        updateDraft('maxSharePercent', Number(event.target.value || 0))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="transform" className="text-sm font-medium text-slate-200">
                      Transform
                    </label>
                    <select
                      id="transform"
                      value={draft.transform}
                      onChange={(event) =>
                        updateDraft('transform', event.target.value as typeof draft.transform)
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                    >
                      <option value="linear">Linear</option>
                      <option value="sqrt">Sqrt</option>
                      <option value="log">Log</option>
                    </select>
                  </div>

                  <div className="space-y-3 md:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label htmlFor="equal-percent" className="text-sm font-medium text-slate-200">
                        Split mix
                      </label>
                      <div className="flex flex-wrap gap-3 text-xs text-slate-300">
                        <span>Equal {formatPercent(draft.equalPercent)}</span>
                        <span>Weighted {formatPercent(100 - draft.equalPercent)}</span>
                      </div>
                    </div>
                    <input
                      id="equal-percent"
                      type="range"
                      min="0"
                      max="50"
                      step="1"
                      value={draft.equalPercent}
                      onChange={(event) =>
                        updateDraft('equalPercent', Number(event.target.value || 0))
                      }
                      className="w-full accent-accent"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="rounding-rule" className="text-sm font-medium text-slate-200">
                      Rounding
                    </label>
                    <select
                      id="rounding-rule"
                      value={draft.roundingRule}
                      onChange={(event) =>
                        updateDraft(
                          'roundingRule',
                          event.target.value as typeof draft.roundingRule
                        )
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                    >
                      <option value="roundDown">Round down</option>
                      <option value="roundNearest">Round nearest</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                </div>
              ) : null}

              {activeSection === 'eligibility' ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="min-score" className="text-sm font-medium text-slate-200">
                      Min score
                    </label>
                    <input
                      id="min-score"
                      type="number"
                      min="0"
                      step="1"
                      value={draft.minScore}
                      onChange={(event) => updateDraft('minScore', Number(event.target.value || 0))}
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="wallet-age-days"
                      className="text-sm font-medium text-slate-200"
                    >
                      Wallet age (days)
                    </label>
                    <input
                      id="wallet-age-days"
                      type="number"
                      min="0"
                      step="1"
                      value={draft.walletAgeDays}
                      onChange={(event) =>
                        updateDraft('walletAgeDays', Number(event.target.value || 0))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="active-days-last-14"
                      className="text-sm font-medium text-slate-200"
                    >
                      Active days (last 14)
                    </label>
                    <input
                      id="active-days-last-14"
                      type="number"
                      min="0"
                      max="14"
                      step="1"
                      value={draft.activeDaysLast14}
                      onChange={(event) =>
                        updateDraft('activeDaysLast14', Number(event.target.value || 0))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                    />
                  </div>

                  {supportsProofUsageFilter ? (
                    <div className="space-y-2">
                      <label
                        htmlFor="proof-usage-min-events"
                        className="text-sm font-medium text-slate-200"
                      >
                        Proof-of-usage min events
                      </label>
                      <input
                        id="proof-usage-min-events"
                        type="number"
                        min="0"
                        step="1"
                        value={
                          typeof draft.proofUsageMinEvents === 'number'
                            ? draft.proofUsageMinEvents
                            : ''
                        }
                        onChange={(event) =>
                          updateDraft(
                            'proofUsageMinEvents',
                            event.target.value === ''
                              ? undefined
                              : Number(event.target.value || 0)
                          )
                        }
                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-white">Review checklist</p>
                <p className="mt-1 text-xs text-slate-300">
                  Launch stays disabled until the required operator checks are complete.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {reviewChecks.slice(0, 3).map((item) => (
                  <ReviewRow
                    key={item.label}
                    label={item.label}
                    helper={item.helper}
                    complete={item.complete}
                  />
                ))}
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-white/5 bg-background/50 p-4">
                <input
                  type="checkbox"
                  checked={draft.termsAccepted}
                  onChange={(event) => updateDraft('termsAccepted', event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent text-accent focus:ring-accent"
                />
                <span className="text-sm leading-6 text-slate-300">
                  I confirm the allocation caps, eligibility filters, and preview estimate before
                  launching.
                </span>
              </label>

              <ReviewRow
                label={reviewChecks[3].label}
                helper={reviewChecks[3].helper}
                complete={reviewChecks[3].complete}
              />
            </div>

            {draftValidationMessage ? (
              <p className="text-sm text-amber-200">{draftValidationMessage}</p>
            ) : null}

            {feedback ? (
              <div
                className={classNames(
                  'rounded-2xl px-4 py-3 text-sm',
                  feedbackClassNames[feedback.tone]
                )}
              >
                {feedback.message}
              </div>
            ) : null}

            {launchResult ? (
              <div className="rounded-2xl border border-white/5 bg-background/50 px-4 py-3 text-sm text-slate-300">
                Campaign ID:{' '}
                <span className="font-mono text-slate-100">{launchResult.campaignId}</span>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  void launch();
                }}
                disabled={!canSubmit || isLaunching}
                className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-white/30 disabled:text-slate-500"
              >
                {isLaunching ? 'Launching...' : 'Launch campaign'}
              </button>
              <button
                type="button"
                onClick={() => {
                  void saveDraft();
                }}
                disabled={Boolean(draftValidationMessage) || isSaving}
                className="inline-flex items-center justify-center rounded-full border border-white/10 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/5 disabled:cursor-not-allowed disabled:border-white/5 disabled:text-slate-500"
              >
                {isSaving ? 'Saving...' : 'Save draft'}
              </button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
};

export default LaunchYourCampaignCard;
