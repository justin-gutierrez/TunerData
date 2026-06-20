/**
 * Checks sample rate, timestamp monotonicity, and duplicate timestamps.
 */

import type { NormalizedLogRow } from "../schema/normalized-log";
import type { ValidationTemplate } from "../schema/validation-rules";
import type { CheckResult } from "../schema/validation-result";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Calculate median Δt from the first 40 rows to get a robust sample-rate estimate */
export function estimateSampleRate(rows: NormalizedLogRow[]): number {
  if (rows.length < 2) return 0;
  const sample = rows.slice(0, Math.min(40, rows.length));
  const deltas: number[] = [];
  for (let i = 1; i < sample.length; i++) {
    const dt = sample[i].timeSec - sample[i - 1].timeSec;
    if (dt > 0 && dt < 2) deltas.push(dt); // ignore large gaps and negative values
  }
  if (deltas.length === 0) return 0;
  deltas.sort((a, b) => a - b);
  const median = deltas[Math.floor(deltas.length / 2)];
  return median > 0 ? Math.round((1 / median) * 10) / 10 : 0;
}

/** Count rows where timeSec goes backward relative to the previous row */
export function countNonMonotonicSteps(rows: NormalizedLogRow[]): number {
  let count = 0;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].timeSec < rows[i - 1].timeSec) count++;
  }
  return count;
}

/** Count exact duplicate timestamp values */
export function countDuplicateTimestamps(rows: NormalizedLogRow[]): number {
  const seen = new Map<number, number>();
  for (const row of rows) {
    seen.set(row.timeSec, (seen.get(row.timeSec) ?? 0) + 1);
  }
  let dupes = 0;
  for (const count of seen.values()) {
    if (count > 1) dupes += count - 1;
  }
  return dupes;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface SampleRateCheckResult {
  checks: CheckResult[];
  sampleRateHz: number;
  nonMonotonicCount: number;
  duplicateCount: number;
}

export function checkSampleRate(
  rows: NormalizedLogRow[],
  template: ValidationTemplate
): SampleRateCheckResult {
  const checks: CheckResult[] = [];
  const sampleRateHz = estimateSampleRate(rows);
  const nonMonotonicCount = countNonMonotonicSteps(rows);
  const duplicateCount = countDuplicateTimestamps(rows);

  // ── Timestamp corruption ────────────────────────────────────────────────
  if (nonMonotonicCount > 0) {
    checks.push({
      id: "timestamp_monotonic",
      name: "Timestamp integrity",
      description: "Timestamps must be monotonically non-decreasing",
      outcome: "fail",
      value: nonMonotonicCount,
      threshold: 0,
      detail: `${nonMonotonicCount} non-monotonic timestamp step(s) detected — the log may have been captured out of order or the datalogger timer reset mid-session.`,
    });
  } else {
    checks.push({
      id: "timestamp_monotonic",
      name: "Timestamp integrity",
      description: "Timestamps must be monotonically non-decreasing",
      outcome: "pass",
      detail: "All timestamps are in order.",
    });
  }

  // ── Duplicate timestamps ────────────────────────────────────────────────
  if (duplicateCount > 2) {
    checks.push({
      id: "duplicate_timestamps",
      name: "Duplicate timestamps",
      description: "Excessive duplicate timestamp values indicate a logging problem",
      outcome: "warn",
      value: duplicateCount,
      threshold: 2,
      detail: `${duplicateCount} duplicate timestamp(s) found.`,
    });
  } else {
    checks.push({
      id: "duplicate_timestamps",
      name: "Duplicate timestamps",
      description: "Excessive duplicate timestamp values indicate a logging problem",
      outcome: "pass",
      detail:
        duplicateCount === 0
          ? "No duplicate timestamps."
          : `${duplicateCount} duplicate timestamp(s) — within tolerance.`,
    });
  }

  // ── Sample rate ──────────────────────────────────────────────────────────
  const minHz = template.dataQualityRules?.minSampleRateHz ?? 5;
  if (sampleRateHz > 0 && sampleRateHz < minHz) {
    // Below 1 Hz is a hard fail — the data is too sparse to analyse.
    // 1 Hz – minHz is a warning (pull can still be detected but timing is imprecise).
    const outcome = sampleRateHz < 1 ? "fail" : "warn";
    checks.push({
      id: "sample_rate",
      name: "Sample rate",
      description: `Log must be recorded at ≥ ${minHz} Hz`,
      outcome,
      value: `${sampleRateHz} Hz`,
      threshold: `${minHz} Hz`,
      detail: `Detected sample rate is ${sampleRateHz} Hz, below the required ${minHz} Hz. Timing may be imprecise.`,
    });
  } else {
    checks.push({
      id: "sample_rate",
      name: "Sample rate",
      description: `Log must be recorded at ≥ ${minHz} Hz`,
      outcome: "pass",
      value: `${sampleRateHz} Hz`,
      threshold: `${minHz} Hz`,
      detail: `Sample rate of ${sampleRateHz} Hz meets the ${minHz} Hz minimum.`,
    });
  }

  return { checks, sampleRateHz, nonMonotonicCount, duplicateCount };
}
