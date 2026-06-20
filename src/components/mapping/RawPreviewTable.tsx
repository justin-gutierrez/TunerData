import type { NormalizedLogRow } from "@/lib/schema/normalized-log";
import { cn } from "@/lib/utils";

interface RawPreviewTableProps {
  rows: NormalizedLogRow[];
  /** Maximum number of rows to display (default 6) */
  limit?: number;
  className?: string;
}

const PREVIEW_FIELDS: Array<{ key: keyof NormalizedLogRow; label: string; decimals: number }> = [
  { key: "timeSec", label: "time (s)", decimals: 1 },
  { key: "rpm", label: "RPM", decimals: 0 },
  { key: "speedMph", label: "speed (mph)", decimals: 1 },
  { key: "gear", label: "gear", decimals: 0 },
  { key: "throttlePct", label: "throttle (%)", decimals: 1 },
  { key: "acceleratorPct", label: "pedal (%)", decimals: 1 },
  { key: "afr", label: "AFR", decimals: 2 },
  { key: "lambda", label: "λ", decimals: 3 },
  { key: "boostPsi", label: "boost (psi)", decimals: 1 },
  { key: "ignitionTimingDeg", label: "timing (°)", decimals: 1 },
  { key: "knockRetardDeg", label: "knock (°)", decimals: 2 },
];

function fmt(value: unknown, decimals: number): string {
  if (value === undefined || value === null) return "—";
  const num = Number(value);
  if (!isFinite(num)) return "—";
  return num.toFixed(decimals);
}

export function RawPreviewTable({ rows, limit = 6, className }: RawPreviewTableProps) {
  const displayRows = rows.slice(0, limit);

  // Only show columns that have at least one value in the displayed rows
  const activeFields = PREVIEW_FIELDS.filter((f) =>
    displayRows.some((r) => r[f.key] !== undefined)
  );

  if (displayRows.length === 0) {
    return (
      <div className={cn("rounded-xl border border-white/6 bg-[#111111] p-6 text-center text-zinc-600 text-sm", className)}>
        No rows to preview.
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-white/6 bg-[#111111] overflow-hidden", className)}>
      <div className="px-5 py-4 border-b border-white/6">
        <h3 className="text-sm font-semibold text-white">Normalized Row Preview</h3>
        <p className="text-xs text-zinc-500 mt-0.5">
          First {displayRows.length} of {rows.length} rows — units already normalized
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/4">
              {activeFields.map((f) => (
                <th key={f.key} className="px-3 py-2.5 text-left font-medium text-zinc-500 whitespace-nowrap">
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/3">
            {displayRows.map((row, i) => (
              <tr key={i} className="hover:bg-white/2 transition-colors">
                {activeFields.map((f) => (
                  <td key={f.key} className="px-3 py-2.5 font-mono text-zinc-300 whitespace-nowrap">
                    {fmt(row[f.key], f.decimals)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > limit && (
        <div className="px-5 py-3 border-t border-white/4 text-xs text-zinc-600">
          … {rows.length - limit} more rows not shown
        </div>
      )}
    </div>
  );
}
