/**
 * POST /api/metrics/record
 *
 * Accepts an anonymous ValidationMetricsEvent, validates it with Zod,
 * and writes aggregate counters to Upstash Redis.
 *
 * No raw CSV data, no file names, no PII accepted.
 */

import { NextRequest, NextResponse } from "next/server";
import { ValidationMetricsEventSchema } from "@/lib/metrics/metricsTypes";
import { recordEvent, isRedisConfigured } from "@/lib/metrics/metricsServer";

export const runtime = "edge"; // fast cold start

export async function POST(req: NextRequest) {
  // 1. Check Redis is configured
  if (!isRedisConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Redis is not configured on this deployment." },
      { status: 500 },
    );
  }

  // 2. Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  // 3. Validate with Zod
  const parsed = ValidationMetricsEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid payload.",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  // 4. Write to Redis
  try {
    await recordEvent(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/metrics/record] Redis error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to record metrics." },
      { status: 500 },
    );
  }
}
