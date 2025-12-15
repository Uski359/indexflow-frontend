export const formatLargeNumber = (
  value?: number | string | null,
  options?: { precision?: number }
) => {
  if (value === undefined || value === null) return 'N/A';

  const num = typeof value === 'string' ? Number(value) : Number(value);
  if (!Number.isFinite(num)) return String(value);

  const precision = options?.precision ?? 2;
  const abs = Math.abs(num);

  const withSuffix = (divider: number, suffix: string) =>
    `${(num / divider).toFixed(precision)}${suffix}`;

  if (abs >= 1_000_000_000) return withSuffix(1_000_000_000, 'B');
  if (abs >= 1_000_000) return withSuffix(1_000_000, 'M');
  if (abs >= 1_000) return withSuffix(1_000, 'K');

  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: precision
  });
};
