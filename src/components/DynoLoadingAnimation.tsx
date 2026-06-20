"use client";

/**
 * DynoLoadingAnimation — decorative dyno-style loading screen.
 *
 * Shown while parse + validation runs in the background.
 * Calls `onComplete` after DYNO_ANIMATION_MS so the demo page can reveal
 * results.  The actual validation stores its output in refs and is never
 * blocked by this component.
 *
 * Layers:
 *  1. Car silhouette (subtle bounce vibration)
 *  2. Two dyno rollers with spinning spokes (Framer Motion rotate loop)
 *  3. Progress bar filling 0 → 100 % over the full animation duration
 *  4. Step text that advances through the 7 processing stages
 *  5. Step indicator dots
 */

import { useState, useEffect } from "react";
import { motion } from "motion/react";

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  "Parsing CSV",
  "Detecting source format",
  "Mapping columns",
  "Normalizing units",
  "Finding pull window",
  "Checking tuner rules",
  "Generating report",
] as const;

/** Total duration of the loading animation in ms */
export const DYNO_ANIMATION_MS = 2000;

const STEP_MS = DYNO_ANIMATION_MS / STEPS.length;   // ≈ 285 ms per step
const TICK_MS = 40;                                  // progress update interval

// ─── Roller SVG group (spinning spokes) ──────────────────────────────────────

interface RollerProps {
  /** Center X in SVG units */
  cx: number;
  /** Center Y in SVG units */
  cy: number;
  /** One full rotation in seconds */
  period?: number;
}

function Roller({ cx, cy, period = 0.55 }: RollerProps) {
  return (
    <motion.g
      animate={{ rotate: [0, 360] }}
      transition={{ duration: period, repeat: Infinity, ease: "linear" }}
      // Use SVG transform syntax to position + rotate in one step
      transformTemplate={({ rotate }) =>
        `translate(${cx} ${cy}) rotate(${Number(rotate) || 0})`
      }
    >
      {/* Roller drum */}
      <circle r="11" fill="#111" stroke="#222" strokeWidth="1.5" />
      {/* Cross spokes */}
      <line x1="-11" y1="0" x2="11" y2="0" stroke="#2d2d2d" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="0" y1="-11" x2="0" y2="11" stroke="#2d2d2d" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="-7.8" y1="-7.8" x2="7.8" y2="7.8" stroke="#222" strokeWidth="1" />
      <line x1="7.8" y1="-7.8" x2="-7.8" y2="7.8" stroke="#222" strokeWidth="1" />
      {/* Hub */}
      <circle r="2.5" fill="#1f1f1f" stroke="#333" strokeWidth="0.5" />
    </motion.g>
  );
}

// ─── Dyno rig scene ───────────────────────────────────────────────────────────

function DynoRig() {
  return (
    <div className="w-full max-w-[280px] mx-auto select-none">
      <svg viewBox="0 0 240 132" className="w-full overflow-visible" aria-hidden>
        {/* ── Dyno base platform ─────────────────────────────────── */}
        <rect x="8" y="108" width="224" height="7" rx="3" fill="#111" stroke="#1a1a1a" strokeWidth="1" />

        {/* Dyno surface highlights */}
        <rect x="20" y="109" width="60" height="1.5" rx="0.75" fill="#1f1f1f" />
        <rect x="160" y="109" width="60" height="1.5" rx="0.75" fill="#1f1f1f" />

        {/* ── Spinning rollers ───────────────────────────────────── */}
        <Roller cx={72}  cy={108} period={0.5} />
        <Roller cx={168} cy={108} period={0.5} />

        {/* ── Car silhouette (bounces slightly = dyno vibration) ─── */}
        <motion.g
          animate={{ y: [0, -1, 0.5, -0.8, 0] }}
          transition={{ duration: 0.45, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Lower body */}
          <rect x="18" y="68" width="204" height="24" rx="4" fill="#252525" />

          {/* Cabin / upper body */}
          <path
            d="M 52,68 L 72,36 Q 88,20 120,20 Q 154,20 170,36 L 188,68 Z"
            fill="#252525"
          />

          {/* Windshield + side glass */}
          <path
            d="M 77,66 L 91,40 Q 100,26 120,24 Q 144,24 158,40 L 168,66 Z"
            fill="#080f1a"
            opacity="0.88"
          />
          {/* Centre pillar */}
          <line x1="120" y1="24" x2="120" y2="66" stroke="#1a1a1a" strokeWidth="2" />

          {/* Headlight cluster */}
          <rect x="18" y="72" width="16" height="10" rx="2" fill="#ef4444" opacity="0.9" />
          <rect x="18" y="72" width="5" height="10" rx="1.5" fill="#fca5a5" opacity="0.5" />

          {/* DRL strip */}
          <rect x="18" y="83" width="16" height="2" rx="1" fill="#ef4444" opacity="0.3" />

          {/* Taillight */}
          <rect x="206" y="72" width="16" height="10" rx="2" fill="#ef4444" opacity="0.75" />

          {/* Body crease line */}
          <line x1="34" y1="76" x2="206" y2="76" stroke="#1f1f1f" strokeWidth="0.75" opacity="0.6" />

          {/* Mirror */}
          <rect x="185" y="42" width="12" height="7" rx="2" fill="#1f1f1f" stroke="#2a2a2a" strokeWidth="0.5" />

          {/* Front wheel */}
          <circle cx="72" cy="90" r="19" fill="#0c0c0c" />
          <circle cx="72" cy="90" r="14" fill="#181818" stroke="#252525" strokeWidth="2" />
          <circle cx="72" cy="90" r="5"  fill="#1e1e1e" />

          {/* Rear wheel */}
          <circle cx="168" cy="90" r="19" fill="#0c0c0c" />
          <circle cx="168" cy="90" r="14" fill="#181818" stroke="#252525" strokeWidth="2" />
          <circle cx="168" cy="90" r="5"  fill="#1e1e1e" />
        </motion.g>

        {/* ── Exhaust heat shimmer (subtle decorative) ──────────── */}
        {[0, 1, 2].map((i) => (
          <motion.ellipse
            key={i}
            cx={14}
            cy={78 + i * 3}
            rx="2"
            ry="1.2"
            fill="rgba(239,68,68,0.18)"
            animate={{ cx: [14, 2, -10], opacity: [0.18, 0.08, 0] }}
            transition={{
              duration: 0.9,
              delay: i * 0.28,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        ))}
      </svg>

      {/* Small "DYNO" label under the rig */}
      <p className="text-center text-[9px] font-bold tracking-[0.25em] text-zinc-700 mt-1 uppercase">
        Dyno rig
      </p>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface Props {
  onComplete: () => void;
}

export function DynoLoadingAnimation({ onComplete }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Advance through processing steps
    const stepId = setInterval(() => {
      setStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
    }, STEP_MS);

    // Smooth progress bar
    const progressId = setInterval(() => {
      setProgress((prev) =>
        Math.min(prev + (100 * TICK_MS) / DYNO_ANIMATION_MS, 100)
      );
    }, TICK_MS);

    // Signal completion
    const doneId = setTimeout(onComplete, DYNO_ANIMATION_MS);

    return () => {
      clearInterval(stepId);
      clearInterval(progressId);
      clearTimeout(doneId);
    };
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex flex-col items-center justify-center min-h-[480px] gap-8 px-6"
    >
      {/* Header */}
      <div className="text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-1">
          TunerData
        </p>
        <p className="text-xl font-bold text-white">Running Validation</p>
        <p className="text-xs text-zinc-600 mt-1">All processing runs in your browser</p>
      </div>

      {/* Dyno scene */}
      <DynoRig />

      {/* Progress block */}
      <div className="w-full max-w-sm space-y-4">
        {/* Bar */}
        <div className="h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-red-700 via-red-500 to-orange-400"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step label + percentage */}
        <div className="flex items-center justify-between text-xs">
          <motion.span
            key={stepIndex}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18 }}
            className="text-zinc-300 font-medium"
          >
            {STEPS[stepIndex]}
            <motion.span
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="text-red-400"
            >
              …
            </motion.span>
          </motion.span>
          <span className="font-mono text-zinc-600">{Math.round(progress)}%</span>
        </div>

        {/* Step dot indicators */}
        <div className="flex items-center gap-1.5 justify-center">
          {STEPS.map((_, i) => (
            <motion.div
              key={i}
              className="h-1 rounded-full bg-red-500"
              animate={{
                width: i === stepIndex ? 16 : i < stepIndex ? 12 : 4,
                opacity: i === stepIndex ? 1 : i < stepIndex ? 0.5 : 0.15,
              }}
              transition={{ duration: 0.25 }}
              style={{ width: 4 }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
