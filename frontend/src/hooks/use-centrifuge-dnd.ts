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

type CentrifugeDndOptions = {
  centrifugeTool: BenchToolInstance | null;
  dndDisabledByAction: boolean;
  dragState: Pick<DragStateApi, "clearDropTargets" | "setActiveDragItem" | "showDropTargets">;
  experimentApi: { moveObject: (payload: MoveObjectPayload) => void };
  isRunning: boolean;
};

export type CentrifugeDndApi = {
  handleDragOver: (event: DragEvent<HTMLElement>) => void;
  handleDrop: (event: DragEvent<HTMLElement>) => void;
  handleItemDragStart: (dataTransfer: DataTransfer) => void;
};

export function useCentrifugeDnd({
  centrifugeTool,
  dndDisabledByAction,
  dragState,
  experimentApi,
  isRunning,
}: CentrifugeDndOptions): CentrifugeDndApi {
  const { clearDropTargets, setActiveDragItem, showDropTargets } = dragState;

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    if (!dndDisabledByAction && !isRunning && hasCompatibleDropTarget(event.dataTransfer, "centrifuge_widget")) {
      event.preventDefault();
    }
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    if (dndDisabledByAction || isRunning || !hasCompatibleDropTarget(event.dataTransfer, "centrifuge_widget")) {
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
    executeToolDropCommand(resolveToolDropCommand(payload, { kind: "centrifuge" }), experimentApi);
  };

  const handleItemDragStart = (dataTransfer: DataTransfer) => {
    if (!centrifugeTool || isRunning || centrifugeTool.isDraggable === false) return;
    const payload: EquipmentToolDragPayload = {
      allowedDropTargets: centrifugeTool.allowedDropTargets ?? [],
      entityKind: "tool",
      sourceId: "centrifuge",
      sourceKind: "centrifuge",
      entityId: centrifugeTool.id,
      toolId: centrifugeTool.toolId,
      toolType: centrifugeTool.toolType,
    };
    writeEquipmentToolDragPayload(dataTransfer, payload);
    showDropTargets(payload.allowedDropTargets);
    setActiveDragItem(toDragDescriptor(payload));
  };

  return { handleDragOver, handleDrop, handleItemDragStart };
}
