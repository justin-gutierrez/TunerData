import { CheckCircle2, XCircle, AlertTriangle, Gauge, Clock, Zap } from "lucide-react";
import type { ValidationResult } from "@/lib/schema/validation-result";
import { cn } from "@/lib/utils";

interface Props {
  result: ValidationResult;
}

function ScoreRing({ score, outcome }: { score: number; outcome: string }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const stroke =
    outcome === "pass" ? "#22c55e" : outcome === "warn" ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative flex items-center justify-center">
      <svg width="96" height="96" className="-rotate-90">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#1f1f1f" strokeWidth="8" />
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="8"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-bold text-white leading-none">{score}</div>
        <div className="text-[10px] text-zinc-500 leading-none mt-0.5">/ 100</div>
      </div>
    </div>
  );
}

export function ValidationSummaryCard({ result }: Props) {
  const { outcome, score, mainReason, templateName, extractedMetrics, pullWindow } = result;

  const isPass = outcome === "pass";
  const isWarn = outcome === "warn";
  const isFail = outcome === "fail";

  const statusConfig = {
    pass: {
      icon: CheckCircle2,
      label: "PASS",
      ring: "border-green-500/30 bg-green-500/5",
      badge: "bg-green-500/15 border-green-500/30 text-green-400",
      text: "text-green-400",
    },
    warn: {
      icon: AlertTriangle,
      label: "WARNING",
      ring: "border-amber-500/30 bg-amber-500/5",
      badge: "bg-amber-500/15 border-amber-500/30 text-amber-400",
      text: "text-amber-400",
    },
    fail: {
      icon: XCircle,
      label: "FAIL",
      ring: "border-red-500/30 bg-red-500/5",
      badge: "bg-red-500/15 border-red-500/30 text-red-400",
      text: "text-red-400",
    },
  }[outcome];

  const Icon = statusConfig.icon;

  const metrics = [
    {
      label: "Duration",
      value: pullWindow ? `${pullWindow.duration.toFixed(1)} s` : "—",
      icon: Clock,
    },
    {
      label: "Peak RPM",
      value: pullWindow ? `${Math.round(pullWindow.peakRpm).toLocaleString()}` : "—",
      icon: Gauge,
    },
    {
      label: "Start speed",
      value: extractedMetrics?.startSpeedMph
        ? `${extractedMetrics.startSpeedMph.toFixed(1)} mph`
        : "—",
      icon: Zap,
    },
    {
      label: "Max boost",
      value: pullWindow?.maxBoostPsi !== undefined
        ? `${pullWindow.maxBoostPsi.toFixed(1)} psi`
        : "—",
      icon: Zap,
    },
    {
      label: "Min AFR",
      value:
        pullWindow?.minAfr !== undefined
          ? pullWindow.minAfr.toFixed(2)
          : pullWindow?.minLambda !== undefined
          ? `λ ${pullWindow.minLambda.toFixed(3)}`
          : "—",
      icon: Zap,
    },
    {
      label: "Avg throttle",
      value: extractedMetrics?.avgThrottlePct !== undefined
        ? `${extractedMetrics.avgThrottlePct.toFixed(1)}%`
        : "—",
      icon: Zap,
    },
  ];

  return (
    <div
      className={cn(
        "rounded-xl border p-6",
        statusConfig.ring
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-6">
        {/* Score ring */}
        <div className="flex-shrink-0">
          <ScoreRing score={score} outcome={outcome} />
        </div>

        {/* Main status */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-bold",
                statusConfig.badge
              )}
            >
              <Icon className="h-4 w-4" />
              {statusConfig.label}
            </span>
            <span className="text-xs text-zinc-600 truncate">{templateName}</span>
          </div>

          {mainReason ? (
            <p className={cn("text-sm font-medium mb-1", statusConfig.text)}>
              {mainReason}
            </p>
          ) : isPass ? (
            <p className="text-sm font-medium text-green-400 mb-1">
              All validation checks passed.
            </p>
          ) : null}

          <p className="text-xs text-zinc-500">
            {isPass && "This log meets all requirements for the selected template."}
            {isWarn && "Log is usable but has minor quality issues."}
            {isFail && `Score ${score}/100 — redo required before submission.`}
          </p>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="mt-6 grid grid-cols-3 sm:grid-cols-6 gap-3 border-t border-white/6 pt-5">
        {metrics.map((m) => (
          <div key={m.label} className="text-center">
            <div className="text-base font-bold text-white truncate">{m.value}</div>
            <div className="text-[10px] text-zinc-600 mt-0.5 truncate">{m.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
