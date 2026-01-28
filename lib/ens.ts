import { demoApiFetch } from '@/lib/api';
import type { NormalizedWallets } from '@/lib/proofTypes';

type EnsResolveResponse = {
  name: string;
  address: string | null;
  normalized_address: string | null;
  cached: boolean;
  error: string | null;
};

export type EnsBatchResult = {
  resolved: Record<string, { address: string | null; error: string | null; cached: boolean }>;
  unresolved: string[];
};

export type EvaluationWalletMeta = {
  display_name?: string | null;
  input_source: 'ens' | 'address';
  ens_cached?: boolean;
};

export type EvaluationWalletGateResult = {
  wallets: string[];
  invalid: Array<{ value: string; reason: string }>;
  metaByAddress: Map<string, EvaluationWalletMeta>;
  sourcesByAddress: Map<string, { hasEns: boolean; hasAddress: boolean; ensNames: string[] }>;
};

const ADDRESS_REGEX = /^0x[a-f0-9]{40}$/;
const ENS_REGEX = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/;

const createAbortError = () => {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('Aborted', 'AbortError');
  }
  const error = new Error('Aborted');
  return Object.assign(error, { name: 'AbortError' });
};

const isAbortError = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  return (error as Error).name === 'AbortError';
};

const isValidAddress = (value: string) => ADDRESS_REGEX.test(value);

const isValidEns = (value: string) => {
  if (!value.endsWith('.eth')) {
    return false;
  }
  if (value.length < 5 || value.length > 255) {
    return false;
  }
  return ENS_REGEX.test(value);
};

export const normalizeWalletInputs = (rawText: string): NormalizedWallets => {
  const tokens = rawText
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const inputs: NormalizedWallets['inputs'] = [];
  const addresses: string[] = [];
  const ensNames: string[] = [];
  const invalid: string[] = [];
  const mapping: Record<string, { display: string; address?: string }> = {};

  const seenAddresses = new Set<string>();
  const seenEns = new Set<string>();
  const seenInvalid = new Set<string>();

  for (const token of tokens) {
    const normalized = token.toLowerCase();
    if (isValidAddress(normalized)) {
      if (seenAddresses.has(normalized)) {
        continue;
      }
      seenAddresses.add(normalized);
      inputs.push({ raw: token, kind: 'address', normalized });
      addresses.push(normalized);
      mapping[normalized] = { display: normalized, address: normalized };
      continue;
    }

    if (isValidEns(normalized)) {
      if (seenEns.has(normalized)) {
        continue;
      }
      seenEns.add(normalized);
      inputs.push({ raw: token, kind: 'ens', normalized });
      ensNames.push(normalized);
      mapping[normalized] = { display: normalized };
      continue;
    }

    if (!seenInvalid.has(token)) {
      seenInvalid.add(token);
      invalid.push(token);
      inputs.push({ raw: token, kind: 'invalid' });
    }
  }

  return { inputs, addresses, ensNames, invalid, mapping };
};

export const resolveEnsBatch = async (
  ensNames: string[],
  options: { concurrency?: number; signal?: AbortSignal } = {}
): Promise<EnsBatchResult> => {
  const { concurrency = 5, signal } = options;
  const resolved: EnsBatchResult['resolved'] = {};

  if (!ensNames.length) {
    return { resolved, unresolved: [] };
  }

  if (signal?.aborted) {
    throw createAbortError();
  }

  let nextIndex = 0;
  let active = 0;
  let cancelled = false;

  const markCancelled = () => {
    cancelled = true;
  };

  signal?.addEventListener('abort', markCancelled, { once: true });

  return new Promise<EnsBatchResult>((resolve, reject) => {
    const finalize = () => {
      if (cancelled || signal?.aborted) {
        reject(createAbortError());
        return;
      }
      if (active > 0 || nextIndex < ensNames.length) {
        return;
      }
      const unresolved = ensNames.filter((name) => {
        const entry = resolved[name];
        return !entry?.address;
      });
      resolve({ resolved, unresolved });
    };

    const startNext = () => {
      if (cancelled || signal?.aborted) {
        finalize();
        return;
      }

      while (active < concurrency && nextIndex < ensNames.length && !cancelled) {
        const currentName = ensNames[nextIndex];
        nextIndex += 1;
        active += 1;

        demoApiFetch<EnsResolveResponse>(
          `/v1/ens/resolve?name=${encodeURIComponent(currentName)}`,
          { signal }
        )
          .then((payload) => {
            const address =
              payload.normalized_address ??
              (payload.address ? payload.address.toLowerCase() : null);
            resolved[currentName] = {
              address,
              error: payload.error ?? null,
              cached: Boolean(payload.cached)
            };
          })
          .catch((error) => {
            if (signal?.aborted || isAbortError(error)) {
              cancelled = true;
              return;
            }
            resolved[currentName] = {
              address: null,
              error: 'resolver_error',
              cached: false
            };
          })
          .finally(() => {
            active -= 1;
            startNext();
            finalize();
          });
      }
    };

    startNext();
  }).finally(() => {
    signal?.removeEventListener('abort', markCancelled);
  });
};

export const buildEvaluationWallets = (
  inputs: NormalizedWallets['inputs'],
  resolved: EnsBatchResult['resolved']
): EvaluationWalletGateResult => {
  const wallets: string[] = [];
  const seenWallets = new Set<string>();
  const invalid: Array<{ value: string; reason: string }> = [];
  const seenInvalid = new Set<string>();
  const metaByAddress = new Map<string, EvaluationWalletMeta>();
  const sourcesByAddress = new Map<
    string,
    { hasEns: boolean; hasAddress: boolean; ensNames: string[] }
  >();

  const markInvalid = (value: string, reason: string) => {
    const key = `${value}:${reason}`;
    if (seenInvalid.has(key)) {
      return;
    }
    seenInvalid.add(key);
    invalid.push({ value, reason });
  };

  const upsertSource = (address: string, kind: 'ens' | 'address', ensName?: string) => {
    const existing =
      sourcesByAddress.get(address) ?? ({ hasEns: false, hasAddress: false, ensNames: [] } as const);
    const next = { ...existing };
    if (kind === 'ens') {
      next.hasEns = true;
      if (ensName && !next.ensNames.includes(ensName)) {
        next.ensNames.push(ensName);
      }
    } else {
      next.hasAddress = true;
    }
    sourcesByAddress.set(address, next);
  };

  const upsertMeta = (address: string, next: EvaluationWalletMeta) => {
    const existing = metaByAddress.get(address);
    if (!existing) {
      metaByAddress.set(address, next);
      return;
    }
    if (next.display_name && !existing.display_name) {
      existing.display_name = next.display_name;
    }
    if (next.input_source === 'ens') {
      existing.input_source = 'ens';
    }
    existing.ens_cached = Boolean(existing.ens_cached || next.ens_cached);
  };

  const addAddress = (
    address: string,
    meta: EvaluationWalletMeta,
    ensName?: string
  ) => {
    const normalized = address.trim().toLowerCase();
    if (!isValidAddress(normalized)) {
      markInvalid(meta.display_name ?? normalized, 'invalid_address');
      return;
    }
    upsertSource(normalized, meta.input_source, ensName);
    upsertMeta(normalized, { ...meta, display_name: meta.display_name ?? null });
    if (!seenWallets.has(normalized)) {
      seenWallets.add(normalized);
      wallets.push(normalized);
    }
  };

  for (const entry of inputs) {
    if (entry.kind === 'address' && entry.normalized) {
      addAddress(entry.normalized, { display_name: null, input_source: 'address' });
      continue;
    }
    if (entry.kind === 'ens' && entry.normalized) {
      const resolvedEntry = resolved[entry.normalized];
      const address = resolvedEntry?.address;
      if (!address) {
        continue;
      }
      addAddress(
        address,
        {
          display_name: entry.normalized,
          input_source: 'ens',
          ens_cached: resolvedEntry.cached
        },
        entry.normalized
      );
    }
  }

  return { wallets, invalid, metaByAddress, sourcesByAddress };
};
