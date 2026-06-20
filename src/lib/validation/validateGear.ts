/**
 * Validates the gear during the pull window.
 *
 * Two modes:
 *   A) Gear column present → check that gear == requiredGear for every pull row.
 *   B) No gear column     → estimate gear from speed/RPM ratio stability.
 *      If the ratio is stable (CV < 8%), mark as "estimated stable, actual unconfirmed."
 *      If unstable, warn that a gear change may have occurred.
 */

import type { NormalizedLogRow } from "../schema/normalized-log";
import type { ValidationTemplate } from "../schema/validation-rules";
import type { CheckResult, PullWindow, FailureEvent } from "../schema/validation-result";

function hasGearColumn(rows: NormalizedLogRow[]): boolean {
  return rows.some((r) => r.gear !== undefined);
}

/** Coefficient of variation (stddev / mean) of an array */
function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

export interface GearCheckResult {
  checks: CheckResult[];
  failureEvents: FailureEvent[];
}

export function validateGear(
  rows: NormalizedLogRow[],
  pullWindow: PullWindow,
  template: ValidationTemplate
): GearCheckResult {
  const checks: CheckResult[] = [];
  const failureEvents: FailureEvent[] = [];

  const pullRows = rows.slice(pullWindow.startIndex, pullWindow.endIndex + 1);
  const requiredGear = template.gear?.requiredGear ?? null;

  if (requiredGear === null || requiredGear === undefined) {
    // Template doesn't require a specific gear — skip
    return { checks, failureEvents };
  }

  // ── Mode A: Gear column exists ────────────────────────────────────────────
  if (hasGearColumn(rows)) {
    const gearValues = pullRows
      .map((r) => r.gear)
      .filter((g): g is number => g !== undefined);

    if (gearValues.length === 0) {
      checks.push({
        id: "gear_value",
        name: "Gear during pull",
        description: `Gear must be ${requiredGear} throughout the pull`,
        outcome: "warn",
        detail: "Gear column is present but has no values in the pull window.",
      });
      return { checks, failureEvents };
    }

    const wrongGearRows = gearValues.filter((g) => g !== requiredGear);
    const wrongGearPct = (wrongGearRows.length / gearValues.length) * 100;

    if (wrongGearPct === 0) {
      checks.push({
        id: "gear_value",
        name: "Gear during pull",
        description: `Gear must be ${requiredGear} throughout the pull`,
        outcome: "pass",
        value: `${requiredGear}`,
        detail: `All pull rows confirm gear ${requiredGear}.`,
      });
    } else {
      const mostCommonWrong = wrongGearRows
        .reduce<Record<number, number>>((acc, g) => {
          acc[g] = (acc[g] ?? 0) + 1;
          return acc;
        }, {});
      const detectedGear = parseInt(
        Object.entries(mostCommonWrong).sort((a, b) => b[1] - a[1])[0][0],
        10
      );

      const msg =
        `Pull appears to be in gear ${detectedGear} rather than the required gear ${requiredGear}. ` +
        `${wrongGearPct.toFixed(0)}% of pull rows show gear ${detectedGear}.`;

      checks.push({
        id: "gear_value",
        name: "Gear during pull",
        description: `Gear must be ${requiredGear} throughout the pull`,
        outcome: "fail",
        value: `${detectedGear} (expected ${requiredGear})`,
        threshold: `${requiredGear}`,
        detail: msg,
        failureTimestamp: pullWindow.startTime,
      });

      failureEvents.push({
        id: "wrong_gear_event",
        type: "wrong_gear",
        message: msg,
        timeSec: pullWindow.startTime,
        rpm: pullWindow.startRpm,
        severity: "high",
      });
    }

    return { checks, failureEvents };
  }

  // ── Mode B: No gear column — estimate from speed / RPM ratio ──────────────
  if (!(template.gear?.allowEstimatedGear ?? true)) {
    checks.push({
      id: "gear_value",
      name: "Gear during pull",
      description: `Gear must be ${requiredGear} throughout the pull`,
      outcome: "fail",
      detail: "No gear column found and estimated gear checking is disabled for this template.",
    });
    return { checks, failureEvents };
  }

  const ratios = pullRows
    .filter((r) => r.speedMph !== undefined && r.rpm !== undefined && r.rpm > 500)
    .map((r) => (r.speedMph as number) / (r.rpm as number));

  if (ratios.length < 3) {
    checks.push({
      id: "gear_estimated",
      name: "Gear estimation (no gear column)",
      description: "Estimating gear from speed/RPM ratio",
      outcome: "warn",
      detail: "Insufficient data to estimate gear from speed/RPM ratio.",
    });
    return { checks, failureEvents };
  }

  const cv = coefficientOfVariation(ratios);
  const meanRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;

  if (cv < 0.08) {
    // Stable ratio — single gear throughout the pull
    checks.push({
      id: "gear_estimated",
      name: "Gear estimation (no gear column)",
      description: "Estimating gear from speed/RPM ratio",
      outcome: "pass",
      value: `ratio = ${(meanRatio * 1000).toFixed(2)} mph/kRPM`,
      detail:
        `Speed/RPM ratio is stable (CV = ${(cv * 100).toFixed(1)}%) — ` +
        `single gear confirmed. Actual gear number unconfirmed (no gear column in log).`,
    });
  } else {
    // Unstable ratio — possible gear change during pull
    checks.push({
      id: "gear_estimated",
      name: "Gear estimation (no gear column)",
      description: "Estimating gear from speed/RPM ratio",
      outcome: "warn",
      value: `CV = ${(cv * 100).toFixed(1)}%`,
      threshold: "< 8%",
      detail:
        `Speed/RPM ratio varies significantly (CV = ${(cv * 100).toFixed(1)}%) — ` +
        `a gear change may have occurred during the pull, or data quality is poor.`,
    });
  }

  return { checks, failureEvents };
}
