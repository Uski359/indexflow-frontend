import { z } from 'zod';

import {
  allocationTransforms,
  campaignTypes,
  roundingRules,
  type CampaignDraft
} from './types';

const dateTimeSchema = z.string().datetime();

export const campaignDraftSchema = z
  .object({
    name: z.string().trim().min(3, 'Campaign name must be at least 3 characters.'),
    type: z.enum(campaignTypes),
    budget: z.number().positive('Budget must be greater than 0.'),
    startDate: dateTimeSchema,
    endDate: dateTimeSchema,
    maxPerWallet: z.number().positive('Max per wallet must be greater than 0.'),
    minPerWallet: z.number().min(0, 'Min per wallet cannot be negative.'),
    maxSharePercent: z
      .number()
      .min(0, 'Max share percent cannot be negative.')
      .max(5, 'Max share percent must stay at or below 5%.'),
    transform: z.enum(allocationTransforms),
    equalPercent: z
      .number()
      .min(0, 'Equal split cannot be negative.')
      .max(50, 'Equal split cannot exceed 50%.'),
    roundingRule: z.enum(roundingRules),
    minScore: z.number().min(0, 'Minimum score cannot be negative.'),
    walletAgeDays: z.number().min(0, 'Wallet age cannot be negative.'),
    activeDaysLast14: z
      .number()
      .min(0, 'Active days cannot be negative.')
      .max(14, 'Active days last 14 cannot exceed 14.'),
    proofUsageMinEvents: z
      .number()
      .min(0, 'Proof-of-usage minimum cannot be negative.')
      .optional(),
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

    if (draft.minPerWallet > draft.maxPerWallet) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Min per wallet cannot be greater than max per wallet.',
        path: ['minPerWallet']
      });
    }
  });

export const launchableCampaignDraftSchema = campaignDraftSchema.refine(
  (draft) => draft.termsAccepted,
  {
    message: 'Accept the final confirmation before launching.',
    path: ['termsAccepted']
  }
);

export const serializeCampaignDraft = (draft: CampaignDraft): string =>
  JSON.stringify(campaignDraftSchema.parse(draft));

export const deserializeCampaignDraft = (value: string): CampaignDraft =>
  campaignDraftSchema.parse(JSON.parse(value));
