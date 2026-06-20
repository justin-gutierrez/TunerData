import type { FailureEvent } from "@/lib/schema/validation-result";
import { FAILURE_STROKE, FAILURE_LABEL } from "./_chartHelpers";

interface Props {
  failureEvents: FailureEvent[];
}

export function FailureMarkerLegend({ failureEvents }: Props) {
  const chartable = failureEvents.filter(
    (e) => e.timeSec !== undefined && e.type !== "no_pull_detected"
  );
  if (chartable.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {chartable.map((ev) => {
        const color = FAILURE_STROKE[ev.type] ?? "#6b7280";
        const label = FAILURE_LABEL[ev.type] ?? ev.type;
        return (
          <div
            key={ev.id}
            className="flex items-center gap-2 rounded-full border border-white/8 bg-[#0d0d0d] px-3 py-1"
          >
            {/* Dashed line icon */}
            <svg width="18" height="10" viewBox="0 0 18 10" className="flex-shrink-0">
              <line
                x1="0"
                y1="5"
                x2="18"
                y2="5"
                stroke={color}
                strokeWidth="1.5"
                strokeDasharray="3 2"
              />
            </svg>
            <span className="text-[11px] font-medium" style={{ color }}>
              {label}
            </span>
            {ev.rpm !== undefined && (
              <span className="text-[10px] text-zinc-600">
                @ {Math.round(ev.rpm).toLocaleString()} RPM
              </span>
            )}
            {ev.timeSec !== undefined && (
              <span className="text-[10px] text-zinc-700">
                {ev.timeSec.toFixed(1)} s
              </span>
            )}
          </div>
        );
      })}
      <div className="flex items-center gap-2 rounded-full border border-white/6 bg-[#0d0d0d] px-3 py-1">
        <svg width="18" height="10" viewBox="0 0 18 10">
          <rect x="0" y="0" width="18" height="10" fill="rgba(239,68,68,0.12)" />
        </svg>
        <span className="text-[11px] text-zinc-500">Pull window</span>
      </div>
    </div>
  );
}
