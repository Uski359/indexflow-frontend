import { launchableCampaignDraftSchema } from './schema';
import {
  appendCampaign,
  clearCampaignDraft,
  saveCampaignAllocations
} from './storage';
import {
  computeAllocationPlan,
  generatePreviewParticipants
} from './preview';
import type {
  CampaignDraft,
  CampaignLaunchResult,
  CampaignPreviewParticipant,
  CampaignRecord
} from './types';

type LaunchCampaignOptions = {
  participants?: CampaignPreviewParticipant[];
  supportsProofUsageFilter?: boolean;
};

const createCampaignId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `campaign-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

export const launchCampaign = async (
  draft: CampaignDraft,
  options?: LaunchCampaignOptions
): Promise<CampaignLaunchResult> => {
  const config = launchableCampaignDraftSchema.parse(draft);
  const participantPool =
    options?.participants && options.participants.length > 0
      ? options.participants
      : generatePreviewParticipants(200);
  const { allocations, preview } = computeAllocationPlan(config, participantPool, {
    supportsProofUsageFilter: options?.supportsProofUsageFilter ?? false
  });

  if (!preview.computedSuccessfully || allocations.length === 0) {
    throw new Error('Unable to compute allocations for the current campaign settings.');
  }

  const timestamp = new Date().toISOString();
  const campaign: CampaignRecord = {
    id: createCampaignId(),
    status: 'LIVE',
    snapshotAt: timestamp,
    createdAt: timestamp,
    config,
    preview
  };

  appendCampaign(campaign);
  saveCampaignAllocations(campaign.id, allocations);
  clearCampaignDraft();

  return {
    mode: 'local',
    campaignId: campaign.id,
    message: 'Campaign launched'
  };
};
