import type { Dispatch, SetStateAction } from "react";

import type { DebugProducePreset } from "@/components/debug-produce-palette";
import type { DropDraftField } from "@/components/drop-draft-card";
import type { DropDraft } from "@/hooks/use-drop-draft";
import type { DragStateApi } from "@/hooks/use-drag-state";
import { executeWorkbenchProduceDropCommand } from "@/lib/produce-drop-command-executor";
import { resolveProduceDropCommand } from "@/lib/produce-drop-command-resolver";
import { executeToolDropCommand } from "@/lib/tool-drop-command-executor";
import { resolveToolDropCommand } from "@/lib/tool-drop-command-resolver";
import {
  toDragDescriptor,
  writeEquipmentToolDragPayload,
  writeLimsLabelTicketDragPayload,
  writeProduceDragPayload,
  writeSampleLabelDragPayload,
} from "@/lib/workbench-dnd";
import type {
  AnalyticalBalanceToolDragPayload,
  CentrifugeToolDragPayload,
  IceBathToolDragPayload,
  BasketToolDragPayload,
  BenchLabel,
  BenchToolDragPayload,
  BenchToolInstance,
  ExperimentProduceLot,
  GrossBalanceToolDragPayload,
  LimsLabelTicketDragPayload,
  PrintedLabelTicket,
  ProduceDragPayload,
  RackToolDragPayload,
  TrashToolDragPayload,
  VortexToolDragPayload,
} from "@/types/workbench";

import type {
  CutWorkbenchProduceLotPayload,
  MoveObjectPayload,
} from "@/types/api-payloads";

export type WorkbenchDndExperimentApi = {
  cutWorkbenchProduceLot: (payload: CutWorkbenchProduceLotPayload) => void;
  moveObject: (payload: MoveObjectPayload) => void;
};

type WorkbenchDndOptions = {
  buildDebugProduceDraftFields: () => DropDraftField[];
  dndDisabledByAction: boolean;
  dragState: Pick<DragStateApi, "clearDropTargets" | "setActiveDragItem" | "showDropTargets">;
  experimentApi: WorkbenchDndExperimentApi;
  isKnifeMode: boolean;
  onBeforeProduceDrop?: (attempt: {
    payload: ProduceDragPayload;
    proceed: () => void;
    targetSlotId: string;
  }) => boolean;
  setPendingDropDraft: Dispatch<SetStateAction<DropDraft | null>>;
};

export type WorkbenchDndApi = {
  canDragBenchTool: (slotId: string, tool: BenchToolInstance) => boolean;
  handleBasketProduceDragStart: (produceLot: ExperimentProduceLot, dataTransfer: DataTransfer) => void;
  handleBasketToolDragStart: (tool: BenchToolInstance, dataTransfer: DataTransfer) => void;
  handleBenchToolDragStart: (
    slotId: string,
    tool: BenchToolInstance,
    dataTransfer: DataTransfer,
  ) => void;
  handleBenchToolDrop: (
    targetSlotId: string,
    payload:
      | BenchToolDragPayload
      | BasketToolDragPayload
      | RackToolDragPayload
      | GrossBalanceToolDragPayload
      | AnalyticalBalanceToolDragPayload
      | CentrifugeToolDragPayload
      | IceBathToolDragPayload
      | VortexToolDragPayload
      | TrashToolDragPayload,
  ) => void;
  handleDebugProducePresetDragStart: (
    preset: DebugProducePreset,
    dataTransfer: DataTransfer,
  ) => void;
  handleLimsTicketDragStart: (ticket: PrintedLabelTicket, dataTransfer: DataTransfer) => void;
  handleProduceDrop: (targetSlotId: string, payload: ProduceDragPayload) => void;
  handleWorkbenchProduceLotClick: (slotId: string, produceLot: ExperimentProduceLot) => void;
  handleWorkbenchProduceLotDragStart: (
    slotId: string,
    produceLot: ExperimentProduceLot,
    dataTransfer: DataTransfer,
  ) => void;
  handleWorkbenchSampleLabelDragStart: (
    slotId: string,
    label: BenchLabel,
    dataTransfer: DataTransfer,
  ) => void;
};

export function useWorkbenchDnd({
  buildDebugProduceDraftFields,
  dndDisabledByAction,
  dragState,
  experimentApi,
  isKnifeMode,
  onBeforeProduceDrop,
  setPendingDropDraft,
}: WorkbenchDndOptions): WorkbenchDndApi {
  const { clearDropTargets, setActiveDragItem, showDropTargets } = dragState;

  const getBenchToolAllowedDropTargets = (tool: BenchToolInstance) => tool.allowedDropTargets ?? [];

  const canDragBenchTool = (_slotId: string, tool: BenchToolInstance) => {
    if (dndDisabledByAction) {
      return false;
    }
    if (tool.isDraggable === false) {
      return false;
    }
    return getBenchToolAllowedDropTargets(tool).length > 0;
  };

  const handleBenchToolDragStart = (
    slotId: string,
    tool: BenchToolInstance,
    dataTransfer: DataTransfer,
  ) => {
    if (!canDragBenchTool(slotId, tool)) {
      return;
    }

    const allowedDropTargets = getBenchToolAllowedDropTargets(tool);
    writeEquipmentToolDragPayload(dataTransfer, {
      allowedDropTargets: [...allowedDropTargets],
      entityKind: "tool",
      sourceId: slotId,
      sourceKind: "workbench",
      sourceSlotId: slotId,
      entityId: tool.id,
      toolId: tool.toolId,
      toolType: tool.toolType,
    });
    showDropTargets(allowedDropTargets);
    setActiveDragItem({
      allowedDropTargets,
      entityKind: "tool",
      sourceId: slotId,
      sourceKind: "workbench",
      entityId: tool.id,
      toolId: tool.toolId,
      toolType: tool.toolType,
    });
  };

  const handleBenchToolDrop = (
    targetSlotId: string,
    payload:
      | BenchToolDragPayload
      | BasketToolDragPayload
      | RackToolDragPayload
      | GrossBalanceToolDragPayload
      | AnalyticalBalanceToolDragPayload
      | CentrifugeToolDragPayload
      | IceBathToolDragPayload
      | VortexToolDragPayload
      | TrashToolDragPayload,
  ) => {
    clearDropTargets();
    const command = resolveToolDropCommand(payload, {
      kind: "workbench_slot",
      slotId: targetSlotId,
    });
    if (!command) {
      return;
    }
    executeToolDropCommand(command, experimentApi);
  };

  const handleBasketToolDragStart = (tool: BenchToolInstance, dataTransfer: DataTransfer) => {
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
      sourceKind: "basket",
      entityId: tool.id,
      toolId: tool.toolId,
      toolType: tool.toolType,
    });
    showDropTargets(allowedDropTargets);
    setActiveDragItem({
      allowedDropTargets,
      entityKind: "tool",
      sourceId: tool.id,
      sourceKind: "basket",
      entityId: tool.id,
      toolId: tool.toolId,
      toolType: tool.toolType,
    });
  };

  const handleLimsTicketDragStart = (ticket: PrintedLabelTicket, dataTransfer: DataTransfer) => {
    if (ticket.isDraggable === false) {
      return;
    }
    const allowedDropTargets = ticket.allowedDropTargets ?? [];
    const payload: LimsLabelTicketDragPayload = {
      allowedDropTargets,
      entityKind: "lims_label_ticket",
      sourceId: ticket.id,
      sourceKind: "lims",
      ticketId: ticket.id,
      sampleCode: ticket.sampleCode,
      labelText: ticket.labelText,
    };
    writeLimsLabelTicketDragPayload(dataTransfer, payload);
    showDropTargets(payload.allowedDropTargets);
    setActiveDragItem(toDragDescriptor(payload));
  };

  const handleProduceDrop = (targetSlotId: string, payload: ProduceDragPayload) => {
    const command = resolveProduceDropCommand(payload, {
      kind: "workbench_tool",
      slotId: targetSlotId,
    });
    if (command) {
      let didProceed = false;
      const proceed = () => {
        if (didProceed) {
          return;
        }
        didProceed = true;
        executeWorkbenchProduceDropCommand(command, experimentApi, {
          buildDebugProduceDraftFields,
          setPendingDropDraft,
        });
      };
      const shouldProceed = onBeforeProduceDrop?.({ payload, proceed, targetSlotId }) ?? true;
      if (shouldProceed) {
        proceed();
      }
    }
    clearDropTargets();
  };

  const handleWorkbenchProduceLotClick = (slotId: string, produceLot: ExperimentProduceLot) => {
    if (!isKnifeMode || (produceLot.materialState ?? "whole") !== "whole") {
      return;
    }
    void experimentApi.cutWorkbenchProduceLot({
      slot_id: slotId,
      produce_lot_id: produceLot.id,
    });
  };

  const handleBasketProduceDragStart = (
    produceLot: ExperimentProduceLot,
    dataTransfer: DataTransfer,
  ) => {
    if (dndDisabledByAction) {
      return;
    }
    const allowedDropTargets = produceLot.allowedDropTargets ?? [];

    writeProduceDragPayload(dataTransfer, {
      allowedDropTargets,
      entityKind: "produce",
      produceLotId: produceLot.id,
      produceType: produceLot.produceType as "apple",
      sourceId: produceLot.id,
      sourceKind: "basket",
    });
    showDropTargets(allowedDropTargets);
    setActiveDragItem({
      allowedDropTargets,
      entityKind: "produce",
      produceLotId: produceLot.id,
      produceType: produceLot.produceType as "apple",
      sourceId: produceLot.id,
      sourceKind: "basket",
    });
  };

  const handleDebugProducePresetDragStart = (
    preset: DebugProducePreset,
    dataTransfer: DataTransfer,
  ) => {
    if (dndDisabledByAction) {
      return;
    }
    const allowedDropTargets = preset.produceLot.allowedDropTargets ?? [];

    writeProduceDragPayload(dataTransfer, {
      allowedDropTargets,
      debugProducePresetId: preset.id,
      entityKind: "produce",
      produceLotId: preset.id,
      produceType: preset.produceLot.produceType,
      sourceId: preset.id,
      sourceKind: "debug_palette",
    });
    showDropTargets(allowedDropTargets);
    setActiveDragItem({
      allowedDropTargets,
      debugProducePresetId: preset.id,
      entityKind: "produce",
      produceLotId: preset.id,
      produceType: preset.produceLot.produceType,
      sourceId: preset.id,
      sourceKind: "debug_palette",
    });
  };

  const handleWorkbenchProduceLotDragStart = (
    slotId: string,
    produceLot: ExperimentProduceLot,
    dataTransfer: DataTransfer,
  ) => {
    if (dndDisabledByAction) {
      return;
    }
    const allowedDropTargets = produceLot.allowedDropTargets ?? [];

    writeProduceDragPayload(dataTransfer, {
      allowedDropTargets,
      entityKind: "produce",
      produceLotId: produceLot.id,
      produceType: produceLot.produceType,
      sourceId: produceLot.id,
      sourceKind: "workbench",
      sourceSlotId: slotId,
    });
    showDropTargets(allowedDropTargets);
    setActiveDragItem({
      allowedDropTargets,
      entityKind: "produce",
      produceLotId: produceLot.id,
      produceType: produceLot.produceType,
      sourceId: produceLot.id,
      sourceKind: "workbench",
      sourceSlotId: slotId,
    });
  };

  const handleWorkbenchSampleLabelDragStart = (
    slotId: string,
    label: BenchLabel,
    dataTransfer: DataTransfer,
  ) => {
    if (dndDisabledByAction) {
      return;
    }
    if (label.isDraggable === false) {
      return;
    }
    const allowedDropTargets = label.allowedDropTargets ?? [];

    writeSampleLabelDragPayload(dataTransfer, {
      allowedDropTargets,
      entityKind: "sample_label",
      label,
      sampleLabelId: label.id,
      sampleLabelText: label.text,
      sourceId: slotId,
      sourceKind: "workbench",
      sourceSlotId: slotId,
    });
    showDropTargets(allowedDropTargets);
    setActiveDragItem({
      allowedDropTargets,
      entityKind: "sample_label",
      label,
      sampleLabelId: label.id,
      sampleLabelText: label.text,
      sourceId: slotId,
      sourceKind: "workbench",
      sourceSlotId: slotId,
    });
  };

  return {
    canDragBenchTool,
    handleBasketProduceDragStart,
    handleBasketToolDragStart,
    handleBenchToolDragStart,
    handleBenchToolDrop,
    handleDebugProducePresetDragStart,
    handleLimsTicketDragStart,
    handleProduceDrop,
    handleWorkbenchProduceLotClick,
    handleWorkbenchProduceLotDragStart,
    handleWorkbenchSampleLabelDragStart,
  };
}
