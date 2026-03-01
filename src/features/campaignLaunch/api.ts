import { launchableCampaignDraftSchema } from './schema';
import type { CampaignDraft, CampaignLaunchResult } from './types';

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
    if (
      error instanceof Error &&
      error.name !== 'TypeError' &&
      error.message !== 'Failed to fetch'
    ) {
      throw error;
    }
  }

  return simulateCampaignLaunch(payload);
};
