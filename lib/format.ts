export const formatLargeNumber = (
  value?: number | string | null,
  options?: { precision?: number; decimals?: number }
) => {
  if (value === undefined || value === null) return 'N/A';

  const num = typeof value === 'string' ? Number(value) : Number(value);
  if (!Number.isFinite(num)) return String(value);

  const precision = options?.precision ?? 2;
  const decimals = options?.decimals ?? 0;
  const divisor = decimals > 0 ? 10 ** decimals : 1;
  const normalized = num / divisor;
  const abs = Math.abs(normalized);

  const withSuffix = (divider: number, suffix: string) =>
    `${(normalized / divider).toFixed(precision)}${suffix}`;

  if (abs >= 1_000_000_000) return withSuffix(1_000_000_000, 'B');
  if (abs >= 1_000_000) return withSuffix(1_000_000, 'M');
  if (abs >= 1_000) return withSuffix(1_000, 'K');

  return normalized.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: precision
  });
};
