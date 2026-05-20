import type { DropTargetType, LiquidType, ToolType } from "@/types/workbench";

import toolSpecs from "./backend-tool-specs.json";

type ToolSpec = {
  allowed_drop_targets: DropTargetType[];
  is_discardable: boolean;
  is_storable: boolean;
};

const specs = toolSpecs as Record<string, ToolSpec>;

function requireToolSpec(toolType: ToolType): ToolSpec {
  const spec = specs[toolType];
  if (!spec) {
    throw new Error(`Missing backend tool spec for ${toolType}`);
  }
  return spec;
}

export function getToolDropTargets(toolType: ToolType): DropTargetType[] {
  return requireToolSpec(toolType).allowed_drop_targets;
}

export function isToolDiscardable(toolType: ToolType): boolean {
  return requireToolSpec(toolType).is_discardable;
}

export function isToolStorable(toolType: ToolType): boolean {
  return requireToolSpec(toolType).is_storable;
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
