import { demoApiFetch } from '@/lib/api';
import { computeInsightV1 } from '@/lib/insights';
import type { UsageWindow } from '@/lib/types';

import type {
  NormalizedWallets,
  ProofCampaignCommentaryResponse,
  ProofCampaignInsightsResponse,
  ProofCampaignRunResponse,
  ProofCommentaryResponse,
  ProofDataSource,
  ProofEvaluateResponse,
  ProofInsightsResponse,
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

const createAbortError = () => {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('Aborted', 'AbortError');
  }
  const error = new Error('Aborted');
  return Object.assign(error, { name: 'AbortError' });
};

export const isAbortError = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  return (error as Error).name === 'AbortError';
};

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

const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  onProgress?: (processed: number) => void,
  signal?: AbortSignal
): Promise<R[]> => {
  if (items.length === 0) {
    return [];
  }

  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  let completed = 0;

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    const runNext = () => {
      if (signal?.aborted) {
        reject(createAbortError());
        return;
      }

      if (nextIndex >= items.length) {
        if (completed >= items.length) {
          resolve(results);
        }
        return;
      }

      const currentIndex = nextIndex;
      nextIndex += 1;

      worker(items[currentIndex], currentIndex)
        .then((result) => {
          results[currentIndex] = result;
        })
        .catch((error) => {
          if (isAbortError(error)) {
            reject(error);
            return;
          }
          reject(error);
        })
        .finally(() => {
          completed += 1;
          onProgress?.(completed);
          if (completed >= items.length) {
            resolve(results);
            return;
          }
          runNext();
        });
    };

    const initial = Math.min(limit, items.length);
    for (let i = 0; i < initial; i += 1) {
      runNext();
    }
  });
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

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected error.';
};

const evaluateWallet = async (
  wallet: string,
  campaignId: string,
  window: UsageWindow,
  signal?: AbortSignal
) => {
  return demoApiFetch<ProofEvaluateResponse>('/v1/evaluate', {
    method: 'POST',
    body: JSON.stringify({
      wallet,
      campaign_id: campaignId,
      window
    }),
    signal
  });
};

const fetchInsights = async (output: ProofEvaluateResponse['output'], signal?: AbortSignal) => {
  return demoApiFetch<ProofInsightsResponse>('/v1/insights', {
    method: 'POST',
    body: JSON.stringify({ output }),
    signal
  });
};

const fetchCommentary = async (
  output: ProofEvaluateResponse['output'],
  insights: ProofInsightsResponse['insights'],
  signal?: AbortSignal
) => {
  return demoApiFetch<ProofCommentaryResponse>('/v1/commentary', {
    method: 'POST',
    body: JSON.stringify({ output, insights }),
    signal
  });
};

const runWalletPipeline = async (
  wallet: string,
  campaignId: string,
  window: UsageWindow,
  signal?: AbortSignal
): Promise<ProofWalletRow> => {
  try {
    const core = await evaluateWallet(wallet, campaignId, window, signal);
    let insights = computeInsightV1(core.output);
    let cachedInsights = false;
    let source: ProofDataSource = 'core';

    try {
      const insightResult = await fetchInsights(core.output, signal);
      insights = insightResult.insights;
      cachedInsights = insightResult.cached;
      source = 'insights';
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
    }

    let commentary: ProofCommentaryResponse['commentary'] | undefined;
    let cachedCommentary: boolean | undefined;
    try {
      const commentaryResult = await fetchCommentary(core.output, insights, signal);
      commentary = commentaryResult.commentary;
      cachedCommentary = commentaryResult.cached;
      source = 'commentary';
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
    }

    return {
      wallet,
      output: core.output,
      insights,
      commentary,
      cached_core: core.cached,
      cached_insights: cachedInsights,
      cached_commentary: cachedCommentary,
      source
    };
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    return {
      wallet,
      source: 'core',
      error: getErrorMessage(error)
    };
  }
};

export const runProofEvaluation = async ({
  wallets,
  campaignId,
  window,
  signal,
  onProgress
}: ProofRunOptions): Promise<ProofRunResult> => {
  if (!wallets.length) {
    return { rows: [], source: 'core' };
  }

  const payload = {
    campaign_id: campaignId,
    window,
    wallets,
    mode: 'sync' as const
  };

  try {
    const result = await demoApiFetch<ProofCampaignCommentaryResponse>(
      '/v1/campaign/commentary',
      {
        method: 'POST',
        body: JSON.stringify(payload),
        signal
      }
    );
    onProgress?.(wallets.length);
    return { rows: mapCampaignCommentary(result), source: 'commentary' };
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
  }

  try {
    const result = await demoApiFetch<ProofCampaignInsightsResponse>('/v1/campaign/insights', {
      method: 'POST',
      body: JSON.stringify(payload),
      signal
    });
    onProgress?.(wallets.length);
    return { rows: mapCampaignInsights(result), source: 'insights' };
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
  }

  try {
    const result = await demoApiFetch<ProofCampaignRunResponse>('/v1/campaign/run', {
      method: 'POST',
      body: JSON.stringify(payload),
      signal
    });
    onProgress?.(wallets.length);
    return { rows: mapCampaignRun(result), source: 'core' };
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
  }

  const rows = await mapWithConcurrency(
    wallets,
    10,
    (wallet) => runWalletPipeline(wallet, campaignId, window, signal),
    onProgress,
    signal
  );

  return { rows, source: buildSourceFromRows(rows) };
};
