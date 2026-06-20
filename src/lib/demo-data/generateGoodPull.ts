/**
 * Generates a synthetic "good" 40-roll 4th gear WOT pull.
 *
 * All values are deterministic — Math.sin() is used for realistic
 * micro-variation so the CSV looks like real sensor data without any
 * actual randomness.
 *
 * Timeline:
 *   t = 0.0 – 2.9 s  (30 rows)  Pre-pull approach
 *   t = 3.0 – 9.1 s  (62 rows)  WOT pull
 *   t = 9.2 – 11.9 s (28 rows)  Post-pull lift-off
 *   Total: 120 rows at 10 Hz
 */

// ─── Internal row shape (used only inside demo-data layer) ────────────────────

export type MutablePullRow = {
  time: number;
  rpm: number;
  speedMph: number;
  gear: number;
  /** Throttle / accelerator position % */
  throttle: number;
  afr?: number;
  lambda?: number;
  boostPsi: number;
  ignitionTiming: number;
  knockRetard: number;
  iatF: number;
  coolantF: number;
};

// ─── Pull constants ───────────────────────────────────────────────────────────

export const PULL_CONFIG = {
  sampleRateHz: 10,
  totalDurationSec: 12.0,
  pullStartSec: 3.0,
  pullEndSec: 9.1,
  /** Speed/RPM conversion factor for 4th gear (mph per RPM) */
  gearRatioFactor: 0.01885,
  startRpm: 2050,
  endRpm: 6700,
  peakBoostPsi: 21.5,
  minAfrWot: 11.4,
  maxAfrWot: 12.0,
  targetGear: 4,
} as const;

// ─── Deterministic micro-variation ───────────────────────────────────────────

/** Sinusoidal noise — deterministic substitute for Math.random() */
function sn(i: number, freq: number, amp: number): number {
  return Math.sin(i * freq) * amp;
}

function round(v: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

// ─── Generator ────────────────────────────────────────────────────────────────

export function generateGoodPullRows(): MutablePullRow[] {
  const { sampleRateHz, totalDurationSec, pullStartSec, pullEndSec } = PULL_CONFIG;
  const dt = 1 / sampleRateHz;
  const totalRows = Math.round(totalDurationSec * sampleRateHz);
  const pullDuration = pullEndSec - pullStartSec;

  const rows: MutablePullRow[] = [];

  for (let i = 0; i < totalRows; i++) {
    const t = round(i * dt, 1);
    const inPull = t >= pullStartSec && t <= pullEndSec;
    const afterPull = t > pullEndSec;

    // ── Pull progress (0→1 during WOT segment) ──────────────────────────
    const pullProgress = inPull
      ? Math.min(1, (t - pullStartSec) / pullDuration)
      : 0;

    // ── RPM ─────────────────────────────────────────────────────────────
    let rpm: number;
    if (!inPull && !afterPull) {
      // Approach: rising from 1820 to 2050
      const approachProgress = t / pullStartSec;
      rpm = 1820 + approachProgress * 230 + sn(i, 1.3, 28);
    } else if (inPull) {
      // Pull: smooth rise with slight logarithmic acceleration
      const rpmRange = PULL_CONFIG.endRpm - PULL_CONFIG.startRpm;
      rpm = PULL_CONFIG.startRpm + Math.pow(pullProgress, 0.92) * rpmRange + sn(i, 1.1, 38);
    } else {
      // Post-pull: RPM drops as driver lifts
      const postProgress = (t - pullEndSec) / (totalDurationSec - pullEndSec);
      rpm = PULL_CONFIG.endRpm - postProgress * 4400 + sn(i, 1.5, 45);
    }
    rpm = Math.max(750, Math.round(rpm));

    // ── Speed (mph) ─────────────────────────────────────────────────────
    // Derived from RPM via gear ratio with tiny variation
    const speedMph = round(rpm * PULL_CONFIG.gearRatioFactor * (1 + sn(i, 2.9, 0.002)), 1);

    // ── Throttle (%) ─────────────────────────────────────────────────────
    let throttle: number;
    if (!inPull && !afterPull) {
      throttle = 28 + sn(i, 0.7, 9); // partial throttle approaching
    } else if (inPull) {
      throttle = 97.5 + sn(i, 2.1, 1.3); // WOT — 96–99%
    } else {
      const postProgress = (t - pullEndSec) / (totalDurationSec - pullEndSec);
      throttle = Math.max(3, 15 - postProgress * 12 + sn(i, 1.9, 2)); // lift-off
    }
    throttle = round(Math.min(100, Math.max(0, throttle)), 1);

    // ── AFR ─────────────────────────────────────────────────────────────
    let afr: number;
    if (inPull) {
      afr = round(11.7 + sn(i, 2.7, 0.18), 2); // rich WOT (11.4–12.0)
    } else {
      afr = round(14.3 + sn(i, 1.5, 0.25), 2); // near stoich at cruise
    }
    const lambda = round(afr / 14.7, 3);

    // ── Boost (psi) ─────────────────────────────────────────────────────
    let boostPsi: number;
    if (inPull) {
      if (pullProgress < 0.08) {
        // Rapid spool-up in first ~0.5 sec of pull
        boostPsi = pullProgress * 12.5 * 18 + sn(i, 3.1, 0.3);
      } else if (pullProgress < 0.55) {
        // Rising to peak
        boostPsi = 14 + pullProgress * 14 + sn(i, 3.3, 0.4);
      } else {
        // Slight drop at top end as turbo efficiency falls
        boostPsi = PULL_CONFIG.peakBoostPsi - (pullProgress - 0.55) * 3 + sn(i, 2.8, 0.35);
      }
    } else {
      boostPsi = Math.max(0, 1.2 + sn(i, 1.2, 0.8));
    }
    boostPsi = round(Math.max(0, boostPsi), 1);

    // ── Ignition timing (deg BTDC) ───────────────────────────────────────
    let ignitionTiming: number;
    if (inPull) {
      // Slightly less timing at peak boost to avoid knock
      ignitionTiming = 18.5 - pullProgress * 1.5 + sn(i, 1.8, 1.1);
    } else {
      ignitionTiming = 24 + sn(i, 1.3, 2.5); // more timing at light load
    }
    ignitionTiming = round(ignitionTiming, 1);

    // ── Knock retard (deg) ───────────────────────────────────────────────
    // Mostly 0, occasional small value from combustion variation
    const knockRetard = round(Math.max(0, sn(i, 7.3, 0.45)), 2);

    // ── Temperatures ─────────────────────────────────────────────────────
    const iatF = round(88 + sn(i, 0.4, 1.8), 1);
    const coolantF = round(196.5 + sn(i, 0.3, 1.2), 1);

    rows.push({
      time: t,
      rpm,
      speedMph: Math.max(0, speedMph),
      gear: PULL_CONFIG.targetGear,
      throttle,
      afr,
      lambda,
      boostPsi,
      ignitionTiming,
      knockRetard,
      iatF,
      coolantF,
    });
  }

  return rows;
}

// ─── Accessors ────────────────────────────────────────────────────────────────

/** Returns the row index where the pull is considered to start (t ≥ pullStartSec) */
export function getPullStartIndex(rows: MutablePullRow[]): number {
  return rows.findIndex((r) => r.time >= PULL_CONFIG.pullStartSec);
}

/** Returns the row index where the pull ends (t > pullEndSec) */
export function getPullEndIndex(rows: MutablePullRow[]): number {
  const idx = rows.findIndex((r) => r.time > PULL_CONFIG.pullEndSec);
  return idx === -1 ? rows.length - 1 : idx - 1;
}
