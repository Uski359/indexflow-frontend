'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  clearCampaignDraft,
  createDefaultCampaignDraft,
  launchCampaign,
  loadCampaignDraft,
  saveCampaignDraft
} from './api';
import { campaignDraftSchema, launchableCampaignDraftSchema } from './schema';
import type { CampaignDraft, CampaignLaunchResult } from './types';

type FeedbackTone = 'neutral' | 'success' | 'danger';

type FeedbackState = {
  tone: FeedbackTone;
  message: string;
} | null;

type UseCampaignLaunchResult = {
  draft: CampaignDraft;
  hasStoredDraft: boolean;
  feedback: FeedbackState;
  draftValidationMessage: string | null;
  canLaunch: boolean;
  isLoading: boolean;
  isSaving: boolean;
  isLaunching: boolean;
  loadError: string | null;
  launchResult: CampaignLaunchResult | null;
  updateDraft: <Key extends keyof CampaignDraft>(key: Key, value: CampaignDraft[Key]) => void;
  saveDraft: () => Promise<void>;
  launch: () => Promise<void>;
  retryLoad: () => Promise<void>;
};

const campaignDraftQueryKey = ['campaign-launch', 'draft'];

export const useCampaignLaunch = (): UseCampaignLaunchResult => {
  const [draft, setDraft] = useState<CampaignDraft>(createDefaultCampaignDraft);
  const [hasStoredDraft, setHasStoredDraft] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [launchResult, setLaunchResult] = useState<CampaignLaunchResult | null>(null);

  const draftQuery = useQuery({
    queryKey: campaignDraftQueryKey,
    queryFn: loadCampaignDraft,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY
  });

  useEffect(() => {
    if (draftQuery.isSuccess) {
      const savedDraft = draftQuery.data;
      setDraft(savedDraft ?? createDefaultCampaignDraft());
      setHasStoredDraft(Boolean(savedDraft));
      setLoadError(null);
    }
  }, [draftQuery.data, draftQuery.isSuccess]);

  useEffect(() => {
    if (draftQuery.isError) {
      const message =
        draftQuery.error instanceof Error
          ? draftQuery.error.message
          : 'Failed to load campaign draft.';
      setLoadError(message);
      setFeedback({
        tone: 'danger',
        message
      });
      setHasStoredDraft(false);
    }
  }, [draftQuery.error, draftQuery.isError]);

  const saveMutation = useMutation({
    mutationFn: saveCampaignDraft,
    onSuccess: (savedDraft) => {
      setDraft(savedDraft);
      setHasStoredDraft(true);
      setFeedback({
        tone: 'success',
        message: 'Draft saved locally.'
      });
    },
    onError: (error) => {
      setFeedback({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Failed to save draft.'
      });
    }
  });

  const launchMutation = useMutation({
    mutationFn: launchCampaign,
    onSuccess: (result) => {
      setLaunchResult(result);
      setFeedback({
        tone: result.mode === 'api' ? 'success' : 'neutral',
        message: `${result.message} (${result.campaignId})`
      });
    },
    onError: (error) => {
      setFeedback({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Failed to launch campaign.'
      });
    }
  });

  const draftValidation = useMemo(() => campaignDraftSchema.safeParse(draft), [draft]);
  const canLaunch = useMemo(
    () => launchableCampaignDraftSchema.safeParse(draft).success,
    [draft]
  );

  const updateDraft = useCallback(
    <Key extends keyof CampaignDraft>(key: Key, value: CampaignDraft[Key]) => {
      setDraft((currentDraft) => ({
        ...currentDraft,
        [key]: value
      }));
      setFeedback(null);
      setLaunchResult(null);
    },
    []
  );

  const saveDraftAction = useCallback(async () => {
    await saveMutation.mutateAsync(draft);
  }, [draft, saveMutation]);

  const launchAction = useCallback(async () => {
    await launchMutation.mutateAsync(draft);
  }, [draft, launchMutation]);

  const retryLoad = useCallback(async () => {
    clearCampaignDraft();
    setDraft(createDefaultCampaignDraft());
    setFeedback(null);
    setLoadError(null);
    await draftQuery.refetch();
  }, [draftQuery]);

  return {
    draft,
    hasStoredDraft,
    feedback,
    draftValidationMessage: draftValidation.success
      ? null
      : draftValidation.error.issues[0]?.message ?? 'Draft is invalid.',
    canLaunch,
    isLoading: draftQuery.isLoading || draftQuery.isFetching,
    isSaving: saveMutation.isPending,
    isLaunching: launchMutation.isPending,
    loadError,
    launchResult,
    updateDraft,
    saveDraft: saveDraftAction,
    launch: launchAction,
    retryLoad
  };
};
