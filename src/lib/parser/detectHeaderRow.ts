/**
 * Some tuning platforms (e.g. older COBB firmware, AEM) prepend one or more
 * metadata lines before the actual column-header row.  This module scans the
 * first several lines of the raw text and returns the 0-based index of the
 * line that looks most like a header row.
 *
 * If the header is already on the first line (the normal case), this returns 0
 * and callers can use the CSV as-is.  When a non-zero index is returned the
 * caller should strip the leading lines before passing the text to parseCsvText.
 */

/** Patterns that appear in recognisable telemetry column names */
const HEADER_PATTERNS: RegExp[] = [
  /\brpm\b/i,
  /\bspeed\b/i,
  /throttle|tps|\bpedal\b/i,
  /\btime\b/i,
  /\bboost\b|\bmap\b/i,
  /\bafr\b|\blambda\b/i,
  /timing|knock|ignition/i,
  /coolant|iat/i,
];

/**
 * Returns the 0-based line index of the CSV header row.
 * Scans at most the first 10 lines.
 */
export function detectHeaderRowIndex(csvText: string): number {
  const lines = csvText.split(/\r?\n/);

  let bestIndex = 0;
  let bestScore = -1;

  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const cells = lines[i].split(",").map((c) => c.trim());
    if (cells.length < 2) continue;

    const score = HEADER_PATTERNS.filter((p) =>
      cells.some((c) => p.test(c))
    ).length;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex;
}

/**
 * Returns the CSV text starting from the detected header row.
 * If the header is already on line 0 the text is returned unchanged.
 */
export function stripMetadataRows(csvText: string): string {
  const idx = detectHeaderRowIndex(csvText);
  if (idx === 0) return csvText;
  const lines = csvText.split(/\r?\n/);
  return lines.slice(idx).join("\n");
}
