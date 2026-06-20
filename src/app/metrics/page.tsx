/**
 * /metrics — Validation Dashboard
 *
 * Section 1: Global Live Metrics — fetched from Upstash Redis via getSummary().
 * Section 2: Synthetic Demo Evaluation — computed live by evaluateDemoSet().
 *
 * Both sections run on the server at request time.
 */

import {
  BarChart2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Database,
  Target,
  Scissors,
  ShieldCheck,
  ShieldX,
  Layers,
  Info,
  Globe,
  Activity,
  Clock,
  FileText,
  Cpu,
  WifiOff,
} from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import {
  evaluateDemoSet,
  formatFailureType,
  type DemoEvalCase,
} from "@/lib/metrics/evaluateDemoSet";
import { getSummary } from "@/lib/metrics/metricsServer";
import type { ValidationOutcome } from "@/lib/schema/validation-result";
import type { DemoLogExpectedOutcome, DemoLogStyle } from "@/lib/demo-data/demoLogs";
import type { MetricsSummary, SanitizedRecentMetricEvent } from "@/lib/metrics/metricsTypes";

export const metadata = {
  title: "Metrics — TunerData",
  description: "Synthetic evaluation metrics for the TunerData validation engine.",
};

// ─── Shared badge helpers ─────────────────────────────────────────────────────

function OutcomeBadge({
  outcome,
  size = "sm",
}: {
  outcome: ValidationOutcome | DemoLogExpectedOutcome | "warning";
  size?: "sm" | "xs";
}) {
  const base =
    size === "sm"
      ? "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold border"
      : "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold border";

  if (outcome === "pass") {
    return (
      <span className={`${base} bg-green-500/10 border-green-500/25 text-green-400`}>
        <CheckCircle className="h-3 w-3" /> PASS
      </span>
    );
  }
  if (outcome === "warn" || outcome === "warning") {
    return (
      <span className={`${base} bg-amber-500/10 border-amber-500/25 text-amber-400`}>
        <AlertTriangle className="h-3 w-3" /> WARN
      </span>
    );
  }
  return (
    <span className={`${base} bg-red-500/10 border-red-500/25 text-red-400`}>
      <XCircle className="h-3 w-3" /> FAIL
    </span>
  );
}

// ─── ── SECTION 1 COMPONENTS ── ───────────────────────────────────────────────

function LiveStatCard({
  label,
  value,
  sub,
  icon: Icon,
  colorClass,
  bgClass,
  borderClass,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}) {
  return (
    <div className={`rounded-xl border ${borderClass} bg-[#111111] p-5`}>
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${bgClass} border ${borderClass} mb-3`}>
        <Icon className={`h-5 w-5 ${colorClass}`} />
      </div>
      <div className={`text-3xl font-black ${colorClass} mb-0.5 tabular-nums`}>
        {value}
      </div>
      <div className="text-sm text-zinc-400">{label}</div>
      {sub && <div className="text-xs text-zinc-600 mt-0.5">{sub}</div>}
    </div>
  );
}

function ProgressBar({
  label,
  value,
  max,
  colorClass = "bg-red-500/55",
}: {
  label: string;
  value: number;
  max: number;
  colorClass?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-zinc-300 truncate max-w-[70%]">{label}</span>
        <span className="font-mono text-zinc-500 tabular-nums ml-2">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function RecentEventRow({ ev }: { ev: SanitizedRecentMetricEvent }) {
  const date = new Date(ev.createdAt);
  const timeStr = isNaN(date.getTime()) ? "—" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <tr className="border-b border-white/4 hover:bg-white/[0.015] transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
            ev.source === "upload"
              ? "bg-blue-500/10 border-blue-500/25 text-blue-400"
              : "bg-zinc-500/10 border-zinc-600/25 text-zinc-400"
          }`}>
            {ev.source}
          </span>
          <span className="text-xs text-zinc-400 truncate max-w-[120px]">{ev.templateName}</span>
        </div>
      </td>
      <td className="px-3 py-3 text-center">
        <OutcomeBadge outcome={ev.status} size="xs" />
      </td>
      <td className="px-3 py-3 text-center font-mono text-xs tabular-nums text-zinc-300">{ev.score}</td>
      <td className="px-3 py-3 text-center text-xs text-zinc-500 font-mono">{ev.rowCount.toLocaleString()}</td>
      <td className="px-3 py-3 text-center text-xs text-zinc-600">{timeStr}</td>
    </tr>
  );
}

function LiveMetricsSection({ s }: { s: MetricsSummary }) {
  const hasData = s.totalRuns > 0;
  const topFailMax = s.topFailureTypes[0]?.count ?? 1;
  const topMissingMax = s.topMissingChannels[0]?.count ?? 1;

  return (
    <div className="mb-16">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="h-8 w-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
          <Globe className="h-4 w-4 text-green-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Global Live Metrics</h2>
          <p className="text-xs text-zinc-500">
            Updated automatically when users upload a CSV and run validation
          </p>
        </div>
        {s.lastUpdatedAt && (
          <div className="ml-auto flex items-center gap-1.5 text-xs text-zinc-600">
            <Clock className="h-3 w-3" />
            {new Date(s.lastUpdatedAt).toLocaleString()}
          </div>
        )}
      </div>

      {/* Privacy note */}
      <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-green-500/15 bg-green-500/5 px-4 py-3">
        <ShieldCheck className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
        <p className="text-xs text-zinc-400 leading-relaxed">
          <span className="text-green-400 font-semibold">Global metrics from anonymous validation summaries.</span>{" "}
          Uploaded CSV files and raw datalog rows are never stored.
          Only sanitized aggregate counters (score, row count, format, outcome) are recorded.
        </p>
      </div>

      {/* Warning if Redis not configured */}
      {s.warning && (
        <div className="mb-6 flex items-center gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <WifiOff className="h-4 w-4 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-300">{s.warning}</p>
        </div>
      )}

      {/* No data yet */}
      {!hasData && !s.warning && (
        <div className="rounded-xl border border-dashed border-white/8 bg-[#0d0d0d] flex flex-col items-center justify-center py-16 gap-3 mb-6">
          <Activity className="h-8 w-8 text-zinc-700" />
          <p className="text-zinc-500 font-medium">No validations recorded yet.</p>
          <p className="text-xs text-zinc-700 max-w-xs text-center leading-relaxed">
            Global metrics will appear here after the first CSV upload validation is run.
          </p>
        </div>
      )}

      {hasData && (
        <>
          {/* Count cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <LiveStatCard label="Total validations" value={s.totalRuns}
              icon={Database} colorClass="text-red-400" bgClass="bg-red-500/10" borderClass="border-red-500/20" />
            <LiveStatCard label="Upload validations" value={s.uploadRuns}
              sub={`${s.demoRuns} demo`}
              icon={FileText} colorClass="text-blue-400" bgClass="bg-blue-500/10" borderClass="border-blue-500/20" />
            <LiveStatCard label="Avg validation score" value={`${s.averageScore}/100`}
              icon={TrendingUp} colorClass="text-green-400" bgClass="bg-green-500/10" borderClass="border-green-500/20" />
            <LiveStatCard label="Channel coverage" value={`${s.averageRequiredChannelCoveragePct}%`}
              sub="avg required channels present"
              icon={Cpu} colorClass="text-purple-400" bgClass="bg-purple-500/10" borderClass="border-purple-500/20" />
          </div>

          {/* Pass/warn/fail cards */}
          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            {[
              { label: "Pass", value: s.passCount, pct: s.passRatePct, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20", Icon: CheckCircle },
              { label: "Warning", value: s.warningCount, pct: null, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", Icon: AlertTriangle },
              { label: "Fail", value: s.failCount, pct: null, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", Icon: XCircle },
            ].map(({ label, value, pct, color, bg, border, Icon }) => (
              <div key={label} className={`rounded-xl border ${border} bg-[#111111] p-5 flex items-center gap-4`}>
                <div className={`h-10 w-10 rounded-xl ${bg} border ${border} flex items-center justify-center shrink-0`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  <div className={`text-2xl font-black ${color} tabular-nums`}>{value}</div>
                  <div className="text-xs text-zinc-500">{label}{pct != null ? ` — ${pct}% pass rate` : ""}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Averages row */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Avg rows / log", value: s.averageRows.toLocaleString() },
              { label: "Avg file size", value: s.averageFileSizeBytes > 0 ? `${(s.averageFileSizeBytes / 1024).toFixed(1)} KB` : "—" },
              { label: "Avg sample rate", value: s.averageSampleRateHz != null ? `${s.averageSampleRateHz} Hz` : "—" },
              { label: "Avg irrelevant trim", value: s.averageIrrelevantTrimPct != null ? `${s.averageIrrelevantTrimPct}%` : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-white/6 bg-[#111111] p-4">
                <div className="text-lg font-bold text-white tabular-nums">{value}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {/* Two-column breakdown */}
          <div className="grid lg:grid-cols-2 gap-5 mb-6">
            {/* Top failure types */}
            {s.topFailureTypes.length > 0 && (
              <div className="rounded-xl border border-white/6 bg-[#111111] overflow-hidden">
                <div className="px-5 py-4 border-b border-white/6 flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-400" />
                  <h3 className="text-sm font-semibold text-white">Top Failure Types</h3>
                </div>
                <div className="p-5 space-y-3.5">
                  {s.topFailureTypes.map(({ type, count }) => (
                    <ProgressBar key={type} label={type} value={count} max={topFailMax} />
                  ))}
                </div>
              </div>
            )}

            {/* Top missing channels */}
            {s.topMissingChannels.length > 0 && (
              <div className="rounded-xl border border-white/6 bg-[#111111] overflow-hidden">
                <div className="px-5 py-4 border-b border-white/6 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-white">Most-Missing Channels</h3>
                </div>
                <div className="p-5 space-y-3.5">
                  {s.topMissingChannels.map(({ channel, count }) => (
                    <ProgressBar key={channel} label={channel} value={count} max={topMissingMax} colorClass="bg-amber-500/55" />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Templates + formats */}
          <div className="grid lg:grid-cols-2 gap-5 mb-6">
            {s.topTemplates.length > 0 && (
              <div className="rounded-xl border border-white/6 bg-[#111111] p-5">
                <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono mb-3">Most-used templates</p>
                <div className="space-y-2">
                  {s.topTemplates.map(({ templateId, count }) => (
                    <div key={templateId} className="flex items-center justify-between text-xs">
                      <span className="text-zinc-300 truncate max-w-[75%] font-mono">{templateId}</span>
                      <span className="text-zinc-600 tabular-nums">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {s.topFormats.length > 0 && (
              <div className="rounded-xl border border-white/6 bg-[#111111] p-5">
                <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono mb-3">Detected CSV formats</p>
                <div className="space-y-2">
                  {s.topFormats.map(({ format, count }) => (
                    <div key={format} className="flex items-center justify-between text-xs">
                      <span className="text-zinc-300 font-mono">{format}</span>
                      <span className="text-zinc-600 tabular-nums">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Recent events */}
          {s.recentEvents.length > 0 && (
            <div className="rounded-xl border border-white/6 bg-[#111111] overflow-hidden mb-6">
              <div className="px-5 py-4 border-b border-white/6 flex items-center gap-2">
                <Clock className="h-4 w-4 text-red-400" />
                <h3 className="text-sm font-semibold text-white">Recent Validations</h3>
                <span className="ml-auto text-xs text-zinc-600">Anonymized — last {s.recentEvents.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/4">
                      <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Source / Template</th>
                      <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 text-center">Result</th>
                      <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 text-center">Score</th>
                      <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 text-center">Rows</th>
                      <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 text-center">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.recentEvents.map((ev, i) => (
                      <RecentEventRow key={i} ev={ev} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── SECTION 2: Synthetic evaluation helpers ──────────────────────────────────

function StyleBadge({ style }: { style: DemoLogStyle }) {
  const labels: Record<DemoLogStyle, string> = {
    generic: "Generic",
    cobb_like: "COBB",
    mhd_like: "MHD",
  };
  return (
    <span className="inline-flex rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-400 border border-zinc-700">
      {labels[style]}
    </span>
  );
}

function CorrectIcon({ correct }: { correct: boolean }) {
  return correct ? (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-500/15">
      <CheckCircle className="h-3.5 w-3.5 text-green-400" />
    </span>
  ) : (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500/15">
      <XCircle className="h-3.5 w-3.5 text-red-400" />
    </span>
  );
}

function ScorePill({ score }: { score: number }) {
  const color = score >= 80 ? "text-green-400" : score >= 50 ? "text-amber-400" : "text-red-400";
  return <span className={`font-mono text-xs font-bold tabular-nums ${color}`}>{score}</span>;
}

function CaseRow({ c }: { c: DemoEvalCase }) {
  return (
    <tr className="border-b border-white/4 hover:bg-white/[0.015] transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-start gap-2">
          <StyleBadge style={c.style} />
          <div>
            <p className="text-sm text-zinc-200 leading-snug">{c.name}</p>
            {c.mainFailureType && (
              <p className="text-[10px] text-zinc-600 mt-0.5 leading-none">
                {formatFailureType(c.mainFailureType)}
              </p>
            )}
          </div>
        </div>
      </td>
      <td className="px-3 py-3 text-center"><OutcomeBadge outcome={c.expectedOutcome} size="xs" /></td>
      <td className="px-3 py-3 text-center"><OutcomeBadge outcome={c.actualOutcome} size="xs" /></td>
      <td className="px-3 py-3 text-center"><ScorePill score={c.score} /></td>
      <td className="px-3 py-3 text-center">
        {c.iou !== undefined ? (
          <span className="font-mono text-xs tabular-nums text-zinc-400">{(c.iou * 100).toFixed(0)}%</span>
        ) : (
          <span className="text-xs text-zinc-700">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-center"><CorrectIcon correct={c.correct} /></td>
    </tr>
  );
}

function RateCard({
  label, value, description, icon: Icon, good,
}: {
  label: string; value: string; description: string;
  icon: React.ComponentType<{ className?: string }>; good: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/6 bg-[#111111] p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${good ? "bg-green-500/10 border border-green-500/20" : "bg-amber-500/10 border border-amber-500/20"}`}>
          <Icon className={`h-4 w-4 ${good ? "text-green-400" : "text-amber-400"}`} />
        </div>
        <span className="text-xs text-zinc-500">{label}</span>
      </div>
      <div className={`text-2xl font-black mb-1 ${good ? "text-green-400" : "text-amber-400"}`}>{value}</div>
      <div className="text-xs text-zinc-600 leading-relaxed">{description}</div>
    </div>
  );
}

function FailureBar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-zinc-300">{label}</span>
        <span className="font-mono text-zinc-600 tabular-nums">{count}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full rounded-full bg-red-500/55" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function MetricsPage() {
  // Run both data sources in parallel
  const [liveSummary, syntheticMetrics] = await Promise.all([
    getSummary(),
    Promise.resolve(evaluateDemoSet()),
  ]);

  const detectionPct = Math.round(syntheticMetrics.badLogDetectionRate * 100);
  const falseRejPct  = Math.round(syntheticMetrics.falseRejectionRate  * 100);
  const failureEntries = Object.entries(syntheticMetrics.failureTypeCounts).sort(([, a], [, b]) => b - a);
  const maxFailureCount = failureEntries[0]?.[1] ?? 1;
  const correctCount = syntheticMetrics.cases.filter((c) => c.correct).length;

  return (
    <PageShell>
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 className="h-5 w-5 text-red-400" />
          <p className="text-xs font-semibold uppercase tracking-widest text-red-400">
            Metrics Dashboard
          </p>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
          Validation Metrics
        </h1>
        <p className="text-zinc-400 max-w-2xl leading-relaxed">
          Two data sources: <span className="text-green-400 font-medium">live global metrics</span> from real user
          validations, and <span className="text-amber-400 font-medium">synthetic evaluation</span> from the demo log
          dataset. Both run through the same validation engine.
        </p>
      </div>

      {/* ── SECTION 1: Global Live Metrics ─────────────────────────────── */}
      <LiveMetricsSection s={liveSummary} />

      {/* ── Section divider ─────────────────────────────────────────────── */}
      <div className="relative mb-10">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/6" />
        </div>
        <div className="relative flex justify-center">
          <div className="bg-zinc-950 px-4 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-widest">
              Synthetic Demo Evaluation
            </span>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: Synthetic Evaluation ────────────────────────────── */}

      <div className="mb-6">
        <h2 className="text-xl font-bold text-white mb-2">Synthetic Evaluation Dataset</h2>
        <p className="text-zinc-400 max-w-2xl leading-relaxed text-sm">
          Performance metrics computed live by running all{" "}
          <span className="text-white font-medium">{syntheticMetrics.totalLogs} preconfigured demo logs</span>{" "}
          through the same parse → validate pipeline. No results are hard-coded — refresh the page to recompute.
        </p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-4 py-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span className="text-xs font-semibold text-amber-400">
            Synthetic evaluation dataset — not real-world performance data
          </span>
        </div>
      </div>

      {/* Summary count cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        {[
          { label: "Logs evaluated",  value: syntheticMetrics.totalLogs, Icon: Database,      color: "text-red-400",   bg: "bg-red-500/10",   border: "border-red-500/20"   },
          { label: "Accepted (pass)", value: syntheticMetrics.passCount,  Icon: CheckCircle,  color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
          { label: "Flagged (fail)",  value: syntheticMetrics.failCount,  Icon: XCircle,      color: "text-red-400",   bg: "bg-red-500/10",   border: "border-red-500/20"   },
          { label: "Warned",          value: syntheticMetrics.warnCount,  Icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
        ].map(({ label, value, Icon, color, bg, border }) => (
          <div key={label} className={`rounded-xl border ${border} bg-[#111111] p-5`}>
            <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${bg} border ${border} mb-3`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div className={`text-4xl font-black ${color} mb-1 tabular-nums`}>{value}</div>
            <div className="text-sm text-zinc-400">{label}</div>
          </div>
        ))}
      </div>

      {/* Rate cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <RateCard
          label="Bad-log detection rate"
          value={`${detectionPct}%`}
          description={`${syntheticMetrics.cases.filter((c) => c.expectedOutcome !== "pass" && c.actualOutcome !== "pass").length} of ${syntheticMetrics.cases.filter((c) => c.expectedOutcome !== "pass").length} non-passing logs correctly flagged`}
          icon={ShieldCheck}
          good={detectionPct === 100}
        />
        <RateCard
          label="False rejection rate"
          value={`${falseRejPct}%`}
          description={`${syntheticMetrics.cases.filter((c) => c.expectedOutcome === "pass" && c.actualOutcome !== "pass").length} of ${syntheticMetrics.cases.filter((c) => c.expectedOutcome === "pass").length} valid logs incorrectly rejected`}
          icon={ShieldX}
          good={falseRejPct === 0}
        />
        <RateCard
          label="Avg pull-window overlap"
          value={syntheticMetrics.avgIoU !== undefined ? `${(syntheticMetrics.avgIoU * 100).toFixed(0)}% IoU` : "—"}
          description={syntheticMetrics.avgIoU !== undefined
            ? `IoU across ${syntheticMetrics.cases.filter((c) => c.iou !== undefined).length} logs`
            : "No pull windows detected"}
          icon={Target}
          good={(syntheticMetrics.avgIoU ?? 0) >= 0.8}
        />
        <RateCard
          label="Avg irrelevant data"
          value={`${syntheticMetrics.avgIrrelevantDataPct.toFixed(1)}%`}
          description="Average percentage of total log rows outside the detected pull window"
          icon={Scissors}
          good={syntheticMetrics.avgIrrelevantDataPct < 70}
        />
      </div>

      {/* Accuracy bar */}
      <div className="rounded-xl border border-white/6 bg-[#111111] p-5 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-red-400" />
          <h3 className="text-sm font-semibold text-white">Overall Accuracy</h3>
          <span className="ml-auto text-xs text-zinc-600">
            {correctCount} / {syntheticMetrics.totalLogs} cases correct
          </span>
        </div>
        <div className="h-3 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-green-600 to-green-400"
            style={{ width: `${(correctCount / syntheticMetrics.totalLogs) * 100}%` }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-xs text-zinc-600">0%</span>
          <span className="text-xs text-green-400 font-bold">
            {Math.round((correctCount / syntheticMetrics.totalLogs) * 100)}% accuracy
          </span>
          <span className="text-xs text-zinc-600">100%</span>
        </div>
      </div>

      {/* Per-log table + failure breakdown */}
      <div className="grid lg:grid-cols-5 gap-6 mb-8">
        <div className="lg:col-span-3 rounded-xl border border-white/6 bg-[#111111] overflow-hidden">
          <div className="px-4 py-4 border-b border-white/6 flex items-center gap-2">
            <Layers className="h-4 w-4 text-red-400" />
            <h3 className="text-sm font-semibold text-white">Per-Log Results</h3>
            <span className="ml-auto text-xs text-zinc-600">Expected vs Actual</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/4">
                  <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Log</th>
                  <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 text-center">Exp.</th>
                  <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 text-center">Got</th>
                  <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 text-center">Score</th>
                  <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 text-center">IoU</th>
                  <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 text-center">✓</th>
                </tr>
              </thead>
              <tbody>
                {syntheticMetrics.cases.map((c) => (
                  <CaseRow key={c.id} c={c} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-xl border border-white/6 bg-[#111111] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/6 flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-400" />
              <h3 className="text-sm font-semibold text-white">Failure Type Breakdown</h3>
            </div>
            <div className="p-5 space-y-4">
              {failureEntries.length === 0 ? (
                <p className="text-xs text-zinc-600">No failures detected.</p>
              ) : (
                failureEntries.map(([label, count]) => (
                  <FailureBar key={label} label={label} count={count} max={maxFailureCount} />
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/6 bg-[#111111] p-5">
            <div className="flex items-center gap-2 mb-2">
              <Info className="h-4 w-4 text-zinc-500" />
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Most common failure</span>
            </div>
            <p className="text-sm font-medium text-white leading-snug">{syntheticMetrics.mostCommonFailureType}</p>
            {failureEntries[0] && (
              <p className="text-xs text-zinc-600 mt-1">
                Appeared {failureEntries[0][1]}×
                {failureEntries[0][1] === 1 ? " — all failure types unique in this synthetic set" : ""}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-white/6 bg-[#0d0d0d] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-2">About pull-window IoU</p>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Intersection-over-Union between the detected pull window and the wide-open-throttle reference window
              (throttle ≥ 88%). A score of 100% means the engine isolated exactly the WOT segment.
            </p>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="rounded-lg border border-white/4 bg-[#0d0d0d] px-5 py-4">
        <p className="text-xs text-zinc-600 text-center">
          For closed-course, dyno, and educational use only. This tool validates
          datalog structure and procedure compliance; it does not provide tuning advice.
        </p>
      </div>
    </PageShell>
  );
}
