import type {
  LimsLabelTicketDragPayload,
  SampleLabelDragPayload,
  ToolbarDragPayload,
} from "@/types/workbench";
import { resolveSampleLabelMoveObjectPayload } from "@/lib/label-dnd-object-command";
import type { MoveObjectPayload } from "@/types/api-payloads";

export type LabelDragPayload =
  | { kind: "palette_sample_label"; payload: ToolbarDragPayload }
  | { kind: "workbench_sample_label"; payload: SampleLabelDragPayload }
  | { kind: "trash_sample_label"; payload: SampleLabelDragPayload }
  | { kind: "lims_label_ticket"; payload: LimsLabelTicketDragPayload };

type LabelDropTarget =
  | { kind: "analytical_balance" }
  | { kind: "gross_balance" }
  | { kind: "trash_bin" }
  | { kind: "workbench_slot"; slotId: string };

export type LabelDropCommand =
  | { kind: "apply_printed_lims_label"; payload: { slot_id: string } }
  | { kind: "apply_printed_lims_label_to_analytical_balance_tool" }
  | { kind: "apply_printed_lims_label_to_gross_balance_bag" }
  | { kind: "apply_sample_label_to_analytical_balance_tool" }
  | { kind: "apply_sample_label_to_gross_balance_tool" }
  | { kind: "apply_sample_label_to_workbench_tool"; payload: { slot_id: string } }
  | { kind: "discard_printed_lims_label" }
  | { kind: "discard_sample_label_from_palette" }
  | { kind: "move_object"; payload: MoveObjectPayload };

export function resolveLabelDropCommand(
  payload: LabelDragPayload,
  target: LabelDropTarget,
): LabelDropCommand | null {
  if (target.kind === "workbench_slot") {
    if (payload.kind === "lims_label_ticket") {
      return {
        kind: "apply_printed_lims_label",
        payload: { slot_id: target.slotId },
      };
    }
    if (payload.kind === "palette_sample_label") {
      return {
        kind: "apply_sample_label_to_workbench_tool",
        payload: { slot_id: target.slotId },
      };
    }
    if (payload.kind === "workbench_sample_label") {
      if (!payload.payload.sourceSlotId || payload.payload.sourceSlotId === target.slotId) {
        return null;
      }
      const movePayload = resolveSampleLabelMoveObjectPayload(payload.payload, {
        kind: "workbench_tool",
        slotId: target.slotId,
      });
      return movePayload === null ? null : { kind: "move_object", payload: movePayload };
    }
    const movePayload = resolveSampleLabelMoveObjectPayload(payload.payload, {
      kind: "workbench_tool",
      slotId: target.slotId,
    });
    return movePayload === null ? null : { kind: "move_object", payload: movePayload };
  }

  if (target.kind === "gross_balance") {
    if (payload.kind === "lims_label_ticket") {
      return { kind: "apply_printed_lims_label_to_gross_balance_bag" };
    }
    if (payload.kind === "palette_sample_label") {
      return { kind: "apply_sample_label_to_gross_balance_tool" };
    }
    if (payload.kind === "workbench_sample_label") {
      if (!payload.payload.sourceSlotId) {
        return null;
      }
      const movePayload = resolveSampleLabelMoveObjectPayload(payload.payload, { kind: "gross_balance" });
      return movePayload === null ? null : { kind: "move_object", payload: movePayload };
    }
    const movePayload = resolveSampleLabelMoveObjectPayload(payload.payload, { kind: "gross_balance" });
    return movePayload === null ? null : { kind: "move_object", payload: movePayload };
  }

  if (target.kind === "analytical_balance") {
    if (payload.kind === "lims_label_ticket") {
      return { kind: "apply_printed_lims_label_to_analytical_balance_tool" };
    }
    if (payload.kind === "palette_sample_label") {
      return { kind: "apply_sample_label_to_analytical_balance_tool" };
    }
    if (payload.kind === "workbench_sample_label") {
      if (!payload.payload.sourceSlotId) {
        return null;
      }
      const movePayload = resolveSampleLabelMoveObjectPayload(payload.payload, { kind: "analytical_balance" });
      return movePayload === null ? null : { kind: "move_object", payload: movePayload };
    }
    const movePayload = resolveSampleLabelMoveObjectPayload(payload.payload, { kind: "analytical_balance" });
    return movePayload === null ? null : { kind: "move_object", payload: movePayload };
  }

  if (payload.kind === "lims_label_ticket") {
    return { kind: "discard_printed_lims_label" };
  }
  if (payload.kind === "palette_sample_label") {
    return { kind: "discard_sample_label_from_palette" };
  }
  if (payload.kind === "workbench_sample_label" && payload.payload.sourceSlotId) {
    const movePayload = resolveSampleLabelMoveObjectPayload(payload.payload, { kind: "trash_bin" });
    return movePayload === null ? null : { kind: "move_object", payload: movePayload };
  }

  return null;
}
