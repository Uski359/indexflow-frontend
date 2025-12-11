'use client';

import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

import { useHealth } from '@/hooks/useHealth';

import Card from './Card';

const HealthStatus = () => {
  const { health, isLoading, error } = useHealth();

  const latestIndexedBlock = health?.latestIndexedBlock ?? null;
  const providerBlock = health?.providerBlock ?? null;
  const diff =
    latestIndexedBlock !== null && providerBlock !== null
      ? providerBlock - latestIndexedBlock
      : null;

  const statusIcon = isLoading ? (
    <Loader2 className="h-10 w-10 animate-spin text-accent" />
  ) : health?.synced ? (
    <CheckCircle2 className="h-10 w-10 text-green-400" />
  ) : (
    <AlertTriangle className="h-10 w-10 text-amber-400" />
  );

  return (
    <Card title="Indexer Health" subtitle="Latest sync status" className="h-full">
      <div className="flex items-center gap-3 rounded-lg bg-[#0f0f16] p-4">
        {statusIcon}
        <div className="flex-1">
          <p className="text-sm text-gray-400">Latest indexed block</p>
          <p className="text-2xl font-semibold text-white">
            {error ? 'Error' : isLoading ? '...' : latestIndexedBlock ?? 'N/A'}
          </p>
          <p className="text-sm text-gray-400">
            Provider: {providerBlock ?? 'N/A'}{' '}
            {diff !== null ? `(lag ${diff})` : ''}
          </p>
        </div>
        <div className="rounded-full bg-accent/10 px-3 py-1 text-xs text-accent">
          {error ? 'Error' : isLoading ? 'Checking' : health?.synced ? 'Healthy' : 'Catching up'}
        </div>
      </div>
    </Card>
  );
};

export default HealthStatus;
