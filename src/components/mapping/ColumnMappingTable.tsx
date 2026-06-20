import { CheckCircle, AlertTriangle, XCircle, ArrowRight } from "lucide-react";
import type { ColumnMapping } from "@/lib/schema/normalized-log";
import { cn } from "@/lib/utils";

interface ColumnMappingTableProps {
  mappings: ColumnMapping[];
  className?: string;
}

/** Human-friendly label for a normalizedField key */
function fieldLabel(field: string | null): string {
  if (!field) return "—";
  const labels: Record<string, string> = {
    timeSec: "timeSec",
    rpm: "rpm",
    speedMph: "speedMph",
    gear: "gear",
    throttlePct: "throttlePct",
    acceleratorPct: "acceleratorPct",
    afr: "afr",
    lambda: "lambda",
    boostPsi: "boostPsi",
    mapKpa: "mapKpa",
    ignitionTimingDeg: "ignitionTimingDeg",
    knockRetardDeg: "knockRetardDeg",
    iatF: "iatF",
    coolantTempF: "coolantTempF",
    fuelPressurePsi: "fuelPressurePsi",
  };
  // Handle nested fields like "timingCorrectionCylinders.cyl1"
  if (field.startsWith("timingCorrectionCylinders.")) {
    const cyl = field.split(".")[1];
    return `timingCorr.${cyl}`;
  }
  return labels[field] ?? field;
}

function StatusIcon({ status }: { status: ColumnMapping["status"] }) {
  if (status === "mapped") {
    return <CheckCircle className="h-3.5 w-3.5 text-green-400" />;
  }
  if (status === "warning") {
    return <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />;
  }
  return <XCircle className="h-3.5 w-3.5 text-zinc-600" />;
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color =
    confidence >= 0.9
      ? "bg-green-500"
      : confidence >= 0.75
      ? "bg-green-400/70"
      : confidence >= 0.5
      ? "bg-amber-500"
      : "bg-zinc-700";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-white/5 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-zinc-500 w-8 text-right">{pct}%</span>
    </div>
  );
}

export function ColumnMappingTable({ mappings, className }: ColumnMappingTableProps) {
  const mappedCount = mappings.filter((m) => m.status === "mapped").length;
  const warnCount = mappings.filter((m) => m.status === "warning").length;
  const unmappedCount = mappings.filter((m) => m.status === "unmapped").length;

  return (
    <div className={cn("rounded-xl border border-white/6 bg-[#111111] overflow-hidden", className)}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/6 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Schema Conversion</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Raw CSV columns mapped to the unified telemetry schema
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs flex-shrink-0">
          <span className="flex items-center gap-1 text-green-400">
            <CheckCircle className="h-3 w-3" />
            {mappedCount} mapped
          </span>
          {warnCount > 0 && (
            <span className="flex items-center gap-1 text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              {warnCount} warn
            </span>
          )}
          {unmappedCount > 0 && (
            <span className="flex items-center gap-1 text-zinc-500">
              <XCircle className="h-3 w-3" />
              {unmappedCount} unmapped
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/4">
              <th className="px-4 py-2.5 text-left font-medium text-zinc-500 w-5">&nbsp;</th>
              <th className="px-4 py-2.5 text-left font-medium text-zinc-500">Raw Column</th>
              <th className="px-4 py-2.5 text-left font-medium text-zinc-500 w-4">&nbsp;</th>
              <th className="px-4 py-2.5 text-left font-medium text-zinc-500">Unified Field</th>
              <th className="px-4 py-2.5 text-left font-medium text-zinc-500">Unit</th>
              <th className="px-4 py-2.5 text-left font-medium text-zinc-500">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/3">
            {mappings.map((m, i) => (
              <tr
                key={i}
                className={cn(
                  "hover:bg-white/2 transition-colors",
                  m.status === "unmapped" && "opacity-50"
                )}
              >
                <td className="px-4 py-2.5">
                  <StatusIcon status={m.status} />
                </td>
                <td className="px-4 py-2.5">
                  <span className="font-mono text-zinc-300">{m.rawColumn}</span>
                </td>
                <td className="px-4 py-2.5 text-zinc-600">
                  {m.normalizedField ? (
                    <ArrowRight className="h-3 w-3" />
                  ) : (
                    <span className="text-zinc-700">✕</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={cn(
                      "font-mono",
                      m.status === "mapped"
                        ? "text-red-400"
                        : m.status === "warning"
                        ? "text-amber-400"
                        : "text-zinc-600"
                    )}
                  >
                    {fieldLabel(m.normalizedField)}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span className="text-zinc-400 font-mono">
                    {m.detectedUnit ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  {m.confidence > 0 ? (
                    <ConfidenceBar confidence={m.confidence} />
                  ) : (
                    <span className="text-zinc-700">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
