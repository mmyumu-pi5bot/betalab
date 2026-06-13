"use client";

import type { DragEvent } from "react";

import { executeToolDropCommand } from "@/lib/tool-drop-command-executor";
import { resolveToolDropCommand } from "@/lib/tool-drop-command-resolver";
import {
  canResolveDropOnTool,
} from "@/lib/tool-drop-resolver";
import {
  hasCompatibleDropTarget,
  readEquipmentToolDragPayload,
  readToolbarDragPayload,
  toDragDescriptor,
  writeEquipmentToolDragPayload,
} from "@/lib/workbench-dnd";
import type { AddLiquidToToolPayload, MoveObjectPayload } from "@/types/api-payloads";
import type { BenchToolInstance } from "@/types/workbench";
import type { EquipmentToolDragPayload } from "@/lib/workbench-dnd";
import type { DragStateApi } from "@/hooks/use-drag-state";

export type VortexDndExperimentApi = {
  addLiquidToTool: (payload: AddLiquidToToolPayload) => void;
  moveObject: (payload: MoveObjectPayload) => void;
};

type VortexDndOptions = {
  vortexTool: BenchToolInstance | null;
  dndDisabledByAction: boolean;
  dragState: Pick<DragStateApi, "clearDropTargets" | "setActiveDragItem" | "showDropTargets">;
  experimentApi: VortexDndExperimentApi;
};

export type VortexDndApi = {
  handleVortexDragOver: (event: DragEvent<HTMLElement>) => void;
  handleVortexDrop: (event: DragEvent<HTMLElement>) => void;
  handleVortexItemDragStart: (dataTransfer: DataTransfer) => void;
};

export function useVortexDnd({
  vortexTool,
  dndDisabledByAction,
  dragState,
  experimentApi,
}: VortexDndOptions): VortexDndApi {
  const { clearDropTargets, setActiveDragItem, showDropTargets } = dragState;

  const handleVortexDragOver = (event: DragEvent<HTMLElement>) => {
    if (dndDisabledByAction) {
      return;
    }
    if (
      canResolveDropOnTool(event.dataTransfer, {
        parentDropTargetTypes: ["vortex_widget"],
        tool: vortexTool,
      }) ||
      hasCompatibleDropTarget(event.dataTransfer, "vortex_widget")
    ) {
      event.preventDefault();
    }
  };

  const handleVortexDrop = (event: DragEvent<HTMLElement>) => {
    if (dndDisabledByAction) {
      return;
    }
    const toolbarPayload = readToolbarDragPayload(event.dataTransfer);
    if (
      toolbarPayload?.itemId === "quechers_salts" &&
      toolbarPayload.itemType === "liquid" &&
      vortexTool !== null &&
      canResolveDropOnTool(event.dataTransfer, {
        parentDropTargetTypes: ["vortex_widget"],
        tool: vortexTool,
      })
    ) {
      event.preventDefault();
      event.stopPropagation();
      clearDropTargets();
      experimentApi.addLiquidToTool({
        tool_id: vortexTool.id,
        liquid_id: "quechers_salts",
        volume_ml: 1,
      });
      return;
    }
    if (!hasCompatibleDropTarget(event.dataTransfer, "vortex_widget")) {
      return;
    }
    const toolPayload =
      (toolbarPayload?.itemType === "tool" ? toolbarPayload : null) ??
      readEquipmentToolDragPayload(event.dataTransfer);

    if (!toolPayload) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    clearDropTargets();

    const command = resolveToolDropCommand(toolPayload, { kind: "vortex" });
    if (!command) {
      return;
    }
    executeToolDropCommand(command, experimentApi);
  };

  const handleVortexItemDragStart = (dataTransfer: DataTransfer) => {
    if (!vortexTool) {
      return;
    }
    if (vortexTool.isDraggable === false) {
      return;
    }

    const allowedDropTargets = vortexTool.allowedDropTargets ?? [];
    const payload: EquipmentToolDragPayload = {
      allowedDropTargets,
      entityKind: "tool",
      sourceId: "vortex",
      sourceKind: "vortex",
      entityId: vortexTool.id,
      toolId: vortexTool.toolId,
      toolType: vortexTool.toolType,
    };

    writeEquipmentToolDragPayload(dataTransfer, payload);
    showDropTargets(allowedDropTargets);
    setActiveDragItem(toDragDescriptor(payload));
  };

  return {
    handleVortexDragOver,
    handleVortexDrop,
    handleVortexItemDragStart,
  };
}
