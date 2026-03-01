'use client';

import classNames from 'classnames';
import Link from 'next/link';
import { useEffect, useMemo, useRef } from 'react';
import { useAccount } from 'wagmi';

import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import SectionCard from '@/components/ui/SectionCard';

import { toDateInputValue, toIsoDate } from './api';
import { useCampaignLaunch } from './hooks';
import type { CampaignChecklistItem, CampaignChecklistStatus } from './types';

const statusClassNames: Record<CampaignChecklistStatus, string> = {
  complete: 'bg-emerald-500/10 text-emerald-200',
  current: 'bg-accent/10 text-accent',
  pending: 'bg-white/5 text-slate-300'
};

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

const LaunchYourCampaignCard = () => {
  const { isConnected } = useAccount();
  const cardRef = useRef<HTMLDivElement>(null);
  const {
    draft,
    hasStoredDraft,
    feedback,
    draftValidationMessage,
    canLaunch,
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

  const configurationReady =
    draft.name.trim().length >= 3 &&
    draft.budget > 0 &&
    Boolean(draft.startDate) &&
    Boolean(draft.endDate) &&
    new Date(draft.endDate).getTime() > new Date(draft.startDate).getTime();
  const reviewReady = draft.termsAccepted;

  const checklist = useMemo<CampaignChecklistItem[]>(() => {
    const connectStatus: CampaignChecklistStatus = isConnected ? 'complete' : 'current';
    const typeStatus: CampaignChecklistStatus = draft.type ? 'complete' : 'pending';
    const configurationStatus: CampaignChecklistStatus = configurationReady
      ? 'complete'
      : isConnected
        ? 'current'
        : 'pending';
    const reviewStatus: CampaignChecklistStatus = reviewReady
      ? 'complete'
      : configurationReady
        ? 'current'
        : 'pending';
    const launchStatus: CampaignChecklistStatus = canLaunch ? 'complete' : 'pending';

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
        helper: configurationReady ? 'Name, budget, and dates are valid' : 'Complete all inputs'
      },
      {
        label: 'Review',
        status: reviewStatus,
        helper: reviewReady ? 'Terms accepted' : 'Accept terms to continue'
      },
      {
        label: 'Launch',
        status: launchStatus,
        helper: canLaunch ? 'Ready to launch' : 'Finish the steps above first'
      }
    ];
  }, [canLaunch, configurationReady, draft.type, isConnected, reviewReady]);

  const showEmptyState = !hasStoredDraft && draft.name.trim().length === 0;

  return (
    <div
      id="launch-your-campaign"
      ref={cardRef}
      tabIndex={-1}
      className="outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <SectionCard
        title="Launch your campaign"
        description="Create, review, and launch a campaign draft from one reusable operator widget."
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
          <LoadingSkeleton lines={6} />
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
                description="Start by filling in the campaign details below, then save a draft or launch when ready."
                compact
              />
            ) : null}

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
                  onChange={(event) =>
                    updateDraft('budget', Number(event.target.value || 0))
                  }
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

            <label className="flex items-start gap-3 rounded-2xl border border-white/5 bg-background/50 p-4">
              <input
                type="checkbox"
                checked={draft.termsAccepted}
                onChange={(event) => updateDraft('termsAccepted', event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent text-accent focus:ring-accent"
              />
              <span className="text-sm leading-6 text-slate-300">
                I have reviewed the campaign configuration, dates, and budget and I am ready
                to launch.
              </span>
            </label>

            {draftValidationMessage ? (
              <p className="text-sm text-amber-200">{draftValidationMessage}</p>
            ) : null}

            {feedback ? (
              <div
                className={classNames(
                  'rounded-2xl px-4 py-3 text-sm',
                  feedback.tone === 'success'
                    ? 'bg-emerald-500/10 text-emerald-200'
                    : feedback.tone === 'danger'
                      ? 'bg-rose-500/10 text-rose-100'
                      : 'bg-white/5 text-slate-200'
                )}
              >
                {feedback.message}
              </div>
            ) : null}

            {launchResult ? (
              <div className="rounded-2xl border border-white/5 bg-background/50 px-4 py-3 text-sm text-slate-300">
                Campaign ID: <span className="font-mono text-slate-100">{launchResult.campaignId}</span>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  void launch();
                }}
                disabled={!canLaunch || isLaunching}
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
