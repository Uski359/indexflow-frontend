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

export type InsightV1 = {
  overall_score: number;
  farming_probability: number;
  behavior_tag: 'organic' | 'suspected_farm' | 'inactive' | 'mixed';
  insight_version: 'v1';
};

export type CommentaryV1 = {
  commentary_version: 'v1';
  model: string;
  text: string;
  created_at: number;
};

export type WalletRowWithInsights = {
  wallet: string;
  display_name?: string | null;
  input_source?: 'ens' | 'address';
  output: CoreOutputV1;
  insights: InsightV1;
  cached_core: boolean;
  cached_insights: boolean;
  commentary?: CommentaryV1;
  cached_commentary?: boolean;
};

export type CampaignRunItem = {
  wallet: string;
  display_name?: string | null;
  input_source?: 'ens' | 'address';
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

export type CampaignInsightsItem = Omit<
  WalletRowWithInsights,
  'commentary' | 'cached_commentary'
>;

export type CampaignInsightsSummary = CampaignRunSummary & {
  suspected_farm_count: number;
  suspected_farm_rate: number;
  avg_score: number;
};

export type CampaignInsightsResponse = {
  campaign_id: string;
  window: UsageWindow;
  results: CampaignInsightsItem[];
  summary: CampaignInsightsSummary;
};

export type CampaignCommentaryItem = WalletRowWithInsights & {
  commentary: CommentaryV1;
  cached_commentary: boolean;
};

export type CampaignCommentaryResponse = {
  campaign_id: string;
  window: UsageWindow;
  results: CampaignCommentaryItem[];
  summary?: CampaignInsightsSummary;
};
