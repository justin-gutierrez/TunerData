/**
 * Pull-window Intersection-over-Union (IoU)
 *
 * Compares a detected pull window to a reference window (both expressed as
 * [startTime, endTime] in seconds).  Returns a value in [0, 1] where:
 *   1.0 = perfect overlap
 *   0.0 = no overlap at all
 *
 * IoU = |intersection| / |union|
 *
 * Used on the Metrics page to show how accurately the pull-window detector
 * isolates the WOT segment relative to the ground-truth wide-open-throttle
 * reference derived from the raw log rows.
 */

export interface PullInterval {
  startSec: number;
  endSec: number;
}

/**
 * Compute IoU for two time intervals.
 * Returns 0 if either interval is degenerate (zero-length or inverted).
 */
export function calculatePullWindowIoU(
  detected: PullInterval,
  reference: PullInterval,
): number {
  const detectedLen = detected.endSec - detected.startSec;
  const referenceLen = reference.endSec - reference.startSec;

  // Guard against degenerate intervals
  if (detectedLen <= 0 || referenceLen <= 0) return 0;

  const intersectionStart = Math.max(detected.startSec, reference.startSec);
  const intersectionEnd = Math.min(detected.endSec, reference.endSec);
  const intersection = Math.max(0, intersectionEnd - intersectionStart);

  const union = detectedLen + referenceLen - intersection;
  if (union <= 0) return 0;

  return Math.min(1, intersection / union); // clamp for float safety
}

/**
 * Derive the reference WOT window from a set of normalized rows.
 *
 * The reference is defined as the contiguous span from the first row where
 * throttle (or accelerator pedal) is at or above `throttleThresholdPct`
 * to the last such row.
 *
 * Returns null if fewer than `minRows` qualifying rows exist.
 */
export function deriveWotReference(
  rows: Array<{
    timeSec: number;
    throttlePct?: number;
    acceleratorPct?: number;
  }>,
  throttleThresholdPct = 88,
  minRows = 3,
): PullInterval | null {
  const wotRows = rows.filter(
    (r) => (r.throttlePct ?? r.acceleratorPct ?? 0) >= throttleThresholdPct,
  );
  if (wotRows.length < minRows) return null;

  return {
    startSec: wotRows[0].timeSec,
    endSec: wotRows[wotRows.length - 1].timeSec,
  };
}
