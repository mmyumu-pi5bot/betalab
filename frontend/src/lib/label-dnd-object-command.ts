import type { MoveObjectPayload } from "@/types/api-payloads";
import type { SampleLabelDragPayload } from "@/types/workbench";

export type LabelMoveDestination =
  | { kind: "analytical_balance" }
  | { kind: "gross_balance" }
  | { kind: "trash_bin" }
  | { kind: "workbench_tool"; slotId: string };

function resolveSampleLabelSource(payload: SampleLabelDragPayload): MoveObjectPayload["source"] | null {
  if (payload.sourceKind === "workbench" && payload.sourceSlotId) {
    return { kind: "workbench", id: payload.sourceSlotId };
  }
  if (payload.sourceKind === "trash" && payload.trashSampleLabelId) {
    return { kind: "trash", id: payload.trashSampleLabelId };
  }
  return null;
}

function resolveSampleLabelDestination(destination: LabelMoveDestination): MoveObjectPayload["destination"] {
  if (destination.kind === "workbench_tool") {
    return { kind: "workbench_tool", id: destination.slotId };
  }
  if (destination.kind === "gross_balance") {
    return { kind: "gross_balance", id: "gross_balance" };
  }
  if (destination.kind === "analytical_balance") {
    return { kind: "analytical_balance", id: "analytical_balance" };
  }
  return { kind: "trash_bin", id: "trash_bin" };
}

export function resolveSampleLabelMoveObjectPayload(
  payload: SampleLabelDragPayload,
  destination: LabelMoveDestination,
): MoveObjectPayload | null {
  const source = resolveSampleLabelSource(payload);
  if (source === null) {
    return null;
  }
  return {
    destination: resolveSampleLabelDestination(destination),
    entity: { kind: "sample_label", id: payload.sampleLabelId },
    source,
  };
}
