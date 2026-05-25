import type { DragEvent } from "react";

import {
  hasCompatibleDropTarget,
  readEquipmentToolDragPayload,
  readProduceDragPayload,
  readToolbarDragPayload,
  readWorkspaceLiquidDragPayload,
  writeEquipmentToolDragPayload,
  writeProduceDragPayload,
  writeSampleLabelDragPayload,
  writeWorkspaceWidgetDragPayload,
} from "@/lib/workbench-dnd";
import { executeTrashLabelDropCommand } from "@/lib/label-drop-command-executor";
import { resolveLabelDropCommand } from "@/lib/label-drop-command-resolver";
import { executeTrashDropCommand } from "@/lib/trash-drop-command-executor";
import { resolveTrashDropCommand } from "@/lib/trash-drop-command-resolver";
import { executeToolDropCommand } from "@/lib/tool-drop-command-executor";
import { resolveToolDropCommand } from "@/lib/tool-drop-command-resolver";
import { readLabelDragPayload } from "@/lib/label-drop-resolver";
import type {
  BenchToolInstance,
  ExperimentWorkspaceWidget,
  TrashProduceLotEntry,
  TrashSampleLabelEntry,
} from "@/types/workbench";
import type { DragStateApi } from "@/hooks/use-drag-state";
import type {
  DiscardGrossBalanceProduceLotPayload,
  DiscardProduceLotFromWorkbenchToolPayload,
  DiscardSampleLabelFromWorkbenchToolPayload,
  DiscardWidgetProduceLotPayload,
  DiscardWorkspaceProduceLotPayload,
  MoveObjectPayload,
  RemoveLiquidFromWorkspaceWidgetPayload,
} from "@/types/api-payloads";

export type TrashDndExperimentApi = {
  discardGrossBalanceProduceLot: (payload: DiscardGrossBalanceProduceLotPayload) => void;
  discardPrintedLimsLabel: () => void;
  discardProduceLotFromWorkbenchTool: (payload: DiscardProduceLotFromWorkbenchToolPayload) => void;
  discardSampleLabelFromPalette: () => void;
  discardSampleLabelFromWorkbenchTool: (payload: DiscardSampleLabelFromWorkbenchToolPayload) => void;
  discardWidgetProduceLot: (payload: DiscardWidgetProduceLotPayload) => void;
  discardWorkspaceProduceLot: (payload: DiscardWorkspaceProduceLotPayload) => void;
  moveObject: (payload: MoveObjectPayload) => void;
  removeLiquidFromWorkspaceWidget: (payload: RemoveLiquidFromWorkspaceWidgetPayload) => void;
};

type TrashDndOptions = {
  dndDisabledByAction: boolean;
  dragState: Pick<DragStateApi, "clearDropTargets" | "setActiveDragItem" | "showDropTargets">;
  experimentApi: TrashDndExperimentApi;
  isGrinderRunning: boolean;
};

export type TrashDndApi = {
  handleTrashDragOver: (event: DragEvent<HTMLButtonElement>) => void;
  handleTrashDrop: (event: DragEvent<HTMLButtonElement>) => void;
  handleTrashProduceLotDragStart: (
    trashProduceLot: TrashProduceLotEntry,
    dataTransfer: DataTransfer,
  ) => void;
  handleTrashSampleLabelDragStart: (
    trashSampleLabel: TrashSampleLabelEntry,
    dataTransfer: DataTransfer,
  ) => void;
  handleTrashToolDragStart: (tool: BenchToolInstance, dataTransfer: DataTransfer) => void;
  handleTrashedWidgetDragStart: (
    widget: ExperimentWorkspaceWidget,
    dataTransfer: DataTransfer,
  ) => void;
};

export function useTrashDnd({
  dndDisabledByAction,
  dragState,
  experimentApi,
  isGrinderRunning,
}: TrashDndOptions): TrashDndApi {
  const { clearDropTargets, setActiveDragItem, showDropTargets } = dragState;

  const handleTrashDragOver = (event: DragEvent<HTMLButtonElement>) => {
    if (dndDisabledByAction) {
      return;
    }
    if (hasCompatibleDropTarget(event.dataTransfer, "trash_bin")) {
      event.preventDefault();
    }
  };

  const handleTrashDrop = (event: DragEvent<HTMLButtonElement>) => {
    if (dndDisabledByAction) {
      return;
    }
    if (!hasCompatibleDropTarget(event.dataTransfer, "trash_bin")) {
      return;
    }

    const toolbarPayload = readToolbarDragPayload(event.dataTransfer);
    if (toolbarPayload?.itemType === "sample_label") {
      event.preventDefault();
      event.stopPropagation();
      clearDropTargets();
      void experimentApi.discardSampleLabelFromPalette();
      return;
    }

    const toolPayload =
      (toolbarPayload?.itemType === "tool" ? toolbarPayload : null) ??
      readEquipmentToolDragPayload(event.dataTransfer);
    if (toolPayload) {
      event.preventDefault();
      event.stopPropagation();
      clearDropTargets();

      const command = resolveToolDropCommand(toolPayload, { kind: "trash_bin" });
      if (!command) {
        return;
      }
      executeToolDropCommand(command, experimentApi);
      return;
    }

    const labelPayload = readLabelDragPayload(event.dataTransfer);
    if (labelPayload) {
      const command = resolveLabelDropCommand(labelPayload, { kind: "trash_bin" });
      if (!command) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      clearDropTargets();
      executeTrashLabelDropCommand(command, experimentApi);
      return;
    }

    const workspaceLiquidPayload = readWorkspaceLiquidDragPayload(event.dataTransfer);
    if (workspaceLiquidPayload) {
      const command = resolveTrashDropCommand(workspaceLiquidPayload, { isGrinderRunning });
      if (!command) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      clearDropTargets();
      executeTrashDropCommand(command, experimentApi);
      return;
    }

    const producePayload = readProduceDragPayload(event.dataTransfer);
    if (!producePayload) {
      return;
    }
    const command = resolveTrashDropCommand(producePayload, { isGrinderRunning });
    if (!command) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    clearDropTargets();
    executeTrashDropCommand(command, experimentApi);
  };

  const handleTrashToolDragStart = (tool: BenchToolInstance, dataTransfer: DataTransfer) => {
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
      sourceId: tool.id,
      sourceKind: "trash",
      entityId: tool.id,
      toolId: tool.toolId,
      toolType: tool.toolType,
      trashToolId: tool.id,
    });
    showDropTargets(allowedDropTargets);
    setActiveDragItem({
      allowedDropTargets,
      entityKind: "tool",
      sourceId: tool.id,
      sourceKind: "trash",
      entityId: tool.id,
      toolId: tool.toolId,
      toolType: tool.toolType,
    });
  };

  const handleTrashedWidgetDragStart = (
    widget: ExperimentWorkspaceWidget,
    dataTransfer: DataTransfer,
  ) => {
    if (dndDisabledByAction) {
      return;
    }
    if (widget.isDraggable === false) {
      return;
    }
    const allowedDropTargets = widget.allowedDropTargets ?? [];

    writeWorkspaceWidgetDragPayload(dataTransfer, {
      allowedDropTargets,
      entityKind: "workspace_widget",
      sourceId: widget.id,
      sourceKind: "trash",
      widgetId: widget.id,
      widgetType: widget.widgetType,
    });
    showDropTargets(allowedDropTargets);
    setActiveDragItem({
      allowedDropTargets,
      entityKind: "workspace_widget",
      sourceId: widget.id,
      sourceKind: "trash",
      widgetId: widget.id,
      widgetType: widget.widgetType,
    });
  };

  const handleTrashProduceLotDragStart = (
    trashProduceLot: TrashProduceLotEntry,
    dataTransfer: DataTransfer,
  ) => {
    if (dndDisabledByAction) {
      return;
    }
    const allowedDropTargets = trashProduceLot.produceLot.allowedDropTargets ?? [];

    writeProduceDragPayload(dataTransfer, {
      allowedDropTargets,
      entityKind: "produce",
      produceLotId: trashProduceLot.produceLot.id,
      produceType: trashProduceLot.produceLot.produceType,
      sourceId: trashProduceLot.produceLot.id,
      sourceKind: "trash",
      trashProduceLotId: trashProduceLot.id,
    });
    showDropTargets(allowedDropTargets);
    setActiveDragItem({
      allowedDropTargets,
      entityKind: "produce",
      produceLotId: trashProduceLot.produceLot.id,
      produceType: trashProduceLot.produceLot.produceType,
      sourceId: trashProduceLot.produceLot.id,
      sourceKind: "trash",
      trashProduceLotId: trashProduceLot.id,
    });
  };

  const handleTrashSampleLabelDragStart = (
    trashSampleLabel: TrashSampleLabelEntry,
    dataTransfer: DataTransfer,
  ) => {
    if (dndDisabledByAction) {
      return;
    }
    const label = trashSampleLabel.label;
    if (label.isDraggable === false) {
      return;
    }
    const allowedDropTargets = label.allowedDropTargets ?? [];

    writeSampleLabelDragPayload(dataTransfer, {
      allowedDropTargets,
      entityKind: "sample_label",
      label,
      sampleLabelId: trashSampleLabel.id,
      sampleLabelText: label.text,
      sourceId: trashSampleLabel.id,
      sourceKind: "trash",
      trashSampleLabelId: trashSampleLabel.id,
    });
    showDropTargets(allowedDropTargets);
    setActiveDragItem({
      allowedDropTargets,
      entityKind: "sample_label",
      label,
      sampleLabelId: trashSampleLabel.id,
      sampleLabelText: label.text,
      sourceId: trashSampleLabel.id,
      sourceKind: "trash",
      trashSampleLabelId: trashSampleLabel.id,
    });
  };

  return {
    handleTrashDragOver,
    handleTrashDrop,
    handleTrashProduceLotDragStart,
    handleTrashSampleLabelDragStart,
    handleTrashToolDragStart,
    handleTrashedWidgetDragStart,
  };
}
