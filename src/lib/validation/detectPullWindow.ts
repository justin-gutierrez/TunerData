/**
 * Detects the WOT (wide-open-throttle) pull window within a normalized log.
 *
 * Algorithm:
 *   1. Mark every row where throttle ≥ minThrottlePct as a "high-throttle" row.
 *   2. Group consecutive high-throttle rows into segments (gaps ≤ 2 rows tolerated).
 *   3. For each segment, score it by RPM range × duration.
 *   4. Return the highest-scoring segment that meets minPullDurationSec.
 *
 * The pull window is intentionally defined as the HIGH-THROTTLE span.
 * If the driver lifted before reaching target RPM, the window ends at the lift
 * point — validateThrottle / validateEndConditions handle the subsequent failures.
 */

import type { NormalizedLogRow } from "../schema/normalized-log";
import type { ValidationTemplate } from "../schema/validation-rules";
import type { CheckResult, PullWindow } from "../schema/validation-result";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getThrottle(row: NormalizedLogRow): number | undefined {
  return row.throttlePct ?? row.acceleratorPct;
}

interface Segment {
  start: number;
  end: number;
}

function findHighThrottleSegments(
  rows: NormalizedLogRow[],
  minThrottle: number,
  maxGapRows = 2
): Segment[] {
  const segments: Segment[] = [];
  let inSeg = false;
  let segStart = 0;
  let gapCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const t = getThrottle(rows[i]);
    const isHigh = t !== undefined && t >= minThrottle;

    if (isHigh) {
      if (!inSeg) {
        inSeg = true;
        segStart = i;
      }
      gapCount = 0;
    } else if (inSeg) {
      gapCount++;
      if (gapCount > maxGapRows) {
        // End the segment at the last high-throttle row
        segments.push({ start: segStart, end: i - gapCount });
        inSeg = false;
        gapCount = 0;
      }
    }
  }
  if (inSeg) {
    segments.push({ start: segStart, end: rows.length - 1 });
  }
  return segments;
}

function segmentDuration(rows: NormalizedLogRow[], seg: Segment): number {
  return rows[seg.end].timeSec - rows[seg.start].timeSec;
}

function segmentRpmRange(rows: NormalizedLogRow[], seg: Segment): number {
  let minRpm = Infinity;
  let maxRpm = -Infinity;
  for (let i = seg.start; i <= seg.end; i++) {
    const rpm = rows[i].rpm;
    if (rpm !== undefined) {
      if (rpm < minRpm) minRpm = rpm;
      if (rpm > maxRpm) maxRpm = rpm;
    }
  }
  return maxRpm === -Infinity ? 0 : maxRpm - minRpm;
}

function buildPullWindow(rows: NormalizedLogRow[], seg: Segment): PullWindow {
  const startRow = rows[seg.start];
  const endRow = rows[seg.end];

  let peakRpm = 0;
  let maxBoostPsi: number | undefined;
  let minAfr: number | undefined;
  let minLambda: number | undefined;
  let maxKnockRetard: number | undefined;

  for (let i = seg.start; i <= seg.end; i++) {
    const r = rows[i];
    if (r.rpm !== undefined && r.rpm > peakRpm) peakRpm = r.rpm;
    if (r.boostPsi !== undefined && (maxBoostPsi === undefined || r.boostPsi > maxBoostPsi))
      maxBoostPsi = r.boostPsi;
    if (r.afr !== undefined && (minAfr === undefined || r.afr < minAfr)) minAfr = r.afr;
    if (r.lambda !== undefined && (minLambda === undefined || r.lambda < minLambda))
      minLambda = r.lambda;
    if (r.knockRetardDeg !== undefined && (maxKnockRetard === undefined || r.knockRetardDeg > maxKnockRetard))
      maxKnockRetard = r.knockRetardDeg;
    // Also check per-cylinder corrections
    if (r.timingCorrectionCylinders) {
      const worst = Math.max(
        ...Object.values(r.timingCorrectionCylinders)
          .filter((v): v is number => v !== undefined)
          .map(Math.abs)
      );
      if (maxKnockRetard === undefined || worst > maxKnockRetard) maxKnockRetard = worst;
    }
  }

  return {
    startIndex: seg.start,
    endIndex: seg.end,
    startTime: startRow.timeSec,
    endTime: endRow.timeSec,
    duration: endRow.timeSec - startRow.timeSec,
    startRpm: startRow.rpm ?? 0,
    endRpm: endRow.rpm ?? 0,
    peakRpm,
    startSpeed: startRow.speedMph ?? 0,
    endSpeed: endRow.speedMph ?? 0,
    maxBoostPsi,
    minAfr,
    minLambda,
    maxKnockRetard,
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface PullDetectionResult {
  pullWindow: PullWindow | null;
  checks: CheckResult[];
}

export function detectPullWindow(
  rows: NormalizedLogRow[],
  template: ValidationTemplate
): PullDetectionResult {
  const minThrottlePct = template.wot?.minThrottlePct ?? 90;
  const minPullDurationSec = template.wot?.minPullDurationSec ?? 5.0;
  const MIN_RPM_RISE = 800; // minimum RPM sweep to be considered a real pull

  const segments = findHighThrottleSegments(rows, minThrottlePct);

  // Filter to segments with meaningful RPM rise
  const candidates = segments.filter((seg) => {
    const duration = segmentDuration(rows, seg);
    const rpmRange = segmentRpmRange(rows, seg);
    return duration >= minPullDurationSec * 0.8 && rpmRange >= MIN_RPM_RISE;
  });

  if (candidates.length === 0) {
    // Last attempt: accept any high-throttle segment with some RPM rise
    const fallback = segments
      .sort((a, b) => segmentRpmRange(rows, b) - segmentRpmRange(rows, a))
      .find((seg) => segmentRpmRange(rows, seg) >= 400);

    if (!fallback) {
      return {
        pullWindow: null,
        checks: [
          {
            id: "pull_detected",
            name: "Pull window detection",
            description: "A WOT pull segment must be identifiable in the log",
            outcome: "fail",
            detail:
              "No high-throttle (≥ 90%) segment with meaningful RPM rise was found. " +
              "Ensure the log covers the full pull from entry to redline.",
          },
        ],
      };
    }

    const pw = buildPullWindow(rows, fallback);
    return {
      pullWindow: pw,
      checks: [
        {
          id: "pull_detected",
          name: "Pull window detection",
          description: "A WOT pull segment must be identifiable in the log",
          outcome: "warn",
          detail: `Marginal pull detected: ${pw.duration.toFixed(1)} s, ${pw.startRpm}→${pw.peakRpm} RPM.`,
        },
        buildDurationCheck(pw, template),
      ],
    };
  }

  // Pick the candidate with the highest RPM range (most complete pull)
  const best = candidates.reduce((a, b) =>
    segmentRpmRange(rows, b) > segmentRpmRange(rows, a) ? b : a
  );

  const pullWindow = buildPullWindow(rows, best);

  return {
    pullWindow,
    checks: [
      {
        id: "pull_detected",
        name: "Pull window detection",
        description: "A WOT pull segment must be identifiable in the log",
        outcome: "pass",
        detail:
          `Pull window: ${pullWindow.startTime.toFixed(1)} s – ${pullWindow.endTime.toFixed(1)} s ` +
          `(${pullWindow.duration.toFixed(1)} s), ` +
          `${Math.round(pullWindow.startRpm)}→${Math.round(pullWindow.peakRpm)} RPM`,
      },
      buildDurationCheck(pullWindow, template),
    ],
  };
}

function buildDurationCheck(
  pw: PullWindow,
  template: ValidationTemplate
): CheckResult {
  const minDur = template.wot?.minPullDurationSec ?? 5.0;
  if (pw.duration < minDur) {
    return {
      id: "pull_duration",
      name: "Minimum pull duration",
      description: `Pull must last at least ${minDur} s`,
      outcome: "fail",
      value: `${pw.duration.toFixed(1)} s`,
      threshold: `${minDur} s`,
      detail: `Detected pull is only ${pw.duration.toFixed(1)} s — must be ≥ ${minDur} s.`,
    };
  }
  return {
    id: "pull_duration",
    name: "Minimum pull duration",
    description: `Pull must last at least ${minDur} s`,
    outcome: "pass",
    value: `${pw.duration.toFixed(1)} s`,
    threshold: `${minDur} s`,
    detail: `Pull duration of ${pw.duration.toFixed(1)} s meets the ${minDur} s minimum.`,
  };
}
