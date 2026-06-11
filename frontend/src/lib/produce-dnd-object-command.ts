import type { MoveObjectPayload } from "@/types/api-payloads";
import type { ProduceDragPayload } from "@/types/workbench";

type ProduceMoveDestination =
  | { kind: "gross_balance" }
  | { kind: "trash_bin" }
  | { kind: "workbench_tool"; slotId: string }
  | { kind: "workspace_widget"; widgetId: "grinder" };

function resolveProduceSource(payload: ProduceDragPayload): MoveObjectPayload["source"] | null {
  if (payload.sourceKind === "debug_palette") {
    return null;
  }
  if (payload.sourceKind === "workbench") {
    if (!payload.sourceSlotId) {
      return null;
    }
    return { kind: "workbench", id: payload.sourceSlotId };
  }
  if (payload.sourceKind === "trash") {
    if (!payload.trashProduceLotId) {
      return null;
    }
    return { kind: "trash", id: payload.trashProduceLotId };
  }
  if (payload.sourceKind === "grinder") {
    return { kind: "grinder", id: "grinder" };
  }
  if (payload.sourceKind === "gross_balance") {
    return { kind: "gross_balance", id: "gross_balance" };
  }
  if (payload.sourceKind === "basket") {
    return { kind: "basket", id: "produce_basket" };
  }
  return null;
}

function resolveProduceDestination(
  destination: ProduceMoveDestination,
): MoveObjectPayload["destination"] {
  if (destination.kind === "workbench_tool") {
    return { kind: "workbench_tool", id: destination.slotId };
  }
  if (destination.kind === "workspace_widget") {
    return { kind: "workspace_widget", id: destination.widgetId };
  }
  return { kind: destination.kind, id: destination.kind };
}

export function resolveProduceMoveObjectPayload(
  payload: ProduceDragPayload,
  destination: ProduceMoveDestination,
): MoveObjectPayload | null {
  const source = resolveProduceSource(payload);
  if (source === null) {
    return null;
  }

  const resolvedDestination = resolveProduceDestination(destination);
  if (source.kind === resolvedDestination.kind && source.id === resolvedDestination.id) {
    return null;
  }
  if (source.kind === "grinder" && resolvedDestination.kind === "workspace_widget" && source.id === resolvedDestination.id) {
    return null;
  }
  if (source.kind === "trash" && resolvedDestination.kind === "trash_bin") {
    return null;
  }

  return {
    entity: { kind: "produce_lot", id: payload.produceLotId },
    source,
    destination: resolvedDestination,
  };
}
