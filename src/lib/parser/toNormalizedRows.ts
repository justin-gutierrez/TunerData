/**
 * Main parse-pipeline orchestrator.
 *
 * Converts a raw CSV string into a fully-normalized ParsedLog by running:
 *   parseCsvText → detectHeaderRow → detectFormat → mapColumns →
 *   row extraction → unit normalization → lambda↔AFR cross-derivation
 *
 * This is the single public entry-point callers should use.
 */

import type { NormalizedLogRow, ParsedLog } from "../schema/normalized-log";
import { parseCsvText } from "./parseCsv";
import { stripMetadataRows } from "./detectHeaderRow";
import { detectFormat } from "./detectFormat";
import { mapColumns } from "./mapColumns";
import { normalizeValue, crossDeriveLambdaAfr } from "./normalizeUnits";

// ─── Row extractor ────────────────────────────────────────────────────────────

/** Safely set a nested field like "timingCorrectionCylinders.cyl1" on a row */
function setNestedField(
  row: Partial<NormalizedLogRow>,
  normalizedField: string,
  value: number
): void {
  if (normalizedField.startsWith("timingCorrectionCylinders.")) {
    const cylKey = normalizedField.split(".")[1] as keyof NonNullable<
      NormalizedLogRow["timingCorrectionCylinders"]
    >;
    if (!row.timingCorrectionCylinders) row.timingCorrectionCylinders = {};
    (row.timingCorrectionCylinders as Record<string, number>)[cylKey] = value;
    return;
  }
  // Top-level field — cast is safe because we control all normalizedField strings
  (row as Record<string, number | undefined>)[normalizedField] = value;
}

/** Convert a single raw CSV row to a NormalizedLogRow */
function convertRow(
  rawRow: Record<string, string>,
  mappings: ReturnType<typeof mapColumns>,
  sourceRowIndex: number
): NormalizedLogRow {
  const partial: Partial<NormalizedLogRow> = { sourceRowIndex };

  for (const mapping of mappings) {
    if (!mapping.normalizedField || mapping.status === "unmapped") continue;

    const rawValue = rawRow[mapping.rawColumn];
    if (rawValue === undefined || rawValue === "") continue;

    // For timing correction cylinders, MHD stores negative corrections;
    // preserve sign (the validator interprets them as retard magnitude).
    const normalized = normalizeValue(
      rawValue,
      mapping.normalizedField,
      mapping.detectedUnit
    );
    if (normalized === undefined) continue;

    setNestedField(partial, mapping.normalizedField, normalized);
  }

  // Guarantee required field
  if (partial.timeSec === undefined) {
    partial.timeSec = sourceRowIndex; // fallback: use row number as time
  }

  return partial as NormalizedLogRow;
}

// ─── Timestamp sanity ─────────────────────────────────────────────────────────

/**
 * Checks whether the timeSec column is monotonically non-decreasing.
 * Returns a warning string if corruption is detected, otherwise undefined.
 */
function checkTimestampMonotonicity(rows: NormalizedLogRow[]): string | undefined {
  let regressions = 0;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].timeSec < rows[i - 1].timeSec) regressions++;
  }
  if (regressions === 0) return undefined;
  return `Timestamp corruption: ${regressions} non-monotonic step(s) detected in timeSec column.`;
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Parses a CSV string and returns a fully-normalized ParsedLog.
 *
 * @param csvText    Raw CSV content (including header row)
 * @param sourceName Display name shown in the UI (e.g. filename or demo log name)
 */
export function parseLogFromText(csvText: string, sourceName: string): ParsedLog {
  const warnings: string[] = [];

  // ── Step 1: Strip any metadata rows above the real header ────────────────
  const cleanedText = stripMetadataRows(csvText);

  // ── Step 2: Parse CSV into headers + raw rows ────────────────────────────
  const { headers, rawRows, warnings: csvWarnings } = parseCsvText(cleanedText);
  warnings.push(...csvWarnings);

  if (headers.length === 0 || rawRows.length === 0) {
    return {
      sourceName,
      detectedFormat: "unknown",
      rows: [],
      columnMappings: [],
      warnings: [...warnings, "No parseable data found."],
    };
  }

  // ── Step 3: Detect source format ─────────────────────────────────────────
  const detectedFormat = detectFormat(headers);

  // ── Step 4: Map columns ───────────────────────────────────────────────────
  const columnMappings = mapColumns(headers, detectedFormat);

  const unmappedCount = columnMappings.filter((m) => m.status === "unmapped").length;
  if (unmappedCount > 0) {
    const unmappedNames = columnMappings
      .filter((m) => m.status === "unmapped")
      .map((m) => `"${m.rawColumn}"`)
      .join(", ");
    warnings.push(`${unmappedCount} unrecognised column(s) ignored: ${unmappedNames}`);
  }

  // ── Step 5: Convert each row ──────────────────────────────────────────────
  const rows: NormalizedLogRow[] = rawRows.map((rawRow, i) =>
    convertRow(rawRow, columnMappings, i)
  );

  // ── Step 6: Cross-derive AFR ↔ lambda ─────────────────────────────────────
  for (const row of rows) {
    crossDeriveLambdaAfr(row);
  }

  // ── Step 7: Timestamp sanity check ───────────────────────────────────────
  const tsWarning = checkTimestampMonotonicity(rows);
  if (tsWarning) warnings.push(tsWarning);

  return {
    sourceName,
    detectedFormat,
    rows,
    columnMappings,
    warnings,
  };
}

// ─── Derived statistics helpers ───────────────────────────────────────────────

/** Estimate sample rate in Hz from the first 20 normalized rows */
export function estimateSampleRate(rows: NormalizedLogRow[]): number {
  if (rows.length < 2) return 0;
  const sample = rows.slice(0, Math.min(20, rows.length));
  const deltas: number[] = [];
  for (let i = 1; i < sample.length; i++) {
    const dt = sample[i].timeSec - sample[i - 1].timeSec;
    if (dt > 0) deltas.push(dt);
  }
  if (deltas.length === 0) return 0;
  const avgDt = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  return avgDt > 0 ? Math.round((1 / avgDt) * 10) / 10 : 0;
}

/** Count duplicate timestamps in the log */
export function countDuplicateTimestamps(rows: NormalizedLogRow[]): number {
  const times = rows.map((r) => r.timeSec);
  const seen = new Set<number>();
  let dupes = 0;
  for (const t of times) {
    if (seen.has(t)) dupes++;
    else seen.add(t);
  }
  return dupes;
}
