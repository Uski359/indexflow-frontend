import {
  campaignDraftSchema,
  deserializeCampaignDraft,
  launchableCampaignDraftSchema,
  serializeCampaignDraft
} from './schema';
import type { CampaignDraft, CampaignLaunchResult } from './types';

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
  type: 'quest',
  budget: 1000,
  startDate: buildDefaultDate(1),
  endDate: buildDefaultDate(8),
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

  return deserializeCampaignDraft(raw);
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

const buildCampaignId = (draft: CampaignDraft): string =>
  draft.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'campaign';

const simulateCampaignLaunch = async (
  draft: CampaignDraft
): Promise<CampaignLaunchResult> => {
  await new Promise((resolve) => {
    window.setTimeout(resolve, 700);
  });

  return {
    mode: 'simulated',
    campaignId: buildCampaignId(draft),
    message: 'Launch simulated'
  };
};

export const launchCampaign = async (
  draft: CampaignDraft
): Promise<CampaignLaunchResult> => {
  const payload = launchableCampaignDraftSchema.parse(draft);

  try {
    const response = await fetch('/api/campaigns', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { id?: string; message?: string }
        | null;

      return {
        mode: 'api',
        campaignId: body?.id ?? buildCampaignId(payload),
        message: body?.message ?? 'Campaign launched'
      };
    }

    if (response.status !== 404) {
      const message = await response.text();
      throw new Error(message || 'Failed to launch campaign.');
    }
  } catch (error) {
    if (error instanceof Error && error.message !== 'Failed to fetch') {
      throw error;
    }
  }

  return simulateCampaignLaunch(payload);
};
