"use client";

import { useState } from "react";

import { ProduceLotCard } from "@/components/produce-lot-card";
import { ProduceLotStatusBadge } from "@/components/produce-lot-status-badge";
import { LabAssetIcon } from "@/components/icons/lab-asset-icon";
import { getDebugToolPresetPreview } from "@/lib/lab-scene-config";
import { useT } from "@/lib/i18n";
import type {
  DebugProducePresetId,
  ExperimentProduceLot,
  ToolCatalogItem,
} from "@/types/workbench";

export type DebugProducePreset = {
  id: DebugProducePresetId;
  produceLot: ExperimentProduceLot;
};

type DebugProducePaletteProps = {
  onPresetDragStart?: (preset: DebugProducePreset, dataTransfer: DataTransfer) => void;
  onToolPresetDragStart?: (preset: ToolCatalogItem, dataTransfer: DataTransfer) => void;
  onItemDragEnd?: () => void;
  presets: DebugProducePreset[];
  toolPresets?: ToolCatalogItem[];
};

export function DebugProducePalette({
  onPresetDragStart,
  onToolPresetDragStart,
  onItemDragEnd,
  presets,
  toolPresets = [],
}: DebugProducePaletteProps) {
  const t = useT();
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <section className="overflow-hidden rounded-[1.7rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(241,245,249,0.95))] shadow-[0_18px_40px_rgba(15,23,42,0.1)]">
      <button
        aria-controls="debug-palette-content"
        aria-expanded={isExpanded}
        className={`flex w-full items-center justify-between bg-white/85 px-4 py-3 text-left backdrop-blur transition-colors hover:bg-white ${
          isExpanded ? "border-b border-slate-200/80" : ""
        }`}
        onClick={() => setIsExpanded((current) => !current)}
        type="button"
      >
        <span className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
          {t("debug.palette")}
        </span>
        <span
          aria-hidden="true"
          className={`text-sm text-amber-700 transition-transform ${isExpanded ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>
      {isExpanded ? (
        <div
          className="space-y-3 px-4 py-4"
          data-testid="debug-palette-content"
          id="debug-palette-content"
        >
          {toolPresets.map((preset) => {
            const preview = getDebugToolPresetPreview(preset);
            return (
              <div
                className="flex cursor-grab items-center gap-3 rounded-[1rem] border border-rose-200 bg-[linear-gradient(180deg,#fff7f7,#fff1f2)] p-3 active:cursor-grabbing"
                data-testid={`debug-palette-preset-${preset.id}`}
                draggable={Boolean(onToolPresetDragStart)}
                key={preset.id}
                onDragEnd={onItemDragEnd}
                onDragStart={
                  onToolPresetDragStart
                    ? (event) => onToolPresetDragStart(preset, event.dataTransfer)
                    : undefined
                }
              >
                <div className="h-16 w-12 shrink-0">
                  <LabAssetIcon
                    accent={preview.accent}
                    containsSlurry={preview.containsSlurry}
                    fillRatio={preview.fillRatio}
                    kind={preview.iconKind}
                    produceLots={preview.produceLots}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{preset.name}</p>
                  <p className="text-xs text-slate-500">{preset.subtitle}</p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-rose-700">
                    {preview.detailLabel}
                  </p>
                </div>
              </div>
            );
          })}
          {presets.map((preset) => (
            <ProduceLotCard
              className="rounded-[1rem] border-amber-200 bg-[linear-gradient(180deg,#fffdf5,#fff7e8)]"
              dataTestId={`debug-palette-preset-${preset.id}`}
              draggable={Boolean(onPresetDragStart)}
              footerBadge={<ProduceLotStatusBadge produceLot={preset.produceLot} />}
              key={preset.id}
              metadata=""
              onDragEnd={onItemDragEnd}
              onDragStart={
                onPresetDragStart
                  ? (event) => onPresetDragStart(preset, event.dataTransfer)
                  : undefined
              }
              produceLot={preset.produceLot}
              variant="compact"
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
