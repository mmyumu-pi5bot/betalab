import type { Containment, ContainmentRule, DragDescriptor } from "@/types/workbench";

export function containmentAcceptsDescriptor(
  containment: Containment | null | undefined,
  descriptor: DragDescriptor | null,
) {
  if (containment === null || containment === undefined || descriptor === null) {
    return false;
  }
  if (!containment.canReceive) {
    return false;
  }
  return containment.accepts.some((rule) => containmentRuleMatchesDescriptor(rule, descriptor));
}

function containmentRuleMatchesDescriptor(rule: ContainmentRule, descriptor: DragDescriptor) {
  if (rule.entityKind !== descriptor.entityKind) {
    return false;
  }
  if ("toolType" in descriptor && rule.toolType !== undefined && rule.toolType !== null) {
    return rule.toolType === descriptor.toolType;
  }
  if ("liquidType" in descriptor && rule.liquidType !== undefined && rule.liquidType !== null) {
    return rule.liquidType === descriptor.liquidType;
  }
  return true;
}
