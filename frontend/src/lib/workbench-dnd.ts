import type {
  AnalyticalBalanceToolDragPayload,
  BenchLabel,
  BasketToolDragPayload,
  BenchToolDragPayload,
  CentrifugeToolDragPayload,
  IceBathToolDragPayload,
  DragDescriptor,
  DropTargetType,
  GrossBalanceToolDragPayload,
  LimsLabelTicketDragPayload,
  ProduceDragPayload,
  RackDragPayload,
  RackToolDragPayload,
  SampleLabelDragPayload,
  TrashToolDragPayload,
  ToolbarDragPayload,
  ToolbarItem,
  ToolType,
  VortexToolDragPayload,
  WorkspaceLiquidDragPayload,
  WorkspaceWidgetDragPayload,
} from "@/types/workbench";

export type EquipmentToolDragPayload =
  | BenchToolDragPayload
  | BasketToolDragPayload
  | RackToolDragPayload
  | GrossBalanceToolDragPayload
  | AnalyticalBalanceToolDragPayload
  | CentrifugeToolDragPayload
  | IceBathToolDragPayload
  | VortexToolDragPayload
  | TrashToolDragPayload;

const WORKBENCH_DRAG_MIME = "application/x-betalab-workbench-item";
const EQUIPMENT_TOOL_DRAG_MIME = "application/x-betalab-tool-item";
const WORKSPACE_WIDGET_DRAG_MIME = "application/x-betalab-workspace-widget-item";
const RACK_DRAG_MIME = "application/x-betalab-rack";
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
    targetType === "analytical_balance_widget" ||
    targetType === "vortex_widget" ||
    targetType === "centrifuge_widget" ||
    targetType === "ice_bath_widget" ||
    targetType === "lcmsms_instrument"
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
      entityId: item.id,
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

export function writeEquipmentToolDragPayload(
  dataTransfer: DataTransfer,
  payload: EquipmentToolDragPayload,
) {
  const serialized = JSON.stringify(payload);
  dataTransfer.setData(EQUIPMENT_TOOL_DRAG_MIME, serialized);
  dataTransfer.setData("text/plain", serialized);
  payload.allowedDropTargets.forEach((targetType) => {
    dataTransfer.setData(getDropTargetMime(targetType), payload.sourceId);
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

export function writeRackDragPayload(dataTransfer: DataTransfer, payload: RackDragPayload) {
  const serialized = JSON.stringify(payload);

  dataTransfer.setData(RACK_DRAG_MIME, serialized);
  dataTransfer.setData("text/plain", serialized);
  payload.allowedDropTargets.forEach((targetType) => {
    dataTransfer.setData(getDropTargetMime(targetType), payload.rackId);
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
        entityId: typeof parsed.entityId === "string" ? parsed.entityId : parsed.itemId,
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


export function readEquipmentToolDragPayload(
  dataTransfer: DataTransfer,
): EquipmentToolDragPayload | null {
  const rawPayload =
    dataTransfer.getData(EQUIPMENT_TOOL_DRAG_MIME) || dataTransfer.getData("text/plain");

  if (!rawPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload) as {
      entityKind?: unknown;
      entityId?: unknown;
      sourceKind?: unknown;
      sourceId?: unknown;
      toolId?: unknown;
      toolType?: unknown;
      allowedDropTargets?: unknown[];
      sourceSlotId?: unknown;
      rackSlotId?: unknown;
      trashToolId?: unknown;
    };

    if (
      parsed.entityKind !== "tool" ||
      typeof parsed.entityId !== "string" ||
      typeof parsed.sourceId !== "string" ||
      typeof parsed.toolId !== "string" ||
      typeof parsed.toolType !== "string"
    ) {
      return null;
    }

    const allowedDropTargets = parsed.allowedDropTargets?.filter(isDropTargetType) ?? [];
    const base = {
      allowedDropTargets,
      entityId: parsed.entityId,
      entityKind: "tool" as const,
      sourceId: parsed.sourceId,
      toolId: parsed.toolId,
      toolType: parsed.toolType as ToolType,
    };

    switch (parsed.sourceKind) {
      case "workbench":
        if (typeof parsed.sourceSlotId !== "string") return null;
        return { ...base, sourceKind: "workbench", sourceSlotId: parsed.sourceSlotId };
      case "basket":
        return { ...base, sourceKind: "basket" };
      case "rack":
        if (typeof parsed.rackSlotId !== "string") return null;
        return { ...base, sourceKind: "rack", rackSlotId: parsed.rackSlotId };
      case "gross_balance":
        return { ...base, sourceKind: "gross_balance" };
      case "analytical_balance":
        return { ...base, sourceKind: "analytical_balance" };
      case "vortex":
        return { ...base, sourceKind: "vortex" };
      case "centrifuge":
        return { ...base, sourceKind: "centrifuge" };
      case "ice_bath":
        return { ...base, sourceKind: "ice_bath" };
      case "trash":
        if (typeof parsed.trashToolId !== "string") return null;
        return { ...base, sourceKind: "trash", trashToolId: parsed.trashToolId };
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export function writeBenchToolDragPayload(dataTransfer: DataTransfer, payload: BenchToolDragPayload) {
  writeEquipmentToolDragPayload(dataTransfer, payload);
}

export function readBenchToolDragPayload(dataTransfer: DataTransfer): BenchToolDragPayload | null {
  const payload = readEquipmentToolDragPayload(dataTransfer);
  return payload?.sourceKind === "workbench" ? payload : null;
}

export function writeRackToolDragPayload(dataTransfer: DataTransfer, payload: RackToolDragPayload) {
  writeEquipmentToolDragPayload(dataTransfer, payload);
}

export function readRackToolDragPayload(dataTransfer: DataTransfer): RackToolDragPayload | null {
  const payload = readEquipmentToolDragPayload(dataTransfer);
  return payload?.sourceKind === "rack" ? payload : null;
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

export function readRackDragPayload(dataTransfer: DataTransfer): RackDragPayload | null {
  const rawPayload =
    dataTransfer.getData(RACK_DRAG_MIME) || dataTransfer.getData("text/plain");

  if (!rawPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload) as Partial<RackDragPayload>;
    const allowedDropTargets = parsed.allowedDropTargets?.filter(isDropTargetType) ?? [];
    if (
      parsed.entityKind === "rack" &&
      parsed.rackId === "autosampler_rack" &&
      parsed.sourceKind === "rack" &&
      parsed.sourceId === "autosampler_rack" &&
      allowedDropTargets.includes("lcmsms_instrument")
    ) {
      return {
        allowedDropTargets,
        entityKind: "rack",
        rackId: "autosampler_rack",
        sourceId: "autosampler_rack",
        sourceKind: "rack",
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
    | EquipmentToolDragPayload
    | WorkspaceWidgetDragPayload
    | RackDragPayload
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
        entityId: payload.itemId,
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

  if ("rackId" in payload) {
    return {
      allowedDropTargets: payload.allowedDropTargets,
      entityKind: "rack",
      rackId: payload.rackId,
      sourceId: payload.sourceId,
      sourceKind: payload.sourceKind,
    };
  }

  if ("toolId" in payload) {
    const p = payload as EquipmentToolDragPayload;
    return {
      allowedDropTargets: p.allowedDropTargets,
      entityId: p.entityId,
      entityKind: "tool",
      sourceId: p.sourceId,
      sourceKind: p.sourceKind,
      toolId: p.toolId,
      toolType: p.toolType,
    };
  }

  const p = payload as WorkspaceWidgetDragPayload;
  return {
    allowedDropTargets: p.allowedDropTargets,
    entityKind: "workspace_widget",
    sourceId: p.sourceId,
    sourceKind: p.sourceKind,
    widgetId: p.widgetId,
    widgetType: p.widgetType,
  };
}

export function readDragDescriptor(dataTransfer: DataTransfer): DragDescriptor | null {
  const toolbarPayload = readToolbarDragPayload(dataTransfer);
  if (toolbarPayload) {
    return toDragDescriptor(toolbarPayload);
  }

  const equipmentToolPayload = readEquipmentToolDragPayload(dataTransfer);
  if (equipmentToolPayload) {
    return toDragDescriptor(equipmentToolPayload);
  }

  const workspaceWidgetPayload = readWorkspaceWidgetDragPayload(dataTransfer);
  if (workspaceWidgetPayload) {
    return toDragDescriptor(workspaceWidgetPayload);
  }

  const rackPayload = readRackDragPayload(dataTransfer);
  if (rackPayload) {
    return toDragDescriptor(rackPayload);
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
