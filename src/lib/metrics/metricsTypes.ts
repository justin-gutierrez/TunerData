/**
 * Shared Zod schemas and TypeScript types for the anonymous metrics pipeline.
 *
 * Rules:
 * - No CSV contents, no file names, no raw telemetry rows, no PII.
 * - All values are sanitized/clamped before acceptance.
 */

import { z } from "zod";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_ROW_COUNT   = 500_000;
const MAX_FILE_BYTES  = 50 * 1024 * 1024; // 50 MB
const MAX_LIST_ITEMS  = 20;
const MAX_STR_LEN     = 120;

// ─── Inbound event schema (validated by the API route) ───────────────────────

export const ValidationMetricsEventSchema = z.object({
  source: z.enum(["upload", "demo"]),

  templateId:   z.string().max(MAX_STR_LEN),
  templateName: z.string().max(MAX_STR_LEN),

  mode: z.enum(["roll_pull", "wot_pull", "idle", "cruise", "custom"]),

  status: z.enum(["pass", "warning", "fail"]),

  /** Clamped to 0–100 */
  score: z.number().min(0).max(100),

  detectedFormat: z.string().max(64),

  /** Clamped to reasonable max */
  rowCount: z.number().int().min(0).max(MAX_ROW_COUNT),

  /** Optional — clamped to reasonable max */
  fileSizeBytes: z.number().int().min(0).max(MAX_FILE_BYTES).optional().nullable(),

  sampleRateHz:          z.number().min(0).max(10_000).optional().nullable(),
  pullDurationSec:       z.number().min(0).max(3_600).optional().nullable(),
  usefulWindowSec:       z.number().min(0).max(3_600).optional().nullable(),
  totalLogDurationSec:   z.number().min(0).max(86_400).optional().nullable(),
  irrelevantDataTrimmedPct: z.number().min(0).max(100).optional().nullable(),

  requiredChannelCount:        z.number().int().min(0),
  presentRequiredChannelCount: z.number().int().min(0),
  missingChannelCount:         z.number().int().min(0),

  /** Limited to MAX_LIST_ITEMS strings */
  missingChannels: z.array(z.string().max(MAX_STR_LEN)).max(MAX_LIST_ITEMS),
  failureTypes:   z.array(z.string().max(MAX_STR_LEN)).max(MAX_LIST_ITEMS),
  warningTypes:   z.array(z.string().max(MAX_STR_LEN)).max(MAX_LIST_ITEMS),

  createdAt: z.string().datetime(),
});

export type ValidationMetricsEvent = z.infer<typeof ValidationMetricsEventSchema>;

// ─── Sanitized recent-event object stored in Redis ───────────────────────────

export type SanitizedRecentMetricEvent = {
  source: "upload" | "demo";
  templateId: string;
  templateName: string;
  mode: string;
  status: "pass" | "warning" | "fail";
  score: number;
  detectedFormat: string;
  rowCount: number;
  missingChannelCount: number;
  failureCount: number;
  createdAt: string;
};

// ─── Summary returned by GET /api/metrics/summary ────────────────────────────

export type MetricsSummary = {
  totalRuns:    number;
  uploadRuns:   number;
  demoRuns:     number;
  passCount:    number;
  warningCount: number;
  failCount:    number;

  /** (pass / total) × 100 */
  passRatePct: number;
  /** ((warn + fail) / total) × 100 — proportion of runs that had issues */
  badLogDetectionRatePct: number;

  averageScore:                     number;
  averageRows:                      number;
  averageFileSizeBytes:             number;
  averageSampleRateHz:              number | null;
  averageIrrelevantTrimPct:         number | null;
  averageRequiredChannelCoveragePct: number;

  topFailureTypes:   { type: string; count: number }[];
  topWarningTypes:   { type: string; count: number }[];
  topMissingChannels:{ channel: string; count: number }[];
  topTemplates:      { templateId: string; count: number }[];
  topFormats:        { format: string; count: number }[];

  recentEvents: SanitizedRecentMetricEvent[];
  lastUpdatedAt: string | null;

  /** Set to a warning message when Redis is unavailable or not configured */
  warning?: string;
};
