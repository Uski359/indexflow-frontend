import { demoApiFetch } from '@/lib/api';
import { computeInsightV1 } from '@/lib/insights';

import type { UsageWindow } from '@/lib/types';
import type {
  ProofCommentaryResponse,
  ProofDataSource,
  ProofEvaluateResponse,
  ProofInsightsResponse,
  ProofWalletRow
} from '@/lib/proofTypes';

const DEFAULT_CONCURRENCY = 10;

export const createAbortError = () => {
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
  signal?: AbortSignal,
  criteriaSetId?: string
) => {
  const payloadBase = {
    wallet,
    campaign_id: campaignId,
    window
  };

  if (criteriaSetId) {
    try {
      return await demoApiFetch<ProofEvaluateResponse>('/v1/evaluate', {
        method: 'POST',
        body: JSON.stringify({ ...payloadBase, criteria_set_id: criteriaSetId }),
        signal
      });
    } catch (error) {
      if (isAbortError(error) || !shouldRetryWithoutCriteria(error)) {
        throw error;
      }
    }
  }

  return demoApiFetch<ProofEvaluateResponse>('/v1/evaluate', {
    method: 'POST',
    body: JSON.stringify(payloadBase),
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
  signal?: AbortSignal,
  criteriaSetId?: string
): Promise<ProofWalletRow> => {
  if (signal?.aborted) {
    throw createAbortError();
  }

  try {
    const core = await evaluateWallet(wallet, campaignId, window, signal, criteriaSetId);
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

const toCompletedRowsSnapshot = (
  wallets: string[],
  results: Array<ProofWalletRow | undefined>
) => {
  const completed: ProofWalletRow[] = [];
  for (let i = 0; i < wallets.length; i += 1) {
    const row = results[i];
    if (row) {
      completed.push(row);
    }
  }
  return completed;
};

export type ProofBatchProgress = {
  processed: number;
  total: number;
  rows: ProofWalletRow[];
};

export type ProofBatchOptions = {
  wallets: string[];
  campaignId: string;
  window: UsageWindow;
  apiBase?: string | null;
  signal?: AbortSignal;
  criteriaSetId?: string;
  concurrency?: number;
  onProgress?: (progress: ProofBatchProgress) => void;
};

export const runBatch = async ({
  wallets,
  campaignId,
  window,
  signal,
  criteriaSetId,
  concurrency = DEFAULT_CONCURRENCY,
  onProgress
}: ProofBatchOptions): Promise<ProofWalletRow[]> => {
  if (!wallets.length) {
    return [];
  }

  if (signal?.aborted) {
    throw createAbortError();
  }

  const results: Array<ProofWalletRow | undefined> = new Array(wallets.length);
  const started = new Set<number>();

  let nextIndex = 0;
  let activeCount = 0;
  let processed = 0;
  let cancelled = false;

  const notifyProgress = () => {
    onProgress?.({
      processed,
      total: wallets.length,
      rows: toCompletedRowsSnapshot(wallets, results)
    });
  };

  const markCancelled = () => {
    cancelled = true;
  };

  signal?.addEventListener('abort', markCancelled, { once: true });

  return new Promise<ProofWalletRow[]>((resolve, reject) => {
    const maybeFinish = () => {
      if (!cancelled && nextIndex < wallets.length) {
        return;
      }
      if (activeCount > 0) {
        return;
      }
      if (cancelled || signal?.aborted) {
        reject(createAbortError());
        return;
      }

      const finalized = wallets.map((wallet, index) => {
        const row = results[index];
        if (row) {
          return row;
        }
        return {
          wallet,
          source: 'core' as const,
          error: 'Missing result.'
        };
      });
      resolve(finalized);
    };

    const startNext = () => {
      if (cancelled || signal?.aborted) {
        maybeFinish();
        return;
      }

      while (activeCount < concurrency && nextIndex < wallets.length && !cancelled) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        activeCount += 1;
        started.add(currentIndex);

        runWalletPipeline(
          wallets[currentIndex],
          campaignId,
          window,
          signal,
          criteriaSetId
        )
          .then((row) => {
            results[currentIndex] = row;
          })
          .catch((error) => {
            if (isAbortError(error)) {
              cancelled = true;
              results[currentIndex] = {
                wallet: wallets[currentIndex],
                source: 'core',
                error: 'Canceled'
              };
              return;
            }
            results[currentIndex] = {
              wallet: wallets[currentIndex],
              source: 'core',
              error: getErrorMessage(error)
            };
          })
          .finally(() => {
            activeCount -= 1;
            if (started.has(currentIndex)) {
              processed += 1;
            }
            notifyProgress();
            startNext();
            maybeFinish();
          });
      }
    };

    startNext();
  }).finally(() => {
    signal?.removeEventListener('abort', markCancelled);
  });
};

