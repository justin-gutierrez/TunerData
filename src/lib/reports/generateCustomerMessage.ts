/**
 * Generates a simple, actionable customer-facing message from a ValidationResult.
 *
 * The message is intentionally non-technical: it tells the customer exactly what
 * went wrong and what they need to do differently on the next recording.
 */

import type { ValidationResult } from "../schema/validation-result";

const REDO_INSTRUCTIONS =
  "Please redo the log on a closed course or dyno, starting near 40 mph " +
  "in 4th gear around 2,000 RPM, and hold full throttle all the way to redline.";

const DISCLAIMER =
  "For closed-course, dyno, and educational use only.";

export function generateCustomerMessage(result: ValidationResult): string {
  const { outcome, checks, failureEvents, extractedMetrics, pullWindow } = result;

  // ── Pass ─────────────────────────────────────────────────────────────────
  if (outcome === "pass") {
    const dur = pullWindow?.duration.toFixed(1) ?? "?";
    const peakRpm = pullWindow ? Math.round(pullWindow.peakRpm).toLocaleString() : "?";
    return (
      `Your datalog looks great! A clean pull was detected (${dur} s, ` +
      `reaching ${peakRpm} RPM). All required channels are present and every ` +
      `validation rule passed. Submit this log to your tuner — no action needed.`
    );
  }

  // ── Warn (no hard failures) ───────────────────────────────────────────────
  if (outcome === "warn") {
    const warnNames = checks.warnings.map((c) => c.name.toLowerCase()).join(", ");
    return (
      `Your datalog passed validation with minor warnings (${warnNames}). ` +
      `The log is usable, but addressing these issues on your next recording ` +
      `will improve data accuracy. ${DISCLAIMER}`
    );
  }

  // ── Fail — build a specific, ordered message ──────────────────────────────
  // Work through the most impactful failed check first.
  const failed = checks.failed;

  // Timestamp corruption — bail early, nothing else is reliable
  if (failed.some((c) => c.id === "timestamp_monotonic")) {
    return (
      `Redo required. Your datalog file contains corrupted timestamps, which makes ` +
      `the entire log unusable for analysis. Restart your datalogger app completely ` +
      `before your next pull to ensure the timer resets correctly. ${REDO_INSTRUCTIONS} ${DISCLAIMER}`
    );
  }

  // No pull detected
  if (failed.some((c) => c.id === "pull_detected")) {
    return (
      `Redo required. No wide-open-throttle pull was detected in the log. ` +
      `Make sure you are logging before and throughout the full pull — starting ` +
      `at idle or low throttle and ending well past redline. ${REDO_INSTRUCTIONS} ${DISCLAIMER}`
    );
  }

  // Missing channels
  if (failed.some((c) => c.id.startsWith("required_channel"))) {
    const missingList = failed
      .filter((c) => c.id.startsWith("required_channel"))
      .map((c) => c.name.replace("Required channel: ", "").replace(" / ", " or "))
      .join(", ");
    return (
      `Redo required. The log is missing one or more required data channels: ` +
      `${missingList}. Enable these channels in your datalogger profile before ` +
      `recording. Without them, the tuner cannot safely calibrate your tune. ` +
      `${REDO_INSTRUCTIONS} ${DISCLAIMER}`
    );
  }

  // Wrong gear
  if (failed.some((c) => c.id === "gear_value")) {
    const gearCheck = failed.find((c) => c.id === "gear_value");
    const detectedGear = gearCheck?.value?.toString() ?? "a different gear";
    return (
      `Redo required. The pull was performed in ${detectedGear} rather than 4th gear. ` +
      `Select 4th gear before beginning the pull and hold it through redline without ` +
      `shifting. ${REDO_INSTRUCTIONS} ${DISCLAIMER}`
    );
  }

  // Early throttle lift
  if (failed.some((c) => c.id === "throttle_continuity")) {
    const event = failureEvents.find((e) => e.type === "early_lift");
    const dropRpm = event?.rpm
      ? Math.round(event.rpm).toLocaleString()
      : "approximately 5,000";
    const targetRpm = (6500).toLocaleString();
    return (
      `Redo required. The log contains a partial pull — throttle dropped below 90% ` +
      `at ${dropRpm} RPM before reaching the ${targetRpm} RPM target. ` +
      `Hold the throttle wide open from pull entry all the way to redline without ` +
      `lifting or hesitating. ${REDO_INSTRUCTIONS} ${DISCLAIMER}`
    );
  }

  // Did not reach redline
  if (failed.some((c) => c.id === "target_rpm")) {
    const peakRpm = extractedMetrics?.peakRpm
      ? Math.round(extractedMetrics.peakRpm).toLocaleString()
      : "the target";
    const targetRpm = (6500).toLocaleString();
    return (
      `Redo required. The engine only reached ${peakRpm} RPM — it must reach ` +
      `${targetRpm} RPM before you shift or lift. Let the engine fully rev to ` +
      `redline on the next recording. ${REDO_INSTRUCTIONS} ${DISCLAIMER}`
    );
  }

  // High start RPM
  if (failed.some((c) => c.id === "start_rpm")) {
    const startRpm = extractedMetrics?.startRpm
      ? Math.round(extractedMetrics.startRpm).toLocaleString()
      : "too high";
    const tooHigh = (extractedMetrics?.startRpm ?? 0) > 2400;
    return (
      `Redo required. The pull started ${tooHigh ? "too high" : "too low"} at ` +
      `${startRpm} RPM. Begin the pull near 2,000 RPM — let the engine drop to that ` +
      `range before going wide open throttle. ${REDO_INSTRUCTIONS} ${DISCLAIMER}`
    );
  }

  // Wrong start speed
  if (failed.some((c) => c.id === "start_speed")) {
    const speed = extractedMetrics?.startSpeedMph?.toFixed(1) ?? "?";
    return (
      `Redo required. The pull began at ${speed} mph, outside the 33–47 mph window. ` +
      `Bring the vehicle to approximately 40 mph before initiating the pull. ` +
      `${REDO_INSTRUCTIONS} ${DISCLAIMER}`
    );
  }

  // Low sample rate
  if (failed.some((c) => c.id === "sample_rate")) {
    const hz = extractedMetrics?.sampleRateHz ?? "?";
    return (
      `Redo required. Your datalogger's sample rate is only ${hz} Hz, which is too ` +
      `low for accurate analysis. Increase the logging rate to at least 5 Hz ` +
      `(10 Hz recommended) in your datalogger settings. ${REDO_INSTRUCTIONS} ${DISCLAIMER}`
    );
  }

  // Generic fallback
  const topFail = failed[0];
  return (
    `Redo required. Validation failed: ${topFail?.detail ?? topFail?.name ?? "see failed checks below"}. ` +
    `${REDO_INSTRUCTIONS} ${DISCLAIMER}`
  );
}
