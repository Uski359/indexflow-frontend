'use client';

import { ArrowRightLeft, Clock3, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { formatEther } from 'viem';

import { featureToggles } from '@/config/features';
import { useTransfers } from '@/hooks/useTransfers';
import type { Transfer } from '@/types';

import Card from './Card';
import EmptyState from './ui/EmptyState';
import ErrorState from './ui/ErrorState';
import LoadingSkeleton from './ui/LoadingSkeleton';

type TransferTableProps = {
  limit?: number;
  address?: string;
  title?: string;
  subtitle?: string;
};

const shorten = (value: string, size = 4) =>
  value.length > size * 2 ? `${value.slice(0, size + 2)}...${value.slice(-size)}` : value;

const formatValue = (value: string) => {
  if (!value) {
    return 'N/A';
  }

  if (/^-?\d+$/.test(value)) {
    try {
      const eth = Number(formatEther(BigInt(value)));
      return `${eth.toLocaleString(undefined, { maximumFractionDigits: 4 })} IFLW`;
    } catch {
      // fall through to generic formatting
    }
  }

  const num = Number(value);
  if (Number.isNaN(num)) {
    return value;
  }

  if (num >= 1e6) {
    return `${num.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }

  return num.toLocaleString();
};

const formatTimestamp = (timestamp?: number | string) => {
  if (!timestamp) {
    return 'N/A';
  }

  const parsed = Number(timestamp);
  if (!Number.isNaN(parsed)) {
    const millis = parsed < 1e12 ? parsed * 1000 : parsed;
    return new Date(millis).toLocaleString();
  }

  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
};

const getExplorerUrl = (chain: string | undefined, txHash: string) => {
  const normalized = (chain ?? '').toLowerCase();
  const map: Record<string, string> = {
    sepolia: 'https://sepolia.etherscan.io/tx/',
    ethereum: 'https://etherscan.io/tx/',
    polygon: 'https://polygonscan.com/tx/',
    arbitrum: 'https://arbiscan.io/tx/',
    base: 'https://basescan.org/tx/',
    optimism: 'https://optimistic.etherscan.io/tx/'
  };

  return `${map[normalized] ?? map.ethereum}${txHash}`;
};

const TransferRow = ({ transfer }: { transfer: Transfer }) => {
  const block = transfer.blockNumber ?? transfer.block ?? 0;
  const valueDisplay = transfer.value ? formatValue(transfer.value) : 'N/A';
  const explorerUrl = getExplorerUrl(transfer.chain, transfer.txHash);

  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className="px-3 py-3 text-sm text-slate-300">{transfer.chain?.toUpperCase()}</td>
      <td className="px-3 py-3 text-sm text-slate-300">{block}</td>
      <td className="px-3 py-3 text-sm text-slate-300">
        <Link
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 font-mono text-xs text-accent hover:text-accent/80"
        >
          <span>{shorten(transfer.txHash, 5)}</span>
          <ExternalLink size={14} className="text-current" />
        </Link>
      </td>
      <td className="px-3 py-3 text-sm">
        <p className="font-mono text-xs text-slate-200">{shorten(transfer.from, 6)}</p>
      </td>
      <td className="px-3 py-3 text-sm">
        <p className="font-mono text-xs text-slate-200">{shorten(transfer.to, 6)}</p>
      </td>
      <td className="px-3 py-3 text-sm text-white">
        <span className="rounded-full bg-accent/10 px-2 py-1 text-xs text-accent">
          {valueDisplay}
        </span>
      </td>
      <td className="px-3 py-3 text-sm text-slate-400">{formatTimestamp(transfer.timestamp)}</td>
    </tr>
  );
};

const TransferTable = ({ limit, address, title, subtitle }: TransferTableProps) => {
  const { transfers, isLoading, error } = useTransfers({ address, limit });
  const computedTitle = title ?? (address ? 'Wallet activity' : 'Latest transfers');
  const computedSubtitle =
    subtitle ?? (address ? 'Incoming and outgoing transfers' : 'Live firehose of movement');
  const showViewAll = !address && featureToggles.transfers;
  const isInitialLoading = isLoading && transfers.length === 0;

  return (
    <Card
      title={computedTitle}
      subtitle={computedSubtitle}
      actions={
        showViewAll ? (
          <Link
            href="/transfers"
            className="flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs text-accent transition hover:bg-accent/20"
          >
            <ArrowRightLeft size={14} />
            <span>View all</span>
          </Link>
        ) : null
      }
      className="overflow-hidden"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border/70 text-xs uppercase tracking-[0.18em] text-slate-400">
              <th className="px-3 py-2">Chain</th>
              <th className="px-3 py-2">Block</th>
              <th className="px-3 py-2">Tx Hash</th>
              <th className="px-3 py-2">From</th>
              <th className="px-3 py-2">To</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">
                <div className="flex items-center gap-1">
                  <Clock3 size={14} />
                  <span>Timestamp</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {isInitialLoading ? (
              <tr>
                <td colSpan={7} className="px-3 py-4">
                  <LoadingSkeleton lines={5} className="py-2" />
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={7} className="px-3 py-4">
                  <ErrorState
                    title="Transfers unavailable"
                    description="Recent transfer data could not be loaded."
                    compact
                  />
                </td>
              </tr>
            ) : transfers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-4">
                  <EmptyState
                    title="No transfers found"
                    description={`No transfers were found for this ${address ? 'wallet or chain' : 'chain'} yet.`}
                    compact
                  />
                </td>
              </tr>
            ) : (
              transfers.map((transfer) => (
                <TransferRow
                  key={`${transfer.txHash}-${transfer.blockNumber ?? transfer.block ?? 0}-${transfer.from}-${transfer.to}`}
                  transfer={transfer}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default TransferTable;
