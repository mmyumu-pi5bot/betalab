"use client";

import type { DragEvent, ReactNode } from "react";

import { AutosamplerRackIllustration } from "@/components/illustrations/autosampler-rack-illustration";
import { WorkspaceEquipmentWidget } from "@/components/workspace-equipment-widget";
import { dragAffordanceClassName } from "@/lib/drag-affordance";
import type { BenchToolInstance, RackSlot } from "@/types/workbench";

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
  rackSlots: RackSlot[];
  slotCount: number;
};

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
  rackSlots,
  slotCount,
}: RackWidgetProps) {
  return (
    <WorkspaceEquipmentWidget
      bodyClassName="px-4 py-4 xl:px-5 xl:py-5"
      eyebrow="Autosampler rack"
      headerAction={headerAction}
    >
      <div className="space-y-3">
        <div className="relative mx-auto max-w-[25.75rem]">
          <AutosamplerRackIllustration
            className="w-full"
            occupiedSlotLiquids={occupiedSlotLiquids}
            occupiedSlots={occupiedSlots}
            openSlots={openSlots}
            slotCount={slotCount}
            testId="autosampler-rack-illustration"
            tone={loadedCount > 0 ? "active" : "neutral"}
          />
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

                return (
                  <div
                    className={`flex items-center justify-between gap-3 rounded-[0.85rem] border border-slate-200 bg-slate-50 px-3 py-1.5 ${
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
                    <div className="min-w-0 flex-1 text-sm text-slate-700">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        P{slotIndex + 1}
                      </span>
                      <span className="mx-2 text-slate-300">•</span>
                      <span className="truncate font-semibold text-slate-900">
                        {tool.label}
                      </span>
                    </div>
                    <div
                      className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate-600"
                      data-testid={`rack-slot-tool-${slotIndex + 1}`}
                    >
                      {tool.liquids.reduce((total, liquid) => total + liquid.volume_ml, 0)} mL
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No vial staged yet.</p>
          )}
        </div>
        <div
          aria-disabled={dndDisabled || isCommandPending}
          className={`mx-auto flex w-full max-w-[25.75rem] items-center justify-center rounded-[1rem] border border-dashed px-4 py-2.5 text-xs font-semibold transition-colors ${
            dndDisabled || isCommandPending
              ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
              : `${dragAffordanceClassName} border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100`
          }`}
          data-testid="autosampler-rack-drag-handle"
          draggable={!dndDisabled && !isCommandPending}
          onDragEnd={onItemDragEnd}
          onDragStart={(event) => {
            if (dndDisabled || isCommandPending) {
              return;
            }
            onRackDragStart(event.dataTransfer);
          }}
        >
          {isLoadedIntoInstrument
            ? "Rack loaded in LC-MS/MS"
            : "Drag rack into LC-MS/MS"}
        </div>
      </div>
    </WorkspaceEquipmentWidget>
  );
}
