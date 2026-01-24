import type {
  ActivityStats,
  Contribution,
  ContributionLeaderboardEntry,
  GlobalStakingStats,
  HolderCount,
  IndexerHealth,
  Proof,
  StakingUser,
  SupplyStat,
  ThroughputStats,
  Transfer
} from '@/types';

const getApiBaseUrl = () => {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
  const trimmed = base.trim();
  if (!trimmed) {
    throw new Error(
      'NEXT_PUBLIC_API_BASE_URL is not set. Add it to your frontend environment.'
    );
  }
  return trimmed;
};

const buildApiUrl = (path: string, baseUrl: string) => {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return new URL(normalizedPath, normalizedBase).toString();
};

export const api = (path: string, init?: RequestInit) => {
  const baseUrl = getApiBaseUrl();
  return fetch(buildApiUrl(path, baseUrl), { cache: 'no-store', ...init }).then(
    (res) => {
      if (!res.ok) {
        throw new Error(`API ${res.status} for ${path}`);
      }
      return res.json();
    }
  );
};

const withParams = (
  path: string,
  params?: Record<string, string | number | boolean | null | undefined>
) => {
  const url = new URL(path.startsWith('/') ? path : `/${path}`, 'http://localhost');
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return `${url.pathname}${url.search}`;
};

const unwrap = <T>(payload: unknown): T => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
};

const normalizeHealth = (value: unknown): IndexerHealth => {
  const payload = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;

  return {
    chain: (payload.chain as string) ?? 'unknown',
    latestIndexedBlock:
      (payload.latestIndexedBlock as number | null | undefined) ??
      (payload.latestBlock as number | null | undefined) ??
      (payload.latest as number | null | undefined) ??
      null,
    providerBlock:
      (payload.providerBlock as number | null | undefined) ??
      (payload.provider as number | null | undefined) ??
      null,
    synced: Boolean(payload.synced ?? payload.ok ?? false)
  };
};

export const fetchRecentTransfers = async (options?: {
  chain?: string;
  limit?: number;
  address?: string;
}): Promise<Transfer[]> => {
  const { chain, limit, address } = options ?? {};

  type RawTransfer = {
    chain?: string;
    chainId?: string | number;
    blockNumber?: number;
    block?: number;
    txHash?: string;
    hash?: string;
    from?: string;
    to?: string;
    value?: string | number;
    amount?: string | number;
    transferValue?: string | number;
    timestamp?: number;
  };

  const chainIdToName: Record<string, string> = {
    "1": "ethereum",
    "10": "optimism",
    "56": "bsc",
    "137": "polygon",
    "42161": "arbitrum",
    "8453": "base",
    "11155111": "sepolia"
  };

  const normalizeTransfer = (item: RawTransfer): Transfer => {
    const chainName =
      item.chain ?? chainIdToName[String(item.chainId ?? "")] ?? (chain ?? "ethereum");

    const valueRaw = item.value ?? item.amount ?? item.transferValue ?? "";
    const timestampRaw = item.timestamp;
    const timestamp =
      typeof timestampRaw === "number"
        ? timestampRaw < 1e12
          ? timestampRaw * 1000
          : timestampRaw
        : undefined;

    return {
      chain: chainName,
      blockNumber: item.blockNumber ?? item.block,
      block: item.block,
      txHash: item.txHash ?? item.hash ?? "",
      from: item.from ?? "",
      to: item.to ?? "",
      value: typeof valueRaw === "string" ? valueRaw : valueRaw?.toString?.() ?? "",
      timestamp
    };
  };

  if (address) {
    const byAddress = await api(
      withParams(`/api/transfers/${encodeURIComponent(address)}`, { chain })
    );
    return unwrap<RawTransfer[]>(byAddress).map(normalizeTransfer);
  }

  const candidates = [
    withParams('/recent', { chain, limit }),
    withParams('/transfers/recent', { chain, limit }),
    withParams('/api/transfers/latest', { chain, limit })
  ];

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const result = await api(candidate);
      const transfers = unwrap<RawTransfer[]>(result).map(normalizeTransfer);
      return typeof limit === 'number' ? transfers.slice(0, limit) : transfers;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('Failed to fetch transfers');
};

export const fetchHolderCount = async (chain?: string): Promise<HolderCount> => {
  const candidates = [
    withParams('/api/holders', { chain }),
    withParams('/api/stats/holders', { chain })
  ];

  for (const candidate of candidates) {
    try {
      const result = await api(candidate);
      return unwrap<HolderCount>(result);
    } catch (error) {
      // try the next candidate
    }
  }

  throw new Error('Failed to fetch holder count');
};

export const fetchSupply = async (chain?: string): Promise<SupplyStat> => {
  const candidates = [
    withParams('/api/supply', { chain }),
    withParams('/api/stats/supply', { chain })
  ];

  for (const candidate of candidates) {
    try {
      const result = await api(candidate);
      return unwrap<SupplyStat>(result);
    } catch (error) {
      // try the next candidate
    }
  }

  throw new Error('Failed to fetch supply data');
};

export const fetchActivityStats = async (chain?: string): Promise<ActivityStats> => {
  const result = await api(withParams('/api/stats/activity', { chain }));
  return unwrap<ActivityStats>(result);
};

export const fetchThroughputStats = async (
  chain?: string
): Promise<ThroughputStats> => {
  const result = await api(withParams('/api/stats/throughput', { chain }));
  return unwrap<ThroughputStats>(result);
};

export const fetchHealth = async (chain?: string): Promise<IndexerHealth> => {
  const candidates = [
    withParams('/health', { chain }),
    withParams('/latest-block', { chain }),
    withParams('/api/health', { chain })
  ];

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const raw = await api(candidate);
      const payload = unwrap<unknown>(raw);

      if (
        payload &&
        typeof payload === 'object' &&
        ('latestIndexedBlock' in payload ||
          'latestBlock' in payload ||
          'providerBlock' in payload ||
          'synced' in payload)
      ) {
        return normalizeHealth(payload);
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('Failed to fetch indexer health');
};

export const fetchGlobalStaking = async (chain?: string): Promise<GlobalStakingStats> => {
  const result = await api(withParams('/api/staking/global', { chain }));
  return unwrap<GlobalStakingStats>(result);
};

export const fetchUserStaking = async (
  address: string,
  chain?: string
): Promise<StakingUser> => {
  const result = await api(
    withParams(`/api/staking/user/${encodeURIComponent(address)}`, { chain })
  );
  return unwrap<StakingUser>(result);
};

export const fetchRecentProofs = async (chain?: string): Promise<Proof[]> => {
  const result = await api(withParams('/api/poi/recent', { chain }));
  return unwrap<Proof[]>(result);
};

export const fetchOperatorProofs = async (
  address: string,
  chain?: string
): Promise<Proof[]> => {
  const result = await api(
    withParams(`/api/poi/operator/${encodeURIComponent(address)}`, { chain })
  );
  return unwrap<Proof[]>(result);
};

export const fetchContributionLeaderboard = async (
  limit = 10
): Promise<ContributionLeaderboardEntry[]> => {
  const result = await api(withParams('/api/contributions/leaderboard', { limit }));
  return unwrap<ContributionLeaderboardEntry[]>(result);
};

export const fetchUserContributions = async (
  address: string,
  chain?: string
): Promise<Contribution[]> => {
  const result = await api(
    withParams(`/api/contributions/user/${encodeURIComponent(address)}`, { chain })
  );
  return unwrap<Contribution[]>(result);
};

export const getDemoApiBaseUrl = () => {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
  const trimmed = base.trim();
  return trimmed.length ? trimmed : null;
};

export const demoApiFetch = async <T>(
  path: string,
  options: RequestInit = {}
): Promise<T> => {
  const baseUrl = getDemoApiBaseUrl();
  if (!baseUrl) {
    throw new Error(
      'NEXT_PUBLIC_API_BASE_URL is not set. Add it to your frontend environment.'
    );
  }

  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const isDev = process.env.NODE_ENV !== 'production';
  const url = buildApiUrl(path, baseUrl);
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers
    });
  } catch (error) {
    if (isDev) {
      console.error(`[demo] request failed ${path}`, error);
    }
    throw error;
  }

  if (isDev) {
    console.info(`[demo] ${res.status} ${path}`);
  }

  if (!res.ok) {
    const text = await res.text();
    const detail = text ? ` ${text}` : '';
    if (isDev) {
      console.warn(`[demo] ${res.status} ${path}${detail}`);
    }
    throw new Error(`Request failed (${res.status}).${detail}`);
  }

  return (await res.json()) as T;
};
