import type { DropTargetType, LiquidType, ToolType } from "@/types/workbench";

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
