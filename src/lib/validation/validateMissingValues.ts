/**
 * Checks for missing (undefined) values within the pull window for the
 * key telemetry channels.  Missing values during the pull are a data quality
 * concern but rarely fatal on their own.
 */

import type { NormalizedLogRow } from "../schema/normalized-log";
import type { CheckResult, PullWindow } from "../schema/validation-result";

type KeyChannel = {
  /** Primary field to check */
  field: keyof NormalizedLogRow;
  /** Alternative fields that satisfy this channel (e.g. acceleratorPct as a throttle proxy) */
  alternatives?: (keyof NormalizedLogRow)[];
  label: string;
  critical: boolean;
};

const KEY_CHANNELS: KeyChannel[] = [
  { field: "rpm", label: "RPM", critical: true },
  { field: "speedMph", label: "Speed", critical: true },
  // Either throttle position or accelerator pedal position is acceptable
  { field: "throttlePct", alternatives: ["acceleratorPct"], label: "Throttle / Pedal", critical: true },
  // Either AFR or Lambda covers air-fuel — checked together below
  { field: "afr", alternatives: ["lambda"], label: "AFR / Lambda", critical: false },
  { field: "boostPsi", label: "Boost", critical: false },
  { field: "ignitionTimingDeg", label: "Ignition timing", critical: false },
  { field: "knockRetardDeg", label: "Knock retard", critical: false },
];

export function validateMissingValues(
  rows: NormalizedLogRow[],
  pullWindow: PullWindow
): CheckResult[] {
  const pullRows = rows.slice(pullWindow.startIndex, pullWindow.endIndex + 1);
  if (pullRows.length === 0) return [];

  const issues: string[] = [];
  let hasCriticalMissing = false;
  const missingByChannel: Record<string, number> = {};

  for (const ch of KEY_CHANNELS) {
    const allFields = [ch.field, ...(ch.alternatives ?? [])];

    const missingCount = pullRows.filter((r) => {
      // Row is OK if ANY of the field / alternatives has a valid value
      const hasDirectValue = allFields.some((f) => {
        const val = r[f];
        return val !== undefined && (typeof val !== "number" || isFinite(val));
      });
      if (hasDirectValue) return false;

      // Special case: timingCorrectionCylinders object counts as knock data
      if (ch.field === "knockRetardDeg" && r.timingCorrectionCylinders) {
        const hasCylData = Object.values(r.timingCorrectionCylinders).some(
          (v) => v !== undefined && isFinite(v as number)
        );
        if (hasCylData) return false;
      }

      return true;
    }).length;

    const missingPct = (missingCount / pullRows.length) * 100;

    if (missingCount > 0) {
      missingByChannel[ch.label] = missingCount;
      if (missingPct > 20) {
        issues.push(`${ch.label}: ${missingCount} / ${pullRows.length} rows missing (${missingPct.toFixed(0)}%)`);
        if (ch.critical) hasCriticalMissing = true;
      }
    }
  }

  if (issues.length === 0) {
    return [
      {
        id: "missing_values_pull",
        name: "Pull window data completeness",
        description: "Key channels should have values throughout the pull",
        outcome: "pass",
        detail: `All key channels have sufficient data across ${pullRows.length} pull rows.`,
      },
    ];
  }

  return [
    {
      id: "missing_values_pull",
      name: "Pull window data completeness",
      description: "Key channels should have values throughout the pull",
      outcome: hasCriticalMissing ? "fail" : "warn",
      detail:
        `Missing values detected in pull window: ${issues.join("; ")}.`,
    },
  ];
}
