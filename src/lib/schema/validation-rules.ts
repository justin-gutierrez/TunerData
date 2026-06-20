/**
 * Validation template types — supports four log modes:
 *   roll_pull  WOT pull from a rolling start speed
 *   wot_pull   WOT pull with no mandatory roll speed
 *   idle       Stationary idle log
 *   cruise     Steady-state cruising log
 */

// ─── Core types ───────────────────────────────────────────────────────────────

export type LogValidationMode = "roll_pull" | "wot_pull" | "idle" | "cruise";

/** A single required-channel rule */
export type RequiredChannelRule =
  | {
      type: "single";
      field: string;
      label: string;
      required: boolean;
    }
  | {
      type: "oneOf";
      fields: string[];
      label: string;
      required: boolean;
    };

// ─── Validation template ─────────────────────────────────────────────────────

export interface ValidationTemplate {
  /** Unique machine identifier */
  id: string;

  /** Human-readable name shown in the UI */
  name: string;

  /** One-line description of the procedure being validated */
  description?: string;

  /** Which type of log this template validates */
  mode: LogValidationMode;

  /** Channels that must (or should) be present in the log */
  requiredChannels: RequiredChannelRule[];

  /** Rolling-start settings (roll_pull always; wot_pull only when roll.enabled) */
  roll?: {
    enabled: boolean;
    targetSpeedMph?: number;
    speedToleranceMph?: number;
  };

  /** Wide-open-throttle pull settings */
  wot?: {
    enabled: boolean;
    minThrottlePct?: number;
    failOnEarlyLift?: boolean;
    minPullDurationSec?: number;
  };

  /** RPM entry / exit targets */
  rpm?: {
    startRpm?: number;
    startRpmTolerance?: number;
    targetEndRpm?: number;
    requireEndRpm?: boolean;
  };

  /** Gear requirements */
  gear?: {
    requiredGear?: number | null;
    allowEstimatedGear?: boolean;
  };

  /** Idle-specific settings (only used when mode === "idle") */
  idle?: {
    minDurationSec?: number;
    maxVehicleSpeedMph?: number;
    maxThrottlePct?: number;
    minCoolantTempF?: number;
    requireStableRpm?: boolean;
  };

  /** Cruise-specific settings (only used when mode === "cruise") */
  cruise?: {
    minDurationSec?: number;
    targetSpeedMph?: number;
    speedToleranceMph?: number;
    minThrottlePct?: number;
    maxThrottlePct?: number;
    requireStableSpeed?: boolean;
    requireStableRpm?: boolean;
  };

  /** Data-quality thresholds */
  dataQualityRules?: {
    minSampleRateHz?: number;
    maxMissingValuePct?: number;
    allowDuplicateTimestamps?: boolean;
  };
}

// ─── Legacy type alias (backward compat for older code references) ────────────
/** @deprecated Use RequiredChannelRule instead */
export type ChannelGroup = string[];

// ─── Built-in 40-Roll template ────────────────────────────────────────────────

export const FORTY_ROLL_TEMPLATE: ValidationTemplate = {
  id: "40-roll-4th-2k-redline",
  name: "40 Roll - 4th Gear - 2k RPM to Redline",
  description:
    "Rolling 40 mph pull in 4th gear from 2,000 RPM to redline (~6,500 RPM). " +
    "Full throttle must be maintained throughout with no lift before target RPM.",
  mode: "roll_pull",

  requiredChannels: [
    { type: "single", field: "timeSec",          label: "Time",                          required: true },
    { type: "single", field: "rpm",               label: "RPM",                           required: true },
    { type: "single", field: "speedMph",          label: "Vehicle speed",                 required: true },
    { type: "oneOf",  fields: ["throttlePct", "acceleratorPct"], label: "Throttle or pedal position",  required: true },
    { type: "oneOf",  fields: ["afr", "lambda"],  label: "AFR or lambda",                 required: true },
    { type: "single", field: "ignitionTimingDeg", label: "Ignition timing",               required: true },
    { type: "oneOf",  fields: ["knockRetardDeg", "timingCorrectionCylinders"], label: "Knock retard or timing correction", required: true },
  ],

  roll: { enabled: true, targetSpeedMph: 40, speedToleranceMph: 7 },
  wot:  { enabled: true, minThrottlePct: 90, failOnEarlyLift: true, minPullDurationSec: 5.0 },
  rpm:  { startRpm: 2000, startRpmTolerance: 400, targetEndRpm: 6500, requireEndRpm: true },
  gear: { requiredGear: 4, allowEstimatedGear: true },

  dataQualityRules: {
    minSampleRateHz: 5,
    maxMissingValuePct: 5,
    allowDuplicateTimestamps: false,
  },
};

/** All available built-in templates */
export const ALL_TEMPLATES: ValidationTemplate[] = [FORTY_ROLL_TEMPLATE];

/** Look up a template by its id */
export function getTemplate(id: string): ValidationTemplate | undefined {
  return ALL_TEMPLATES.find((t) => t.id === id);
}
