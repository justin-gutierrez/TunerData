import { Radio, CheckCircle2 } from "lucide-react";
import type { ValidationResult } from "@/lib/schema/validation-result";

interface Props {
  result: ValidationResult;
}

export function MissingChannelsCard({ result }: Props) {
  const { missingChannels, parsedLog } = result;
  const mappedCount = parsedLog.columnMappings.filter(
    (m) => m.status !== "unmapped"
  ).length;
  const totalCount = parsedLog.columnMappings.length;
  const unmappedCount = totalCount - mappedCount;

  if (missingChannels.length === 0) {
    return (
      <div className="rounded-xl border border-white/6 bg-[#111111] p-5">
        <div className="flex items-center gap-2 mb-3">
          <Radio className="h-4 w-4 text-red-400" />
          <h2 className="text-sm font-semibold text-white">Required Channels</h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-green-400 mb-3">
          <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
          All required channels present
        </div>
        <div className="space-y-1.5 text-xs text-zinc-600">
          <div className="flex justify-between">
            <span>Columns in file</span>
            <span className="text-zinc-400">{totalCount}</span>
          </div>
          <div className="flex justify-between">
            <span>Mapped to schema</span>
            <span className="text-zinc-400">{mappedCount}</span>
          </div>
          {unmappedCount > 0 && (
            <div className="flex justify-between">
              <span>Unrecognised</span>
              <span className="text-zinc-500">{unmappedCount}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Radio className="h-4 w-4 text-red-400" />
        <h2 className="text-sm font-semibold text-red-300">Missing Required Channels</h2>
      </div>
      <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
        The following required channel groups could not be found in the log. At least one
        field from each group must be present for validation to pass.
      </p>
      <div className="space-y-2">
        {missingChannels.map((ch) => (
          <div
            key={ch}
            className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2"
          >
            <div className="h-1.5 w-1.5 rounded-full bg-red-500 flex-shrink-0" />
            <span className="text-xs font-mono text-red-300">{ch}</span>
          </div>
        ))}
      </div>

      {parsedLog.warnings.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-700 mb-2">
            Parse warnings
          </p>
          {parsedLog.warnings.slice(0, 3).map((w, i) => (
            <p key={i} className="text-[10px] text-zinc-600 font-mono leading-relaxed">
              {w}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
