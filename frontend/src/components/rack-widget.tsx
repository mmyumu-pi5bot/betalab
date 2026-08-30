"use client";

import { useRef, type DragEvent, type ReactNode } from "react";

import { LabAssetIcon } from "@/components/icons/lab-asset-icon";
import { VialCappedIcon, VialUncappedIcon } from "@/components/icons/vial-cap-icon";
import { AutosamplerRackIllustration } from "@/components/illustrations/autosampler-rack-illustration";
import { WorkspaceEquipmentWidget } from "@/components/workspace-equipment-widget";
import { dragAffordanceClassName } from "@/lib/drag-affordance";
import { getContainerLiquidVisualState } from "@/lib/liquid-visuals";
import {
  getRackIllustrationGrabEdges,
  getRackIllustrationPlateOutline,
} from "@/lib/lab-scene-config";
import type { BenchLabel, BenchToolInstance, RackSlot } from "@/types/workbench";
import { useT } from "@/lib/i18n";

type RackWidgetProps = {
  dndDisabled?: boolean;
  getSlotPosition: (slotIndex: number) => { left: string; top: string };
  headerAction?: ReactNode;
  isSlotHighlighted: (rackSlot: RackSlot) => boolean;
  isLoadedIntoInstrument: boolean;
  isCommandPending: boolean;
  loadedCount: number;
  occupiedSlotLiquids: Record<number, BenchToolInstance["liquids"]>;
  occupiedSlots: number[];
  openSlots: number[];
  onItemDragEnd: () => void;
  onRackDragStart: (dataTransfer: DataTransfer) => void;
  onRackSlotDragOver: (event: DragEvent<HTMLDivElement>, rackSlot: RackSlot) => void;
  onRackSlotDrop: (event: DragEvent<HTMLDivElement>, slotIndex: number) => void;
  onRackToolDragStart: (
    rackSlot: RackSlot,
    tool: BenchToolInstance,
    dataTransfer: DataTransfer,
  ) => void;
  onToggleVialSeal?: (rackSlot: RackSlot, tool: BenchToolInstance) => void;
  rackSlots: RackSlot[];
  slotCount: number;
};

function getWrittenLabelText(labels: BenchLabel[]) {
  return labels.find((label) => label.labelKind === "lims")?.text ?? labels[0]?.text ?? null;
}

export function RackWidget({
  dndDisabled = false,
  getSlotPosition,
  headerAction,
  isSlotHighlighted,
  isLoadedIntoInstrument,
  isCommandPending,
  loadedCount,
  occupiedSlotLiquids,
  occupiedSlots,
  openSlots,
  onItemDragEnd,
  onRackDragStart,
  onRackSlotDragOver,
  onRackSlotDrop,
  onRackToolDragStart,
  onToggleVialSeal,
  rackSlots,
  slotCount,
}: RackWidgetProps) {
  const t = useT();
  const isRackDraggable = !dndDisabled && !isCommandPending;
  const rackIllustrationRef = useRef<HTMLDivElement | null>(null);

  function handleRackGrabDragStart(event: DragEvent<HTMLDivElement>) {
    if (!isRackDraggable) {
      return;
    }

    // The grabbed band is a bare hit area, so the browser would drag a sliver of
    // the rack around. Carry the whole illustration instead, held where it was
    // grabbed.
    const rackIllustration = rackIllustrationRef.current;
    if (rackIllustration && typeof event.dataTransfer.setDragImage === "function") {
      const bounds = rackIllustration.getBoundingClientRect();
      event.dataTransfer.setDragImage(
        rackIllustration,
        event.clientX - bounds.left,
        event.clientY - bounds.top,
      );
    }

    onRackDragStart(event.dataTransfer);
  }

  return (
    <WorkspaceEquipmentWidget
      bodyClassName="px-4 py-4 xl:px-5 xl:py-5"
      eyebrow={t("widget.autosampler_rack")}
      headerAction={headerAction}
    >
      <div className="space-y-3">
        <div className="relative mx-auto max-w-[25.75rem]" ref={rackIllustrationRef}>
          <AutosamplerRackIllustration
            className="w-full"
            occupiedSlotLiquids={occupiedSlotLiquids}
            occupiedSlots={occupiedSlots}
            openSlots={openSlots}
            slotCount={slotCount}
            testId="autosampler-rack-illustration"
            tone={loadedCount > 0 ? "active" : "neutral"}
          />
          {/* The rack is picked up by its own contours rather than by a separate
              handle: four bands hugging the edges of the plate, laid out to stop
              short of the slots so grabbing the rack never steals a vial drag. */}
          <div className="group pointer-events-none absolute inset-0">
            <div
              className={`absolute rounded-[1.5rem] opacity-0 ring-2 ring-sky-300/80 transition-opacity ${
                isRackDraggable ? "group-hover:opacity-100" : ""
              }`}
              data-testid="autosampler-rack-drag-outline"
              style={getRackIllustrationPlateOutline()}
            />
            {getRackIllustrationGrabEdges().map((edge) => (
              <div
                className={`pointer-events-auto absolute ${
                  isRackDraggable ? dragAffordanceClassName : ""
                }`}
                data-testid={`autosampler-rack-drag-edge-${edge.id}`}
                draggable={isRackDraggable}
                key={edge.id}
                onDragEnd={onItemDragEnd}
                onDragStart={handleRackGrabDragStart}
                style={edge.style}
                title={isRackDraggable ? t("rack.dragToInstrument") : undefined}
              />
            ))}
          </div>
          {rackSlots.map((rackSlot, slotIndex) => {
            const position = getSlotPosition(slotIndex);
            const tool = rackSlot.tool;
            const highlighted = isSlotHighlighted(rackSlot);

            return (
              <div
                className={`absolute h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors ${
                  highlighted ? "bg-sky-200/30 ring-2 ring-sky-300/75" : ""
                } ${tool && !dndDisabled ? dragAffordanceClassName : ""}`}
                data-drop-highlighted={highlighted ? "true" : "false"}
                data-testid={`rack-illustration-slot-${slotIndex + 1}`}
                draggable={Boolean(tool) && !dndDisabled}
                key={rackSlot.id}
                onDragEnd={onItemDragEnd}
                onDragOver={dndDisabled ? undefined : (event) => onRackSlotDragOver(event, rackSlot)}
                onDragStart={(event) => {
                  if (!tool || dndDisabled) {
                    return;
                  }
                  onRackToolDragStart(rackSlot, tool, event.dataTransfer);
                }}
                onDrop={dndDisabled ? undefined : (event) => onRackSlotDrop(event, slotIndex)}
                style={position}
              />
            );
          })}
        </div>
        <div
          className="mx-auto w-full max-w-[25.75rem] rounded-[1.2rem] border border-slate-200/80 bg-white/90 px-3 py-3"
          data-testid="rack-summary"
        >
          {loadedCount > 0 ? (
            <div className="space-y-1.5">
              {rackSlots.map((rackSlot, slotIndex) => {
                const tool = rackSlot.tool;
                if (!tool) {
                  return null;
                }

                const totalVolumeMl = tool.liquids.reduce(
                  (total, liquid) => total + liquid.volume_ml,
                  0,
                );
                const calibrationLevelNgPerMl = tool.calibrationContext?.levelNgPerMl ?? null;
                const writtenLabelText = getWrittenLabelText(tool.labels ?? []);
                const liquidVisualState = getContainerLiquidVisualState(tool.liquids, tool.accent);
                const isSealed = tool.isSealed ?? false;

                return (
                  <div
                    className={`flex items-center gap-2.5 rounded-[0.85rem] border border-slate-200 bg-slate-50 px-2.5 py-1.5 ${
                      dndDisabled ? "" : dragAffordanceClassName
                    }`}
                    data-testid={`rack-slot-summary-${slotIndex + 1}`}
                    draggable={!dndDisabled}
                    key={rackSlot.id}
                    onDragEnd={onItemDragEnd}
                    onDragStart={(event) =>
                      dndDisabled ? undefined : onRackToolDragStart(rackSlot, tool, event.dataTransfer)
                    }
                  >
                    <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      P{slotIndex + 1}
                    </span>
                    <span
                      className="shrink-0"
                      data-testid={`rack-slot-icon-${slotIndex + 1}`}
                    >
                      <LabAssetIcon
                        accent={tool.accent}
                        className="h-8 w-6"
                        fillRatio={
                          tool.capacity_ml > 0 ? Math.min(totalVolumeMl / tool.capacity_ml, 1) : 0
                        }
                        fillSegments={liquidVisualState.segments}
                        isSealed={tool.isSealed}
                        kind={tool.toolType}
                        tone="neutral"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{tool.label}</p>
                      <p
                        className="truncate text-[11px] text-slate-500"
                        data-testid={`rack-slot-detail-${slotIndex + 1}`}
                      >
                        {calibrationLevelNgPerMl !== null ? (
                          <span className="font-semibold text-rose-600">
                            {calibrationLevelNgPerMl} ng/mL
                          </span>
                        ) : (
                          writtenLabelText ?? tool.subtitle
                        )}
                      </p>
                    </div>
                    <div
                      className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-slate-600"
                      data-testid={`rack-slot-tool-${slotIndex + 1}`}
                    >
                      {totalVolumeMl.toFixed(2)} mL
                    </div>
                    {onToggleVialSeal && tool.canSeal ? (
                      <button
                        aria-label={
                          isSealed
                            ? t("toolCard.openTool", { tool: tool.label })
                            : t("toolCard.closeTool", { tool: tool.label })
                        }
                        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-300 ${
                          isSealed
                            ? "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900"
                            : "border-amber-300 bg-amber-50 text-amber-700 hover:border-amber-400 hover:text-amber-900"
                        }`}
                        data-testid={`rack-slot-seal-toggle-${slotIndex + 1}`}
                        disabled={dndDisabled}
                        draggable={false}
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleVialSeal(rackSlot, tool);
                        }}
                        type="button"
                      >
                        {isSealed ? (
                          <VialCappedIcon className="h-4 w-4" />
                        ) : (
                          <VialUncappedIcon className="h-4 w-4" />
                        )}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500">{t("rack.noVialStaged")}</p>
          )}
        </div>
        {isLoadedIntoInstrument ? (
          <p
            className="text-center text-xs font-semibold text-slate-500"
            data-testid="rack-load-status"
          >
            {t("rack.loadedInInstrument")}
          </p>
        ) : null}
      </div>
    </WorkspaceEquipmentWidget>
  );
}
