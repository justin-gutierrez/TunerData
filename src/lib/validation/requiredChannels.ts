/**
 * Validates that every required channel group in the template is satisfied
 * by at least one mapped column in the parsed log.
 *
 * A group like ['afr', 'lambda'] passes if EITHER afr OR lambda is mapped.
 * The special value 'timingCorrectionCylinders' passes if any
 * timingCorrectionCylinders.cylN field is mapped.
 */

import type { ColumnMapping } from "../schema/normalized-log";
import type { ValidationTemplate } from "../schema/validation-rules";
import type { CheckResult } from "../schema/validation-result";

// ─── Helper ───────────────────────────────────────────────────────────────────

function isMapped(field: string, mappings: ColumnMapping[]): boolean {
  if (field === "timingCorrectionCylinders") {
    return mappings.some(
      (m) =>
        m.normalizedField?.startsWith("timingCorrectionCylinders.") &&
        m.status !== "unmapped"
    );
  }
  return mappings.some(
    (m) => m.normalizedField === field && m.status !== "unmapped"
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function checkRequiredChannels(
  mappings: ColumnMapping[],
  template: ValidationTemplate
): { checks: CheckResult[]; missingChannels: string[] } {
  const checks: CheckResult[] = [];
  const missingChannels: string[] = [];

  for (const rule of template.requiredChannels) {
    // Skip non-required (optional) channels — they show in the builder UI but aren't validated
    if (!rule.required) continue;

    const fields = rule.type === "single" ? [rule.field] : rule.fields;
    const primaryField = fields[0];
    const checkId = `required_channel_${primaryField}`;
    const label = rule.label;

    const satisfiedBy = fields.find((f) => isMapped(f, mappings));

    if (satisfiedBy) {
      checks.push({
        id: checkId,
        name: `Required channel: ${label}`,
        description:
          rule.type === "single"
            ? `Channel "${rule.field}" must be present in the log`
            : `At least one of [${rule.fields.join(", ")}] must be present in the log`,
        outcome: "pass",
        detail: `Mapped field: "${satisfiedBy}"`,
      });
    } else {
      missingChannels.push(label);
      checks.push({
        id: checkId,
        name: `Required channel: ${label}`,
        description:
          rule.type === "single"
            ? `Channel "${rule.field}" must be present in the log`
            : `At least one of [${rule.fields.join(", ")}] must be present in the log`,
        outcome: "fail",
        detail:
          rule.type === "single"
            ? `Column "${rule.field}" was not found in the CSV.`
            : `None of [${rule.fields.join(", ")}] matched any column in the CSV.`,
      });
    }
  }

  return { checks, missingChannels };
}
