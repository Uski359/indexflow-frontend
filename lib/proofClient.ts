import { demoApiFetch } from '@/lib/api';
import { computeInsightV1 } from '@/lib/insights';
import type { UsageWindow } from '@/lib/types';

import { isAbortError, runBatch } from './proofRunner';
import type {
  NormalizedWallets,
  ProofCampaignCommentaryResponse,
  ProofCampaignInsightsResponse,
  ProofCampaignRunResponse,
  ProofDataSource,
  ProofRunOptions,
  ProofRunResult,
  ProofWalletRow,
  ProofWindowType
} from './proofTypes';

const addressRegex = /^0x[a-f0-9]{40}$/;

const windowSeconds: Record<ProofWindowType, number> = {
  last_7_days: 7 * 24 * 60 * 60,
  last_30_days: 30 * 24 * 60 * 60
};

export { isAbortError } from './proofRunner';

export const buildUsageWindow = (type: ProofWindowType): UsageWindow => {
  const end = Math.floor(Date.now() / 1000);
  const start = end - windowSeconds[type];
  return { type, start, end };
};

export const normalizeWalletInput = (input: string): NormalizedWallets => {
  const tokens = input
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    const normalized = token.toLowerCase();
    if (!addressRegex.test(normalized)) {
      invalid.push(token);
      continue;
    }
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    valid.push(normalized);
  }

  return { valid, invalid };
};

export const fetchMockWallets = async (
  campaignId: string,
  count: number,
  signal?: AbortSignal
) => {
  return demoApiFetch<string[]>(
    `/v1/campaign/${campaignId}/mock-wallets?count=${count}`,
    { signal }
  );
};

const buildSourceFromRows = (rows: ProofWalletRow[]): ProofDataSource => {
  if (rows.some((row) => row.source === 'commentary')) {
    return 'commentary';
  }
  if (rows.some((row) => row.source === 'insights')) {
    return 'insights';
  }
  return 'core';
};

const mapCampaignCommentary = (
  result: ProofCampaignCommentaryResponse
): ProofWalletRow[] => {
  return result.results.map((entry) => ({
    wallet: entry.wallet,
    output: entry.output,
    insights: entry.insights,
    commentary: entry.commentary,
    cached_core: entry.cached_core,
    cached_insights: entry.cached_insights,
    cached_commentary: entry.cached_commentary,
    source: 'commentary'
  }));
};

const mapCampaignInsights = (result: ProofCampaignInsightsResponse): ProofWalletRow[] => {
  return result.results.map((entry) => ({
    wallet: entry.wallet,
    output: entry.output,
    insights: entry.insights,
    cached_core: entry.cached_core,
    cached_insights: entry.cached_insights,
    source: 'insights'
  }));
};

const mapCampaignRun = (result: ProofCampaignRunResponse): ProofWalletRow[] => {
  return result.results.map((entry) => ({
    wallet: entry.wallet,
    output: entry.output,
    insights: computeInsightV1(entry.output),
    cached_core: entry.cached,
    cached_insights: false,
    source: 'core'
  }));
};

const getStatusCodeFromError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return null;
  }
  const match = error.message.match(/Request failed \((\d+)\)/);
  if (!match) {
    return null;
  }
  const status = Number(match[1]);
  return Number.isFinite(status) ? status : null;
};

const shouldRetryWithoutCriteria = (error: unknown) => {
  const status = getStatusCodeFromError(error);
  return status !== null && status >= 400 && status < 500;
};

const reorderRowsByWallets = (
  wallets: string[],
  rows: ProofWalletRow[],
  missingSource: ProofDataSource
) => {
  const byWallet = new Map<string, ProofWalletRow>();
  for (const row of rows) {
    const key = row.wallet.toLowerCase();
    byWallet.set(key, { ...row, wallet: key });
  }

  return wallets.map((wallet) => {
    const existing = byWallet.get(wallet);
    if (existing) {
      return existing;
    }
    return {
      wallet,
      source: missingSource,
      error: 'Missing result.'
    };
  });
};

export const runProofEvaluation = async ({
  wallets,
  campaignId,
  window,
  criteriaSetId,
  signal,
  onProgress
}: ProofRunOptions): Promise<ProofRunResult> => {
  if (!wallets.length) {
    return { rows: [], source: 'core' };
  }

  const payloadBase = {
    campaign_id: campaignId,
    window,
    wallets,
    mode: 'sync' as const
  };

  const buildPayload = (includeCriteria: boolean) => {
    if (includeCriteria && criteriaSetId) {
      return { ...payloadBase, criteria_set_id: criteriaSetId };
    }
    return payloadBase;
  };

  const tryCampaignEndpoint = async <T>(
    path: string,
    mapper: (result: T) => ProofWalletRow[],
    source: ProofDataSource
  ): Promise<ProofRunResult | null> => {
    const runRequest = async (includeCriteria: boolean) => {
      const payload = buildPayload(includeCriteria);
      const result = await demoApiFetch<T>(path, {
        method: 'POST',
        body: JSON.stringify(payload),
        signal
      });
      const mapped = mapper(result);
      const ordered = reorderRowsByWallets(wallets, mapped, source);
      onProgress?.({ processed: wallets.length, total: wallets.length, rows: ordered });
      return { rows: ordered, source: buildSourceFromRows(ordered) } satisfies ProofRunResult;
    };

    if (criteriaSetId) {
      try {
        return await runRequest(true);
      } catch (error) {
        if (isAbortError(error)) {
          throw error;
        }
        if (!shouldRetryWithoutCriteria(error)) {
          return null;
        }
      }
    }

    try {
      return await runRequest(false);
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      return null;
    }
  };

  const commentaryResult = await tryCampaignEndpoint<ProofCampaignCommentaryResponse>(
    '/v1/campaign/commentary',
    mapCampaignCommentary,
    'commentary'
  );
  if (commentaryResult) {
    return commentaryResult;
  }

  const insightsResult = await tryCampaignEndpoint<ProofCampaignInsightsResponse>(
    '/v1/campaign/insights',
    mapCampaignInsights,
    'insights'
  );
  if (insightsResult) {
    return insightsResult;
  }

  const runResult = await tryCampaignEndpoint<ProofCampaignRunResponse>(
    '/v1/campaign/run',
    mapCampaignRun,
    'core'
  );
  if (runResult) {
    return runResult;
  }

  const rows = await runBatch({
    wallets,
    campaignId,
    window,
    signal,
    criteriaSetId,
    onProgress
  });

  const source = buildSourceFromRows(rows);
  onProgress?.({ processed: wallets.length, total: wallets.length, rows });
  return { rows, source };
};
