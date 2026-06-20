"use client";

import React, { useState, useRef, useCallback } from "react";
import { AnimatePresence } from "motion/react";
import { PageShell } from "@/components/layout/PageShell";
import { DynoLoadingAnimation } from "@/components/DynoLoadingAnimation";
import { ColumnMappingTable } from "@/components/mapping/ColumnMappingTable";
import { RawPreviewTable } from "@/components/mapping/RawPreviewTable";
import { ValidationDashboard } from "@/components/validation/ValidationDashboard";
import { GaugeCluster } from "@/components/replay/GaugeCluster";
import {
  Activity,
  Play,
  FileText,
  Cpu,
  BarChart2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Table,
  ShieldCheck,
  Gauge,
} from "lucide-react";
import { demoLogs, getDemoLog, DEFAULT_DEMO_LOG_ID } from "@/lib/demo-data/demoLogs";
import { parseLogFromText, estimateSampleRate } from "@/lib/parser/toNormalizedRows";
import { validateLog } from "@/lib/validation/validateLog";
import { FORTY_ROLL_TEMPLATE } from "@/lib/schema/validation-rules";
import type { ValidationTemplate } from "@/lib/schema/validation-rules";
import { FORMAT_LABELS } from "@/lib/parser/detectFormat";
import type { ParsedLog } from "@/lib/schema/normalized-log";
import type { ValidationResult } from "@/lib/schema/validation-result";
import { cn } from "@/lib/utils";
import { TemplateSelector } from "@/components/templates/TemplateSelector";

// ─── Outcome badge ────────────────────────────────────────────────────────────

function OutcomeBadge({ outcome }: { outcome: string }) {
  if (outcome === "pass")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-green-500/25 bg-green-500/10 px-2 py-0.5 text-[10px] font-bold text-green-400">
        <CheckCircle2 className="h-2.5 w-2.5" /> PASS
      </span>
    );
  if (outcome === "warn")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
        <AlertTriangle className="h-2.5 w-2.5" /> WARN
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-red-500/25 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-400">
      <XCircle className="h-2.5 w-2.5" /> FAIL
    </span>
  );
}

// ─── Parse summary (left of schema tab) ──────────────────────────────────────

function ParseSummary({ log }: { log: ParsedLog }) {
  const sampleRate = estimateSampleRate(log.rows);
  const mappedCount = log.columnMappings.filter((m) => m.status === "mapped").length;
  const totalCount = log.columnMappings.length;
  const formatLabel = FORMAT_LABELS[log.detectedFormat] ?? log.detectedFormat;

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Format", value: formatLabel },
          { label: "Rows parsed", value: log.rows.length.toLocaleString() },
          { label: "Sample rate", value: sampleRate > 0 ? `${sampleRate} Hz` : "—" },
          { label: "Mapped", value: `${mappedCount} / ${totalCount}` },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-white/6 bg-[#0d0d0d] px-4 py-3">
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
            {log.warnings.length} Parse Warning{log.warnings.length > 1 ? "s" : ""}
          </div>
          {log.warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-300/80 font-mono leading-relaxed">
              {w}
            </p>
          ))}
        </div>
      )}

      {/* Column mapping table */}
      <ColumnMappingTable mappings={log.columnMappings} />

      {/* Normalised row preview */}
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
  { id: "validation", label: "Validation Report", icon: ShieldCheck, needsResult: true },
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
                : "text-zinc-500 hover:text-zinc-200 hover:bg-white/4"
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DemoPage() {
  const [selectedId, setSelectedId]       = useState(DEFAULT_DEMO_LOG_ID);
  const [parsedLog, setParsedLog]         = useState<ParsedLog | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isLoading, setIsLoading]         = useState(false);
  const [activeTab, setActiveTab]         = useState<Tab>("schema");
  const [selectedTemplate, setSelectedTemplate] =
    useState<ValidationTemplate>(FORTY_ROLL_TEMPLATE);

  // Hold validation output while the animation plays
  const pendingLogRef    = useRef<ParsedLog | null>(null);
  const pendingResultRef = useRef<ValidationResult | null>(null);

  const selectedLog = getDemoLog(selectedId);

  function handleRun() {
    if (!selectedLog) return;
    setIsLoading(true);
    setParsedLog(null);
    setValidationResult(null);
    pendingLogRef.current = null;
    pendingResultRef.current = null;

    // Validation is fast — start immediately and store in refs.
    // The animation (not this timeout) controls when results are revealed.
    setTimeout(() => {
      try {
        const parsed = parseLogFromText(selectedLog.csvContent, selectedLog.name);
        const result = validateLog(parsed, selectedTemplate);
        pendingLogRef.current = parsed;
        pendingResultRef.current = result;
      } catch {
        pendingLogRef.current = null;
        pendingResultRef.current = null;
      }
    }, 50);
  }

  // Called by DynoLoadingAnimation when its sequence ends
  const handleAnimationComplete = useCallback(() => {
    setParsedLog(pendingLogRef.current);
    setValidationResult(pendingResultRef.current);
    setIsLoading(false);
    if (pendingResultRef.current) setActiveTab("validation");
  }, []);

  function handleSelectLog(id: string) {
    setSelectedId(id);
    setParsedLog(null);
    setValidationResult(null);
    setActiveTab("schema" as Tab);
  }

  return (
    <PageShell>
      {/* Page header */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-5 w-5 text-red-400" />
          <p className="text-xs font-semibold uppercase tracking-widest text-red-400">
            Interactive Demo
          </p>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
          Datalog Validation Demo
        </h1>
        <p className="text-zinc-400 max-w-2xl leading-relaxed">
          Select a preconfigured demo datalog and a validation template, then run the full
          pipeline — parsing, schema mapping, pull detection, and rule validation.
        </p>
      </div>

      {/* Main layout */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* ── Left sidebar ──────────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-5">
          {/* Log selector */}
          <div className="rounded-xl border border-white/6 bg-[#111111] p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-4 w-4 text-red-400" />
              <h2 className="text-sm font-semibold text-white">Demo Datalog</h2>
            </div>
            <div className="space-y-1.5">
              {demoLogs.map((log) => {
                const isActive = log.id === selectedId;
                return (
                  <button
                    key={log.id}
                    onClick={() => handleSelectLog(log.id)}
                    className={cn(
                      "w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-xs transition-colors text-left",
                      isActive
                        ? "bg-red-600/15 border border-red-500/30 text-red-300"
                        : "border border-transparent text-zinc-500 hover:bg-white/4 hover:text-zinc-200"
                    )}
                  >
                    <span className="truncate pr-2">{log.name}</span>
                    <OutcomeBadge outcome={log.expectedOutcome} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected log info */}
          {selectedLog && (
            <div className="rounded-xl border border-white/6 bg-[#111111] p-5">
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                Log Description
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {selectedLog.description}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
                <span className="font-mono">{selectedLog.formatLabel}</span>
                <span>·</span>
                <span>{selectedLog.csvContent.split("\n").length - 1} rows</span>
                <span>·</span>
                <OutcomeBadge outcome={selectedLog.expectedOutcome} />
              </div>
            </div>
          )}

          {/* Template selector */}
          <div className="rounded-xl border border-white/6 bg-[#111111] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Cpu className="h-4 w-4 text-red-400" />
              <h2 className="text-sm font-semibold text-white">Validation Template</h2>
            </div>
            <TemplateSelector
              template={selectedTemplate}
              onTemplateChange={setSelectedTemplate}
            />
          </div>

          {/* Run button */}
          <button
            onClick={handleRun}
            disabled={isLoading}
            className={cn(
              "w-full flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-bold text-white transition-colors shadow-lg shadow-red-900/30",
              isLoading
                ? "bg-red-600/50 cursor-not-allowed"
                : "bg-red-600 hover:bg-red-500"
            )}
          >
            {isLoading ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Running…
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Run Validation
              </>
            )}
          </button>
        </div>

        {/* ── Right panel ───────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {isLoading ? (
              /* Dyno animation plays while validation runs in the background */
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
                  <ValidationDashboard result={validationResult} rows={parsedLog.rows} />
                )}

                {activeTab === "replay" && validationResult && (
                  <div className="rounded-xl border border-white/6 bg-[#111111] p-5">
                    <div className="flex items-center gap-2 mb-5">
                      <Gauge className="h-4 w-4 text-red-400" />
                      <h2 className="text-sm font-semibold text-white">Gauge Cluster Replay</h2>
                      <span className="ml-2 text-xs text-zinc-600">
                        {parsedLog.rows.length} rows ·{" "}
                        {(
                          parsedLog.rows[parsedLog.rows.length - 1]?.timeSec -
                          parsedLog.rows[0]?.timeSec
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
                className="rounded-xl border border-dashed border-white/8 bg-[#0d0d0d] flex flex-col items-center justify-center min-h-[500px] gap-4 p-8 text-center"
              >
                <div className="h-16 w-16 rounded-2xl border border-white/6 bg-[#111111] flex items-center justify-center">
                  <BarChart2 className="h-8 w-8 text-zinc-700" />
                </div>
                <div>
                  <p className="text-zinc-400 font-medium mb-1">
                    Validation dashboard will appear here
                  </p>
                  <p className="text-sm text-zinc-600">
                    Select a log and click{" "}
                    <span className="text-red-400 font-medium">Run Validation</span> to begin.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center text-xs text-zinc-700 mt-2">
                  {[
                    "Format detection",
                    "Column mapping",
                    "Pull window detection",
                    "Rule validation",
                    "Score",
                    "Reports",
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
          For closed-course, dyno, and educational use only. This tool validates datalog
          structure and procedure compliance; it does not provide tuning advice.
        </p>
      </div>
    </PageShell>
  );
}
