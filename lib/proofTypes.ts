import type {
  CampaignCommentaryResponse,
  CampaignInsightsResponse,
  CampaignRunResponse,
  CommentaryV1,
  CoreOutputV1,
  InsightV1,
  UsageWindow
} from './types';

export type ProofWindowType = 'last_7_days' | 'last_30_days';

export type ProofDataSource = 'commentary' | 'insights' | 'core';

export type ProofWalletRow = {
  wallet: string;
  output?: CoreOutputV1;
  insights?: InsightV1;
  commentary?: CommentaryV1;
  cached_core?: boolean;
  cached_insights?: boolean;
  cached_commentary?: boolean;
  source: ProofDataSource;
  error?: string;
};

export type ProofSummary = {
  total: number;
  verified_true: number;
  verified_false: number;
  verified_rate: number;
  avg_tx_count: number;
  avg_days_active: number;
  avg_unique_contracts: number;
  suspected_farm_count: number;
  suspected_farm_rate: number;
  avg_score: number;
};

export type ProofEvaluateResponse = {
  output: CoreOutputV1;
  cached: boolean;
};

export type ProofInsightsResponse = {
  insights: InsightV1;
  cached: boolean;
};

export type ProofCommentaryResponse = {
  commentary: CommentaryV1;
  cached: boolean;
};

export type ProofCampaignCommentaryResponse = CampaignCommentaryResponse;
export type ProofCampaignInsightsResponse = CampaignInsightsResponse;
export type ProofCampaignRunResponse = CampaignRunResponse;

export type NormalizedWallets = {
  valid: string[];
  invalid: string[];
};

export type ProofRunResult = {
  rows: ProofWalletRow[];
  source: ProofDataSource;
};

export type ProofRunOptions = {
  wallets: string[];
  campaignId: string;
  window: UsageWindow;
  signal?: AbortSignal;
  onProgress?: (processed: number) => void;
};
