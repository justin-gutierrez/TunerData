/**
 * Step 1 of the parse pipeline.
 * Converts a raw CSV string into structured headers + row objects
 * using Papa Parse, trimming whitespace from all keys and values.
 */

import Papa from "papaparse";

export interface RawCsvData {
  /** The column header strings (from the first non-empty row) */
  headers: string[];
  /** Parsed rows as header → raw-string-value maps */
  rawRows: Record<string, string>[];
  /** Non-fatal parse warnings */
  warnings: string[];
}

export function parseCsvText(csvText: string): RawCsvData {
  const warnings: string[] = [];

  const result = Papa.parse<Record<string, string>>(csvText.trim(), {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
    // Trim whitespace from header keys and cell values
    transformHeader: (h: string) => h.trim(),
    transform: (value: string) => value.trim(),
  });

  const headers: string[] = result.meta.fields ?? [];

  // Surface the first handful of Papa Parse errors as non-fatal warnings
  for (const err of result.errors.slice(0, 5)) {
    const loc = err.row !== undefined ? ` (row ${err.row})` : "";
    warnings.push(`CSV parse warning${loc}: ${err.message}`);
  }

  if (headers.length === 0) {
    warnings.push("No column headers detected — the CSV may be empty or malformed.");
  }

  // Filter out any completely-empty rows that slipped through
  const rawRows = result.data.filter(
    (row) => Object.values(row).some((v) => v !== "")
  );

  return { headers, rawRows, warnings };
}
