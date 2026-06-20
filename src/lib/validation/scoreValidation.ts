/**
 * Computes the final validation score (0–100) and overall outcome
 * from the list of all check results.
 *
 * Score deductions per failed check:
 *   pull_detected         -40  (nothing useful without a pull)
 *   timestamp_monotonic   -30  (corrupted data)
 *   required_channel_*    -25  (per missing group, up to -50 total)
 *   gear_value            -25
 *   throttle_continuity   -20
 *   target_rpm            -20
 *   pull_duration         -20
 *   start_speed           -15
 *   sample_rate           -10  (fail: -10, warn: -5)
 *   start_rpm             -10
 *   duplicate_timestamps  -5
 *   missing_values_pull   -5
 *   avg_throttle          -3  (warn only)
 *   gear_estimated        -2  (warn only)
 *
 * Outcome:
 *   Any failed check → FAIL
 *   No fails but warnings → WARN
 *   All passed → PASS
 */

import type { CheckResult, ValidationOutcome } from "../schema/validation-result";

const DEDUCTIONS: Record<string, number> = {
  // Pull mode checks
  pull_detected:                40,
  timestamp_monotonic:          30,
  required_channel_timeSec:     30,
  required_channel_rpm:         30,
  required_channel_speedMph:    20,
  required_channel_throttlePct: 25,
  required_channel_afr:         20,
  required_channel_ignitionTimingDeg: 15,
  required_channel_knockRetardDeg:    10,
  gear_value:         25,
  throttle_continuity: 20,
  target_rpm:         20,
  pull_duration:      20,
  start_speed:        15,
  sample_rate:        10,
  start_rpm:          10,
  duplicate_timestamps: 5,
  missing_values_pull:  5,
  avg_throttle:         3,
  gear_estimated:       2,
  // Idle mode checks
  idle_duration:      30,
  idle_speed:         25,
  idle_throttle:      20,
  idle_rpm_stable:    15,
  idle_coolant_temp:  10,
  // Cruise mode checks
  cruise_duration:    30,
  cruise_speed:       25,
  cruise_throttle:    20,
  cruise_speed_stable: 15,
  cruise_rpm_stable:  10,
};

/** Half-deduction for warning-level outcomes on the same check */
const WARN_DEDUCTIONS: Record<string, number> = {
  sample_rate: 8,   // significant warning — worth showing clearly
  duplicate_timestamps: 3,
  avg_throttle: 3,
  gear_estimated: 2,
  missing_values_pull: 3,
  gear_estimated_check: 2,
};

export interface ScoreResult {
  score: number;
  outcome: ValidationOutcome;
  mainReason?: string;
}

export function scoreValidation(
  allChecks: CheckResult[],
  missingChannelCount: number
): ScoreResult {
  let score = 100;
  let hasFail = false;
  let hasWarn = false;
  let mainReason: string | undefined;

  for (const check of allChecks) {
    if (check.outcome === "fail") {
      hasFail = true;
      const deduction = DEDUCTIONS[check.id] ?? 10;
      score -= deduction;
      // Track the most severe failure reason
      if (!mainReason || deduction >= (DEDUCTIONS[mainReason] ?? 0)) {
        mainReason = check.id;
      }
    } else if (check.outcome === "warn") {
      hasWarn = true;
      const deduction = WARN_DEDUCTIONS[check.id] ?? 2;
      score -= deduction;
    }
  }

  // Extra deduction for multiple missing channels
  if (missingChannelCount > 1) {
    score -= (missingChannelCount - 1) * 20;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const outcome: ValidationOutcome = hasFail
    ? "fail"
    : hasWarn
    ? "warn"
    : "pass";

  // Map check ID to a human reason
  const reasonMap: Record<string, string> = {
    pull_detected:        "No WOT pull segment found in the log.",
    timestamp_monotonic:  "Log timestamps are corrupted (non-monotonic).",
    required_channel_timeSec:     "Required time channel is missing.",
    required_channel_rpm:         "Required RPM channel is missing.",
    required_channel_afr:         "Required AFR or lambda channel is missing.",
    required_channel_throttlePct: "Required throttle channel is missing.",
    gear_value:           "Pull was performed in the wrong gear.",
    throttle_continuity:  "Throttle was lifted before reaching target RPM.",
    target_rpm:           "Pull did not reach the required target RPM.",
    pull_duration:        "Pull was too short.",
    start_speed:          "Pull began at an incorrect vehicle speed.",
    sample_rate:          "Sample rate is below the required minimum.",
    start_rpm:            "Pull began at an incorrect RPM.",
    missing_values_pull:  "Key channels have missing values in the pull window.",
    idle_duration:        "Idle log is shorter than the required minimum duration.",
    idle_speed:           "Vehicle was not stationary during the idle log.",
    idle_throttle:        "Throttle was too high during the idle log.",
    idle_rpm_stable:      "RPM was not stable during the idle period.",
    idle_coolant_temp:    "Engine coolant was not warm enough for a valid idle log.",
    cruise_duration:      "Cruise log is shorter than the required minimum duration.",
    cruise_speed:         "Vehicle speed was outside the required cruise speed range.",
    cruise_throttle:      "Throttle was outside the expected range for cruising.",
    cruise_speed_stable:  "Vehicle speed was not stable during the cruise period.",
    cruise_rpm_stable:    "RPM was not stable during the cruise period.",
  };

  return {
    score,
    outcome,
    mainReason: mainReason ? (reasonMap[mainReason] ?? mainReason) : undefined,
  };
}
