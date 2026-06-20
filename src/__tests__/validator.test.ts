/**
 * validator.test.ts
 *
 * Tests for the full validation engine (validateLog).
 * Exercises each demo-log scenario and asserts the expected outcome,
 * score range, failure events, and key check results.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { demoLogs } from "@/lib/demo-data/demoLogs";
import { parseLogFromText } from "@/lib/parser/toNormalizedRows";
import { validateLog } from "@/lib/validation/validateLog";
import { FORTY_ROLL_TEMPLATE } from "@/lib/schema/validation-rules";
import type { ValidationResult } from "@/lib/schema/validation-result";

// ─── Helper ───────────────────────────────────────────────────────────────────

function run(id: string): ValidationResult {
  const demo = demoLogs.find((l) => l.id === id);
  if (!demo) throw new Error(`Demo log "${id}" not found in demoLogs`);
  const parsed = parseLogFromText(demo.csvContent, demo.name);
  return validateLog(parsed, FORTY_ROLL_TEMPLATE);
}

// ─── Good log ─────────────────────────────────────────────────────────────────

describe("Good 40-roll 4th-gear pull (generic CSV)", () => {
  let r: ValidationResult;
  beforeAll(() => { r = run("good-pull"); });

  it("produces PASS outcome", () => {
    expect(r.outcome).toBe("pass");
  });

  it("score is ≥ 80 out of 100", () => {
    expect(r.score).toBeGreaterThanOrEqual(80);
  });

  it("has zero failed checks", () => {
    expect(r.checks.failed).toHaveLength(0);
  });

  it("has zero failure events", () => {
    expect(r.failureEvents).toHaveLength(0);
  });

  it("has no missing channel groups", () => {
    expect(r.missingChannels).toHaveLength(0);
  });

  it("detects a pull window", () => {
    expect(r.pullWindow).not.toBeNull();
  });

  it("pull window start RPM is near 2,000", () => {
    expect(r.pullWindow!.startRpm).toBeGreaterThan(1500);
    expect(r.pullWindow!.startRpm).toBeLessThan(2600);
  });

  it("pull window peak RPM reaches near redline (> 6,000)", () => {
    expect(r.pullWindow!.peakRpm).toBeGreaterThan(6000);
  });

  it("extracted metrics include pullDurationSec", () => {
    expect(r.extractedMetrics.pullDurationSec).toBeDefined();
    expect(r.extractedMetrics.pullDurationSec).toBeGreaterThan(0);
  });

  it("tunerSummary is a non-empty string", () => {
    expect(typeof r.tunerSummary).toBe("string");
    expect(r.tunerSummary.length).toBeGreaterThan(0);
  });

  it("customerMessage is a non-empty string", () => {
    expect(typeof r.customerMessage).toBe("string");
    expect(r.customerMessage.length).toBeGreaterThan(0);
  });
});

// ─── Missing AFR / lambda ─────────────────────────────────────────────────────

describe("Missing AFR / lambda channel", () => {
  let r: ValidationResult;
  beforeAll(() => { r = run("missing-afr"); });

  it("produces FAIL outcome", () => {
    expect(r.outcome).toBe("fail");
  });

  it("score is lower than the good log", () => {
    const goodScore = run("good-pull").score;
    expect(r.score).toBeLessThan(goodScore);
  });

  it("reports AFR or lambda group as missing", () => {
    const hasMissing = r.missingChannels.some(
      (c) => c.toLowerCase().includes("afr") || c.toLowerCase().includes("lambda"),
    );
    expect(hasMissing).toBe(true);
  });

  it("has at least one failed required-channel check", () => {
    const hasChannelFail = r.checks.failed.some((c) =>
      c.id.startsWith("required_channel"),
    );
    expect(hasChannelFail).toBe(true);
  });
});

// ─── Wrong gear ───────────────────────────────────────────────────────────────

describe("Wrong gear — 3rd instead of 4th", () => {
  let r: ValidationResult;
  beforeAll(() => { r = run("wrong-gear"); });

  it("produces FAIL outcome", () => {
    expect(r.outcome).toBe("fail");
  });

  it("flags gear check as failed", () => {
    const gearFailed =
      r.checks.failed.some((c) => c.id === "gear_value") ||
      r.failureEvents.some((e) => e.type === "wrong_gear");
    expect(gearFailed).toBe(true);
  });

  it("score is significantly below perfect", () => {
    expect(r.score).toBeLessThan(80);
  });
});

// ─── Early throttle lift ──────────────────────────────────────────────────────

describe("Early throttle lift (~5,180 RPM)", () => {
  let r: ValidationResult;
  beforeAll(() => { r = run("early-lift"); });

  it("produces FAIL outcome", () => {
    expect(r.outcome).toBe("fail");
  });

  it("emits an early_lift failure event", () => {
    const event = r.failureEvents.find((e) => e.type === "early_lift");
    expect(event).toBeDefined();
  });

  it("early_lift event has a positive timestamp", () => {
    const event = r.failureEvents.find((e) => e.type === "early_lift");
    expect(event!.timeSec).toBeGreaterThan(0);
  });

  it("early_lift event RPM is below the 6,500 target but above start (> 4,000)", () => {
    const event = r.failureEvents.find((e) => e.type === "early_lift");
    expect(event!.rpm).toBeGreaterThan(4000);
    expect(event!.rpm).toBeLessThan(6500);
  });

  it("throttle_continuity check appears in failed checks", () => {
    const hasFail = r.checks.failed.some((c) => c.id === "throttle_continuity");
    expect(hasFail).toBe(true);
  });

  it("severity is critical or high", () => {
    const event = r.failureEvents.find((e) => e.type === "early_lift");
    expect(["critical", "high"]).toContain(event!.severity);
  });
});

// ─── Did not reach redline ────────────────────────────────────────────────────

describe("Did not reach redline (topped at ~5,750 RPM)", () => {
  let r: ValidationResult;
  beforeAll(() => { r = run("no-redline"); });

  it("produces FAIL outcome", () => {
    expect(r.outcome).toBe("fail");
  });

  it("fails the target_rpm or no_redline check", () => {
    const hasRedlineFail =
      r.checks.failed.some((c) => c.id === "target_rpm") ||
      r.failureEvents.some((e) => e.type === "no_redline");
    expect(hasRedlineFail).toBe(true);
  });

  it("pull window peak RPM is below the 6,500 target", () => {
    if (r.pullWindow) {
      expect(r.pullWindow.peakRpm).toBeLessThan(6500);
    }
  });
});

// ─── High RPM start ───────────────────────────────────────────────────────────

describe("Pull started too high (~2,830 RPM)", () => {
  let r: ValidationResult;
  beforeAll(() => { r = run("high-rpm-start"); });

  it("produces FAIL outcome", () => {
    expect(r.outcome).toBe("fail");
  });

  it("fails the start_rpm check", () => {
    const hasStartRpmFail =
      r.checks.failed.some((c) => c.id === "start_rpm") ||
      r.failureEvents.some((e) => e.type === "high_rpm_start" || e.type === "start_rpm_out_of_range");
    expect(hasStartRpmFail).toBe(true);
  });
});

// ─── Corrupted timestamps ─────────────────────────────────────────────────────

describe("Corrupted timestamps (non-monotonic)", () => {
  let r: ValidationResult;
  beforeAll(() => { r = run("corrupted-timestamps"); });

  it("produces FAIL outcome", () => {
    expect(r.outcome).toBe("fail");
  });

  it("fails the timestamp_monotonic check", () => {
    const hasTimestampFail = r.checks.failed.some(
      (c) => c.id === "timestamp_monotonic" || c.id.includes("timestamp"),
    );
    expect(hasTimestampFail).toBe(true);
  });

  it("score is notably low (< 75)", () => {
    // timestamp_monotonic deducts 30 pts; score ≈ 67 in the synthetic set
    expect(r.score).toBeLessThan(75);
  });
});

// ─── Low sample rate ──────────────────────────────────────────────────────────

describe("Low sample rate (~2 Hz, template requires ≥ 5 Hz)", () => {
  let r: ValidationResult;
  beforeAll(() => { r = run("low-sample-rate"); });

  it("does NOT produce a PASS outcome", () => {
    expect(r.outcome).not.toBe("pass");
  });

  it("flags the sample_rate check as failed or warned", () => {
    const hasIssue =
      r.checks.failed.some((c) => c.id === "sample_rate") ||
      r.checks.warnings.some((c) => c.id === "sample_rate");
    expect(hasIssue).toBe(true);
  });

  it("has lower score than the good log", () => {
    const goodScore = run("good-pull").score;
    expect(r.score).toBeLessThan(goodScore);
  });
});

// ─── Good COBB pull ───────────────────────────────────────────────────────────

describe("Good 40-roll pull — COBB Accessport-like format", () => {
  let r: ValidationResult;
  beforeAll(() => { r = run("cobb-good"); });

  it("produces PASS outcome", () => {
    expect(r.outcome).toBe("pass");
  });

  it("score is ≥ 80", () => {
    expect(r.score).toBeGreaterThanOrEqual(80);
  });

  it("has no failed checks", () => {
    expect(r.checks.failed).toHaveLength(0);
  });

  it("detects a pull window", () => {
    expect(r.pullWindow).not.toBeNull();
  });
});

// ─── Good MHD pull ────────────────────────────────────────────────────────────

describe("Good 40-roll pull — MHD / BMW-like format", () => {
  let r: ValidationResult;
  beforeAll(() => { r = run("mhd-good"); });

  it("produces PASS outcome", () => {
    expect(r.outcome).toBe("pass");
  });

  it("score is ≥ 80", () => {
    expect(r.score).toBeGreaterThanOrEqual(80);
  });

  it("has no failed checks", () => {
    expect(r.checks.failed).toHaveLength(0);
  });

  it("correctly handles lambda column in place of AFR", () => {
    expect(r.missingChannels).toHaveLength(0);
  });

  it("correctly handles acceleratorPct in place of throttlePct", () => {
    // MHD uses 'pedal' → acceleratorPct; validation should accept this
    const throttleFail = r.checks.failed.some(
      (c) => c.id === "required_channel_throttlePct",
    );
    expect(throttleFail).toBe(false);
  });
});

// ─── Score comparisons ────────────────────────────────────────────────────────

describe("Score ordering", () => {
  it("good pull scores higher than all failing logs", () => {
    const goodScore = run("good-pull").score;
    const failingIds = [
      "missing-afr",
      "wrong-gear",
      "early-lift",
      "no-redline",
      "high-rpm-start",
      "corrupted-timestamps",
    ];
    for (const id of failingIds) {
      const failScore = run(id).score;
      expect(failScore).toBeLessThan(goodScore);
    }
  });

  it("COBB good pull and MHD good pull score within 10 points of generic good pull", () => {
    const genericScore = run("good-pull").score;
    const cobbScore = run("cobb-good").score;
    const mhdScore = run("mhd-good").score;
    expect(Math.abs(genericScore - cobbScore)).toBeLessThanOrEqual(10);
    expect(Math.abs(genericScore - mhdScore)).toBeLessThanOrEqual(10);
  });
});
