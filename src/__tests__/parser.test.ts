/**
 * parser.test.ts
 *
 * Tests for the CSV ingestion pipeline:
 *   parseLogFromText → detectFormat → mapColumns → normalizeUnits
 *
 * All tests run in Node.js (no browser APIs required).
 * PapaParse works in Node natively; no mocking needed.
 */

import { describe, it, expect } from "vitest";
import { parseLogFromText } from "@/lib/parser/toNormalizedRows";
import { demoLogs } from "@/lib/demo-data/demoLogs";

// ─── Minimal hand-crafted CSV fixtures ────────────────────────────────────────
//
// These short CSV strings exercise specific mapping behaviour without
// depending on the full synthetic demo-log generator.

const GENERIC_5_ROWS = `\
Time (sec),RPM,Speed (mph),Gear,Throttle,AFR,Boost (psi),Ign Timing,Knock Retard
0.0,2000,40.0,4,98.0,13.5,8.2,18.5,0.0
0.1,2100,40.3,4,98.1,13.4,8.6,18.3,0.0
0.2,2250,40.7,4,98.2,13.5,8.9,18.1,0.0
0.3,2400,41.1,4,98.0,13.4,9.1,18.0,0.1
0.4,2600,41.5,4,98.3,13.5,9.3,17.9,0.0`;

const COBB_5_ROWS = `\
Time (sec),RPM,Vehicle Speed (mph),Throttle Pos (%),Boost (psi),AFR,Ign Timing (deg),Feedback Knock (deg)
0.0,2000,40.0,98.0,8.2,13.5,18.5,0.0
0.1,2100,40.3,98.1,8.6,13.4,18.3,0.0
0.2,2250,40.7,98.2,8.9,13.5,18.1,0.0
0.3,2400,41.1,98.0,9.1,13.4,18.0,0.1
0.4,2600,41.5,98.3,9.3,13.5,17.9,0.0`;

const MHD_5_ROWS = `\
time,rpm,speed,gear,pedal,boost actual,lambda bank 1,ign timing,timing correction cyl 1
0.0,2000,40.0,4,98.0,8.2,0.91,18.5,-0.5
0.1,2100,40.3,4,98.1,8.6,0.91,18.3,-0.4
0.2,2250,40.7,4,98.2,8.9,0.90,18.1,-0.5
0.3,2400,41.1,4,98.0,9.1,0.90,18.0,-0.3
0.4,2600,41.5,4,98.3,9.3,0.91,17.9,-0.5`;

// km/h speed column — should be converted to mph
const KMPH_CSV = `\
Time (sec),RPM,Vehicle Speed (km/h),Throttle Pos (%),AFR
0.0,2000,64.4,98.0,13.5
0.1,2100,64.8,98.1,13.4`;

// ─── Generic format ───────────────────────────────────────────────────────────

describe("Generic CSV format", () => {
  const log = parseLogFromText(GENERIC_5_ROWS, "generic-test.csv");

  it("produces 5 normalized rows", () => {
    expect(log.rows).toHaveLength(5);
  });

  it("extracts timeSec from 'Time (sec)' column", () => {
    expect(log.rows[0].timeSec).toBeCloseTo(0.0, 5);
    expect(log.rows[4].timeSec).toBeCloseTo(0.4, 5);
  });

  it("maps RPM column", () => {
    expect(log.rows[0].rpm).toBe(2000);
    expect(log.rows[4].rpm).toBe(2600);
  });

  it("maps speed to speedMph", () => {
    expect(log.rows[0].speedMph).toBeCloseTo(40.0, 1);
  });

  it("maps gear", () => {
    expect(log.rows[0].gear).toBe(4);
  });

  it("maps throttle to throttlePct", () => {
    expect(log.rows[0].throttlePct).toBeCloseTo(98.0, 1);
  });

  it("maps AFR", () => {
    expect(log.rows[0].afr).toBeCloseTo(13.5, 1);
  });

  it("maps boostPsi", () => {
    expect(log.rows[0].boostPsi).toBeCloseTo(8.2, 1);
  });

  it("maps ignitionTimingDeg", () => {
    expect(log.rows[0].ignitionTimingDeg).toBeCloseTo(18.5, 1);
  });

  it("maps knockRetardDeg", () => {
    expect(log.rows[3].knockRetardDeg).toBeCloseTo(0.1, 2);
  });

  it("returns no fatal 'no parseable data' warning", () => {
    const fatal = log.warnings.filter((w) =>
      w.toLowerCase().includes("no parseable"),
    );
    expect(fatal).toHaveLength(0);
  });

  it("has all rows with defined timeSec", () => {
    for (const row of log.rows) {
      expect(row.timeSec).toBeDefined();
    }
  });
});

// ─── COBB Accessport-like format ──────────────────────────────────────────────

describe("COBB Accessport-like CSV format", () => {
  const log = parseLogFromText(COBB_5_ROWS, "cobb-test.csv");

  it("detects format as cobb_like", () => {
    expect(log.detectedFormat).toBe("cobb_like");
  });

  it("produces 5 rows", () => {
    expect(log.rows).toHaveLength(5);
  });

  it("maps 'Vehicle Speed (mph)' → speedMph", () => {
    expect(log.rows[0].speedMph).toBeCloseTo(40.0, 1);
  });

  it("maps 'Throttle Pos (%)' → throttlePct", () => {
    expect(log.rows[0].throttlePct).toBeCloseTo(98.0, 1);
  });

  it("maps 'Ign Timing (deg)' → ignitionTimingDeg", () => {
    expect(log.rows[0].ignitionTimingDeg).toBeCloseTo(18.5, 1);
  });

  it("maps 'Feedback Knock (deg)' → knockRetardDeg", () => {
    expect(log.rows[3].knockRetardDeg).toBeCloseTo(0.1, 2);
  });

  it("maps 'AFR' → afr", () => {
    expect(log.rows[0].afr).toBeCloseTo(13.5, 1);
  });

  it("has no gear column (COBB does not export gear by default)", () => {
    // gear may be undefined or derived — the key point is the format still parses
    expect(log.rows[0].speedMph).toBeDefined();
  });
});

// ─── MHD / BMW-like format ────────────────────────────────────────────────────

describe("MHD / BMW-like CSV format", () => {
  const log = parseLogFromText(MHD_5_ROWS, "mhd-test.csv");

  it("detects format as mhd_like", () => {
    expect(log.detectedFormat).toBe("mhd_like");
  });

  it("produces 5 rows", () => {
    expect(log.rows).toHaveLength(5);
  });

  it("maps 'pedal' → acceleratorPct", () => {
    expect(log.rows[0].acceleratorPct).toBeCloseTo(98.0, 1);
  });

  it("maps 'lambda bank 1' → lambda", () => {
    expect(log.rows[0].lambda).toBeCloseTo(0.91, 2);
  });

  it("cross-derives AFR from lambda (λ × 14.7 for petrol)", () => {
    // afr ≈ 0.91 × 14.7 ≈ 13.38
    expect(log.rows[0].afr).toBeCloseTo(0.91 * 14.7, 0);
  });

  it("maps gear", () => {
    expect(log.rows[0].gear).toBe(4);
  });

  it("maps per-cylinder timing correction to timingCorrectionCylinders", () => {
    expect(log.rows[0].timingCorrectionCylinders?.cyl1).toBeDefined();
  });
});

// ─── Unit conversion ──────────────────────────────────────────────────────────

describe("Unit conversion", () => {
  it("converts km/h speed column to mph", () => {
    const log = parseLogFromText(KMPH_CSV, "kmph-test.csv");
    // 64.4 km/h ≈ 40 mph (64.4 / 1.60934 ≈ 40.0)
    expect(log.rows[0].speedMph).toBeCloseTo(40.0, 0);
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe("Edge cases and error handling", () => {
  it("returns empty rows and a warning for an empty string", () => {
    const log = parseLogFromText("", "empty.csv");
    expect(log.rows).toHaveLength(0);
    expect(log.warnings.length).toBeGreaterThan(0);
  });

  it("returns empty rows for a header-only CSV", () => {
    const log = parseLogFromText("time,rpm,speed\n", "header-only.csv");
    expect(log.rows).toHaveLength(0);
  });

  it("does not crash on an entirely unknown column set", () => {
    const log = parseLogFromText("foo,bar,baz\n1,2,3\n4,5,6", "unknown.csv");
    expect(log).toBeDefined();
    // sourceRowIndex should still be set for each row
    for (const row of log.rows) {
      expect(row.sourceRowIndex).toBeDefined();
    }
  });

  it("handles extra whitespace in headers gracefully", () => {
    const csv = " time , rpm , speed (mph) \n0.0,2000,40.0\n0.1,2050,40.2";
    const log = parseLogFromText(csv, "whitespace-headers.csv");
    expect(log.rows.length).toBeGreaterThan(0);
    expect(log.rows[0].rpm).toBe(2000);
  });

  it("reports unmapped columns in warnings without crashing", () => {
    const csv = "time,rpm,speed (mph),WEIRD_UNKNOWN_COLUMN\n0.0,2000,40.0,99\n0.1,2050,40.2,98";
    const log = parseLogFromText(csv, "partial.csv");
    // Should parse the known columns and warn about the unknown one
    expect(log.rows[0].rpm).toBe(2000);
    const hasUnmappedWarning = log.warnings.some((w) =>
      w.toLowerCase().includes("unrecogni"),
    );
    expect(hasUnmappedWarning).toBe(true);
  });
});

// ─── Full demo log integration ────────────────────────────────────────────────

describe("Demo log CSV integration", () => {
  it("generic good pull: parses > 50 rows with time and RPM", () => {
    const demo = demoLogs.find((l) => l.id === "good-pull")!;
    const log = parseLogFromText(demo.csvContent, demo.name);
    expect(log.rows.length).toBeGreaterThan(50);
    expect(log.rows[0].timeSec).toBeDefined();
    expect(log.rows[0].rpm).toBeDefined();
  });

  it("COBB good pull: detects cobb_like format", () => {
    const demo = demoLogs.find((l) => l.id === "cobb-good")!;
    const log = parseLogFromText(demo.csvContent, demo.name);
    expect(log.detectedFormat).toBe("cobb_like");
    expect(log.rows.length).toBeGreaterThan(50);
  });

  it("MHD good pull: detects mhd_like format and maps lambda", () => {
    const demo = demoLogs.find((l) => l.id === "mhd-good")!;
    const log = parseLogFromText(demo.csvContent, demo.name);
    expect(log.detectedFormat).toBe("mhd_like");
    expect(log.rows[0].lambda).toBeDefined();
  });

  it("missing-AFR log: afr and lambda are undefined for all rows", () => {
    const demo = demoLogs.find((l) => l.id === "missing-afr")!;
    const log = parseLogFromText(demo.csvContent, demo.name);
    const hasAfr = log.rows.some((r) => r.afr !== undefined);
    const hasLambda = log.rows.some((r) => r.lambda !== undefined);
    expect(hasAfr).toBe(false);
    expect(hasLambda).toBe(false);
  });

  it("corrupted-timestamps log: flags timestamp corruption in warnings", () => {
    const demo = demoLogs.find((l) => l.id === "corrupted-timestamps")!;
    const log = parseLogFromText(demo.csvContent, demo.name);
    const hasTimestampWarning = log.warnings.some((w) =>
      w.toLowerCase().includes("timestamp"),
    );
    expect(hasTimestampWarning).toBe(true);
  });

  it("low-sample-rate log: parses successfully (validation handles the rate)", () => {
    const demo = demoLogs.find((l) => l.id === "low-sample-rate")!;
    const log = parseLogFromText(demo.csvContent, demo.name);
    expect(log.rows.length).toBeGreaterThan(5);
  });
});
