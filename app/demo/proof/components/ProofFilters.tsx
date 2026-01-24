export type ProofVerifiedFilter = 'all' | 'true' | 'false';

export type ProofTagFilter = 'all' | 'organic' | 'suspected_farm' | 'inactive' | 'mixed';

export type ProofSortBy =
  | 'score_desc'
  | 'farm_desc'
  | 'tx_desc'
  | 'days_desc'
  | 'unique_desc'
  | 'wallet_asc';

export type ProofFilterState = {
  verified: ProofVerifiedFilter;
  minTxCount: number;
  minDaysActive: number;
  minUniqueContracts: number;
  minScore: number;
  maxScore: number;
  minFarmPercent: number;
  maxFarmPercent: number;
  tag: ProofTagFilter;
  sortBy: ProofSortBy;
};

type ProofFiltersProps = {
  value: ProofFilterState;
  onChange: (next: ProofFilterState) => void;
  disabled?: boolean;
  insightsEnabled?: boolean;
};

const clampNumber = (value: string, max?: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  const clamped = Math.max(0, parsed);
  if (typeof max === 'number') {
    return Math.min(clamped, max);
  }
  return clamped;
};

const ProofFilters = ({
  value,
  onChange,
  disabled = false,
  insightsEnabled = true
}: ProofFiltersProps) => {
  const update = (patch: Partial<ProofFilterState>) => {
    onChange({ ...value, ...patch });
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-2 text-sm text-slate-300">
          Verified filter
          <select
            value={value.verified}
            onChange={(event) =>
              update({ verified: event.target.value as ProofVerifiedFilter })
            }
            disabled={disabled}
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
          >
            <option value="all">All</option>
            <option value="true">Verified</option>
            <option value="false">Not verified</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-300">
          Sort by
          <select
            value={value.sortBy}
            onChange={(event) => update({ sortBy: event.target.value as ProofSortBy })}
            disabled={disabled}
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
          >
            {insightsEnabled && <option value="score_desc">Score (high to low)</option>}
            {insightsEnabled && <option value="farm_desc">Farm% (high to low)</option>}
            <option value="tx_desc">Tx count (high to low)</option>
            <option value="days_desc">Days active (high to low)</option>
            <option value="unique_desc">Unique contracts (high to low)</option>
            <option value="wallet_asc">Wallet (A to Z)</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-300">
          Min tx count
          <input
            type="number"
            min={0}
            value={value.minTxCount}
            onChange={(event) => update({ minTxCount: clampNumber(event.target.value) })}
            disabled={disabled}
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-300">
          Min days active
          <input
            type="number"
            min={0}
            value={value.minDaysActive}
            onChange={(event) =>
              update({ minDaysActive: clampNumber(event.target.value) })
            }
            disabled={disabled}
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-300">
          Min unique contracts
          <input
            type="number"
            min={0}
            value={value.minUniqueContracts}
            onChange={(event) =>
              update({ minUniqueContracts: clampNumber(event.target.value) })
            }
            disabled={disabled}
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
          />
        </label>

        {insightsEnabled && (
          <>
            <label className="flex flex-col gap-2 text-sm text-slate-300">
              Min score
              <input
                type="number"
                min={0}
                max={100}
                value={value.minScore}
                onChange={(event) =>
                  update({ minScore: clampNumber(event.target.value, 100) })
                }
                disabled={disabled}
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm text-slate-300">
              Max score
              <input
                type="number"
                min={0}
                max={100}
                value={value.maxScore}
                onChange={(event) =>
                  update({ maxScore: clampNumber(event.target.value, 100) })
                }
                disabled={disabled}
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm text-slate-300">
              Min farm % (risk)
              <input
                type="number"
                min={0}
                max={100}
                value={value.minFarmPercent}
                onChange={(event) =>
                  update({ minFarmPercent: clampNumber(event.target.value, 100) })
                }
                disabled={disabled}
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm text-slate-300">
              Max farm % (risk)
              <input
                type="number"
                min={0}
                max={100}
                value={value.maxFarmPercent}
                onChange={(event) =>
                  update({ maxFarmPercent: clampNumber(event.target.value, 100) })
                }
                disabled={disabled}
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm text-slate-300">
              Insight tag
              <select
                value={value.tag}
                onChange={(event) => update({ tag: event.target.value as ProofTagFilter })}
                disabled={disabled}
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
              >
                <option value="all">All</option>
                <option value="organic">Organic</option>
                <option value="mixed">Mixed</option>
                <option value="suspected_farm">Suspected farm</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </>
        )}
      </div>
    </div>
  );
};

export default ProofFilters;
