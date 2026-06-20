/**
 * pull-window.test.ts
 *
 * Unit tests for detectPullWindow() in isolation.
 * Also exercises calculatePullWindowIoU() and deriveWotReference().
 */

import { describe, it, expect, beforeAll } from "vitest";
import { demoLogs } from "@/lib/demo-data/demoLogs";
import { parseLogFromText } from "@/lib/parser/toNormalizedRows";
import { detectPullWindow } from "@/lib/validation/detectPullWindow";
import {
  calculatePullWindowIoU,
  deriveWotReference,
} from "@/lib/metrics/calculatePullWindowIoU";
import { FORTY_ROLL_TEMPLATE } from "@/lib/schema/validation-rules";
import type { PullWindow } from "@/lib/schema/validation-result";
import type { NormalizedLogRow } from "@/lib/schema/normalized-log";

// ─── Helper ───────────────────────────────────────────────────────────────────

function getPullWindow(id: string): PullWindow | null {
  const demo = demoLogs.find((l) => l.id === id);
  if (!demo) throw new Error(`Demo log "${id}" not found`);
  const parsed = parseLogFromText(demo.csvContent, demo.name);
  return detectPullWindow(parsed.rows, FORTY_ROLL_TEMPLATE).pullWindow;
}

function getRows(id: string): NormalizedLogRow[] {
  const demo = demoLogs.find((l) => l.id === id);
  if (!demo) throw new Error(`Demo log "${id}" not found`);
  return parseLogFromText(demo.csvContent, demo.name).rows;
}

// ─── Good pull window ─────────────────────────────────────────────────────────

describe("Good pull — pull window detection", () => {
  let pw: PullWindow;

  beforeAll(() => {
    const result = getPullWindow("good-pull");
    if (!result) throw new Error("Expected pull window to be detected for good-pull");
    pw = result;
  });

  it("returns a non-null pull window", () => {
    expect(pw).not.toBeNull();
  });

  it("startTime < endTime", () => {
    expect(pw.startTime).toBeLessThan(pw.endTime);
  });

  it("startIndex < endIndex", () => {
    expect(pw.startIndex).toBeLessThan(pw.endIndex);
  });

  it("duration matches endTime - startTime", () => {
    expect(pw.duration).toBeCloseTo(pw.endTime - pw.startTime, 3);
  });

  it("duration is at least 5 seconds (template minimum)", () => {
    const minDur = FORTY_ROLL_TEMPLATE.wot?.minPullDurationSec ?? 5.0;
    expect(pw.duration).toBeGreaterThanOrEqual(minDur);
  });

  it("start RPM is near 2,000 (within ±600)", () => {
    expect(pw.startRpm).toBeGreaterThan(1400);
    expect(pw.startRpm).toBeLessThan(2600);
  });

  it("peak RPM is at or beyond 6,000 (approaching redline)", () => {
    expect(pw.peakRpm).toBeGreaterThan(6000);
  });

  it("end RPM is close to peak RPM (pull reached redline)", () => {
    // endRpm = RPM at the last WOT row; peak might be the same or nearby
    expect(pw.endRpm).toBeGreaterThan(5500);
  });

  it("start speed is near 40 mph (template: 40 ± 7 mph)", () => {
    expect(pw.startSpeed).toBeGreaterThan(33);
    expect(pw.startSpeed).toBeLessThan(50);
  });

  it("peakRpm ≥ startRpm (RPM is rising through the pull)", () => {
    expect(pw.peakRpm).toBeGreaterThan(pw.startRpm);
  });
});

// ─── Early lift window ────────────────────────────────────────────────────────

describe("Early-lift pull — pull window detection", () => {
  let pw: PullWindow | null;
  beforeAll(() => { pw = getPullWindow("early-lift"); });

  it("still detects a pull window (initial WOT phase exists)", () => {
    // The early-lift log starts WOT correctly; the lift truncates the window
    expect(pw).not.toBeNull();
  });

  it("peak RPM is below the 6,500 target (lift prevented reaching redline)", () => {
    expect(pw!.peakRpm).toBeLessThan(6500);
  });

  it("start RPM is still near 2,000", () => {
    expect(pw!.startRpm).toBeGreaterThan(1400);
    expect(pw!.startRpm).toBeLessThan(2600);
  });
});

// ─── No-redline window ────────────────────────────────────────────────────────

describe("No-redline pull — pull window detection", () => {
  let pw: PullWindow | null;
  beforeAll(() => { pw = getPullWindow("no-redline"); });

  it("detects a pull window", () => {
    expect(pw).not.toBeNull();
  });

  it("peak RPM is below the 6,500 template target", () => {
    expect(pw!.peakRpm).toBeLessThan(6500);
  });
});

// ─── High-RPM-start window ────────────────────────────────────────────────────

describe("High-RPM-start pull — pull window detection", () => {
  let goodPw: PullWindow | null;
  let highPw: PullWindow | null;

  beforeAll(() => {
    goodPw = getPullWindow("good-pull");
    highPw = getPullWindow("high-rpm-start");
  });

  it("detects a pull window", () => {
    expect(highPw).not.toBeNull();
  });

  it("start RPM is higher than the good pull start RPM", () => {
    // The high-RPM-start log begins at ~2,830 RPM vs ~2,000 RPM
    expect(highPw!.startRpm).toBeGreaterThan(goodPw!.startRpm + 200);
  });
});

// ─── Format equivalence ───────────────────────────────────────────────────────

describe("Pull window equivalence across CSV formats", () => {
  it("COBB good pull and generic good pull have similar start RPM (within 200)", () => {
    const genericPw = getPullWindow("good-pull");
    const cobbPw = getPullWindow("cobb-good");
    expect(genericPw).not.toBeNull();
    expect(cobbPw).not.toBeNull();
    expect(Math.abs(genericPw!.startRpm - cobbPw!.startRpm)).toBeLessThan(200);
  });

  it("MHD good pull and generic good pull have similar peak RPM (within 200)", () => {
    const genericPw = getPullWindow("good-pull");
    const mhdPw = getPullWindow("mhd-good");
    expect(genericPw).not.toBeNull();
    expect(mhdPw).not.toBeNull();
    expect(Math.abs(genericPw!.peakRpm - mhdPw!.peakRpm)).toBeLessThan(200);
  });
});

// ─── calculatePullWindowIoU ───────────────────────────────────────────────────

describe("calculatePullWindowIoU()", () => {
  it("returns 1.0 for perfectly matching intervals", () => {
    const iou = calculatePullWindowIoU(
      { startSec: 5, endSec: 20 },
      { startSec: 5, endSec: 20 },
    );
    expect(iou).toBeCloseTo(1.0, 5);
  });

  it("returns 0 for non-overlapping intervals", () => {
    const iou = calculatePullWindowIoU(
      { startSec: 0, endSec: 5 },
      { startSec: 10, endSec: 20 },
    );
    expect(iou).toBe(0);
  });

  it("returns value in (0, 1) for partial overlap", () => {
    const iou = calculatePullWindowIoU(
      { startSec: 0, endSec: 10 },
      { startSec: 5, endSec: 15 },
    );
    // intersection = [5,10] = 5s, union = [0,15] = 15s → IoU = 5/15 ≈ 0.333
    expect(iou).toBeGreaterThan(0);
    expect(iou).toBeLessThan(1);
    expect(iou).toBeCloseTo(5 / 15, 3);
  });

  it("returns 0 for zero-length detected interval", () => {
    const iou = calculatePullWindowIoU(
      { startSec: 5, endSec: 5 },
      { startSec: 0, endSec: 20 },
    );
    expect(iou).toBe(0);
  });

  it("returns 0 for zero-length reference interval", () => {
    const iou = calculatePullWindowIoU(
      { startSec: 0, endSec: 20 },
      { startSec: 10, endSec: 10 },
    );
    expect(iou).toBe(0);
  });

  it("never returns a value > 1 (numerical safety)", () => {
    const iou = calculatePullWindowIoU(
      { startSec: 0, endSec: 100 },
      { startSec: 0, endSec: 100 },
    );
    expect(iou).toBeLessThanOrEqual(1);
  });
});

// ─── deriveWotReference ───────────────────────────────────────────────────────

describe("deriveWotReference()", () => {
  it("returns null for rows all below the throttle threshold", () => {
    const rows = [
      { timeSec: 0, throttlePct: 20 },
      { timeSec: 1, throttlePct: 30 },
      { timeSec: 2, throttlePct: 50 },
    ];
    expect(deriveWotReference(rows)).toBeNull();
  });

  it("returns the first/last WOT row times when threshold is exceeded", () => {
    const rows = [
      { timeSec: 0, throttlePct: 20 },
      { timeSec: 1, throttlePct: 90 },  // WOT start
      { timeSec: 2, throttlePct: 95 },
      { timeSec: 3, throttlePct: 98 },
      { timeSec: 4, throttlePct: 97 },  // WOT end
      { timeSec: 5, throttlePct: 30 },
    ];
    const ref = deriveWotReference(rows, 88);
    expect(ref).not.toBeNull();
    expect(ref!.startSec).toBeCloseTo(1, 5);
    expect(ref!.endSec).toBeCloseTo(4, 5);
  });

  it("returns null when fewer than minRows qualifying rows exist", () => {
    const rows = [
      { timeSec: 0, throttlePct: 90 },  // only 1 WOT row
      { timeSec: 1, throttlePct: 30 },
    ];
    expect(deriveWotReference(rows, 88, 3)).toBeNull();
  });

  it("works with acceleratorPct as the throttle field", () => {
    const rows = [
      { timeSec: 0, acceleratorPct: 90 },
      { timeSec: 1, acceleratorPct: 95 },
      { timeSec: 2, acceleratorPct: 92 },
    ];
    const ref = deriveWotReference(rows);
    expect(ref).not.toBeNull();
    expect(ref!.startSec).toBeCloseTo(0, 5);
    expect(ref!.endSec).toBeCloseTo(2, 5);
  });
});

// ─── End-to-end IoU: good pull ────────────────────────────────────────────────

describe("End-to-end pull window IoU — good pull", () => {
  let iou: number | undefined;

  beforeAll(() => {
    const rows = getRows("good-pull");
    const pw = detectPullWindow(rows, FORTY_ROLL_TEMPLATE).pullWindow;
    const ref = deriveWotReference(rows);
    if (pw && ref) {
      iou = calculatePullWindowIoU(
        { startSec: pw.startTime, endSec: pw.endTime },
        ref,
      );
    }
  });

  it("computes a defined IoU", () => {
    expect(iou).toBeDefined();
  });

  it("IoU is high for a clean pull (> 0.7)", () => {
    expect(iou).toBeGreaterThan(0.7);
  });

  it("IoU does not exceed 1.0", () => {
    expect(iou).toBeLessThanOrEqual(1.0);
  });
});
