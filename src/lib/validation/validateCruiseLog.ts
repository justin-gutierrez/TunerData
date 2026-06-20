/**
 * Validates a cruise log — steady-state cruising at moderate throttle.
 *
 * Checks:
 *   1. Required channels present
 *   2. Sample rate + timestamp integrity
 *   3. Session duration ≥ minDurationSec
 *   4. Speed around target (if targetSpeedMph configured)
 *   5. Throttle within moderate range [minThrottlePct, maxThrottlePct]
 *   6. Speed stability (CV < 8%) if requireStableSpeed
 *   7. RPM stability (CV < 5%) if requireStableRpm
 */

import type { ParsedLog } from "../schema/normalized-log";
import type { ValidationTemplate } from "../schema/validation-rules";
import type { ValidationResult, CheckResult, ExtractedMetrics, DataQuality } from "../schema/validation-result";
import { checkRequiredChannels } from "./requiredChannels";
import { checkSampleRate } from "./sampleRate";
import { scoreValidation } from "./scoreValidation";
import { generateTunerSummary } from "../reports/generateTunerSummary";
import { generateCustomerMessage } from "../reports/generateCustomerMessage";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / Math.abs(mean);
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function validateCruiseLog(
  parsedLog: ParsedLog,
  template: ValidationTemplate
): ValidationResult {
  const allChecks: CheckResult[] = [];
  const rows = parsedLog.rows;
  const cfg = template.cruise ?? {};

  // ── 1. Required channels ─────────────────────────────────────────────────
  const { checks: channelChecks, missingChannels } = checkRequiredChannels(
    parsedLog.columnMappings,
    template
  );
  allChecks.push(...channelChecks);

  // ── 2. Sample rate + timestamps ──────────────────────────────────────────
  const { checks: rateChecks, sampleRateHz, duplicateCount, nonMonotonicCount } =
    checkSampleRate(rows, template);
  allChecks.push(...rateChecks);

  // ── 3. Duration ──────────────────────────────────────────────────────────
  const minDur = cfg.minDurationSec ?? 45;
  const totalDuration =
    rows.length >= 2 ? rows[rows.length - 1].timeSec - rows[0].timeSec : 0;

  allChecks.push({
    id: "cruise_duration",
    name: "Minimum cruise duration",
    description: `Cruise log must contain at least ${minDur} s of data`,
    outcome: totalDuration >= minDur ? "pass" : "fail",
    value: `${totalDuration.toFixed(1)} s`,
    threshold: `${minDur} s`,
    detail:
      totalDuration >= minDur
        ? `Cruise log spans ${totalDuration.toFixed(1)} s — meets the ${minDur} s minimum.`
        : `Cruise log spans only ${totalDuration.toFixed(1)} s — must be ≥ ${minDur} s.`,
  });

  // ── 4. Cruise speed ──────────────────────────────────────────────────────
  if (cfg.targetSpeedMph !== undefined) {
    const targetSpeed = cfg.targetSpeedMph;
    const tolerance   = cfg.speedToleranceMph ?? 10;
    const speedValues = rows.map((r) => r.speedMph).filter((v): v is number => v !== undefined);
    if (speedValues.length > 0) {
      const medSpeed = median(speedValues);
      const inRange  = medSpeed >= targetSpeed - tolerance && medSpeed <= targetSpeed + tolerance;
      allChecks.push({
        id: "cruise_speed",
        name: "Cruise speed",
        description: `Median speed must be ${targetSpeed} ±${tolerance} mph`,
        outcome: inRange ? "pass" : "fail",
        value: `${medSpeed.toFixed(1)} mph median`,
        threshold: `${targetSpeed - tolerance}–${targetSpeed + tolerance} mph`,
        detail: inRange
          ? `Median speed of ${medSpeed.toFixed(1)} mph is within the cruise window.`
          : `Median speed of ${medSpeed.toFixed(1)} mph is outside the ${targetSpeed - tolerance}–${targetSpeed + tolerance} mph cruise window.`,
      });
    }
  }

  // ── 5. Throttle range ────────────────────────────────────────────────────
  const minT = cfg.minThrottlePct ?? 5;
  const maxT = cfg.maxThrottlePct ?? 45;
  const throttleValues = rows
    .map((r) => r.throttlePct ?? r.acceleratorPct)
    .filter((v): v is number => v !== undefined);
  if (throttleValues.length > 0) {
    const medThrottle = median(throttleValues);
    const inRange     = medThrottle >= minT && medThrottle <= maxT;
    allChecks.push({
      id: "cruise_throttle",
      name: "Throttle during cruise",
      description: `Median throttle must be between ${minT}% and ${maxT}%`,
      outcome: inRange ? "pass" : "fail",
      value: `${medThrottle.toFixed(1)}% median`,
      threshold: `${minT}–${maxT}%`,
      detail: inRange
        ? `Median throttle of ${medThrottle.toFixed(1)}% is within the cruise range.`
        : `Median throttle of ${medThrottle.toFixed(1)}% is outside the expected cruise range of ${minT}–${maxT}%.`,
    });
  }

  // ── 6. Speed stability ───────────────────────────────────────────────────
  if (cfg.requireStableSpeed !== false) {
    const speedValues = rows.map((r) => r.speedMph).filter((v): v is number => v !== undefined);
    if (speedValues.length >= 5) {
      const cv    = coefficientOfVariation(speedValues);
      const cvPct = cv * 100;
      allChecks.push({
        id: "cruise_speed_stable",
        name: "Speed stability",
        description: "Speed must be stable during cruise (CV < 8%)",
        outcome: cvPct < 8 ? "pass" : cvPct < 15 ? "warn" : "fail",
        value: `CV = ${cvPct.toFixed(1)}%`,
        threshold: "< 8%",
        detail:
          cvPct < 8
            ? `Speed is stable (CV = ${cvPct.toFixed(1)}%) — consistent cruise.`
            : `Speed variation is ${cvPct.toFixed(1)}% (CV) — higher than expected for steady-state cruise.`,
      });
    }
  }

  // ── 7. RPM stability ─────────────────────────────────────────────────────
  if (cfg.requireStableRpm !== false) {
    const rpmValues = rows.map((r) => r.rpm).filter((v): v is number => v !== undefined);
    if (rpmValues.length >= 5) {
      const cv    = coefficientOfVariation(rpmValues);
      const cvPct = cv * 100;
      allChecks.push({
        id: "cruise_rpm_stable",
        name: "RPM stability",
        description: "RPM must be stable during cruise (CV < 5%)",
        outcome: cvPct < 5 ? "pass" : cvPct < 10 ? "warn" : "fail",
        value: `CV = ${cvPct.toFixed(1)}%`,
        threshold: "< 5%",
        detail:
          cvPct < 5
            ? `RPM is stable (CV = ${cvPct.toFixed(1)}%) — consistent cruise.`
            : `RPM variation is ${cvPct.toFixed(1)}% (CV) — higher than expected for a steady cruise.`,
      });
    }
  }

  // ── Timestamp corruption event ───────────────────────────────────────────
  const allFailureEvents =
    nonMonotonicCount > 0
      ? [
          {
            id: "corrupted_timestamps_event",
            type: "corrupted_timestamps" as const,
            message: `${nonMonotonicCount} non-monotonic timestamp(s) detected.`,
            timeSec: 0,
            severity: "critical" as const,
          },
        ]
      : [];

  // ── Score + split checks ─────────────────────────────────────────────────
  const { score, outcome, mainReason } = scoreValidation(allChecks, missingChannels.length);
  const passedChecks  = allChecks.filter((c) => c.outcome === "pass");
  const failedChecks  = allChecks.filter((c) => c.outcome === "fail");
  const warningChecks = allChecks.filter((c) => c.outcome === "warn");

  const dataQuality: DataQuality = {
    totalRows: rows.length,
    pullRows: rows.length,
    sampleRateHz,
    duplicateTimestamps: duplicateCount,
    missingValuesByChannel: {},
    irrelevantDataPct: 0,
  };

  const extractedMetrics: ExtractedMetrics = {
    pullDurationSec: totalDuration,
    sampleRateHz,
    totalRows: rows.length,
    pullRows: rows.length,
    irrelevantDataPct: 0,
  };

  const partialResult: ValidationResult = {
    outcome,
    score,
    mainReason,
    templateId:   template.id,
    templateName: template.name,
    parsedLog: {
      sourceName:      parsedLog.sourceName,
      detectedFormat:  parsedLog.detectedFormat,
      totalRows:       rows.length,
      columnMappings:  parsedLog.columnMappings,
      warnings:        parsedLog.warnings,
    },
    pullWindow:   undefined,
    dataQuality,
    checks: { passed: passedChecks, failed: failedChecks, warnings: warningChecks },
    missingChannels,
    failureEvents: allFailureEvents,
    extractedMetrics,
    tunerSummary:    "",
    customerMessage: "",
  };

  partialResult.tunerSummary    = JSON.stringify(generateTunerSummary(partialResult));
  partialResult.customerMessage = generateCustomerMessage(partialResult);

  return partialResult;
}
