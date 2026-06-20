import type { ColumnMapping, DetectedFormat } from "./normalized-log";

// ─── Outcome ──────────────────────────────────────────────────────────────────

export type ValidationOutcome = "pass" | "fail" | "warn";

export type FailureType =
  | "missing_channels"
  | "wrong_gear"
  | "early_lift"
  | "high_rpm_start"
  | "no_redline"
  | "low_sample_rate"
  | "corrupted_timestamps"
  | "no_pull_detected"
  | "pull_too_short"
  | "start_speed_out_of_range"
  | "start_rpm_out_of_range"
  | "estimated_gear_unstable"
  | "duplicate_timestamps"
  | "missing_values";

// ─── Failure event (used as chart markers) ────────────────────────────────────

/** A discrete failure moment within the log — rendered as a ReferenceLine on charts */
export interface FailureEvent {
  /** Unique identifier for deduplication */
  id: string;
  /** Machine-readable failure category */
  type: FailureType;
  /** Human-readable message shown in the failure marker tooltip */
  message: string;
  /** Time in the log where the failure occurred (seconds from start) */
  timeSec: number;
  /** RPM at the failure point */
  rpm?: number;
  /** Throttle percent at the failure point */
  throttlePct?: number;
  /** How serious this event is */
  severity: "critical" | "high" | "medium" | "low";
}

// ─── Individual check result ──────────────────────────────────────────────────

export interface CheckResult {
  id: string;
  name: string;
  description: string;
  outcome: ValidationOutcome;
  detail?: string;
  value?: number | string;
  threshold?: number | string;
  /** Time of the failure event — drives chart marker placement */
  failureTimestamp?: number;
}

// ─── Pull window ──────────────────────────────────────────────────────────────

export interface PullWindow {
  startIndex: number;
  endIndex: number;
  startTime: number;
  endTime: number;
  duration: number;
  startRpm: number;
  endRpm: number;
  peakRpm: number;
  startSpeed: number;
  endSpeed: number;
  maxBoostPsi?: number;
  minAfr?: number;
  minLambda?: number;
  maxKnockRetard?: number;
}

// ─── Data quality ─────────────────────────────────────────────────────────────

export interface DataQuality {
  totalRows: number;
  pullRows: number;
  sampleRateHz: number;
  duplicateTimestamps: number;
  missingValuesByChannel: Record<string, number>;
  irrelevantDataPct: number;
}

// ─── Extracted metrics (pull-level summary) ───────────────────────────────────

export interface ExtractedMetrics {
  pullDurationSec?: number;
  startRpm?: number;
  endRpm?: number;
  peakRpm?: number;
  startSpeedMph?: number;
  endSpeedMph?: number;
  maxBoostPsi?: number;
  minAfr?: number;
  minLambda?: number;
  maxKnockRetardDeg?: number;
  avgThrottlePct?: number;
  sampleRateHz?: number;
  totalRows?: number;
  pullRows?: number;
  irrelevantDataPct?: number;
}

// ─── Full validation result ───────────────────────────────────────────────────

export interface ValidationResult {
  outcome: ValidationOutcome;
  score: number;
  mainReason?: string;

  templateId: string;
  templateName: string;

  parsedLog: {
    sourceName: string;
    detectedFormat: DetectedFormat;
    totalRows: number;
    columnMappings: ColumnMapping[];
    warnings: string[];
  };

  pullWindow?: PullWindow;
  dataQuality: DataQuality;

  checks: {
    passed: CheckResult[];
    failed: CheckResult[];
    warnings: CheckResult[];
  };

  missingChannels: string[];

  /** Discrete failure events — rendered as chart markers */
  failureEvents: FailureEvent[];

  /** Flat summary of key pull metrics for dashboard cards */
  extractedMetrics: ExtractedMetrics;

  tunerSummary: string;
  customerMessage: string;
}
