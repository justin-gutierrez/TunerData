"use client";

/**
 * TemplateSelector — lets the user pick a preset OR switch to "Custom."
 *
 * State:
 *   mode === "preset"  → show preset grid, emit the selected preset
 *   mode === "custom"  → show TemplateBuilder below the grid
 *
 * The parent receives the live ValidationTemplate via onTemplateChange.
 */

import { useState, useCallback } from "react";
import { Car, Gauge, FileText, Navigation, Sliders, RotateCcw } from "lucide-react";
import type { ValidationTemplate, LogValidationMode } from "@/lib/schema/validation-rules";
import { PRESET_TEMPLATES } from "@/lib/templates/defaultTemplates";
import { TemplateBuilder } from "./TemplateBuilder";
import { cn } from "@/lib/utils";

// ─── Mode icons / colours ────────────────────────────────────────────────────

const MODE_META: Record<LogValidationMode, { Icon: React.ElementType; color: string }> = {
  roll_pull: { Icon: Car,        color: "text-red-400"     },
  wot_pull:  { Icon: Gauge,      color: "text-orange-400"  },
  idle:      { Icon: FileText,   color: "text-blue-400"    },
  cruise:    { Icon: Navigation, color: "text-emerald-400" },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Currently active template */
  template: ValidationTemplate;
  /** Called whenever the template changes (preset or custom) */
  onTemplateChange: (t: ValidationTemplate) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TemplateSelector({ template, onTemplateChange }: Props) {
  const [uiMode, setUiMode] = useState<"preset" | "custom">("preset");
  const [activePresetId, setActivePresetId] = useState<string>(
    PRESET_TEMPLATES.find((p) => p.id === template.id)?.id ?? PRESET_TEMPLATES[0].id
  );

  const handlePresetSelect = useCallback(
    (preset: ValidationTemplate) => {
      setActivePresetId(preset.id);
      setUiMode("preset");
      onTemplateChange(preset);
    },
    [onTemplateChange]
  );

  const handleCustomToggle = useCallback(() => {
    setUiMode("custom");
  }, []);

  const handleResetToPreset = useCallback(() => {
    const preset = PRESET_TEMPLATES.find((p) => p.id === activePresetId);
    if (preset) {
      onTemplateChange(preset);
      setUiMode("preset");
    }
  }, [activePresetId, onTemplateChange]);

  return (
    <div className="space-y-3">
      {/* Preset grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {PRESET_TEMPLATES.map((preset) => {
          const meta   = MODE_META[preset.mode];
          const Icon   = meta.Icon;
          const active = uiMode === "preset" && preset.id === activePresetId;

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => handlePresetSelect(preset)}
              className={cn(
                "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-left transition-all",
                active
                  ? "border-red-500/40 bg-red-500/8 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.15)]"
                  : "border-white/6 bg-white/3 hover:border-white/12 hover:bg-white/5"
              )}
            >
              <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", active ? meta.color : "text-zinc-600")} />
              <div className="min-w-0">
                <p className={cn("text-xs font-semibold truncate", active ? "text-white" : "text-zinc-400")}>
                  {preset.name}
                </p>
                <p className="text-[10px] text-zinc-600 leading-snug mt-0.5 line-clamp-2">
                  {preset.description ?? ""}
                </p>
              </div>
            </button>
          );
        })}

        {/* Custom template button */}
        <button
          type="button"
          onClick={handleCustomToggle}
          className={cn(
            "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-left transition-all",
            uiMode === "custom"
              ? "border-red-500/40 bg-red-500/8"
              : "border-white/6 bg-white/3 hover:border-white/12 hover:bg-white/5 border-dashed"
          )}
        >
          <Sliders className={cn("h-4 w-4 mt-0.5 shrink-0", uiMode === "custom" ? "text-red-400" : "text-zinc-600")} />
          <div>
            <p className={cn("text-xs font-semibold", uiMode === "custom" ? "text-white" : "text-zinc-400")}>
              Custom Template
            </p>
            <p className="text-[10px] text-zinc-600 leading-snug mt-0.5">
              Build your own validation rules
            </p>
          </div>
        </button>
      </div>

      {/* Custom builder (expanded when uiMode === "custom") */}
      {uiMode === "custom" && (
        <div>
          {/* Reset button */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              Custom template builder
            </p>
            <button
              type="button"
              onClick={handleResetToPreset}
              className="flex items-center gap-1.5 rounded-md border border-white/8 px-2.5 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 hover:border-white/15 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Reset to preset
            </button>
          </div>

          <TemplateBuilder value={template} onChange={onTemplateChange} />
        </div>
      )}
    </div>
  );
}
