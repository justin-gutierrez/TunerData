"use client";

import { CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";
import type { ParsedLog, ColumnMapping } from "@/lib/schema/normalized-log";
import type { ValidationTemplate, RequiredChannelRule } from "@/lib/schema/validation-rules";
import { cn } from "@/lib/utils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isMapped(field: string, mappings: ColumnMapping[]): boolean {
  if (field === "timingCorrectionCylinders") {
    return mappings.some(
      (m) => m.normalizedField?.startsWith("timingCorrectionCylinders.") && m.status !== "unmapped"
    );
  }
  return mappings.some((m) => m.normalizedField === field && m.status !== "unmapped");
}

function ruleIsSatisfied(rule: RequiredChannelRule, mappings: ColumnMapping[]): boolean {
  const fields = rule.type === "single" ? [rule.field] : rule.fields;
  return fields.some((f) => isMapped(f, mappings));
}

interface ChannelRow {
  label: string;
  required: boolean;
  satisfied: boolean;
  fields: string[];
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  parsedLog: ParsedLog;
  template: ValidationTemplate;
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TemplateCompatibilityCard({ parsedLog, template, className }: Props) {
  const mappings = parsedLog.columnMappings;

  const channelRows: ChannelRow[] = template.requiredChannels.map((rule) => ({
    label:     rule.label,
    required:  rule.required,
    satisfied: ruleIsSatisfied(rule, mappings),
    fields:    rule.type === "single" ? [rule.field] : rule.fields,
  }));

  const requiredTotal  = channelRows.filter((r) => r.required).length;
  const requiredMet    = channelRows.filter((r) => r.required && r.satisfied).length;
  const optionalTotal  = channelRows.filter((r) => !r.required).length;
  const optionalMet    = channelRows.filter((r) => !r.required && r.satisfied).length;
  const compatScore    = requiredTotal > 0 ? Math.round((requiredMet / requiredTotal) * 100) : 100;
  const fullyCompatible = requiredMet === requiredTotal;

  // Warnings for special situations
  const warnings: string[] = [];
  const hasGearCol = mappings.some((m) => m.normalizedField === "gear" && m.status !== "unmapped");
  if (
    (template.mode === "roll_pull" || template.mode === "wot_pull") &&
    template.gear?.requiredGear !== null &&
    !hasGearCol
  ) {
    if (template.gear?.allowEstimatedGear) {
      warnings.push("No gear column — gear will be estimated from speed/RPM ratio.");
    } else {
      warnings.push("No gear column and estimated gear is disabled — gear check will fail.");
    }
  }

  const scoreColor =
    compatScore === 100
      ? "text-green-400"
      : compatScore >= 70
      ? "text-amber-400"
      : "text-red-400";

  const barColor =
    compatScore === 100
      ? "bg-green-500"
      : compatScore >= 70
      ? "bg-amber-500"
      : "bg-red-500";

  return (
    <div className={cn("rounded-xl border border-white/8 bg-[#0d0d0d] p-5", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-zinc-500" />
          <h3 className="text-sm font-semibold text-white">Channel compatibility</h3>
        </div>
        <span className={cn("text-lg font-bold tabular-nums", scoreColor)}>
          {compatScore}%
        </span>
      </div>

      {/* Score bar */}
      <div className="h-1.5 rounded-full bg-white/6 mb-4 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${compatScore}%` }}
        />
      </div>

      {/* Summary line */}
      <p className="text-xs text-zinc-500 mb-4">
        {requiredMet} of {requiredTotal} required channel{requiredTotal !== 1 ? "s" : ""} present
        {optionalTotal > 0 && ` · ${optionalMet}/${optionalTotal} optional`}
      </p>

      {/* Channel table */}
      <div className="space-y-1.5">
        {channelRows.map((row) => {
          const icon = row.satisfied ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
          ) : row.required ? (
            <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
          );

          return (
            <div
              key={row.label}
              className={cn(
                "flex items-center gap-2 rounded-md px-2.5 py-1.5",
                row.required && !row.satisfied
                  ? "bg-red-500/5 border border-red-500/15"
                  : "bg-white/3"
              )}
            >
              {icon}
              <span
                className={cn(
                  "text-xs flex-1",
                  row.satisfied
                    ? "text-zinc-300"
                    : row.required
                    ? "text-red-300"
                    : "text-zinc-600"
                )}
              >
                {row.label}
              </span>
              <span
                className={cn(
                  "text-[10px] font-medium",
                  row.required ? "text-zinc-600" : "text-zinc-700"
                )}
              >
                {row.required ? "required" : "optional"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {warnings.map((w) => (
            <div
              key={w}
              className="flex items-start gap-2 rounded-md border border-amber-500/15 bg-amber-500/5 px-2.5 py-2"
            >
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-300/80 leading-relaxed">{w}</p>
            </div>
          ))}
        </div>
      )}

      {/* Overall status */}
      {fullyCompatible ? (
        <p className="mt-4 text-[11px] text-green-400/80 border-t border-white/5 pt-3">
          All required channels are present — log is compatible with this template.
        </p>
      ) : (
        <p className="mt-4 text-[11px] text-red-400/80 border-t border-white/5 pt-3">
          {requiredTotal - requiredMet} required channel{requiredTotal - requiredMet !== 1 ? "s are" : " is"} missing.
          Validation will fail the channel check.
        </p>
      )}
    </div>
  );
}
