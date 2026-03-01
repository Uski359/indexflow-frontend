'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import { useHealth } from '@/hooks/useHealth';

import Card from './Card';
import EmptyState from './ui/EmptyState';
import ErrorState from './ui/ErrorState';
import LoadingSkeleton from './ui/LoadingSkeleton';

const HealthStatus = () => {
  const { health, isLoading, error } = useHealth();

  if (error) {
    return (
      <Card title="Indexer Health" subtitle="Latest sync status" className="h-full">
        <ErrorState
          title="Health check unavailable"
          description="The indexer heartbeat could not be loaded."
          compact
        />
      </Card>
    );
  }

  if (isLoading && !health) {
    return (
      <Card title="Indexer Health" subtitle="Latest sync status" className="h-full">
        <LoadingSkeleton lines={4} className="py-2" />
      </Card>
    );
  }

  if (!health) {
    return (
      <Card title="Indexer Health" subtitle="Latest sync status" className="h-full">
        <EmptyState
          title="No heartbeat yet"
          description="The indexer has not reported a sync checkpoint for the selected chain."
          compact
        />
      </Card>
    );
  }

  const latestIndexedBlock = health?.latestIndexedBlock ?? null;
  const providerBlock = health?.providerBlock ?? null;
  const diff =
    latestIndexedBlock !== null && providerBlock !== null
      ? providerBlock - latestIndexedBlock
      : null;

  const statusIcon = health?.synced ? (
    <CheckCircle2 className="h-10 w-10 text-green-400" />
  ) : (
    <AlertTriangle className="h-10 w-10 text-amber-400" />
  );

  return (
    <Card title="Indexer Health" subtitle="Latest sync status" className="h-full">
      <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-background/50 p-4">
        {statusIcon}
        <div className="flex-1">
          <p className="text-sm text-slate-300">Latest indexed block</p>
          <p className="text-2xl font-semibold text-white">{latestIndexedBlock ?? 'N/A'}</p>
          <p className="text-sm text-slate-300">
            Provider: {providerBlock ?? 'N/A'}{' '}
            {diff !== null ? `(lag ${diff})` : ''}
          </p>
        </div>
        <div className="rounded-full bg-accent/10 px-3 py-1 text-xs text-accent">
          {health?.synced ? 'Healthy' : 'Catching up'}
        </div>
      </div>
    </Card>
  );
};

export default HealthStatus;
