import type {
  ExperimentWorkspaceWidget,
  LiquidType,
  DropTargetType,
  ExperimentWorkspaceWidgetId,
  ToolType,
} from "@/types/workbench";

export function getToolDropTargets(toolType: ToolType): DropTargetType[] {
  const targets: DropTargetType[] = ["workbench_slot", "trash_bin", "gross_balance_widget"];

  if (toolType === "sample_vial") {
    targets.splice(1, 0, "rack_slot");
  }
  if (toolType !== "cutting_board" && toolType !== "sample_bag") {
    targets.push("analytical_balance_widget");
  }
  if (toolType === "centrifuge_tube" || toolType === "cleanup_tube") {
    targets.push("vortex_widget");
  }

  return targets;
}

export function canToolAcceptLiquids(toolType: ToolType): boolean {
  return toolType !== "sample_bag" && toolType !== "cutting_board" && toolType !== "storage_jar";
}

export function canToolAcceptProduce(toolType: ToolType): boolean {
  return toolType === "sample_bag" || toolType === "cutting_board" || toolType === "storage_jar";
}

export function canToolBeSealed(toolType: ToolType): boolean {
  return (
    toolType === "sample_bag" ||
    toolType === "storage_jar" ||
    toolType === "centrifuge_tube" ||
    toolType === "cleanup_tube" ||
    toolType === "sample_vial"
  );
}

export function canToolReceiveContents(toolType: ToolType, isSealed = false): boolean {
  return !canToolBeSealed(toolType) || !isSealed;
}

export function getProduceLotDropTargets(): DropTargetType[] {
  return ["workbench_slot", "grinder_widget", "trash_bin", "gross_balance_widget"];
}

export function getSampleLabelDropTargets(): DropTargetType[] {
  return ["workbench_slot", "gross_balance_widget", "analytical_balance_widget", "trash_bin"];
}

export function getLimsLabelTicketDropTargets(): DropTargetType[] {
  return getSampleLabelDropTargets();
}

export function getLiquidDropTargets(liquidType: LiquidType): DropTargetType[] {
  if (liquidType === "dry_ice_pellets") {
    return ["grinder_widget"];
  }

  return ["workbench_slot", "analytical_balance_widget"];
}

export function canWorkspaceWidgetBeStored(widgetId: ExperimentWorkspaceWidgetId): boolean {
  return (
      widgetId === "lims" ||
      widgetId === "rack" ||
      widgetId === "instrument" ||
      widgetId === "grinder" ||
      widgetId === "gross_balance" ||
      widgetId === "analytical_balance" ||
      widgetId === "vortex"
  );
}

function isWorkspaceWidgetEmpty(
  widget: Pick<ExperimentWorkspaceWidget, "tool" | "produceLots" | "liquids">,
): boolean {
  return widget.tool == null && (widget.produceLots?.length ?? 0) === 0 && (widget.liquids?.length ?? 0) === 0;
}

export function canStoreWorkspaceWidget(
  widget: Pick<ExperimentWorkspaceWidget, "id" | "tool" | "produceLots" | "liquids">,
): boolean {
  return canWorkspaceWidgetBeStored(widget.id) && isWorkspaceWidgetEmpty(widget);
}

export function getTrashedWorkspaceWidgetDropTargets(): DropTargetType[] {
  return ["workspace_canvas"];
}
