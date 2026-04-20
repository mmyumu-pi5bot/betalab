"use client";

import type { DragEvent } from "react";

import { executeVortexToolDropCommand } from "@/lib/tool-drop-command-executor";
import { resolveToolDropCommand } from "@/lib/tool-drop-command-resolver";
import {
  hasCompatibleDropTarget,
  readBenchToolDragPayload,
  readRackToolDragPayload,
  readToolbarDragPayload,
  readTrashToolDragPayload,
  readVortexToolDragPayload,
  toDragDescriptor,
  writeVortexToolDragPayload,
} from "@/lib/workbench-dnd";
import type {
  MoveRackToolToVortexPayload,
  MoveVortexToolToWorkbenchPayload,
  MoveWorkbenchToolToVortexPayload,
  PlaceToolOnVortexPayload,
  RestoreTrashedToolToVortexPayload,
} from "@/types/api-payloads";
import type { BenchToolInstance, VortexToolDragPayload } from "@/types/workbench";
import type { DragStateApi } from "@/hooks/use-drag-state";

type VortexDndExperimentApi = {
  moveWorkbenchToolToVortex: (payload: MoveWorkbenchToolToVortexPayload) => void;
  moveRackToolToVortex: (payload: MoveRackToolToVortexPayload) => void;
  placeToolOnVortex: (payload: PlaceToolOnVortexPayload) => void;
  restoreTrashedToolToVortex: (payload: RestoreTrashedToolToVortexPayload) => void;
  moveVortexToolToWorkbench: (payload: MoveVortexToolToWorkbenchPayload) => void;
  discardVortexTool: () => void;
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
    if (hasCompatibleDropTarget(event.dataTransfer, "vortex_widget")) {
      event.preventDefault();
    }
  };

  const handleVortexDrop = (event: DragEvent<HTMLElement>) => {
    if (dndDisabledByAction) {
      return;
    }
    if (!hasCompatibleDropTarget(event.dataTransfer, "vortex_widget")) {
      return;
    }

    const toolPayload =
      readToolbarDragPayload(event.dataTransfer) ??
      readBenchToolDragPayload(event.dataTransfer) ??
      readRackToolDragPayload(event.dataTransfer) ??
      readTrashToolDragPayload(event.dataTransfer) ??
      readVortexToolDragPayload(event.dataTransfer);

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
    executeVortexToolDropCommand(command, experimentApi);
  };

  const handleVortexItemDragStart = (dataTransfer: DataTransfer) => {
    if (!vortexTool) {
      return;
    }
    if (vortexTool.isDraggable === false) {
      return;
    }

    const allowedDropTargets = vortexTool.allowedDropTargets ?? [];
    const payload: VortexToolDragPayload = {
      allowedDropTargets,
      entityKind: "tool",
      sourceId: "vortex",
      sourceKind: "vortex",
      toolId: vortexTool.toolId,
      toolType: vortexTool.toolType,
    };

    writeVortexToolDragPayload(dataTransfer, payload);
    showDropTargets(allowedDropTargets);
    setActiveDragItem(toDragDescriptor(payload));
  };

  return {
    handleVortexDragOver,
    handleVortexDrop,
    handleVortexItemDragStart,
  };
}
