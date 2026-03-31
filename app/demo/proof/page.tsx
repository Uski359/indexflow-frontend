'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';

import ErrorState from '@/components/ui/ErrorState';
import PageHeader from '@/components/ui/PageHeader';
import { demoApiFetch, getDemoApiBaseUrl } from '@/lib/api';
import {
  buildEvaluationWallets,
  normalizeWalletInputs,
  resolveEnsBatch,
  type EnsBatchResult,
  type EvaluationWalletGateResult
} from '@/lib/ens';
import { buildProofCsvContent, exportProofCsv } from '@/lib/proofCsv';
import {
  buildUsageWindow,
  fetchMockWallets,
  isAbortError,
  runProofEvaluation
} from '@/lib/proofClient';
import type {
  ProofEvaluateResponse,
  ProofSummary,
  ProofWalletRow,
  ProofWindowType
} from '@/lib/proofTypes';
import {
  parseProofState,
  serializeProofState,
  type CriteriaSetId
} from '@/lib/proofUrlState';

import DecisionProduct from './components/DecisionProduct';
import { type ProofFilterState } from './components/ProofFilters';
import ProofKpis from './components/ProofKpis';
import ProofTable from './components/ProofTable';
import WalletDetailModal from './components/WalletDetailModal';
import WalletInput from './components/WalletInput';
import LaunchYourCampaignCard from '@/src/features/campaignLaunch/LaunchYourCampaignCard';

const campaignId = 'airdrop_v1';
const fallbackSampleWallets = [
  '0x0000000000000000000000000000000000000001',
  '0x0000000000000000000000000000000000000002',
  '0x0000000000000000000000000000000000000003',
  '0x0000000000000000000000000000000000000004',
  '0x0000000000000000000000000000000000000005',
  '0x0000000000000000000000000000000000000006',
  '0x0000000000000000000000000000000000000007',
  '0x0000000000000000000000000000000000000008',
  '0x0000000000000000000000000000000000000009',
  '0x000000000000000000000000000000000000000a',
  '0x000000000000000000000000000000000000000b',
  '0x000000000000000000000000000000000000000c',
  '0x000000000000000000000000000000000000000d',
  '0x000000000000000000000000000000000000000e',
  '0x000000000000000000000000000000000000000f',
  '0x0000000000000000000000000000000000000010',
  '0x0000000000000000000000000000000000000011',
  'etherium.eth',
  'vitalik.eth',
  'uniswap.eth'
] as const;

const sampleEnsNames = ['etherium.eth', 'vitalik.eth', 'uniswap.eth'] as const;

const injectEnsSamples = (wallets: string[], limit = 20) => {
  const combined = [...wallets];
  sampleEnsNames.forEach((name, index) => {
    if (combined.length < limit) {
      combined.push(name);
      return;
    }
    const targetIndex = Math.max(0, combined.length - 1 - index);
    combined[targetIndex] = name;
  });
  return combined.slice(0, limit);
};

const criteriaPresets: Record<
  CriteriaSetId,
  { label: string; enabled: boolean; hint?: string; filters: Partial<ProofFilterState> }
> = {
  default: {
    label: 'default',
    enabled: true,
    filters: {
      minTxCount: 0,
      minDaysActive: 0,
      minUniqueContracts: 0
    }
  },
  'airdrop/basic@1': {
    label: 'basic',
    enabled: false,
    hint: 'coming soon',
    filters: {
      minTxCount: 0,
      minDaysActive: 0,
      minUniqueContracts: 0
    }
  },
  'airdrop/strict@1': {
    label: 'strict',
    enabled: false,
    hint: 'coming soon',
    filters: {
      minTxCount: 25,
      minDaysActive: 14,
      minUniqueContracts: 7
    }
  }
};

const criteriaSetIds = Object.keys(criteriaPresets) as CriteriaSetId[];
const isCriteriaSetId = (value: string): value is CriteriaSetId => {
  return criteriaSetIds.includes(value as CriteriaSetId);
};

const defaultFilters: ProofFilterState = {
  verified: 'all',
  minTxCount: 0,
  minDaysActive: 0,
  minUniqueContracts: 0,
  minScore: 0,
  maxScore: 100,
  minFarmPercent: 0,
  maxFarmPercent: 100,
  tag: 'all',
  sortBy: 'score_desc'
};

const sortLabelMap: Record<ProofFilterState['sortBy'], string> = {
  score_desc: 'Score (high to low)',
  farm_desc: 'Farm% (high to low)',
  tx_desc: 'Tx count (high to low)',
  days_desc: 'Days active (high to low)',
  unique_desc: 'Unique contracts (high to low)',
  wallet_asc: 'Wallet (A to Z)'
};

const ensErrorHints: Record<string, string> = {
  rpc_missing: 'backend mainnet RPC not configured',
  resolver_error: 'provider error; retry',
  not_found: 'name not registered / no resolver'
};

const parseProofErrorHint = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const rpcMatch = value.match(/rpc_missing(?::([A-Z0-9_<>-]+))?/i);
  if (rpcMatch) {
    const envKey = rpcMatch[1];
    return envKey ? `rpc_missing (${envKey})` : 'rpc_missing';
  }

  const campaignMatch = value.match(/Unknown campaign_id:\s*([a-zA-Z0-9_@./-]+)/i);
  if (campaignMatch) {
    return `unknown campaign (${campaignMatch[1]})`;
  }

  if (/db_not_indexed_for_targets/i.test(value)) {
    return 'db_not_indexed_for_targets';
  }

  if (/db_not_indexed/i.test(value)) {
    return 'db_not_indexed';
  }

  return null;
};

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
};

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');

const hashText = async (value: string): Promise<string> => {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const encoded = new TextEncoder().encode(value);
    const digest = await window.crypto.subtle.digest('SHA-256', encoded);
    return toHex(digest);
  }

  let fallback = 0;
  for (let index = 0; index < value.length; index += 1) {
    fallback = (fallback * 31 + value.charCodeAt(index)) >>> 0;
  }
  return fallback.toString(16).padStart(8, '0');
};

const downloadTextFile = (filename: string, content: string, contentType: string) => {
  if (typeof window === 'undefined') {
    return;
  }

  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

type DecisionConfidence = {
  score: number;
  reliabilityLabel: 'High reliability decision' | 'Moderate reliability decision' | 'Low reliability decision';
  dataCoverageScore: number;
  sampleSizeReliability: number;
  riskAdjustedConfidence: number;
  featureCompleteness: number;
};

type OptimizationInsight = {
  currentMinScore: number;
  suggestedMinScore: number;
  eligibleBefore: number;
  eligibleAfter: number;
  eligibleCountChange: number;
  riskReductionPct: number;
  budgetUtilizationChangePct: number;
  retainedEligiblePct: number;
  baselineRiskRate: number;
  suggestedRiskRate: number;
  assistantSummary: string;
};

type RiskAnalysisItem = {
  id: string;
  title: string;
  detail: string;
  severity: 'high' | 'medium';
  affectedWallets: number;
  suggestions: string[];
};

type ProofRunSnapshot = {
  id: number;
  label: string;
  createdAt: number;
  criteriaSetId: CriteriaSetId;
  windowType: ProofWindowType;
  filters: ProofFilterState;
  eligibleCount: number;
  riskRate: number;
  estimatedAvgAllocation: number;
  rowsEvaluated: number;
};

type BenchmarkInsight = {
  id: string;
  label: string;
  headline: string;
  detail: string;
  tone: 'higher_risk' | 'below_typical' | 'stronger' | 'typical';
};

type FinalDecisionStatus = 'draft' | 'reviewed' | 'finalized';

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const getReliabilityLabel = (
  score: number
): DecisionConfidence['reliabilityLabel'] => {
  if (score >= 80) {
    return 'High reliability decision';
  }
  if (score >= 60) {
    return 'Moderate reliability decision';
  }
  return 'Low reliability decision';
};

const matchesResultFilters = (
  entry: ProofWalletRow,
  filters: ProofFilterState,
  insightsEnabled: boolean
) => {
  if (entry.error || !entry.output) {
    return true;
  }

  if (filters.verified !== 'all') {
    const shouldBeVerified = filters.verified === 'true';
    if (entry.output.verified_usage !== shouldBeVerified) {
      return false;
    }
  }

  const summary = entry.output.usage_summary;
  if (summary.tx_count < filters.minTxCount) {
    return false;
  }
  if (summary.days_active < filters.minDaysActive) {
    return false;
  }
  if (summary.unique_contracts < filters.minUniqueContracts) {
    return false;
  }

  if (insightsEnabled && entry.insights) {
    const farmPercent = entry.insights.farming_probability * 100;
    if (entry.insights.overall_score < filters.minScore) {
      return false;
    }
    if (entry.insights.overall_score > filters.maxScore) {
      return false;
    }
    if (farmPercent < filters.minFarmPercent) {
      return false;
    }
    if (farmPercent > filters.maxFarmPercent) {
      return false;
    }
    if (filters.tag !== 'all' && entry.insights.behavior_tag !== filters.tag) {
      return false;
    }
  }

  return true;
};

const isRiskyWallet = (entry: ProofWalletRow) => {
  const farmProbability = entry.insights?.farming_probability ?? 0;
  const behaviorTag = entry.insights?.behavior_tag;
  return farmProbability >= 0.5 || behaviorTag === 'suspected_farm';
};

const matchesOptimizationBaseFilters = (
  entry: ProofWalletRow,
  filters: ProofFilterState
) => {
  if (entry.error || !entry.output || !entry.insights) {
    return false;
  }

  if (filters.verified !== 'all') {
    const shouldBeVerified = filters.verified === 'true';
    if (entry.output.verified_usage !== shouldBeVerified) {
      return false;
    }
  }

  const usageSummary = entry.output.usage_summary;
  if (usageSummary.tx_count < filters.minTxCount) {
    return false;
  }
  if (usageSummary.days_active < filters.minDaysActive) {
    return false;
  }
  if (usageSummary.unique_contracts < filters.minUniqueContracts) {
    return false;
  }

  const farmPercent = entry.insights.farming_probability * 100;
  if (entry.insights.overall_score > filters.maxScore) {
    return false;
  }
  if (farmPercent < filters.minFarmPercent) {
    return false;
  }
  if (farmPercent > filters.maxFarmPercent) {
    return false;
  }
  if (filters.tag !== 'all' && entry.insights.behavior_tag !== filters.tag) {
    return false;
  }

  return true;
};

const formatSignedPercent = (value: number) =>
  `${value > 0 ? '+' : ''}${Math.round(value)}%`;

const formatSignedCount = (value: number) => `${value > 0 ? '+' : ''}${value}`;

const formatSignedDecimal = (value: number) =>
  `${value > 0 ? '+' : ''}${value.toFixed(2)}`;

const formatUsd = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(Math.max(0, value));

const formatWholePercent = (value: number) => `${Math.round(value)}%`;

const classifyUserType = (entry: ProofWalletRow): 'Farmer' | 'Real' | 'Whale' => {
  const score = entry.insights?.overall_score ?? 0;
  const farmProbability = entry.insights?.farming_probability ?? 0;
  if (farmProbability >= 0.5 || entry.insights?.behavior_tag === 'suspected_farm') {
    return 'Farmer';
  }
  if (score >= 85) {
    return 'Whale';
  }
  return 'Real';
};

const proofBenchmarks = {
  typicalSybilRatioPct: 12,
  typicalEligibleRatePct: 58,
  typicalAverageScore: 68
} as const;

const decisionStatusClass = (status: FinalDecisionStatus) => {
  switch (status) {
    case 'finalized':
      return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100';
    case 'reviewed':
      return 'border-sky-400/30 bg-sky-500/10 text-sky-100';
    default:
      return 'border-amber-400/30 bg-amber-500/10 text-amber-100';
  }
};

const buildRunSnapshot = ({
  id,
  rows,
  filters,
  criteriaSetId,
  windowType
}: {
  id: number;
  rows: ProofWalletRow[];
  filters: ProofFilterState;
  criteriaSetId: CriteriaSetId;
  windowType: ProofWindowType;
}): ProofRunSnapshot => {
  const insightsActive = rows.some(
    (row) => row.source === 'commentary' || row.source === 'insights'
  );
  const filteredRows = rows.filter((entry) =>
    matchesResultFilters(entry, filters, insightsActive)
  );
  const eligibleRows = filteredRows.filter((entry) => entry.output && !entry.error);
  const riskyRows = eligibleRows.filter(isRiskyWallet).length;
  const eligibleCount = eligibleRows.length;
  const riskRate = eligibleCount ? (riskyRows / eligibleCount) * 100 : 0;
  const normalizedBudget = 1000;
  const estimatedAvgAllocation = eligibleCount ? normalizedBudget / eligibleCount : 0;

  return {
    id,
    label: `Run v${id}`,
    createdAt: Date.now(),
    criteriaSetId,
    windowType,
    filters: { ...filters },
    eligibleCount,
    riskRate,
    estimatedAvgAllocation,
    rowsEvaluated: rows.filter((entry) => entry.output && !entry.error).length
  };
};

const DemoProofPageInner = () => {
  const baseUrl = getDemoApiBaseUrl();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [inputValue, setInputValue] = useState('');
  const [windowType, setWindowType] = useState<ProofWindowType>('last_30_days');
  const [criteriaSetId, setCriteriaSetId] = useState<CriteriaSetId>('default');
  const [filters, setFilters] = useState<ProofFilterState>(defaultFilters);
  const [rows, setRows] = useState<ProofWalletRow[]>([]);
  const [selected, setSelected] = useState<ProofWalletRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [ensResolution, setEnsResolution] = useState<EnsBatchResult | null>(null);
  const [gateInvalids, setGateInvalids] = useState<Array<{ value: string; reason: string }>>([]);
  const [ensRetrying, setEnsRetrying] = useState(false);
  const [determinismCheck, setDeterminismCheck] = useState<{
    status: 'ok' | 'mismatch';
    address: string;
    ensName?: string;
  } | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [shareWarning, setShareWarning] = useState<string | null>(null);
  const [proofCopyStatus, setProofCopyStatus] = useState<string | null>(null);
  const [manifestCopyStatus, setManifestCopyStatus] = useState<string | null>(null);
  const [packageExportStatus, setPackageExportStatus] = useState<string | null>(null);
  const [isFinalDecision, setIsFinalDecision] = useState(false);
  const [proofArtifactSeed, setProofArtifactSeed] = useState<{
    walletSnapshot: string[];
    criteriaSetId: CriteriaSetId;
    windowType: ProofWindowType;
  } | null>(null);
  const [proofPackageHashes, setProofPackageHashes] = useState<{
    inputHash: string;
    policyHash: string;
    outputHash: string;
  } | null>(null);
  const [runHistory, setRunHistory] = useState<ProofRunSnapshot[]>([]);
  const [campaignBudget, setCampaignBudget] = useState(25000);
  const [autoOptimizeDistribution, setAutoOptimizeDistribution] = useState(true);
  const filtersRef = useRef<HTMLDivElement | null>(null);
  const compareRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const initializedRef = useRef(false);
  const autoRunRef = useRef(false);
  const hasAutoRunRef = useRef(false);
  const skipNextPresetSyncRef = useRef(false);
  const lastSearchRef = useRef<string>('');
  const isDev = process.env.NODE_ENV !== 'production';

  const parsedWallets = useMemo(
    () => normalizeWalletInputs(inputValue),
    [inputValue]
  );

  const safeCriteriaSetId = useMemo(() => {
    return criteriaPresets[criteriaSetId]?.enabled ? criteriaSetId : 'default';
  }, [criteriaSetId]);

  const normalizedInputList = useMemo(
    () =>
      parsedWallets.inputs
        .filter((entry) => entry.kind !== 'invalid')
        .map((entry) => entry.normalized ?? entry.raw),
    [parsedWallets.inputs]
  );

  const totalEntries = parsedWallets.inputs.length;
  const validEntries = parsedWallets.addresses.length + parsedWallets.ensNames.length;
  const invalidEntries = parsedWallets.invalid.length;

  const ensStats = useMemo(() => {
    const total = parsedWallets.ensNames.length;
    if (!ensResolution) {
      return { total, resolved: 0, unresolved: 0 };
    }
    const resolvedCount = Object.values(ensResolution.resolved).filter(
      (entry) => Boolean(entry.address)
    ).length;
    return {
      total,
      resolved: resolvedCount,
      unresolved: ensResolution.unresolved.length
    };
  }, [ensResolution, parsedWallets.ensNames.length]);

  const invalidList = useMemo(() => {
    const entries: Array<{ value: string; reason: string }> = [];
    const seen = new Set<string>();
    const addEntry = (value: string, reason: string) => {
      const key = `${value}:${reason}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      entries.push({ value, reason });
    };

    parsedWallets.invalid.forEach((value) => addEntry(value, 'invalid_format'));
    gateInvalids.forEach((entry) => addEntry(entry.value, entry.reason));

    if (ensResolution) {
      for (const name of ensResolution.unresolved) {
        addEntry(name, ensResolution.resolved[name]?.error ?? 'not_found');
      }
    }

    return entries;
  }, [ensResolution, parsedWallets.invalid, gateInvalids]);

  const hasUnresolvedEns = Boolean(ensResolution?.unresolved.length);

  const insightsEnabled = useMemo(
    () => rows.some((row) => row.source === 'commentary' || row.source === 'insights'),
    [rows]
  );

  useEffect(() => {
    const allowedSorts: ProofFilterState['sortBy'][] = insightsEnabled
      ? ['score_desc', 'farm_desc', 'tx_desc', 'days_desc', 'unique_desc', 'wallet_asc']
      : ['tx_desc', 'days_desc', 'unique_desc', 'wallet_asc'];

    setFilters((prev) => {
      if (allowedSorts.includes(prev.sortBy)) {
        return prev;
      }
      return {
        ...prev,
        sortBy: insightsEnabled ? 'score_desc' : 'wallet_asc'
      };
    });
  }, [insightsEnabled]);

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }
    initializedRef.current = true;

    const parsed = parseProofState(searchParams);
    const hasFilterOverride = Boolean(parsed.filters);

    if (parsed.walletsRaw) {
      setInputValue(parsed.walletsRaw);
    }
    if (parsed.windowType) {
      setWindowType(parsed.windowType);
    }
    if (parsed.criteriaSetId && isCriteriaSetId(parsed.criteriaSetId)) {
      if (hasFilterOverride) {
        skipNextPresetSyncRef.current = true;
      }
      setCriteriaSetId(parsed.criteriaSetId);
    }
    if (parsed.filters) {
      skipNextPresetSyncRef.current = true;
      setFilters({ ...defaultFilters, ...parsed.filters });
    }
    if (parsed.autoRun) {
      autoRunRef.current = true;
    }

    setTimeout(() => setIsHydrated(true), 0);
  }, [searchParams]);

  useEffect(() => {
    setEnsResolution(null);
    setGateInvalids([]);
    setDeterminismCheck(null);
  }, [inputValue]);

  useEffect(() => {
    if (skipNextPresetSyncRef.current) {
      skipNextPresetSyncRef.current = false;
      return;
    }
    const preset = criteriaPresets[criteriaSetId];
    if (!preset) {
      return;
    }
    setFilters((prev) => ({
      ...defaultFilters,
      sortBy: prev.sortBy,
      ...preset.filters
    }));
  }, [criteriaSetId]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const rawTooLong = inputValue.length > 1500 && validEntries > 0;
    setShareWarning(
      rawTooLong ? 'Wallet list is long; share link uses normalized wallets.' : null
    );

    const params = serializeProofState({
      walletsRaw: inputValue,
      normalizedWallets: normalizedInputList,
      windowType,
      criteriaSetId: safeCriteriaSetId,
      filters
    });

    const nextSearch = params.toString();
    const currentSearch =
      typeof window !== 'undefined'
        ? window.location.search.replace(/^\?/, '')
        : searchParams.toString();

    if (nextSearch === currentSearch || nextSearch === lastSearchRef.current) {
      return;
    }

    lastSearchRef.current = nextSearch;
    const nextUrl = nextSearch ? `${pathname}?${nextSearch}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [filters, isHydrated, pathname, router, searchParams, safeCriteriaSetId, windowType]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    const timeout = setTimeout(() => {
      const rawTooLong = inputValue.length > 1500 && validEntries > 0;
      setShareWarning(
        rawTooLong ? 'Wallet list is long; share link uses normalized wallets.' : null
      );

      const params = serializeProofState({
        walletsRaw: inputValue,
        normalizedWallets: normalizedInputList,
        windowType,
        criteriaSetId: safeCriteriaSetId,
        filters
      });

      const nextSearch = params.toString();
      const currentSearch =
        typeof window !== 'undefined'
          ? window.location.search.replace(/^\?/, '')
          : searchParams.toString();

      if (nextSearch === currentSearch || nextSearch === lastSearchRef.current) {
        return;
      }

      lastSearchRef.current = nextSearch;
      const nextUrl = nextSearch ? `${pathname}?${nextSearch}` : pathname;
      router.replace(nextUrl, { scroll: false });
    }, 300);

    return () => clearTimeout(timeout);
  }, [filters, inputValue, isHydrated, pathname, router, searchParams, safeCriteriaSetId, windowType, normalizedInputList, validEntries]);

  useEffect(() => {
    if (!isHydrated || hasAutoRunRef.current || !autoRunRef.current) {
      return;
    }
    if (!baseUrl) {
      return;
    }
    if (!validEntries) {
      return;
    }
    hasAutoRunRef.current = true;
    void handleRun();
  }, [baseUrl, isHydrated, safeCriteriaSetId, validEntries, windowType]);

  const filteredResults = useMemo<ProofWalletRow[]>(() => {
    return rows.filter((entry) => matchesResultFilters(entry, filters, insightsEnabled));
  }, [filters, rows, insightsEnabled]);

  const sortedResults = useMemo<ProofWalletRow[]>(() => {
    const sorted = [...filteredResults];

    sorted.sort((a, b) => {
      const walletCompare = a.wallet.localeCompare(b.wallet);

      if (a.error && !b.error) {
        return 1;
      }
      if (b.error && !a.error) {
        return -1;
      }

      let diff = 0;
      switch (filters.sortBy) {
        case 'score_desc':
          diff = (b.insights?.overall_score ?? 0) - (a.insights?.overall_score ?? 0);
          break;
        case 'farm_desc':
          diff =
            (b.insights?.farming_probability ?? 0) -
            (a.insights?.farming_probability ?? 0);
          break;
        case 'tx_desc':
          diff =
            (b.output?.usage_summary.tx_count ?? 0) -
            (a.output?.usage_summary.tx_count ?? 0);
          break;
        case 'days_desc':
          diff =
            (b.output?.usage_summary.days_active ?? 0) -
            (a.output?.usage_summary.days_active ?? 0);
          break;
        case 'unique_desc':
          diff =
            (b.output?.usage_summary.unique_contracts ?? 0) -
            (a.output?.usage_summary.unique_contracts ?? 0);
          break;
        case 'wallet_asc':
          diff = walletCompare;
          break;
        default:
          diff = 0;
      }

      if (diff === 0) {
        return walletCompare;
      }
      return diff;
    });

    return sorted;
  }, [filteredResults, filters.sortBy]);

  const summary = useMemo<ProofSummary>(() => {
    const validRows = filteredResults.filter((entry) => entry.output && !entry.error);
    const total = validRows.length;
    const verifiedTrue = validRows.filter((entry) => entry.output?.verified_usage).length;
    const verifiedFalse = total - verifiedTrue;
    const verifiedRate = total ? verifiedTrue / total : 0;

    const totals = validRows.reduce(
      (acc, entry) => {
        const usage = entry.output?.usage_summary;
        if (usage) {
          acc.tx += usage.tx_count;
          acc.days += usage.days_active;
          acc.uniq += usage.unique_contracts;
        }
        if (entry.insights) {
          acc.score += entry.insights.overall_score;
          if (entry.insights.behavior_tag === 'suspected_farm') {
            acc.suspected += 1;
          }
        }
        return acc;
      },
      { tx: 0, days: 0, uniq: 0, score: 0, suspected: 0 }
    );

    return {
      total,
      verified_true: verifiedTrue,
      verified_false: verifiedFalse,
      verified_rate: verifiedRate,
      avg_tx_count: total ? totals.tx / total : 0,
      avg_days_active: total ? totals.days / total : 0,
      avg_unique_contracts: total ? totals.uniq / total : 0,
      suspected_farm_count: totals.suspected,
      suspected_farm_rate: total ? totals.suspected / total : 0,
      avg_score: total ? totals.score / total : 0
    };
  }, [filteredResults]);

  const errorCount = useMemo(
    () => filteredResults.filter((entry) => entry.error).length,
    [filteredResults]
  );

  const topErrorHint = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of filteredResults) {
      const hint = parseProofErrorHint(row.error);
      if (!hint) {
        continue;
      }
      counts.set(hint, (counts.get(hint) ?? 0) + 1);
    }

    let best: string | null = null;
    let bestCount = 0;
    for (const [hint, count] of counts.entries()) {
      if (count > bestCount) {
        best = hint;
        bestCount = count;
      }
    }
    return best;
  }, [filteredResults]);

  const proofPackageBase = useMemo(() => {
    if (!proofArtifactSeed) {
      return null;
    }

    const successfulRows = rows.filter(
      (entry): entry is ProofWalletRow & { output: NonNullable<ProofWalletRow['output']> } =>
        Boolean(entry.output) && !entry.error
    );

    if (!successfulRows.length) {
      return null;
    }

    const firstOutput = successfulRows[0].output;
    const engineVersions = Array.from(
      new Set(
        successfulRows
          .map((entry) => entry.output.criteria?.engine_version)
          .filter((value): value is string => Boolean(value))
      )
    );
    const engineVersion =
      engineVersions.length === 0
        ? 'unknown'
        : engineVersions.length === 1
          ? engineVersions[0]
          : engineVersions.join(', ');
    const inputPayload = {
      campaign_id: campaignId,
      wallet_snapshot: proofArtifactSeed.walletSnapshot,
      window_type: proofArtifactSeed.windowType
    };
    const policyPayload = {
      campaign_id: campaignId,
      criteria_set_id: firstOutput.criteria?.criteria_set_id ?? proofArtifactSeed.criteriaSetId,
      criteria_params: firstOutput.criteria?.params ?? null,
      window: firstOutput.window,
      engine_version: engineVersion
    };
    const outputPayload = {
      result_count: successfulRows.length,
      verified_true: successfulRows.filter((entry) => entry.output.verified_usage).length,
      verified_false: successfulRows.filter((entry) => !entry.output.verified_usage).length,
      outputs: successfulRows
        .map((entry) => ({
          wallet: entry.wallet,
          verified_usage: entry.output.verified_usage,
          proof_hash: entry.output.proof.canonical_hash
        }))
        .sort((left, right) => left.wallet.localeCompare(right.wallet))
    };

    return {
      engineVersion,
      inputPayload,
      policyPayload,
      outputPayload
    };
  }, [proofArtifactSeed, rows]);

  useEffect(() => {
    let cancelled = false;

    if (!proofPackageBase) {
      setProofPackageHashes(null);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const [inputHash, policyHash, outputHash] = await Promise.all([
        hashText(stableStringify(proofPackageBase.inputPayload)),
        hashText(stableStringify(proofPackageBase.policyPayload)),
        hashText(stableStringify(proofPackageBase.outputPayload))
      ]);

      if (cancelled) {
        return;
      }

      setProofPackageHashes({ inputHash, policyHash, outputHash });
    })();

    return () => {
      cancelled = true;
    };
  }, [proofPackageBase]);

  const proofPackageManifest = useMemo(() => {
    if (!proofPackageBase || !proofPackageHashes) {
      return null;
    }

    return {
      package_version: 'decision-proof-package/v1',
      reproducible: true,
      statement:
        'This decision can be independently reproduced using the same inputs and policy.',
      campaign_id: campaignId,
      engine_version: proofPackageBase.engineVersion,
      input: {
        ...proofPackageBase.inputPayload,
        hash: proofPackageHashes.inputHash
      },
      policy: {
        ...proofPackageBase.policyPayload,
        hash: proofPackageHashes.policyHash
      },
      output: {
        ...proofPackageBase.outputPayload,
        hash: proofPackageHashes.outputHash
      }
    };
  }, [campaignId, proofPackageBase, proofPackageHashes]);

  const proofManifestJson = useMemo(() => {
    if (!proofPackageManifest) {
      return null;
    }
    return JSON.stringify(proofPackageManifest, null, 2);
  }, [proofPackageManifest]);

  const proofPolicyJson = useMemo(() => {
    if (!proofPackageManifest) {
      return null;
    }
    return JSON.stringify(proofPackageManifest.policy, null, 2);
  }, [proofPackageManifest]);

  const inputHashReferenceText = useMemo(() => {
    if (!proofPackageManifest) {
      return null;
    }
    return [
      'IndexFlow Input Dataset Hash Reference',
      `campaign_id: ${proofPackageManifest.campaign_id}`,
      `input_hash: ${proofPackageManifest.input.hash}`,
      `wallet_count: ${proofPackageManifest.input.wallet_snapshot.length}`,
      `window_type: ${proofPackageManifest.input.window_type}`,
      '',
      'This reference identifies the exact wallet snapshot used to reproduce the decision.',
      'Load the wallet snapshot matching this hash before replaying the evaluator.'
    ].join('\n');
  }, [proofPackageManifest]);

  const engineMetadataJson = useMemo(() => {
    if (!proofPackageManifest) {
      return null;
    }
    return JSON.stringify(
      {
        engine_version: proofPackageManifest.engine_version,
        package_version: proofPackageManifest.package_version,
        criteria_set_id: proofPackageManifest.policy.criteria_set_id,
        reproducible: proofPackageManifest.reproducible,
        statement: proofPackageManifest.statement
      },
      null,
      2
    );
  }, [proofPackageManifest]);

  const decisionConfidence = useMemo<DecisionConfidence | null>(() => {
    if (!proofPackageManifest) {
      return null;
    }

    const successfulRows = rows.filter((entry) => entry.output && !entry.error);
    const validRowCount = successfulRows.length;
    if (!validRowCount) {
      return null;
    }

    const dataCoverageScore = clampPercent(
      ((validEntries - invalidList.length) / Math.max(validEntries, 1)) * 100
    );
    const sampleSizeReliability = clampPercent((Math.min(validRowCount, 50) / 50) * 100);
    const featureCompleteness = clampPercent(
      (successfulRows.filter((entry) => entry.insights || entry.commentary).length / validRowCount) *
        100
    );
    const riskyRows = successfulRows.filter((entry) => {
      const farmProbability = entry.insights?.farming_probability ?? 0;
      const behaviorTag = entry.insights?.behavior_tag;
      return farmProbability >= 0.5 || behaviorTag === 'suspected_farm';
    }).length;
    const riskAdjustedConfidence = clampPercent(100 - (riskyRows / validRowCount) * 100);
    const score = Math.round(
      dataCoverageScore * 0.3 +
        sampleSizeReliability * 0.25 +
        riskAdjustedConfidence * 0.25 +
        featureCompleteness * 0.2
    );

    return {
      score,
      reliabilityLabel: getReliabilityLabel(score),
      dataCoverageScore,
      sampleSizeReliability,
      riskAdjustedConfidence,
      featureCompleteness
    };
  }, [invalidList.length, proofPackageManifest, rows, validEntries]);

  const optimizationInsight = useMemo<OptimizationInsight | null>(() => {
    if (!insightsEnabled) {
      return null;
    }

    const currentMinScore = Math.max(0, Math.min(filters.minScore, filters.maxScore));
    const candidatePool = rows.filter((entry) =>
      matchesOptimizationBaseFilters(entry, filters)
    );

    if (!candidatePool.length) {
      return null;
    }

    const baselineEligible = candidatePool.filter(
      (entry) => (entry.insights?.overall_score ?? 0) >= currentMinScore
    );

    if (baselineEligible.length < 2) {
      return null;
    }

    const baselineRiskyCount = baselineEligible.filter(isRiskyWallet).length;
    const baselineRiskRate = (baselineRiskyCount / baselineEligible.length) * 100;
    const thresholdOptions = Array.from(
      new Set(
        [currentMinScore + 5, currentMinScore + 10, currentMinScore + 15].filter(
          (threshold) => threshold <= Math.min(filters.maxScore, 95)
        )
      )
    );

    let bestCandidate: OptimizationInsight | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    thresholdOptions.forEach((threshold) => {
      const nextEligible = baselineEligible.filter(
        (entry) => (entry.insights?.overall_score ?? 0) >= threshold
      );

      if (!nextEligible.length || nextEligible.length === baselineEligible.length) {
        return;
      }

      const nextRiskyCount = nextEligible.filter(isRiskyWallet).length;
      const suggestedRiskRate = (nextRiskyCount / nextEligible.length) * 100;
      const riskReductionPct =
        baselineRiskRate > 0
          ? ((baselineRiskRate - suggestedRiskRate) / baselineRiskRate) * 100
          : 0;
      const budgetUtilizationChangePct =
        ((nextEligible.length - baselineEligible.length) / baselineEligible.length) * 100;
      const retainedEligiblePct = (nextEligible.length / baselineEligible.length) * 100;
      const candidateScore =
        riskReductionPct - Math.abs(budgetUtilizationChangePct) * 0.65 + retainedEligiblePct * 0.08;

      if (candidateScore <= bestScore) {
        return;
      }

      const assistantSummary =
        riskReductionPct >= 20
          ? `Raising the score floor removes more borderline, higher-risk wallets while keeping most of the currently eligible cohort in range.`
          : `A modest score increase tightens the eligible set without materially over-correcting the budget.`;

      bestScore = candidateScore;
      bestCandidate = {
        currentMinScore,
        suggestedMinScore: threshold,
        eligibleBefore: baselineEligible.length,
        eligibleAfter: nextEligible.length,
        eligibleCountChange: nextEligible.length - baselineEligible.length,
        riskReductionPct,
        budgetUtilizationChangePct,
        retainedEligiblePct,
        baselineRiskRate,
        suggestedRiskRate,
        assistantSummary
      };
    });

    return bestCandidate;
  }, [filters, insightsEnabled, rows]);

  const riskAnalysis = useMemo<RiskAnalysisItem[]>(() => {
    if (!insightsEnabled) {
      return [];
    }

    const eligibleRows = rows.filter((entry) => {
      if (!entry.output || entry.error || !entry.insights) {
        return false;
      }
      return filteredResults.some((candidate) => candidate.wallet === entry.wallet);
    });

    if (!eligibleRows.length) {
      return [];
    }

    const suspectedFarmRows = eligibleRows.filter(
      (entry) => entry.insights?.behavior_tag === 'suspected_farm'
    );
    const lowDiversityRows = eligibleRows.filter(
      (entry) => (entry.output?.usage_summary.unique_contracts ?? 0) <= 2
    );
    const youngWalletRows = eligibleRows.filter(
      (entry) => (entry.output?.usage_summary.days_active ?? 0) <= 7
    );
    const sybilRiskRows = eligibleRows.filter(
      (entry) => (entry.insights?.farming_probability ?? 0) >= 0.4
    );

    const risks: RiskAnalysisItem[] = [];

    if (youngWalletRows.length > 0) {
      risks.push({
        id: 'wallet-age',
        title: 'Recent wallets are passing eligibility',
        detail: `${youngWalletRows.length} wallets have low activity age, which increases the chance of short-lived or throwaway participation.`,
        severity:
          youngWalletRows.length / eligibleRows.length >= 0.2 ? 'high' : 'medium',
        affectedWallets: youngWalletRows.length,
        suggestions: [
          'Increase minimum wallet age',
          'Require more active days before eligibility',
          'Review borderline wallets created in the latest window'
        ]
      });
    }

    if (lowDiversityRows.length > 0) {
      risks.push({
        id: 'contract-diversity',
        title: 'Low contract diversity weakens behavioral confidence',
        detail: `${lowDiversityRows.length} wallets interact with very few unique contracts, which can indicate narrow scripted usage rather than organic activity.`,
        severity:
          lowDiversityRows.length / eligibleRows.length >= 0.25 ? 'high' : 'medium',
        affectedWallets: lowDiversityRows.length,
        suggestions: [
          'Exclude wallets with low contract diversity',
          'Raise the minimum unique contracts threshold',
          'Prioritize wallets with broader protocol interaction'
        ]
      });
    }

    if (sybilRiskRows.length > 0 || suspectedFarmRows.length > 0) {
      const affectedWallets = Math.max(sybilRiskRows.length, suspectedFarmRows.length);
      risks.push({
        id: 'sybil-risk',
        title: 'Sybil-like behavior is still present in the eligible set',
        detail: `${affectedWallets} wallets show elevated farm probability or are already tagged as suspected farm accounts.`,
        severity:
          affectedWallets / eligibleRows.length >= 0.18 ? 'high' : 'medium',
        affectedWallets,
        suggestions: [
          'Tighten sybil risk threshold',
          'Raise the minimum score floor for borderline wallets',
          'Lower the maximum allowed farm risk percentage'
        ]
      });
    }

    return risks;
  }, [filteredResults, insightsEnabled, rows]);

  const latestRun = runHistory[runHistory.length - 1] ?? null;
  const previousRun = runHistory[runHistory.length - 2] ?? null;
  const runComparison = useMemo(() => {
    if (!latestRun || !previousRun) {
      return null;
    }

    return {
      from: previousRun,
      to: latestRun,
      eligibleDifference: latestRun.eligibleCount - previousRun.eligibleCount,
      riskDifference: latestRun.riskRate - previousRun.riskRate,
      allocationDifference:
        latestRun.estimatedAvgAllocation - previousRun.estimatedAvgAllocation
    };
  }, [latestRun, previousRun]);

  const benchmarkInsights = useMemo<BenchmarkInsight[]>(() => {
    if (!rows.length || !summary.total) {
      return [];
    }

    const eligibleRatePct =
      validEntries > 0 ? (summary.total / Math.max(validEntries, 1)) * 100 : 0;
    const sybilRatioPct = summary.suspected_farm_rate * 100;
    const insights: BenchmarkInsight[] = [];

    if (sybilRatioPct > proofBenchmarks.typicalSybilRatioPct + 3) {
      insights.push({
        id: 'sybil',
        label: 'Sybil benchmark',
        headline: 'This campaign has higher sybil ratio than average.',
        detail: `High-risk share is ${Math.round(sybilRatioPct)}% versus a typical campaign baseline near ${proofBenchmarks.typicalSybilRatioPct}%.`,
        tone: 'higher_risk'
      });
    } else if (sybilRatioPct < proofBenchmarks.typicalSybilRatioPct - 3) {
      insights.push({
        id: 'sybil',
        label: 'Sybil benchmark',
        headline: 'This campaign has lower sybil ratio than average.',
        detail: `High-risk share is ${Math.round(sybilRatioPct)}% versus a typical campaign baseline near ${proofBenchmarks.typicalSybilRatioPct}%.`,
        tone: 'stronger'
      });
    } else {
      insights.push({
        id: 'sybil',
        label: 'Sybil benchmark',
        headline: 'This campaign is close to the typical sybil ratio.',
        detail: `High-risk share is ${Math.round(sybilRatioPct)}%, broadly in line with the internal campaign baseline of ${proofBenchmarks.typicalSybilRatioPct}%.`,
        tone: 'typical'
      });
    }

    if (eligibleRatePct < proofBenchmarks.typicalEligibleRatePct - 5) {
      insights.push({
        id: 'eligibility',
        label: 'Eligibility benchmark',
        headline: 'Your eligible rate is below typical campaigns.',
        detail: `Current eligible rate is ${Math.round(eligibleRatePct)}% compared with a typical campaign baseline near ${proofBenchmarks.typicalEligibleRatePct}%.`,
        tone: 'below_typical'
      });
    } else if (eligibleRatePct > proofBenchmarks.typicalEligibleRatePct + 5) {
      insights.push({
        id: 'eligibility',
        label: 'Eligibility benchmark',
        headline: 'Your eligible rate is above typical campaigns.',
        detail: `Current eligible rate is ${Math.round(eligibleRatePct)}% compared with a typical campaign baseline near ${proofBenchmarks.typicalEligibleRatePct}%.`,
        tone: 'stronger'
      });
    } else {
      insights.push({
        id: 'eligibility',
        label: 'Eligibility benchmark',
        headline: 'Your eligible rate is close to typical campaigns.',
        detail: `Current eligible rate is ${Math.round(eligibleRatePct)}%, which tracks closely against the internal baseline of ${proofBenchmarks.typicalEligibleRatePct}%.`,
        tone: 'typical'
      });
    }

    if (summary.avg_score >= proofBenchmarks.typicalAverageScore + 4) {
      insights.push({
        id: 'score',
        label: 'Quality benchmark',
        headline: 'Wallet quality is stronger than the typical campaign cohort.',
        detail: `Average score is ${Math.round(summary.avg_score)} versus a typical campaign baseline near ${proofBenchmarks.typicalAverageScore}.`,
        tone: 'stronger'
      });
    } else if (summary.avg_score <= proofBenchmarks.typicalAverageScore - 4) {
      insights.push({
        id: 'score',
        label: 'Quality benchmark',
        headline: 'Wallet quality is weaker than the typical campaign cohort.',
        detail: `Average score is ${Math.round(summary.avg_score)} versus a typical campaign baseline near ${proofBenchmarks.typicalAverageScore}.`,
        tone: 'below_typical'
      });
    }

    return insights;
  }, [rows.length, summary, validEntries]);

  const finalDecisionStatus: FinalDecisionStatus = isFinalDecision
    ? 'finalized'
    : rows.length > 0
      ? 'reviewed'
      : 'draft';
  const isDecisionLocked = finalDecisionStatus === 'finalized';

  const riskSummaryJson = useMemo(() => {
    if (!proofPackageManifest) {
      return null;
    }

    return JSON.stringify(
      {
        eligible_wallets: summary.total,
        suspected_farm_count: summary.suspected_farm_count,
        suspected_farm_rate_percent: Number((summary.suspected_farm_rate * 100).toFixed(2)),
        decision_confidence: decisionConfidence
          ? {
              score_percent: decisionConfidence.score,
              data_coverage_score: Math.round(decisionConfidence.dataCoverageScore),
              sample_size_reliability: Math.round(
                decisionConfidence.sampleSizeReliability
              ),
              risk_adjusted_confidence: Math.round(
                decisionConfidence.riskAdjustedConfidence
              ),
              feature_completeness: Math.round(decisionConfidence.featureCompleteness)
            }
          : null,
        comparative_benchmarks: benchmarkInsights.map((insight) => ({
          label: insight.label,
          headline: insight.headline,
          detail: insight.detail
        })),
        risk_analysis: riskAnalysis.map((risk) => ({
          title: risk.title,
          severity: risk.severity,
          affected_wallets: risk.affectedWallets,
          suggestions: risk.suggestions
        }))
      },
      null,
      2
    );
  }, [benchmarkInsights, decisionConfidence, proofPackageManifest, riskAnalysis, summary]);

  const decisionJson = useMemo(() => {
    if (!proofPackageManifest) {
      return null;
    }

    return JSON.stringify(
      {
        campaign_id: campaignId,
        criteria_set_id: safeCriteriaSetId,
        window_type: windowType,
        filters,
        summary: {
          total: summary.total,
          verified_true: summary.verified_true,
          verified_false: summary.verified_false,
          average_score: Number(summary.avg_score.toFixed(2)),
          suspected_farm_rate_percent: Number((summary.suspected_farm_rate * 100).toFixed(2))
        },
        optimization_insight: optimizationInsight
          ? {
              suggested_min_score: optimizationInsight.suggestedMinScore,
              eligible_count_change: optimizationInsight.eligibleCountChange,
              risk_reduction_percent: Number(
                optimizationInsight.riskReductionPct.toFixed(2)
              ),
              budget_utilization_change_percent: Number(
                optimizationInsight.budgetUtilizationChangePct.toFixed(2)
              )
            }
          : null,
        latest_run: latestRun,
        comparison: runComparison
          ? {
              from: runComparison.from.label,
              to: runComparison.to.label,
              eligible_difference: runComparison.eligibleDifference,
              risk_difference_percent: Number(runComparison.riskDifference.toFixed(2)),
              allocation_difference: Number(
                runComparison.allocationDifference.toFixed(2)
              )
            }
          : null
      },
      null,
      2
    );
  }, [
    campaignId,
    filters,
    latestRun,
    optimizationInsight,
    proofPackageManifest,
    runComparison,
    safeCriteriaSetId,
    summary,
    windowType
  ]);

  const decisionPackageExportJson = useMemo(() => {
    if (!proofPackageManifest || !decisionJson || !riskSummaryJson) {
      return null;
    }

    return JSON.stringify(
      {
        package_type: 'indexflow-decision-package/v1',
        status: 'Ready for protocol execution',
        generated_at: new Date().toISOString(),
        assets: {
          wallet_allocation_csv: {
            filename: `wallet-allocation-${campaignId}.csv`,
            content: buildProofCsvContent(sortedResults)
          },
          decision_json: JSON.parse(decisionJson),
          proof_manifest: proofPackageManifest,
          risk_summary: JSON.parse(riskSummaryJson)
        }
      },
      null,
      2
    );
  }, [campaignId, decisionJson, proofPackageManifest, riskSummaryJson, sortedResults]);

  const handleApplySaferConfiguration = () => {
    setFilters((prev) => {
      const nextMinScore = optimizationInsight
        ? Math.max(prev.minScore, optimizationInsight.suggestedMinScore)
        : Math.max(prev.minScore, 65);

      return {
        ...prev,
        minDaysActive: Math.max(prev.minDaysActive, 10),
        minUniqueContracts: Math.max(prev.minUniqueContracts, 3),
        minScore: Math.min(nextMinScore, prev.maxScore),
        maxFarmPercent: Math.min(prev.maxFarmPercent, 35),
        sortBy: 'farm_desc'
      };
    });
  };

  const syncUrlWith = (walletsRaw: string, normalizedWallets: string[]) => {
    if (!isHydrated) {
      return;
    }

    const rawTooLong = walletsRaw.length > 1500 && normalizedWallets.length > 0;
    setShareWarning(
      rawTooLong ? 'Wallet list is long; share link uses normalized wallets.' : null
    );

    const params = serializeProofState({
      walletsRaw,
      normalizedWallets,
      windowType,
      criteriaSetId: safeCriteriaSetId,
      filters
    });

    const nextSearch = params.toString();
    const currentSearch =
      typeof window !== 'undefined'
        ? window.location.search.replace(/^\?/, '')
        : searchParams.toString();

    if (nextSearch === currentSearch || nextSearch === lastSearchRef.current) {
      return;
    }

    lastSearchRef.current = nextSearch;
    const nextUrl = nextSearch ? `${pathname}?${nextSearch}` : pathname;
    router.replace(nextUrl, { scroll: false });
  };

  const normalizeAndSet = (rawInput: string, syncNow = false) => {
    const normalized = normalizeWalletInputs(rawInput);
    const normalizedList = normalized.inputs
      .filter((entry) => entry.kind !== 'invalid')
      .map((entry) => entry.normalized ?? entry.raw);
    const nextValue = normalizedList.join('\n');
    setInputValue(nextValue);
    if (syncNow) {
      syncUrlWith(nextValue, normalizedList);
    }
  };

  const handleNormalize = () => {
    normalizeAndSet(inputValue, true);
  };

  const handlePasteSample = async () => {
    setSampleLoading(true);
    setError(null);

    try {
      const wallets = await fetchMockWallets(campaignId, 20);
      const mixed = injectEnsSamples(wallets, 20);
      normalizeAndSet(mixed.join('\n'), true);
    } catch {
      normalizeAndSet(injectEnsSamples([...fallbackSampleWallets], 20).join('\n'), true);
    } finally {
      setSampleLoading(false);
    }
  };

  const handleClear = () => {
    setInputValue('');
    setRows([]);
    setSelected(null);
    setError(null);
    setProgress({ processed: 0, total: 0 });
    setEnsResolution(null);
    setGateInvalids([]);
    setDeterminismCheck(null);
    setProofArtifactSeed(null);
    setProofPackageHashes(null);
    setManifestCopyStatus(null);
    setRunHistory([]);
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const handleRetryUnresolvedEns = async () => {
    if (!ensResolution?.unresolved.length) {
      return;
    }

    setEnsRetrying(true);
    setError(null);
    try {
      const retry = await resolveEnsBatch(ensResolution.unresolved, {
        concurrency: 5
      });
      setEnsResolution((prev) => {
        if (!prev) {
          return retry;
        }
        const mergedResolved = { ...prev.resolved, ...retry.resolved };
        const unresolved = Object.keys(mergedResolved).filter(
          (name) => !mergedResolved[name]?.address
        );
        return { resolved: mergedResolved, unresolved };
      });
    } catch (err) {
      if (!isAbortError(err)) {
        setError('Failed to retry ENS resolution.');
      }
    } finally {
      setEnsRetrying(false);
    }
  };

  const runDeterminismCheck = async (
    merged: ProofWalletRow[],
    gateResult: EvaluationWalletGateResult,
    usageWindow: ReturnType<typeof buildUsageWindow>,
    runId: number
  ) => {
    const candidate = gateResult.wallets.find((wallet) => {
      const source = gateResult.sourcesByAddress.get(wallet);
      return Boolean(source?.hasEns && source?.hasAddress);
    });
    if (!candidate) {
      setDeterminismCheck(null);
      return;
    }

    const source = gateResult.sourcesByAddress.get(candidate);
    const ensName = source?.ensNames[0];
    const row = merged.find((entry) => entry.wallet.toLowerCase() === candidate);
    const proofHash = row?.output?.proof?.canonical_hash;
    if (!proofHash) {
      setDeterminismCheck({ status: 'mismatch', address: candidate, ensName });
      return;
    }

    try {
      const response = await demoApiFetch<ProofEvaluateResponse>('/v1/evaluate', {
        method: 'POST',
        body: JSON.stringify({
          wallet: candidate,
          campaign_id: campaignId,
          window: usageWindow
        })
      });
      if (runIdRef.current !== runId) {
        return;
      }
      const match = response.output.proof.canonical_hash === proofHash;
      setDeterminismCheck({
        status: match ? 'ok' : 'mismatch',
        address: candidate,
        ensName
      });
    } catch {
      if (runIdRef.current !== runId) {
        return;
      }
      setDeterminismCheck({ status: 'mismatch', address: candidate, ensName });
    }
  };

  const handleRun = async () => {
    if (isDecisionLocked) {
      setError('Decision is finalized. Unlocking is not available in this artifact.');
      return;
    }

    if (!baseUrl) {
      setError(
        'NEXT_PUBLIC_API_BASE_URL is not set. Add it to your frontend environment.'
      );
      return;
    }

    const normalized = normalizeWalletInputs(inputValue);
    if (!normalized.addresses.length && !normalized.ensNames.length) {
      setError('Enter at least one valid wallet or ENS name.');
      return;
    }

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;

    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setRows([]);
    setSelected(null);
    setEnsResolution(null);
    setGateInvalids([]);
    setDeterminismCheck(null);
    setProgress({ processed: 0, total: 0 });

    try {
      let ensResult: EnsBatchResult = { resolved: {}, unresolved: [] };
      if (normalized.ensNames.length) {
        ensResult = await resolveEnsBatch(normalized.ensNames, {
          concurrency: 5,
          signal: controller.signal
        });
        setEnsResolution(ensResult);

        if (isDev) {
          const errorCounts = ensResult.unresolved.reduce<Record<string, number>>(
            (acc, name) => {
              const reason = ensResult.resolved[name]?.error ?? 'not_found';
              acc[reason] = (acc[reason] ?? 0) + 1;
              return acc;
            },
            {}
          );
          const resolvedCount = Object.values(ensResult.resolved).filter(
            (entry) => Boolean(entry.address)
          ).length;
          console.info('[ens] resolve summary', {
            total: normalized.ensNames.length,
            resolved: resolvedCount,
            unresolved: ensResult.unresolved.length,
            errors: errorCounts
          });
        }
      }

      const gateResult: EvaluationWalletGateResult = buildEvaluationWallets(
        normalized.inputs,
        ensResult.resolved
      );
      setGateInvalids(gateResult.invalid);

      const orderedAddresses = gateResult.wallets;
      const addressMeta = gateResult.metaByAddress;

      if (!orderedAddresses.length) {
        setError('No resolvable wallets to evaluate.');
        return;
      }

      setProgress({ processed: 0, total: orderedAddresses.length });

      const applyMeta = (row: ProofWalletRow): ProofWalletRow => {
        const meta = addressMeta.get(row.wallet.toLowerCase());
        if (!meta) {
          return { ...row, input_source: row.input_source ?? 'address' };
        }
        return {
          ...row,
          display_name: meta.display_name ?? null,
          input_source: meta.input_source,
          ens_cached: meta.ens_cached ?? false
        };
      };

      const usageWindow = buildUsageWindow(windowType);
      const result = await runProofEvaluation({
        wallets: orderedAddresses,
        campaignId,
        window: usageWindow,
        criteriaSetId: safeCriteriaSetId,
        signal: controller.signal,
        onProgress: (nextProgress) => {
          setProgress({
            processed: nextProgress.processed,
            total: nextProgress.total
          });
          setRows(nextProgress.rows.map(applyMeta));
        }
      });

      if (!controller.signal.aborted) {
        const merged = result.rows.map(applyMeta);
        setRows(merged);
        setProofArtifactSeed({
          walletSnapshot: [...orderedAddresses],
          criteriaSetId: safeCriteriaSetId,
          windowType
        });
        if (isDev) {
          console.info('[proof] run summary', {
            evaluated: merged.length,
            source: result.source
          });
        }
        if (isDev) {
          void runDeterminismCheck(merged, gateResult, usageWindow, runId);
        }
        const snapshot = buildRunSnapshot({
          id: runId,
          rows: merged,
          filters,
          criteriaSetId: safeCriteriaSetId,
          windowType
        });
        setRunHistory((prev) => [...prev.slice(-3), snapshot]);
      }
    } catch (err: unknown) {
      if (isAbortError(err)) {
        setError('Run cancelled.');
      } else {
        const message = err instanceof Error ? err.message : 'Unexpected error.';
        setError(message);
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const hasResults = rows.length > 0;
  const progressPercent = progress.total
    ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
    : 0;
  const lowValueWalletPercent = summary.total
    ? (summary.verified_false / summary.total) * 100
    : 0;
  const highValueWalletPercent = summary.total
    ? (summary.verified_true / summary.total) * 100
    : 0;
  const estimatedWastedBudget = campaignBudget * (lowValueWalletPercent / 100);
  const suggestedEligibleWallets = autoOptimizeDistribution
    ? optimizationInsight?.eligibleAfter ?? summary.verified_true
    : summary.verified_true;
  const optimizedRecipientCount = Math.max(0, suggestedEligibleWallets);
  const optimizedAllocation = optimizedRecipientCount
    ? campaignBudget / optimizedRecipientCount
    : 0;
  const budgetSaved = autoOptimizeDistribution ? estimatedWastedBudget : 0;
  const potentialRoiImprovement = autoOptimizeDistribution
    ? optimizationInsight?.riskReductionPct ?? lowValueWalletPercent
    : 0;
  const proofParticipants = useMemo(
    () =>
      sortedResults
        .filter((entry) => entry.output && !entry.error && entry.output.verified_usage)
        .map((entry) => ({
          wallet: entry.wallet,
          score: entry.insights?.overall_score ?? 0,
          walletAgeDays: Math.max(entry.output?.usage_summary.days_active ?? 0, 1),
          activeDaysLast14: Math.min(entry.output?.usage_summary.days_active ?? 0, 14),
          proofUsageEvents: entry.output?.usage_summary.tx_count ?? 0
        })),
    [sortedResults]
  );
  const userTypeBreakdown = useMemo(() => {
    return sortedResults.reduce(
      (acc, entry) => {
        if (!entry.output || entry.error) {
          return acc;
        }
        const userType = classifyUserType(entry);
        acc[userType] += 1;
        return acc;
      },
      { Farmer: 0, Real: 0, Whale: 0 } as Record<'Farmer' | 'Real' | 'Whale', number>
    );
  }, [sortedResults]);
  const handleExportCsv = () => {
    exportProofCsv({
      rows: sortedResults,
      campaignId,
      windowType,
      criteriaSetId: safeCriteriaSetId
    });
  };
  const handleCopyShareLink = async () => {
    if (typeof window === 'undefined' || !navigator?.clipboard?.writeText) {
      return;
    }

    const rawTooLong = inputValue.length > 1500 && validEntries > 0;
    setShareWarning(
      rawTooLong ? 'Wallet list is long; share link uses normalized wallets.' : null
    );

    const params = serializeProofState({
      walletsRaw: inputValue,
      normalizedWallets: normalizedInputList,
      windowType,
      criteriaSetId: safeCriteriaSetId,
      filters
    });

    const nextSearch = params.toString();
    const nextUrl = nextSearch ? `${pathname}?${nextSearch}` : pathname;
    router.replace(nextUrl, { scroll: false });

    const url = nextSearch
      ? `${window.location.origin}${pathname}?${nextSearch}`
      : `${window.location.origin}${pathname}`;

    try {
      await navigator.clipboard.writeText(url);
      setShareStatus('Copied share link.');
    } catch {
      setShareStatus('Failed to copy link.');
    }

    setTimeout(() => setShareStatus(null), 1500);
  };
  const handleCopyProofs = async () => {
    if (!navigator?.clipboard?.writeText) {
      return;
    }
    if (!sortedResults.length) {
      setProofCopyStatus('No proofs to copy.');
      setTimeout(() => setProofCopyStatus(null), 1500);
      return;
    }

    let proofCount = 0;
    let missingCount = 0;
    const lines = sortedResults.map((row) => {
      const proofHash = row.output?.proof.canonical_hash;
      if (proofHash) {
        proofCount += 1;
        return `${row.wallet}  ${proofHash}`;
      }
      missingCount += 1;
      return `${row.wallet}  MISSING_PROOF`;
    });

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      const suffix = missingCount ? ` (${missingCount} missing)` : '';
      const label = proofCount ? `Copied ${proofCount} proofs${suffix}.` : 'No proofs to copy.';
      setProofCopyStatus(label);
    } catch {
      setProofCopyStatus('Failed to copy proofs.');
    }

    setTimeout(() => setProofCopyStatus(null), 1500);
  };
  const handleCopyManifest = async () => {
    if (!navigator?.clipboard?.writeText || !proofManifestJson) {
      return;
    }

    try {
      await navigator.clipboard.writeText(proofManifestJson);
      setManifestCopyStatus('Copied manifest JSON.');
    } catch {
      setManifestCopyStatus('Failed to copy manifest.');
    }

    setTimeout(() => setManifestCopyStatus(null), 1500);
  };

  const handleDownloadInputHashReference = () => {
    if (!inputHashReferenceText) {
      return;
    }
    downloadTextFile('input-dataset-hash-reference.txt', inputHashReferenceText, 'text/plain');
  };

  const handleDownloadPolicyJson = () => {
    if (!proofPolicyJson) {
      return;
    }
    downloadTextFile('policy.json', proofPolicyJson, 'application/json');
  };

  const handleDownloadEngineMetadata = () => {
    if (!engineMetadataJson) {
      return;
    }
    downloadTextFile('engine-version-metadata.json', engineMetadataJson, 'application/json');
  };

  const handleExportDecisionPackage = () => {
    if (!decisionPackageExportJson) {
      setPackageExportStatus('Decision package unavailable.');
      setTimeout(() => setPackageExportStatus(null), 1500);
      return;
    }

    downloadTextFile(
      `decision-package-${campaignId}.json`,
      decisionPackageExportJson,
      'application/json'
    );
    setPackageExportStatus('Exported decision package.');
    setTimeout(() => setPackageExportStatus(null), 1500);
  };

  const handleAdjustCriteria = () => {
    if (isDecisionLocked) {
      return;
    }
    filtersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCompareRuns = () => {
    compareRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleMarkFinalDecision = () => {
    if (!rows.length) {
      setError('Run and review the decision before finalizing it.');
      return;
    }
    setIsFinalDecision(true);
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(248,113,113,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(34,197,94,0.14),_transparent_30%),linear-gradient(135deg,rgba(10,15,28,0.98),rgba(15,23,42,0.92))] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.35)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-slate-400">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                Airdrop ROI Engine
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                Campaign {campaignId}
              </span>
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Detect waste, reallocate budget, and launch a stronger airdrop.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200">
              Show how much budget is leaking to low-value wallets, then optimize distribution
              around the users most likely to create value.
            </p>
          </div>
          <div className="grid gap-2 rounded-[1.5rem] border border-white/10 bg-black/20 p-4 text-xs uppercase tracking-[0.18em] text-slate-300 sm:grid-cols-5">
            {['Upload', 'Analyze', 'Optimize', 'Launch', 'Results'].map((step, index) => (
              <div
                key={step}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-center"
              >
                {index + 1}. {step}
              </div>
            ))}
          </div>
        </div>

        {hasResults && !loading ? (
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <div className="rounded-[1.75rem] border border-rose-400/30 bg-rose-500/10 p-6">
              <p className="text-xs uppercase tracking-[0.22em] text-rose-200">
                Estimated Wasted Budget
              </p>
              <p className="mt-3 text-4xl font-semibold text-white">
                {formatUsd(estimatedWastedBudget)}
              </p>
              <p className="mt-2 text-sm text-rose-100/80">
                Equal distribution would send this much to low-value wallets.
              </p>
            </div>
            <div className="rounded-[1.75rem] border border-amber-400/30 bg-amber-500/10 p-6">
              <p className="text-xs uppercase tracking-[0.22em] text-amber-100">
                Low-Value Wallets
              </p>
              <p className="mt-3 text-4xl font-semibold text-white">
                {formatWholePercent(lowValueWalletPercent)}
              </p>
              <p className="mt-2 text-sm text-amber-100/80">
                These wallets are the main source of reward leakage.
              </p>
            </div>
            <div className="rounded-[1.75rem] border border-emerald-400/30 bg-emerald-500/10 p-6">
              <p className="text-xs uppercase tracking-[0.22em] text-emerald-100">
                Potential ROI Improvement
              </p>
              <p className="mt-3 text-4xl font-semibold text-white">
                +{formatWholePercent(potentialRoiImprovement)}
              </p>
              <p className="mt-2 text-sm text-emerald-100/80">
                Estimated lift if you concentrate rewards on stronger wallets.
              </p>
            </div>
          </div>
        ) : null}
      </section>

      <PageHeader
        eyebrow="ROI Analysis"
        title="Airdrop ROI Engine"
        subtitle="Upload wallets, detect low-value recipients, optimize your distribution, and launch with more confidence."
        actions={
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-400">
            Base URL: {baseUrl ?? 'Not set'}
          </div>
        }
      />

      {error && (
        <ErrorState title="Proof flow unavailable" description={error} />
      )}

      <WalletInput
        value={inputValue}
        onChange={setInputValue}
        onNormalize={handleNormalize}
        onPasteSample={handlePasteSample}
        onClear={handleClear}
        totalCount={totalEntries}
        validCount={validEntries}
        invalidCount={invalidEntries}
        ensTotal={ensStats.total}
        ensResolved={ensStats.resolved}
        ensUnresolved={ensStats.unresolved}
        disabled={loading || isDecisionLocked}
        loadingSample={sampleLoading}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Analyze</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Run ROI Analysis</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Identify low-value wallets, estimate wasted budget, and quantify how much stronger the
            campaign becomes after filtering.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRun}
              disabled={loading || validEntries === 0 || !baseUrl || isDecisionLocked}
              className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-black transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-white/40 disabled:text-slate-500"
            >
              {loading ? 'Running ROI Analysis...' : 'Run ROI Analysis'}
            </button>
            {loading ? (
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-full border border-white/10 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300 hover:text-white"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Optimize</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Optimize Your Distribution</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm text-slate-300">
              Total campaign budget
              <input
                type="number"
                min={0}
                step={100}
                value={campaignBudget}
                onChange={(event) => setCampaignBudget(Number(event.target.value || 0))}
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
              />
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={autoOptimizeDistribution}
                onChange={(event) => setAutoOptimizeDistribution(event.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-transparent"
              />
              Auto-optimize distribution
            </label>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                Optimized Allocation
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatUsd(optimizedAllocation)}</p>
            </div>
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-100">
                Budget Saved
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatUsd(budgetSaved)}</p>
            </div>
            <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-sky-100">
                Efficiency Improvement
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                +{formatWholePercent(potentialRoiImprovement)}
              </p>
            </div>
          </div>
        </section>
      </div>

      {invalidList.length > 0 && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs uppercase tracking-[0.2em] text-rose-200">
              Invalid entries
            </span>
            <div className="flex flex-wrap items-center gap-3 text-xs text-rose-200">
              {hasUnresolvedEns && (
                <button
                  type="button"
                  onClick={handleRetryUnresolvedEns}
                  disabled={ensRetrying || loading || isDecisionLocked}
                  className="rounded-full border border-rose-400/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-100 transition hover:text-white disabled:cursor-not-allowed disabled:text-rose-300/60"
                >
                  {ensRetrying ? 'Retrying...' : 'Retry unresolved ENS'}
                </button>
              )}
              <span>{invalidList.length} items</span>
            </div>
          </div>
          <div className="mt-3 grid gap-2 text-xs">
            {invalidList.map((entry) => {
              const hint = ensErrorHints[entry.reason];
              return (
                <div
                  key={`${entry.value}-${entry.reason}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="font-mono text-rose-100">{entry.value}</span>
                    {hint && (
                      <span className="text-[10px] uppercase tracking-[0.2em] text-rose-200/70">
                        {hint}
                      </span>
                    )}
                  </div>
                  <span className="rounded-full border border-rose-400/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-rose-200">
                    {entry.reason}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isDev && determinismCheck && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="uppercase tracking-[0.2em]">
              {determinismCheck.status === 'ok'
                ? 'Determinism OK'
                : 'Determinism mismatch'}
            </span>
            <span className="font-mono text-emerald-200/80">
              {determinismCheck.ensName ?? determinismCheck.address}
            </span>
          </div>
        </div>
      )}

      {hasResults && !loading && (
        <>
          <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(15,23,42,0.9))] p-6">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Analysis Output</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Budget Waste Summary</h2>
            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
                <p className="text-lg font-semibold text-white">
                  You are wasting approximately {formatUsd(estimatedWastedBudget)} of your
                  airdrop budget.
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {formatWholePercent(lowValueWalletPercent)} of wallets look low-value and{' '}
                  {formatWholePercent(highValueWalletPercent)} qualify as higher-value recipients
                  under the current analysis.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    % low-value wallets
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-white">
                    {formatWholePercent(lowValueWalletPercent)}
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    % high-value wallets
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-white">
                    {formatWholePercent(highValueWalletPercent)}
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Estimated wasted budget
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-white">
                    {formatUsd(estimatedWastedBudget)}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[1.75rem] border border-rose-400/20 bg-[linear-gradient(180deg,rgba(244,63,94,0.12),rgba(15,23,42,0.55))] p-6">
              <p className="text-xs uppercase tracking-[0.22em] text-rose-200">
                Before Optimization
              </p>
              <p className="mt-3 text-xl font-semibold text-white">Equal distribution, high waste</p>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-200">
                <p>Every wallet gets the same allocation regardless of quality.</p>
                <p>{formatUsd(estimatedWastedBudget)} is likely wasted on low-value recipients.</p>
                <p>{summary.verified_false} wallets drag down campaign ROI.</p>
              </div>
            </div>
            <div className="rounded-[1.75rem] border border-emerald-400/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.12),rgba(15,23,42,0.55))] p-6">
              <p className="text-xs uppercase tracking-[0.22em] text-emerald-100">
                After Optimization
              </p>
              <p className="mt-3 text-xl font-semibold text-white">
                Filtered wallets, concentrated allocation, improved ROI
              </p>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-200">
                <p>{optimizedRecipientCount} stronger wallets receive the concentrated budget.</p>
                <p>{formatUsd(budgetSaved)} is preserved for higher-value users.</p>
                <p>Projected efficiency improves by +{formatWholePercent(potentialRoiImprovement)}.</p>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Campaign Launch</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Launch Optimized Campaign</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Use the optimized distribution result below, then open advanced settings only if
                  you need deeper campaign controls.
                </p>
              </div>
              <a
                href="#launch-your-campaign"
                className="inline-flex items-center justify-center rounded-full bg-emerald-400 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-950 transition hover:bg-emerald-300"
              >
                Launch with Optimized Allocation
              </a>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(15,23,42,0.9))] p-6">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Results Dashboard</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Business Outcome Snapshot</h2>
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <div className="rounded-[1.5rem] border border-emerald-400/20 bg-emerald-500/10 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-100">ROI improvement</p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  +{formatWholePercent(potentialRoiImprovement)}
                </p>
                <p className="mt-2 text-sm text-emerald-100/80">High-value users rewarded.</p>
              </div>
              <div className="rounded-[1.5rem] border border-sky-400/20 bg-sky-500/10 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-sky-100">Budget saved</p>
                <p className="mt-2 text-3xl font-semibold text-white">{formatUsd(budgetSaved)}</p>
                <p className="mt-2 text-sm text-sky-100/80">Low-value wallets filtered out.</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Wallet segmentation breakdown
                </p>
                <div className="mt-3 space-y-2 text-sm text-slate-200">
                  <p>Whale: {userTypeBreakdown.Whale}</p>
                  <p>Real: {userTypeBreakdown.Real}</p>
                  <p>Farmer: {userTypeBreakdown.Farmer}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Wallet Review</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Wallet Value Breakdown</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Review who looks real, who looks risky, and where expected value is concentrated.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportCsv}
                className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 hover:text-white"
              >
                Export optimized distribution result
              </button>
            </div>
            <div className="mt-5">
              <ProofTable
                results={sortedResults}
                insightsEnabled={insightsEnabled}
                onSelect={(row) => setSelected(row)}
              />
            </div>
          </section>
        </>
      )}

      <details className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,23,42,0.88))] p-5">
        <summary className="cursor-pointer list-none text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">
          Advanced Decision Status
        </summary>
        <div className="mt-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Final Decision Status
            </p>
            <p className="mt-2 text-lg font-semibold text-white">
              Promote this output from working draft to official campaign artifact.
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Finalization locks policy, allocation, and proof generation so the exported package represents the exact decision approved for campaign execution.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(['draft', 'reviewed', 'finalized'] as FinalDecisionStatus[]).map((status) => (
              <span
                key={status}
                className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                  finalDecisionStatus === status
                    ? decisionStatusClass(status)
                    : 'border-white/10 bg-white/5 text-slate-500'
                }`}
              >
                {status} decision
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
            {finalDecisionStatus === 'draft' && 'Decision is still in draft mode. Run and review the artifact before finalizing.'}
            {finalDecisionStatus === 'reviewed' && 'Decision has been reviewed and can now be locked as the official campaign artifact.'}
            {finalDecisionStatus === 'finalized' && 'Decision is finalized. Policy, allocation, and proof are locked for execution.'}
          </div>
          <button
            type="button"
            onClick={handleMarkFinalDecision}
            disabled={finalDecisionStatus !== 'reviewed'}
            className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100 hover:bg-emerald-500/20 hover:text-white disabled:cursor-not-allowed disabled:text-emerald-100/50"
          >
            Mark as final decision
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {(['Policy', 'Allocation', 'Proof'] as const).map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm"
            >
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{item}</p>
              <p className="mt-2 font-semibold text-white">
                {isDecisionLocked ? 'Locked' : 'Editable'}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {isDecisionLocked
                  ? `${item} is frozen in the final decision artifact.`
                  : `${item} can still change before finalization.`}
              </p>
            </div>
          ))}
        </div>
        </div>
      </details>

      <details className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <summary className="cursor-pointer list-none text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">
          Advanced Analysis Controls
        </summary>
        <div className="mt-4">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Window
            <select
              value={windowType}
              onChange={(event) =>
                setWindowType(event.target.value as ProofWindowType)
              }
              disabled={loading || isDecisionLocked}
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
            >
              <option value="last_7_days">Last 7 days</option>
              <option value="last_30_days">Last 30 days</option>
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Criteria set
            <select
              value={criteriaSetId}
              onChange={(event) => {
                const next = event.target.value;
                if (isCriteriaSetId(next)) {
                  setCriteriaSetId(next);
                }
              }}
              disabled={loading || isDecisionLocked}
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
            >
              {criteriaSetIds.map((id) => (
                <option
                  key={id}
                  value={id}
                  disabled={!criteriaPresets[id].enabled}
                  title={criteriaPresets[id].hint}
                >
                  {criteriaPresets[id].label}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-500">
              Criteria sets are sent to the API; additional presets are coming soon.
            </span>
          </label>

          <div className="flex flex-col justify-end gap-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleRun}
                disabled={loading || validEntries === 0 || !baseUrl || isDecisionLocked}
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-black transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-white/40 disabled:text-slate-500"
              >
                {loading ? 'Running...' : 'Run'}
              </button>
              {loading && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-full border border-white/10 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={handleCopyShareLink}
                className="rounded-full border border-white/10 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300 hover:text-white"
              >
                Copy share link
              </button>
            </div>
            {(shareStatus || shareWarning) && (
              <div className="text-xs text-slate-400">
                {shareStatus ?? shareWarning}
              </div>
            )}
          </div>
        </div>

        {loading && (
          <div className="mt-4 space-y-2">
            <div className="text-sm text-slate-300">
              Processed {progress.processed} / {progress.total}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-400/80 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
        </div>
      </details>

      <details className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,23,42,0.86))] p-5">
        <summary className="cursor-pointer list-none text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">
          Advanced Optimization History
        </summary>
        <div className="mt-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Iterate Decision
            </p>
            <p className="mt-2 text-lg font-semibold text-white">
              Treat each run as a versioned decision, not a one-off output.
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Adjust the criteria, re-run the evaluator, and compare the latest decision against the previous version before locking policy.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleAdjustCriteria}
              disabled={isDecisionLocked}
              className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 hover:text-white"
            >
              Adjust criteria
            </button>
            <button
              type="button"
              onClick={handleRun}
              disabled={loading || validEntries === 0 || !baseUrl || isDecisionLocked}
              className="rounded-full border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-100 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:text-sky-100/50"
            >
              Re-run evaluation
            </button>
            <button
              type="button"
              onClick={handleCompareRuns}
              disabled={!runComparison}
              className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:text-emerald-100/50"
            >
              Compare runs
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Latest run</p>
            <p className="mt-2 text-xl font-semibold text-white">
              {latestRun?.label ?? 'No runs yet'}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {latestRun
                ? `${latestRun.eligibleCount} eligible • ${Math.round(latestRun.riskRate)}% risk`
                : 'Run the evaluator to create a decision version.'}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Comparison status</p>
            <p className="mt-2 text-xl font-semibold text-white">
              {runComparison ? `${runComparison.from.label} vs ${runComparison.to.label}` : 'Waiting for v2'}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {runComparison
                ? 'Decision drift is measurable across eligibility, risk, and allocation.'
                : 'Complete at least two runs to unlock comparison.'}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Criteria snapshot</p>
            <p className="mt-2 text-xl font-semibold text-white">{safeCriteriaSetId}</p>
            <p className="mt-1 text-xs text-slate-400">
              Current thresholds: score {filters.minScore}-{filters.maxScore}, farm max {filters.maxFarmPercent}%
            </p>
          </div>
        </div>
        </div>
      </details>

      {hasResults && !loading && <ProofKpis summary={summary} insightsEnabled={insightsEnabled} />}

      {runComparison && (
        <div
          ref={compareRef}
          className="rounded-3xl border border-emerald-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_42%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,23,42,0.84))] p-6"
        >
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/80">
                Compare Runs
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {runComparison.from.label} vs {runComparison.to.label}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-200">
                This comparison turns the decision into an iterative process by showing how eligibility, risk posture, and estimated allocation move when the policy changes.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                Windows / criteria
              </p>
              <p className="mt-2 text-sm font-semibold text-white">
                {runComparison.from.windowType} {'->'} {runComparison.to.windowType}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {runComparison.from.criteriaSetId} {'->'} {runComparison.to.criteriaSetId}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                Eligible difference
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {formatSignedCount(runComparison.eligibleDifference)}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {runComparison.from.eligibleCount} {'->'} {runComparison.to.eligibleCount} wallets
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                Risk difference
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {formatSignedPercent(runComparison.riskDifference)}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {Math.round(runComparison.from.riskRate)}% {'->'} {Math.round(runComparison.to.riskRate)}% high-risk share
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                Allocation difference
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {formatSignedDecimal(runComparison.allocationDifference)}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {runComparison.from.estimatedAvgAllocation.toFixed(2)} {'->'} {runComparison.to.estimatedAvgAllocation.toFixed(2)} est. avg allocation
              </p>
            </div>
          </div>
        </div>
      )}

      {hasResults && !loading && (
        <details className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <summary className="cursor-pointer list-none text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">
            Advanced Campaign Settings
          </summary>
          <div className="mt-5">
            <LaunchYourCampaignCard participants={proofParticipants} supportsProofUsageFilter />
          </div>
        </details>
      )}

      {hasResults && !loading && proofPackageManifest && (
        <details className="rounded-[2rem] border border-white/10 bg-black/20 p-6">
          <summary className="cursor-pointer list-none text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">
            Advanced Proof And Policy Details
          </summary>
          <div className="mt-5">
            <DecisionProduct
              campaignId={campaignId}
              finalDecisionStatus={finalDecisionStatus}
              summary={summary}
              validEntries={validEntries}
              decisionConfidence={decisionConfidence}
              sortedResults={sortedResults}
              insightsEnabled={insightsEnabled}
              filters={filters}
              setFilters={setFilters}
              sortLabel={sortLabelMap[filters.sortBy]}
              errorCount={errorCount}
              topErrorHint={topErrorHint}
              proofPackageManifest={proofPackageManifest}
              riskAnalysis={riskAnalysis}
              loading={loading}
              baseUrl={baseUrl}
              isDecisionLocked={isDecisionLocked}
              filtersRef={filtersRef}
              shareStatus={shareStatus}
              proofCopyStatus={proofCopyStatus}
              manifestCopyStatus={manifestCopyStatus}
              packageExportStatus={packageExportStatus}
              onFinalizeDecision={handleMarkFinalDecision}
              onRerunEvaluation={handleRun}
              onExportResults={handleExportCsv}
              onCopyShareLink={handleCopyShareLink}
              onCopyProofs={handleCopyProofs}
              onCopyManifest={handleCopyManifest}
              onExportDecisionPackage={handleExportDecisionPackage}
              onApplySaferConfiguration={handleApplySaferConfiguration}
              onDownloadInputHashReference={handleDownloadInputHashReference}
              onDownloadPolicyJson={handleDownloadPolicyJson}
              onDownloadEngineMetadata={handleDownloadEngineMetadata}
              onSelectWallet={(row) => setSelected(row)}
            />
          </div>
        </details>
      )}

      <WalletDetailModal
        row={selected}
        onClose={() => setSelected(null)}
        insightsEnabled={insightsEnabled}
      />
    </div>
  );
};

const DemoProofPage = () => {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
            Loading proof demo...
          </div>
        </div>
      }
    >
      <DemoProofPageInner />
    </Suspense>
  );
};

export default DemoProofPage;
