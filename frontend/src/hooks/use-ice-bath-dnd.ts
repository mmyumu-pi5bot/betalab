"use client";

import type { DragEvent } from "react";

import type { DragStateApi } from "@/hooks/use-drag-state";
import { executeToolDropCommand } from "@/lib/tool-drop-command-executor";
import { resolveToolDropCommand } from "@/lib/tool-drop-command-resolver";
import {
  hasCompatibleDropTarget,
  readEquipmentToolDragPayload,
  readToolbarDragPayload,
  toDragDescriptor,
  writeEquipmentToolDragPayload,
} from "@/lib/workbench-dnd";
import type { EquipmentToolDragPayload } from "@/lib/workbench-dnd";
import type { MoveObjectPayload } from "@/types/api-payloads";
import type { BenchToolInstance } from "@/types/workbench";

type IceBathDndOptions = {
  dndDisabledByAction: boolean;
  dragState: Pick<DragStateApi, "clearDropTargets" | "setActiveDragItem" | "showDropTargets">;
  experimentApi: { moveObject: (payload: MoveObjectPayload) => void };
  iceBathTool: BenchToolInstance | null;
};

export type IceBathDndApi = {
  handleDragOver: (event: DragEvent<HTMLElement>) => void;
  handleDrop: (event: DragEvent<HTMLElement>) => void;
  handleItemDragStart: (dataTransfer: DataTransfer) => void;
};

export function useIceBathDnd({
  dndDisabledByAction,
  dragState,
  experimentApi,
  iceBathTool,
}: IceBathDndOptions): IceBathDndApi {
  const { clearDropTargets, setActiveDragItem, showDropTargets } = dragState;

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    if (!dndDisabledByAction && hasCompatibleDropTarget(event.dataTransfer, "ice_bath_widget")) {
      event.preventDefault();
    }
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    if (dndDisabledByAction || !hasCompatibleDropTarget(event.dataTransfer, "ice_bath_widget")) {
      return;
    }
    const toolbarPayload = readToolbarDragPayload(event.dataTransfer);
    const payload =
      (toolbarPayload?.itemType === "tool" ? toolbarPayload : null) ??
      readEquipmentToolDragPayload(event.dataTransfer);
    if (!payload) return;

    event.preventDefault();
    event.stopPropagation();
    clearDropTargets();
    executeToolDropCommand(resolveToolDropCommand(payload, { kind: "ice_bath" }), experimentApi);
  };

  const handleItemDragStart = (dataTransfer: DataTransfer) => {
    if (!iceBathTool || iceBathTool.isDraggable === false) return;
    const payload: EquipmentToolDragPayload = {
      allowedDropTargets: iceBathTool.allowedDropTargets ?? [],
      entityKind: "tool",
      sourceId: "ice_bath",
      sourceKind: "ice_bath",
      entityId: iceBathTool.id,
      toolId: iceBathTool.toolId,
      toolType: iceBathTool.toolType,
    };
    writeEquipmentToolDragPayload(dataTransfer, payload);
    showDropTargets(payload.allowedDropTargets);
    setActiveDragItem(toDragDescriptor(payload));
  };

  return { handleDragOver, handleDrop, handleItemDragStart };
}
