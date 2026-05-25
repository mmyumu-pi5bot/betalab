import type { Containment, ToolType } from "@/types/workbench";

import toolSpecs from "@/generated/dnd-contract.json";

type ToolSpec = {
  can_receive_liquids: boolean;
  can_receive_produce: boolean;
  can_seal: boolean;
};

type DndContract = {
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

export function canToolAcceptLiquids(toolType: ToolType): boolean {
  return requireToolSpec(toolType).can_receive_liquids;
}

export function canToolAcceptProduce(toolType: ToolType): boolean {
  return requireToolSpec(toolType).can_receive_produce;
}

export function canToolBeSealed(toolType: ToolType): boolean {
  return requireToolSpec(toolType).can_seal;
}

export function canToolReceiveContents(toolType: ToolType, isSealed = false): boolean {
  return !canToolBeSealed(toolType) || !isSealed;
}

const labelOnlyAccepts = [
  { entityKind: "sample_label" as const },
  { entityKind: "lims_label_ticket" as const },
];

function buildOpenEmptyContainment(toolType: ToolType): Containment {
  const spec = requireToolSpec(toolType);
  const accepts: Containment["accepts"] = [];
  if (spec.can_receive_liquids) accepts.push({ entityKind: "liquid" });
  if (spec.can_receive_produce) accepts.push({ entityKind: "produce" });
  accepts.push(...labelOnlyAccepts);
  return {
    accepts,
    blockedReason: null,
    canReceive: true,
    capacity: accepts.length,
    children: [],
    remainingCapacity: accepts.length,
  };
}

export function getOpenEmptyToolContainment(toolType: ToolType): Containment {
  return buildOpenEmptyContainment(toolType);
}
