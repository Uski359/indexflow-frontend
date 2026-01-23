import type { CampaignRunItem } from '@/lib/types';

type WalletTableProps = {
  results: CampaignRunItem[];
};

const formatNumber = (value: number) => new Intl.NumberFormat('en-US').format(value);

const shortenWallet = (wallet: string) => {
  if (wallet.length <= 12) {
    return wallet;
  }
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
};

const WalletTable = ({ results }: WalletTableProps) => {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
      <table className="min-w-full text-sm">
        <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.2em] text-slate-400">
          <tr>
            <th className="px-4 py-3">Wallet</th>
            <th className="px-4 py-3">Verified usage</th>
            <th className="px-4 py-3">Tx count</th>
            <th className="px-4 py-3">Days active</th>
            <th className="px-4 py-3">Unique contracts</th>
            <th className="px-4 py-3">Cached</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {results.map((entry) => {
            const summary = entry.output.usage_summary;
            const verified = entry.output.verified_usage;
            return (
              <tr key={entry.wallet} className="hover:bg-white/5">
                <td className="px-4 py-3 text-slate-100" title={entry.wallet}>
                  {shortenWallet(entry.wallet)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                      verified
                        ? 'bg-emerald-500/20 text-emerald-200'
                        : 'bg-rose-500/20 text-rose-200'
                    }`}
                  >
                    {verified ? 'Verified' : 'Not verified'}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-200">
                  {formatNumber(summary.tx_count)}
                </td>
                <td className="px-4 py-3 text-slate-200">
                  {formatNumber(summary.days_active)}
                </td>
                <td className="px-4 py-3 text-slate-200">
                  {formatNumber(summary.unique_contracts)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                      entry.cached
                        ? 'bg-sky-500/20 text-sky-200'
                        : 'bg-white/10 text-slate-200'
                    }`}
                  >
                    {entry.cached ? 'Cached' : 'Live'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default WalletTable;
