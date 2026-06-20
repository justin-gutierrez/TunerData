/**
 * Checks that the pull started within the expected speed and RPM windows.
 *
 * Speed check only runs when:
 *   - mode === "roll_pull"  (always checks speed)
 *   - mode === "wot_pull"   (only if roll.enabled === true)
 */

import type { NormalizedLogRow } from "../schema/normalized-log";
import type { ValidationTemplate } from "../schema/validation-rules";
import type { CheckResult, PullWindow } from "../schema/validation-result";

export function validateStartConditions(
  _rows: NormalizedLogRow[],
  pullWindow: PullWindow,
  template: ValidationTemplate
): CheckResult[] {
  const checks: CheckResult[] = [];

  // ── Start speed ──────────────────────────────────────────────────────────
  const checkSpeed =
    template.mode === "roll_pull" ||
    (template.mode === "wot_pull" && template.roll?.enabled === true);

  if (checkSpeed && template.roll?.targetSpeedMph !== undefined) {
    const targetSpeed = template.roll.targetSpeedMph;
    const tolerance  = template.roll.speedToleranceMph ?? 5;
    const minSpeed   = targetSpeed - tolerance;
    const maxSpeed   = targetSpeed + tolerance;
    const actual     = pullWindow.startSpeed;

    if (actual >= minSpeed && actual <= maxSpeed) {
      checks.push({
        id: "start_speed",
        name: "Start speed",
        description: `Pull must begin between ${minSpeed} and ${maxSpeed} mph`,
        outcome: "pass",
        value: `${actual.toFixed(1)} mph`,
        threshold: `${targetSpeed} mph ±${tolerance}`,
        detail: `Pull started at ${actual.toFixed(1)} mph — within the ${minSpeed}–${maxSpeed} mph window.`,
      });
    } else {
      checks.push({
        id: "start_speed",
        name: "Start speed",
        description: `Pull must begin between ${minSpeed} and ${maxSpeed} mph`,
        outcome: "fail",
        value: `${actual.toFixed(1)} mph`,
        threshold: `${targetSpeed} mph ±${tolerance}`,
        detail: `Pull started at ${actual.toFixed(1)} mph, outside the required ${minSpeed}–${maxSpeed} mph window.`,
      });
    }
  }

  // ── Start RPM ────────────────────────────────────────────────────────────
  if (template.rpm?.startRpm !== undefined) {
    const startRpm   = template.rpm.startRpm;
    const tolerance  = template.rpm.startRpmTolerance ?? 200;
    const minRpm     = startRpm - tolerance;
    const maxRpm     = startRpm + tolerance;
    const actual     = pullWindow.startRpm;

    if (actual >= minRpm && actual <= maxRpm) {
      checks.push({
        id: "start_rpm",
        name: "Start RPM",
        description: `Pull must begin between ${minRpm.toLocaleString()} and ${maxRpm.toLocaleString()} RPM`,
        outcome: "pass",
        value: `${Math.round(actual).toLocaleString()} RPM`,
        threshold: `${startRpm.toLocaleString()} ±${tolerance}`,
        detail: `Pull began at ${Math.round(actual).toLocaleString()} RPM — within the required window.`,
      });
    } else {
      const dir = actual > maxRpm ? "high" : "low";
      checks.push({
        id: "start_rpm",
        name: "Start RPM",
        description: `Pull must begin between ${minRpm.toLocaleString()} and ${maxRpm.toLocaleString()} RPM`,
        outcome: "fail",
        value: `${Math.round(actual).toLocaleString()} RPM`,
        threshold: `${startRpm.toLocaleString()} ±${tolerance}`,
        detail: `Pull began too ${dir} at ${Math.round(actual).toLocaleString()} RPM — required range is ${minRpm.toLocaleString()}–${maxRpm.toLocaleString()} RPM.`,
        failureTimestamp: pullWindow.startTime,
      });
    }
  }

  return checks;
}
