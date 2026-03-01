import {
  campaignDraftSchema,
  deserializeCampaignDraft,
  serializeCampaignDraft
} from './schema';
import type { CampaignDraft } from './types';

export const CAMPAIGN_DRAFT_STORAGE_KEY = 'iflw_campaign_draft_v1';

const getStorage = (): Storage | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
};

const buildDefaultDate = (offsetDays: number): string => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString();
};

export const createDefaultCampaignDraft = (): CampaignDraft => ({
  name: '',
  type: 'airdrop',
  budget: 1000,
  startDate: buildDefaultDate(1),
  endDate: buildDefaultDate(8),
  maxPerWallet: 25,
  minPerWallet: 0,
  maxSharePercent: 0.5,
  transform: 'sqrt',
  equalPercent: 20,
  roundingRule: 'roundNearest',
  minScore: 60,
  walletAgeDays: 30,
  activeDaysLast14: 3,
  proofUsageMinEvents: 5,
  termsAccepted: false
});

export const toDateInputValue = (iso: string): string => {
  if (!iso) {
    return '';
  }

  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toISOString().slice(0, 10);
};

export const toIsoDate = (value: string): string =>
  value ? new Date(`${value}T00:00:00.000Z`).toISOString() : '';

export const loadCampaignDraft = async (): Promise<CampaignDraft | null> => {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  const raw = storage.getItem(CAMPAIGN_DRAFT_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return deserializeCampaignDraft(raw);
  } catch {
    let parsed: Partial<CampaignDraft>;
    try {
      parsed = JSON.parse(raw) as Partial<CampaignDraft>;
    } catch {
      storage.removeItem(CAMPAIGN_DRAFT_STORAGE_KEY);
      return null;
    }

    const migrated = campaignDraftSchema.parse({
      ...createDefaultCampaignDraft(),
      ...parsed
    });
    storage.setItem(CAMPAIGN_DRAFT_STORAGE_KEY, serializeCampaignDraft(migrated));
    return migrated;
  }
};

export const clearCampaignDraft = (): void => {
  const storage = getStorage();
  storage?.removeItem(CAMPAIGN_DRAFT_STORAGE_KEY);
};

export const saveCampaignDraft = async (draft: CampaignDraft): Promise<CampaignDraft> => {
  const storage = getStorage();
  const parsed = campaignDraftSchema.parse(draft);

  storage?.setItem(CAMPAIGN_DRAFT_STORAGE_KEY, serializeCampaignDraft(parsed));

  return parsed;
};
