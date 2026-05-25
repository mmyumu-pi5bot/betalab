import type { DragEvent } from "react";

import { resolveLabelDropCommand } from "@/lib/label-drop-command-resolver";
import { canResolveActiveLabelDragOnTool, canResolveLabelDropOnTool, readLabelDragPayload } from "@/lib/label-drop-resolver";
import { executeGrossBalanceLabelDropCommand } from "@/lib/label-drop-command-executor";
import { executeGrossBalanceProduceDropCommand } from "@/lib/produce-drop-command-executor";
import { resolveProduceDropCommand } from "@/lib/produce-drop-command-resolver";
import { executeToolDropCommand } from "@/lib/tool-drop-command-executor";
import { resolveToolDropCommand } from "@/lib/tool-drop-command-resolver";
import {
  hasCompatibleDropTarget,
  readEquipmentToolDragPayload,
  readProduceDragPayload,
  readToolbarDragPayload,
  toDragDescriptor,
  writeEquipmentToolDragPayload,
  writeProduceDragPayload,
} from "@/lib/workbench-dnd";
import type {
  BenchToolInstance,
  ExperimentProduceLot,
  ProduceDragPayload,
} from "@/types/workbench";
import type { DragStateApi } from "@/hooks/use-drag-state";
import type { DropDraft } from "@/hooks/use-drop-draft";
import type { DropDraftField } from "@/components/drop-draft-card";
import type {
  MoveObjectPayload,
  MoveWidgetProduceLotToGrossBalancePayload,
  MoveWorkbenchProduceLotToGrossBalancePayload,
  MoveWorkspaceProduceLotToGrossBalancePayload,
  RestoreTrashedProduceLotToGrossBalancePayload,
} from "@/types/api-payloads";

export type GrossBalanceDndExperimentApi = {
  applyPrintedLimsLabelToGrossBalanceBag: () => void;
  applySampleLabelToGrossBalanceTool: () => void;
  moveGrossBalanceToolToAnalyticalBalance: () => void;
  moveObject: (payload: MoveObjectPayload) => void;
  moveWorkbenchSampleLabelToGrossBalance: (payload: {
    source_slot_id: string;
    label_id: string;
  }) => void;
  moveWidgetProduceLotToGrossBalance: (payload: MoveWidgetProduceLotToGrossBalancePayload) => void;
  moveWorkbenchProduceLotToGrossBalance: (payload: MoveWorkbenchProduceLotToGrossBalancePayload) => void;
  moveWorkspaceProduceLotToGrossBalance: (payload: MoveWorkspaceProduceLotToGrossBalancePayload) => void;
  restoreTrashedProduceLotToGrossBalance: (payload: RestoreTrashedProduceLotToGrossBalancePayload) => void;
  restoreTrashedSampleLabelToGrossBalance: (payload: {
    trash_sample_label_id: string;
  }) => void;
};

type GrossBalanceDndOptions = {
  buildDebugProduceDraftFields: () => DropDraftField[];
  dndDisabledByAction: boolean;
  dragState: Pick<
    DragStateApi,
    | "activeDropTargets"
    | "activeDragItem"
    | "clearDropTargets"
    | "setActiveDragItem"
    | "showDropTargets"
  >;
  experimentApi: GrossBalanceDndExperimentApi;
  grossBalanceProduceLot: ExperimentProduceLot | null;
  grossBalanceTool: BenchToolInstance | null;
  hasPrintedLabelTicket: boolean;
  setPendingDropDraft: (draft: DropDraft | null) => void;
};

export type GrossBalanceDndApi = {
  handleBalanceItemDragStart: (dataTransfer: DataTransfer) => void;
  handleBalanceStagedToolDragOver: (event: DragEvent<HTMLElement>) => void;
  handleBalanceStagedToolDrop: (event: DragEvent<HTMLElement>) => void;
  handleGrossBalanceDragOver: (event: DragEvent<HTMLDivElement>) => void;
  handleGrossBalanceDrop: (event: DragEvent<HTMLDivElement>) => void;
  handleGrossBalanceProduceLotDragStart: (
    produceLot: ExperimentProduceLot,
    dataTransfer: DataTransfer,
  ) => void;
  isGrossBalanceSampleBagHighlighted: boolean;
};

export function useGrossBalanceDnd({
  buildDebugProduceDraftFields,
  dndDisabledByAction,
  dragState,
  experimentApi,
  grossBalanceProduceLot,
  grossBalanceTool,
  setPendingDropDraft,
}: GrossBalanceDndOptions): GrossBalanceDndApi {
  const { activeDragItem, clearDropTargets, setActiveDragItem, showDropTargets } = dragState;

  const applyLimsTicketToGrossBalance = () => {
    clearDropTargets();
    void experimentApi.applyPrintedLimsLabelToGrossBalanceBag();
  };

  const canAcceptBalanceStagedToolDrop = (event: DragEvent<HTMLElement>) => {
    return canResolveLabelDropOnTool(event.dataTransfer, {
      parentDropTargetTypes: ["gross_balance_widget"],
      tool: grossBalanceTool,
    });
  };

  const handleGrossBalanceDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (dndDisabledByAction) {
      return;
    }
    if (canResolveActiveLabelDragOnTool(activeDragItem, {
      parentDropTargetTypes: ["gross_balance_widget"],
      tool: grossBalanceTool,
    })) {
      event.preventDefault();
      return;
    }
    if (hasCompatibleDropTarget(event.dataTransfer, "gross_balance_widget")) {
      event.preventDefault();
    }
  };

  const handleGrossBalanceDrop = (event: DragEvent<HTMLDivElement>) => {
    if (dndDisabledByAction) {
      return;
    }
    const labelDragPayload = readLabelDragPayload(event.dataTransfer);
    if (
      labelDragPayload &&
      canResolveLabelDropOnTool(event.dataTransfer, {
        parentDropTargetTypes: ["gross_balance_widget"],
        tool: grossBalanceTool,
      })
    ) {
      event.preventDefault();
      event.stopPropagation();
      clearDropTargets();

      const command = resolveLabelDropCommand(labelDragPayload, { kind: "gross_balance" });
      if (!command) {
        return;
      }

      executeGrossBalanceLabelDropCommand(command, {
        ...experimentApi,
        applyPrintedLimsLabelToGrossBalanceBag: applyLimsTicketToGrossBalance,
      });
      return;
    }

    const canDropOnBalanceWidget = hasCompatibleDropTarget(event.dataTransfer, "gross_balance_widget");
    if (!canDropOnBalanceWidget) {
      return;
    }
    const toolbarPayload = readToolbarDragPayload(event.dataTransfer);
    const toolPayload =
      (toolbarPayload?.itemType === "tool" ? toolbarPayload : null) ??
      readEquipmentToolDragPayload(event.dataTransfer);
    const producePayload = readProduceDragPayload(event.dataTransfer);

    event.preventDefault();
    event.stopPropagation();
    clearDropTargets();

    if (toolPayload) {
      const command = resolveToolDropCommand(toolPayload, { kind: "gross_balance" });
      if (command && executeToolDropCommand(command, experimentApi)) {
        return;
      }
    }

    if (producePayload) {
      const command = resolveProduceDropCommand(producePayload, { kind: "gross_balance" });
      if (command && executeGrossBalanceProduceDropCommand(command, experimentApi, {
        buildDebugProduceDraftFields,
        setPendingDropDraft,
      })) {
        return;
      }
    }
  };

  const handleBalanceItemDragStart = (dataTransfer: DataTransfer) => {
    if (grossBalanceTool) {
      if (grossBalanceTool.isDraggable === false) {
        return;
      }
      const allowedDropTargets = grossBalanceTool.allowedDropTargets ?? [];
      writeEquipmentToolDragPayload(dataTransfer, {
        allowedDropTargets,
        entityKind: "tool",
        sourceId: "gross_balance",
        sourceKind: "gross_balance",
        entityId: grossBalanceTool.id,
        toolId: grossBalanceTool.toolId,
        toolType: grossBalanceTool.toolType,
      });
      showDropTargets(allowedDropTargets);
      setActiveDragItem({
        allowedDropTargets,
        entityKind: "tool",
        sourceId: "gross_balance",
        sourceKind: "gross_balance",
        entityId: grossBalanceTool.id,
        toolId: grossBalanceTool.toolId,
        toolType: grossBalanceTool.toolType,
      });
      return;
    }

    if (!grossBalanceProduceLot) {
      return;
    }

    const payload: ProduceDragPayload = {
      allowedDropTargets: grossBalanceProduceLot.allowedDropTargets ?? [],
      entityKind: "produce",
      produceLotId: grossBalanceProduceLot.id,
      produceType: grossBalanceProduceLot.produceType,
      sourceId: "gross_balance",
      sourceKind: "gross_balance",
    };
    writeProduceDragPayload(dataTransfer, payload);
    showDropTargets(payload.allowedDropTargets);
    setActiveDragItem(toDragDescriptor(payload));
  };

  const handleGrossBalanceProduceLotDragStart = (
    produceLot: ExperimentProduceLot,
    dataTransfer: DataTransfer,
  ) => {
    const payload: ProduceDragPayload = {
      allowedDropTargets: produceLot.allowedDropTargets ?? [],
      entityKind: "produce",
      produceLotId: produceLot.id,
      produceType: produceLot.produceType,
      sourceId: produceLot.id,
      sourceKind: "gross_balance",
    };
    writeProduceDragPayload(dataTransfer, payload);
    showDropTargets(payload.allowedDropTargets);
    setActiveDragItem(toDragDescriptor(payload));
  };

  const handleBalanceStagedToolDragOver = (event: DragEvent<HTMLElement>) => {
    if (canResolveActiveLabelDragOnTool(activeDragItem, {
      parentDropTargetTypes: ["gross_balance_widget"],
      tool: grossBalanceTool,
    })) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const handleBalanceStagedToolDrop = (event: DragEvent<HTMLElement>) => {
    if (!canAcceptBalanceStagedToolDrop(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    clearDropTargets();

    const labelDragPayload = readLabelDragPayload(event.dataTransfer);
    if (labelDragPayload?.kind === "lims_label_ticket") {
      applyLimsTicketToGrossBalance();
      return;
    }
    if (labelDragPayload?.kind === "palette_sample_label") {
      void experimentApi.applySampleLabelToGrossBalanceTool();
      return;
    }
    if (labelDragPayload?.kind === "workbench_sample_label") {
      void experimentApi.moveWorkbenchSampleLabelToGrossBalance({
        source_slot_id: labelDragPayload.payload.sourceSlotId!,
        label_id: labelDragPayload.payload.sampleLabelId,
      });
      return;
    }
    if (labelDragPayload?.kind === "trash_sample_label") {
      void experimentApi.restoreTrashedSampleLabelToGrossBalance({
        trash_sample_label_id: labelDragPayload.payload.trashSampleLabelId!,
      });
    }
  };

  const isGrossBalanceSampleBagHighlighted =
    canResolveActiveLabelDragOnTool(activeDragItem, {
      parentDropTargetTypes: ["gross_balance_widget"],
      tool: grossBalanceTool,
    });

  return {
    handleBalanceItemDragStart,
    handleBalanceStagedToolDragOver,
    handleBalanceStagedToolDrop,
    handleGrossBalanceDragOver,
    handleGrossBalanceDrop,
    handleGrossBalanceProduceLotDragStart,
    isGrossBalanceSampleBagHighlighted,
  };
}
