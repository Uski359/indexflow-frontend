type WalletInputProps = {
  value: string;
  onChange: (next: string) => void;
  onNormalize: () => void;
  onPasteSample: () => void;
  onClear: () => void;
  validCount: number;
  invalidCount: number;
  disabled?: boolean;
  loadingSample?: boolean;
};

const WalletInput = ({
  value,
  onChange,
  onNormalize,
  onPasteSample,
  onClear,
  validCount,
  invalidCount,
  disabled = false,
  loadingSample = false
}: WalletInputProps) => {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Wallets</p>
          <p className="mt-1 text-sm text-slate-300">
            Paste one per line, comma-separated, or mixed whitespace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onNormalize}
            disabled={disabled}
            className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 hover:text-white disabled:cursor-not-allowed disabled:text-slate-500"
          >
            Normalize
          </button>
          <button
            type="button"
            onClick={onPasteSample}
            disabled={disabled || loadingSample}
            className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 hover:text-white disabled:cursor-not-allowed disabled:text-slate-500"
          >
            {loadingSample ? 'Loading...' : 'Paste sample (20 wallets)'}
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 hover:text-white disabled:cursor-not-allowed disabled:text-slate-500"
          >
            Clear
          </button>
        </div>
      </div>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        rows={6}
        placeholder="0x1234...abcd"
        className="mt-4 w-full resize-none rounded-2xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white placeholder:text-slate-600"
      />

      <div className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-400">
        {validCount} valid / {invalidCount} invalid
      </div>
    </div>
  );
};

export default WalletInput;
