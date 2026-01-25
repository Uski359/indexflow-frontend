import type { ProofWalletRow, ProofWindowType } from '@/lib/proofTypes';

type ExportProofCsvOptions = {
  rows: ProofWalletRow[];
  campaignId: string;
  windowType: ProofWindowType;
  criteriaSetId: string;
};

const formatDateYYYYMMDD = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

const stripNewlines = (value: string) => {
  return value.replace(/\s*\r?\n\s*/g, ' ').trim();
};

const escapeCsvCell = (value: string | number | boolean | null | undefined) => {
  const raw = value === null || value === undefined ? '' : String(value);
  const normalized = raw.replace(/\r?\n/g, ' ');
  const needsQuotes = /[",\r\n]/.test(normalized);
  if (!needsQuotes) {
    return normalized;
  }
  return `"${normalized.replace(/"/g, '""')}"`;
};

const buildCsvContent = (rows: ProofWalletRow[]) => {
  const includeCommentary = rows.some((row) => Boolean(row.commentary?.text));
  const headers = [
    'wallet',
    'verified',
    'tx_count',
    'days_active',
    'unique_contracts',
    'score',
    'farm_percent',
    'tag',
    'proof_hash',
    'cached_core',
    'cached_insights',
    'cached_commentary',
    'source'
  ];
  if (includeCommentary) {
    headers.push('commentary');
  }

  const lines = [headers.map(escapeCsvCell).join(',')];

  for (const row of rows) {
    const summary = row.output?.usage_summary;
    const farmPercent = row.insights
      ? Number((row.insights.farming_probability * 100).toFixed(2))
      : '';
    const commentaryText = row.commentary?.text ? stripNewlines(row.commentary.text) : '';

    const values: Array<string | number | boolean | null | undefined> = [
      row.wallet,
      row.output?.verified_usage,
      summary?.tx_count,
      summary?.days_active,
      summary?.unique_contracts,
      row.insights?.overall_score,
      farmPercent,
      row.insights?.behavior_tag,
      row.output?.proof.canonical_hash,
      Boolean(row.cached_core),
      Boolean(row.cached_insights),
      Boolean(row.cached_commentary),
      row.source
    ];

    if (includeCommentary) {
      values.push(commentaryText);
    }

    lines.push(values.map(escapeCsvCell).join(','));
  }

  return lines.join('\n');
};

export const exportProofCsv = ({
  rows,
  campaignId,
  windowType,
  criteriaSetId
}: ExportProofCsvOptions) => {
  if (!rows.length) {
    return;
  }

  const csv = buildCsvContent(rows);
  const date = formatDateYYYYMMDD(new Date());
  const filename = `indexflow_proof_${campaignId}_${windowType}_${criteriaSetId}_${date}.csv`;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

