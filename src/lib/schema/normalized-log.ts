/**
 * Core unified telemetry schema.
 * All CSV formats are mapped into this shape by the parser pipeline.
 */

export type NormalizedLogRow = {
  /** Time offset from log start in seconds */
  timeSec: number;

  /** Engine speed in RPM */
  rpm?: number;

  /** Vehicle speed in miles per hour */
  speedMph?: number;

  /** Transmission gear (1–8) */
  gear?: number;

  /** Throttle position as percentage (0–100) */
  throttlePct?: number;

  /** Accelerator pedal position as percentage (0–100) — alternative to throttlePct */
  acceleratorPct?: number;

  /** Air-fuel ratio (Lambda × 14.7) */
  afr?: number;

  /** Lambda (AFR / 14.7) */
  lambda?: number;

  /** Manifold boost pressure in PSI (above atmospheric) */
  boostPsi?: number;

  /** Manifold absolute pressure in kPa */
  mapKpa?: number;

  /** Global ignition timing in degrees before TDC */
  ignitionTimingDeg?: number;

  /** Global knock retard in degrees (positive = retard) */
  knockRetardDeg?: number;

  /** Per-cylinder timing corrections in degrees */
  timingCorrectionCylinders?: {
    cyl1?: number;
    cyl2?: number;
    cyl3?: number;
    cyl4?: number;
    cyl5?: number;
    cyl6?: number;
    cyl7?: number;
    cyl8?: number;
  };

  /** Intake air temperature in Fahrenheit */
  iatF?: number;

  /** Engine coolant temperature in Fahrenheit */
  coolantTempF?: number;

  /** Fuel rail pressure in PSI */
  fuelPressurePsi?: number;

  /** Index of the original row in the source CSV (0-based) */
  sourceRowIndex: number;
};

// ─── Column mapping ───────────────────────────────────────────────────────────

/** Result of mapping a raw CSV column to a unified schema field */
export type ColumnMapping = {
  /** The exact column header string found in the source CSV */
  rawColumn: string;

  /** The NormalizedLogRow field it was mapped to, or null if unmapped */
  normalizedField: string | null;

  /** The unit detected or assumed for this column */
  detectedUnit?: string;

  /** 0–1 confidence score for this mapping */
  confidence: number;

  /** Mapping quality */
  status: "mapped" | "unmapped" | "warning";
};

// ─── Parsed log ───────────────────────────────────────────────────────────────

export type DetectedFormat =
  | "generic"
  | "cobb_like"
  | "hptuners_like"
  | "ecutek_like"
  | "mhd_like"
  | "unknown";

/** The output of the full parse pipeline (before validation) */
export type ParsedLog = {
  /** Display name for the source (filename or demo log name) */
  sourceName: string;

  /** Best-guess CSV style detected from header analysis */
  detectedFormat: DetectedFormat;

  /** All normalized rows from the CSV */
  rows: NormalizedLogRow[];

  /** Column-by-column mapping report */
  columnMappings: ColumnMapping[];

  /** Non-fatal parse warnings (e.g. skipped rows, low-confidence mappings) */
  warnings: string[];
};
