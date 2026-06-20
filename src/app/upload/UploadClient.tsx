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
  { id: "schema",     label: "Schema Mapping",    icon: Table,       needsResult: false },
  { id: "validation", label: "Validation Report",  icon: ShieldCheck, needsResult: true  },
  { id: "replay",     label: "Gauge Replay",        icon: Gauge,       needsResult: true  },
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
    <div className="flex flex-wrap gap-2 mb-6 border-b border-white/8 pb-2">
      {TAB_DEFS.map(({ id, label, icon: Icon, needsResult }) => {
        const isActive  = active === id;
        const disabled  = needsResult && !hasResult;
        const available = !disabled;

        return (
          <motion.button
            key={id}
            onClick={() => available && onSelect(id)}
            disabled={disabled}
            /* lift + scale on hover; tap pushes down */
            whileHover={available ? { y: -2, scale: 1.03 } : {}}
            whileTap={available ? { scale: 0.97 } : {}}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            className={cn(
              "relative overflow-hidden flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors select-none",
              isActive
                ? "bg-red-600/20 border border-red-500/50 text-red-300 shadow-[0_0_18px_2px_rgba(239,68,68,0.25)]"
                : disabled
                  ? "text-zinc-700 border border-transparent cursor-not-allowed"
                  : "text-zinc-400 border border-white/8 hover:text-zinc-100 hover:border-white/20 hover:bg-white/5",
            )}
          >
            {/* Shimmer sweep — only on active tab */}
            {isActive && (
              <motion.span
                className="pointer-events-none absolute inset-0"
                initial={{ x: "-100%" }}
                animate={{ x: "200%" }}
                transition={{
                  duration: 1.6,
                  repeat: Infinity,
                  repeatDelay: 2.2,
                  ease: "easeInOut",
                }}
                style={{
                  background:
                    "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.18) 50%, transparent 65%)",
                }}
              />
            )}

            {/* Pulse dot on newly-available tabs */}
            {available && !isActive && (
              <motion.span
                className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-red-400"
                animate={{ opacity: [1, 0.2, 1] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              />
            )}

            <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-red-400" : "")} />
            {label}
            {disabled && (
              <span className="text-[10px] text-zinc-700 ml-0.5 font-normal">(run first)</span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── Supported formats (horizontal bottom strip) ──────────────────────────────

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

function FormatsStrip() {
  return (
    <div className="rounded-xl border border-white/6 bg-[#111111] overflow-hidden">
      <div className="px-5 py-4 border-b border-white/6 flex items-center gap-2">
        <FileText className="h-4 w-4 text-red-400" />
        <h2 className="text-sm font-semibold text-white">Supported Formats</h2>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/4">
        {SUPPORTED_FORMATS.map((fmt) => (
          <div key={fmt.name} className="px-5 py-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-zinc-200">{fmt.name}</span>
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

  // Ref for the results panel — used to scroll it into view after animation
  const resultsPanelRef = useRef<HTMLDivElement | null>(null);

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

    // Scroll results into view after state updates flush
    requestAnimationFrame(() => {
      resultsPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  const canRun = !!loadedFile && !isLoading;

  return (
    <PageShell>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="mb-8">
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

      {/* ── ROW 1: Uploader (left) + Run button panel (right) ───────────────── */}
      <div className="grid lg:grid-cols-3 gap-5 mb-6">
        {/* Uploader — takes 2/3 */}
        <div className="lg:col-span-2">
          <CsvUploader
            onFileLoaded={handleFileLoaded}
            loadedFile={loadedFile}
            onClear={handleClear}
            isProcessing={isLoading}
          />
        </div>

        {/* Run button panel — takes 1/3, always visible */}
        <div className="flex flex-col gap-4">
          <button
            onClick={handleRun}
            disabled={!canRun}
            className={cn(
              "w-full flex items-center justify-center gap-2 rounded-xl px-5 py-4 text-sm font-bold transition-all",
              canRun
                ? "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/30 hover:shadow-red-900/50"
                : "bg-zinc-800/60 text-zinc-600 cursor-not-allowed border border-white/5",
            )}
          >
            <Play className="h-4 w-4" />
            Run Validation
          </button>

          {/* Processing info */}
          <div className="rounded-xl border border-white/6 bg-[#111111] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="h-4 w-4 text-red-400" />
              <h2 className="text-sm font-semibold text-white">Local Processing</h2>
            </div>
            <ul className="space-y-1.5 mb-3">
              {[
                "100% client-side — no server upload",
                "File never leaves your device",
                "No account or login required",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-xs text-zinc-400">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-3 py-2">
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                <span className="text-zinc-400 font-semibold">Metrics note:</span>{" "}
                An anonymous validation summary may update the public{" "}
                <a href="/metrics" className="text-red-400 hover:underline">metrics dashboard</a>.
                CSV files and raw data are not stored.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 2: Template config — full width, 2 columns, appears after upload ── */}
      {loadedFile && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
            Validation Template
          </p>
          <div className="grid lg:grid-cols-2 gap-5">
            {/* Left: selector (preset grid + optional builder) */}
            <TemplateSelector
              template={selectedTemplate}
              onTemplateChange={setSelectedTemplate}
            />

            {/* Right: preview + compatibility stacked */}
            <div className="space-y-4">
              <TemplatePreviewCard template={selectedTemplate} />
              {parsedLog && (
                <TemplateCompatibilityCard
                  parsedLog={parsedLog}
                  template={selectedTemplate}
                />
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── ROW 3: Results panel — full width ───────────────────────────────── */}
      <div ref={resultsPanelRef} />
      <AnimatePresence mode="wait">
        {isLoading ? (
          <DynoLoadingAnimation
            key="animation"
            onComplete={handleAnimationComplete}
          />
        ) : parsedLog ? (
          <div key="results" className="mb-8">
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
            className="rounded-xl border border-dashed border-white/8 bg-[#0d0d0d] flex flex-col items-center justify-center min-h-[360px] gap-5 p-8 text-center mb-8"
          >
            <div className="h-16 w-16 rounded-2xl border border-white/6 bg-[#111111] flex items-center justify-center">
              <Upload className="h-8 w-8 text-zinc-700" />
            </div>
            <div>
              <p className="text-zinc-400 font-medium mb-2">
                Validation results will appear here
              </p>
              <p className="text-sm text-zinc-600 max-w-xs leading-relaxed">
                Upload a CSV file, select a template, and click{" "}
                <span className="text-red-400 font-medium">Run Validation</span>.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center text-xs text-zinc-700 mt-1">
              {["Format detection", "Column mapping", "Pull window detection", "Rule validation", "Charts", "Gauge replay"].map((label) => (
                <span key={label} className="rounded-full border border-white/6 bg-[#111111] px-3 py-1">
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ── ROW 4: Supported formats — horizontal strip ──────────────────────── */}
      <FormatsStrip />

      {/* Disclaimer */}
      <div className="mt-6 rounded-lg border border-white/4 bg-[#0d0d0d] px-5 py-4">
        <p className="text-xs text-zinc-600 text-center">
          For closed-course, dyno, and educational use only. This tool validates
          datalog structure and procedure compliance; it does not provide tuning advice.
        </p>
      </div>
    </PageShell>
  );
}
