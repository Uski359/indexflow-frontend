export type UsageWindowType = 'last_7_days' | 'last_14_days' | 'last_30_days' | 'custom';

export type UsageWindow = {
  type: UsageWindowType;
  start: number;
  end: number;
};

export type UsageSummary = {
  days_active: number;
  tx_count: number;
  unique_contracts: number;
};

export type UsageCriteriaParams = {
  min_days_active: number;
  min_tx_count: number;
  min_unique_contracts: number;
};

export type UsageCriteria = {
  criteria_set_id: string;
  engine_version: string;
  params: UsageCriteriaParams;
};

export type UsageProof = {
  hash_algorithm: 'keccak256';
  canonical_hash: string;
};

export type CoreOutputV1 = {
  protocol: string;
  output_version: string;
  wallet: string;
  campaign_id: string;
  window: UsageWindow;
  verified_usage: boolean;
  usage_summary: UsageSummary;
  criteria: UsageCriteria;
  proof: UsageProof;
};

export type CampaignRunItem = {
  wallet: string;
  output: CoreOutputV1;
  cached: boolean;
};

export type CampaignRunSummary = {
  total: number;
  verified_true: number;
  verified_false: number;
  verified_rate: number;
  avg_tx_count: number;
  avg_days_active: number;
  avg_unique_contracts: number;
};

export type CampaignRunResponse = {
  campaign_id?: string;
  window?: UsageWindow;
  results: CampaignRunItem[];
  summary: CampaignRunSummary;
};
