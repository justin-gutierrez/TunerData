"use client";

/**
 * RpmThrottleChart — Focused dual-axis chart for RPM vs Throttle.
 *
 * This is the primary diagnostic chart for early-lift detection:
 *   • RPM trace (red, left axis 0–8,000)
 *   • Throttle trace (orange, right axis 0–100%)
 *   • Target RPM dashed line
 *   • Pull window shaded region
 *   • Early-lift / no-redline markers at their exact timestamp, with a bold label
 *
 * The combination of RPM not reaching target while throttle visually drops
 * makes the early-lift failure self-evident at a glance.
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
import type { ValidationTemplate } from "@/lib/schema/validation-rules";
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
          <span
            className="inline-block h-2 w-2 rounded-full flex-shrink-0"
            style={{ background: p.color }}
          />
          <span className="text-zinc-400">{p.name}:</span>
          <span className="font-mono text-white">
            {typeof p.value === "number" ? p.value.toFixed(1) : "—"}
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
  template?: ValidationTemplate;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RpmThrottleChart({
  rows,
  pullWindow,
  failureEvents = [],
  template,
}: Props) {
  const data = toChartData(rows);
  const showThrottle = hasChannel(data, "throttle");

  if (!hasChannel(data, "rpm")) {
    return (
      <div className="flex h-[220px] items-center justify-center text-xs text-zinc-600">
        No RPM data available.
      </div>
    );
  }

  // Early-lift and no-redline are the primary markers on this chart
  const priorityEvents = failureEvents.filter(
    (e) =>
      (e.type === "early_lift" || e.type === "no_redline") &&
      isFinite(e.timeSec) &&
      e.timeSec > 0
  );
  const otherEvents = failureEvents.filter(
    (e) =>
      e.type !== "early_lift" &&
      e.type !== "no_redline" &&
      isFinite(e.timeSec) &&
      e.timeSec > 0
  );

  const targetRpm = template?.rpm?.targetEndRpm ?? 6500;

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-2">
        RPM vs Throttle — Pull Compliance
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 8, right: 40, bottom: 0, left: 0 }}>
          <CartesianGrid {...GRID_PROPS} />

          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(v) => `${Number(v).toFixed(1)}s`}
            {...AXIS_STYLE}
          />

          {/* Left — RPM */}
          <YAxis
            yAxisId="rpm"
            domain={[0, 8000]}
            tickCount={5}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            width={32}
            {...AXIS_STYLE}
          />

          {/* Right — Throttle */}
          {showThrottle && (
            <YAxis
              yAxisId="thr"
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

          {/* Pull window */}
          {pullWindow && (
            <ReferenceArea
              yAxisId="rpm"
              x1={pullWindow.startTime}
              x2={pullWindow.endTime}
              fill={C.pullFill}
              stroke={C.pullStroke}
              strokeWidth={1}
            />
          )}

          {/* Target RPM dashed horizontal line */}
          <ReferenceLine
            yAxisId="rpm"
            y={targetRpm}
            stroke="rgba(239,68,68,0.35)"
            strokeDasharray="6 3"
            label={{
              value: `Target ${targetRpm.toLocaleString()}`,
              position: "insideTopRight",
              fontSize: 9,
              fill: "rgba(239,68,68,0.6)",
            }}
          />

          {/* Priority failure markers (early_lift / no_redline) — bold */}
          {priorityEvents.map((ev) => (
            <ReferenceLine
              key={ev.id}
              yAxisId="rpm"
              x={ev.timeSec}
              stroke={FAILURE_STROKE[ev.type] ?? "#6b7280"}
              strokeWidth={2}
              strokeDasharray="5 3"
              label={{
                value: FAILURE_LABEL[ev.type] ?? ev.type,
                position: "insideTopLeft",
                fontSize: 10,
                fontWeight: 600,
                fill: FAILURE_STROKE[ev.type] ?? "#6b7280",
              }}
            />
          ))}

          {/* Other markers — thinner */}
          {otherEvents.map((ev) => (
            <ReferenceLine
              key={ev.id}
              yAxisId="rpm"
              x={ev.timeSec}
              stroke={FAILURE_STROKE[ev.type] ?? "#6b7280"}
              strokeWidth={1}
              strokeDasharray="3 2"
              label={{
                value: FAILURE_LABEL[ev.type] ?? ev.type,
                position: "insideTopRight",
                fontSize: 9,
                fill: FAILURE_STROKE[ev.type] ?? "#6b7280",
              }}
            />
          ))}

          {/* RPM line */}
          <Line
            yAxisId="rpm"
            type="monotone"
            dataKey="rpm"
            name="RPM"
            stroke={C.rpm}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, fill: C.rpm }}
            connectNulls={false}
          />

          {/* Throttle line */}
          {showThrottle && (
            <Line
              yAxisId="thr"
              type="monotone"
              dataKey="throttle"
              name="Throttle %"
              stroke={C.throttle}
              strokeWidth={2}
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
