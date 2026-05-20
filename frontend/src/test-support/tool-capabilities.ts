import type { Containment, ToolType } from "@/types/workbench";

import toolSpecs from "./backend-tool-specs.json";

type ToolSpec = {
  can_receive_liquids: boolean;
  can_receive_produce: boolean;
  can_seal: boolean;
};

const specs = toolSpecs as Record<string, ToolSpec>;

function requireToolSpec(toolType: ToolType): ToolSpec {
  const spec = specs[toolType];
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

const liquidToolContainment: Containment = {
  accepts: [{ entityKind: "liquid" }, { entityKind: "sample_label" }, { entityKind: "lims_label_ticket" }],
  blockedReason: null,
  canReceive: true,
  capacity: 3,
  children: [],
  remainingCapacity: 3,
};

const produceToolContainment: Containment = {
  accepts: [{ entityKind: "produce" }, { entityKind: "sample_label" }, { entityKind: "lims_label_ticket" }],
  blockedReason: null,
  canReceive: true,
  capacity: 3,
  children: [],
  remainingCapacity: 3,
};

const labelOnlyToolContainment: Containment = {
  accepts: [{ entityKind: "sample_label" }, { entityKind: "lims_label_ticket" }],
  blockedReason: null,
  canReceive: true,
  capacity: 2,
  children: [],
  remainingCapacity: 2,
};

const openEmptyToolContainmentByType: Record<ToolType, Containment> = {
  beaker: liquidToolContainment,
  centrifuge_tube: liquidToolContainment,
  cleanup_tube: liquidToolContainment,
  cutting_board: produceToolContainment,
  sample_bag: produceToolContainment,
  sample_vial: liquidToolContainment,
  storage_jar: produceToolContainment,
};

export function getOpenEmptyToolContainment(toolType: ToolType): Containment {
  const containment = openEmptyToolContainmentByType[toolType] ?? labelOnlyToolContainment;
  return {
    ...containment,
    accepts: containment.accepts.map((rule) => ({ ...rule })),
    children: containment.children.map((child) => ({ ...child })),
  };
}
