/**
 * Shared helpers for all Recharts telemetry chart components.
 */

import type { NormalizedLogRow } from "@/lib/schema/normalized-log";

// ─── Chart data point ─────────────────────────────────────────────────────────

export interface ChartDataPoint {
  t: number;
  rpm?: number;
  throttle?: number;
  speed?: number;
  afr?: number;
  lambda?: number;
  boost?: number;
  timing?: number;
  knock?: number;
  gear?: number;
}

// ─── Convert rows to chart-friendly flat objects ──────────────────────────────

export function toChartData(rows: NormalizedLogRow[]): ChartDataPoint[] {
  const data = rows.map((r) => ({
    t: r.timeSec,
    rpm: r.rpm,
    throttle: r.throttlePct ?? r.acceleratorPct,
    speed: r.speedMph,
    afr: r.afr,
    lambda: r.lambda,
    boost: r.boostPsi,
    timing: r.ignitionTimingDeg,
    knock: r.knockRetardDeg,
    gear: r.gear,
  }));

  // Thin to at most 600 points for performance (at 10 Hz × 60 s = 600 pts, so usually no-op)
  return thinData(data, 600);
}

/** Whether a channel has at least one defined, finite value */
export function hasChannel(
  data: ChartDataPoint[],
  key: keyof ChartDataPoint
): boolean {
  return data.some((d) => {
    const v = d[key];
    return v !== undefined && v !== null && isFinite(v as number);
  });
}

/** Downsample data to at most maxPoints by keeping every Nth entry */
function thinData<T>(data: T[], maxPoints: number): T[] {
  if (data.length <= maxPoints) return data;
  const step = Math.ceil(data.length / maxPoints);
  return data.filter((_, i) => i % step === 0);
}

// ─── Brand colours ────────────────────────────────────────────────────────────

export const C = {
  rpm: "#ef4444",           // red-500
  throttle: "#f97316",      // orange-500
  speed: "#60a5fa",         // blue-400
  afr: "#c084fc",           // purple-400
  lambda: "#a78bfa",        // violet-400
  boost: "#22d3ee",         // cyan-400
  timing: "#facc15",        // yellow-400
  knock: "#fb7185",         // rose-400

  pullFill: "rgba(239,68,68,0.06)",
  pullStroke: "rgba(239,68,68,0.25)",

  grid: "rgba(255,255,255,0.04)",
  tick: "#52525b",
  tooltip: "#161616",
} as const;

/** Colour per failure event type */
export const FAILURE_STROKE: Record<string, string> = {
  early_lift: "#ef4444",
  no_redline: "#f59e0b",
  wrong_gear: "#f97316",
  corrupted_timestamps: "#a855f7",
  missing_channels: "#ec4899",
  pull_too_short: "#f59e0b",
  no_pull_detected: "#6b7280",
};

export const FAILURE_LABEL: Record<string, string> = {
  early_lift: "Early lift",
  no_redline: "Lifted near redline",
  wrong_gear: "Wrong gear",
  corrupted_timestamps: "Timestamp corruption",
  missing_channels: "Missing channel",
  pull_too_short: "Pull too short",
  no_pull_detected: "No pull",
};

// ─── Shared axis / grid style props ──────────────────────────────────────────

export const AXIS_STYLE = {
  tick: { fill: C.tick, fontSize: 10 },
  axisLine: false as const,
  tickLine: false as const,
};

export const GRID_PROPS = {
  stroke: C.grid,
  vertical: false,
};

// ─── Shared tooltip wrapper ───────────────────────────────────────────────────

export function fmtTime(t: number): string {
  return `${t.toFixed(2)} s`;
}
