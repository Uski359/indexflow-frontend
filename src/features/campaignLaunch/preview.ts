import type {
  AllocationTransform,
  CampaignAllocationPreview,
  CampaignDraft,
  CampaignPreviewParticipant,
  RoundingRule
} from './types';

type ComputePreviewOptions = {
  supportsProofUsageFilter?: boolean;
};

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
  allocations: number[],
  budget: number,
  effectiveMaxPerWallet: number,
  isEstimated: boolean
): CampaignAllocationPreview => {
  const distributedTotal = allocations.reduce((sum, allocation) => sum + allocation, 0);
  const eligibleCount = allocations.length;
  const sortedAllocations = [...allocations].sort((a, b) => b - a);
  const topTenTotal = sortedAllocations.slice(0, 10).reduce((sum, allocation) => sum + allocation, 0);

  return {
    eligibleCount,
    estAvg: eligibleCount > 0 ? distributedTotal / eligibleCount : 0,
    estMinAfterCap: eligibleCount > 0 ? Math.min(...allocations) : 0,
    estMaxAfterCap: eligibleCount > 0 ? Math.max(...allocations) : 0,
    top10SharePercent: distributedTotal > 0 ? (topTenTotal / distributedTotal) * 100 : 0,
    budgetUtilizationPercent: budget > 0 ? (Math.min(distributedTotal, budget) / budget) * 100 : 0,
    effectiveMaxPerWallet,
    computedSuccessfully: true,
    isEstimated,
    previewLabel: isEstimated ? 'Preview estimate' : 'Live participant preview'
  };
};

export const generatePreviewParticipants = (count = 1000): CampaignPreviewParticipant[] => {
  return Array.from({ length: count }, (_, index) => {
    const rank = count - index;
    const score = Math.max(5, Math.round(Math.pow(rank, 0.72) * 6 + (index % 11)));
    const walletAgeDays = 20 + ((index * 17) % 900);
    const activeDaysLast14 = Math.min(14, Math.max(1, Math.round(score / 20) + (index % 4)));
    const proofUsageEvents = Math.max(1, Math.round(score * 0.55) + (index % 6));

    return {
      wallet: `0x${String(index + 1).padStart(40, '0')}`,
      score,
      walletAgeDays,
      activeDaysLast14,
      proofUsageEvents
    };
  });
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
  const supportsProofUsageFilter = options?.supportsProofUsageFilter ?? false;
  const hasLiveParticipants = Boolean(sampleParticipants?.length);
  const sourceParticipants =
    sampleParticipants && sampleParticipants.length > 0
      ? sampleParticipants
      : generatePreviewParticipants();

  if (
    config.budget <= 0 ||
    config.maxPerWallet <= 0 ||
    config.minPerWallet < 0 ||
    config.minPerWallet > config.maxPerWallet
  ) {
    return {
      eligibleCount: 0,
      estAvg: 0,
      estMinAfterCap: 0,
      estMaxAfterCap: 0,
      top10SharePercent: 0,
      budgetUtilizationPercent: 0,
      effectiveMaxPerWallet: Math.max(config.maxPerWallet, 0),
      computedSuccessfully: false,
      isEstimated: !hasLiveParticipants,
      previewLabel: hasLiveParticipants ? 'Live participant preview' : 'Preview estimate'
    };
  }

  const eligibleParticipants = filterEligibleParticipants(
    config,
    sourceParticipants,
    supportsProofUsageFilter
  );

  if (eligibleParticipants.length === 0) {
    return {
      eligibleCount: 0,
      estAvg: 0,
      estMinAfterCap: 0,
      estMaxAfterCap: 0,
      top10SharePercent: 0,
      budgetUtilizationPercent: 0,
      effectiveMaxPerWallet: Math.max(config.maxPerWallet, 0),
      computedSuccessfully: true,
      isEstimated: !hasLiveParticipants,
      previewLabel: hasLiveParticipants ? 'Live participant preview' : 'Preview estimate'
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
      eligibleCount: eligibleParticipants.length,
      estAvg: 0,
      estMinAfterCap: 0,
      estMaxAfterCap: 0,
      top10SharePercent: 0,
      budgetUtilizationPercent: 0,
      effectiveMaxPerWallet: upperBound,
      computedSuccessfully: false,
      isEstimated: !hasLiveParticipants,
      previewLabel: hasLiveParticipants ? 'Live participant preview' : 'Preview estimate'
    };
  }

  let allocations = eligibleParticipants.map((_, index) => {
    const equalShare = equalPool / eligibleParticipants.length;
    const weightedShare = weightedPool * (transformedWeights[index] / totalWeight);
    const blended = equalShare + weightedShare;
    const clamped = clamp(blended, config.minPerWallet, upperBound);
    return roundAllocation(clamped, config.roundingRule);
  });

  const preliminaryTotal = allocations.reduce((sum, allocation) => sum + allocation, 0);
  if (preliminaryTotal > config.budget && preliminaryTotal > 0) {
    const scale = config.budget / preliminaryTotal;
    allocations = allocations.map((allocation) =>
      roundAllocation(allocation * scale, config.roundingRule)
    );
  }

  return formatPreview(allocations, config.budget, upperBound, !hasLiveParticipants);
};
