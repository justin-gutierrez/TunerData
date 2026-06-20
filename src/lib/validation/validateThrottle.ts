/**
 * Validates throttle continuity during the pull window.
 *
 * Checks:
 *   1. Average throttle is above the template minimum during the pull.
 *   2. Throttle did NOT drop below minimum before reaching target RPM
 *      (early-lift detection).
 *
 * Classification:
 *   - early_lift  : throttle drop occurred at < 87% of targetEndRpm
 *   - no_redline  : pull ended at ≥ 87% of targetEndRpm but below target
 *                   (handled in validateEndConditions, not here)
 */

import type { NormalizedLogRow } from "../schema/normalized-log";
import type { ValidationTemplate } from "../schema/validation-rules";
import type { CheckResult, PullWindow, FailureEvent } from "../schema/validation-result";

function getThrottle(row: NormalizedLogRow): number | undefined {
  return row.throttlePct ?? row.acceleratorPct;
}

// ─── Result shape ─────────────────────────────────────────────────────────────

export interface ThrottleCheckResult {
  checks: CheckResult[];
  failureEvents: FailureEvent[];
  /** Whether an early-lift was definitively identified */
  earlyLiftDetected: boolean;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function validateThrottle(
  rows: NormalizedLogRow[],
  pullWindow: PullWindow,
  template: ValidationTemplate
): ThrottleCheckResult {
  const minThrottlePct = template.wot?.minThrottlePct ?? 90;
  const targetEndRpm   = template.rpm?.targetEndRpm ?? 6500;
  const checks: CheckResult[] = [];
  const failureEvents: FailureEvent[] = [];
  let earlyLiftDetected = false;

  const pullRows = rows.slice(pullWindow.startIndex, pullWindow.endIndex + 1);

  // ── Average throttle during pull ─────────────────────────────────────────
  const throttleValues = pullRows
    .map((r) => getThrottle(r))
    .filter((v): v is number => v !== undefined);

  if (throttleValues.length > 0) {
    const avg = throttleValues.reduce((a, b) => a + b, 0) / throttleValues.length;
    const avgRounded = Math.round(avg * 10) / 10;

    checks.push({
      id: "avg_throttle",
      name: "Average throttle during pull",
      description: `Throttle must average ≥ ${minThrottlePct}% through the pull`,
      outcome: avg >= minThrottlePct ? "pass" : "warn",
      value: `${avgRounded}%`,
      threshold: `${minThrottlePct}%`,
      detail:
        avg >= minThrottlePct
          ? `Average throttle of ${avgRounded}% meets the ${minThrottlePct}% minimum.`
          : `Average throttle of ${avgRounded}% is below the ${minThrottlePct}% minimum.`,
    });
  }

  // ── Early-lift detection ─────────────────────────────────────────────────
  // The pull window is defined as the HIGH-THROTTLE span.
  // If the pull ended before the RPM target, check the rows just after
  // the pull window to get the drop info.

  const earlyLiftRpmThreshold = targetEndRpm * 0.87; // 87% of target

  if (pullWindow.peakRpm < targetEndRpm) {
    // Pull did not reach target — was it an early lift?
    // Look at the first row after the pull window for throttle context.
    const afterIndex = pullWindow.endIndex + 1;
    const afterRow = afterIndex < rows.length ? rows[afterIndex] : null;
    const afterThrottle = afterRow ? getThrottle(afterRow) : undefined;

    const dropRpm = pullWindow.endRpm;
    const dropTime = pullWindow.endTime;
    const dropThrottle = afterThrottle ?? 0;

    if (dropRpm < earlyLiftRpmThreshold) {
      // Significant early lift — clearly before target
      earlyLiftDetected = true;
      const msg =
        `Throttle dropped to ~${dropThrottle.toFixed(0)}% at approximately ` +
        `${Math.round(dropRpm).toLocaleString()} RPM before reaching the ` +
        `${targetEndRpm.toLocaleString()} RPM target.`;

      checks.push({
        id: "throttle_continuity",
        name: "Throttle continuity",
        description: `Throttle must stay ≥ ${minThrottlePct}% until ${targetEndRpm.toLocaleString()} RPM`,
        outcome: "fail",
        value: `Dropped at ${Math.round(dropRpm).toLocaleString()} RPM`,
        threshold: `${targetEndRpm.toLocaleString()} RPM`,
        detail: msg,
        failureTimestamp: dropTime,
      });

      failureEvents.push({
        id: "early_lift_event",
        type: "early_lift",
        message: msg,
        timeSec: dropTime,
        rpm: dropRpm,
        throttlePct: dropThrottle,
        severity: "high",
      });
    } else {
      // Near-redline lift — covered by validateEndConditions
      checks.push({
        id: "throttle_continuity",
        name: "Throttle continuity",
        description: `Throttle must stay ≥ ${minThrottlePct}% until ${targetEndRpm.toLocaleString()} RPM`,
        outcome: "pass",
        detail: `Throttle was maintained throughout the pull segment (lift occurred near ${Math.round(dropRpm).toLocaleString()} RPM).`,
      });
    }
  } else {
    // Pull reached or exceeded target RPM — throttle was sustained
    checks.push({
      id: "throttle_continuity",
      name: "Throttle continuity",
      description: `Throttle must stay ≥ ${minThrottlePct}% until ${targetEndRpm.toLocaleString()} RPM`,
      outcome: "pass",
      detail: `Full-throttle maintained through ${Math.round(pullWindow.peakRpm).toLocaleString()} RPM.`,
    });
  }

  return { checks, failureEvents, earlyLiftDetected };
}
