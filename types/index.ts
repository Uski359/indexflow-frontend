export type Transfer = {
  chain: string;
  blockNumber?: number;
  block?: number;
  txHash: string;
  from: string;
  to: string;
  value: string;
  timestamp?: number;
  logIndex?: number;
};

export type HolderCount = {
  totalHolders: number;
};

export type SupplyStat = {
  totalSupply: number;
};

export type ActivityPoint = {
  timestamp: string | number;
  count: number;
};

export type ActivityStats = {
  volume24h: number;
  transferCount24h?: number;
  series: ActivityPoint[];
};

export type ThroughputStats = {
  transferCount24h: number;
};

export type IndexerHealth = {
  chain: string;
  latestIndexedBlock: number | null;
  providerBlock: number | null;
  synced: boolean;
};

export type StakingUser = {
  totalStaked: string;
  totalUnstaked: string;
  netStaked: string;
  totalRewardsClaimed: string;
};

export type GlobalStakingStats = {
  totalStakers: number;
  totalStaked: string;
  totalRewardsDistributed: string;
  netStaked: string;
};

export type Proof = {
  chain: string;
  operator: string;
  chainId: string;
  fromBlock: number;
  toBlock: number;
  proofHash: string;
  timestamp: number;
  block: number;
  txHash: string;
};

export type Contribution = {
  chain: string;
  user: string;
  contributionType: string;
  weight: string;
  timestamp: number;
  txHash: string;
  block: number;
};

export type ContributionLeaderboardEntry = {
  user: string;
  totalWeight: string;
};
