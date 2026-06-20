"use client";

/**
 * SpeedRpmChart — Speed (mph) and RPM over time.
 * Useful for verifying single-gear stability (constant speed/RPM ratio) during the pull.
 *
 * Left Y-axis  : Speed (mph)
 * Right Y-axis : RPM
 */

import {
  ResponsiveContainer,
  ComposedChart,
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

function TooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
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
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-zinc-400">{p.name}:</span>
          <span className="font-mono text-white">{p.value?.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

interface Props {
  rows: NormalizedLogRow[];
  pullWindow?: PullWindow;
  failureEvents?: FailureEvent[];
}

export function SpeedRpmChart({ rows, pullWindow, failureEvents = [] }: Props) {
  const data = toChartData(rows);
  const showSpeed = hasChannel(data, "speed");
  const showRpm = hasChannel(data, "rpm");

  if (!showSpeed && !showRpm) {
    return (
      <div className="flex h-[200px] items-center justify-center text-xs text-zinc-600">
        No speed or RPM data available.
      </div>
    );
  }

  const chartableEvents = failureEvents.filter(
    (e) => isFinite(e.timeSec) && e.timeSec > 0
  );

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-2">
        Speed & RPM — Gear Stability
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 8, right: 40, bottom: 0, left: 0 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(v) => `${Number(v).toFixed(1)}s`}
            {...AXIS_STYLE}
          />
          <YAxis
            yAxisId="speed"
            domain={[0, "auto"]}
            tickCount={5}
            tickFormatter={(v) => `${v}`}
            width={30}
            {...AXIS_STYLE}
          />
          {showRpm && (
            <YAxis
              yAxisId="rpm"
              orientation="right"
              domain={[0, 8000]}
              tickCount={5}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              width={32}
              {...AXIS_STYLE}
            />
          )}

          <Tooltip
            content={<TooltipContent />}
            cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }}
          />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={8} />

          {pullWindow && (
            <ReferenceArea
              yAxisId="speed"
              x1={pullWindow.startTime}
              x2={pullWindow.endTime}
              fill={C.pullFill}
              stroke={C.pullStroke}
              strokeWidth={1}
            />
          )}

          {chartableEvents.map((ev) => (
            <ReferenceLine
              key={ev.id}
              yAxisId="speed"
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

          {showSpeed && (
            <Line
              yAxisId="speed"
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

          {showRpm && (
            <Line
              yAxisId="rpm"
              type="monotone"
              dataKey="rpm"
              name="RPM"
              stroke={C.rpm}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: C.rpm }}
              connectNulls={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
