import type { CampaignRunSummary } from '@/lib/types';

type KpiCardsProps = {
  summary: CampaignRunSummary;
};

const formatNumber = (value: number) => new Intl.NumberFormat('en-US').format(value);
const formatPercent = (value: number) => `${Math.round(value * 100)}%`;
const formatOneDecimal = (value: number) => value.toFixed(1);

const KpiCards = ({ summary }: KpiCardsProps) => {
  const cards = [
    {
      label: 'Total wallets',
      value: formatNumber(summary.total)
    },
    {
      label: 'Verified true',
      value: formatNumber(summary.verified_true)
    },
    {
      label: 'Verified false',
      value: formatNumber(summary.verified_false)
    },
    {
      label: 'Verified %',
      value: formatPercent(summary.verified_rate)
    },
    {
      label: 'Avg tx count',
      value: formatOneDecimal(summary.avg_tx_count)
    },
    {
      label: 'Avg days active',
      value: formatOneDecimal(summary.avg_days_active)
    },
    {
      label: 'Avg unique contracts',
      value: formatOneDecimal(summary.avg_unique_contracts)
    }
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            {card.label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">{card.value}</p>
        </div>
      ))}
    </div>
  );
};

export default KpiCards;
