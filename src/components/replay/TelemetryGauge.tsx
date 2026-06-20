"use client";

/**
 * TelemetryGauge — SVG horseshoe arc gauge.
 *
 * The arc spans 270° (from 7:30 to 4:30 clockwise), leaving a small gap at
 * the bottom — the classic automotive gauge shape.  The fill length is driven
 * by  (value - min) / (max - min)  and transitions at 80ms for smooth replay.
 *
 * Arc math:
 *   R   = 44px
 *   C   = 2πR ≈ 276.46
 *   SWEEP_LEN  = C × 0.75  (270°)
 *   Fill starts at 135° from 3-o'clock → transform="rotate(135, 60, 55)"
 */

interface Props {
  label: string;
  value: number | undefined;
  min?: number;
  max: number;
  unit?: string;
  color: string;
  /** Decimal places shown in the value text */
  decimals?: number;
  /** Badge text shown below the value (e.g. "Early lift") */
  warning?: string;
  /** Larger font for primary gauges (RPM, Speed) */
  large?: boolean;
}

const R = 44;
const CIRC = 2 * Math.PI * R;       // ≈ 276.46
const SWEEP_LEN = CIRC * 0.75;       // ≈ 207.35  (270°)
const GAP_LEN = CIRC - SWEEP_LEN;    // ≈  69.12  (90°)

export function TelemetryGauge({
  label,
  value,
  min = 0,
  max,
  unit,
  color,
  decimals = 0,
  warning,
  large = false,
}: Props) {
  const pct =
    value !== undefined
      ? Math.max(0, Math.min(1, (value - min) / (max - min)))
      : 0;

  const fillLen = SWEEP_LEN * pct;

  const display =
    value !== undefined ? value.toFixed(decimals) : "—";

  const valueFontSize = large ? 22 : 18;
  const valueColor = warning ? "#f87171" : "white";

  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg viewBox="0 0 120 108" className="w-full max-w-[150px]" aria-label={label}>
        {/* Background track (full 270° arc) */}
        <circle
          cx="60"
          cy="58"
          r={R}
          fill="none"
          stroke="#1a1a1a"
          strokeWidth="8"
          strokeDasharray={`${SWEEP_LEN} ${GAP_LEN}`}
          strokeLinecap="round"
          transform="rotate(135 60 58)"
        />

        {/* Value arc (colored fill) */}
        {value !== undefined && fillLen > 0.5 && (
          <circle
            cx="60"
            cy="58"
            r={R}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={`${fillLen} ${CIRC - fillLen}`}
            strokeLinecap="round"
            transform="rotate(135 60 58)"
            style={{ transition: "stroke-dasharray 0.08s linear" }}
          />
        )}

        {/* Warning pulse ring */}
        {warning && (
          <circle
            cx="60"
            cy="58"
            r={R - 6}
            fill="rgba(239,68,68,0.08)"
            stroke="rgba(239,68,68,0.2)"
            strokeWidth="1"
          />
        )}

        {/* Numeric value */}
        <text
          x="60"
          y={value !== undefined && unit ? "53" : "58"}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={valueFontSize}
          fontWeight="700"
          fill={valueColor}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {display}
        </text>

        {/* Unit */}
        {unit && (
          <text
            x="60"
            y="70"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="9"
            fill="#52525b"
          >
            {unit}
          </text>
        )}
      </svg>

      {/* Label */}
      <p className="text-[9px] font-semibold uppercase tracking-widest text-zinc-600 leading-none">
        {label}
      </p>

      {/* Warning badge */}
      {warning && (
        <span className="mt-1 text-[9px] font-bold leading-none text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2 py-0.5 animate-pulse">
          {warning}
        </span>
      )}
    </div>
  );
}
