import type { ReadonlyURLSearchParams } from 'next/navigation';

import type {
  ProofFilterState,
  ProofSortBy,
  ProofTagFilter,
  ProofVerifiedFilter
} from '@/app/demo/proof/components/ProofFilters';
import type { ProofWindowType } from '@/lib/proofTypes';

export type CriteriaSetId = 'default' | 'airdrop/basic@1' | 'airdrop/strict@1';

export type ProofUrlState = {
  walletsRaw: string;
  normalizedWallets: string[];
  windowType: ProofWindowType;
  criteriaSetId: CriteriaSetId;
  filters: ProofFilterState;
  autoRun?: boolean;
};

export type ParsedProofUrlState = Partial<
  Pick<ProofUrlState, 'walletsRaw' | 'windowType' | 'criteriaSetId' | 'filters' | 'autoRun'>
>;

const windowTypes: ProofWindowType[] = ['last_7_days', 'last_30_days'];
const enabledCriteriaSetIds: CriteriaSetId[] = ['default'];
const verifiedFilters: ProofVerifiedFilter[] = ['all', 'true', 'false'];
const tagFilters: ProofTagFilter[] = [
  'all',
  'organic',
  'suspected_farm',
  'inactive',
  'mixed'
];
const sortBys: ProofSortBy[] = [
  'score_desc',
  'farm_desc',
  'tx_desc',
  'days_desc',
  'unique_desc',
  'wallet_asc'
];

const isOneOf = <T extends string>(value: string | null, allowed: T[]): value is T => {
  return Boolean(value && allowed.includes(value as T));
};

const parseNumber = (value: string | null, min = 0, max?: number) => {
  if (value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  const clamped = Math.max(min, parsed);
  if (typeof max === 'number') {
    return Math.min(clamped, max);
  }
  return clamped;
};

const parseBooleanFlag = (value: string | null) => {
  return value === '1' || value === 'true';
};

export const serializeProofState = (state: ProofUrlState) => {
  const params = new URLSearchParams();

  const rawWallets = state.walletsRaw ?? '';
  const rawTooLong = rawWallets.length > 1500;
  const normalizedWallets = state.normalizedWallets ?? [];
  const walletsForUrl =
    rawTooLong && normalizedWallets.length ? normalizedWallets.join('\n') : rawWallets;

  if (walletsForUrl) {
    params.set('wallets', walletsForUrl);
    params.set('wallets_mode', rawTooLong ? 'normalized' : 'raw');
  }

  params.set('window', state.windowType);
  params.set('criteria_set', state.criteriaSetId);

  params.set('verified_filter', state.filters.verified);
  params.set('min_tx_count', String(state.filters.minTxCount));
  params.set('min_days_active', String(state.filters.minDaysActive));
  params.set('min_unique_contracts', String(state.filters.minUniqueContracts));
  params.set('min_score', String(state.filters.minScore));
  params.set('max_score', String(state.filters.maxScore));
  params.set('min_farm_percent', String(state.filters.minFarmPercent));
  params.set('max_farm_percent', String(state.filters.maxFarmPercent));
  params.set('insight_tag', state.filters.tag);
  params.set('sort_by', state.filters.sortBy);

  if (state.autoRun) {
    params.set('auto_run', '1');
  }

  return params;
};

export const parseProofState = (
  searchParams: URLSearchParams | ReadonlyURLSearchParams
): ParsedProofUrlState => {
  const wallets = searchParams.get('wallets');
  const windowType = searchParams.get('window');
  const criteriaSetId = searchParams.get('criteria_set');
  const autoRun = searchParams.get('auto_run');

  const next: ParsedProofUrlState = {};

  if (wallets) {
    next.walletsRaw = wallets.replace(/\r\n/g, '\n');
  }

  if (isOneOf(windowType, windowTypes)) {
    next.windowType = windowType;
  }

  if (isOneOf(criteriaSetId, enabledCriteriaSetIds)) {
    next.criteriaSetId = criteriaSetId;
  }

  if (autoRun !== null) {
    next.autoRun = parseBooleanFlag(autoRun);
  }

  const filters: Partial<ProofFilterState> = {};

  const verified = searchParams.get('verified_filter');
  if (isOneOf(verified, verifiedFilters)) {
    filters.verified = verified;
  }

  const minTx = parseNumber(searchParams.get('min_tx_count'));
  if (minTx !== undefined) {
    filters.minTxCount = minTx;
  }

  const minDays = parseNumber(searchParams.get('min_days_active'));
  if (minDays !== undefined) {
    filters.minDaysActive = minDays;
  }

  const minUnique = parseNumber(searchParams.get('min_unique_contracts'));
  if (minUnique !== undefined) {
    filters.minUniqueContracts = minUnique;
  }

  const minScore = parseNumber(searchParams.get('min_score'), 0, 100);
  if (minScore !== undefined) {
    filters.minScore = minScore;
  }

  const maxScore = parseNumber(searchParams.get('max_score'), 0, 100);
  if (maxScore !== undefined) {
    filters.maxScore = maxScore;
  }

  const minFarm = parseNumber(searchParams.get('min_farm_percent'), 0, 100);
  if (minFarm !== undefined) {
    filters.minFarmPercent = minFarm;
  }

  const maxFarm = parseNumber(searchParams.get('max_farm_percent'), 0, 100);
  if (maxFarm !== undefined) {
    filters.maxFarmPercent = maxFarm;
  }

  const tag = searchParams.get('insight_tag');
  if (isOneOf(tag, tagFilters)) {
    filters.tag = tag;
  }

  const sortBy = searchParams.get('sort_by');
  if (isOneOf(sortBy, sortBys)) {
    filters.sortBy = sortBy;
  }

  if (Object.keys(filters).length) {
    next.filters = filters as ProofFilterState;
  }

  return next;
};
