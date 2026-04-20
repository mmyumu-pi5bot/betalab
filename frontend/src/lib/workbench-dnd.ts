import type {
  AnalyticalBalanceToolDragPayload,
  BenchLabel,
  BasketToolDragPayload,
  BenchToolDragPayload,
  DragDescriptor,
  DropTargetType,
  GrossBalanceToolDragPayload,
  LimsLabelTicketDragPayload,
  ProduceDragPayload,
  RackToolDragPayload,
  SampleLabelDragPayload,
  TrashToolDragPayload,
  ToolbarDragPayload,
  ToolbarItem,
  VortexToolDragPayload,
  WorkspaceLiquidDragPayload,
  WorkspaceWidgetDragPayload,
} from "@/types/workbench";

const WORKBENCH_DRAG_MIME = "application/x-betalab-workbench-item";
const BENCH_TOOL_DRAG_MIME = "application/x-betalab-bench-tool-item";
const BASKET_TOOL_DRAG_MIME = "application/x-betalab-basket-tool-item";
const RACK_TOOL_DRAG_MIME = "application/x-betalab-rack-tool-item";
const GROSS_BALANCE_TOOL_DRAG_MIME = "application/x-betalab-gross-balance-tool-item";
const ANALYTICAL_BALANCE_TOOL_DRAG_MIME = "application/x-betalab-analytical-balance-tool-item";
const VORTEX_TOOL_DRAG_MIME = "application/x-betalab-vortex-tool-item";
const TRASH_TOOL_DRAG_MIME = "application/x-betalab-trash-tool-item";
const WORKSPACE_WIDGET_DRAG_MIME = "application/x-betalab-workspace-widget-item";
const WORKSPACE_LIQUID_DRAG_MIME = "application/x-betalab-workspace-liquid-item";
const PRODUCE_DRAG_MIME = "application/x-betalab-produce-item";
const SAMPLE_LABEL_DRAG_MIME = "application/x-betalab-sample-label-item";
const LIMS_LABEL_TICKET_DRAG_MIME = "application/x-betalab-lims-label-ticket-item";
const DROP_TARGET_MIME_PREFIX = "application/x-betalab-drop-target-";

function getDropTargetMime(targetType: DropTargetType) {
  return `${DROP_TARGET_MIME_PREFIX}${targetType}`;
}

function isDropTargetType(targetType: unknown): targetType is DropTargetType {
  return (
    targetType === "workbench_slot" ||
    targetType === "workspace_canvas" ||
    targetType === "inventory_panel" ||
    targetType === "rack_slot" ||
    targetType === "trash_bin" ||
    targetType === "grinder_widget" ||
    targetType === "gross_balance_widget" ||
    targetType === "analytical_balance_widget"
  );
}

export function writeToolbarDragPayload(dataTransfer: DataTransfer, payload: ToolbarDragPayload) {
  const serialized = JSON.stringify(payload);

  dataTransfer.setData(WORKBENCH_DRAG_MIME, serialized);
  dataTransfer.setData("text/plain", serialized);
  payload.allowedDropTargets.forEach((targetType) => {
    dataTransfer.setData(getDropTargetMime(targetType), payload.itemId);
  });
  dataTransfer.effectAllowed = "copy";
}

export function createToolbarDragPayload(item: ToolbarItem): ToolbarDragPayload {
  if (item.itemType === "tool") {
    return {
      allowedDropTargets: item.allowedDropTargets,
      entityKind: "tool",
      itemId: item.id,
      itemType: "tool",
      sourceId: item.id,
      sourceKind: "palette",
      toolType: item.toolType,
    };
  }

  if (item.itemType === "liquid") {
    return {
      allowedDropTargets: item.allowedDropTargets,
      entityKind: "liquid",
      itemId: item.id,
      itemType: "liquid",
      liquidType: item.liquidType,
      sourceId: item.id,
      sourceKind: "palette",
    };
  }

  if (item.itemType === "sample_label") {
    return {
      allowedDropTargets: item.allowedDropTargets,
      entityKind: "sample_label",
      itemId: item.id,
      itemType: "sample_label",
      sourceId: item.id,
      sourceKind: "palette",
    };
  }

  return {
    allowedDropTargets: item.allowedDropTargets,
    entityKind: "workspace_widget",
    itemId: item.id,
    itemType: "workspace_widget",
    sourceId: item.id,
    sourceKind: "palette",
    widgetType: item.widgetType,
  };
}

export function writeBenchToolDragPayload(dataTransfer: DataTransfer, payload: BenchToolDragPayload) {
  const serialized = JSON.stringify(payload);

  dataTransfer.setData(BENCH_TOOL_DRAG_MIME, serialized);
  dataTransfer.setData("text/plain", serialized);
  payload.allowedDropTargets.forEach((targetType) => {
    dataTransfer.setData(getDropTargetMime(targetType), payload.sourceSlotId);
  });
  dataTransfer.effectAllowed = "move";
}

export function writeBasketToolDragPayload(
  dataTransfer: DataTransfer,
  payload: BasketToolDragPayload,
) {
  const serialized = JSON.stringify(payload);

  dataTransfer.setData(BASKET_TOOL_DRAG_MIME, serialized);
  dataTransfer.setData("text/plain", serialized);
  payload.allowedDropTargets.forEach((targetType) => {
    dataTransfer.setData(getDropTargetMime(targetType), payload.sourceId);
  });
  dataTransfer.effectAllowed = "move";
}

export function writeRackToolDragPayload(dataTransfer: DataTransfer, payload: RackToolDragPayload) {
  const serialized = JSON.stringify(payload);

  dataTransfer.setData(RACK_TOOL_DRAG_MIME, serialized);
  dataTransfer.setData("text/plain", serialized);
  payload.allowedDropTargets.forEach((targetType) => {
    dataTransfer.setData(getDropTargetMime(targetType), payload.rackSlotId);
  });
  dataTransfer.effectAllowed = "move";
}

export function writeGrossBalanceToolDragPayload(
  dataTransfer: DataTransfer,
  payload: GrossBalanceToolDragPayload,
) {
  const serialized = JSON.stringify(payload);

  dataTransfer.setData(GROSS_BALANCE_TOOL_DRAG_MIME, serialized);
  dataTransfer.setData("text/plain", serialized);
  payload.allowedDropTargets.forEach((targetType) => {
    dataTransfer.setData(getDropTargetMime(targetType), payload.sourceId);
  });
  dataTransfer.effectAllowed = "move";
}

export function writeAnalyticalBalanceToolDragPayload(
  dataTransfer: DataTransfer,
  payload: AnalyticalBalanceToolDragPayload,
) {
  const serialized = JSON.stringify(payload);

  dataTransfer.setData(ANALYTICAL_BALANCE_TOOL_DRAG_MIME, serialized);
  dataTransfer.setData("text/plain", serialized);
  payload.allowedDropTargets.forEach((targetType) => {
    dataTransfer.setData(getDropTargetMime(targetType), payload.sourceId);
  });
  dataTransfer.effectAllowed = "move";
}

export function writeVortexToolDragPayload(
  dataTransfer: DataTransfer,
  payload: VortexToolDragPayload,
) {
  const serialized = JSON.stringify(payload);

  dataTransfer.setData(VORTEX_TOOL_DRAG_MIME, serialized);
  dataTransfer.setData("text/plain", serialized);
  payload.allowedDropTargets.forEach((targetType) => {
    dataTransfer.setData(getDropTargetMime(targetType), payload.sourceId);
  });
  dataTransfer.effectAllowed = "move";
}

export function writeTrashToolDragPayload(dataTransfer: DataTransfer, payload: TrashToolDragPayload) {
  const serialized = JSON.stringify(payload);

  dataTransfer.setData(TRASH_TOOL_DRAG_MIME, serialized);
  dataTransfer.setData("text/plain", serialized);
  payload.allowedDropTargets.forEach((targetType) => {
    dataTransfer.setData(getDropTargetMime(targetType), payload.trashToolId);
  });
  dataTransfer.effectAllowed = "move";
}

export function writeWorkspaceWidgetDragPayload(
  dataTransfer: DataTransfer,
  payload: WorkspaceWidgetDragPayload,
) {
  const serialized = JSON.stringify(payload);

  dataTransfer.setData(WORKSPACE_WIDGET_DRAG_MIME, serialized);
  dataTransfer.setData("text/plain", serialized);
  payload.allowedDropTargets.forEach((targetType) => {
    dataTransfer.setData(getDropTargetMime(targetType), payload.widgetId);
  });
  dataTransfer.effectAllowed = "move";
}

export function writeWorkspaceLiquidDragPayload(
  dataTransfer: DataTransfer,
  payload: WorkspaceLiquidDragPayload,
) {
  const serialized = JSON.stringify(payload);

  dataTransfer.setData(WORKSPACE_LIQUID_DRAG_MIME, serialized);
  dataTransfer.setData("text/plain", serialized);
  payload.allowedDropTargets.forEach((targetType) => {
    dataTransfer.setData(getDropTargetMime(targetType), payload.liquidEntryId);
  });
  dataTransfer.effectAllowed = "move";
}

export function writeProduceDragPayload(dataTransfer: DataTransfer, payload: ProduceDragPayload) {
  const serialized = JSON.stringify(payload);

  dataTransfer.setData(PRODUCE_DRAG_MIME, serialized);
  dataTransfer.setData("text/plain", serialized);
  payload.allowedDropTargets.forEach((targetType) => {
    dataTransfer.setData(getDropTargetMime(targetType), payload.produceLotId);
  });
  dataTransfer.effectAllowed = "move";
}

export function writeSampleLabelDragPayload(
  dataTransfer: DataTransfer,
  payload: SampleLabelDragPayload,
) {
  const serialized = JSON.stringify(payload);

  dataTransfer.setData(SAMPLE_LABEL_DRAG_MIME, serialized);
  dataTransfer.setData("text/plain", serialized);
  payload.allowedDropTargets.forEach((targetType) => {
    dataTransfer.setData(
      getDropTargetMime(targetType),
      payload.sourceSlotId ?? payload.trashSampleLabelId ?? payload.sampleLabelId,
    );
  });
  dataTransfer.effectAllowed = "move";
}

export function writeLimsLabelTicketDragPayload(
  dataTransfer: DataTransfer,
  payload: LimsLabelTicketDragPayload,
) {
  const serialized = JSON.stringify(payload);

  dataTransfer.setData(LIMS_LABEL_TICKET_DRAG_MIME, serialized);
  dataTransfer.setData("text/plain", serialized);
  payload.allowedDropTargets.forEach((targetType) => {
    dataTransfer.setData(getDropTargetMime(targetType), payload.ticketId);
  });
  dataTransfer.effectAllowed = "move";
}

function hasDragMime(dataTransfer: DataTransfer, mime: string) {
  return Array.from(dataTransfer.types ?? []).includes(mime);
}

export function hasCompatibleDropTarget(dataTransfer: DataTransfer, targetType: DropTargetType) {
  return hasDragMime(dataTransfer, getDropTargetMime(targetType));
}

export function readToolbarDragPayload(dataTransfer: DataTransfer): ToolbarDragPayload | null {
  const rawPayload =
    dataTransfer.getData(WORKBENCH_DRAG_MIME) || dataTransfer.getData("text/plain");

  if (!rawPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload) as Partial<ToolbarDragPayload>;
    const allowedDropTargets = parsed.allowedDropTargets?.filter(isDropTargetType) ?? [];

    if (
      parsed.entityKind === "tool" &&
      parsed.itemType === "tool" &&
      typeof parsed.itemId === "string" &&
      typeof parsed.toolType === "string" &&
      parsed.sourceKind === "palette" &&
      typeof parsed.sourceId === "string"
    ) {
      return {
        allowedDropTargets,
        entityKind: "tool",
        itemId: parsed.itemId,
        itemType: "tool",
        sourceId: parsed.sourceId,
        sourceKind: "palette",
        toolType: parsed.toolType,
      };
    }

    if (
      parsed.entityKind === "liquid" &&
      parsed.itemType === "liquid" &&
      typeof parsed.itemId === "string" &&
      typeof parsed.liquidType === "string" &&
      parsed.sourceKind === "palette" &&
      typeof parsed.sourceId === "string"
    ) {
      return {
        allowedDropTargets,
        entityKind: "liquid",
        itemId: parsed.itemId,
        itemType: "liquid",
        liquidType: parsed.liquidType,
        sourceId: parsed.sourceId,
        sourceKind: "palette",
      };
    }

    if (
      parsed.entityKind === "sample_label" &&
      parsed.itemType === "sample_label" &&
      typeof parsed.itemId === "string" &&
      parsed.sourceKind === "palette" &&
      typeof parsed.sourceId === "string"
    ) {
      return {
        allowedDropTargets,
        entityKind: "sample_label",
        itemId: parsed.itemId,
        itemType: "sample_label",
        sourceId: parsed.sourceId,
        sourceKind: "palette",
      };
    }

    if (
      parsed.entityKind === "workspace_widget" &&
      parsed.itemType === "workspace_widget" &&
      typeof parsed.itemId === "string" &&
      typeof parsed.widgetType === "string" &&
      parsed.sourceKind === "palette" &&
      typeof parsed.sourceId === "string"
    ) {
      return {
        allowedDropTargets,
        entityKind: "workspace_widget",
        itemId: parsed.itemId,
        itemType: "workspace_widget",
        sourceId: parsed.sourceId,
        sourceKind: "palette",
        widgetType: parsed.widgetType,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function readBasketToolDragPayload(
  dataTransfer: DataTransfer,
): BasketToolDragPayload | null {
  const rawPayload =
    dataTransfer.getData(BASKET_TOOL_DRAG_MIME) || dataTransfer.getData("text/plain");

  if (!rawPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload) as Partial<BasketToolDragPayload>;
    const allowedDropTargets = parsed.allowedDropTargets?.filter(isDropTargetType) ?? [];

    if (
      parsed.entityKind === "tool" &&
      parsed.sourceKind === "basket" &&
      typeof parsed.sourceId === "string" &&
      typeof parsed.toolId === "string" &&
      typeof parsed.toolType === "string"
    ) {
      return {
        allowedDropTargets,
        entityKind: "tool",
        sourceId: parsed.sourceId,
        sourceKind: "basket",
        toolId: parsed.toolId,
        toolType: parsed.toolType,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function readAnalyticalBalanceToolDragPayload(
  dataTransfer: DataTransfer,
): AnalyticalBalanceToolDragPayload | null {
  const rawPayload =
    dataTransfer.getData(ANALYTICAL_BALANCE_TOOL_DRAG_MIME) || dataTransfer.getData("text/plain");

  if (!rawPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload) as Partial<AnalyticalBalanceToolDragPayload>;
    const allowedDropTargets = parsed.allowedDropTargets?.filter(isDropTargetType) ?? [];

    if (
      parsed.entityKind === "tool" &&
      parsed.sourceKind === "analytical_balance" &&
      typeof parsed.sourceId === "string" &&
      typeof parsed.toolId === "string" &&
      typeof parsed.toolType === "string"
    ) {
      return {
        allowedDropTargets,
        entityKind: "tool",
        sourceId: parsed.sourceId,
        sourceKind: "analytical_balance",
        toolId: parsed.toolId,
        toolType: parsed.toolType,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function readVortexToolDragPayload(
  dataTransfer: DataTransfer,
): VortexToolDragPayload | null {
  const rawPayload =
    dataTransfer.getData(VORTEX_TOOL_DRAG_MIME) || dataTransfer.getData("text/plain");

  if (!rawPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload) as Partial<VortexToolDragPayload>;
    const allowedDropTargets = parsed.allowedDropTargets?.filter(isDropTargetType) ?? [];

    if (
      parsed.entityKind === "tool" &&
      parsed.sourceKind === "vortex" &&
      typeof parsed.sourceId === "string" &&
      typeof parsed.toolId === "string" &&
      typeof parsed.toolType === "string"
    ) {
      return {
        allowedDropTargets,
        entityKind: "tool",
        sourceId: parsed.sourceId,
        sourceKind: "vortex",
        toolId: parsed.toolId,
        toolType: parsed.toolType,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function readLimsLabelTicketDragPayload(
  dataTransfer: DataTransfer,
): LimsLabelTicketDragPayload | null {
  const rawPayload =
    dataTransfer.getData(LIMS_LABEL_TICKET_DRAG_MIME) || dataTransfer.getData("text/plain");

  if (!rawPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload) as Partial<LimsLabelTicketDragPayload>;
    const allowedDropTargets = parsed.allowedDropTargets?.filter(isDropTargetType) ?? [];

    if (
      parsed.entityKind === "lims_label_ticket" &&
      parsed.sourceKind === "lims" &&
      typeof parsed.ticketId === "string" &&
      typeof parsed.sampleCode === "string" &&
      typeof parsed.labelText === "string"
    ) {
      return {
        allowedDropTargets,
        entityKind: "lims_label_ticket",
        sourceId: parsed.ticketId,
        sourceKind: "lims",
        ticketId: parsed.ticketId,
        sampleCode: parsed.sampleCode,
        labelText: parsed.labelText,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function readBenchToolDragPayload(dataTransfer: DataTransfer): BenchToolDragPayload | null {
  const rawPayload =
    dataTransfer.getData(BENCH_TOOL_DRAG_MIME) || dataTransfer.getData("text/plain");

  if (!rawPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload) as Partial<BenchToolDragPayload>;
    const allowedDropTargets = parsed.allowedDropTargets?.filter(isDropTargetType) ?? [];

    if (
      parsed.entityKind === "tool" &&
      typeof parsed.sourceSlotId === "string" &&
      typeof parsed.sourceId === "string" &&
      parsed.sourceKind === "workbench" &&
      typeof parsed.toolId === "string" &&
      typeof parsed.toolType === "string" &&
      allowedDropTargets.length > 0
    ) {
      return {
        allowedDropTargets,
        entityKind: "tool",
        sourceId: parsed.sourceId,
        sourceKind: "workbench",
        sourceSlotId: parsed.sourceSlotId,
        toolId: parsed.toolId,
        toolType: parsed.toolType,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function readRackToolDragPayload(dataTransfer: DataTransfer): RackToolDragPayload | null {
  const rawPayload = dataTransfer.getData(RACK_TOOL_DRAG_MIME) || dataTransfer.getData("text/plain");

  if (!rawPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload) as Partial<RackToolDragPayload>;
    const allowedDropTargets = parsed.allowedDropTargets?.filter(isDropTargetType) ?? [];

    if (
      parsed.entityKind === "tool" &&
      typeof parsed.rackSlotId === "string" &&
      typeof parsed.sourceId === "string" &&
      parsed.sourceKind === "rack" &&
      typeof parsed.toolId === "string" &&
      typeof parsed.toolType === "string" &&
      allowedDropTargets.length > 0
    ) {
      return {
        allowedDropTargets,
        entityKind: "tool",
        rackSlotId: parsed.rackSlotId,
        sourceId: parsed.sourceId,
        sourceKind: "rack",
        toolId: parsed.toolId,
        toolType: parsed.toolType,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function readGrossBalanceToolDragPayload(
  dataTransfer: DataTransfer,
): GrossBalanceToolDragPayload | null {
  const rawPayload =
    dataTransfer.getData(GROSS_BALANCE_TOOL_DRAG_MIME) || dataTransfer.getData("text/plain");

  if (!rawPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload) as Partial<GrossBalanceToolDragPayload>;
    const allowedDropTargets = parsed.allowedDropTargets?.filter(isDropTargetType) ?? [];

    if (
      parsed.entityKind === "tool" &&
      parsed.sourceKind === "gross_balance" &&
      typeof parsed.sourceId === "string" &&
      typeof parsed.toolId === "string" &&
      typeof parsed.toolType === "string" &&
      allowedDropTargets.length > 0
    ) {
      return {
        allowedDropTargets,
        entityKind: "tool",
        sourceId: parsed.sourceId,
        sourceKind: "gross_balance",
        toolId: parsed.toolId,
        toolType: parsed.toolType,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function readTrashToolDragPayload(dataTransfer: DataTransfer): TrashToolDragPayload | null {
  const rawPayload =
    dataTransfer.getData(TRASH_TOOL_DRAG_MIME) || dataTransfer.getData("text/plain");

  if (!rawPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload) as Partial<TrashToolDragPayload>;
    const allowedDropTargets = parsed.allowedDropTargets?.filter(isDropTargetType) ?? [];

    if (
      parsed.entityKind === "tool" &&
      typeof parsed.trashToolId === "string" &&
      typeof parsed.sourceId === "string" &&
      parsed.sourceKind === "trash" &&
      typeof parsed.toolId === "string" &&
      typeof parsed.toolType === "string" &&
      allowedDropTargets.length > 0
    ) {
      return {
        allowedDropTargets,
        entityKind: "tool",
        sourceId: parsed.sourceId,
        sourceKind: "trash",
        trashToolId: parsed.trashToolId,
        toolId: parsed.toolId,
        toolType: parsed.toolType,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function readWorkspaceWidgetDragPayload(
  dataTransfer: DataTransfer,
): WorkspaceWidgetDragPayload | null {
  const rawPayload =
    dataTransfer.getData(WORKSPACE_WIDGET_DRAG_MIME) || dataTransfer.getData("text/plain");

  if (!rawPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload) as Partial<WorkspaceWidgetDragPayload>;
    const allowedDropTargets = parsed.allowedDropTargets?.filter(isDropTargetType) ?? [];

    if (
      parsed.entityKind === "workspace_widget" &&
      typeof parsed.widgetId === "string" &&
      typeof parsed.widgetType === "string" &&
      typeof parsed.sourceId === "string" &&
      parsed.sourceKind === "trash" &&
      allowedDropTargets.length > 0
    ) {
      return {
        allowedDropTargets,
        entityKind: "workspace_widget",
        sourceId: parsed.sourceId,
        sourceKind: "trash",
        widgetId: parsed.widgetId,
        widgetType: parsed.widgetType,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function readProduceDragPayload(dataTransfer: DataTransfer): ProduceDragPayload | null {
  const rawPayload =
    dataTransfer.getData(PRODUCE_DRAG_MIME) || dataTransfer.getData("text/plain");

  if (!rawPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload) as Partial<ProduceDragPayload>;
    const allowedDropTargets = parsed.allowedDropTargets?.filter(isDropTargetType) ?? [];

    if (
      parsed.entityKind === "produce" &&
      typeof parsed.produceLotId === "string" &&
      typeof parsed.produceType === "string" &&
      typeof parsed.sourceId === "string" &&
      (parsed.sourceKind === "basket" ||
        parsed.sourceKind === "gross_balance" ||
        (parsed.sourceKind === "debug_palette" && typeof parsed.debugProducePresetId === "string") ||
        parsed.sourceKind === "grinder" ||
        (parsed.sourceKind === "workbench" && typeof parsed.sourceSlotId === "string") ||
        (parsed.sourceKind === "trash" && typeof parsed.trashProduceLotId === "string")) &&
      allowedDropTargets.length > 0
    ) {
      return {
        allowedDropTargets,
        entityKind: "produce",
        produceLotId: parsed.produceLotId,
        produceType: parsed.produceType,
        sourceId: parsed.sourceId,
        sourceKind: parsed.sourceKind,
        ...(parsed.sourceKind === "debug_palette"
          ? { debugProducePresetId: parsed.debugProducePresetId }
          : {}),
        ...(parsed.sourceKind === "workbench" ? { sourceSlotId: parsed.sourceSlotId } : {}),
        ...(parsed.sourceKind === "trash" ? { trashProduceLotId: parsed.trashProduceLotId } : {}),
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function readWorkspaceLiquidDragPayload(
  dataTransfer: DataTransfer,
): WorkspaceLiquidDragPayload | null {
  const rawPayload =
    dataTransfer.getData(WORKSPACE_LIQUID_DRAG_MIME) || dataTransfer.getData("text/plain");

  if (!rawPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload) as Partial<WorkspaceLiquidDragPayload>;
    const allowedDropTargets = parsed.allowedDropTargets?.filter(isDropTargetType) ?? [];

    if (
      parsed.entityKind === "liquid" &&
      typeof parsed.liquidEntryId === "string" &&
      typeof parsed.liquidType === "string" &&
      typeof parsed.sourceId === "string" &&
      parsed.sourceKind === "grinder" &&
      parsed.widgetId === "grinder" &&
      allowedDropTargets.length > 0
    ) {
      return {
        allowedDropTargets,
        entityKind: "liquid",
        liquidEntryId: parsed.liquidEntryId,
        liquidType: parsed.liquidType,
        sourceId: parsed.sourceId,
        sourceKind: "grinder",
        widgetId: "grinder",
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function readSampleLabelDragPayload(
  dataTransfer: DataTransfer,
): SampleLabelDragPayload | null {
  const rawPayload =
    dataTransfer.getData(SAMPLE_LABEL_DRAG_MIME) || dataTransfer.getData("text/plain");

  if (!rawPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload) as Partial<SampleLabelDragPayload>;
    const allowedDropTargets = parsed.allowedDropTargets?.filter(isDropTargetType) ?? [];

    if (
      parsed.entityKind === "sample_label" &&
      typeof parsed.sampleLabelId === "string" &&
      typeof parsed.sampleLabelText === "string" &&
      (parsed.sourceKind === "workbench" || parsed.sourceKind === "trash") &&
      typeof parsed.sourceId === "string" &&
      allowedDropTargets.length > 0 &&
      ((parsed.sourceKind === "workbench" && typeof parsed.sourceSlotId === "string") ||
        (parsed.sourceKind === "trash" && typeof parsed.trashSampleLabelId === "string"))
    ) {
      const label: BenchLabel = parsed.label as BenchLabel;

      return {
        allowedDropTargets,
        entityKind: "sample_label",
        label,
        sampleLabelId: parsed.sampleLabelId,
        sampleLabelText: parsed.sampleLabelText,
        sourceId: parsed.sourceId,
        sourceKind: parsed.sourceKind,
        ...(parsed.sourceKind === "workbench" ? { sourceSlotId: parsed.sourceSlotId } : {}),
        ...(parsed.sourceKind === "trash"
          ? { trashSampleLabelId: parsed.trashSampleLabelId }
          : {}),
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function toDragDescriptor(
  payload:
    | ToolbarDragPayload
    | BenchToolDragPayload
    | BasketToolDragPayload
    | RackToolDragPayload
    | GrossBalanceToolDragPayload
    | AnalyticalBalanceToolDragPayload
    | VortexToolDragPayload
    | TrashToolDragPayload
    | WorkspaceWidgetDragPayload
    | WorkspaceLiquidDragPayload
    | ProduceDragPayload
    | SampleLabelDragPayload
    | LimsLabelTicketDragPayload,
): DragDescriptor {
  if ("ticketId" in payload) {
    return {
      allowedDropTargets: payload.allowedDropTargets,
      entityKind: "lims_label_ticket",
      ticketId: payload.ticketId,
      sampleCode: payload.sampleCode,
      labelText: payload.labelText,
      sourceId: payload.sourceId,
      sourceKind: payload.sourceKind,
    };
  }

  if ("produceLotId" in payload) {
    return {
      allowedDropTargets: payload.allowedDropTargets,
      ...(payload.sourceKind === "debug_palette" && payload.debugProducePresetId
        ? { debugProducePresetId: payload.debugProducePresetId }
        : {}),
      entityKind: "produce",
      produceLotId: payload.produceLotId,
      produceType: payload.produceType,
      sourceId: payload.sourceId,
      sourceKind: payload.sourceKind,
      ...(payload.sourceSlotId ? { sourceSlotId: payload.sourceSlotId } : {}),
      ...(payload.trashProduceLotId ? { trashProduceLotId: payload.trashProduceLotId } : {}),
    };
  }

  if ("itemType" in payload) {
    if (payload.itemType === "tool") {
      return {
        allowedDropTargets: payload.allowedDropTargets,
        entityKind: "tool",
        sourceId: payload.sourceId,
        sourceKind: payload.sourceKind,
        toolId: payload.itemId,
        toolType: payload.toolType,
      };
    }

    if (payload.itemType === "liquid") {
      return {
        allowedDropTargets: payload.allowedDropTargets,
        entityKind: "liquid",
        liquidId: payload.itemId,
        liquidType: payload.liquidType,
        sourceId: payload.sourceId,
        sourceKind: payload.sourceKind,
      };
    }

    if (payload.itemType === "sample_label") {
      return {
        allowedDropTargets: payload.allowedDropTargets,
        entityKind: "sample_label",
        sampleLabelId: payload.itemId,
        sourceId: payload.sourceId,
        sourceKind: payload.sourceKind,
      };
    }

    return {
      allowedDropTargets: payload.allowedDropTargets,
      entityKind: "workspace_widget",
      sourceId: payload.sourceId,
      sourceKind: payload.sourceKind,
      widgetId: payload.itemId,
      widgetType: payload.widgetType,
    };
  }

  if ("sampleLabelId" in payload) {
      return {
        allowedDropTargets: payload.allowedDropTargets,
        entityKind: "sample_label",
        label: payload.label,
        sampleLabelId: payload.sampleLabelId,
        sampleLabelText: payload.sampleLabelText,
      sourceId: payload.sourceId,
      sourceKind: payload.sourceKind,
      ...(payload.sourceSlotId ? { sourceSlotId: payload.sourceSlotId } : {}),
      ...(payload.trashSampleLabelId
        ? { trashSampleLabelId: payload.trashSampleLabelId }
        : {}),
    };
  }

  if ("liquidEntryId" in payload) {
    return {
      allowedDropTargets: payload.allowedDropTargets,
      entityKind: "liquid",
      liquidEntryId: payload.liquidEntryId,
      liquidId: payload.liquidType,
      liquidType: payload.liquidType,
      sourceId: payload.sourceId,
      sourceKind: payload.sourceKind,
      widgetId: payload.widgetId,
    };
  }

  if ("toolId" in payload && payload.sourceKind === "basket") {
    return {
      allowedDropTargets: payload.allowedDropTargets,
      entityKind: "tool",
      sourceId: payload.sourceId,
      sourceKind: payload.sourceKind,
      toolId: payload.toolId,
      toolType: payload.toolType,
    };
  }

  if ("toolId" in payload && payload.sourceKind === "gross_balance") {
    return {
      allowedDropTargets: payload.allowedDropTargets,
      entityKind: "tool",
      sourceId: payload.sourceId,
      sourceKind: payload.sourceKind,
      toolId: payload.toolId,
      toolType: payload.toolType,
    };
  }

  if ("toolId" in payload && payload.sourceKind === "analytical_balance") {
    return {
      allowedDropTargets: payload.allowedDropTargets,
      entityKind: "tool",
      sourceId: payload.sourceId,
      sourceKind: payload.sourceKind,
      toolId: payload.toolId,
      toolType: payload.toolType,
    };
  }

  if ("toolId" in payload && payload.sourceKind === "vortex") {
    return {
      allowedDropTargets: payload.allowedDropTargets,
      entityKind: "tool",
      sourceId: payload.sourceId,
      sourceKind: payload.sourceKind,
      toolId: payload.toolId,
      toolType: payload.toolType,
    };
  }

  if ("sourceSlotId" in payload || "rackSlotId" in payload || "trashToolId" in payload) {
    return {
      allowedDropTargets: payload.allowedDropTargets,
      entityKind: "tool",
      sourceId: payload.sourceId,
      sourceKind: payload.sourceKind,
      toolId: payload.toolId,
      toolType: payload.toolType,
    };
  }

  return {
    allowedDropTargets: payload.allowedDropTargets,
    entityKind: "workspace_widget",
    sourceId: payload.sourceId,
    sourceKind: payload.sourceKind,
    widgetId: payload.widgetId,
    widgetType: payload.widgetType,
  };
}

export function readDragDescriptor(dataTransfer: DataTransfer): DragDescriptor | null {
  const toolbarPayload = readToolbarDragPayload(dataTransfer);
  if (toolbarPayload) {
    return toDragDescriptor(toolbarPayload);
  }

  const benchToolPayload = readBenchToolDragPayload(dataTransfer);
  if (benchToolPayload) {
    return toDragDescriptor(benchToolPayload);
  }

  const basketToolPayload = readBasketToolDragPayload(dataTransfer);
  if (basketToolPayload) {
    return toDragDescriptor(basketToolPayload);
  }

  const rackToolPayload = readRackToolDragPayload(dataTransfer);
  if (rackToolPayload) {
    return toDragDescriptor(rackToolPayload);
  }

  const grossBalanceToolPayload = readGrossBalanceToolDragPayload(dataTransfer);
  if (grossBalanceToolPayload) {
    return toDragDescriptor(grossBalanceToolPayload);
  }

  const analyticalBalanceToolPayload = readAnalyticalBalanceToolDragPayload(dataTransfer);
  if (analyticalBalanceToolPayload) {
    return toDragDescriptor(analyticalBalanceToolPayload);
  }

  const vortexToolPayload = readVortexToolDragPayload(dataTransfer);
  if (vortexToolPayload) {
    return toDragDescriptor(vortexToolPayload);
  }

  const trashToolPayload = readTrashToolDragPayload(dataTransfer);
  if (trashToolPayload) {
    return toDragDescriptor(trashToolPayload);
  }

  const workspaceWidgetPayload = readWorkspaceWidgetDragPayload(dataTransfer);
  if (workspaceWidgetPayload) {
    return toDragDescriptor(workspaceWidgetPayload);
  }

  const workspaceLiquidPayload = readWorkspaceLiquidDragPayload(dataTransfer);
  if (workspaceLiquidPayload) {
    return toDragDescriptor(workspaceLiquidPayload);
  }

  const producePayload = readProduceDragPayload(dataTransfer);
  if (producePayload) {
    return toDragDescriptor(producePayload);
  }

  const sampleLabelPayload = readSampleLabelDragPayload(dataTransfer);
  if (sampleLabelPayload) {
    return toDragDescriptor(sampleLabelPayload);
  }

  const limsLabelTicketPayload = readLimsLabelTicketDragPayload(dataTransfer);
  if (limsLabelTicketPayload) {
    return toDragDescriptor(limsLabelTicketPayload);
  }

  return null;
}
