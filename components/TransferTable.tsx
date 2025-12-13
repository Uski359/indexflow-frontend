'use client';

import classNames from 'classnames';
import { ArrowRightLeft, ExternalLink, Clock3 } from 'lucide-react';
import Link from 'next/link';

import { useTransfers } from '@/hooks/useTransfers';
import type { Transfer } from '@/types';

import Card from './Card';

type TransferTableProps = {
  limit?: number;
  address?: string;
  title?: string;
  subtitle?: string;
};

const shorten = (value: string, size = 4) =>
  value.length > size * 2 ? `${value.slice(0, size + 2)}...${value.slice(-size)}` : value;

const formatValue = (value: string) => {
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  if (num >= 1e18) return `${(num / 1e18).toFixed(3)} IFLW`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toLocaleString();
};

const formatTimestamp = (timestamp?: number | string) => {
  if (!timestamp) return 'N/A';

  const parsed = Number(timestamp);
  if (!Number.isNaN(parsed)) {
    // If seconds, convert to ms
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

  const base = map[normalized] ?? map.ethereum;
  return `${base}${txHash}`;
};

const TransferRow = ({ transfer }: { transfer: Transfer }) => {
  const block = transfer.blockNumber ?? transfer.block ?? 0;
  const valueDisplay = transfer.value ? formatValue(transfer.value) : '—';
  const explorerUrl = getExplorerUrl(transfer.chain, transfer.txHash);

  return (
    <tr className="border-b border-[#1f1f2a] last:border-0">
      <td className="px-3 py-3 text-sm text-gray-300">{transfer.chain?.toUpperCase()}</td>
      <td className="px-3 py-3 text-sm text-gray-300">{block}</td>
      <td className="px-3 py-3 text-sm text-gray-300">
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
        <p className="font-mono text-xs text-gray-200">{shorten(transfer.from, 6)}</p>
      </td>
      <td className="px-3 py-3 text-sm">
        <p className="font-mono text-xs text-gray-200">{shorten(transfer.to, 6)}</p>
      </td>
      <td className="px-3 py-3 text-sm text-white">
        <span className="rounded-full bg-accent/10 px-2 py-1 text-xs text-accent">
          {valueDisplay}
        </span>
      </td>
      <td className="px-3 py-3 text-sm text-gray-400">{formatTimestamp(transfer.timestamp)}</td>
    </tr>
  );
};

const TransferTable = ({ limit, address, title, subtitle }: TransferTableProps) => {
  const { transfers, isLoading, error } = useTransfers({ address, limit });
  const computedTitle = title ?? (address ? 'Wallet activity' : 'Latest transfers');
  const computedSubtitle =
    subtitle ?? (address ? 'Incoming and outgoing transfers' : 'Live firehose of movement');

  const rows =
    isLoading && transfers.length === 0
      ? Array.from({ length: 5 }).map((_, idx) => (
          <tr key={idx} className="border-b border-[#1f1f2a] last:border-0">
            {Array.from({ length: 7 }).map((__, col) => (
              <td key={col} className="px-3 py-3">
                <div className="h-4 w-24 animate-pulse rounded bg-[#1f1f2a]" />
              </td>
            ))}
          </tr>
        ))
      : transfers.map((transfer) => (
          <TransferRow
            key={`${transfer.txHash}-${transfer.blockNumber ?? transfer.block ?? 0}-${transfer.from}-${transfer.to}`}
            transfer={transfer}
          />
        ));

  return (
    <Card
      title={computedTitle}
      subtitle={computedSubtitle}
      actions={
        !address && (
          <Link
            href="/transfers"
            className="flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs text-accent transition hover:bg-accent/20"
          >
            <ArrowRightLeft size={14} />
            <span>View all</span>
          </Link>
        )
      }
      className="overflow-hidden"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[#1f1f2a] text-xs uppercase tracking-wide text-gray-500">
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
          <tbody
            className={classNames(
              'text-sm',
              transfers.length === 0 && !isLoading ? 'text-gray-400' : ''
            )}
          >
            {rows}
            {error && !isLoading && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-red-300">
                  Failed to load transfers.
                </td>
              </tr>
            )}
            {!error && !isLoading && transfers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-gray-400">
                  No transfers found for this chain {address ? 'or address' : ''}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default TransferTable;
