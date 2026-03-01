import { z } from 'zod';

import { campaignTypes, type CampaignDraft } from './types';

const dateTimeSchema = z.string().datetime();

export const campaignDraftSchema = z
  .object({
    name: z.string().trim().min(3, 'Campaign name must be at least 3 characters.'),
    type: z.enum(campaignTypes),
    budget: z.number().positive('Budget must be greater than 0.'),
    startDate: dateTimeSchema,
    endDate: dateTimeSchema,
    termsAccepted: z.boolean()
  })
  .superRefine((draft, context) => {
    const start = new Date(draft.startDate).getTime();
    const end = new Date(draft.endDate).getTime();

    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End date must be later than start date.',
        path: ['endDate']
      });
    }
  });

export const launchableCampaignDraftSchema = campaignDraftSchema.refine(
  (draft) => draft.termsAccepted,
  {
    message: 'Accept terms before launching.',
    path: ['termsAccepted']
  }
);

export const serializeCampaignDraft = (draft: CampaignDraft): string =>
  JSON.stringify(campaignDraftSchema.parse(draft));

export const deserializeCampaignDraft = (value: string): CampaignDraft =>
  campaignDraftSchema.parse(JSON.parse(value));
