import Link from "next/link";
import {
  Activity,
  ChevronRight,
  FileSearch,
  CheckCircle,
  BarChart2,
  Zap,
  Shield,
  Layers,
  Gauge,
  ArrowRight,
  Terminal,
  AlertTriangle,
} from "lucide-react";

/* ─── Hero terminal preview ─────────────────────────────── */
const terminalLines = [
  { prefix: "$", text: 'tunerdata validate pull_log_0619.csv --template "40-roll-4th"', color: "text-zinc-300" },
  { prefix: "", text: "", color: "" },
  { prefix: "✓", text: "Parsing CSV                 … 1,247 rows detected", color: "text-green-400" },
  { prefix: "✓", text: "Detecting source format      … COBB-like", color: "text-green-400" },
  { prefix: "✓", text: "Mapping columns              … 9 / 9 matched", color: "text-green-400" },
  { prefix: "✓", text: "Normalizing units            … mph · psi · °F · %", color: "text-green-400" },
  { prefix: "✓", text: "Finding pull window          … 4.2 s → 10.1 s", color: "text-green-400" },
  { prefix: "✓", text: "Checking tuner rules         … all conditions met", color: "text-green-400" },
  { prefix: "✓", text: "Generating report            … done", color: "text-green-400" },
  { prefix: "", text: "", color: "" },
  { prefix: "RESULT:", text: "PASS   Score: 94 / 100", color: "text-green-300 font-bold" },
  { prefix: "Pull:", text: "4th gear · 2,340 → 6,510 RPM · 5.9 s duration", color: "text-red-300" },
];

/* ─── How it works steps ─────────────────────────────────── */
const steps = [
  {
    number: "01",
    title: "Select or Upload",
    description: "Choose from 10 preconfigured demo logs or drop in your own CSV export from any supported tuning platform.",
  },
  {
    number: "02",
    title: "Format Detection",
    description: "TunerData automatically identifies COBB, MHD/BMW, HPTuners, ECUTek, or generic CSV column structures.",
  },
  {
    number: "03",
    title: "Schema Conversion",
    description: "Raw column names are mapped to the unified telemetry schema and units are normalized to standard values.",
  },
  {
    number: "04",
    title: "Pull Window Detection",
    description: "The WOT segment is located using throttle continuity, RPM trend, speed trajectory, and minimum duration.",
  },
  {
    number: "05",
    title: "Rule Validation",
    description: "The detected pull is checked against every requirement in the active tuner template — gear, RPM, throttle, timing.",
  },
  {
    number: "06",
    title: "Compliance Report",
    description: "A detailed pass/fail report is generated with charts, gauge replay, failure markers, and customer redo instructions.",
  },
];

/* ─── Feature cards ──────────────────────────────────────── */
const features = [
  {
    icon: Layers,
    title: "Multi-Format CSV Ingestion",
    description:
      "Reads COBB Accessport, MHD/BMW, HPTuners, ECUTek, and plain generic CSV exports. Different column names, same result.",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
  },
  {
    icon: FileSearch,
    title: "Unified Telemetry Schema",
    description:
      "All logs are mapped into a single NormalizedLogRow format covering RPM, speed, throttle, AFR, boost, timing, and more.",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
  },
  {
    icon: Zap,
    title: "Pull Window Detection",
    description:
      "Automatically locates the full-throttle WOT segment using throttle level, RPM sweep direction, speed trend, and duration.",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
  },
  {
    icon: Shield,
    title: "Rule-Based Validation",
    description:
      "Enforces tuner-defined templates: required channels, start speed, gear, RPM range, throttle continuity, and sample rate.",
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
  },
  {
    icon: BarChart2,
    title: "Interactive Charts & Gauges",
    description:
      "Visualize the pull with highlighted windows, failure markers, and a live gauge cluster replay with scrubber controls.",
    color: "text-red-300",
    bg: "bg-red-500/8",
    border: "border-red-500/15",
  },
  {
    icon: CheckCircle,
    title: "Compliance Reports",
    description:
      "Clear pass/fail result with a 0–100 score, per-check breakdown, missing channel list, tuner summary, and customer notes.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
];

/* ─── Stats bar ──────────────────────────────────────────── */
const stats = [
  { value: "10", label: "Demo logs" },
  { value: "3+", label: "CSV formats" },
  { value: "1", label: "Unified schema" },
  { value: "100%", label: "Client-side" },
];

/* ─── Component ──────────────────────────────────────────── */
export default function HomePage() {
  return (
    <div className="flex flex-col bg-[#0a0a0a]">
      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-grid">
        {/* Gradient blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-48 left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-red-600/6 blur-3xl" />
          <div className="absolute top-1/3 -right-32 h-[400px] w-[400px] rounded-full bg-rose-600/5 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 pb-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: copy */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-red-500/25 bg-red-500/8 px-3 py-1 mb-6">
                <Activity className="h-3.5 w-3.5 text-red-400" />
                <span className="text-xs font-semibold text-red-400 uppercase tracking-widest">
                  Automotive Telemetry QA
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.1] mb-6">
                Validate Datalogs.{" "}
                <span className="bg-gradient-to-r from-red-400 to-rose-400 bg-clip-text text-transparent">
                  Enforce Tuner Standards.
                </span>
              </h1>

              <p className="text-lg text-zinc-400 leading-relaxed mb-8 max-w-xl">
                TunerData ingests CSV datalogs from any tuning platform, converts them
                into a unified telemetry schema, detects the WOT pull window, and
                validates every requirement in your tuner&apos;s template — all in the browser,
                no upload required.
              </p>

              {/* CTA buttons */}
              <div className="flex flex-wrap gap-4 mb-10">
                <Link
                  href="/demo"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-500 transition-colors shadow-lg shadow-red-900/40 text-sm"
                >
                  Open Demo
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/upload"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-500 transition-colors shadow-lg shadow-red-900/40 text-sm"
                >
                  Upload Your Run!
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/metrics"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-white/10 text-zinc-300 font-semibold hover:bg-white/5 hover:text-white transition-colors text-sm"
                >
                  View Metrics
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>

            </div>

            {/* Right: terminal preview */}
            <div className="relative">
              <div className="rounded-xl border border-white/8 bg-[#111111] overflow-hidden shadow-2xl shadow-black/60">
                {/* Terminal title bar */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/6 bg-white/3">
                  <div className="h-3 w-3 rounded-full bg-red-500/80" />
                  <div className="h-3 w-3 rounded-full bg-amber-500/70" />
                  <div className="h-3 w-3 rounded-full bg-green-500/70" />
                  <div className="flex items-center gap-1.5 ml-3">
                    <Terminal className="h-3.5 w-3.5 text-zinc-600" />
                    <span className="text-xs text-zinc-600 font-mono">tunerdata — validation</span>
                  </div>
                </div>
                {/* Terminal content */}
                <div className="px-5 py-5 font-mono text-sm space-y-0.5">
                  {terminalLines.map((line, i) => (
                    <div key={i} className="flex gap-3">
                      <span className={
                        line.prefix === "✓" ? "text-green-400" :
                        line.prefix === "$" ? "text-red-400" :
                        line.prefix === "RESULT:" ? "text-green-300 font-bold" :
                        line.prefix === "Pull:" ? "text-red-300" :
                        "text-zinc-700"
                      }>
                        {line.prefix || ""}
                      </span>
                      <span className={line.color || "text-zinc-500"}>{line.text}</span>
                    </div>
                  ))}
                  <div className="flex gap-3 mt-1">
                    <span className="text-red-400">$</span>
                    <span className="text-zinc-500 inline-flex items-center">
                      <span className="animate-pulse text-red-400">█</span>
                    </span>
                  </div>
                </div>
              </div>
              {/* Decorative glow */}
              <div className="absolute -inset-4 rounded-2xl bg-red-600/4 blur-2xl -z-10" />
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────── */}
      <section className="border-t border-white/5 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-red-400 mb-2">
              The Validation Pipeline
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              How TunerData Works
            </h2>
            <p className="mt-4 text-zinc-400 max-w-xl mx-auto leading-relaxed">
              From raw CSV to compliance report in seconds. Every step is transparent
              — you can inspect the schema conversion, pull detection logic, and
              per-check results.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {steps.map((step) => (
              <div
                key={step.number}
                className="relative rounded-xl border border-white/6 bg-[#111111] p-6 hover:border-red-500/20 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 font-mono text-3xl font-black text-white/10 select-none leading-none mt-0.5">
                    {step.number}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-2">{step.title}</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">{step.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────── */}
      <section className="border-t border-white/5 py-20 bg-[#0d0d0d]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-red-400 mb-2">
              Capabilities
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Built for Remote Tuning Workflows
            </h2>
            <p className="mt-4 text-zinc-400 max-w-xl mx-auto leading-relaxed">
              Every feature is designed around the real pain of reviewing datalogs
              from customers — different platforms, inconsistent formats, and no
              standard way to know if the pull was done correctly.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className={`rounded-xl border ${f.border} bg-[#111111] p-6 hover:bg-[#151515] transition-colors group`}
                >
                  <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${f.bg} border ${f.border} mb-4 group-hover:scale-105 transition-transform`}>
                    <Icon className={`h-5 w-5 ${f.color}`} />
                  </div>
                  <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{f.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ────────────────────────────────────── */}
      <section className="border-t border-white/5 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-950/30 via-[#111111] to-[#111111] overflow-hidden p-10 text-center">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-x-0 -top-20 h-[300px] bg-red-600/5 blur-3xl" />
            </div>

            <div className="relative">
              <div className="inline-flex items-center gap-2 mb-4">
                <Gauge className="h-5 w-5 text-red-400" />
                <span className="text-red-400 font-semibold text-sm">Try the Interactive Demo</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                See TunerData in Action
              </h2>
              <p className="text-zinc-400 max-w-lg mx-auto mb-8 leading-relaxed">
                Select a preconfigured demo log — a good pull, an early-lift failure, wrong gear,
                missing channels, and more. Run validation and explore the full results dashboard.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/demo"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-red-600 text-white font-bold text-lg hover:bg-red-500 transition-colors shadow-xl shadow-red-900/40"
                >
                  Open Demo
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <Link
                  href="/upload"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-red-600 text-white font-bold text-lg hover:bg-red-500 transition-colors shadow-xl shadow-red-900/40"
                >
                  Upload Your Run!
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── About / What it's not ─────────────────────────── */}
      <section className="border-t border-white/5 py-16 bg-[#0d0d0d]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-10 items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-red-400 mb-2">
                What TunerData Is
              </p>
              <h2 className="text-2xl font-bold text-white mb-4">
                A Datalog QA Tool
              </h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                TunerData validates whether a customer correctly followed the pull procedure
                specified by their tuner. It checks format, channel availability, pull
                window characteristics, and rule compliance — then generates a clear report.
              </p>
              <ul className="space-y-2">
                {[
                  "Multi-platform CSV normalization",
                  "Automatic pull window detection",
                  "Tuner rule template validation",
                  "Schema conversion transparency",
                  "Interactive telemetry visualization",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-zinc-300">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-2">
                What TunerData Is Not
              </p>
              <h2 className="text-2xl font-bold text-white mb-4">
                Not a Tuning Tool
              </h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                TunerData does not analyze tune parameters, suggest calibration changes,
                diagnose mechanical issues, or provide tuning advice of any kind.
                It only evaluates whether a datalog meets the procedural requirements
                defined in the validation template.
              </p>
              <ul className="space-y-2">
                {[
                  "No AI tuner — no advice generated",
                  "No fuel/ignition table analysis",
                  "No mechanical diagnostics",
                  "No cloud storage or account required",
                  "No real .hpl or binary format support",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-zinc-400">
                    <AlertTriangle className="h-4 w-4 text-amber-400/70 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
