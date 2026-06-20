/**
 * Checks that the pull reached the required target RPM.
 *
 * Distinguishes between:
 *   - no_redline  : pull ended close to target (≥ 87% of targetEndRpm) but did not reach it.
 *   - early_lift  : pull ended far below target — handled by validateThrottle; this module
 *                   still records a fail but defers the failure event creation there.
 */

import type { NormalizedLogRow } from "../schema/normalized-log";
import type { ValidationTemplate } from "../schema/validation-rules";
import type { CheckResult, PullWindow, FailureEvent } from "../schema/validation-result";

export interface EndConditionResult {
  checks: CheckResult[];
  failureEvents: FailureEvent[];
}

export function validateEndConditions(
  _rows: NormalizedLogRow[],
  pullWindow: PullWindow,
  template: ValidationTemplate
): EndConditionResult {
  const checks: CheckResult[] = [];
  const failureEvents: FailureEvent[] = [];

  const targetEndRpm  = template.rpm?.targetEndRpm ?? 6500;
  const requireEndRpm = template.rpm?.requireEndRpm !== false;
  const peakRpm       = pullWindow.peakRpm;
  const earlyLiftRpmThreshold = targetEndRpm * 0.87;

  // If this template doesn't require the pull to reach a specific RPM, skip the check
  if (!requireEndRpm) {
    checks.push({
      id: "target_rpm",
      name: "Target RPM",
      description: "End RPM check disabled for this template",
      outcome: "pass",
      detail: `Peak RPM: ${Math.round(peakRpm).toLocaleString()} (no target required).`,
    });
    return { checks, failureEvents };
  }

  if (peakRpm >= targetEndRpm) {
    checks.push({
      id: "target_rpm",
      name: "Target RPM reached",
      description: `Pull must reach ${targetEndRpm.toLocaleString()} RPM`,
      outcome: "pass",
      value: `${Math.round(peakRpm).toLocaleString()} RPM`,
      threshold: `${targetEndRpm.toLocaleString()} RPM`,
      detail: `Peak RPM of ${Math.round(peakRpm).toLocaleString()} meets the ${targetEndRpm.toLocaleString()} RPM target.`,
    });
  } else if (peakRpm >= earlyLiftRpmThreshold) {
    // Close to target but not quite — no_redline scenario
    const shortfall = Math.round(targetEndRpm - peakRpm);
    const msg =
      `Pull peaked at ${Math.round(peakRpm).toLocaleString()} RPM — ` +
      `${shortfall.toLocaleString()} RPM short of the ${targetEndRpm.toLocaleString()} RPM target. ` +
      `The driver may have shifted or lifted near redline.`;

    checks.push({
      id: "target_rpm",
      name: "Target RPM reached",
      description: `Pull must reach ${targetEndRpm.toLocaleString()} RPM`,
      outcome: "fail",
      value: `${Math.round(peakRpm).toLocaleString()} RPM`,
      threshold: `${targetEndRpm.toLocaleString()} RPM`,
      detail: msg,
      failureTimestamp: pullWindow.endTime,
    });

    failureEvents.push({
      id: "no_redline_event",
      type: "no_redline",
      message: msg,
      timeSec: pullWindow.endTime,
      rpm: peakRpm,
      severity: "high",
    });
  } else {
    // Well below target — early lift (failure event already created by validateThrottle)
    const msg =
      `Pull only reached ${Math.round(peakRpm).toLocaleString()} RPM — ` +
      `significantly below the ${targetEndRpm.toLocaleString()} RPM target.`;

    checks.push({
      id: "target_rpm",
      name: "Target RPM reached",
      description: `Pull must reach ${targetEndRpm.toLocaleString()} RPM`,
      outcome: "fail",
      value: `${Math.round(peakRpm).toLocaleString()} RPM`,
      threshold: `${targetEndRpm.toLocaleString()} RPM`,
      detail: msg,
      failureTimestamp: pullWindow.endTime,
    });
    // No additional failureEvent here — validateThrottle already added early_lift_event
  }

  return { checks, failureEvents };
}
