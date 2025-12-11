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

const API_BASE =
  (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');

export const api = (path: string, init?: RequestInit) =>
  fetch(`${API_BASE}${path}`, { cache: 'no-store', ...init }).then((res) => {
    if (!res.ok) {
      throw new Error(`API ${res.status} for ${path}`);
    }
    return res.json();
  });

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

const normalizeHealth = (value: any): IndexerHealth => ({
  chain: value?.chain ?? 'unknown',
  latestIndexedBlock:
    value?.latestIndexedBlock ?? value?.latestBlock ?? value?.latest ?? null,
  providerBlock: value?.providerBlock ?? value?.provider ?? null,
  synced: Boolean(value?.synced ?? value?.ok ?? false)
});

export const fetchRecentTransfers = async (options?: {
  chain?: string;
  limit?: number;
  address?: string;
}): Promise<Transfer[]> => {
  const { chain, limit, address } = options ?? {};

  if (address) {
    const byAddress = await api(
      withParams(`/api/transfers/${encodeURIComponent(address)}`, { chain })
    );
    return unwrap<Transfer[]>(byAddress);
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
      const transfers = unwrap<Transfer[]>(result);
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
      const payload = unwrap<any>(raw);

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
