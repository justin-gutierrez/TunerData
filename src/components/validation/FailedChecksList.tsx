import { XCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { CheckResult, ValidationResult } from "@/lib/schema/validation-result";
import { cn } from "@/lib/utils";

interface Props {
  result: ValidationResult;
}

function CheckRow({ check, variant }: { check: CheckResult; variant: "fail" | "warn" }) {
  const isFail = variant === "fail";
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3",
        isFail
          ? "border-red-500/15 bg-red-500/5"
          : "border-amber-500/15 bg-amber-500/5"
      )}
    >
      <div className="flex-shrink-0 mt-0.5">
        {isFail ? (
          <XCircle className="h-4 w-4 text-red-400" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-amber-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            "text-xs font-semibold mb-0.5",
            isFail ? "text-red-300" : "text-amber-300"
          )}
        >
          {check.name}
        </div>
        {check.detail && (
          <p className="text-xs text-zinc-500 leading-relaxed">{check.detail}</p>
        )}
        {(check.value !== undefined || check.threshold !== undefined) && (
          <div className="flex gap-3 mt-1.5 text-[10px] text-zinc-600">
            {check.value !== undefined && (
              <span>
                Got:{" "}
                <span className={isFail ? "text-red-400" : "text-amber-400"}>
                  {check.value}
                </span>
              </span>
            )}
            {check.threshold !== undefined && (
              <span>
                Required:{" "}
                <span className="text-zinc-400">{check.threshold}</span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function FailedChecksList({ result }: Props) {
  const { checks } = result;
  const hasFailed = checks.failed.length > 0;
  const hasWarned = checks.warnings.length > 0;

  if (!hasFailed && !hasWarned) {
    return (
      <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-5">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="h-4 w-4 text-green-400" />
          <h2 className="text-sm font-semibold text-green-400">All Checks Passed</h2>
        </div>
        <p className="text-xs text-zinc-500">
          Every validation check returned a passing result. The log meets all template
          requirements.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {checks.passed.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-1.5 text-xs text-zinc-600"
            >
              <CheckCircle2 className="h-3 w-3 text-green-500/60 flex-shrink-0" />
              <span className="truncate">{c.name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/6 bg-[#111111] p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">Check Results</h2>
        <div className="flex items-center gap-2 text-xs">
          {hasFailed && (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-500/25 bg-red-500/10 px-2 py-0.5 text-red-400">
              <XCircle className="h-3 w-3" />
              {checks.failed.length} failed
            </span>
          )}
          {hasWarned && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              {checks.warnings.length} warned
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full border border-green-500/25 bg-green-500/10 px-2 py-0.5 text-green-400">
            <CheckCircle2 className="h-3 w-3" />
            {checks.passed.length} passed
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {checks.failed.map((c) => (
          <CheckRow key={c.id} check={c} variant="fail" />
        ))}
        {checks.warnings.map((c) => (
          <CheckRow key={c.id} check={c} variant="warn" />
        ))}
      </div>

      {/* Passed checks (collapsed into a compact list) */}
      {checks.passed.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-700 mb-2">
            Passed
          </p>
          <div className="flex flex-wrap gap-1.5">
            {checks.passed.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 rounded-full border border-green-500/10 bg-green-500/5 px-2 py-0.5 text-[10px] text-green-500/70"
              >
                <CheckCircle2 className="h-2.5 w-2.5" />
                {c.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
