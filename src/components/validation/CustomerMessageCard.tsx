"use client";

import { useState } from "react";
import { MessageSquare, Copy, Check, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import type { ValidationResult } from "@/lib/schema/validation-result";
import { generateCustomerMessage } from "@/lib/reports/generateCustomerMessage";
import { cn } from "@/lib/utils";

interface Props {
  result: ValidationResult;
}

export function CustomerMessageCard({ result }: Props) {
  const [copied, setCopied] = useState(false);
  const message = generateCustomerMessage(result);

  function handleCopy() {
    navigator.clipboard.writeText(message).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const { outcome } = result;

  const borderClass =
    outcome === "pass"
      ? "border-green-500/20 bg-green-500/5"
      : outcome === "warn"
      ? "border-amber-500/20 bg-amber-500/5"
      : "border-red-500/20 bg-red-500/5";

  const iconClass =
    outcome === "pass"
      ? "text-green-400"
      : outcome === "warn"
      ? "text-amber-400"
      : "text-red-400";

  const OutcomeIcon =
    outcome === "pass" ? CheckCircle2 : outcome === "warn" ? AlertTriangle : XCircle;

  return (
    <div className={cn("rounded-xl border p-5", borderClass)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-red-400" />
          <h2 className="text-sm font-semibold text-white">Customer Message</h2>
        </div>
        <button
          onClick={handleCopy}
          title="Copy to clipboard"
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-medium transition-colors",
            copied
              ? "border-green-500/30 bg-green-500/10 text-green-400"
              : "border-white/8 bg-white/4 text-zinc-400 hover:text-zinc-200 hover:border-white/15"
          )}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" /> Copy
            </>
          )}
        </button>
      </div>

      <div className="flex items-start gap-3">
        <OutcomeIcon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", iconClass)} />
        <p className="text-sm text-zinc-300 leading-relaxed">{message}</p>
      </div>

      <p className="mt-4 text-[10px] text-zinc-700 border-t border-white/5 pt-3">
        This message is auto-generated for the customer&apos;s reference. Always review before
        sending. For closed-course, dyno, and educational use only.
      </p>
    </div>
  );
}
