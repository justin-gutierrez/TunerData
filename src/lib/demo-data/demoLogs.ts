/**
 * All 10 preconfigured synthetic demo logs.
 *
 * Each entry carries the raw CSV string (pre-generated at module load),
 * plus metadata about what the log represents and what the validator
 * should produce for it.
 */

import { generateGoodPullRows } from "./generateGoodPull";
import {
  toGenericCsv,
  toCobbCsv,
  toMhdCsv,
  mutateMissingAfr,
  mutateWrongGear,
  mutateEarlyLift,
  mutateHighRpmStart,
  mutateNoRedline,
  mutateLowSampleRate,
  mutateCorruptedTimestamps,
} from "./mutateLogs";
import type { FailureType } from "../schema/validation-result";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DemoLogStyle = "generic" | "cobb_like" | "mhd_like";

export type DemoLogExpectedOutcome = "pass" | "fail" | "warn";

export interface DemoLog {
  /** Stable URL-safe identifier used as route param / selection key */
  id: string;

  /** Short human-readable title */
  name: string;

  /** One or two sentences describing what this log tests */
  description: string;

  /** The raw CSV string the parser will receive */
  csvContent: string;

  /** What the validation engine should produce for this log */
  expectedOutcome: DemoLogExpectedOutcome;

  /** The specific failure category, if the log is expected to fail */
  expectedFailureType?: FailureType;

  /**
   * For logs that test early-lift detection, the approximate RPM at which
   * the throttle drop occurs (used on the metrics page).
   */
  earlyLiftRpm?: number;

  /** The CSV column naming convention this log uses */
  style: DemoLogStyle;

  /**
   * Human-readable description of the CSV format — shown in the
   * column mapping table header.
   */
  formatLabel: string;
}

// ─── Pre-generate base data (runs once at module load) ────────────────────────

const baseRows = generateGoodPullRows();

// ─── Demo log definitions ─────────────────────────────────────────────────────

export const demoLogs: DemoLog[] = [
  // ── 1. Good pull ────────────────────────────────────────────────────────────
  {
    id: "good-pull",
    name: "Good 40-roll 4th Gear Pull",
    description:
      "A clean, textbook 40-roll in 4th gear. Pull begins near 40 mph and " +
      "2,050 RPM, throttle stays above 96% throughout, and RPM reaches ~6,700. " +
      "All required channels present. Expected to pass.",
    csvContent: toGenericCsv(baseRows),
    expectedOutcome: "pass",
    style: "generic",
    formatLabel: "Generic CSV",
  },

  // ── 2. Missing AFR / lambda ─────────────────────────────────────────────────
  {
    id: "missing-afr",
    name: "Missing AFR / Lambda Channel",
    description:
      "Identical pull data but the AFR and lambda columns are absent from " +
      "the log file. The 40-roll template requires at least one of these " +
      "channels. Expected to fail with missing_channels.",
    csvContent: toGenericCsv(mutateMissingAfr(baseRows)),
    expectedOutcome: "fail",
    expectedFailureType: "missing_channels",
    style: "generic",
    formatLabel: "Generic CSV",
  },

  // ── 3. Wrong gear ───────────────────────────────────────────────────────────
  {
    id: "wrong-gear",
    name: "Wrong Gear — 3rd Instead of 4th",
    description:
      "Good pull data in every way, but the gear column shows 3 throughout " +
      "the pull. The 40-roll template requires 4th gear. " +
      "Expected to fail with wrong_gear.",
    csvContent: toGenericCsv(mutateWrongGear(baseRows)),
    expectedOutcome: "fail",
    expectedFailureType: "wrong_gear",
    style: "generic",
    formatLabel: "Generic CSV",
  },

  // ── 4. Early throttle lift ──────────────────────────────────────────────────
  {
    id: "early-lift",
    name: "Early Throttle Lift at ~5,180 RPM",
    description:
      "Pull starts correctly but throttle drops from ~98% to ~62% at " +
      "approximately 5,180 RPM, well before the 6,500 RPM target. " +
      "Expected to fail with early_lift. Chart will show a failure marker.",
    csvContent: toGenericCsv(mutateEarlyLift(baseRows)),
    expectedOutcome: "fail",
    expectedFailureType: "early_lift",
    earlyLiftRpm: 5180,
    style: "generic",
    formatLabel: "Generic CSV",
  },

  // ── 5. High RPM start ───────────────────────────────────────────────────────
  {
    id: "high-rpm-start",
    name: "Pull Started Too High — ~2,830 RPM",
    description:
      "The driver began the pull at approximately 2,830 RPM instead of " +
      "the required 2,000 RPM (±400). All other conditions are met. " +
      "Expected to fail with high_rpm_start.",
    csvContent: toGenericCsv(mutateHighRpmStart(baseRows)),
    expectedOutcome: "fail",
    expectedFailureType: "high_rpm_start",
    style: "generic",
    formatLabel: "Generic CSV",
  },

  // ── 6. Did not reach redline ────────────────────────────────────────────────
  {
    id: "no-redline",
    name: "Did Not Reach Redline — Topped at ~5,750 RPM",
    description:
      "Pull is clean but the driver lifted before reaching the 6,500 RPM " +
      "target. Throttle was maintained up to 5,750 RPM, then the driver " +
      "lifted (not classified as early-lift — the stall is near redline). " +
      "Expected to fail with no_redline.",
    csvContent: toGenericCsv(mutateNoRedline(baseRows)),
    expectedOutcome: "fail",
    expectedFailureType: "no_redline",
    style: "generic",
    formatLabel: "Generic CSV",
  },

  // ── 7. Low sample rate ──────────────────────────────────────────────────────
  {
    id: "low-sample-rate",
    name: "Low Sample Rate — ~2 Hz",
    description:
      "Good pull data thinned to approximately 2 Hz (every 5th row of the " +
      "original 10 Hz log). The 40-roll template requires ≥5 Hz. " +
      "Expected to produce a warning with low_sample_rate.",
    csvContent: toGenericCsv(mutateLowSampleRate(baseRows)),
    expectedOutcome: "warn",
    expectedFailureType: "low_sample_rate",
    style: "generic",
    formatLabel: "Generic CSV",
  },

  // ── 8. Corrupted timestamps ─────────────────────────────────────────────────
  {
    id: "corrupted-timestamps",
    name: "Corrupted Timestamps",
    description:
      "The log contains non-monotonic timestamps — roughly every 7th row " +
      "in the middle of the log jumps backward in time, simulating a " +
      "datalogger glitch. Expected to fail with corrupted_timestamps.",
    csvContent: toGenericCsv(mutateCorruptedTimestamps(baseRows)),
    expectedOutcome: "fail",
    expectedFailureType: "corrupted_timestamps",
    style: "generic",
    formatLabel: "Generic CSV",
  },

  // ── 9. COBB-like format ─────────────────────────────────────────────────────
  {
    id: "cobb-good",
    name: "COBB-like Format — Good Pull",
    description:
      "Identical good pull data serialized in COBB Accessport CSV column " +
      "naming convention. No gear column (COBB does not export gear by default). " +
      "Gear will be estimated from speed/RPM ratio. Expected to pass.",
    csvContent: toCobbCsv(baseRows),
    expectedOutcome: "pass",
    style: "cobb_like",
    formatLabel: "COBB Accessport-like CSV",
  },

  // ── 10. MHD/BMW-like format ─────────────────────────────────────────────────
  {
    id: "mhd-good",
    name: "MHD/BMW-like Format — Good Pull",
    description:
      "Identical good pull data serialized in MHD Flasher / BMW-style CSV " +
      "column naming. Uses lambda instead of AFR, pedal instead of throttle, " +
      "and per-cylinder timing correction columns. Expected to pass.",
    csvContent: toMhdCsv(baseRows),
    expectedOutcome: "pass",
    style: "mhd_like",
    formatLabel: "MHD / BMW-like CSV",
  },
];

// ─── Accessors ────────────────────────────────────────────────────────────────

/** Look up a demo log by its id. Returns undefined if not found. */
export function getDemoLog(id: string): DemoLog | undefined {
  return demoLogs.find((log) => log.id === id);
}

/** The default log shown when the demo page first loads */
export const DEFAULT_DEMO_LOG_ID = "good-pull";

/** The default template used on the demo page */
export const DEFAULT_TEMPLATE_ID = "40-roll-4th-2k-redline";
