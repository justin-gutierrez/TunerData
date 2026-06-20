"use client";

import { useState } from "react";
import { ChevronDown, ClipboardList } from "lucide-react";
import type { ValidationResult } from "@/lib/schema/validation-result";
import { generateTunerSummary } from "@/lib/reports/generateTunerSummary";
import type { TunerSummarySection, TunerSummaryRow, RowStatus } from "@/lib/reports/generateTunerSummary";
import { cn } from "@/lib/utils";

interface Props {
  result: ValidationResult;
}

function StatusDot({ status }: { status?: RowStatus }) {
  if (!status || status === "neutral") return null;
  return (
    <span
      className={cn(
        "inline-block h-1.5 w-1.5 rounded-full flex-shrink-0",
        status === "pass" && "bg-green-500",
        status === "warn" && "bg-amber-500",
        status === "fail" && "bg-red-500"
      )}
    />
  );
}

function ValueText({ row }: { row: TunerSummaryRow }) {
  return (
    <span
      className={cn(
        "text-right font-mono text-xs truncate max-w-[60%]",
        row.status === "pass" && "text-green-400",
        row.status === "warn" && "text-amber-400",
        row.status === "fail" && "text-red-400",
        (!row.status || row.status === "neutral") && "text-zinc-300"
      )}
    >
      {row.value}
    </span>
  );
}

function SectionPanel({ section }: { section: TunerSummarySection }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="border border-white/6 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white/3 hover:bg-white/5 transition-colors text-left"
      >
        <span className="text-xs font-semibold text-zinc-300 uppercase tracking-widest">
          {section.title}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 text-zinc-600 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="divide-y divide-white/4">
          {section.rows.map((row, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5 gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <StatusDot status={row.status} />
                <span className="text-xs text-zinc-500 truncate">{row.label}</span>
              </div>
              <ValueText row={row} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TunerReportCard({ result }: Props) {
  const summary = generateTunerSummary(result);

  return (
    <div className="rounded-xl border border-white/6 bg-[#111111] p-5">
      <div className="flex items-center gap-2 mb-4">
        <ClipboardList className="h-4 w-4 text-red-400" />
        <h2 className="text-sm font-semibold text-white">Tuner Technical Report</h2>
      </div>

      <div className="space-y-2">
        {summary.sections.map((section) => (
          <SectionPanel key={section.title} section={section} />
        ))}
      </div>
    </div>
  );
}
