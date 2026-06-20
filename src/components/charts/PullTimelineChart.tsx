"use client";

/**
 * PullTimelineChart — Overview chart showing RPM and Throttle over the full
 * log duration, with the detected pull window highlighted and failure event
 * markers overlaid as dashed vertical reference lines.
 *
 * Left Y-axis  : RPM (0 – 8,000)
 * Right Y-axis : Throttle / Pedal (0 – 100 %)
 */

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceArea,
  ReferenceLine,
} from "recharts";
import type { NormalizedLogRow } from "@/lib/schema/normalized-log";
import type { PullWindow, FailureEvent } from "@/lib/schema/validation-result";
import {
  toChartData,
  hasChannel,
  C,
  AXIS_STYLE,
  GRID_PROPS,
  FAILURE_STROKE,
  FAILURE_LABEL,
  fmtTime,
} from "./_chartHelpers";

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function TooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; unit?: string }>;
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg border border-white/10 bg-[#161616] px-3 py-2 shadow-xl"
      style={{ fontSize: 11 }}
    >
      <div className="text-zinc-500 mb-1.5 font-mono">{fmtTime(label ?? 0)}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full flex-shrink-0"
            style={{ background: p.color }}
          />
          <span className="text-zinc-400">{p.name}:</span>
          <span className="font-mono text-white">
            {typeof p.value === "number" ? p.value.toFixed(1) : "—"}
            {p.unit ? ` ${p.unit}` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  rows: NormalizedLogRow[];
  pullWindow?: PullWindow;
  failureEvents?: FailureEvent[];
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PullTimelineChart({ rows, pullWindow, failureEvents = [] }: Props) {
  const data = toChartData(rows);
  const showThrottle = hasChannel(data, "throttle");
  const showSpeed = hasChannel(data, "speed");

  if (!hasChannel(data, "rpm")) {
    return (
      <div className="flex h-[240px] items-center justify-center text-xs text-zinc-600">
        No RPM data available.
      </div>
    );
  }

  // Only show failure events that have a timestamp we can mark on the x-axis
  const chartableEvents = failureEvents.filter(
    (e) => e.timeSec !== undefined && isFinite(e.timeSec) && e.timeSec > 0
  );

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-2">
        Overview — RPM · Throttle{showSpeed ? " · Speed" : ""}
      </p>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid {...GRID_PROPS} />

          {/* X axis — time (seconds) */}
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(v) => `${Number(v).toFixed(1)}s`}
            {...AXIS_STYLE}
          />

          {/* Left Y — RPM */}
          <YAxis
            yAxisId="rpm"
            domain={[0, 8000]}
            tickCount={5}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            width={32}
            {...AXIS_STYLE}
          />

          {/* Right Y — Throttle % */}
          {showThrottle && (
            <YAxis
              yAxisId="throttle"
              orientation="right"
              domain={[0, 100]}
              tickCount={5}
              tickFormatter={(v) => `${v}%`}
              width={36}
              {...AXIS_STYLE}
            />
          )}

          <Tooltip
            content={<TooltipContent />}
            cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }}
          />

          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            iconType="circle"
            iconSize={8}
          />

          {/* Pull window highlight */}
          {pullWindow && (
            <ReferenceArea
              yAxisId="rpm"
              x1={pullWindow.startTime}
              x2={pullWindow.endTime}
              fill={C.pullFill}
              stroke={C.pullStroke}
              strokeWidth={1}
              label={{
                value: "Pull",
                position: "insideTopLeft",
                fontSize: 9,
                fill: "rgba(239,68,68,0.5)",
              }}
            />
          )}

          {/* Failure event markers */}
          {chartableEvents.map((ev) => (
            <ReferenceLine
              key={ev.id}
              yAxisId="rpm"
              x={ev.timeSec}
              stroke={FAILURE_STROKE[ev.type] ?? "#6b7280"}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              label={{
                value: FAILURE_LABEL[ev.type] ?? ev.type,
                position: "insideTopRight",
                fontSize: 9,
                fill: FAILURE_STROKE[ev.type] ?? "#6b7280",
              }}
            />
          ))}

          {/* RPM area */}
          <Area
            yAxisId="rpm"
            type="monotone"
            dataKey="rpm"
            name="RPM"
            stroke={C.rpm}
            fill="rgba(239,68,68,0.08)"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: C.rpm }}
            connectNulls={false}
          />

          {/* Speed line */}
          {showSpeed && (
            <Line
              yAxisId="rpm"
              type="monotone"
              dataKey="speed"
              name="Speed (mph)"
              stroke={C.speed}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: C.speed }}
              connectNulls={false}
            />
          )}

          {/* Throttle line */}
          {showThrottle && (
            <Line
              yAxisId="throttle"
              type="monotone"
              dataKey="throttle"
              name="Throttle %"
              stroke={C.throttle}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: C.throttle }}
              connectNulls={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
