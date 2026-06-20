/**
 * Client-side helper for firing anonymous validation metrics events.
 *
 * This module is safe to import in client components.
 * It never sends raw CSV data, file names, or personally identifying information.
 *
 * Failures are non-fatal: the validation result remains visible even if the
 * metrics POST request fails.
 */

import type { ValidationMetricsEvent } from "./metricsTypes";

/**
 * Fire-and-forget POST to /api/metrics/record.
 * Does not throw — failures are console-warned only.
 */
export async function recordValidationMetrics(
  event: ValidationMetricsEvent,
): Promise<void> {
  try {
    const res = await fetch("/api/metrics/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "(no body)");
      console.warn("[TunerData metrics] record returned non-OK:", res.status, body);
    }
  } catch (err) {
    // Network failure, CORS, etc. — never crash the UI.
    console.warn("[TunerData metrics] Failed to record metrics (non-fatal):", err);
  }
}

/**
 * Build a ValidationMetricsEvent from ValidationResult + ParsedLog fields.
 * Call this right after validation succeeds, before the UI re-renders.
 */
export type MetricsEventInput = {
  source: "upload" | "demo";
  templateId: string;
  templateName: string;
  mode: "roll_pull" | "wot_pull" | "idle" | "cruise" | "custom";
  status: "pass" | "warning" | "fail";
  score: number;
  detectedFormat: string;
  rowCount: number;
  fileSizeBytes?: number | null;
  sampleRateHz?: number | null;
  pullDurationSec?: number | null;
  usefulWindowSec?: number | null;
  totalLogDurationSec?: number | null;
  irrelevantDataTrimmedPct?: number | null;
  requiredChannelCount: number;
  presentRequiredChannelCount: number;
  missingChannelCount: number;
  missingChannels: string[];
  failureTypes: string[];
  warningTypes: string[];
};

export function buildMetricsEvent(input: MetricsEventInput): ValidationMetricsEvent {
  return {
    ...input,
    createdAt: new Date().toISOString(),
    // Clamp / sanitize before sending
    score:    Math.min(100, Math.max(0, Math.round(input.score))),
    rowCount: Math.min(500_000, Math.max(0, input.rowCount)),
    fileSizeBytes:  input.fileSizeBytes  != null
      ? Math.min(50 * 1024 * 1024, Math.max(0, input.fileSizeBytes))
      : undefined,
    missingChannels: input.missingChannels.slice(0, 20),
    failureTypes:    input.failureTypes.slice(0, 20),
    warningTypes:    input.warningTypes.slice(0, 20),
  };
}
