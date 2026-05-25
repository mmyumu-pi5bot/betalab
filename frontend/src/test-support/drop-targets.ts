import type { DropTargetType, LiquidType, ToolType } from "@/types/workbench";

import toolSpecs from "@/generated/dnd-contract.json";

type ToolSpec = {
  allowed_drop_targets: DropTargetType[];
  is_discardable: boolean;
  is_storable: boolean;
};

type EntitySpec = {
  allowed_drop_targets: DropTargetType[];
};

type DndContract = {
  entities: Record<string, EntitySpec>;
  liquids: Record<string, EntitySpec>;
  tools: Record<string, ToolSpec>;
};

const contract = toolSpecs as DndContract;

function requireToolSpec(toolType: ToolType): ToolSpec {
  const spec = contract.tools[toolType];
  if (!spec) {
    throw new Error(`Missing backend tool spec for ${toolType}`);
  }
  return spec;
}

function requireEntitySpec(entityKind: string): EntitySpec {
  const spec = contract.entities[entityKind];
  if (!spec) {
    throw new Error(`Missing backend DnD entity spec for ${entityKind}`);
  }
  return spec;
}

function requireLiquidSpec(liquidType: LiquidType): EntitySpec {
  const spec = contract.liquids[liquidType];
  if (!spec) {
    throw new Error(`Missing backend liquid spec for ${liquidType}`);
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
  return requireEntitySpec("produce_lot").allowed_drop_targets;
}

export function getSampleLabelDropTargets(): DropTargetType[] {
  return requireEntitySpec("sample_label").allowed_drop_targets;
}

export function getLimsLabelTicketDropTargets(): DropTargetType[] {
  return requireEntitySpec("lims_label_ticket").allowed_drop_targets;
}

export function getLiquidDropTargets(liquidType: LiquidType): DropTargetType[] {
  return requireLiquidSpec(liquidType).allowed_drop_targets;
}
