"use client";

/**
 * TelemetryCard — flat numeric card for channels that don't benefit from an
 * arc gauge (e.g. gear number, status flags).
 */

interface Props {
  label: string;
  value: number | string | undefined;
  unit?: string;
  color?: string;
  /** Badge text shown below the value */
  warning?: string;
  /** Subdued style — value is not the focus */
  muted?: boolean;
}

export function TelemetryCard({
  label,
  value,
  unit,
  color,
  warning,
  muted = false,
}: Props) {
  const display = value !== undefined && value !== null ? String(value) : "—";

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border px-3 py-4 gap-1 min-h-[110px] ${
        warning
          ? "border-red-500/20 bg-red-500/5"
          : "border-white/6 bg-[#0f0f0f]"
      }`}
    >
      <div
        className={`text-3xl font-bold tabular-nums leading-none ${muted ? "text-zinc-400" : "text-white"}`}
        style={color && !warning ? { color } : undefined}
      >
        {display}
      </div>

      {unit && (
        <div className="text-[10px] text-zinc-600 leading-none">{unit}</div>
      )}

      <div className="text-[9px] font-semibold uppercase tracking-widest text-zinc-600 leading-none mt-0.5">
        {label}
      </div>

      {warning && (
        <span className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2 py-0.5 animate-pulse leading-none">
          {warning}
        </span>
      )}
    </div>
  );
}
