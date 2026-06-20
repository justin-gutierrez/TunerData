"use client";

/**
 * TemplateBuilder — a card-based form for configuring a ValidationTemplate.
 *
 * Sections that are not applicable to the selected mode are visually greyed
 * out and their inputs are disabled (not hidden) so the user can see why.
 */

import { useCallback } from "react";
import {
  Car,
  Gauge,
  FileText,
  Navigation,
  Settings2,
  ChevronDown,
} from "lucide-react";
import type { ValidationTemplate, LogValidationMode, RequiredChannelRule } from "@/lib/schema/validation-rules";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  value: ValidationTemplate;
  onChange: (t: ValidationTemplate) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MODES: { id: LogValidationMode; label: string; desc: string; Icon: React.ElementType }[] = [
  { id: "roll_pull", label: "Roll Pull",  desc: "WOT from a rolling start speed",      Icon: Car        },
  { id: "wot_pull",  label: "WOT Pull",   desc: "WOT pull without a roll-speed limit",  Icon: Gauge      },
  { id: "idle",      label: "Idle Log",   desc: "Stationary idle at operating temp",    Icon: FileText   },
  { id: "cruise",    label: "Cruise Log", desc: "Steady-state cruise at moderate load", Icon: Navigation },
];

const ROLL_SPEEDS = [20, 30, 40, 50, 60] as const;

const ALL_CHANNEL_OPTS: { field: string; label: string; isOneOf?: string[] }[] = [
  { field: "timeSec",           label: "Time"                                                 },
  { field: "rpm",               label: "RPM"                                                  },
  { field: "speedMph",          label: "Vehicle speed"                                        },
  { field: "throttlePct",       label: "Throttle or accelerator pedal", isOneOf: ["throttlePct","acceleratorPct"] },
  { field: "afr",               label: "AFR or lambda",                 isOneOf: ["afr","lambda"]                },
  { field: "ignitionTimingDeg", label: "Ignition timing"                                      },
  { field: "knockRetardDeg",    label: "Knock / timing correction",     isOneOf: ["knockRetardDeg","timingCorrectionCylinders"] },
  { field: "boostPsi",          label: "Boost or MAP",                  isOneOf: ["boostPsi","mapKpa"]           },
  { field: "iatF",              label: "Intake air temp"                                      },
  { field: "coolantTempF",      label: "Coolant temp"                                         },
  { field: "fuelPressurePsi",   label: "Fuel pressure"                                        },
];

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function SectionCard({
  title,
  disabled,
  disabledLabel,
  children,
}: {
  title: string;
  disabled?: boolean;
  disabledLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/8 bg-[#0d0d0d] p-5 transition-opacity",
        disabled ? "opacity-40" : "opacity-100"
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">{title}</h4>
        {disabled && disabledLabel && (
          <span className="text-[10px] text-zinc-700 border border-white/6 rounded px-1.5 py-0.5">
            {disabledLabel}
          </span>
        )}
      </div>
      <fieldset disabled={disabled} className="contents">
        {children}
      </fieldset>
    </div>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-zinc-500 mb-1">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[10px] text-zinc-700">{hint}</p>}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  className,
}: {
  value: number | undefined;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}) {
  return (
    <input
      type="number"
      value={value ?? ""}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const n = parseFloat(e.target.value);
        if (!isNaN(n)) onChange(n);
      }}
      className={cn(
        "w-full rounded-md border border-white/8 bg-white/4 px-3 py-1.5 text-xs text-white",
        "placeholder-zinc-700 focus:border-red-500/40 focus:outline-none focus:ring-1 focus:ring-red-500/20",
        "disabled:cursor-not-allowed",
        className
      )}
    />
  );
}

function SelectInput({
  value,
  onChange,
  options,
}: {
  value: string | number;
  onChange: (v: string) => void;
  options: { value: string | number; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          // Use a solid dark background so the native OS dropdown also renders dark.
          // bg-white/4 is semi-transparent and collapses to near-white in the
          // native picker, making white text invisible.
          "w-full appearance-none rounded-md border border-white/10 bg-[#1a1a1a] px-3 py-1.5 text-xs text-zinc-100",
          "focus:border-red-500/40 focus:outline-none focus:ring-1 focus:ring-red-500/20",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        {options.map((o) => (
          // Explicit bg/color on <option> so the OS dropdown list is also dark.
          <option
            key={String(o.value)}
            value={String(o.value)}
            style={{ backgroundColor: "#1a1a1a", color: "#f4f4f5" }}
          >
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-500" />
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 accent-red-500 disabled:cursor-not-allowed"
      />
      <span className="text-xs text-zinc-400 group-hover:text-zinc-200 transition-colors">{label}</span>
    </label>
  );
}

// ─── Default required-channels builder ────────────────────────────────────────

function defaultRequiredChannels(mode: LogValidationMode): RequiredChannelRule[] {
  const isPull   = mode === "roll_pull" || mode === "wot_pull";
  const isIdle   = mode === "idle";

  return ALL_CHANNEL_OPTS.map((opt): RequiredChannelRule => {
    const required =
      opt.field === "timeSec"           ? true :
      opt.field === "rpm"               ? true :
      opt.field === "speedMph"          ? true :
      opt.field === "throttlePct"       ? true :
      opt.field === "afr"               ? true :
      opt.field === "ignitionTimingDeg" ? isPull :
      opt.field === "knockRetardDeg"    ? isPull :
      opt.field === "boostPsi"          ? false :
      opt.field === "iatF"              ? false :
      opt.field === "coolantTempF"      ? isIdle :
      opt.field === "fuelPressurePsi"   ? false :
      false;

    if (opt.isOneOf) {
      return { type: "oneOf", fields: opt.isOneOf, label: opt.label, required };
    }
    return { type: "single", field: opt.field, label: opt.label, required };
  });
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TemplateBuilder({ value: t, onChange }: Props) {
  const update = useCallback(
    (patch: Partial<ValidationTemplate>) => onChange({ ...t, ...patch }),
    [t, onChange]
  );

  const mode       = t.mode;
  const isPull     = mode === "roll_pull" || mode === "wot_pull";
  const isRollPull = mode === "roll_pull";
  const isWot      = mode === "wot_pull";
  const isIdle     = mode === "idle";
  const isCruise   = mode === "cruise";

  // Roll section is active for roll_pull always, or wot_pull when roll.enabled
  const rollActive = isRollPull || (isWot && (t.roll?.enabled ?? false));
  const rpmActive  = isPull;
  const gearActive = isPull;
  const wotActive  = isPull;

  function handleModeChange(newMode: LogValidationMode) {
    // Reset mode-specific fields and rebuild required channels
    const base: ValidationTemplate = {
      ...t,
      mode: newMode,
      requiredChannels: defaultRequiredChannels(newMode),
    };
    if (newMode === "roll_pull") {
      base.roll  = { enabled: true,  targetSpeedMph: 40, speedToleranceMph: 7 };
      base.wot   = { enabled: true,  minThrottlePct: 90, failOnEarlyLift: true, minPullDurationSec: 5.0 };
      base.rpm   = { startRpm: 2000, startRpmTolerance: 400, targetEndRpm: 6500, requireEndRpm: true };
      base.gear  = { requiredGear: 4, allowEstimatedGear: true };
      base.idle   = undefined;
      base.cruise = undefined;
    } else if (newMode === "wot_pull") {
      base.roll  = { enabled: false };
      base.wot   = { enabled: true, minThrottlePct: 90, failOnEarlyLift: true, minPullDurationSec: 4.0 };
      base.rpm   = { startRpm: 2500, startRpmTolerance: 400, targetEndRpm: 6500, requireEndRpm: true };
      base.gear  = { requiredGear: null, allowEstimatedGear: true };
      base.idle   = undefined;
      base.cruise = undefined;
    } else if (newMode === "idle") {
      base.roll  = undefined; base.wot = undefined; base.rpm = undefined; base.gear = undefined;
      base.cruise = undefined;
      base.idle   = { minDurationSec: 30, maxVehicleSpeedMph: 2, maxThrottlePct: 5, minCoolantTempF: 170, requireStableRpm: true };
    } else {
      base.roll  = undefined; base.wot = undefined; base.rpm = undefined; base.gear = undefined;
      base.idle   = undefined;
      base.cruise = { minDurationSec: 45, targetSpeedMph: 55, speedToleranceMph: 10, minThrottlePct: 5, maxThrottlePct: 45, requireStableSpeed: true, requireStableRpm: true };
    }
    onChange(base);
  }

  function toggleRequiredChannel(field: string, required: boolean) {
    const updated = t.requiredChannels.map((r) => {
      const primaryField = r.type === "single" ? r.field : r.fields[0];
      if (primaryField === field) return { ...r, required };
      return r;
    });
    update({ requiredChannels: updated });
  }

  return (
    <div className="space-y-4">
      {/* Template name */}
      <SectionCard title="Template name">
        <input
          type="text"
          value={t.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="e.g. My 3rd Gear Pull"
          className="w-full rounded-md border border-white/8 bg-white/4 px-3 py-1.5 text-xs text-white placeholder-zinc-700 focus:border-red-500/40 focus:outline-none focus:ring-1 focus:ring-red-500/20"
        />
      </SectionCard>

      {/* Mode selector */}
      <SectionCard title="Log type">
        <div className="grid grid-cols-2 gap-2">
          {MODES.map(({ id, label, desc, Icon }) => {
            const active = mode === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleModeChange(id)}
                className={cn(
                  "flex items-start gap-2.5 rounded-lg border p-3 text-left transition-all",
                  active
                    ? "border-red-500/40 bg-red-500/8"
                    : "border-white/6 bg-white/3 hover:border-white/12 hover:bg-white/5"
                )}
              >
                <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", active ? "text-red-400" : "text-zinc-600")} />
                <div>
                  <p className={cn("text-xs font-semibold", active ? "text-red-300" : "text-zinc-300")}>
                    {label}
                  </p>
                  <p className="text-[10px] text-zinc-600 leading-snug mt-0.5">{desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </SectionCard>

      {/* Roll section */}
      <SectionCard
        title="Roll start"
        disabled={!rollActive && !isWot}
        disabledLabel={isIdle ? "Disabled for Idle Log" : isCruise ? "Disabled for Cruise Log" : undefined}
      >
        {isWot && (
          <div className="mb-3">
            <Checkbox
              checked={t.roll?.enabled ?? false}
              onChange={(v) => update({ roll: { ...t.roll, enabled: v } })}
              label="This is a roll start (enable roll-speed check)"
            />
          </div>
        )}
        <div className={cn("grid grid-cols-2 gap-3", !rollActive && "pointer-events-none")}>
          <Field label="Roll speed">
            <div className="flex gap-1.5">
              <SelectInput
                value={
                  ROLL_SPEEDS.includes(t.roll?.targetSpeedMph as typeof ROLL_SPEEDS[number])
                    ? (t.roll?.targetSpeedMph ?? 40)
                    : "custom"
                }
                onChange={(v) => {
                  if (v === "custom") return;
                  update({ roll: { ...t.roll, enabled: t.roll?.enabled ?? true, targetSpeedMph: parseInt(v) } });
                }}
                options={[
                  ...ROLL_SPEEDS.map((s) => ({ value: s, label: `${s} mph` })),
                  { value: "custom", label: "Custom" },
                ]}
              />
            </div>
          </Field>
          <Field label="Speed tolerance (mph)">
            <NumberInput
              value={t.roll?.speedToleranceMph}
              onChange={(v) => update({ roll: { ...t.roll, enabled: t.roll?.enabled ?? true, targetSpeedMph: t.roll?.targetSpeedMph ?? 40, speedToleranceMph: v } })}
              min={1}
              max={20}
            />
          </Field>
        </div>
      </SectionCard>

      {/* RPM section */}
      <SectionCard
        title="RPM targets"
        disabled={!rpmActive}
        disabledLabel={isIdle ? "Disabled for Idle Log" : isCruise ? "Disabled for Cruise Log" : undefined}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start RPM">
            <NumberInput
              value={t.rpm?.startRpm}
              onChange={(v) => update({ rpm: { ...t.rpm, startRpm: v } })}
              min={500}
              max={8000}
              step={100}
            />
          </Field>
          <Field label="Start RPM tolerance">
            <NumberInput
              value={t.rpm?.startRpmTolerance}
              onChange={(v) => update({ rpm: { ...t.rpm, startRpmTolerance: v } })}
              min={50}
              max={1000}
              step={50}
            />
          </Field>
          <Field label="Target end RPM (redline)">
            <NumberInput
              value={t.rpm?.targetEndRpm}
              onChange={(v) => update({ rpm: { ...t.rpm, targetEndRpm: v } })}
              min={2000}
              max={12000}
              step={100}
            />
          </Field>
          <Field label="">
            <div className="mt-4">
              <Checkbox
                checked={t.rpm?.requireEndRpm !== false}
                onChange={(v) => update({ rpm: { ...t.rpm, requireEndRpm: v } })}
                label="Require pull to reach end RPM"
              />
            </div>
          </Field>
        </div>
      </SectionCard>

      {/* Gear section */}
      <SectionCard
        title="Gear"
        disabled={!gearActive}
        disabledLabel={isIdle ? "Disabled for Idle Log" : isCruise ? "Disabled for Cruise Log" : undefined}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Required gear">
            <SelectInput
              value={t.gear?.requiredGear ?? "null"}
              onChange={(v) =>
                update({ gear: { ...t.gear, requiredGear: v === "null" ? null : parseInt(v) } })
              }
              options={[
                { value: "null", label: "Any gear" },
                ...[1, 2, 3, 4, 5, 6, 7, 8].map((g) => ({ value: g, label: `Gear ${g}` })),
              ]}
            />
          </Field>
          <Field label="">
            <div className="mt-4">
              <Checkbox
                checked={t.gear?.allowEstimatedGear !== false}
                onChange={(v) => update({ gear: { ...t.gear, allowEstimatedGear: v } })}
                label="Allow estimated gear if column missing"
              />
            </div>
          </Field>
        </div>
      </SectionCard>

      {/* WOT / throttle section */}
      <SectionCard
        title="Throttle / WOT"
        disabled={!wotActive}
        disabledLabel={isIdle ? "Disabled for Idle Log" : isCruise ? "Disabled for Cruise Log" : undefined}
      >
        <div className="space-y-3">
          <Checkbox
            checked={t.wot?.enabled !== false}
            onChange={(v) => update({ wot: { ...t.wot, enabled: v } })}
            label="Require WOT (wide-open throttle)"
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Minimum throttle (%)">
              <NumberInput
                value={t.wot?.minThrottlePct}
                onChange={(v) => update({ wot: { ...t.wot, enabled: t.wot?.enabled ?? true, minThrottlePct: v } })}
                min={50}
                max={100}
              />
            </Field>
            <Field label="Min pull duration (s)">
              <NumberInput
                value={t.wot?.minPullDurationSec}
                onChange={(v) => update({ wot: { ...t.wot, enabled: t.wot?.enabled ?? true, minPullDurationSec: v } })}
                min={1}
                max={60}
                step={0.5}
              />
            </Field>
          </div>
          <Checkbox
            checked={t.wot?.failOnEarlyLift !== false}
            onChange={(v) => update({ wot: { ...t.wot, enabled: t.wot?.enabled ?? true, failOnEarlyLift: v } })}
            label="Fail on early throttle lift before target RPM"
          />
        </div>
      </SectionCard>

      {/* Idle section */}
      <SectionCard
        title="Idle settings"
        disabled={!isIdle}
        disabledLabel={!isIdle ? "Enabled for Idle Log only" : undefined}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Min duration (s)">
            <NumberInput
              value={t.idle?.minDurationSec}
              onChange={(v) => update({ idle: { ...t.idle, minDurationSec: v } })}
              min={5}
              max={300}
            />
          </Field>
          <Field label="Max vehicle speed (mph)">
            <NumberInput
              value={t.idle?.maxVehicleSpeedMph}
              onChange={(v) => update({ idle: { ...t.idle, maxVehicleSpeedMph: v } })}
              min={0}
              max={10}
            />
          </Field>
          <Field label="Max throttle (%)">
            <NumberInput
              value={t.idle?.maxThrottlePct}
              onChange={(v) => update({ idle: { ...t.idle, maxThrottlePct: v } })}
              min={0}
              max={20}
            />
          </Field>
          <Field label="Min coolant temp (°F)">
            <NumberInput
              value={t.idle?.minCoolantTempF}
              onChange={(v) => update({ idle: { ...t.idle, minCoolantTempF: v } })}
              min={0}
              max={250}
            />
          </Field>
        </div>
        <div className="mt-3">
          <Checkbox
            checked={t.idle?.requireStableRpm !== false}
            onChange={(v) => update({ idle: { ...t.idle, requireStableRpm: v } })}
            label="Require stable RPM"
          />
        </div>
      </SectionCard>

      {/* Cruise section */}
      <SectionCard
        title="Cruise settings"
        disabled={!isCruise}
        disabledLabel={!isCruise ? "Enabled for Cruise Log only" : undefined}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Min duration (s)">
            <NumberInput
              value={t.cruise?.minDurationSec}
              onChange={(v) => update({ cruise: { ...t.cruise, minDurationSec: v } })}
              min={10}
              max={600}
            />
          </Field>
          <Field label="Target speed (mph)">
            <NumberInput
              value={t.cruise?.targetSpeedMph}
              onChange={(v) => update({ cruise: { ...t.cruise, targetSpeedMph: v } })}
              min={0}
              max={200}
            />
          </Field>
          <Field label="Speed tolerance (mph)">
            <NumberInput
              value={t.cruise?.speedToleranceMph}
              onChange={(v) => update({ cruise: { ...t.cruise, speedToleranceMph: v } })}
              min={1}
              max={30}
            />
          </Field>
          <Field label="Min throttle (%)">
            <NumberInput
              value={t.cruise?.minThrottlePct}
              onChange={(v) => update({ cruise: { ...t.cruise, minThrottlePct: v } })}
              min={0}
              max={50}
            />
          </Field>
          <Field label="Max throttle (%)">
            <NumberInput
              value={t.cruise?.maxThrottlePct}
              onChange={(v) => update({ cruise: { ...t.cruise, maxThrottlePct: v } })}
              min={5}
              max={100}
            />
          </Field>
        </div>
        <div className="mt-3 space-y-2">
          <Checkbox
            checked={t.cruise?.requireStableSpeed !== false}
            onChange={(v) => update({ cruise: { ...t.cruise, requireStableSpeed: v } })}
            label="Require stable speed"
          />
          <Checkbox
            checked={t.cruise?.requireStableRpm !== false}
            onChange={(v) => update({ cruise: { ...t.cruise, requireStableRpm: v } })}
            label="Require stable RPM"
          />
        </div>
      </SectionCard>

      {/* Data quality section */}
      <SectionCard title="Data quality">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Min sample rate (Hz)">
            <NumberInput
              value={t.dataQualityRules?.minSampleRateHz}
              onChange={(v) => update({ dataQualityRules: { ...t.dataQualityRules, minSampleRateHz: v } })}
              min={1}
              max={100}
            />
          </Field>
          <Field label="Max missing values (%)">
            <NumberInput
              value={t.dataQualityRules?.maxMissingValuePct}
              onChange={(v) => update({ dataQualityRules: { ...t.dataQualityRules, maxMissingValuePct: v } })}
              min={0}
              max={50}
            />
          </Field>
        </div>
        <div className="mt-3">
          <Checkbox
            checked={t.dataQualityRules?.allowDuplicateTimestamps !== true}
            onChange={(v) => update({ dataQualityRules: { ...t.dataQualityRules, allowDuplicateTimestamps: !v } })}
            label="Disallow duplicate timestamps"
          />
        </div>
      </SectionCard>

      {/* Required channels section */}
      <SectionCard title={<span className="flex items-center gap-1.5"><Settings2 className="h-3.5 w-3.5" />Required channels</span> as unknown as string}>
        <p className="text-[11px] text-zinc-600 mb-3">
          Defaults are set based on log type. Toggle to override.
        </p>
        <div className="space-y-2">
          {ALL_CHANNEL_OPTS.map((opt) => {
            const rule = t.requiredChannels.find((r) =>
              r.type === "single" ? r.field === opt.field : r.fields[0] === opt.field
            );
            return (
              <Checkbox
                key={opt.field}
                checked={rule?.required ?? false}
                onChange={(v) => toggleRequiredChannel(opt.field, v)}
                label={opt.label}
              />
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
