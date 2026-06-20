/**
 * Analyses the CSV header columns and returns the best-guess source format.
 * This drives confidence weighting in the column mapper and is shown in the UI.
 */

import type { DetectedFormat } from "../schema/normalized-log";

// ─── Format signatures ────────────────────────────────────────────────────────

interface FormatSignature {
  format: DetectedFormat;
  /** Each entry is a regex; counts toward the format score if any header matches */
  indicators: RegExp[];
  /** Minimum indicator hits required for this format to be considered */
  minHits: number;
}

const FORMAT_SIGNATURES: FormatSignature[] = [
  {
    format: "cobb_like",
    indicators: [
      /vehicle speed \(mph\)/i,
      /throttle pos \(%\)/i,
      /feedback knock/i,
      /ign timing \(deg\)/i,
      /coolant temp \(°f\)/i,
      /iat \(°f\)/i,
      /boost \(psi\)/i,
    ],
    minHits: 2,
  },
  {
    format: "mhd_like",
    indicators: [
      /lambda bank/i,
      /timing correction cyl/i,
      /boost actual/i,
      /timing cyl\s*\d/i,
      /\bpedal\b/i,
    ],
    minHits: 2,
  },
  {
    format: "hptuners_like",
    indicators: [
      /engine speed \(rpm\)/i,
      /manifold absolute pressure/i,
      /engine coolant temp/i,
      /mass airflow/i,
      /spark advance/i,
    ],
    minHits: 2,
  },
  {
    format: "ecutek_like",
    indicators: [
      /engine speed \[rpm\]/i,
      /accel pedal position/i,
      /actual lambda/i,
      /ignition advance/i,
      /boost pressure/i,
    ],
    minHits: 2,
  },
  {
    format: "generic",
    indicators: [
      /^speed_mph$/i,
      /^boost_psi$/i,
      /^iat_f$/i,
      /^coolant_f$/i,
      /^ignition_timing$/i,
      /^knock_retard$/i,
      /^throttle$/i,
    ],
    minHits: 2,
  },
];

// ─── Detection function ───────────────────────────────────────────────────────

/**
 * Returns the most likely source format given the CSV's header columns.
 * Falls back to "unknown" if no format reaches its minHits threshold.
 */
export function detectFormat(headers: string[]): DetectedFormat {
  let bestFormat: DetectedFormat = "unknown";
  let bestScore = 0;

  for (const sig of FORMAT_SIGNATURES) {
    const score = sig.indicators.filter((pattern) =>
      headers.some((h) => pattern.test(h))
    ).length;

    if (score >= sig.minHits && score > bestScore) {
      bestScore = score;
      bestFormat = sig.format;
    }
  }

  return bestFormat;
}

/** Human-readable label for each detected format (shown in the UI) */
export const FORMAT_LABELS: Record<DetectedFormat, string> = {
  generic: "Generic CSV",
  cobb_like: "COBB Accessport-like",
  hptuners_like: "HP Tuners-like",
  ecutek_like: "ECUTek-like",
  mhd_like: "MHD / BMW-like",
  unknown: "Unknown format",
};
