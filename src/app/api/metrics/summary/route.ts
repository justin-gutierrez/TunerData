/**
 * GET /api/metrics/summary
 *
 * Returns aggregated anonymous metrics from Upstash Redis.
 * Falls back to empty/default metrics with a warning field
 * if Redis is not configured.
 */

import { NextResponse } from "next/server";
import { getSummary } from "@/lib/metrics/metricsServer";

// Revalidate every 60 s in production so Next.js caches the response
export const revalidate = 60;
export const runtime = "edge";

export async function GET() {
  try {
    const summary = await getSummary();
    return NextResponse.json(summary);
  } catch (err) {
    console.error("[GET /api/metrics/summary] error:", err);
    return NextResponse.json(
      {
        totalRuns: 0, uploadRuns: 0, demoRuns: 0,
        passCount: 0, warningCount: 0, failCount: 0,
        passRatePct: 0, badLogDetectionRatePct: 0,
        averageScore: 0, averageRows: 0, averageFileSizeBytes: 0,
        averageSampleRateHz: null, averageIrrelevantTrimPct: null,
        averageRequiredChannelCoveragePct: 0,
        topFailureTypes: [], topWarningTypes: [], topMissingChannels: [],
        topTemplates: [], topFormats: [],
        recentEvents: [], lastUpdatedAt: null,
        warning: "Metrics unavailable.",
      },
      { status: 200 },
    );
  }
}
