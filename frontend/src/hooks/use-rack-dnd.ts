import type { DragEvent } from "react";

import {
  readDragDescriptor,
  readEquipmentToolDragPayload,
  readToolbarDragPayload,
  writeEquipmentToolDragPayload,
} from "@/lib/workbench-dnd";
import { containmentAcceptsDescriptor } from "@/lib/containment-resolver";
import { executeToolDropCommand } from "@/lib/tool-drop-command-executor";
import { resolveToolDropCommand } from "@/lib/tool-drop-command-resolver";
import type { BenchToolInstance, RackSlot } from "@/types/workbench";
import type { DragStateApi } from "@/hooks/use-drag-state";
import type { MoveObjectPayload } from "@/types/api-payloads";

export type RackDndExperimentApi = {
  moveObject: (payload: MoveObjectPayload) => void;
};

type RackDndOptions = {
  dndDisabledByAction: boolean;
  dragState: Pick<DragStateApi, "activeDragItem" | "activeDropTargets" | "clearDropTargets" | "setActiveDragItem" | "showDropTargets">;
  experimentApi: RackDndExperimentApi;
  rackSlots: RackSlot[];
};

export type RackDndApi = {
  canDropOnRackSlotFromActiveDrag: (rackSlot: RackSlot) => boolean;
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
  const { activeDragItem, activeDropTargets, clearDropTargets, setActiveDragItem, showDropTargets } = dragState;

  const canDropOnRackSlotFromActiveDrag = (rackSlot: RackSlot) => {
    if (dndDisabledByAction || activeDragItem === null) {
      return false;
    }
    if (!(rackSlot.dropTargetTypes ?? []).some((targetType) => (activeDropTargets ?? []).includes(targetType))) {
      return false;
    }
    return containmentAcceptsDescriptor(rackSlot.containment, activeDragItem);
  };

  const handleRackSlotDragOver = (
    event: DragEvent<HTMLDivElement>,
    targetRackSlot: RackSlot,
  ) => {
    if (!canDropOnRackSlotFromActiveDrag(targetRackSlot)) {
      return;
    }
    event.preventDefault();
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
    const toolPayload =
      (toolbarPayload?.itemType === "tool" ? toolbarPayload : null) ??
      readEquipmentToolDragPayload(event.dataTransfer);

    if (!toolPayload) {
      return;
    }

    if (!containmentAcceptsDescriptor(targetRackSlot.containment, readDragDescriptor(event.dataTransfer))) {
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
      entityId: tool.id,
      toolId: tool.toolId,
      toolType: tool.toolType,
    });
    const descriptor = {
      allowedDropTargets,
      entityKind: "tool" as const,
      sourceId: rackSlot.id,
      sourceKind: "rack" as const,
      entityId: tool.id,
      toolId: tool.toolId,
      toolType: tool.toolType,
    };
    showDropTargets(descriptor.allowedDropTargets);
    setActiveDragItem(descriptor);
  };

  return {
    canDropOnRackSlotFromActiveDrag,
    handleRackSlotDragOver,
    handleRackSlotDrop,
    handleRackToolDragStart,
  };
}
