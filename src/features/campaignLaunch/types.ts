export const campaignTypes = ['quest', 'airdrop', 'referral', 'custom'] as const;

export type CampaignType = (typeof campaignTypes)[number];

export type CampaignDraft = {
  name: string;
  type: CampaignType;
  budget: number;
  startDate: string;
  endDate: string;
  termsAccepted: boolean;
};

export type CampaignLaunchResult = {
  mode: 'api' | 'simulated';
  campaignId: string;
  message: string;
};

export type CampaignChecklistStatus = 'complete' | 'current' | 'pending';

export type CampaignChecklistItem = {
  label: string;
  status: CampaignChecklistStatus;
  helper: string;
};
