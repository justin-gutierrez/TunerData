/**
 * Unit normalization for values extracted from raw CSV cells.
 *
 * Target units for the unified schema:
 *   timeSec          → seconds
 *   speedMph         → miles per hour
 *   boostPsi         → psi (gauge, above atmospheric)
 *   mapKpa           → kPa (absolute)
 *   iatF / coolantTempF → Fahrenheit
 *   throttlePct / acceleratorPct → percent (0–100)
 *   ignitionTimingDeg / knockRetardDeg → degrees
 *   lambda           → dimensionless ratio
 *   afr              → ratio (× 14.7 for gasoline stoich)
 */

// ─── Primitive converters ─────────────────────────────────────────────────────

export const kmhToMph = (kmh: number): number => kmh * 0.621371;
export const celsiusToF = (c: number): number => c * (9 / 5) + 32;
export const barToPsi = (bar: number): number => bar * 14.5038;
export const kpaToPsi = (kpa: number): number => kpa * 0.145038;
export const psiToKpa = (psi: number): number => psi * 6.89476;
export const lambdaToAfr = (lambda: number): number => lambda * 14.7;
export const afrToLambda = (afr: number): number => afr / 14.7;

// ─── Field-aware value normalizer ─────────────────────────────────────────────

/**
 * Parses a raw string cell and converts it to the unified unit for
 * the given NormalizedLogRow field.
 *
 * @param raw           Raw string value from the CSV cell
 * @param normalizedField  Destination field name (e.g. "speedMph")
 * @param detectedUnit  Unit inferred from the column header (e.g. "km/h")
 * @returns Normalized numeric value, or undefined if unparseable
 */
export function normalizeValue(
  raw: string,
  normalizedField: string,
  detectedUnit: string | undefined
): number | undefined {
  const num = parseFloat(raw);
  if (!isFinite(num)) return undefined;

  switch (normalizedField) {
    // ── Speed ──────────────────────────────────────────────────────────────
    case "speedMph":
      if (detectedUnit === "km/h") return kmhToMph(num);
      return num; // assume mph

    // ── Temperatures ───────────────────────────────────────────────────────
    case "iatF":
    case "coolantTempF":
      if (detectedUnit === "°C") return celsiusToF(num);
      return num; // assume °F

    // ── Boost pressure (gauge) ─────────────────────────────────────────────
    case "boostPsi":
      if (detectedUnit === "kPa") return kpaToPsi(num);
      if (detectedUnit === "bar") return barToPsi(num);
      return num; // assume psi

    // ── MAP (absolute) ─────────────────────────────────────────────────────
    case "mapKpa":
      if (detectedUnit === "psi") return psiToKpa(num);
      return num; // assume kPa

    // ── Timing correction cylinders ───────────────────────────────────────
    // MHD stores negative corrections (e.g. -0.8 deg); store as-is
    // The validator interprets these as knock retard magnitude
    default:
      if (normalizedField.startsWith("timingCorrectionCylinders.")) return num;
      return num;
  }
}

// ─── Post-processing: AFR ↔ Lambda cross-derivation ──────────────────────────

export interface AfrLambdaPair {
  afr?: number;
  lambda?: number;
}

/**
 * If only one of AFR or lambda is present, derives the other.
 * Mutates the pair in-place.
 */
export function crossDeriveLambdaAfr(pair: AfrLambdaPair): void {
  if (pair.afr !== undefined && pair.lambda === undefined) {
    pair.lambda = afrToLambda(pair.afr);
  } else if (pair.lambda !== undefined && pair.afr === undefined) {
    pair.afr = lambdaToAfr(pair.lambda);
  }
}
