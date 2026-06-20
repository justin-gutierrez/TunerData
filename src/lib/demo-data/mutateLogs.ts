/**
 * Mutation functions and CSV serializers for all 10 demo log scenarios.
 *
 * Each mutator takes a MutablePullRow[] and returns a modified copy.
 * CSV serializers convert those rows into format-specific string content.
 */

import { type MutablePullRow, PULL_CONFIG } from "./generateGoodPull";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function r(v: number, d = 2): number {
  const f = Math.pow(10, d);
  return Math.round(v * f) / f;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

// ─── CSV serializers ──────────────────────────────────────────────────────────

/**
 * Generic clean CSV format.
 * If afr/lambda are absent from ALL rows the columns are omitted entirely.
 */
export function toGenericCsv(rows: MutablePullRow[]): string {
  const hasAfr = rows.some((r) => r.afr !== undefined);

  // Generic format uses AFR (not lambda) as the air-fuel channel
  const header = [
    "time",
    "rpm",
    "speed_mph",
    "gear",
    "throttle",
    hasAfr ? "afr" : null,
    "boost_psi",
    "ignition_timing",
    "knock_retard",
    "iat_f",
    "coolant_f",
  ]
    .filter(Boolean)
    .join(",");

  const dataRows = rows.map((row) => {
    const cols: (number | string)[] = [
      row.time,
      row.rpm,
      row.speedMph,
      row.gear,
      row.throttle,
    ];
    if (hasAfr) cols.push(row.afr ?? "");
    cols.push(row.boostPsi, row.ignitionTiming, row.knockRetard, row.iatF, row.coolantF);
    return cols.join(",");
  });

  return [header, ...dataRows].join("\n");
}

/**
 * COBB Accessport-like CSV format.
 * Does NOT include a gear column.
 * Uses AFR (not lambda), COBB-style column names.
 */
export function toCobbCsv(rows: MutablePullRow[]): string {
  const hasAfr = rows.some((r) => r.afr !== undefined);

  const header = [
    "Time (sec)",
    "RPM",
    "Vehicle Speed (mph)",
    "Throttle Pos (%)",
    "Boost (psi)",
    hasAfr ? "AFR" : null,
    "Ign Timing (deg)",
    "Feedback Knock (deg)",
    "IAT (°F)",
    "Coolant Temp (°F)",
  ]
    .filter(Boolean)
    .join(",");

  const dataRows = rows.map((row) => {
    const cols: (number | string)[] = [
      row.time,
      row.rpm,
      row.speedMph,
      row.throttle,
      row.boostPsi,
    ];
    if (hasAfr) cols.push(row.afr ?? "");
    cols.push(row.ignitionTiming, row.knockRetard, row.iatF, row.coolantF);
    return cols.join(",");
  });

  return [header, ...dataRows].join("\n");
}

/**
 * MHD/BMW-like CSV format.
 * Uses: speed (not speed_mph), pedal (not throttle), lambda (not afr),
 * "boost actual", "timing cyl 1", "timing correction cyl 1/2".
 */
export function toMhdCsv(rows: MutablePullRow[]): string {
  const hasLambda = rows.some((r) => r.lambda !== undefined);

  const header = [
    "time",
    "rpm",
    "speed",
    "gear",
    "pedal",
    "boost actual",
    hasLambda ? "lambda bank 1" : null,
    "timing cyl 1",
    "timing correction cyl 1",
    "timing correction cyl 2",
    "iat",
    "coolant",
  ]
    .filter(Boolean)
    .join(",");

  const dataRows = rows.map((row) => {
    // MHD timing correction columns store negative knock retard
    const timingCorr = r(-row.knockRetard, 2);
    const cols: (number | string)[] = [
      row.time,
      row.rpm,
      row.speedMph,
      row.gear,
      row.throttle, // "pedal" = accelerator pedal %
      row.boostPsi,
    ];
    if (hasLambda) cols.push(row.lambda ?? "");
    cols.push(row.ignitionTiming, timingCorr, timingCorr, row.iatF, row.coolantF);
    return cols.join(",");
  });

  return [header, ...dataRows].join("\n");
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Deep clone a row array */
function clone(rows: MutablePullRow[]): MutablePullRow[] {
  return rows.map((row) => ({ ...row }));
}

/** Identify which rows fall inside the pull window by throttle */
function isPullRow(row: MutablePullRow): boolean {
  return row.throttle >= 90 && row.time >= PULL_CONFIG.pullStartSec;
}

// ── 1. Remove AFR and lambda ─────────────────────────────────────────────────

/**
 * Scenario: Missing AFR / lambda channel.
 * The CSV will lack both afr and lambda columns.
 */
export function mutateMissingAfr(rows: MutablePullRow[]): MutablePullRow[] {
  return clone(rows).map((row) => {
    delete row.afr;
    delete row.lambda;
    return row;
  });
}

// ── 2. Wrong gear ────────────────────────────────────────────────────────────

/**
 * Scenario: Wrong gear — entire pull is in 3rd gear instead of 4th.
 * Speed/RPM ratio reflects 3rd gear (higher RPM for same speed).
 */
export function mutateWrongGear(rows: MutablePullRow[], targetGear = 3): MutablePullRow[] {
  // 3rd gear ratio factor is ~1.33× higher RPM per MPH relative to 4th
  const rpmSpeedScale = targetGear === 3 ? 1.32 : 1;
  return clone(rows).map((row) => ({
    ...row,
    gear: targetGear,
    // Adjust speed to match the gear ratio (lower speed for same RPM)
    speedMph: r(row.speedMph / rpmSpeedScale, 1),
  }));
}

// ── 3. Early throttle lift ───────────────────────────────────────────────────

/**
 * Scenario: Early throttle lift.
 * Throttle drops from ~98% to ~60% when RPM is between 5,100 and 5,300
 * (approximately 5,180 RPM), then stays low — before reaching 6,500 target.
 * The RPM rise stalls as a result.
 */
export function mutateEarlyLift(rows: MutablePullRow[]): MutablePullRow[] {
  let liftApplied = false;
  return clone(rows).map((row) => {
    if (isPullRow(row) && row.rpm >= 5080 && !liftApplied) {
      liftApplied = true;
    }
    if (liftApplied && row.rpm >= 5080) {
      const throttle = r(clamp(62 + Math.sin(row.time * 3.1) * 4, 56, 68), 1);
      return {
        ...row,
        throttle,
        // RPM stalls and begins to drop after lift
        rpm: Math.max(row.rpm - Math.max(0, (row.rpm - 5180)) * 0.8, 5000),
        boostPsi: r(Math.max(0, row.boostPsi - 12), 1),
        afr: row.afr !== undefined ? r(13.8 + Math.sin(row.time * 2) * 0.3, 2) : undefined,
        lambda: row.lambda !== undefined ? r((13.8 + Math.sin(row.time * 2) * 0.3) / 14.7, 3) : undefined,
      };
    }
    return row;
  });
}

// ── 4. High RPM start ────────────────────────────────────────────────────────

/**
 * Scenario: Pull started too high in the RPM range (~2,800 instead of 2,000).
 * All RPM values are offset upward; speed adjusts proportionally.
 */
export function mutateHighRpmStart(rows: MutablePullRow[]): MutablePullRow[] {
  const rpmOffset = 780;
  return clone(rows).map((row) => {
    const newRpm = Math.min(7400, row.rpm + rpmOffset);
    return {
      ...row,
      rpm: newRpm,
      speedMph: r(newRpm * PULL_CONFIG.gearRatioFactor, 1),
    };
  });
}

// ── 5. Did not reach redline ─────────────────────────────────────────────────

/**
 * Scenario: Pull ends prematurely — RPM never reaches 6,500.
 * The driver lifted at ~5,750 RPM and the data ends there.
 * Throttle stays high until the premature lift — this is NOT an early-lift
 * failure (throttle is maintained up to ~5,750 RPM); the car simply didn't
 * continue to the target RPM.
 */
export function mutateNoRedline(rows: MutablePullRow[]): MutablePullRow[] {
  const RPM_CAP = 5750;
  let capReached = false;

  return clone(rows).map((row) => {
    if (isPullRow(row) && row.rpm >= RPM_CAP && !capReached) {
      capReached = true;
    }
    if (capReached && row.rpm >= RPM_CAP) {
      // After cap: throttle lifts, RPM drops
      return {
        ...row,
        rpm: Math.max(RPM_CAP - 200, row.rpm - (row.rpm - RPM_CAP)),
        throttle: r(clamp(18 + Math.sin(row.time * 2.1) * 5, 10, 26), 1),
        boostPsi: r(Math.max(0, row.boostPsi * 0.25), 1),
        speedMph: r(RPM_CAP * PULL_CONFIG.gearRatioFactor, 1),
      };
    }
    return row;
  });
}

// ── 6. Low sample rate ───────────────────────────────────────────────────────

/**
 * Scenario: Log recorded at only ~2 Hz (every 5th row of the 10 Hz base).
 * The parser will detect sample rate ≈ 2 Hz and warn / fail.
 */
export function mutateLowSampleRate(rows: MutablePullRow[]): MutablePullRow[] {
  return clone(rows).filter((_, i) => i % 5 === 0);
}

// ── 7. Corrupted timestamps ──────────────────────────────────────────────────

/**
 * Scenario: Timestamps are non-monotonic — simulating a logging glitch
 * where the ECU timer reset mid-log or packets were received out of order.
 * About 15% of rows get a timestamp that jumps backward or repeats.
 */
export function mutateCorruptedTimestamps(rows: MutablePullRow[]): MutablePullRow[] {
  return clone(rows).map((row, i) => {
    // Corrupt every ~7th row in the middle section
    if (i > 20 && i < 90 && i % 7 === 0) {
      // Timestamp goes backward by 1.5–3 seconds
      const corruptedTime = r(Math.max(0, row.time - (1.5 + Math.sin(i) * 0.8)), 1);
      return { ...row, time: corruptedTime };
    }
    return row;
  });
}
