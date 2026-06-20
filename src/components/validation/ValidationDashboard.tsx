import type { NormalizedLogRow } from "@/lib/schema/normalized-log";
import type { ValidationResult } from "@/lib/schema/validation-result";
import { ValidationSummaryCard } from "./ValidationSummaryCard";
import { FailedChecksList } from "./FailedChecksList";
import { MissingChannelsCard } from "./MissingChannelsCard";
import { TunerReportCard } from "./TunerReportCard";
import { CustomerMessageCard } from "./CustomerMessageCard";
import { PullTimelineChart } from "@/components/charts/PullTimelineChart";
import { RpmThrottleChart } from "@/components/charts/RpmThrottleChart";
import { SpeedRpmChart } from "@/components/charts/SpeedRpmChart";
import { AfrBoostChart } from "@/components/charts/AfrBoostChart";
import { TimingKnockChart } from "@/components/charts/TimingKnockChart";
import { FailureMarkerLegend } from "@/components/charts/FailureMarkerLegend";
import { FORTY_ROLL_TEMPLATE } from "@/lib/schema/validation-rules";

interface Props {
  result: ValidationResult;
  /** Raw normalised rows — needed to drive the chart data */
  rows: NormalizedLogRow[];
}

export function ValidationDashboard({ result, rows }: Props) {
  const { pullWindow, failureEvents } = result;
  const hasRows = rows.length > 0;

  return (
    <div className="space-y-5">
      {/* ── Hero summary ───────────────────────────────────────────── */}
      <ValidationSummaryCard result={result} />

      {/* ── Telemetry charts ────────────────────────────────────────── */}
      {hasRows && (
        <div className="rounded-xl border border-white/6 bg-[#111111] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Telemetry Charts</h2>
            {failureEvents.length > 0 && (
              <FailureMarkerLegend failureEvents={failureEvents} />
            )}
          </div>

          <div className="space-y-6">
            {/* Overview: RPM + Throttle + Speed */}
            <PullTimelineChart
              rows={rows}
              pullWindow={pullWindow}
              failureEvents={failureEvents}
            />

            {/* Focused: RPM vs Throttle with early-lift marker */}
            <div className="border-t border-white/4 pt-6">
              <RpmThrottleChart
                rows={rows}
                pullWindow={pullWindow}
                failureEvents={failureEvents}
                template={FORTY_ROLL_TEMPLATE}
              />
            </div>

            {/* Secondary charts in a 2-column grid */}
            <div className="border-t border-white/4 pt-6 grid md:grid-cols-2 gap-6">
              <SpeedRpmChart
                rows={rows}
                pullWindow={pullWindow}
                failureEvents={failureEvents}
              />
              <AfrBoostChart
                rows={rows}
                pullWindow={pullWindow}
                failureEvents={failureEvents}
              />
            </div>

            {/* Timing + Knock */}
            <div className="border-t border-white/4 pt-6">
              <TimingKnockChart
                rows={rows}
                pullWindow={pullWindow}
                failureEvents={failureEvents}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Checks + channels ───────────────────────────────────────── */}
      <div className="grid lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3">
          <FailedChecksList result={result} />
        </div>
        <div className="lg:col-span-2">
          <MissingChannelsCard result={result} />
        </div>
      </div>

      {/* ── Customer message ────────────────────────────────────────── */}
      <CustomerMessageCard result={result} />

      {/* ── Tuner technical report ──────────────────────────────────── */}
      <TunerReportCard result={result} />
    </div>
  );
}
