import type { DragEvent } from "react";

import {
  hasCompatibleDropTarget,
  readEquipmentToolDragPayload,
  readToolbarDragPayload,
  writeEquipmentToolDragPayload,
} from "@/lib/workbench-dnd";
import { labToolCatalog } from "@/lib/lab-workflow-catalog";
import { executeToolDropCommand } from "@/lib/tool-drop-command-executor";
import { resolveToolDropCommand } from "@/lib/tool-drop-command-resolver";
import type { BenchToolInstance, RackSlot } from "@/types/workbench";
import type { DragStateApi } from "@/hooks/use-drag-state";
import type {
  MoveToolPayload,
  PlaceToolFromPalettePayload,
} from "@/types/api-payloads";

type RackDndExperimentApi = {
  moveTool: (payload: MoveToolPayload) => void;
  placeToolFromPalette: (payload: PlaceToolFromPalettePayload) => void;
};

type RackDndOptions = {
  dndDisabledByAction: boolean;
  dragState: Pick<DragStateApi, "clearDropTargets" | "setActiveDragItem" | "showDropTargets">;
  experimentApi: RackDndExperimentApi;
  rackSlots: RackSlot[];
};

export type RackDndApi = {
  handleRackSlotDragOver: (event: DragEvent<HTMLDivElement>, targetRackSlot: RackSlot) => void;
  handleRackSlotDrop: (event: DragEvent<HTMLDivElement>, slotIndex: number) => void;
  handleRackToolDragStart: (
    rackSlot: RackSlot,
    tool: BenchToolInstance,
    dataTransfer: DataTransfer,
  ) => void;
};

export function useRackDnd({
  dndDisabledByAction,
  dragState,
  experimentApi,
  rackSlots,
}: RackDndOptions): RackDndApi {
  const { clearDropTargets, setActiveDragItem, showDropTargets } = dragState;

  const handleRackSlotDragOver = (
    event: DragEvent<HTMLDivElement>,
    targetRackSlot: RackSlot,
  ) => {
    if (dndDisabledByAction) {
      return;
    }
    if ((targetRackSlot.dropTargetTypes ?? []).some((targetType) => hasCompatibleDropTarget(event.dataTransfer, targetType))) {
      event.preventDefault();
    }
  };

  const handleRackSlotDrop = (event: DragEvent<HTMLDivElement>, slotIndex: number) => {
    if (dndDisabledByAction) {
      return;
    }
    const targetRackSlot = rackSlots[slotIndex];
    if (!targetRackSlot) {
      return;
    }

    const toolbarPayload = readToolbarDragPayload(event.dataTransfer);
    const toolbarTool = toolbarPayload?.itemType === "tool"
      ? labToolCatalog[toolbarPayload.itemId]
      : null;
    const toolPayload =
      (toolbarPayload?.itemType === "tool" ? toolbarPayload : null) ??
      readEquipmentToolDragPayload(event.dataTransfer);

    if (!toolPayload) {
      return;
    }

    const toolType = toolbarTool?.toolType ?? toolPayload.toolType;
    if (toolType !== "sample_vial") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    clearDropTargets();

    const command = resolveToolDropCommand(toolPayload, {
      kind: "rack_slot",
      rackSlotId: targetRackSlot.id,
    });
    if (!command) {
      return;
    }
    executeToolDropCommand(command, experimentApi);
  };

  const handleRackToolDragStart = (
    rackSlot: RackSlot,
    tool: BenchToolInstance,
    dataTransfer: DataTransfer,
  ) => {
    if (dndDisabledByAction) {
      return;
    }
    if (tool.isDraggable === false) {
      return;
    }
    const allowedDropTargets = tool.allowedDropTargets ?? [];
    writeEquipmentToolDragPayload(dataTransfer, {
      allowedDropTargets,
      entityKind: "tool",
      rackSlotId: rackSlot.id,
      sourceId: rackSlot.id,
      sourceKind: "rack",
      toolId: tool.toolId,
      toolType: tool.toolType,
    });
    const descriptor = {
      allowedDropTargets,
      entityKind: "tool" as const,
      sourceId: rackSlot.id,
      sourceKind: "rack" as const,
      toolId: tool.toolId,
      toolType: tool.toolType,
    };
    showDropTargets(descriptor.allowedDropTargets);
    setActiveDragItem(descriptor);
  };

  return {
    handleRackSlotDragOver,
    handleRackSlotDrop,
    handleRackToolDragStart,
  };
}
