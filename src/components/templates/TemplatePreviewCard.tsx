"use client";

import { FileText, Gauge, Car, Navigation } from "lucide-react";
import type { ValidationTemplate, LogValidationMode } from "@/lib/schema/validation-rules";
import { cn } from "@/lib/utils";

// ─── Mode meta ────────────────────────────────────────────────────────────────

const MODE_META: Record<
  LogValidationMode,
  { label: string; color: string; Icon: React.ElementType }
> = {
  roll_pull: { label: "Roll Pull",  color: "text-red-400",   Icon: Car        },
  wot_pull:  { label: "WOT Pull",   color: "text-orange-400", Icon: Gauge      },
  idle:      { label: "Idle Log",   color: "text-blue-400",  Icon: FileText   },
  cruise:    { label: "Cruise Log", color: "text-emerald-400", Icon: Navigation },
};

// ─── Plain-English summary ────────────────────────────────────────────────────

function buildSummary(t: ValidationTemplate): string {
  const mode = t.mode;

  if (mode === "roll_pull") {
    const speed   = t.roll?.targetSpeedMph ?? 40;
    const tol     = t.roll?.speedToleranceMph ?? 5;
    const gear    = t.gear?.requiredGear ?? "any";
    const startRpm = t.rpm?.startRpm?.toLocaleString() ?? "any";
    const endRpm   = t.rpm?.targetEndRpm?.toLocaleString() ?? "redline";
    const throttle = t.wot?.minThrottlePct ?? 90;
    return (
      `Validate a ${speed} mph roll (±${tol} mph) in ${gear === null ? "any" : gear + "th"} gear ` +
      `starting around ${startRpm} RPM and ending near ${endRpm} RPM. ` +
      `Requires WOT above ${throttle}% with no early lift.`
    );
  }

  if (mode === "wot_pull") {
    const hasRoll  = t.roll?.enabled;
    const gear     = t.gear?.requiredGear ?? null;
    const startRpm = t.rpm?.startRpm?.toLocaleString() ?? "any";
    const endRpm   = t.rpm?.targetEndRpm?.toLocaleString() ?? "redline";
    const throttle = t.wot?.minThrottlePct ?? 90;
    return (
      `Validate a ${gear !== null ? gear + "rd/th" : ""} gear WOT pull starting around ${startRpm} RPM ` +
      `and ending near ${endRpm} RPM. ` +
      (hasRoll && t.roll?.targetSpeedMph
        ? `Roll start from ${t.roll.targetSpeedMph} mph required. `
        : "No roll-speed requirement. ") +
      `Throttle must stay above ${throttle}% with no early lift.`
    );
  }

  if (mode === "idle") {
    const dur     = t.idle?.minDurationSec ?? 30;
    const speed   = t.idle?.maxVehicleSpeedMph ?? 2;
    const throttle= t.idle?.maxThrottlePct ?? 5;
    const stable  = t.idle?.requireStableRpm !== false ? " stable RPM," : "";
    const temp    = t.idle?.minCoolantTempF ? ` coolant ≥ ${t.idle.minCoolantTempF}°F,` : "";
    return (
      `Validate an idle log with vehicle speed near 0 (< ${speed} mph), ` +
      `throttle below ${throttle}%,${stable}${temp} ` +
      `and at least ${dur} seconds of data.`
    );
  }

  if (mode === "cruise") {
    const dur     = t.cruise?.minDurationSec ?? 45;
    const speed   = t.cruise?.targetSpeedMph;
    const tol     = t.cruise?.speedToleranceMph ?? 10;
    const minT    = t.cruise?.minThrottlePct ?? 5;
    const maxT    = t.cruise?.maxThrottlePct ?? 45;
    return (
      `Validate a cruise log` +
      (speed ? ` around ${speed} mph (±${tol} mph)` : "") +
      `, moderate throttle ${minT}–${maxT}%, stable speed and RPM, ` +
      `and at least ${dur} seconds of data.`
    );
  }

  return t.description ?? t.name;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  template: ValidationTemplate;
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TemplatePreviewCard({ template, className }: Props) {
  const meta    = MODE_META[template.mode];
  const summary = buildSummary(template);
  const Icon    = meta.Icon;

  // Key parameters to display as chips
  const chips: { label: string; value: string }[] = [];

  if (template.mode === "roll_pull" || template.mode === "wot_pull") {
    if (template.roll?.enabled && template.roll.targetSpeedMph) {
      chips.push({ label: "Roll speed", value: `${template.roll.targetSpeedMph} mph` });
    }
    if (template.rpm?.startRpm) {
      chips.push({ label: "Start RPM", value: template.rpm.startRpm.toLocaleString() });
    }
    if (template.rpm?.targetEndRpm) {
      chips.push({ label: "End RPM", value: template.rpm.targetEndRpm.toLocaleString() });
    }
    if (template.gear?.requiredGear) {
      chips.push({ label: "Gear", value: `${template.gear.requiredGear}` });
    }
    if (template.wot?.minThrottlePct) {
      chips.push({ label: "Min throttle", value: `${template.wot.minThrottlePct}%` });
    }
  }

  if (template.mode === "idle" && template.idle) {
    if (template.idle.minDurationSec) chips.push({ label: "Min duration", value: `${template.idle.minDurationSec} s` });
    if (template.idle.maxVehicleSpeedMph !== undefined) chips.push({ label: "Max speed", value: `${template.idle.maxVehicleSpeedMph} mph` });
    if (template.idle.maxThrottlePct !== undefined) chips.push({ label: "Max throttle", value: `${template.idle.maxThrottlePct}%` });
    if (template.idle.minCoolantTempF) chips.push({ label: "Min coolant", value: `${template.idle.minCoolantTempF}°F` });
  }

  if (template.mode === "cruise" && template.cruise) {
    if (template.cruise.minDurationSec) chips.push({ label: "Min duration", value: `${template.cruise.minDurationSec} s` });
    if (template.cruise.targetSpeedMph) chips.push({ label: "Target speed", value: `${template.cruise.targetSpeedMph} mph` });
    if (template.cruise.minThrottlePct !== undefined && template.cruise.maxThrottlePct !== undefined) {
      chips.push({ label: "Throttle range", value: `${template.cruise.minThrottlePct}–${template.cruise.maxThrottlePct}%` });
    }
  }

  const reqCount = template.requiredChannels.filter((r) => r.required).length;
  if (template.dataQualityRules?.minSampleRateHz) {
    chips.push({ label: "Sample rate", value: `≥ ${template.dataQualityRules.minSampleRateHz} Hz` });
  }

  return (
    <div className={cn("rounded-xl border border-white/8 bg-[#0d0d0d] p-5", className)}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 border border-white/8">
          <Icon className={cn("h-4.5 w-4.5", meta.color)} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("text-[10px] font-bold uppercase tracking-widest", meta.color)}>
              {meta.label}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-white mt-0.5 leading-snug">{template.name}</h3>
        </div>
      </div>

      {/* Summary */}
      <p className="text-xs text-zinc-400 leading-relaxed mb-4">{summary}</p>

      {/* Parameter chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {chips.map((c) => (
            <span
              key={c.label}
              className="inline-flex items-center gap-1 rounded-md border border-white/8 bg-white/4 px-2 py-0.5 text-[10px] text-zinc-400"
            >
              <span className="text-zinc-600">{c.label}:</span>
              <span className="font-medium text-zinc-200">{c.value}</span>
            </span>
          ))}
        </div>
      )}

      {/* Required channels count */}
      <p className="text-[10px] text-zinc-700">
        {reqCount} required channel{reqCount !== 1 ? "s" : ""} · {template.mode.replace("_", " ")} validation
      </p>
    </div>
  );
}
