/**
 * simulation.test.ts
 *
 * End-to-end simulation tests that run the full evaluateDemoSet() harness
 * and assert high-level accuracy guarantees.
 *
 * These tests are the closest thing to integration / acceptance tests:
 *   • All 10 demo logs are parsed and validated
 *   • Expected outcomes must match actual outcomes
 *   • Score stability is verified across repeated runs
 *   • Detection and false-rejection rates are checked
 */

import { describe, it, expect, beforeAll } from "vitest";
import { demoLogs } from "@/lib/demo-data/demoLogs";
import { parseLogFromText } from "@/lib/parser/toNormalizedRows";
import { validateLog } from "@/lib/validation/validateLog";
import { FORTY_ROLL_TEMPLATE } from "@/lib/schema/validation-rules";
import { evaluateDemoSet, type DemoSetMetrics } from "@/lib/metrics/evaluateDemoSet";

// ─── Aggregate metrics ────────────────────────────────────────────────────────

describe("Full demo set evaluation — aggregate statistics", () => {
  let m: DemoSetMetrics;
  beforeAll(() => { m = evaluateDemoSet(); });

  it("evaluates exactly 10 demo logs", () => {
    expect(m.totalLogs).toBe(10);
  });

  it("3 logs pass, 1 warns, 6 fail (engine outcomes)", () => {
    expect(m.passCount).toBe(3);
    expect(m.warnCount).toBe(1);
    expect(m.failCount).toBe(6);
  });

  it("bad-log detection rate is 100%", () => {
    // Every log with expectedOutcome !== 'pass' must be flagged (warn or fail)
    expect(m.badLogDetectionRate).toBe(1);
  });

  it("false rejection rate is 0%", () => {
    // No log with expectedOutcome === 'pass' is incorrectly flagged
    expect(m.falseRejectionRate).toBe(0);
  });

  it("all 10 cases match their expected outcome exactly", () => {
    const incorrect = m.cases.filter((c) => !c.correct);
    const details = incorrect
      .map((c) => `${c.id}: expected="${c.expectedOutcome}" got="${c.actualOutcome}"`)
      .join(", ");
    expect(incorrect, `Mismatches: ${details}`).toHaveLength(0);
  });

  it("average pull-window IoU is defined and > 0", () => {
    expect(m.avgIoU).toBeDefined();
    expect(m.avgIoU!).toBeGreaterThan(0);
  });

  it("average pull-window IoU is ≤ 1.0", () => {
    expect(m.avgIoU!).toBeLessThanOrEqual(1);
  });

  it("average irrelevant data percentage is defined and in [0, 100]", () => {
    expect(m.avgIrrelevantDataPct).toBeGreaterThanOrEqual(0);
    expect(m.avgIrrelevantDataPct).toBeLessThanOrEqual(100);
  });

  it("failure type counts sum equals number of failing/warning cases", () => {
    const total = Object.values(m.failureTypeCounts).reduce((a, b) => a + b, 0);
    const nonPassCount = m.cases.filter(
      (c) => c.actualOutcome !== "pass",
    ).length;
    // Not every non-pass case necessarily has a failure event,
    // but total should be ≤ nonPassCount
    expect(total).toBeLessThanOrEqual(nonPassCount);
    expect(total).toBeGreaterThan(0);
  });
});

// ─── Per-case expected outcomes ───────────────────────────────────────────────

describe("Per-demo-log expected vs actual outcomes", () => {
  let m: DemoSetMetrics;
  beforeAll(() => { m = evaluateDemoSet(); });

  // Dynamically generate one test per demo log
  for (const demo of demoLogs) {
    it(`${demo.id} → "${demo.expectedOutcome}"`, () => {
      const c = m.cases.find((x) => x.id === demo.id);
      expect(c, `Case "${demo.id}" missing from evaluateDemoSet output`).toBeDefined();
      expect(c!.actualOutcome).toBe(demo.expectedOutcome);
    });
  }
});

// ─── Score ordering guarantees ────────────────────────────────────────────────

describe("Score ordering guarantees", () => {
  let m: DemoSetMetrics;
  beforeAll(() => { m = evaluateDemoSet(); });

  it("good-pull score is ≥ 80", () => {
    const c = m.cases.find((x) => x.id === "good-pull");
    expect(c!.score).toBeGreaterThanOrEqual(80);
  });

  it("cobb-good score is ≥ 80", () => {
    const c = m.cases.find((x) => x.id === "cobb-good");
    expect(c!.score).toBeGreaterThanOrEqual(80);
  });

  it("mhd-good score is ≥ 80", () => {
    const c = m.cases.find((x) => x.id === "mhd-good");
    expect(c!.score).toBeGreaterThanOrEqual(80);
  });

  it("good-pull scores higher than every failing log", () => {
    const goodScore = m.cases.find((x) => x.id === "good-pull")!.score;
    const failingCases = m.cases.filter((c) => c.expectedOutcome === "fail");
    for (const c of failingCases) {
      expect(c.score, `${c.id} should score below good-pull`).toBeLessThan(goodScore);
    }
  });

  it("corrupted-timestamps score is < 75 (timestamp corruption is heavily penalised)", () => {
    // timestamp_monotonic deducts 30 pts; actual score ≈ 67 in the synthetic set
    const c = m.cases.find((x) => x.id === "corrupted-timestamps");
    expect(c!.score).toBeLessThan(75);
  });
});

// ─── Score stability ──────────────────────────────────────────────────────────

describe("Score stability — deterministic output", () => {
  const IDS_TO_CHECK = [
    "good-pull",
    "early-lift",
    "missing-afr",
    "cobb-good",
    "mhd-good",
  ];

  for (const id of IDS_TO_CHECK) {
    it(`${id}: score and outcome are identical across two independent runs`, () => {
      const demo = demoLogs.find((l) => l.id === id)!;
      const parsed = parseLogFromText(demo.csvContent, demo.name);

      const r1 = validateLog(parsed, FORTY_ROLL_TEMPLATE);
      const r2 = validateLog(parsed, FORTY_ROLL_TEMPLATE);

      expect(r1.score).toBe(r2.score);
      expect(r1.outcome).toBe(r2.outcome);
      expect(r1.failureEvents.length).toBe(r2.failureEvents.length);
      expect(r1.checks.failed.length).toBe(r2.checks.failed.length);
    });
  }
});

// ─── Failure event presence ───────────────────────────────────────────────────

describe("Failure event types match expected failure types", () => {
  /**
   * Failure events are emitted by: validateThrottle, validateGear,
   * validateEndConditions, and the timestamp corruption path.
   *
   * validateStartConditions produces failed *checks* (id: "start_rpm"),
   * not failure events — so high-rpm-start is verified via checks.failed.
   */
  const FAILURE_EVENT_CASES: Array<{ id: string; eventType: string }> = [
    { id: "early-lift", eventType: "early_lift" },
    { id: "wrong-gear", eventType: "wrong_gear" },
    { id: "no-redline", eventType: "no_redline" },
  ];

  const FAILED_CHECK_CASES: Array<{ id: string; checkId: string }> = [
    { id: "high-rpm-start", checkId: "start_rpm" },
  ];

  for (const { id, eventType } of FAILURE_EVENT_CASES) {
    it(`${id}: emits a failure event of type "${eventType}"`, () => {
      const demo = demoLogs.find((l) => l.id === id)!;
      const parsed = parseLogFromText(demo.csvContent, demo.name);
      const result = validateLog(parsed, FORTY_ROLL_TEMPLATE);
      expect(result.failureEvents.some((e) => e.type === eventType)).toBe(true);
    });
  }

  for (const { id, checkId } of FAILED_CHECK_CASES) {
    it(`${id}: has a failed check with id "${checkId}"`, () => {
      const demo = demoLogs.find((l) => l.id === id)!;
      const parsed = parseLogFromText(demo.csvContent, demo.name);
      const result = validateLog(parsed, FORTY_ROLL_TEMPLATE);
      expect(result.checks.failed.some((c) => c.id === checkId)).toBe(true);
    });
  }
});

// ─── Required channel detection ───────────────────────────────────────────────

describe("Required channel detection", () => {
  it("missing-afr: AFR and lambda groups are absent from the parsed log", () => {
    const demo = demoLogs.find((l) => l.id === "missing-afr")!;
    const parsed = parseLogFromText(demo.csvContent, demo.name);
    const hasAfr = parsed.rows.some((r) => r.afr !== undefined);
    const hasLambda = parsed.rows.some((r) => r.lambda !== undefined);
    expect(hasAfr || hasLambda).toBe(false);
  });

  it("good-pull: all required channel groups are mapped", () => {
    const demo = demoLogs.find((l) => l.id === "good-pull")!;
    const parsed = parseLogFromText(demo.csvContent, demo.name);
    const result = validateLog(parsed, FORTY_ROLL_TEMPLATE);
    expect(result.missingChannels).toHaveLength(0);
  });

  it("mhd-good: acceleratorPct satisfies the throttle group requirement", () => {
    const demo = demoLogs.find((l) => l.id === "mhd-good")!;
    const parsed = parseLogFromText(demo.csvContent, demo.name);
    const result = validateLog(parsed, FORTY_ROLL_TEMPLATE);
    // The throttlePct group includes acceleratorPct — no channel should be missing
    expect(result.missingChannels).toHaveLength(0);
  });
});
