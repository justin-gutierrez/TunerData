/**
 * Server-only Redis helpers for the metrics pipeline.
 *
 * All functions are safe to import in Next.js Route Handlers and Server
 * Components.  Do NOT import this file from client components.
 *
 * Redis key namespace: loggate:metrics:*
 */

import { Redis } from "@upstash/redis";
import type {
  ValidationMetricsEvent,
  MetricsSummary,
  SanitizedRecentMetricEvent,
} from "./metricsTypes";

// ─── Redis client (singleton) ─────────────────────────────────────────────────

let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis) return _redis;

  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  _redis = new Redis({ url, token });
  return _redis;
}

// ─── Key names ────────────────────────────────────────────────────────────────

const K = {
  totalRuns:    "loggate:metrics:total_runs",
  uploadRuns:   "loggate:metrics:upload_runs",
  demoRuns:     "loggate:metrics:demo_runs",
  statusPass:   "loggate:metrics:status:pass",
  statusWarn:   "loggate:metrics:status:warning",
  statusFail:   "loggate:metrics:status:fail",

  mode:     (m: string) => `loggate:metrics:mode:${m}`,
  template: (t: string) => `loggate:metrics:template:${t}`,
  format:   (f: string) => `loggate:metrics:format:${f}`,
  failure:  (f: string) => `loggate:metrics:failure:${f}`,
  warning:  (w: string) => `loggate:metrics:warning:${w}`,
  missing:  (c: string) => `loggate:metrics:missing_channel:${c}`,

  sumScore:          "loggate:metrics:sum_score",
  sumRowCount:       "loggate:metrics:sum_row_count",
  sumFileSizeBytes:  "loggate:metrics:sum_file_size_bytes",
  sumSampleRateHz:   "loggate:metrics:sum_sample_rate_hz",
  sampleRateCount:   "loggate:metrics:sample_rate_count",
  sumIrrelevantPct:  "loggate:metrics:sum_irrelevant_trim_pct",
  irrelevantCount:   "loggate:metrics:irrelevant_trim_count",
  sumChannelCovPct:  "loggate:metrics:sum_required_channel_coverage_pct",

  recentEvents: "loggate:metrics:recent_events",
  lastUpdatedAt:"loggate:metrics:last_updated_at",

  // Index sets for efficient scan-free summary
  idxFailureTypes:   "loggate:metrics:index:failure_types",
  idxWarningTypes:   "loggate:metrics:index:warning_types",
  idxMissingChannels:"loggate:metrics:index:missing_channels",
  idxTemplates:      "loggate:metrics:index:templates",
  idxFormats:        "loggate:metrics:index:formats",
} as const;

// ─── Record an event ──────────────────────────────────────────────────────────

export async function recordEvent(event: ValidationMetricsEvent): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error("Redis is not configured (missing env vars).");

  const pipe = redis.pipeline();

  // Global totals
  pipe.incr(K.totalRuns);
  if (event.source === "upload") pipe.incr(K.uploadRuns);
  else                            pipe.incr(K.demoRuns);

  // Status counters
  if (event.status === "pass")    pipe.incr(K.statusPass);
  else if (event.status === "warning") pipe.incr(K.statusWarn);
  else                            pipe.incr(K.statusFail);

  // Mode / template / format
  pipe.incr(K.mode(event.mode));
  pipe.incr(K.template(event.templateId));
  pipe.incr(K.format(event.detectedFormat));

  // Index sets (for enumeration during summary)
  pipe.sadd(K.idxTemplates,       event.templateId);
  pipe.sadd(K.idxFormats,         event.detectedFormat);

  // Failure / warning / missing channel counters + index sets
  for (const f of event.failureTypes) {
    pipe.incr(K.failure(f));
    pipe.sadd(K.idxFailureTypes, f);
  }
  for (const w of event.warningTypes) {
    pipe.incr(K.warning(w));
    pipe.sadd(K.idxWarningTypes, w);
  }
  for (const c of event.missingChannels) {
    pipe.incr(K.missing(c));
    pipe.sadd(K.idxMissingChannels, c);
  }

  // Running sums for averages
  pipe.incrbyfloat(K.sumScore,    event.score);
  pipe.incrbyfloat(K.sumRowCount, event.rowCount);

  if (event.fileSizeBytes != null) {
    pipe.incrbyfloat(K.sumFileSizeBytes, event.fileSizeBytes);
  }
  if (event.sampleRateHz != null) {
    pipe.incrbyfloat(K.sumSampleRateHz, event.sampleRateHz);
    pipe.incr(K.sampleRateCount);
  }
  if (event.irrelevantDataTrimmedPct != null) {
    pipe.incrbyfloat(K.sumIrrelevantPct, event.irrelevantDataTrimmedPct);
    pipe.incr(K.irrelevantCount);
  }

  // Required channel coverage pct
  const coveragePct =
    event.requiredChannelCount > 0
      ? (event.presentRequiredChannelCount / event.requiredChannelCount) * 100
      : 100;
  pipe.incrbyfloat(K.sumChannelCovPct, coveragePct);

  // Sanitized recent event (store only anonymous summary fields)
  const recent: SanitizedRecentMetricEvent = {
    source:             event.source,
    templateId:         event.templateId,
    templateName:       event.templateName,
    mode:               event.mode,
    status:             event.status,
    score:              event.score,
    detectedFormat:     event.detectedFormat,
    rowCount:           event.rowCount,
    missingChannelCount:event.missingChannelCount,
    failureCount:       event.failureTypes.length,
    createdAt:          event.createdAt,
  };
  pipe.lpush(K.recentEvents, JSON.stringify(recent));
  pipe.ltrim(K.recentEvents, 0, 19); // keep last 20

  // Updated timestamp
  pipe.set(K.lastUpdatedAt, new Date().toISOString());

  await pipe.exec();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getCounter(redis: Redis, key: string): Promise<number> {
  const v = await redis.get<string | number>(key);
  return v == null ? 0 : Number(v);
}

/** Fetch all members of a set then get each counter; return sorted descending */
async function getTopN(
  redis: Redis,
  indexKey: string,
  makeKey: (item: string) => string,
  topN = 10,
): Promise<{ key: string; count: number }[]> {
  const members = await redis.smembers(indexKey);
  if (!members || members.length === 0) return [];

  // Batch-get all counts in one pipeline
  const pipe = redis.pipeline();
  for (const m of members) pipe.get(makeKey(m));
  const results = await pipe.exec<(string | number | null)[]>();

  const pairs = members
    .map((m, i) => ({ key: m, count: Number(results[i] ?? 0) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);

  return pairs;
}

// ─── Build summary ────────────────────────────────────────────────────────────

export async function getSummary(): Promise<MetricsSummary> {
  const empty: MetricsSummary = {
    totalRuns: 0, uploadRuns: 0, demoRuns: 0,
    passCount: 0, warningCount: 0, failCount: 0,
    passRatePct: 0, badLogDetectionRatePct: 0,
    averageScore: 0, averageRows: 0, averageFileSizeBytes: 0,
    averageSampleRateHz: null, averageIrrelevantTrimPct: null,
    averageRequiredChannelCoveragePct: 0,
    topFailureTypes: [], topWarningTypes: [], topMissingChannels: [],
    topTemplates: [], topFormats: [],
    recentEvents: [], lastUpdatedAt: null,
  };

  const redis = getRedis();
  if (!redis) {
    return { ...empty, warning: "Redis is not configured — showing default metrics." };
  }

  try {
    // Batch-get all scalar counters in one pipeline
    const pipe = redis.pipeline();
    pipe.get(K.totalRuns);
    pipe.get(K.uploadRuns);
    pipe.get(K.demoRuns);
    pipe.get(K.statusPass);
    pipe.get(K.statusWarn);
    pipe.get(K.statusFail);
    pipe.get(K.sumScore);
    pipe.get(K.sumRowCount);
    pipe.get(K.sumFileSizeBytes);
    pipe.get(K.sumSampleRateHz);
    pipe.get(K.sampleRateCount);
    pipe.get(K.sumIrrelevantPct);
    pipe.get(K.irrelevantCount);
    pipe.get(K.sumChannelCovPct);
    pipe.get(K.lastUpdatedAt);
    pipe.lrange(K.recentEvents, 0, 19);

    const [
      totalRuns, uploadRuns, demoRuns,
      passCount, warnCount, failCount,
      sumScore, sumRows, sumFileBytes,
      sumSampleRate, sampleRateCount,
      sumIrrelevantPct, irrelevantCount,
      sumChannelCovPct,
      lastUpdatedAt,
      recentRaw,
    ] = await pipe.exec<(string | number | string[] | null)[]>();

    const total   = Number(totalRuns  ?? 0);
    const uploads = Number(uploadRuns ?? 0);
    const demos   = Number(demoRuns   ?? 0);
    const pass    = Number(passCount  ?? 0);
    const warn    = Number(warnCount  ?? 0);
    const fail    = Number(failCount  ?? 0);

    const sumScoreN       = Number(sumScore       ?? 0);
    const sumRowsN        = Number(sumRows        ?? 0);
    const sumFileBytesN   = Number(sumFileBytes   ?? 0);
    const sumSampleRateN  = Number(sumSampleRate  ?? 0);
    const sampleRateCntN  = Number(sampleRateCount ?? 0);
    const sumIrrelevantN  = Number(sumIrrelevantPct ?? 0);
    const irrelevantCntN  = Number(irrelevantCount  ?? 0);
    const sumCovPctN      = Number(sumChannelCovPct ?? 0);

    // Parse recent events
    const recentEvents: SanitizedRecentMetricEvent[] = [];
    if (Array.isArray(recentRaw)) {
      for (const raw of recentRaw as string[]) {
        try { recentEvents.push(JSON.parse(raw)); } catch { /* skip */ }
      }
    }

    // Top N lists (parallel)
    const [topFail, topWarn, topMissing, topTmpl, topFmt] = await Promise.all([
      getTopN(redis, K.idxFailureTypes,   K.failure,  10),
      getTopN(redis, K.idxWarningTypes,   K.warning,  10),
      getTopN(redis, K.idxMissingChannels,K.missing,  10),
      getTopN(redis, K.idxTemplates,      K.template, 10),
      getTopN(redis, K.idxFormats,        K.format,   10),
    ]);

    return {
      totalRuns:  total,
      uploadRuns: uploads,
      demoRuns:   demos,
      passCount:  pass,
      warningCount: warn,
      failCount:  fail,

      passRatePct: total > 0 ? Math.round((pass / total) * 100) : 0,
      badLogDetectionRatePct: total > 0 ? Math.round(((warn + fail) / total) * 100) : 0,

      averageScore:    total > 0 ? Math.round(sumScoreN / total) : 0,
      averageRows:     total > 0 ? Math.round(sumRowsN  / total) : 0,
      averageFileSizeBytes: total > 0 ? Math.round(sumFileBytesN / total) : 0,
      averageSampleRateHz:  sampleRateCntN > 0 ? Math.round((sumSampleRateN / sampleRateCntN) * 10) / 10 : null,
      averageIrrelevantTrimPct: irrelevantCntN > 0 ? Math.round((sumIrrelevantN / irrelevantCntN) * 10) / 10 : null,
      averageRequiredChannelCoveragePct: total > 0 ? Math.round(sumCovPctN / total) : 0,

      topFailureTypes:   topFail.map(({ key, count }) => ({ type: key, count })),
      topWarningTypes:   topWarn.map(({ key, count }) => ({ type: key, count })),
      topMissingChannels:topMissing.map(({ key, count }) => ({ channel: key, count })),
      topTemplates:      topTmpl.map(({ key, count }) => ({ templateId: key, count })),
      topFormats:        topFmt.map(({ key, count }) => ({ format: key, count })),

      recentEvents,
      lastUpdatedAt: lastUpdatedAt as string | null,
    };
  } catch (err) {
    console.error("[metricsServer] getSummary error:", err);
    return {
      ...empty,
      warning: "Could not load metrics from Redis — showing default metrics.",
    };
  }
}

// ─── Check Redis connectivity ─────────────────────────────────────────────────

export function isRedisConfigured(): boolean {
  return (
    Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
    Boolean(process.env.UPSTASH_REDIS_REST_TOKEN)
  );
}
