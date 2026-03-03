export const campaignTypes = ['quest', 'airdrop', 'referral', 'custom'] as const;
export const allocationTransforms = ['linear', 'sqrt', 'log'] as const;
export const roundingRules = ['roundDown', 'roundNearest', 'none'] as const;

export type CampaignType = (typeof campaignTypes)[number];
export type AllocationTransform = (typeof allocationTransforms)[number];
export type RoundingRule = (typeof roundingRules)[number];
export type CampaignStatus = 'LIVE';

export type CampaignDraft = {
  name: string;
  type: CampaignType;
  budget: number;
  startDate: string;
  endDate: string;
  maxPerWallet: number;
  minPerWallet: number;
  maxSharePercent: number;
  transform: AllocationTransform;
  equalPercent: number;
  roundingRule: RoundingRule;
  minScore: number;
  walletAgeDays: number;
  activeDaysLast14: number;
  proofUsageMinEvents?: number;
  termsAccepted: boolean;
};

export type CampaignLaunchResult = {
  mode: 'api' | 'simulated' | 'local';
  campaignId: string;
  message: string;
};

export type CampaignChecklistStatus = 'complete' | 'current' | 'pending';

export type CampaignChecklistItem = {
  label: string;
  status: CampaignChecklistStatus;
  helper: string;
};

export type CampaignPreviewParticipant = {
  wallet: string;
  score: number;
  walletAgeDays: number;
  activeDaysLast14: number;
  proofUsageEvents?: number;
};

export type CampaignAllocation = {
  wallet: string;
  amount: number;
  sharePercent: number;
  score: number;
  walletAgeDays: number;
  activeDaysLast14: number;
  proofUsageEvents?: number;
};

export type CampaignAllocationPreview = {
  eligibleCount: number;
  estAvg: number;
  estMinAfterCap: number;
  estMaxAfterCap: number;
  top10SharePercent: number;
  budgetUtilizationPercent: number;
  effectiveMaxPerWallet: number;
  computedSuccessfully: boolean;
  isEstimated: boolean;
  previewLabel: string;
};

export type CampaignAllocationComputation = {
  allocations: CampaignAllocation[];
  participants: CampaignPreviewParticipant[];
  preview: CampaignAllocationPreview;
};

export type CampaignRecord = {
  id: string;
  status: CampaignStatus;
  snapshotAt: string;
  createdAt: string;
  config: CampaignDraft;
  preview: CampaignAllocationPreview;
};

export type LaunchYourCampaignCardProps = {
  participants?: CampaignPreviewParticipant[];
  supportsProofUsageFilter?: boolean;
};
