/**
 * Maps raw CSV column headers to unified NormalizedLogRow field names.
 *
 * Matching strategy (highest confidence wins for each column):
 *   1.0  – exact case-insensitive match against a known alias
 *   0.85 – match after stripping parenthetical units  "(deg)", "(mph)", etc.
 *   0.75 – contains match (alias is a substring of the column name, or vice-versa)
 *   0.9  – regex pattern match (e.g. "timing correction cyl 2")
 *
 * A raw column is "mapped" at ≥ 0.75, "warning" at 0.5–0.74, "unmapped" below that.
 * Each normalizedField can be claimed by at most one raw column (first/highest wins).
 */

import type { ColumnMapping } from "../schema/normalized-log";
import type { DetectedFormat } from "../schema/normalized-log";

// ─── Alias table ─────────────────────────────────────────────────────────────

/**
 * Maps each unified field name to an ordered list of recognised raw-column aliases.
 * Aliases should be listed roughly most-specific → least-specific.
 */
const ALIASES: Record<string, string[]> = {
  timeSec: [
    "time (sec)", "time(sec)", "time_sec", "timestamp",
    "time(s)", "time (s)", "time",
  ],
  rpm: [
    "engine speed (rpm)", "engine speed", "engine_speed",
    "rpm",
  ],
  speedMph: [
    "vehicle speed (mph)", "vehicle speed (km/h)", "vehicle speed",
    "speed_mph", "speed (mph)", "speed (km/h)", "vss", "speed",
  ],
  gear: [
    "current gear", "gear position", "gear",
  ],
  throttlePct: [
    "throttle pos (%)", "throttle pos(%)", "throttle position (%)",
    "throttle position", "throttle (%)", "throttle_pct",
    "tps (%)", "tps", "throttle",
  ],
  acceleratorPct: [
    "accelerator pedal (%)", "accelerator pedal position", "accelerator pedal",
    "pedal position (%)", "pedal position", "app (%)", "app",
    "pedal",
  ],
  afr: [
    "wideband afr", "air fuel ratio", "air/fuel ratio",
    "wb afr", "afr",
  ],
  lambda: [
    "actual lambda", "lambda bank 1", "lambda bank1",
    "lambda b1", "lambda bank 2", "lambda",
  ],
  boostPsi: [
    "boost (psi)", "boost(psi)", "boost pressure (psi)",
    "manifold boost pressure", "boost actual", "boost_psi",
    "boost pressure", "boost",
  ],
  mapKpa: [
    "manifold absolute pressure (kpa)", "manifold absolute pressure",
    "manifold pressure (kpa)", "manifold pressure",
    "map (kpa)", "map(kpa)", "map_kpa", "map",
  ],
  ignitionTimingDeg: [
    "ign timing (deg)", "ign timing(deg)", "ignition timing (deg)",
    "spark advance (deg)", "spark advance", "ignition advance (deg)",
    "ignition advance", "ignition timing", "ign timing",
    "timing cyl 1", "timing cyl1",
    "ignition_timing",
  ],
  knockRetardDeg: [
    "feedback knock (deg)", "feedback knock(deg)", "knock retard (deg)",
    "knock correction (deg)", "knock retard", "knock correction",
    "feedback knock", "kr (deg)", "kr", "knock_retard",
  ],
  iatF: [
    "intake air temperature (°f)", "intake air temperature (f)",
    "intake air temp (°f)", "intake air temp (f)",
    "intake air temperature", "intake air temp",
    "iat (°f)", "iat(°f)", "iat (f)", "iat_f", "iat",
  ],
  coolantTempF: [
    "engine coolant temperature (°f)", "engine coolant temp (°f)",
    "engine coolant temp (f)", "coolant temperature (°f)",
    "coolant temp (°f)", "coolant temp (f)",
    "engine coolant temp", "coolant temp", "coolant_f",
    "ect (°f)", "ect", "coolant",
  ],
  fuelPressurePsi: [
    "fuel rail pressure (psi)", "fuel rail pressure",
    "fuel pressure (psi)", "fuel pressure", "fuel_pressure", "frp",
  ],
};

// ─── Per-cylinder timing correction regex ─────────────────────────────────────

const TIMING_CORRECTION_RE = /timing correction\s+cyl(?:inder)?\s*(\d+)/i;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Strip parenthetical unit suffixes like "(deg)", "(mph)", "(°F)", "(psi)" */
function stripUnits(s: string): string {
  return s.replace(/\s*\(.*?\)\s*/g, "").trim();
}

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

/** Score a single (rawColumn, aliasEntry) pair */
function scoreAlias(raw: string, alias: string): number {
  const rawNorm = normalize(raw);
  const aliasNorm = normalize(alias);

  if (rawNorm === aliasNorm) return 1.0;
  if (normalize(stripUnits(raw)) === normalize(stripUnits(alias))) return 0.85;
  if (rawNorm.includes(aliasNorm) || aliasNorm.includes(rawNorm)) return 0.75;
  return 0;
}

// ─── Unit detection ───────────────────────────────────────────────────────────

/**
 * Tries to infer the unit from the raw column name and the field it will map to.
 * Returns a human-readable unit string for display in the mapping table.
 */
function detectUnit(rawColumn: string, normalizedField: string): string | undefined {
  const lower = rawColumn.toLowerCase();

  // Explicit unit in column name takes priority
  if (lower.includes("km/h") || lower.includes("kph")) return "km/h";
  if (lower.match(/\(°c\)|\(c\)|celsius/)) return "°C";
  if (lower.includes("(psi)") || lower.endsWith("psi")) return "psi";
  if (lower.includes("(bar)") || lower.endsWith("bar")) return "bar";
  if (lower.match(/\(kpa\)|\bkpa\b/)) return "kPa";
  if (lower.includes("(°f)") || lower.includes("(f)")) return "°F";
  if (lower.includes("(rpm)")) return "RPM";
  if (lower.includes("(deg)") || lower.includes("(°)")) return "°";
  if (lower.includes("(%)")) return "%";

  // Default by field
  switch (normalizedField) {
    case "timeSec": return "s";
    case "rpm": return "RPM";
    case "speedMph": return "mph";
    case "throttlePct":
    case "acceleratorPct": return "%";
    case "boostPsi": return "psi";
    case "mapKpa": return "kPa";
    case "ignitionTimingDeg":
    case "knockRetardDeg": return "°";
    case "iatF":
    case "coolantTempF": return "°F";
    case "fuelPressurePsi": return "psi";
    default: return undefined;
  }
}

// ─── Main mapper ─────────────────────────────────────────────────────────────

/**
 * Maps each raw CSV column header to its best unified NormalizedLogRow field.
 * Each normalizedField can only be claimed once (highest-confidence column wins).
 * The `format` hint can optionally influence future per-format overrides.
 */
export function mapColumns(
  headers: string[],
  // format is accepted for future format-specific overrides; not yet used
  format?: DetectedFormat  // eslint-disable-line @typescript-eslint/no-unused-vars
): ColumnMapping[] {
  // Track which normalizedFields have been claimed
  const claimed = new Set<string>();

  // Build candidate list: for every header, find best matching field + score
  const candidates: Array<{
    rawColumn: string;
    normalizedField: string | null;
    score: number;
    detectedUnit?: string;
  }> = headers.map((rawColumn) => {
    // Special case: per-cylinder timing correction columns
    const cylMatch = TIMING_CORRECTION_RE.exec(rawColumn);
    if (cylMatch) {
      const cylNum = parseInt(cylMatch[1], 10);
      if (cylNum >= 1 && cylNum <= 8) {
        return {
          rawColumn,
          normalizedField: `timingCorrectionCylinders.cyl${cylNum}`,
          score: 0.9,
          detectedUnit: "°",
        };
      }
    }

    let bestField: string | null = null;
    let bestScore = 0;

    for (const [field, aliases] of Object.entries(ALIASES)) {
      for (const alias of aliases) {
        const s = scoreAlias(rawColumn, alias);
        if (s > bestScore) {
          bestScore = s;
          bestField = field;
        }
      }
    }

    return {
      rawColumn,
      normalizedField: bestScore >= 0.5 ? bestField : null,
      score: bestScore,
      detectedUnit:
        bestScore >= 0.5 && bestField
          ? detectUnit(rawColumn, bestField)
          : undefined,
    };
  });

  // Sort by score desc so high-confidence mappings claim fields first
  candidates.sort((a, b) => b.score - a.score);

  // Assign, respecting the "one field per normalized key" rule
  const resolved = new Map<string, typeof candidates[0]>();
  for (const c of candidates) {
    if (c.normalizedField && !claimed.has(c.normalizedField)) {
      claimed.add(c.normalizedField);
      resolved.set(c.rawColumn, c);
    }
  }

  // Build final ColumnMapping[] in original header order
  return headers.map((rawColumn): ColumnMapping => {
    const r = resolved.get(rawColumn) ?? candidates.find((c) => c.rawColumn === rawColumn);

    if (!r || !r.normalizedField || r.score < 0.5) {
      return {
        rawColumn,
        normalizedField: null,
        confidence: r?.score ?? 0,
        status: "unmapped",
      };
    }

    return {
      rawColumn,
      normalizedField: r.normalizedField,
      detectedUnit: r.detectedUnit,
      confidence: r.score,
      status: r.score >= 0.75 ? "mapped" : "warning",
    };
  });
}

/** Returns normalizedField names that have no mapped column */
export function getMissingFields(
  mappings: ColumnMapping[],
  requiredFields: string[]
): string[] {
  const mapped = new Set(
    mappings.filter((m) => m.status === "mapped").map((m) => m.normalizedField)
  );
  return requiredFields.filter((f) => !mapped.has(f));
}
