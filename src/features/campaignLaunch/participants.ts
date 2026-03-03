import { isAddress as isViemAddress } from 'viem';

export type ParsedParticipantRow = {
  address: string;
  score?: number;
};

export type MissingScoreHandling = 'require' | 'zero' | 'reject';

export type ParticipantParseStats = {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  rowsWithScore: number;
  missingScoreCount: number;
  scoreCoveragePercent: number;
};

export type ParticipantParseResult = {
  rows: ParsedParticipantRow[];
  errors: string[];
  stats: ParticipantParseStats;
};

type WorkingParticipantRow = ParsedParticipantRow & {
  lineNumber: number;
};

const parseLines = (value: string): string[] => value.split(/\r?\n/);

const parseScore = (value: string, lineNumber: number): number | null => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Line ${lineNumber}: invalid score "${value}".`);
  }

  return parsed;
};

const isHeaderRow = (addressCell: string, scoreCell?: string): boolean => {
  const normalizedAddress = addressCell.trim().toLowerCase();
  const normalizedScore = (scoreCell ?? '').trim().toLowerCase();

  return normalizedAddress === 'address' && (normalizedScore === '' || normalizedScore === 'score');
};

const finalizeParse = (
  rows: WorkingParticipantRow[],
  errors: string[],
  totalRows: number
): ParticipantParseResult => {
  const deduped = dedupe(rows.map(({ address, score }) => ({ address, score })));
  const rowsWithScore = deduped.rows.filter((row) => typeof row.score === 'number').length;
  const validCount = deduped.rows.length;

  return {
    rows: deduped.rows,
    errors,
    stats: {
      totalRows,
      validCount,
      invalidCount: errors.length,
      duplicateCount: deduped.duplicateCount,
      rowsWithScore,
      missingScoreCount: Math.max(validCount - rowsWithScore, 0),
      scoreCoveragePercent: validCount > 0 ? (rowsWithScore / validCount) * 100 : 0
    }
  };
};

const pushParsedRow = (
  target: WorkingParticipantRow[],
  errors: string[],
  line: string,
  lineNumber: number,
  forceCsv: boolean
): void => {
  const trimmedLine = line.trim();
  if (!trimmedLine) {
    return;
  }

  if (!forceCsv && !trimmedLine.includes(',')) {
    if (!isAddress(trimmedLine)) {
      errors.push(`Line ${lineNumber}: invalid EVM address "${trimmedLine}".`);
      return;
    }

    target.push({
      address: normalize(trimmedLine),
      lineNumber
    });
    return;
  }

  const cells = line.split(',').map((cell) => cell.trim());
  const [addressCell = '', scoreCell = ''] = cells;
  const extraValues = cells.slice(2).filter((cell) => cell.length > 0);

  if (!addressCell) {
    errors.push(`Line ${lineNumber}: missing address.`);
    return;
  }

  if (isHeaderRow(addressCell, scoreCell)) {
    return;
  }

  if (extraValues.length > 0) {
    errors.push(`Line ${lineNumber}: expected "address,score".`);
    return;
  }

  if (!isAddress(addressCell)) {
    errors.push(`Line ${lineNumber}: invalid EVM address "${addressCell}".`);
    return;
  }

  let score: number | undefined;
  try {
    const parsedScore = parseScore(scoreCell, lineNumber);
    if (parsedScore !== null) {
      score = parsedScore;
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : `Line ${lineNumber}: invalid score.`);
    return;
  }

  target.push({
    address: normalize(addressCell),
    score,
    lineNumber
  });
};

export const isAddress = (value: string): boolean => {
  return isViemAddress(value.trim(), { strict: true });
};

export const normalize = (value: string): string => value.trim().toLowerCase();

export const dedupe = (
  rows: ParsedParticipantRow[]
): { rows: ParsedParticipantRow[]; duplicateCount: number } => {
  const dedupedRows: ParsedParticipantRow[] = [];
  const indexByAddress = new Map<string, number>();
  let duplicateCount = 0;

  for (const row of rows) {
    const existingIndex = indexByAddress.get(row.address);
    if (typeof existingIndex === 'number') {
      duplicateCount += 1;
      const existingRow = dedupedRows[existingIndex];
      if (typeof existingRow.score !== 'number' && typeof row.score === 'number') {
        dedupedRows[existingIndex] = {
          ...existingRow,
          score: row.score
        };
      }
      continue;
    }

    indexByAddress.set(row.address, dedupedRows.length);
    dedupedRows.push(row);
  }

  return {
    rows: dedupedRows,
    duplicateCount
  };
};

export const parseParticipantsFromText = (inputText: string): ParticipantParseResult => {
  const parsedRows: WorkingParticipantRow[] = [];
  const errors: string[] = [];
  const lines = parseLines(inputText);
  let totalRows = 0;

  lines.forEach((line, index) => {
    if (!line.trim()) {
      return;
    }

    totalRows += 1;
    pushParsedRow(parsedRows, errors, line, index + 1, false);
  });

  return finalizeParse(parsedRows, errors, totalRows);
};

export const parseParticipantsFromCsv = (inputText: string): ParticipantParseResult => {
  const parsedRows: WorkingParticipantRow[] = [];
  const errors: string[] = [];
  const lines = parseLines(inputText);
  let totalRows = 0;

  lines.forEach((line, index) => {
    if (!line.trim()) {
      return;
    }

    totalRows += 1;
    pushParsedRow(parsedRows, errors, line, index + 1, true);
  });

  return finalizeParse(parsedRows, errors, totalRows);
};
