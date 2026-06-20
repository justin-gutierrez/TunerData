/**
 * Default / preset validation templates for each supported log mode.
 */

import type { ValidationTemplate } from "@/lib/schema/validation-rules";
export { FORTY_ROLL_TEMPLATE } from "@/lib/schema/validation-rules";

// ─── Shared required-channel sets ────────────────────────────────────────────

const PULL_REQUIRED_CHANNELS: ValidationTemplate["requiredChannels"] = [
  { type: "single", field: "timeSec",          label: "Time",                                 required: true  },
  { type: "single", field: "rpm",               label: "RPM",                                  required: true  },
  { type: "single", field: "speedMph",          label: "Vehicle speed",                        required: true  },
  { type: "oneOf",  fields: ["throttlePct", "acceleratorPct"], label: "Throttle or pedal position", required: true  },
  { type: "oneOf",  fields: ["afr", "lambda"],  label: "AFR or lambda",                        required: true  },
  { type: "single", field: "ignitionTimingDeg", label: "Ignition timing",                      required: true  },
  { type: "oneOf",  fields: ["knockRetardDeg", "timingCorrectionCylinders"], label: "Knock retard or timing correction", required: true  },
  { type: "oneOf",  fields: ["boostPsi", "mapKpa"], label: "Boost or MAP",                     required: false },
  { type: "single", field: "iatF",              label: "Intake air temp",                      required: false },
];

const IDLE_REQUIRED_CHANNELS: ValidationTemplate["requiredChannels"] = [
  { type: "single", field: "timeSec",          label: "Time",                                 required: true  },
  { type: "single", field: "rpm",               label: "RPM",                                  required: true  },
  { type: "single", field: "speedMph",          label: "Vehicle speed",                        required: true  },
  { type: "oneOf",  fields: ["throttlePct", "acceleratorPct"], label: "Throttle or pedal position", required: true  },
  { type: "oneOf",  fields: ["afr", "lambda"],  label: "AFR or lambda",                        required: true  },
  { type: "single", field: "coolantTempF",      label: "Coolant temp",                         required: false },
  { type: "single", field: "iatF",              label: "Intake air temp",                      required: false },
];

const CRUISE_REQUIRED_CHANNELS: ValidationTemplate["requiredChannels"] = [
  { type: "single", field: "timeSec",          label: "Time",                                 required: true  },
  { type: "single", field: "rpm",               label: "RPM",                                  required: true  },
  { type: "single", field: "speedMph",          label: "Vehicle speed",                        required: true  },
  { type: "oneOf",  fields: ["throttlePct", "acceleratorPct"], label: "Throttle or pedal position", required: true  },
  { type: "oneOf",  fields: ["afr", "lambda"],  label: "AFR or lambda",                        required: true  },
  { type: "single", field: "ignitionTimingDeg", label: "Ignition timing",                      required: false },
  { type: "single", field: "iatF",              label: "Intake air temp",                      required: false },
];

// ─── Preset templates ─────────────────────────────────────────────────────────

export const THIRD_GEAR_WOT_TEMPLATE: ValidationTemplate = {
  id: "3rd-gear-wot-2.5k-redline",
  name: "3rd Gear WOT — 2.5k to Redline",
  description:
    "WOT pull in 3rd gear starting around 2,500 RPM to redline. " +
    "No rolling-start speed requirement. Throttle must be held to redline with no early lift.",
  mode: "wot_pull",

  requiredChannels: PULL_REQUIRED_CHANNELS,

  roll:  { enabled: false },
  wot:   { enabled: true, minThrottlePct: 90, failOnEarlyLift: true, minPullDurationSec: 4.0 },
  rpm:   { startRpm: 2500, startRpmTolerance: 400, targetEndRpm: 6500, requireEndRpm: true },
  gear:  { requiredGear: 3, allowEstimatedGear: true },

  dataQualityRules: { minSampleRateHz: 5, maxMissingValuePct: 5, allowDuplicateTimestamps: false },
};

export const IDLE_LOG_TEMPLATE: ValidationTemplate = {
  id: "idle-log-warm",
  name: "Idle Log — Warm Engine",
  description:
    "Stationary idle log. Validates vehicle speed near 0, low throttle, stable RPM, " +
    "adequate coolant temperature, and minimum session duration.",
  mode: "idle",

  requiredChannels: IDLE_REQUIRED_CHANNELS,

  idle: {
    minDurationSec:     30,
    maxVehicleSpeedMph: 2,
    maxThrottlePct:     5,
    minCoolantTempF:    170,
    requireStableRpm:   true,
  },

  dataQualityRules: { minSampleRateHz: 2, maxMissingValuePct: 10, allowDuplicateTimestamps: false },
};

export const CRUISE_LOG_TEMPLATE: ValidationTemplate = {
  id: "cruise-log-55mph",
  name: "Cruise Log — 55 mph",
  description:
    "Steady-state cruise log around 55 mph with moderate throttle. " +
    "Validates speed and RPM stability, throttle range, and minimum session duration.",
  mode: "cruise",

  requiredChannels: CRUISE_REQUIRED_CHANNELS,

  cruise: {
    minDurationSec:    45,
    targetSpeedMph:    55,
    speedToleranceMph: 10,
    minThrottlePct:    5,
    maxThrottlePct:    45,
    requireStableSpeed: true,
    requireStableRpm:   true,
  },

  dataQualityRules: { minSampleRateHz: 2, maxMissingValuePct: 10, allowDuplicateTimestamps: false },
};

// ─── Ordered preset list (selector order) ────────────────────────────────────

export const PRESET_TEMPLATES: ValidationTemplate[] = [
  // The 40-roll template is imported from validation-rules so the old import path still works
  {
    id: "40-roll-4th-2k-redline",
    name: "40 Roll - 4th Gear - 2k RPM to Redline",
    description:
      "Rolling 40 mph pull in 4th gear from 2,000 RPM to redline (~6,500 RPM). " +
      "Full throttle must be maintained throughout with no lift before target RPM.",
    mode: "roll_pull",
    requiredChannels: PULL_REQUIRED_CHANNELS,
    roll:  { enabled: true, targetSpeedMph: 40, speedToleranceMph: 7 },
    wot:   { enabled: true, minThrottlePct: 90, failOnEarlyLift: true, minPullDurationSec: 5.0 },
    rpm:   { startRpm: 2000, startRpmTolerance: 400, targetEndRpm: 6500, requireEndRpm: true },
    gear:  { requiredGear: 4, allowEstimatedGear: true },
    dataQualityRules: { minSampleRateHz: 5, maxMissingValuePct: 5, allowDuplicateTimestamps: false },
  },
  THIRD_GEAR_WOT_TEMPLATE,
  IDLE_LOG_TEMPLATE,
  CRUISE_LOG_TEMPLATE,
];

/** Get a preset by id */
export function getPreset(id: string): ValidationTemplate | undefined {
  return PRESET_TEMPLATES.find((t) => t.id === id);
}
