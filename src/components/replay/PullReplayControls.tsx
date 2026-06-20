"use client";

import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import type { NormalizedLogRow } from "@/lib/schema/normalized-log";
import type { PullWindow } from "@/lib/schema/validation-result";
import { cn } from "@/lib/utils";

interface Props {
  rows: NormalizedLogRow[];
  replayTime: number;
  setReplayTime: (t: number) => void;
  isPlaying: boolean;
  setIsPlaying: (p: boolean) => void;
  playbackRate: number;
  setPlaybackRate: (r: number) => void;
  pullWindow?: PullWindow;
}

const RATES = [1, 2, 4] as const;

function pad(n: number): string {
  return n.toFixed(2).padStart(5, "0");
}

export function PullReplayControls({
  rows,
  replayTime,
  setReplayTime,
  isPlaying,
  setIsPlaying,
  playbackRate,
  setPlaybackRate,
  pullWindow,
}: Props) {
  if (rows.length === 0) return null;

  const startTime = rows[0].timeSec;
  const endTime = rows[rows.length - 1].timeSec;
  const duration = endTime - startTime;

  function handleScrub(e: React.ChangeEvent<HTMLInputElement>) {
    setIsPlaying(false);
    setReplayTime(Number(e.target.value));
  }

  function jumpToStart() {
    setIsPlaying(false);
    setReplayTime(startTime);
  }

  function jumpToPull() {
    if (!pullWindow) return;
    setIsPlaying(false);
    // Jump slightly before the pull to give context
    setReplayTime(Math.max(startTime, pullWindow.startTime - 0.5));
  }

  function jumpToEnd() {
    setIsPlaying(false);
    setReplayTime(endTime);
  }

  const elapsed = replayTime - startTime;
  const pct = duration > 0 ? ((replayTime - startTime) / duration) * 100 : 0;
  const inPull =
    pullWindow &&
    replayTime >= pullWindow.startTime &&
    replayTime <= pullWindow.endTime;

  return (
    <div className="rounded-xl border border-white/6 bg-[#0f0f0f] p-4 space-y-3">
      {/* Controls row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Skip to start */}
        <button
          onClick={jumpToStart}
          className="rounded-lg border border-white/8 bg-white/4 p-1.5 text-zinc-500 hover:text-zinc-200 hover:border-white/15 transition-colors"
          title="Jump to start"
        >
          <SkipBack className="h-3.5 w-3.5" />
        </button>

        {/* Play / Pause */}
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-white transition-colors",
            isPlaying
              ? "bg-zinc-700 hover:bg-zinc-600"
              : "bg-red-600 hover:bg-red-500"
          )}
        >
          {isPlaying ? (
            <>
              <Pause className="h-3.5 w-3.5" /> Pause
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" /> Play
            </>
          )}
        </button>

        {/* Skip to end */}
        <button
          onClick={jumpToEnd}
          className="rounded-lg border border-white/8 bg-white/4 p-1.5 text-zinc-500 hover:text-zinc-200 hover:border-white/15 transition-colors"
          title="Jump to end"
        >
          <SkipForward className="h-3.5 w-3.5" />
        </button>

        {/* Jump to pull window */}
        {pullWindow && (
          <button
            onClick={jumpToPull}
            className="rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-1.5 text-[11px] font-medium text-red-400 hover:bg-red-500/15 transition-colors"
          >
            Jump to pull
          </button>
        )}

        {/* Time display */}
        <span className="font-mono text-sm text-zinc-300 ml-auto">
          {pad(elapsed)}
          <span className="text-zinc-600"> / {pad(duration)}s</span>
        </span>

        {/* Playback rate */}
        <div className="flex gap-1">
          {RATES.map((r) => (
            <button
              key={r}
              onClick={() => setPlaybackRate(r)}
              className={cn(
                "rounded px-2 py-1 text-[11px] font-bold transition-colors",
                playbackRate === r
                  ? "bg-red-600/20 border border-red-500/30 text-red-400"
                  : "border border-white/8 bg-white/3 text-zinc-500 hover:text-zinc-200"
              )}
            >
              {r}×
            </button>
          ))}
        </div>
      </div>

      {/* Scrubber */}
      <div className="relative">
        {/* Pull window track highlight behind the range input */}
        {pullWindow && duration > 0 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded bg-red-500/20 pointer-events-none"
            style={{
              left: `${((pullWindow.startTime - startTime) / duration) * 100}%`,
              width: `${((pullWindow.endTime - pullWindow.startTime) / duration) * 100}%`,
            }}
          />
        )}

        <input
          type="range"
          min={startTime}
          max={endTime}
          step={0.05}
          value={replayTime}
          onChange={handleScrub}
          className="w-full cursor-pointer accent-red-500"
          style={{ height: "3px" }}
        />
      </div>

      {/* Status indicators */}
      <div className="flex items-center gap-3 text-[10px]">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              isPlaying ? "bg-red-500 animate-pulse" : "bg-zinc-700"
            )}
          />
          <span className="text-zinc-600">{isPlaying ? "Playing" : "Paused"}</span>
        </div>

        {inPull && (
          <div className="flex items-center gap-1.5 text-red-400 font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            Pull window active
          </div>
        )}

        <span className="text-zinc-700 ml-auto">
          {(pct).toFixed(0)}% through log
        </span>
      </div>
    </div>
  );
}
