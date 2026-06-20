/**
 * Validates an idle log — stationary engine at operating temperature.
 *
 * Checks:
 *   1. Required channels present
 *   2. Sample rate + timestamp integrity
 *   3. Session duration ≥ minDurationSec
 *   4. Vehicle speed near 0 (median < maxVehicleSpeedMph)
 *   5. Throttle low (median < maxThrottlePct)
 *   6. RPM stability (CV < 5%) if requireStableRpm
 *   7. Coolant temp ≥ minCoolantTempF if configured
 */

import type { ParsedLog } from "../schema/normalized-log";
import type { ValidationTemplate } from "../schema/validation-rules";
import type { ValidationResult, CheckResult, ExtractedMetrics, DataQuality } from "../schema/validation-result";
import { checkRequiredChannels } from "./requiredChannels";
import { checkSampleRate } from "./sampleRate";
import { scoreValidation } from "./scoreValidation";
import { generateTunerSummary } from "../reports/generateTunerSummary";
import { generateCustomerMessage } from "../reports/generateCustomerMessage";
import { estimateSampleRate } from "./sampleRate";

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

export function validateIdleLog(
  parsedLog: ParsedLog,
  template: ValidationTemplate
): ValidationResult {
  const allChecks: CheckResult[] = [];
  const rows = parsedLog.rows;
  const cfg = template.idle ?? {};

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
  const minDur = cfg.minDurationSec ?? 30;
  const totalDuration =
    rows.length >= 2 ? rows[rows.length - 1].timeSec - rows[0].timeSec : 0;

  allChecks.push({
    id: "idle_duration",
    name: "Minimum idle duration",
    description: `Idle log must contain at least ${minDur} s of data`,
    outcome: totalDuration >= minDur ? "pass" : "fail",
    value: `${totalDuration.toFixed(1)} s`,
    threshold: `${minDur} s`,
    detail:
      totalDuration >= minDur
        ? `Idle log spans ${totalDuration.toFixed(1)} s — meets the ${minDur} s minimum.`
        : `Idle log spans only ${totalDuration.toFixed(1)} s — must be ≥ ${minDur} s.`,
  });

  // ── 4. Vehicle speed near 0 ──────────────────────────────────────────────
  const maxSpeed = cfg.maxVehicleSpeedMph ?? 2;
  const speedValues = rows.map((r) => r.speedMph).filter((v): v is number => v !== undefined);
  if (speedValues.length > 0) {
    const medSpeed = median(speedValues);
    allChecks.push({
      id: "idle_speed",
      name: "Vehicle speed near 0",
      description: `Median vehicle speed must be < ${maxSpeed} mph`,
      outcome: medSpeed < maxSpeed ? "pass" : "fail",
      value: `${medSpeed.toFixed(1)} mph median`,
      threshold: `< ${maxSpeed} mph`,
      detail:
        medSpeed < maxSpeed
          ? `Median speed of ${medSpeed.toFixed(1)} mph confirms vehicle was stationary.`
          : `Median speed of ${medSpeed.toFixed(1)} mph exceeds the ${maxSpeed} mph stationary limit — vehicle may have been moving.`,
    });
  }

  // ── 5. Low throttle ──────────────────────────────────────────────────────
  const maxThrottle = cfg.maxThrottlePct ?? 5;
  const throttleValues = rows
    .map((r) => r.throttlePct ?? r.acceleratorPct)
    .filter((v): v is number => v !== undefined);
  if (throttleValues.length > 0) {
    const medThrottle = median(throttleValues);
    allChecks.push({
      id: "idle_throttle",
      name: "Throttle at idle",
      description: `Median throttle must be < ${maxThrottle}% during idle`,
      outcome: medThrottle < maxThrottle ? "pass" : "fail",
      value: `${medThrottle.toFixed(1)}% median`,
      threshold: `< ${maxThrottle}%`,
      detail:
        medThrottle < maxThrottle
          ? `Median throttle of ${medThrottle.toFixed(1)}% confirms idle conditions.`
          : `Median throttle of ${medThrottle.toFixed(1)}% is above the ${maxThrottle}% idle threshold.`,
    });
  }

  // ── 6. RPM stability ─────────────────────────────────────────────────────
  if (cfg.requireStableRpm !== false) {
    const rpmValues = rows.map((r) => r.rpm).filter((v): v is number => v !== undefined);
    if (rpmValues.length >= 5) {
      const cv = coefficientOfVariation(rpmValues);
      const cvPct = cv * 100;
      allChecks.push({
        id: "idle_rpm_stable",
        name: "RPM stability",
        description: "RPM must be stable during idle (CV < 5%)",
        outcome: cvPct < 5 ? "pass" : cvPct < 10 ? "warn" : "fail",
        value: `CV = ${cvPct.toFixed(1)}%`,
        threshold: "< 5%",
        detail:
          cvPct < 5
            ? `RPM is stable (CV = ${cvPct.toFixed(1)}%) — consistent idle quality.`
            : `RPM variation is ${cvPct.toFixed(1)}% (CV) — higher than expected for a stable idle.`,
      });
    }
  }

  // ── 7. Coolant temperature ───────────────────────────────────────────────
  if (cfg.minCoolantTempF !== undefined) {
    const coolantValues = rows
      .map((r) => r.coolantTempF)
      .filter((v): v is number => v !== undefined);
    if (coolantValues.length > 0) {
      const medCoolant = median(coolantValues);
      allChecks.push({
        id: "idle_coolant_temp",
        name: "Coolant temperature",
        description: `Coolant temp must be ≥ ${cfg.minCoolantTempF}°F`,
        outcome: medCoolant >= cfg.minCoolantTempF ? "pass" : "fail",
        value: `${medCoolant.toFixed(0)}°F`,
        threshold: `≥ ${cfg.minCoolantTempF}°F`,
        detail:
          medCoolant >= cfg.minCoolantTempF
            ? `Coolant temp of ${medCoolant.toFixed(0)}°F meets the ${cfg.minCoolantTempF}°F minimum.`
            : `Coolant temp of ${medCoolant.toFixed(0)}°F is below the required ${cfg.minCoolantTempF}°F — engine may not be fully warmed up.`,
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

// Re-export for convenience
export { estimateSampleRate };
