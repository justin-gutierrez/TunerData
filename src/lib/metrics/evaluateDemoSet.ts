/**
 * Synthetic evaluation harness.
 *
 * Runs every demo log through the full parse → validate pipeline and
 * compares the result to the demo log's declared expectedOutcome.
 *
 * All computation is pure JS/TS — no I/O — so this can be called from a
 * Next.js server component or an API route without side effects.
 *
 * Outputs:
 *   DemoSetMetrics  — aggregate statistics + per-case breakdown
 */

import type { ValidationOutcome, FailureType } from "../schema/validation-result";
import type { DemoLogExpectedOutcome, DemoLogStyle } from "../demo-data/demoLogs";
import { demoLogs } from "../demo-data/demoLogs";
import { FORTY_ROLL_TEMPLATE } from "../schema/validation-rules";
import { parseLogFromText } from "../parser/toNormalizedRows";
import { validateLog } from "../validation/validateLog";
import {
  calculatePullWindowIoU,
  deriveWotReference,
} from "./calculatePullWindowIoU";

// ─── Per-case output ──────────────────────────────────────────────────────────

export interface DemoEvalCase {
  /** Stable id from the DemoLog definition */
  id: string;
  /** Human-readable log name */
  name: string;
  /** Short description */
  description: string;
  /** CSV column convention used */
  style: DemoLogStyle;
  /** What the engine should produce */
  expectedOutcome: DemoLogExpectedOutcome;
  /** What the engine actually produced */
  actualOutcome: ValidationOutcome;
  /** Does actualOutcome === expectedOutcome? */
  correct: boolean;
  /** Validation score out of 100 */
  score: number;
  /**
   * Intersection-over-Union between detected pull window and the derived
   * WOT reference window.  Undefined when no pull window was detected or
   * no WOT reference could be derived.
   */
  iou?: number;
  /** Percentage of total rows that fall outside the pull window */
  irrelevantDataPct: number;
  /** Primary failure type reported by the engine (first failure event) */
  mainFailureType?: FailureType;
  /** Plain-English reason from mainReason field */
  mainReason?: string;
}

// ─── Aggregate output ─────────────────────────────────────────────────────────

export interface DemoSetMetrics {
  /** Total demo logs evaluated */
  totalLogs: number;
  /** Logs where actualOutcome === "pass" */
  passCount: number;
  /** Logs where actualOutcome === "warn" */
  warnCount: number;
  /** Logs where actualOutcome === "fail" */
  failCount: number;

  /**
   * (non-passing logs where actualOutcome !== "pass") / (total non-passing expected)
   *
   * Measures: when a bad log is submitted, does the engine catch it?
   * A value of 1.0 means every bad log was flagged (either warn or fail).
   */
  badLogDetectionRate: number;

  /**
   * (expected-pass logs where actualOutcome !== "pass") / (total expected-pass logs)
   *
   * Measures: does the engine falsely reject good logs?
   * A value of 0.0 means no good log was ever incorrectly rejected.
   */
  falseRejectionRate: number;

  /**
   * Average pull-window IoU across all cases where both detected and
   * reference pull windows could be computed.
   */
  avgIoU?: number;

  /** Average percentage of total rows that fall outside the pull window */
  avgIrrelevantDataPct: number;

  /** Count of each failure type seen across all cases */
  failureTypeCounts: Record<string, number>;

  /**
   * The failure type that appeared most often.
   * "—" when all failure types are tied (synthetic set).
   */
  mostCommonFailureType: string;

  /** Per-log breakdown, same order as demoLogs */
  cases: DemoEvalCase[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FAILURE_TYPE_LABELS: Record<FailureType | string, string> = {
  missing_channels: "Missing required channels",
  wrong_gear: "Wrong gear detected",
  early_lift: "Early throttle lift",
  high_rpm_start: "RPM start out of range",
  no_redline: "Did not reach target RPM",
  low_sample_rate: "Low sample rate",
  corrupted_timestamps: "Corrupted timestamps",
  no_pull_detected: "No pull window detected",
  pull_too_short: "Pull window too short",
  start_speed_out_of_range: "Start speed out of range",
  start_rpm_out_of_range: "Start RPM out of range",
  estimated_gear_unstable: "Estimated gear unstable",
  duplicate_timestamps: "Duplicate timestamps",
  missing_values: "Missing values during pull",
};

export function formatFailureType(type: FailureType | string): string {
  return FAILURE_TYPE_LABELS[type] ?? type;
}

// ─── Main evaluator ───────────────────────────────────────────────────────────

/**
 * Run all demo logs through the parse → validate pipeline and return
 * aggregate statistics plus per-case details.
 *
 * This is intentionally synchronous so it can be called in a Next.js
 * server component without any async boilerplate.
 */
export function evaluateDemoSet(): DemoSetMetrics {
  const cases: DemoEvalCase[] = demoLogs.map((log) => {
    // ── Parse ──────────────────────────────────────────────────────────────
    const parsed = parseLogFromText(log.csvContent, log.name);

    // ── Validate ───────────────────────────────────────────────────────────
    const result = validateLog(parsed, FORTY_ROLL_TEMPLATE);

    // ── Derive WOT reference window from raw rows ──────────────────────────
    const wotRef = deriveWotReference(parsed.rows);

    // ── Compute IoU if both windows are available ──────────────────────────
    let iou: number | undefined;
    if (result.pullWindow && wotRef) {
      iou = calculatePullWindowIoU(
        { startSec: result.pullWindow.startTime, endSec: result.pullWindow.endTime },
        wotRef,
      );
      // Round to 2 decimal places for display
      iou = Math.round(iou * 100) / 100;
    }

    // ── Primary failure type from the first failure event ──────────────────
    const mainFailureType =
      result.failureEvents.length > 0
        ? result.failureEvents[0].type
        : // Fall back to first failed check's id (mapped to FailureType if possible)
          (result.checks.failed[0]?.id as FailureType | undefined);

    const correct = result.outcome === log.expectedOutcome;

    return {
      id: log.id,
      name: log.name,
      description: log.description,
      style: log.style,
      expectedOutcome: log.expectedOutcome,
      actualOutcome: result.outcome,
      correct,
      score: result.score,
      iou,
      irrelevantDataPct: result.dataQuality.irrelevantDataPct,
      mainFailureType,
      mainReason: result.mainReason,
    };
  });

  // ── Aggregate ─────────────────────────────────────────────────────────────

  const passCount = cases.filter((c) => c.actualOutcome === "pass").length;
  const warnCount = cases.filter((c) => c.actualOutcome === "warn").length;
  const failCount = cases.filter((c) => c.actualOutcome === "fail").length;

  // Bad-log detection: non-passing logs that the engine flagged (outcome !== pass)
  const expectedNonPass = cases.filter((c) => c.expectedOutcome !== "pass");
  const detectedBad = expectedNonPass.filter((c) => c.actualOutcome !== "pass");
  const badLogDetectionRate =
    expectedNonPass.length > 0 ? detectedBad.length / expectedNonPass.length : 1;

  // False rejection: expected-pass logs the engine flagged as warn/fail
  const expectedPass = cases.filter((c) => c.expectedOutcome === "pass");
  const falselyRejected = expectedPass.filter((c) => c.actualOutcome !== "pass");
  const falseRejectionRate =
    expectedPass.length > 0 ? falselyRejected.length / expectedPass.length : 0;

  // Average IoU (only cases where both windows exist)
  const iouValues = cases
    .filter((c) => c.iou !== undefined)
    .map((c) => c.iou as number);
  const avgIoU =
    iouValues.length > 0
      ? Math.round((iouValues.reduce((a, b) => a + b, 0) / iouValues.length) * 100) / 100
      : undefined;

  // Average irrelevant data
  const avgIrrelevantDataPct =
    Math.round(
      (cases.reduce((acc, c) => acc + c.irrelevantDataPct, 0) / cases.length) * 10,
    ) / 10;

  // Failure type histogram
  const failureTypeCounts: Record<string, number> = {};
  for (const c of cases) {
    if (c.mainFailureType) {
      const label = formatFailureType(c.mainFailureType);
      failureTypeCounts[label] = (failureTypeCounts[label] ?? 0) + 1;
    }
  }

  // Most common failure type
  const sorted = Object.entries(failureTypeCounts).sort(([, a], [, b]) => b - a);
  const maxCount = sorted[0]?.[1] ?? 0;
  const topTypes = sorted.filter(([, n]) => n === maxCount).map(([t]) => t);
  const mostCommonFailureType =
    topTypes.length === 1 ? topTypes[0] : "All failure types unique in this set";

  return {
    totalLogs: cases.length,
    passCount,
    warnCount,
    failCount,
    badLogDetectionRate,
    falseRejectionRate,
    avgIoU,
    avgIrrelevantDataPct,
    failureTypeCounts,
    mostCommonFailureType,
    cases,
  };
}
