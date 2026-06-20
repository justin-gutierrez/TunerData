"use client";

/**
 * GaugeCluster — stateful replay container.
 *
 * Owns replayTime, isPlaying, and playbackRate.
 * Runs a 100ms setInterval during playback to advance the timestamp.
 * Uses binary search to find the nearest normalised row for the current time.
 *
 * Failure behaviours:
 *   - Any failure event within 0.8 s of replayTime shows a warning badge.
 *   - Early-lift: throttle gauge shows "Early lift" when past the event timestamp
 *     AND the current throttle value has dropped below 90 %.
 *   - No-redline: RPM gauge shows "Lifted" when past the event timestamp.
 *   - Wrong-gear: gear card shows a warning for the full duration of the pull.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import type { NormalizedLogRow } from "@/lib/schema/normalized-log";
import type { PullWindow, FailureEvent } from "@/lib/schema/validation-result";
import { TelemetryGauge } from "./TelemetryGauge";
import { TelemetryCard } from "./TelemetryCard";
import { PullReplayControls } from "./PullReplayControls";

// ─── Row finder ───────────────────────────────────────────────────────────────

function findCurrentRow(
  rows: NormalizedLogRow[],
  time: number
): NormalizedLogRow | null {
  if (rows.length === 0) return null;
  let lo = 0;
  let hi = rows.length - 1;
  // Binary search: find last row whose timeSec ≤ time
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (rows[mid].timeSec <= time) lo = mid;
    else hi = mid - 1;
  }
  return rows[lo];
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  rows: NormalizedLogRow[];
  pullWindow?: PullWindow;
  failureEvents: FailureEvent[];
}

// ─── Component ───────────────────────────────────────────────────────────────

export function GaugeCluster({ rows, pullWindow, failureEvents }: Props) {
  const startTime = rows[0]?.timeSec ?? 0;
  const endTime = rows[rows.length - 1]?.timeSec ?? 0;

  const [replayTime, setReplayTime] = useState(startTime);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<1 | 2 | 4>(1);

  const playbackRateRef = useRef(playbackRate);
  useEffect(() => { playbackRateRef.current = playbackRate; }, [playbackRate]);

  // ── Playback interval ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying) return;
    const TICK_MS = 100;

    const id = setInterval(() => {
      setReplayTime((prev) => {
        const next = prev + (TICK_MS / 1000) * playbackRateRef.current;
        if (next >= endTime) {
          setIsPlaying(false);
          return endTime;
        }
        return next;
      });
    }, TICK_MS);

    return () => clearInterval(id);
  }, [isPlaying, endTime]);

  // ── Derive current row ────────────────────────────────────────────────────
  const currentRow = findCurrentRow(rows, replayTime);

  const rpm      = currentRow?.rpm;
  const speed    = currentRow?.speedMph;
  const gear     = currentRow?.gear;
  const throttle = currentRow?.throttlePct ?? currentRow?.acceleratorPct;
  const boost    = currentRow?.boostPsi;
  const afr      = currentRow?.afr;
  const lambda   = currentRow?.lambda;
  const timing   = currentRow?.ignitionTimingDeg;
  const knock    = currentRow?.knockRetardDeg;

  // ── Pull window state ─────────────────────────────────────────────────────
  const inPull =
    pullWindow !== undefined &&
    replayTime >= pullWindow.startTime &&
    replayTime <= pullWindow.endTime;

  // ── Failure event proximity (within 0.8 s) ────────────────────────────────
  const nearEvents = failureEvents.filter(
    (ev) =>
      isFinite(ev.timeSec) &&
      ev.timeSec > 0 &&
      Math.abs(ev.timeSec - replayTime) < 0.8
  );
  const nearTypes = new Set(nearEvents.map((e) => e.type));

  // ── Early-lift detection ──────────────────────────────────────────────────
  const earlyLiftEvent = failureEvents.find((e) => e.type === "early_lift");
  const pastEarlyLift =
    earlyLiftEvent !== undefined && replayTime >= earlyLiftEvent.timeSec;
  const showEarlyLift = pastEarlyLift && throttle !== undefined && throttle < 90;

  // ── No-redline detection ──────────────────────────────────────────────────
  const noRedlineEvent = failureEvents.find((e) => e.type === "no_redline");
  const showNoRedline =
    noRedlineEvent !== undefined && replayTime >= noRedlineEvent.timeSec;

  // ── Wrong-gear detection ─────────────────────────────────────────────────
  const wrongGearEvent = failureEvents.find((e) => e.type === "wrong_gear");
  const showWrongGear =
    wrongGearEvent !== undefined && inPull;

  // ── Scrubber handler ─────────────────────────────────────────────────────
  const handleSetTime = useCallback((t: number) => {
    setIsPlaying(false);
    setReplayTime(t);
  }, []);

  // ── Row count check ───────────────────────────────────────────────────────
  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-600 text-sm">
        No normalised rows available for replay.
      </div>
    );
  }

  // ── AFR vs Lambda ─────────────────────────────────────────────────────────
  const hasAfr = rows.some((r) => r.afr !== undefined);
  const hasLambda = rows.some((r) => r.lambda !== undefined);
  const afrValue = hasAfr ? afr : lambda;
  const afrMin = hasAfr ? 10 : 0.7;
  const afrMax = hasAfr ? 16 : 1.1;
  const afrLabel = hasAfr ? "AFR" : "Lambda";
  const afrDecimals = hasAfr ? 2 : 3;
  const hasAirFuel = hasAfr || hasLambda;

  // ── Gear display ─────────────────────────────────────────────────────────
  const hasGearCol = rows.some((r) => r.gear !== undefined);

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex items-center gap-3 flex-wrap text-[11px]">
        {inPull ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/25 bg-red-500/10 px-2.5 py-1 font-semibold text-red-400">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            Pull window active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/6 bg-[#0f0f0f] px-2.5 py-1 text-zinc-600">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-700" />
            {replayTime < (pullWindow?.startTime ?? Infinity) ? "Pre-pull" : "Post-pull"}
          </span>
        )}

        {showEarlyLift && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/25 bg-red-500/10 px-2.5 py-1 font-bold text-red-400 animate-pulse">
            ⚠ Early lift detected
          </span>
        )}

        {nearTypes.size > 0 &&
          !showEarlyLift &&
          Array.from(nearTypes).map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 font-semibold text-amber-400"
            >
              ⚠ {t.replace(/_/g, " ")}
            </span>
          ))}
      </div>

      {/* ── Gauge grid ───────────────────────────────────────────────── */}
      {/*  Row 1 (primary): RPM · Speed · Gear · Throttle */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <TelemetryGauge
          label="RPM"
          value={rpm}
          min={0}
          max={8000}
          color="#ef4444"
          decimals={0}
          large
          warning={showNoRedline && replayTime >= (noRedlineEvent?.timeSec ?? Infinity) ? "Lifted" : undefined}
        />

        <TelemetryGauge
          label="Speed"
          value={speed}
          min={0}
          max={130}
          unit="mph"
          color="#60a5fa"
          decimals={1}
          large
        />

        {hasGearCol ? (
          <TelemetryCard
            label="Gear"
            value={gear ?? "—"}
            warning={showWrongGear ? "Wrong gear" : undefined}
          />
        ) : (
          <TelemetryCard label="Gear" value="—" muted />
        )}

        <TelemetryGauge
          label="Throttle"
          value={throttle}
          min={0}
          max={100}
          unit="%"
          color="#f97316"
          decimals={1}
          warning={showEarlyLift ? "Early lift" : undefined}
        />
      </div>

      {/*  Row 2 (secondary): Boost · AFR/Lambda · Ign Timing · Knock */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <TelemetryGauge
          label="Boost"
          value={boost}
          min={0}
          max={25}
          unit="psi"
          color="#22d3ee"
          decimals={1}
        />

        {hasAirFuel ? (
          <TelemetryGauge
            label={afrLabel}
            value={afrValue}
            min={afrMin}
            max={afrMax}
            color="#c084fc"
            decimals={afrDecimals}
          />
        ) : (
          <TelemetryCard label="AFR" value="—" muted />
        )}

        <TelemetryGauge
          label="Ign Timing"
          value={timing}
          min={-10}
          max={50}
          unit="°"
          color="#facc15"
          decimals={1}
        />

        <TelemetryGauge
          label="Knock"
          value={knock}
          min={0}
          max={10}
          unit="°"
          color="#fb7185"
          decimals={1}
          warning={knock !== undefined && knock > 3 ? "High knock" : undefined}
        />
      </div>

      {/* ── Replay controls ───────────────────────────────────────── */}
      <PullReplayControls
        rows={rows}
        replayTime={replayTime}
        setReplayTime={handleSetTime}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        playbackRate={playbackRate}
        setPlaybackRate={(r) => setPlaybackRate(r as 1 | 2 | 4)}
        pullWindow={pullWindow}
      />
    </div>
  );
}
