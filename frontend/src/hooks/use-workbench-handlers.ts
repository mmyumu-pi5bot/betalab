import type { Dispatch, SetStateAction } from "react";

import type { DropDraft } from "@/hooks/use-drop-draft";
import { containmentAcceptsDescriptor } from "@/lib/containment-resolver";
import { labLiquidCatalog } from "@/lib/lab-workflow-catalog";
import { canResolveActiveWorkbenchSlotDrop } from "@/lib/workbench-slot-drop-resolver";
import type {
  BenchLabel,
  BenchSlot,
  BenchToolInstance,
  DragDescriptor,
  DropTargetType,
  ToolbarDragPayload,
} from "@/types/workbench";

type WorkbenchHandlersExperimentApi = {
  addWorkbenchSlot: () => void;
  applySampleLabelToWorkbenchTool: (payload: { slot_id: string }) => void;
  applyPrintedLimsLabel: (payload: { slot_id: string }) => void;
  applyPrintedLimsLabelToBasketBag: () => void;
  applyPrintedLimsLabelToGrossBalanceBag: () => void;
  closeWorkbenchTool: (payload: { slot_id: string }) => void;
  moveSampleLabelBetweenWorkbenchTools: (payload: {
    label_id: string;
    source_slot_id: string;
    target_slot_id: string;
  }) => void;
  openWorkbenchTool: (payload: { slot_id: string }) => void;
  placeToolOnWorkbench: (payload: { slot_id: string; tool_id: string }) => void;
  removeLiquidFromWorkbenchTool: (payload: { slot_id: string; liquid_entry_id: string }) => void;
  removeWorkbenchSlot: (payload: { slot_id: string }) => void;
  restoreTrashedSampleLabelToWorkbenchTool: (payload: {
    target_slot_id: string;
    trash_sample_label_id: string;
  }) => void;
  updateWorkbenchToolSampleLabelText: (payload: {
    label_id?: string;
    slot_id: string;
    sample_label_text: string;
  }) => void;
};

type UseWorkbenchHandlersOptions = {
  activeDragItem: DragDescriptor | null;
  activeDropTargets: DropTargetType[];
  clearDropTargets: () => void;
  dndDisabledByAction: boolean;
  experimentApi: WorkbenchHandlersExperimentApi;
  hasPrintedLabelTicket: boolean;
  setPendingDropDraft: Dispatch<SetStateAction<DropDraft | null>>;
};

type WorkbenchHandlers = {
  canApplyLimsLabelToSlot: (slot: BenchSlot) => boolean;
  handleAddWorkbenchSlot: () => void;
  handleApplyLimsLabelTicket: (payload: {
    basketBag?: true;
    grossBalanceBag?: true;
    slotId?: string;
  }) => void;
  handleApplySampleLabel: (slotId: string) => void;
  handleMoveSampleLabel: (
    targetSlotId: string,
    payload: { label?: BenchLabel; sourceSlotId?: string },
  ) => void;
  handleRemoveLiquid: (slotId: string, liquidId: string) => void;
  handleRemoveWorkbenchSlot: (slotId: string) => void;
  handleRestoreTrashedSampleLabel: (
    targetSlotId: string,
    payload: { trashSampleLabelId?: string },
  ) => void;
  handleSampleLabelTextChange: (slotId: string, labelId: string, text: string) => void;
  handleToggleToolSeal: (slotId: string, tool: BenchToolInstance) => void;
  handleToolbarItemDrop: (slotId: string, payload: ToolbarDragPayload) => void;
  isBenchSlotHighlighted: (slot: BenchSlot) => boolean;
};

export function useWorkbenchHandlers({
  activeDragItem,
  activeDropTargets,
  clearDropTargets,
  dndDisabledByAction,
  experimentApi,
  hasPrintedLabelTicket,
  setPendingDropDraft,
}: UseWorkbenchHandlersOptions): WorkbenchHandlers {
  const canApplyLimsTicketToSlot = (slot: BenchSlot): boolean => {
    if (slot.tool === null || !hasPrintedLabelTicket) {
      return false;
    }
    return containmentAcceptsDescriptor(slot.tool.containment, {
      allowedDropTargets: [],
      entityKind: "lims_label_ticket",
      labelText: "",
      sampleCode: "",
      sourceId: "lims_label_ticket",
      sourceKind: "palette",
      ticketId: "lims_label_ticket",
    });
  };

  const handleToolbarItemDrop = (slotId: string, payload: ToolbarDragPayload) => {
    if (payload.itemType === "tool") {
      clearDropTargets();
      void experimentApi.placeToolOnWorkbench({ slot_id: slotId, tool_id: payload.itemId });
      return;
    }

    if (payload.itemType !== "liquid") {
      return;
    }

    clearDropTargets();
    const liquidDefinition = labLiquidCatalog[payload.itemId];
    setPendingDropDraft({
      commandType: "add_liquid_to_workbench_tool",
      fields: [
        {
          ariaLabel: `${liquidDefinition?.name ?? "Liquid"} draft volume`,
          id: "volume_ml",
          inputStep: 0.1,
          label: "Volume",
          stepAmount: 1,
          unitLabel: "mL",
          value: liquidDefinition?.transfer_volume_ml ?? 0,
          wheelStep: 1,
        },
      ],
      itemId: payload.itemId,
      targetId: slotId,
      targetKind: "bench_slot",
      title: `Dose ${liquidDefinition?.name ?? "Liquid"}`,
    });
  };

  const handleApplySampleLabel = (slotId: string) => {
    clearDropTargets();
    void experimentApi.applySampleLabelToWorkbenchTool({ slot_id: slotId });
  };

  const handleSampleLabelTextChange = (slotId: string, labelId: string, text: string) => {
    void experimentApi.updateWorkbenchToolSampleLabelText({
      label_id: labelId,
      slot_id: slotId,
      sample_label_text: text,
    });
  };

  const handleToggleToolSeal = (slotId: string, tool: BenchToolInstance) => {
    if (tool.isSealed) {
      void experimentApi.openWorkbenchTool({ slot_id: slotId });
      return;
    }
    void experimentApi.closeWorkbenchTool({ slot_id: slotId });
  };

  const handleMoveSampleLabel = (
    targetSlotId: string,
    payload: { label?: BenchLabel; sourceSlotId?: string },
  ) => {
    if (!payload.sourceSlotId || !payload.label) {
      return;
    }
    if (payload.sourceSlotId === targetSlotId) {
      clearDropTargets();
      return;
    }
    clearDropTargets();
    void experimentApi.moveSampleLabelBetweenWorkbenchTools({
      label_id: payload.label.id,
      source_slot_id: payload.sourceSlotId,
      target_slot_id: targetSlotId,
    });
  };

  const handleRestoreTrashedSampleLabel = (
    targetSlotId: string,
    payload: { trashSampleLabelId?: string },
  ) => {
    if (!payload.trashSampleLabelId) {
      return;
    }
    clearDropTargets();
    void experimentApi.restoreTrashedSampleLabelToWorkbenchTool({
      target_slot_id: targetSlotId,
      trash_sample_label_id: payload.trashSampleLabelId,
    });
  };

  const handleRemoveLiquid = (slotId: string, liquidId: string) => {
    void experimentApi.removeLiquidFromWorkbenchTool({
      slot_id: slotId,
      liquid_entry_id: liquidId,
    });
  };

  const handleAddWorkbenchSlot = () => {
    void experimentApi.addWorkbenchSlot();
  };

  const handleRemoveWorkbenchSlot = (slotId: string) => {
    void experimentApi.removeWorkbenchSlot({ slot_id: slotId });
  };

  const handleApplyLimsLabelTicket = (payload: {
    basketBag?: true;
    grossBalanceBag?: true;
    slotId?: string;
  }) => {
    clearDropTargets();
    if (payload.basketBag) {
      void experimentApi.applyPrintedLimsLabelToBasketBag();
      return;
    }
    if (payload.grossBalanceBag) {
      void experimentApi.applyPrintedLimsLabelToGrossBalanceBag();
      return;
    }
    if (payload.slotId) {
      void experimentApi.applyPrintedLimsLabel({ slot_id: payload.slotId });
    }
  };

  const isBenchSlotHighlighted = (slot: BenchSlot): boolean => {
    if (dndDisabledByAction || !activeDragItem) {
      return false;
    }

    if (
      activeDragItem.entityKind === "tool" ||
      activeDragItem.entityKind === "liquid" ||
      activeDragItem.entityKind === "produce" ||
      activeDragItem.entityKind === "sample_label" ||
      activeDragItem.entityKind === "lims_label_ticket"
    ) {
      if (
        !activeDropTargets.some((targetType) =>
          (slot.dropTargetTypes ?? []).includes(targetType),
        )
      ) {
        return false;
      }
      return canResolveActiveWorkbenchSlotDrop(activeDragItem, slot);
    }

    return false;
  };

  return {
    canApplyLimsLabelToSlot: canApplyLimsTicketToSlot,
    handleAddWorkbenchSlot,
    handleApplyLimsLabelTicket,
    handleApplySampleLabel,
    handleMoveSampleLabel,
    handleRemoveLiquid,
    handleRemoveWorkbenchSlot,
    handleRestoreTrashedSampleLabel,
    handleSampleLabelTextChange,
    handleToggleToolSeal,
    handleToolbarItemDrop,
    isBenchSlotHighlighted,
  };
}
