/**
 * Generates a structured tuner-facing summary from a ValidationResult.
 * Returns a typed data object (not a raw string) so UI components can
 * render each section with proper colour coding.
 */

import type { ValidationResult, ValidationOutcome, CheckResult } from "../schema/validation-result";

export type RowStatus = "pass" | "fail" | "warn" | "neutral";

export interface TunerSummaryRow {
  label: string;
  value: string;
  status?: RowStatus;
}

export interface TunerSummarySection {
  title: string;
  rows: TunerSummaryRow[];
}

export interface TunerSummaryData {
  outcome: ValidationOutcome;
  score: number;
  templateName: string;
  mainReason?: string;
  sections: TunerSummarySection[];
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmt(val: number | undefined, unit: string, decimals = 1): string {
  if (val === undefined || !isFinite(val)) return "—";
  return `${val.toFixed(decimals)} ${unit}`.trim();
}

function fmtRpm(val: number | undefined): string {
  if (val === undefined || !isFinite(val)) return "—";
  return `${Math.round(val).toLocaleString()} RPM`;
}

function fmtSpeed(val: number | undefined): string {
  if (val === undefined || !isFinite(val)) return "—";
  return `${val.toFixed(1)} mph`;
}

function findCheck(
  result: ValidationResult,
  id: string
): CheckResult | undefined {
  return [
    ...result.checks.passed,
    ...result.checks.failed,
    ...result.checks.warnings,
  ].find((c) => c.id === id);
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function generateTunerSummary(result: ValidationResult): TunerSummaryData {
  const { pullWindow, extractedMetrics, checks, missingChannels, parsedLog } = result;

  // ── Pull window section ───────────────────────────────────────────────────
  const pullRows: TunerSummaryRow[] = [];

  if (pullWindow) {
    pullRows.push(
      {
        label: "Time range",
        value: `${pullWindow.startTime.toFixed(1)} s – ${pullWindow.endTime.toFixed(1)} s`,
      },
      { label: "Duration", value: `${pullWindow.duration.toFixed(1)} s` },
      { label: "Start RPM", value: fmtRpm(pullWindow.startRpm) },
      { label: "End RPM", value: fmtRpm(pullWindow.endRpm) },
      { label: "Peak RPM", value: fmtRpm(pullWindow.peakRpm) },
      { label: "Start speed", value: fmtSpeed(pullWindow.startSpeed) },
      { label: "End speed", value: fmtSpeed(pullWindow.endSpeed) },
    );

    if (extractedMetrics?.avgThrottlePct !== undefined) {
      const avg = extractedMetrics.avgThrottlePct;
      pullRows.push({
        label: "Avg throttle",
        value: `${avg.toFixed(1)}%`,
        status: avg >= 90 ? "pass" : avg >= 80 ? "warn" : "fail",
      });
    }

    if (pullWindow.maxBoostPsi !== undefined) {
      pullRows.push({ label: "Max boost", value: fmt(pullWindow.maxBoostPsi, "psi") });
    }

    if (pullWindow.minAfr !== undefined) {
      const afr = pullWindow.minAfr;
      pullRows.push({
        label: "Min AFR",
        value: afr.toFixed(2),
        status: afr < 11.0 ? "fail" : afr < 11.5 ? "warn" : "pass",
      });
    } else if (pullWindow.minLambda !== undefined) {
      const lam = pullWindow.minLambda;
      pullRows.push({
        label: "Min Lambda",
        value: lam.toFixed(3),
        status: lam < 0.75 ? "fail" : lam < 0.78 ? "warn" : "pass",
      });
    }

    if (pullWindow.maxKnockRetard !== undefined) {
      const kr = pullWindow.maxKnockRetard;
      pullRows.push({
        label: "Max knock retard",
        value: `${kr.toFixed(1)}°`,
        status: kr > 3 ? "fail" : kr > 1 ? "warn" : "pass",
      });
    }
  }

  // ── Gear section ─────────────────────────────────────────────────────────
  const gearCheck = findCheck(result, "gear_value") ?? findCheck(result, "gear_estimated");
  if (gearCheck) {
    pullRows.push({
      label: "Gear",
      value:
        typeof gearCheck.value === "string"
          ? gearCheck.value
          : gearCheck.outcome === "pass"
          ? "Confirmed"
          : "Check failed",
      status: gearCheck.outcome,
    });
  }

  // ── Data quality section ──────────────────────────────────────────────────
  const mappedCount = parsedLog.columnMappings.filter((m) => m.status !== "unmapped").length;
  const dataRows: TunerSummaryRow[] = [
    { label: "Detected format", value: parsedLog.detectedFormat },
    { label: "Total rows", value: parsedLog.totalRows.toLocaleString() },
    {
      label: "Pull rows",
      value:
        extractedMetrics?.pullRows !== undefined
          ? extractedMetrics.pullRows.toLocaleString()
          : "—",
    },
    {
      label: "Sample rate",
      value: extractedMetrics?.sampleRateHz
        ? `${extractedMetrics.sampleRateHz} Hz`
        : "—",
    },
    {
      label: "Channels mapped",
      value: `${mappedCount} / ${parsedLog.columnMappings.length}`,
    },
  ];

  if (extractedMetrics?.irrelevantDataPct !== undefined) {
    dataRows.push({
      label: "Non-pull data",
      value: `${extractedMetrics.irrelevantDataPct.toFixed(1)}%`,
    });
  }

  // ── Required channels section ─────────────────────────────────────────────
  const channelRows: TunerSummaryRow[] =
    missingChannels.length > 0
      ? missingChannels.map((ch) => ({
          label: "Missing",
          value: ch,
          status: "fail" as RowStatus,
        }))
      : [
          {
            label: "Status",
            value: "All required channels present",
            status: "pass" as RowStatus,
          },
        ];

  // ── Failed / warned checks section ───────────────────────────────────────
  const checkRows: TunerSummaryRow[] = [
    ...checks.failed.map((c) => ({
      label: c.name,
      value: c.detail ?? (typeof c.value === "string" ? c.value : "See detail"),
      status: "fail" as RowStatus,
    })),
    ...checks.warnings.map((c) => ({
      label: c.name,
      value: c.detail ?? (typeof c.value === "string" ? c.value : "See detail"),
      status: "warn" as RowStatus,
    })),
  ];

  // ── Assemble sections ─────────────────────────────────────────────────────
  const sections: TunerSummarySection[] = [];

  if (pullRows.length > 0) {
    sections.push({ title: "Pull Window", rows: pullRows });
  }

  sections.push({ title: "Data Quality", rows: dataRows });
  sections.push({ title: "Required Channels", rows: channelRows });

  if (checkRows.length > 0) {
    sections.push({ title: "Check Results", rows: checkRows });
  }

  return {
    outcome: result.outcome,
    score: result.score,
    templateName: result.templateName,
    mainReason: result.mainReason,
    sections,
  };
}
