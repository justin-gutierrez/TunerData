"use client";

/**
 * AfrBoostChart — Air-fuel ratio (or lambda) and boost pressure over time.
 * Returns null if neither channel has any data (graceful missing-data handling).
 *
 * Left Y-axis  : AFR or Lambda
 * Right Y-axis : Boost (psi)
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
          <span className="font-mono text-white">{p.value?.toFixed(2)}</span>
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

export function AfrBoostChart({ rows, pullWindow, failureEvents = [] }: Props) {
  const data = toChartData(rows);
  const showAfr = hasChannel(data, "afr");
  const showLambda = !showAfr && hasChannel(data, "lambda");
  const showBoost = hasChannel(data, "boost");

  if (!showAfr && !showLambda && !showBoost) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-lg border border-white/4 bg-[#0d0d0d] text-xs text-zinc-600">
        AFR, Lambda, and Boost channels not present in this log.
      </div>
    );
  }

  const chartableEvents = failureEvents.filter(
    (e) => isFinite(e.timeSec) && e.timeSec > 0
  );

  const afrDomain: [number, number] = showLambda ? [0.7, 1.1] : [10, 16];
  const afrKey = showAfr ? "afr" : "lambda";
  const afrName = showAfr ? "AFR" : "Lambda";
  const afrColor = showAfr ? C.afr : C.lambda;

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-2">
        {afrName}{showBoost ? " & Boost" : ""}
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 8, right: showBoost ? 40 : 8, bottom: 0, left: 0 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(v) => `${Number(v).toFixed(1)}s`}
            {...AXIS_STYLE}
          />

          {(showAfr || showLambda) && (
            <YAxis
              yAxisId="afr"
              domain={afrDomain}
              tickCount={5}
              tickFormatter={(v) => v.toFixed(1)}
              width={32}
              {...AXIS_STYLE}
            />
          )}

          {showBoost && (
            <YAxis
              yAxisId="boost"
              orientation="right"
              domain={[0, "auto"]}
              tickCount={5}
              tickFormatter={(v) => `${v}`}
              width={36}
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
              yAxisId={showAfr || showLambda ? "afr" : "boost"}
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
              yAxisId={showAfr || showLambda ? "afr" : "boost"}
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

          {(showAfr || showLambda) && (
            <Line
              yAxisId="afr"
              type="monotone"
              dataKey={afrKey}
              name={afrName}
              stroke={afrColor}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: afrColor }}
              connectNulls={false}
            />
          )}

          {showBoost && (
            <Line
              yAxisId="boost"
              type="monotone"
              dataKey="boost"
              name="Boost (psi)"
              stroke={C.boost}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: C.boost }}
              connectNulls={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
