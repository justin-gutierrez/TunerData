/**
 * Main validation orchestrator.
 *
 * Runs every validation module in order and assembles a complete ValidationResult.
 * All checks are always run (even if early checks fail) so the report is comprehensive.
 */

import type { ParsedLog } from "../schema/normalized-log";
import type { ValidationTemplate } from "../schema/validation-rules";
import type {
  ValidationResult,
  CheckResult,
  FailureEvent,
  ExtractedMetrics,
  DataQuality,
} from "../schema/validation-result";

import { checkRequiredChannels } from "./requiredChannels";
import { checkSampleRate } from "./sampleRate";
import { detectPullWindow } from "./detectPullWindow";
import { validateStartConditions } from "./validateStartConditions";
import { validateThrottle } from "./validateThrottle";
import { validateGear } from "./validateGear";
import { validateEndConditions } from "./validateEndConditions";
import { validateMissingValues } from "./validateMissingValues";
import { scoreValidation } from "./scoreValidation";
import { generateTunerSummary } from "../reports/generateTunerSummary";
import { generateCustomerMessage } from "../reports/generateCustomerMessage";
import { validateIdleLog } from "./validateIdleLog";
import { validateCruiseLog } from "./validateCruiseLog";

// ─── Main export ──────────────────────────────────────────────────────────────

export function validateLog(
  parsedLog: ParsedLog,
  template: ValidationTemplate
): ValidationResult {
  // Dispatch to specialised validators for non-pull modes
  if (template.mode === "idle")   return validateIdleLog(parsedLog, template);
  if (template.mode === "cruise") return validateCruiseLog(parsedLog, template);
  const allChecks: CheckResult[] = [];
  const allFailureEvents: FailureEvent[] = [];

  // ── 1. Required channels ────────────────────────────────────────────────
  const { checks: channelChecks, missingChannels } = checkRequiredChannels(
    parsedLog.columnMappings,
    template
  );
  allChecks.push(...channelChecks);

  // ── 2. Sample rate + timestamps ─────────────────────────────────────────
  const { checks: rateChecks, sampleRateHz, duplicateCount, nonMonotonicCount } =
    checkSampleRate(parsedLog.rows, template);
  allChecks.push(...rateChecks);

  // ── 3. Pull window detection ────────────────────────────────────────────
  const { pullWindow, checks: pullChecks } = detectPullWindow(
    parsedLog.rows,
    template
  );
  allChecks.push(...pullChecks);

  // Build data quality metrics (available even without a pull)
  const pullRows = pullWindow
    ? parsedLog.rows.slice(pullWindow.startIndex, pullWindow.endIndex + 1)
    : [];
  const irrelevantDataPct =
    parsedLog.rows.length > 0
      ? Math.round(((parsedLog.rows.length - pullRows.length) / parsedLog.rows.length) * 1000) / 10
      : 0;

  const dataQuality: DataQuality = {
    totalRows: parsedLog.rows.length,
    pullRows: pullRows.length,
    sampleRateHz,
    duplicateTimestamps: duplicateCount,
    missingValuesByChannel: {},
    irrelevantDataPct,
  };

  // ── 4–8. Pull-level checks (only if a pull was found) ──────────────────
  if (pullWindow) {
    // Start conditions
    const startChecks = validateStartConditions(parsedLog.rows, pullWindow, template);
    allChecks.push(...startChecks);

    // Throttle continuity + early lift detection
    const { checks: throttleChecks, failureEvents: throttleEvents } = validateThrottle(
      parsedLog.rows,
      pullWindow,
      template
    );
    allChecks.push(...throttleChecks);
    allFailureEvents.push(...throttleEvents);

    // Gear validation
    const { checks: gearChecks, failureEvents: gearEvents } = validateGear(
      parsedLog.rows,
      pullWindow,
      template
    );
    allChecks.push(...gearChecks);
    allFailureEvents.push(...gearEvents);

    // End conditions (target RPM)
    const { checks: endChecks, failureEvents: endEvents } = validateEndConditions(
      parsedLog.rows,
      pullWindow,
      template
    );
    allChecks.push(...endChecks);
    allFailureEvents.push(...endEvents);

    // Missing values in pull window
    const missingValChecks = validateMissingValues(parsedLog.rows, pullWindow);
    allChecks.push(...missingValChecks);
  }

  // ── 9. Score ────────────────────────────────────────────────────────────
  const { score, outcome, mainReason } = scoreValidation(allChecks, missingChannels.length);

  // ── 10. Split checks ────────────────────────────────────────────────────
  const passedChecks = allChecks.filter((c) => c.outcome === "pass");
  const failedChecks = allChecks.filter((c) => c.outcome === "fail");
  const warningChecks = allChecks.filter((c) => c.outcome === "warn");

  // ── 11. Extracted metrics ───────────────────────────────────────────────
  // Compute average throttle across pull rows
  const throttleValues = pullRows
    .map((r) => r.throttlePct ?? r.acceleratorPct)
    .filter((v): v is number => v !== undefined);
  const avgThrottlePct =
    throttleValues.length > 0
      ? Math.round(
          (throttleValues.reduce((a, b) => a + b, 0) / throttleValues.length) * 10
        ) / 10
      : undefined;

  const extractedMetrics: ExtractedMetrics = {
    pullDurationSec: pullWindow?.duration,
    startRpm: pullWindow?.startRpm,
    endRpm: pullWindow?.endRpm,
    peakRpm: pullWindow?.peakRpm,
    startSpeedMph: pullWindow?.startSpeed,
    endSpeedMph: pullWindow?.endSpeed,
    maxBoostPsi: pullWindow?.maxBoostPsi,
    minAfr: pullWindow?.minAfr,
    minLambda: pullWindow?.minLambda,
    maxKnockRetardDeg: pullWindow?.maxKnockRetard,
    avgThrottlePct,
    sampleRateHz,
    totalRows: parsedLog.rows.length,
    pullRows: pullRows.length,
    irrelevantDataPct,
  };

  // ── 12. Timestamp corruption failure event ───────────────────────────────
  if (nonMonotonicCount > 0) {
    allFailureEvents.push({
      id: "corrupted_timestamps_event",
      type: "corrupted_timestamps",
      message: `${nonMonotonicCount} non-monotonic timestamp(s) detected — log data may be unreliable.`,
      timeSec: 0,
      severity: "critical",
    });
  }

  // ── 13. Assemble result + run report generators ───────────────────────────
  const partialResult: ValidationResult = {
    outcome,
    score,
    mainReason,
    templateId: template.id,
    templateName: template.name,

    parsedLog: {
      sourceName: parsedLog.sourceName,
      detectedFormat: parsedLog.detectedFormat,
      totalRows: parsedLog.rows.length,
      columnMappings: parsedLog.columnMappings,
      warnings: parsedLog.warnings,
    },

    pullWindow: pullWindow ?? undefined,
    dataQuality,

    checks: {
      passed: passedChecks,
      failed: failedChecks,
      warnings: warningChecks,
    },

    missingChannels,
    failureEvents: allFailureEvents,
    extractedMetrics,

    tunerSummary: "",     // filled below
    customerMessage: "",  // filled below
  };

  partialResult.tunerSummary = JSON.stringify(generateTunerSummary(partialResult));
  partialResult.customerMessage = generateCustomerMessage(partialResult);

  return partialResult;
}
