import type { Containment, ToolType } from "@/types/workbench";

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
