import type {
  AllocationTransform,
  CampaignAllocation,
  CampaignAllocationComputation,
  CampaignAllocationPreview,
  CampaignDraft,
  CampaignPreviewParticipant,
  RoundingRule
} from './types';

type ComputePreviewOptions = {
  supportsProofUsageFilter?: boolean;
};

const PARTICIPANT_PREVIEW_LABEL = 'Participant preview';

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

const roundAllocation = (value: number, rule: RoundingRule): number => {
  switch (rule) {
    case 'roundDown':
      return Math.floor(value * 100) / 100;
    case 'roundNearest':
      return Math.round(value * 100) / 100;
    default:
      return value;
  }
};

const transformScore = (score: number, transform: AllocationTransform): number => {
  const safeScore = Math.max(score, 0);

  switch (transform) {
    case 'sqrt':
      return Math.sqrt(safeScore);
    case 'log':
      return Math.log1p(safeScore);
    default:
      return safeScore;
  }
};

const formatPreview = (
  allocations: CampaignAllocation[],
  budget: number,
  effectiveMaxPerWallet: number,
  isEstimated: boolean
): CampaignAllocationPreview => {
  const values = allocations.map((allocation) => allocation.amount);
  const distributedTotal = values.reduce((sum, allocation) => sum + allocation, 0);
  const eligibleCount = allocations.length;
  const sortedAllocations = [...values].sort((a, b) => b - a);
  const topTenTotal = sortedAllocations
    .slice(0, 10)
    .reduce((sum, allocation) => sum + allocation, 0);

  return {
    eligibleCount,
    estAvg: eligibleCount > 0 ? distributedTotal / eligibleCount : 0,
    estMinAfterCap: eligibleCount > 0 ? Math.min(...values) : 0,
    estMaxAfterCap: eligibleCount > 0 ? Math.max(...values) : 0,
    top10SharePercent: distributedTotal > 0 ? (topTenTotal / distributedTotal) * 100 : 0,
    budgetUtilizationPercent:
      budget > 0 ? (Math.min(distributedTotal, budget) / budget) * 100 : 0,
    effectiveMaxPerWallet,
    computedSuccessfully: true,
    isEstimated,
    previewLabel: PARTICIPANT_PREVIEW_LABEL
  };
};

const filterEligibleParticipants = (
  config: CampaignDraft,
  participants: CampaignPreviewParticipant[],
  supportsProofUsageFilter: boolean
): CampaignPreviewParticipant[] => {
  return participants.filter((participant) => {
    if (participant.score < config.minScore) {
      return false;
    }

    if (participant.walletAgeDays < config.walletAgeDays) {
      return false;
    }

    if (participant.activeDaysLast14 < config.activeDaysLast14) {
      return false;
    }

    if (
      supportsProofUsageFilter &&
      typeof config.proofUsageMinEvents === 'number' &&
      (participant.proofUsageEvents ?? 0) < config.proofUsageMinEvents
    ) {
      return false;
    }

    return true;
  });
};

export const computeAllocationPreview = (
  config: CampaignDraft,
  sampleParticipants?: CampaignPreviewParticipant[],
  options?: ComputePreviewOptions
): CampaignAllocationPreview => {
  return computeAllocationPlan(config, sampleParticipants, options).preview;
};

export const computeAllocationPlan = (
  config: CampaignDraft,
  sampleParticipants?: CampaignPreviewParticipant[],
  options?: ComputePreviewOptions
): CampaignAllocationComputation => {
  const supportsProofUsageFilter = options?.supportsProofUsageFilter ?? false;
  const sourceParticipants = sampleParticipants ?? [];
  const hasLiveParticipants = sourceParticipants.length > 0;

  if (
    config.budget <= 0 ||
    config.maxPerWallet <= 0 ||
    config.minPerWallet < 0 ||
    config.minPerWallet > config.maxPerWallet
  ) {
    return {
      allocations: [],
      participants: [],
      preview: {
        eligibleCount: 0,
        estAvg: 0,
        estMinAfterCap: 0,
        estMaxAfterCap: 0,
        top10SharePercent: 0,
        budgetUtilizationPercent: 0,
        effectiveMaxPerWallet: Math.max(config.maxPerWallet, 0),
        computedSuccessfully: false,
        isEstimated: false,
        previewLabel: PARTICIPANT_PREVIEW_LABEL
      }
    };
  }

  if (!hasLiveParticipants) {
    return {
      allocations: [],
      participants: [],
      preview: {
        eligibleCount: 0,
        estAvg: 0,
        estMinAfterCap: 0,
        estMaxAfterCap: 0,
        top10SharePercent: 0,
        budgetUtilizationPercent: 0,
        effectiveMaxPerWallet: Math.max(config.maxPerWallet, 0),
        computedSuccessfully: true,
        isEstimated: false,
        previewLabel: PARTICIPANT_PREVIEW_LABEL
      }
    };
  }

  const eligibleParticipants = filterEligibleParticipants(
    config,
    sourceParticipants,
    supportsProofUsageFilter
  );

  if (eligibleParticipants.length === 0) {
    return {
      allocations: [],
      participants: [],
      preview: {
        eligibleCount: 0,
        estAvg: 0,
        estMinAfterCap: 0,
        estMaxAfterCap: 0,
        top10SharePercent: 0,
        budgetUtilizationPercent: 0,
        effectiveMaxPerWallet: Math.max(config.maxPerWallet, 0),
        computedSuccessfully: true,
        isEstimated: false,
        previewLabel: PARTICIPANT_PREVIEW_LABEL
      }
    };
  }

  const shareCap =
    config.maxSharePercent > 0 ? (config.budget * config.maxSharePercent) / 100 : Number.POSITIVE_INFINITY;
  const effectiveMaxPerWallet = Math.min(config.maxPerWallet, shareCap);
  const upperBound = Number.isFinite(effectiveMaxPerWallet)
    ? effectiveMaxPerWallet
    : config.maxPerWallet;

  const equalPool = (config.budget * config.equalPercent) / 100;
  const weightedPool = Math.max(config.budget - equalPool, 0);
  const transformedWeights = eligibleParticipants.map((participant) =>
    Math.max(transformScore(participant.score, config.transform), 0.0001)
  );
  const totalWeight = transformedWeights.reduce((sum, weight) => sum + weight, 0);

  if (totalWeight <= 0) {
    return {
      allocations: [],
      participants: eligibleParticipants,
      preview: {
        eligibleCount: eligibleParticipants.length,
        estAvg: 0,
        estMinAfterCap: 0,
        estMaxAfterCap: 0,
        top10SharePercent: 0,
        budgetUtilizationPercent: 0,
        effectiveMaxPerWallet: upperBound,
        computedSuccessfully: false,
        isEstimated: false,
        previewLabel: PARTICIPANT_PREVIEW_LABEL
      }
    };
  }

  let distributionValues = eligibleParticipants.map((_, index) => {
    const equalShare = equalPool / eligibleParticipants.length;
    const weightedShare = weightedPool * (transformedWeights[index] / totalWeight);
    const blended = equalShare + weightedShare;
    const clamped = clamp(blended, config.minPerWallet, upperBound);
    return roundAllocation(clamped, config.roundingRule);
  });

  const preliminaryTotal = distributionValues.reduce((sum, allocation) => sum + allocation, 0);
  if (preliminaryTotal > config.budget && preliminaryTotal > 0) {
    const scale = config.budget / preliminaryTotal;
    distributionValues = distributionValues.map((allocation) =>
      roundAllocation(allocation * scale, config.roundingRule)
    );
  }

  const distributedTotal = distributionValues.reduce((sum, allocation) => sum + allocation, 0);
  const allocations = eligibleParticipants.map((participant, index) => {
    const amount = distributionValues[index];
    const sharePercent = distributedTotal > 0 ? (amount / distributedTotal) * 100 : 0;

    return {
      wallet: participant.wallet,
      amount,
      sharePercent,
      score: participant.score,
      walletAgeDays: participant.walletAgeDays,
      activeDaysLast14: participant.activeDaysLast14,
      proofUsageEvents: participant.proofUsageEvents
    };
  });

  return {
    allocations,
    participants: eligibleParticipants,
    preview: formatPreview(allocations, config.budget, upperBound, false)
  };
};
