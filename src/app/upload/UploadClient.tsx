"use client";

/**
 * UploadClient — interactive body of the /upload page.
 *
 * Layout mirrors /demo:
 *   Left column  — CsvUploader + file info + Run button + sidebar
 *   Right column — DynoLoadingAnimation → tab results → empty state
 *
 * All parsing and validation is 100% client-side.
 * No data ever leaves the browser.
 */

import React, {
  useState,
  useRef,
  useCallback,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Upload,
  FileText,
  Cpu,
  Play,
  Table,
  ShieldCheck,
  Gauge,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";

import { PageShell } from "@/components/layout/PageShell";
import { CsvUploader, type LoadedFile } from "@/components/upload/CsvUploader";
import { ColumnMappingTable } from "@/components/mapping/ColumnMappingTable";
import { RawPreviewTable } from "@/components/mapping/RawPreviewTable";
import { ValidationDashboard } from "@/components/validation/ValidationDashboard";
import { GaugeCluster } from "@/components/replay/GaugeCluster";
import { DynoLoadingAnimation } from "@/components/DynoLoadingAnimation";

import { parseLogFromText, estimateSampleRate } from "@/lib/parser/toNormalizedRows";
import { validateLog } from "@/lib/validation/validateLog";
import { FORTY_ROLL_TEMPLATE } from "@/lib/schema/validation-rules";
import type { ValidationTemplate } from "@/lib/schema/validation-rules";
import { recordValidationMetrics, buildMetricsEvent } from "@/lib/metrics/metricsClient";
import type { ValidationMetricsEvent } from "@/lib/metrics/metricsTypes";
import { FORMAT_LABELS } from "@/lib/parser/detectFormat";
import { TemplateSelector } from "@/components/templates/TemplateSelector";
import { TemplatePreviewCard } from "@/components/templates/TemplatePreviewCard";
import { TemplateCompatibilityCard } from "@/components/templates/TemplateCompatibilityCard";
import type { ParsedLog } from "@/lib/schema/normalized-log";
import type { ValidationResult } from "@/lib/schema/validation-result";
import { cn } from "@/lib/utils";

// ─── Unknown format warning ───────────────────────────────────────────────────

function UnknownFormatWarning({ log }: { log: ParsedLog }) {
  const mappedCount = log.columnMappings.filter((m) => m.status === "mapped").length;
  const isBlank = mappedCount < 2;

  if (log.detectedFormat !== "unknown" && mappedCount >= 2) return null;

  return (
    <div
      className={cn(
        "rounded-lg border flex items-start gap-3 p-4 mb-5",
        isBlank
          ? "border-red-500/25 bg-red-500/5"
          : "border-amber-500/25 bg-amber-500/5",
      )}
    >
      <AlertCircle
        className={cn(
          "h-4 w-4 shrink-0 mt-0.5",
          isBlank ? "text-red-400" : "text-amber-400",
        )}
      />
      <div>
        <p
          className={cn(
            "text-sm font-semibold mb-1",
            isBlank ? "text-red-300" : "text-amber-300",
          )}
        >
          {isBlank ? "Unrecognised format" : "Unknown CSV format — limited mapping"}
        </p>
        <p className="text-xs text-zinc-400 leading-relaxed">
          {isBlank ? (
            <>
              TunerData could not map any columns from this file. Only{" "}
              <strong className="text-zinc-300">{mappedCount}</strong> column(s) were
              recognised. Ensure your CSV has a header row with recognisable column
              names (e.g.{" "}
              <span className="font-mono text-zinc-300">time, rpm, speed, throttle, afr</span>
              ) and is exported as plain text, not a binary format.
            </>
          ) : (
            <>
              The CSV header format was not recognised as COBB, MHD, or Generic.
              Only{" "}
              <strong className="text-zinc-300">{mappedCount}</strong> column(s) could
              be mapped. Validation may be incomplete or fail required-channel checks.
              You can still inspect the mapping table below to see what was detected.
            </>
          )}
        </p>
        <p className="text-xs text-zinc-600 mt-2">
          Tip: try the{" "}
          <a href="/demo" className="text-red-400 hover:underline">
            Demo page
          </a>{" "}
          to see examples of supported column naming conventions.
        </p>
      </div>
    </div>
  );
}

// ─── Parse summary ────────────────────────────────────────────────────────────

function ParseSummary({ log }: { log: ParsedLog }) {
  const sampleRate = estimateSampleRate(log.rows);
  const mappedCount = log.columnMappings.filter((m) => m.status === "mapped").length;
  const totalCount = log.columnMappings.length;
  const formatLabel = FORMAT_LABELS[log.detectedFormat] ?? log.detectedFormat;

  return (
    <div className="space-y-5">
      {/* Unknown-format warning (shown before stats so it's the first thing seen) */}
      <UnknownFormatWarning log={log} />

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Format", value: formatLabel },
          { label: "Rows parsed", value: log.rows.length.toLocaleString() },
          { label: "Sample rate", value: sampleRate > 0 ? `${sampleRate} Hz` : "—" },
          { label: "Mapped", value: `${mappedCount} / ${totalCount}` },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-white/6 bg-[#0d0d0d] px-4 py-3"
          >
            <div className="text-lg font-bold text-white truncate">{s.value}</div>
            <div className="text-xs text-zinc-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Parse warnings */}
      {log.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-1">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold mb-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            {log.warnings.length} Parse Warning
            {log.warnings.length > 1 ? "s" : ""}
          </div>
          {log.warnings.map((w, i) => (
            <p
              key={i}
              className="text-xs text-amber-300/80 font-mono leading-relaxed"
            >
              {w}
            </p>
          ))}
        </div>
      )}

      <ColumnMappingTable mappings={log.columnMappings} />
      <RawPreviewTable rows={log.rows} limit={6} />
    </div>
  );
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

type Tab = "schema" | "validation" | "replay";

const TAB_DEFS: Array<{
  id: Tab;
  label: string;
  icon: React.ElementType;
  needsResult: boolean;
}> = [
  { id: "schema", label: "Schema Mapping", icon: Table, needsResult: false },
  {
    id: "validation",
    label: "Validation Report",
    icon: ShieldCheck,
    needsResult: true,
  },
  { id: "replay", label: "Gauge Replay", icon: Gauge, needsResult: true },
];

function TabBar({
  active,
  hasResult,
  onSelect,
}: {
  active: Tab;
  hasResult: boolean;
  onSelect: (t: Tab) => void;
}) {
  return (
    <div className="flex gap-1 mb-5 border-b border-white/6 pb-1">
      {TAB_DEFS.map(({ id, label, icon: Icon, needsResult }) => {
        const isActive = active === id;
        const disabled = needsResult && !hasResult;
        return (
          <button
            key={id}
            onClick={() => !disabled && onSelect(id)}
            disabled={disabled}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-xs font-medium transition-colors",
              isActive
                ? "bg-red-600/15 border border-red-500/30 border-b-transparent text-red-300"
                : disabled
                  ? "text-zinc-700 cursor-not-allowed"
                  : "text-zinc-500 hover:text-zinc-200 hover:bg-white/4",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {disabled && (
              <span className="text-[9px] text-zinc-700 ml-1">(run first)</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Sidebar info panel ───────────────────────────────────────────────────────

const SUPPORTED_FORMATS = [
  {
    name: "Generic CSV",
    example: "time, rpm, speed_mph, gear, throttle, afr, boost_psi, ignition_timing, knock_retard",
    supported: true,
  },
  {
    name: "COBB Accessport-like",
    example: "Time (sec), RPM, Vehicle Speed (mph), Throttle Pos (%), Boost (psi), AFR, Ign Timing (deg), Feedback Knock (deg)",
    supported: true,
  },
  {
    name: "MHD / BMW-like",
    example: "time, rpm, speed, gear, pedal, boost actual, lambda bank 1, timing cyl 1, timing correction cyl 1",
    supported: true,
  },
  {
    name: "HPTuners .hpl (binary)",
    example: "Binary format — export as CSV from the HPTuners software first.",
    supported: false,
  },
];

function Sidebar() {
  return (
    <div className="space-y-5">
      {/* Supported formats */}
      <div className="rounded-xl border border-white/6 bg-[#111111] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/6 flex items-center gap-2">
          <FileText className="h-4 w-4 text-red-400" />
          <h2 className="text-sm font-semibold text-white">Supported Formats</h2>
        </div>
        <div className="divide-y divide-white/4">
          {SUPPORTED_FORMATS.map((fmt) => (
            <div key={fmt.name} className="px-5 py-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-zinc-200">
                  {fmt.name}
                </span>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                    fmt.supported
                      ? "bg-green-500/10 border-green-500/25 text-green-400"
                      : "bg-white/3 border-white/8 text-zinc-600",
                  )}
                >
                  {fmt.supported ? "Supported" : "Not supported"}
                </span>
              </div>
              <p className="text-xs font-mono text-zinc-600 break-all leading-relaxed">
                {fmt.example}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Privacy / processing info */}
      <div className="rounded-xl border border-white/6 bg-[#111111] p-5">
        <div className="flex items-center gap-2 mb-3">
          <Cpu className="h-4 w-4 text-red-400" />
          <h2 className="text-sm font-semibold text-white">Local Processing</h2>
        </div>
        <p className="text-xs text-zinc-500 leading-relaxed mb-3">
          Your CSV is read and processed entirely in your browser.
          The raw file and datalog rows are never sent to a server.
        </p>
        <ul className="space-y-2 mb-4">
          {[
            "100% client-side — no server upload",
            "No account or login required",
            "File never leaves your device",
            "Works offline after initial page load",
          ].map((item) => (
            <li key={item} className="flex items-center gap-2 text-xs text-zinc-400">
              <div className="h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
        {/* Metrics disclosure */}
        <div className="rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-3 py-2.5">
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            <span className="text-zinc-400 font-semibold">Metrics note:</span>{" "}
            An anonymous validation summary (score, outcome, format, row count) may
            be used to update the public{" "}
            <a href="/metrics" className="text-red-400 hover:underline">metrics dashboard</a>.
            CSV files and raw datalog data are not stored.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

export function UploadClient() {
  const [loadedFile, setLoadedFile]       = useState<LoadedFile | null>(null);
  const [parsedLog, setParsedLog]         = useState<ParsedLog | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isLoading, setIsLoading]         = useState(false);
  const [activeTab, setActiveTab]         = useState<Tab>("schema");
  const [selectedTemplate, setSelectedTemplate] =
    useState<ValidationTemplate>(FORTY_ROLL_TEMPLATE);

  // Refs hold results while the animation plays
  const pendingLogRef       = useRef<ParsedLog | null>(null);
  const pendingResultRef    = useRef<ValidationResult | null>(null);
  const pendingMetricsRef   = useRef<ValidationMetricsEvent | null>(null);

  // ── File ready — auto-parse immediately for template compatibility preview ──

  function handleFileLoaded(file: LoadedFile) {
    setLoadedFile(file);
    setValidationResult(null);
    setActiveTab("schema");
    // Auto-parse so the TemplateCompatibilityCard can show channel coverage
    // before the user clicks "Run Validation."
    try {
      const parsed = parseLogFromText(file.text, file.name);
      setParsedLog(parsed);
    } catch {
      setParsedLog(null);
    }
  }

  function handleClear() {
    setLoadedFile(null);
    setParsedLog(null);
    setValidationResult(null);
    setActiveTab("schema");
    setSelectedTemplate(FORTY_ROLL_TEMPLATE);
  }

  // ── Run validation ─────────────────────────────────────────────────────────

  function handleRun() {
    if (!loadedFile) return;
    setIsLoading(true);
    setParsedLog(null);
    setValidationResult(null);
    pendingLogRef.current     = null;
    pendingResultRef.current  = null;
    pendingMetricsRef.current = null;

    // Snapshot mutable state so the timeout closure has consistent values
    const templateSnapshot = selectedTemplate;
    const fileSnapshot     = loadedFile;

    // Parsing + validation is synchronous JS — do it after a tick so React
    // can paint the loading state first.
    setTimeout(() => {
      try {
        const parsed = parseLogFromText(fileSnapshot.text, fileSnapshot.name);
        const result = validateLog(parsed, templateSnapshot);
        pendingLogRef.current    = parsed;
        pendingResultRef.current = result;

        // Pre-build anonymous metrics event to fire after animation completes
        const requiredChannelCount = templateSnapshot.requiredChannels.length;
        const missingChannelCount  = result.missingChannels.length;
        const totalLogDurationSec  =
          parsed.rows.length > 1
            ? parsed.rows[parsed.rows.length - 1].timeSec - parsed.rows[0].timeSec
            : null;

        pendingMetricsRef.current = buildMetricsEvent({
          source:       "upload",
          templateId:   templateSnapshot.id,
          templateName: templateSnapshot.name,
          mode:         templateSnapshot.mode as "roll_pull" | "wot_pull" | "idle" | "cruise",
          status:       result.outcome === "warn" ? "warning" : result.outcome,
          score:        result.score,
          detectedFormat:         result.parsedLog.detectedFormat,
          rowCount:               result.parsedLog.totalRows,
          fileSizeBytes:          fileSnapshot.sizeBytes,
          sampleRateHz:           result.dataQuality.sampleRateHz || null,
          pullDurationSec:        result.pullWindow?.duration ?? null,
          usefulWindowSec:        result.pullWindow?.duration ?? null,
          totalLogDurationSec,
          irrelevantDataTrimmedPct: result.dataQuality.irrelevantDataPct || null,
          requiredChannelCount,
          presentRequiredChannelCount: Math.max(0, requiredChannelCount - missingChannelCount),
          missingChannelCount,
          missingChannels: result.missingChannels,
          failureTypes:   result.checks.failed.map((c) => c.id),
          warningTypes:   result.checks.warnings.map((c) => c.id),
        });
      } catch {
        pendingLogRef.current     = null;
        pendingResultRef.current  = null;
        pendingMetricsRef.current = null;
      }
    }, 50);
  }

  // Called by DynoLoadingAnimation when its sequence ends
  const handleAnimationComplete = useCallback(() => {
    const log         = pendingLogRef.current;
    const result      = pendingResultRef.current;
    const metricsEvt  = pendingMetricsRef.current;

    setParsedLog(log);
    setValidationResult(result);
    setIsLoading(false);

    // Go straight to validation report if it exists and has any data
    if (result && log && log.rows.length > 0) {
      setActiveTab("validation");
      // Fire anonymous metrics after displaying results — non-blocking, non-fatal
      if (metricsEvt) {
        void recordValidationMetrics(metricsEvt);
      }
    } else {
      setActiveTab("schema");
    }

    pendingMetricsRef.current = null;
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  const canRun = !!loadedFile && !isLoading;

  return (
    <PageShell>
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <Upload className="h-5 w-5 text-red-400" />
          <p className="text-xs font-semibold uppercase tracking-widest text-red-400">
            CSV Upload
          </p>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
          Upload Your Datalog
        </h1>
        <p className="text-zinc-400 max-w-2xl leading-relaxed">
          Drop in a CSV datalog from any supported tuning platform. TunerData will
          detect the format, map columns to the unified schema, and run the
          full validation pipeline — all inside your browser.
        </p>
      </div>

      {/* Main two-column grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* ── Left panel ────────────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-5">
          {/* Uploader */}
          <CsvUploader
            onFileLoaded={handleFileLoaded}
            loadedFile={loadedFile}
            onClear={handleClear}
            isProcessing={isLoading}
          />

          {/* Template selector — appears after file is loaded */}
          {loadedFile && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Validation template
              </p>
              <TemplateSelector
                template={selectedTemplate}
                onTemplateChange={setSelectedTemplate}
              />
              <TemplatePreviewCard template={selectedTemplate} />
              {parsedLog && (
                <TemplateCompatibilityCard
                  parsedLog={parsedLog}
                  template={selectedTemplate}
                />
              )}
            </motion.div>
          )}

          {/* Run button */}
          {loadedFile && (
            <motion.button
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={handleRun}
              disabled={!canRun}
              className={cn(
                "w-full flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold transition-all",
                canRun
                  ? "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/30 hover:shadow-red-900/50"
                  : "bg-zinc-800 text-zinc-600 cursor-not-allowed",
              )}
            >
              <Play className="h-4 w-4" />
              Run Validation
            </motion.button>
          )}

          {/* Sidebar */}
          <Sidebar />
        </div>

        {/* ── Right panel ───────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {isLoading ? (
              <DynoLoadingAnimation
                key="animation"
                onComplete={handleAnimationComplete}
              />
            ) : parsedLog ? (
              <div key="results">
                <TabBar
                  active={activeTab}
                  hasResult={!!validationResult}
                  onSelect={setActiveTab}
                />

                {activeTab === "schema" && <ParseSummary log={parsedLog} />}

                {activeTab === "validation" && validationResult && (
                  <ValidationDashboard
                    result={validationResult}
                    rows={parsedLog.rows}
                  />
                )}

                {activeTab === "replay" && validationResult && (
                  <div className="rounded-xl border border-white/6 bg-[#111111] p-5">
                    <div className="flex items-center gap-2 mb-5">
                      <Gauge className="h-4 w-4 text-red-400" />
                      <h2 className="text-sm font-semibold text-white">
                        Gauge Cluster Replay
                      </h2>
                      <span className="ml-2 text-xs text-zinc-600">
                        {parsedLog.rows.length} rows ·{" "}
                        {(
                          (parsedLog.rows[parsedLog.rows.length - 1]?.timeSec ?? 0) -
                          (parsedLog.rows[0]?.timeSec ?? 0)
                        ).toFixed(1)}{" "}
                        s total
                      </span>
                    </div>
                    <GaugeCluster
                      rows={parsedLog.rows}
                      pullWindow={validationResult.pullWindow}
                      failureEvents={validationResult.failureEvents}
                    />
                  </div>
                )}
              </div>
            ) : (
              /* Empty state */
              <div
                key="empty"
                className="rounded-xl border border-dashed border-white/8 bg-[#0d0d0d] flex flex-col items-center justify-center min-h-[500px] gap-5 p-8 text-center"
              >
                <div className="h-16 w-16 rounded-2xl border border-white/6 bg-[#111111] flex items-center justify-center">
                  <Upload className="h-8 w-8 text-zinc-700" />
                </div>
                <div>
                  <p className="text-zinc-400 font-medium mb-2">
                    Validation results will appear here
                  </p>
                  <p className="text-sm text-zinc-600 max-w-xs leading-relaxed">
                    Upload a CSV file and click{" "}
                    <span className="text-red-400 font-medium">Run Validation</span>{" "}
                    to see the schema mapping, validation report, and gauge replay.
                  </p>
                </div>

                {/* Feature chips */}
                <div className="flex flex-wrap gap-2 justify-center text-xs text-zinc-700 mt-1">
                  {[
                    "Format detection",
                    "Column mapping",
                    "Pull window detection",
                    "Rule validation",
                    "Charts",
                    "Gauge replay",
                  ].map((label) => (
                    <span
                      key={label}
                      className="rounded-full border border-white/6 bg-[#111111] px-3 py-1"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mt-10 rounded-lg border border-white/4 bg-[#0d0d0d] px-5 py-4">
        <p className="text-xs text-zinc-600 text-center">
          For closed-course, dyno, and educational use only. This tool validates
          datalog structure and procedure compliance; it does not provide tuning advice.
        </p>
      </div>
    </PageShell>
  );
}
