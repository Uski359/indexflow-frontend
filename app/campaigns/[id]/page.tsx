'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import {
  loadCampaignAllocations,
  loadCampaignById
} from '@/src/features/campaignLaunch/storage';
import type {
  CampaignAllocation,
  CampaignDecisionMetric,
  CampaignDraft,
  CampaignRecord
} from '@/src/features/campaignLaunch/types';

const formatDateTime = (value: string): string => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Unknown' : parsed.toLocaleString();
};

const formatAmount = (value: number): string =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: value < 100 ? 2 : 0,
    maximumFractionDigits: 2
  });

const formatPercent = (value: number): string =>
  `${value.toLocaleString(undefined, {
    minimumFractionDigits: value < 10 ? 1 : 0,
    maximumFractionDigits: 1
  })}%`;

const formatDecisionMetric = (metric: CampaignDecisionMetric): string =>
  `${metric.count.toLocaleString()} (${formatPercent(metric.percent)})`;

type ScoreBand = 'High' | 'Medium' | 'Low';
type DistributionLogic = {
  label: 'Equal' | 'Score-weighted' | 'Hybrid';
  formulaReference: string;
  fairnessExplanation: string;
};

type ClusterRiskLevel = 'Low' | 'Medium' | 'High';
type CampaignRiskAnalysis = {
  suspectedSybilWallets: number;
  farmingRatio: number;
  clusterRiskLevel: ClusterRiskLevel;
  confidenceScore: number;
  warningThreshold: number;
};

type CampaignInsight = {
  title: string;
  message: string;
  toneClassName: string;
};

type CampaignProofPackage = {
  manifest: string;
  inputHash: string;
  policyHash: string;
  outputHash: string;
  engineVersion: string;
};

type ExportAsset = {
  label: string;
  title: string;
  description: string;
  onClick: () => void;
};

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
};

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');

const shortenHash = (value: string) => {
  if (value.length <= 18) {
    return value;
  }
  return `${value.slice(0, 12)}...${value.slice(-8)}`;
};

const hashText = async (value: string): Promise<string> => {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const encoded = new TextEncoder().encode(value);
    const digest = await window.crypto.subtle.digest('SHA-256', encoded);
    return toHex(digest);
  }

  let fallback = 0;
  for (let index = 0; index < value.length; index += 1) {
    fallback = (fallback * 31 + value.charCodeAt(index)) >>> 0;
  }
  return fallback.toString(16).padStart(8, '0');
};

const downloadTextFile = (filename: string, content: string, contentType: string) => {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const getScoreBand = (score: number): ScoreBand => {
  if (score >= 80) {
    return 'High';
  }
  if (score >= 60) {
    return 'Medium';
  }
  return 'Low';
};

const getBandClasses = (band: ScoreBand): string => {
  switch (band) {
    case 'High':
      return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100';
    case 'Medium':
      return 'border-amber-400/30 bg-amber-500/10 text-amber-100';
    default:
      return 'border-slate-400/20 bg-white/5 text-slate-200';
  }
};

const getAllocationRiskLabel = (score: number): 'low' | 'medium' | 'high' => {
  if (score >= 80) {
    return 'low';
  }
  if (score >= 60) {
    return 'medium';
  }
  return 'high';
};

const getDistributionLogic = (config: CampaignDraft): DistributionLogic => {
  if (config.equalPercent >= 100) {
    return {
      label: 'Equal',
      formulaReference: 'Equal split',
      fairnessExplanation:
        'Every eligible wallet receives the same baseline allocation, with only caps and rounding affecting the final amount.'
    };
  }

  if (config.equalPercent <= 0) {
    return {
      label: 'Score-weighted',
      formulaReference: `${config.transform} score-weighted`,
      fairnessExplanation:
        'Every eligible wallet is allocated from the same score-weighted formula, so higher scores receive more budget while the same caps and rounding rules apply to everyone.'
    };
  }

  return {
    label: 'Hybrid',
    formulaReference: `${config.equalPercent}% equal + ${(100 - config.equalPercent).toLocaleString(undefined, {
      maximumFractionDigits: 1
    })}% ${config.transform} score-weighted`,
    fairnessExplanation:
      'Each wallet gets the same equal-split base, then the remaining budget is distributed by score using the configured transform, with deterministic caps and rounding.'
  };
};

const getClusterRiskLevel = (riskPercent: number): ClusterRiskLevel => {
  if (riskPercent >= 20) {
    return 'High';
  }
  if (riskPercent >= 10) {
    return 'Medium';
  }
  return 'Low';
};

const getClusterRiskClasses = (level: ClusterRiskLevel): string => {
  switch (level) {
    case 'High':
      return 'border-amber-400/30 bg-amber-500/10 text-amber-100';
    case 'Medium':
      return 'border-sky-400/30 bg-sky-500/10 text-sky-100';
    default:
      return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100';
  }
};

const getRiskAnalysis = (
  campaign: CampaignRecord,
  allocations: CampaignAllocation[]
): CampaignRiskAnalysis | null => {
  if (!campaign.decisionSummary) {
    return null;
  }

  const warningThreshold = 15;
  const suspectedSybilWallets = campaign.decisionSummary.highRiskWallets.count;
  const farmingRatio = campaign.decisionSummary.highRiskWallets.percent;
  const clusterRiskLevel = getClusterRiskLevel(farmingRatio);
  const averageAllocatedScore =
    allocations.length > 0
      ? allocations.reduce((sum, allocation) => sum + allocation.score, 0) / allocations.length
      : campaign.config.minScore;
  const scoreStrength = Math.max(
    0,
    Math.min(100, ((averageAllocatedScore - campaign.config.minScore) / 40) * 100)
  );
  const riskPenalty = Math.max(0, 100 - farmingRatio * 2.5);
  const confidenceScore = Math.round(scoreStrength * 0.55 + riskPenalty * 0.45);

  return {
    suspectedSybilWallets,
    farmingRatio,
    clusterRiskLevel,
    confidenceScore,
    warningThreshold
  };
};

const getAllocationQualityInsight = (averageAllocation: number): CampaignInsight => {
  if (averageAllocation >= 100) {
    return {
      title: 'Allocation quality',
      message: 'Average allocation suggests high-value wallets dominate this campaign.',
      toneClassName: 'border-emerald-400/20 bg-emerald-500/5 text-emerald-100'
    };
  }

  if (averageAllocation >= 25) {
    return {
      title: 'Allocation quality',
      message: 'Average allocation suggests moderate user quality.',
      toneClassName: 'border-sky-400/20 bg-sky-500/5 text-sky-100'
    };
  }

  return {
    title: 'Allocation quality',
    message: 'Average allocation suggests long-tail wallets dominate this campaign.',
    toneClassName: 'border-amber-400/20 bg-amber-500/5 text-amber-100'
  };
};

const getUtilizationInsight = (utilizationPercent: number): CampaignInsight => {
  if (utilizationPercent < 10) {
    return {
      title: 'Budget utilization',
      message: 'Low utilization - consider increasing eligibility or adjusting thresholds.',
      toneClassName: 'border-amber-400/20 bg-amber-500/5 text-amber-100'
    };
  }

  if (utilizationPercent < 70) {
    return {
      title: 'Budget utilization',
      message: 'Partial utilization suggests the campaign is selective but still has room to expand.',
      toneClassName: 'border-sky-400/20 bg-sky-500/5 text-sky-100'
    };
  }

  return {
    title: 'Budget utilization',
    message: 'Strong utilization indicates the current thresholds are capturing most of the intended budget.',
    toneClassName: 'border-emerald-400/20 bg-emerald-500/5 text-emerald-100'
  };
};

const getDecisionInsight = (
  campaign: CampaignRecord,
  riskAnalysis: CampaignRiskAnalysis | null
): CampaignInsight => {
  if (!campaign.decisionSummary) {
    return {
      title: 'Decision quality',
      message: 'Decision diagnostics are unavailable for this legacy campaign record.',
      toneClassName: 'border-white/10 bg-white/5 text-slate-200'
    };
  }

  if (campaign.decisionSummary.filteredOutPercent >= 40) {
    return {
      title: 'Decision quality',
      message: 'The campaign is filtering aggressively, which improves quality control but may shrink distribution breadth.',
      toneClassName: 'border-sky-400/20 bg-sky-500/5 text-sky-100'
    };
  }

  if (riskAnalysis && riskAnalysis.clusterRiskLevel === 'High') {
    return {
      title: 'Decision quality',
      message: 'Risk concentration remains elevated, so threshold tuning may still be needed before distribution.',
      toneClassName: 'border-amber-400/20 bg-amber-500/5 text-amber-100'
    };
  }

  return {
    title: 'Decision quality',
    message: 'The current filter set balances reach and quality with a manageable risk profile.',
    toneClassName: 'border-emerald-400/20 bg-emerald-500/5 text-emerald-100'
  };
};

const buildAllocationReason = (
  allocation: CampaignAllocation,
  logic: DistributionLogic
): string => {
  const band = getScoreBand(allocation.score);

  if (logic.label === 'Equal') {
    return `${band} band wallet with score ${allocation.score.toFixed(2)}. Equal distribution gives every eligible wallet the same base share, and only campaign caps or rounding can change the final amount.`;
  }

  if (logic.label === 'Score-weighted') {
    if (band === 'High') {
      return `High band wallet with score ${allocation.score.toFixed(2)}. Under score-weighted logic, stronger scores receive a larger share of the budget before caps and rounding are applied.`;
    }
    if (band === 'Medium') {
      return `Medium band wallet with score ${allocation.score.toFixed(2)}. It qualified cleanly, but its weighted share is smaller than high-band wallets because the same formula is applied to all eligible wallets.`;
    }
    return `Low band wallet with score ${allocation.score.toFixed(2)}. It still met eligibility, but score-weighted logic gives it a smaller share than medium- and high-band wallets under the same deterministic formula.`;
  }

  if (band === 'High') {
    return `High band wallet with score ${allocation.score.toFixed(2)}. It received the equal base allocation plus a stronger score-weighted uplift, subject to the same caps and rounding as every other wallet.`;
  }
  if (band === 'Medium') {
    return `Medium band wallet with score ${allocation.score.toFixed(2)}. It received the equal base allocation plus a moderate score-weighted uplift under the shared hybrid formula.`;
  }
  return `Low band wallet with score ${allocation.score.toFixed(2)}. It received the equal base allocation, but a smaller weighted uplift because its score is lower under the same hybrid formula.`;
};

const CampaignDetailPage = () => {
  const params = useParams();
  const campaignId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [campaign, setCampaign] = useState<CampaignRecord | null | undefined>(undefined);
  const [allocations, setAllocations] = useState<CampaignAllocation[]>([]);
  const [copyState, setCopyState] = useState<string | null>(null);
  const [manifestCopyState, setManifestCopyState] = useState<string | null>(null);
  const [proofPackage, setProofPackage] = useState<CampaignProofPackage | null>(null);

  useEffect(() => {
    if (!campaignId || typeof campaignId !== 'string') {
      setCampaign(null);
      setAllocations([]);
      return;
    }

    const nextCampaign = loadCampaignById(campaignId);
    setCampaign(nextCampaign);
    setAllocations(nextCampaign ? loadCampaignAllocations(campaignId) : []);
  }, [campaignId]);

  const topAllocations = useMemo(() => allocations.slice(0, 50), [allocations]);
  const hasPersistedDecisionSummary = Boolean(campaign?.decisionSummary);
  const distributionLogic = useMemo(
    () => (campaign ? getDistributionLogic(campaign.config) : null),
    [campaign]
  );
  const riskAnalysis = useMemo(
    () => (campaign ? getRiskAnalysis(campaign, allocations) : null),
    [allocations, campaign]
  );
  const summaryInsights = useMemo<CampaignInsight[]>(() => {
    if (!campaign) {
      return [];
    }

    return [
      getAllocationQualityInsight(campaign.preview.estAvg),
      getUtilizationInsight(campaign.preview.budgetUtilizationPercent),
      getDecisionInsight(campaign, riskAnalysis)
    ];
  }, [campaign, riskAnalysis]);
  const bandSummary = useMemo(() => {
    return allocations.reduce<Record<ScoreBand, number>>(
      (acc, allocation) => {
        acc[getScoreBand(allocation.score)] += 1;
        return acc;
      },
      { High: 0, Medium: 0, Low: 0 }
    );
  }, [allocations]);

  useEffect(() => {
    let cancelled = false;

    if (!campaign) {
      setProofPackage(null);
      return () => {
        cancelled = true;
      };
    }

    const inputPayload = {
      campaign_id: campaign.id,
      snapshot_at: campaign.snapshotAt,
      wallet_snapshot: allocations.map((allocation) => allocation.wallet).sort((a, b) =>
        a.localeCompare(b)
      )
    };
    const policyPayload = {
      config: {
        type: campaign.config.type,
        budget: campaign.config.budget,
        maxPerWallet: campaign.config.maxPerWallet,
        minPerWallet: campaign.config.minPerWallet,
        maxSharePercent: campaign.config.maxSharePercent,
        transform: campaign.config.transform,
        equalPercent: campaign.config.equalPercent,
        roundingRule: campaign.config.roundingRule,
        minScore: campaign.config.minScore,
        walletAgeDays: campaign.config.walletAgeDays,
        activeDaysLast14: campaign.config.activeDaysLast14,
        proofUsageMinEvents: campaign.config.proofUsageMinEvents ?? null
      }
    };
    const outputPayload = {
      preview: campaign.preview,
      decisionSummary: campaign.decisionSummary ?? null,
      allocations: allocations
        .map((allocation) => ({
          wallet: allocation.wallet,
          amount: allocation.amount,
          sharePercent: allocation.sharePercent,
          score: allocation.score
        }))
        .sort((left, right) => left.wallet.localeCompare(right.wallet))
    };
    const engineVersion = `campaign-launch/${campaign.config.transform}-${campaign.config.roundingRule}`;

    void (async () => {
      const [inputHash, policyHash, outputHash] = await Promise.all([
        hashText(stableStringify(inputPayload)),
        hashText(stableStringify(policyPayload)),
        hashText(stableStringify(outputPayload))
      ]);

      if (cancelled) {
        return;
      }

      const manifestObject = {
        package_version: 'campaign-decision-proof/v1',
        label: 'Campaign Decision Result',
        reproducible: true,
        statement:
          'This decision can be independently reproduced using the same inputs and policy.',
        campaign_id: campaign.id,
        engine_version: engineVersion,
        input: { ...inputPayload, hash: inputHash },
        policy: { ...policyPayload, hash: policyHash },
        output: { ...outputPayload, hash: outputHash }
      };

      setProofPackage({
        manifest: JSON.stringify(manifestObject, null, 2),
        inputHash,
        policyHash,
        outputHash,
        engineVersion
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [allocations, campaign]);

  const exportCsv = () => {
    if (!campaign) {
      return;
    }

    const lines = [
      'wallet,amount,share_percent,score,wallet_age_days,active_days_last_14,proof_usage_events'
    ];

    allocations.forEach((allocation) => {
      lines.push(
        [
          allocation.wallet,
          allocation.amount,
          allocation.sharePercent,
          allocation.score,
          allocation.walletAgeDays,
          allocation.activeDaysLast14,
          allocation.proofUsageEvents ?? ''
        ].join(',')
      );
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${campaign.config.name || 'campaign'}-${campaign.id}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const copyCampaignId = async () => {
    if (!campaignId || !navigator?.clipboard?.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(campaignId);
      setCopyState('Campaign id copied');
      window.setTimeout(() => setCopyState(null), 1600);
    } catch {
      setCopyState('Copy failed');
      window.setTimeout(() => setCopyState(null), 1600);
    }
  };

  const copyManifest = async () => {
    if (!proofPackage || !navigator?.clipboard?.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(proofPackage.manifest);
      setManifestCopyState('Manifest copied');
    } catch {
      setManifestCopyState('Copy failed');
    }

    window.setTimeout(() => setManifestCopyState(null), 1600);
  };

  const exportDistributionFile = () => {
    if (!campaign) {
      return;
    }

    const lines = [
      'wallet,allocation_iflw,share_percent,score,risk_band'
    ];

    allocations.forEach((allocation) => {
      lines.push(
        [
          allocation.wallet,
          allocation.amount,
          allocation.sharePercent,
          allocation.score,
          getAllocationRiskLabel(allocation.score)
        ].join(',')
      );
    });

    downloadTextFile(
      `${campaign.config.name || 'campaign'}-${campaign.id}-distribution.csv`,
      lines.join('\n'),
      'text/csv;charset=utf-8;'
    );
  };

  const exportDecisionAuditFile = () => {
    if (!campaign) {
      return;
    }

    const payload = {
      label: 'Campaign Decision Result',
      campaign: {
        id: campaign.id,
        name: campaign.config.name,
        status: campaign.status,
        snapshotAt: campaign.snapshotAt
      },
      decisionSummary: campaign.decisionSummary ?? null,
      allocationOutput: {
        preview: campaign.preview,
        distributionLogic: distributionLogic,
        allocations: allocations.map((allocation) => ({
          wallet: allocation.wallet,
          allocation_iflw: allocation.amount,
          share_percent: allocation.sharePercent,
          score: allocation.score,
          risk_band: getAllocationRiskLabel(allocation.score)
        }))
      },
      riskAnalysis,
      proofPackage: proofPackage
        ? {
            inputHash: proofPackage.inputHash,
            policyHash: proofPackage.policyHash,
            outputHash: proofPackage.outputHash,
            engineVersion: proofPackage.engineVersion
          }
        : null
    };

    downloadTextFile(
      `${campaign.config.name || 'campaign'}-${campaign.id}-decision-audit.json`,
      JSON.stringify(payload, null, 2),
      'application/json;charset=utf-8;'
    );
  };

  const exportProofArtifact = () => {
    if (!campaign || !proofPackage) {
      return;
    }

    downloadTextFile(
      `${campaign.config.name || 'campaign'}-${campaign.id}-proof-artifact.json`,
      proofPackage.manifest,
      'application/json;charset=utf-8;'
    );
  };

  const exportAssets = useMemo<ExportAsset[]>(() => {
    const assets: ExportAsset[] = [
      {
        label: 'Distribution file',
        title: 'CSV export',
        description: 'Wallet-level distribution output with allocation, score, and risk band.',
        onClick: exportDistributionFile
      },
      {
        label: 'Decision audit file',
        title: 'JSON export',
        description: 'Full decision output for protocol, governance, and ops review.',
        onClick: exportDecisionAuditFile
      }
    ];

    if (proofPackage) {
      assets.push({
        label: 'Proof artifact',
        title: 'Manifest export',
        description: 'Reproducible proof package describing inputs, policy, and output hashes.',
        onClick: exportProofArtifact
      });
    }

    return assets;
  }, [proofPackage, campaign, allocations, distributionLogic, riskAnalysis]);

  if (campaign === undefined) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <LoadingSkeleton lines={8} />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
        <PageHeader
          eyebrow="Campaigns"
          title="Campaign not found"
          subtitle="This campaign id does not exist in local storage."
        />
        <ErrorState
          title="Missing campaign"
          description="Launch a new campaign first, or return to the campaigns registry."
          action={
            <Link
              href="/campaigns"
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
            >
              Back to campaigns
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
      <PageHeader
        eyebrow="Campaign Decision Result"
        title={campaign.config.name}
        subtitle={`Campaign Decision Outcome | Status ${campaign.status} | Snapshot ${formatDateTime(campaign.snapshotAt)}`}
        actions={
          <>
            <button
              type="button"
              onClick={exportCsv}
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/5"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => {
                void copyCampaignId();
              }}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
            >
              Copy campaign id
            </button>
          </>
        }
      />

      {copyState ? (
        <div className="rounded-2xl border border-white/5 bg-background/50 px-4 py-3 text-sm text-slate-300">
          {copyState}
        </div>
      ) : null}

      <Link href="/campaigns" className="text-sm text-slate-400 hover:text-slate-200">
        Back to campaigns
      </Link>

      <div className="rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,23,42,0.82))] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Campaign Decision Result</p>
        <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
          Campaign Decision Outcome
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          This page is structured as a finalized decision artifact: decision summary, allocation
          output, risk analysis, and a proof package for the recorded campaign outcome.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
              Post-decision actions
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Use these actions to finalize delivery, adjust the decision policy, rerun the
              evaluation flow, or export protocol-ready outputs.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/campaigns"
              className="rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-950 transition hover:bg-slate-200"
            >
              Finalize Campaign
            </Link>
            <Link
              href="/demo/proof"
              className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-white/20 hover:bg-white/5 hover:text-white"
            >
              Adjust Criteria
            </Link>
            <Link
              href={`/demo/campaign/${campaign.id}`}
              className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-white/20 hover:bg-white/5 hover:text-white"
            >
              Re-run Evaluation
            </Link>
            <button
              type="button"
              onClick={exportDecisionAuditFile}
              className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-white/20 hover:bg-white/5 hover:text-white"
            >
              Export Results
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        {exportAssets.map((asset) => (
          <div
            key={asset.label}
            className="rounded-2xl border border-white/10 bg-white/5 p-4"
          >
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{asset.label}</p>
            <p className="mt-2 text-lg font-semibold text-white">{asset.title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{asset.description}</p>
            <button
              type="button"
              onClick={asset.onClick}
              className="mt-4 rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-white/20 hover:bg-white/5 hover:text-white"
            >
              Export
            </button>
          </div>
        ))}
      </div>

      <SectionCard
        title="Decision Summary"
        description="Final decision outcomes and automated operator guidance."
        eyebrow="1. Decision Summary"
      >
        <div className="space-y-4">
          <div className="overflow-hidden rounded-3xl border border-emerald-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.22),_transparent_42%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,23,42,0.82))] p-6 shadow-[0_24px_80px_rgba(16,185,129,0.12)]">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/80">
                  Decision Summary
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
                  Campaign decision outcomes
                </p>
                <p className="mt-3 text-sm text-slate-200">
                  {hasPersistedDecisionSummary && campaign.decisionSummary
                    ? `This campaign filtered out ${formatPercent(campaign.decisionSummary.filteredOutPercent)} of wallets as low-quality or risky.`
                    : 'This campaign was launched before decision outcomes were persisted. Eligible and rejected breakdowns are unavailable for this record.'}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Total considered
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {hasPersistedDecisionSummary && campaign.decisionSummary
                    ? campaign.decisionSummary.totalWallets.toLocaleString()
                    : 'Unavailable'}
                </p>
              </div>
            </div>

            {hasPersistedDecisionSummary && campaign.decisionSummary ? (
              <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {[
                  {
                    label: 'Eligible wallets',
                    value: formatDecisionMetric(campaign.decisionSummary.eligibleWallets),
                    tone: 'text-emerald-100'
                  },
                  {
                    label: 'Rejected wallets',
                    value: formatDecisionMetric(campaign.decisionSummary.rejectedWallets),
                    tone: 'text-rose-100'
                  },
                  {
                    label: 'High confidence wallets',
                    value: formatDecisionMetric(campaign.decisionSummary.highConfidenceWallets),
                    tone: 'text-white'
                  },
                  {
                    label: 'Medium confidence wallets',
                    value: formatDecisionMetric(campaign.decisionSummary.mediumConfidenceWallets),
                    tone: 'text-white'
                  },
                  {
                    label: 'High risk / sybil wallets',
                    value: formatDecisionMetric(campaign.decisionSummary.highRiskWallets),
                    tone: 'text-amber-100'
                  }
                ].map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300 backdrop-blur"
                  >
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                      {metric.label}
                    </p>
                    <p className={`mt-2 text-xl font-semibold ${metric.tone}`}>
                      {metric.value}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
                Relaunch or recreate this campaign to persist eligible, rejected, confidence, and
                high-risk wallet outcomes.
              </div>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/5 bg-background/50 p-4 text-sm text-slate-300">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Budget</p>
              <p className="mt-2 text-xl font-semibold text-white">
                {formatAmount(campaign.config.budget)} IFLW
              </p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-background/50 p-4 text-sm text-slate-300">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Eligible</p>
              <p className="mt-2 text-xl font-semibold text-white">
                {campaign.preview.eligibleCount.toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-background/50 p-4 text-sm text-slate-300">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Avg / wallet</p>
              <p className="mt-2 text-xl font-semibold text-white">
                {formatAmount(campaign.preview.estAvg)} IFLW
              </p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-background/50 p-4 text-sm text-slate-300">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Utilization</p>
              <p className="mt-2 text-xl font-semibold text-white">
                {campaign.preview.budgetUtilizationPercent.toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-3">
            {summaryInsights.map((insight) => (
              <div
                key={insight.title}
                className={`rounded-2xl border p-4 text-sm ${insight.toneClassName}`}
              >
                <p className="text-xs uppercase tracking-[0.18em] text-current/70">
                  {insight.title}
                </p>
                <p className="mt-2 leading-6 text-current">{insight.message}</p>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Allocation Output"
        description="Deterministic distribution output and wallet-level rationale."
        eyebrow="2. Allocation Output"
      >
        {topAllocations.length === 0 ? (
          <EmptyState
            title="No allocations"
            description="This campaign has no persisted allocations."
            compact
          />
        ) : (
          <div className="space-y-4">
            <div className="rounded-3xl border border-white/5 bg-background/50 p-5">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/5 bg-black/20 p-4 text-sm text-slate-300">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      Total budget
                    </p>
                    <p className="mt-2 text-xl font-semibold text-white">
                      {formatAmount(campaign.config.budget)} IFLW
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/5 bg-black/20 p-4 text-sm text-slate-300">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      Distribution logic
                    </p>
                    <p className="mt-2 text-xl font-semibold text-white">
                      {distributionLogic?.label ?? 'Unavailable'}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {distributionLogic?.formulaReference}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/5 bg-black/20 p-4 text-sm text-slate-300">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      Wallet bands
                    </p>
                    <p className="mt-2 text-sm text-white">
                      High {bandSummary.High} | Medium {bandSummary.Medium} | Low {bandSummary.Low}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-sky-400/20 bg-sky-500/5 p-4 text-sm text-slate-200">
                  <p className="text-xs uppercase tracking-[0.18em] text-sky-200/80">
                    Fairness and determinism
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">
                    {distributionLogic?.fairnessExplanation}{' '}
                    The output is deterministic because the same stored scores, caps, transform,
                    and rounding rules reproduce the same allocation amounts.
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-xs uppercase tracking-[0.18em] text-slate-400">
                    <th className="px-3 py-2">Wallet</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Share</th>
                    <th className="px-3 py-2">Score</th>
                    <th className="px-3 py-2">Band</th>
                    <th className="px-3 py-2">Why this allocation</th>
                    <th className="px-3 py-2">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {topAllocations.map((allocation) => {
                    const band = getScoreBand(allocation.score);
                    const reason = distributionLogic
                      ? buildAllocationReason(allocation, distributionLogic)
                      : 'Allocation reason unavailable.';

                    return (
                      <tr key={allocation.wallet} className="border-b border-white/5 last:border-0">
                        <td className="px-3 py-3 font-mono text-xs text-slate-200">
                          {allocation.wallet}
                        </td>
                        <td className="px-3 py-3 text-slate-200">
                          <div className="flex flex-col gap-1">
                            <span>{formatAmount(allocation.amount)}</span>
                            <span className="text-xs text-slate-500">
                              {distributionLogic?.formulaReference}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-slate-300">
                          {allocation.sharePercent.toFixed(2)}%
                        </td>
                        <td className="px-3 py-3 text-slate-300">
                          {allocation.score.toFixed(2)}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${getBandClasses(
                              band
                            )}`}
                          >
                            {band}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-300">
                          <span
                            title={reason}
                            className="cursor-help border-b border-dashed border-slate-500 pb-0.5 text-slate-200"
                          >
                            View reason
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-300">
                          {allocation.activeDaysLast14}/14
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Risk Analysis"
        description="Sybil, farming, and decision-confidence signals for this campaign result."
        eyebrow="3. Risk Analysis"
      >
        {riskAnalysis ? (
          <div className="space-y-4">
            <div className="rounded-3xl border border-sky-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_40%),linear-gradient(135deg,rgba(15,23,42,0.94),rgba(15,23,42,0.82))] p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs uppercase tracking-[0.2em] text-sky-200/80">
                    Risk posture
                  </p>
                  <p className="mt-3 text-2xl font-semibold tracking-tight text-white">
                    Campaign risk remains visible, but controlled
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-200">
                    This view summarizes suspected sybil concentration, farming exposure, and how
                    confident the current eligibility decision appears based on the stored campaign
                    output.
                  </p>
                </div>
                <div
                  className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] ${getClusterRiskClasses(
                    riskAnalysis.clusterRiskLevel
                  )}`}
                >
                  Cluster risk {riskAnalysis.clusterRiskLevel}
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    Suspected sybil wallets
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {riskAnalysis.suspectedSybilWallets.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    Farming ratio
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {formatPercent(riskAnalysis.farmingRatio)}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    Cluster risk level
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {riskAnalysis.clusterRiskLevel}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    Decision confidence
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {riskAnalysis.confidenceScore}/100
                  </p>
                </div>
              </div>
            </div>

            {riskAnalysis.farmingRatio > riskAnalysis.warningThreshold ? (
              <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 px-4 py-3 text-sm text-slate-200">
                This campaign contains {formatPercent(riskAnalysis.farmingRatio)} high-risk
                wallets. Consider adjusting eligibility thresholds.
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/5 bg-background/50 p-4 text-sm text-slate-300">
            Risk analysis is unavailable for campaigns launched before decision outcomes were
            persisted.
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Proof Package"
        description="Reproducible artifact describing the exact campaign decision inputs, policy, and output."
        eyebrow="4. Proof Package"
      >
        {proofPackage ? (
          <div className="space-y-4">
            <div className="rounded-3xl border border-sky-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_40%),linear-gradient(135deg,rgba(15,23,42,0.94),rgba(15,23,42,0.82))] p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs uppercase tracking-[0.2em] text-sky-200/80">
                      Decision artifact
                    </span>
                    <span className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-100">
                      Reproducible
                    </span>
                  </div>
                  <p className="mt-3 text-2xl font-semibold tracking-tight text-white">
                    Campaign decision proof package
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-200">
                    This decision can be independently reproduced using the same inputs and policy.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      void copyManifest();
                    }}
                    className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:text-white"
                  >
                    Copy manifest JSON
                  </button>
                  {manifestCopyState ? (
                    <span className="text-xs text-slate-300">{manifestCopyState}</span>
                  ) : null}
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Input hash</p>
                  <p className="mt-2 font-mono text-sm text-white" title={proofPackage.inputHash}>
                    {shortenHash(proofPackage.inputHash)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">Wallet snapshot</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Policy hash</p>
                  <p className="mt-2 font-mono text-sm text-white" title={proofPackage.policyHash}>
                    {shortenHash(proofPackage.policyHash)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">Criteria and allocation policy</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Engine version</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {proofPackage.engineVersion}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">Execution engine</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Output hash</p>
                  <p className="mt-2 font-mono text-sm text-white" title={proofPackage.outputHash}>
                    {shortenHash(proofPackage.outputHash)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">Final decision output</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">JSON manifest</p>
              <pre className="mt-4 max-h-80 overflow-auto rounded-2xl border border-white/10 bg-slate-950/80 p-4 text-xs leading-6 text-sky-100">
                <code>{proofPackage.manifest}</code>
              </pre>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/5 bg-background/50 p-4 text-sm text-slate-300">
            Proof package unavailable for this campaign result.
          </div>
        )}
      </SectionCard>
    </div>
  );
};

export default CampaignDetailPage;
