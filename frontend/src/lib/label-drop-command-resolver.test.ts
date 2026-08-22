import { describe, expect, it } from "vitest";

import { resolveLabelDropCommand, type LabelDragPayload } from "@/lib/label-drop-command-resolver";
import type { BenchLabel, LimsLabelTicketDragPayload, SampleLabelDragPayload, ToolbarDragPayload } from "@/types/workbench";

const sampleLabel: BenchLabel = {
  id: "bench_tool_1-sample-label",
  labelKind: "manual",
  text: "LOT-2026-041",
  receivedDate: null,
  sampleCode: null,
  isDraggable: true,
  allowedDropTargets: ["workbench_slot", "gross_balance_widget", "analytical_balance_widget", "trash_bin"],
};

function createPaletteLabelPayload(): LabelDragPayload {
  return {
    kind: "palette_sample_label",
    payload: {
      allowedDropTargets: ["workbench_slot", "gross_balance_widget", "analytical_balance_widget", "trash_bin"],
      entityKind: "sample_label",
      itemId: "sampling_bag_label",
      itemType: "sample_label",
      sourceId: "sampling_bag_label",
      sourceKind: "palette",
    } as ToolbarDragPayload,
  };
}

function createWorkbenchLabelPayload(
  overrides: Partial<SampleLabelDragPayload> = {},
): LabelDragPayload {
  return {
    kind: "workbench_sample_label",
    payload: {
      allowedDropTargets: ["workbench_slot", "gross_balance_widget", "analytical_balance_widget", "trash_bin"],
      entityKind: "sample_label",
      label: sampleLabel,
      sampleLabelId: sampleLabel.id,
      sampleLabelText: sampleLabel.text,
      sourceId: "station_1",
      sourceKind: "workbench",
      sourceSlotId: "station_1",
      ...overrides,
    },
  };
}

function createTrashLabelPayload(
  overrides: Partial<SampleLabelDragPayload> = {},
): LabelDragPayload {
  return {
    kind: "trash_sample_label",
    payload: {
      allowedDropTargets: ["workbench_slot", "gross_balance_widget", "analytical_balance_widget"],
      entityKind: "sample_label",
      label: sampleLabel,
      sampleLabelId: sampleLabel.id,
      sampleLabelText: sampleLabel.text,
      sourceId: "trash_sample_label_1",
      sourceKind: "trash",
      trashSampleLabelId: "trash_sample_label_1",
      ...overrides,
    },
  };
}

function createLimsTicketPayload(): LabelDragPayload {
  return {
    kind: "lims_label_ticket",
    payload: {
      allowedDropTargets: ["workbench_slot", "gross_balance_widget", "analytical_balance_widget", "trash_bin"],
      entityKind: "lims_label_ticket",
      sourceId: "ticket_1",
      sourceKind: "lims",
      ticketId: "ticket_1",
      sampleCode: "APP-0001-01",
      labelText: "APP-0001-01",
    } as LimsLabelTicketDragPayload,
  };
}

describe("resolveLabelDropCommand", () => {
  it("routes workbench label drops and rejects same-slot moves", () => {
    expect(resolveLabelDropCommand(createPaletteLabelPayload(), { kind: "workbench_slot", slotId: "station_2" })).toEqual({
      kind: "apply_sample_label_to_workbench_tool",
      payload: { slot_id: "station_2" },
    });
    expect(resolveLabelDropCommand(createLimsTicketPayload(), { kind: "workbench_slot", slotId: "station_2" })).toEqual({
      kind: "apply_printed_lims_label",
      payload: { slot_id: "station_2" },
    });
    expect(resolveLabelDropCommand(createWorkbenchLabelPayload(), { kind: "workbench_slot", slotId: "station_1" })).toBeNull();
    expect(resolveLabelDropCommand(createWorkbenchLabelPayload(), { kind: "workbench_slot", slotId: "station_2" })).toEqual({
      kind: "move_object",
      payload: {
        destination: { kind: "workbench_tool", id: "station_2" },
        entity: { kind: "sample_label", id: "bench_tool_1-sample-label" },
        source: { kind: "workbench", id: "station_1" },
      },
    });
    expect(resolveLabelDropCommand(createTrashLabelPayload(), { kind: "workbench_slot", slotId: "station_2" })).toEqual({
      kind: "move_object",
      payload: {
        destination: { kind: "workbench_tool", id: "station_2" },
        entity: { kind: "sample_label", id: "bench_tool_1-sample-label" },
        source: { kind: "trash", id: "trash_sample_label_1" },
      },
    });
  });

  it("routes label drops to gross and analytical balances", () => {
    expect(resolveLabelDropCommand(createPaletteLabelPayload(), { kind: "gross_balance" })).toEqual({
      kind: "apply_sample_label_to_gross_balance_tool",
    });
    expect(resolveLabelDropCommand(createWorkbenchLabelPayload(), { kind: "gross_balance" })).toEqual({
      kind: "move_object",
      payload: {
        destination: { kind: "gross_balance", id: "gross_balance" },
        entity: { kind: "sample_label", id: "bench_tool_1-sample-label" },
        source: { kind: "workbench", id: "station_1" },
      },
    });
    expect(resolveLabelDropCommand(createTrashLabelPayload(), { kind: "gross_balance" })).toEqual({
      kind: "move_object",
      payload: {
        destination: { kind: "gross_balance", id: "gross_balance" },
        entity: { kind: "sample_label", id: "bench_tool_1-sample-label" },
        source: { kind: "trash", id: "trash_sample_label_1" },
      },
    });
    expect(resolveLabelDropCommand(createLimsTicketPayload(), { kind: "gross_balance" })).toEqual({
      kind: "apply_printed_lims_label_to_gross_balance_bag",
    });

    expect(resolveLabelDropCommand(createPaletteLabelPayload(), { kind: "analytical_balance" })).toEqual({
      kind: "apply_sample_label_to_analytical_balance_tool",
    });
    expect(resolveLabelDropCommand(createWorkbenchLabelPayload(), { kind: "analytical_balance" })).toEqual({
      kind: "move_object",
      payload: {
        destination: { kind: "analytical_balance", id: "analytical_balance" },
        entity: { kind: "sample_label", id: "bench_tool_1-sample-label" },
        source: { kind: "workbench", id: "station_1" },
      },
    });
    expect(resolveLabelDropCommand(createTrashLabelPayload(), { kind: "analytical_balance" })).toEqual({
      kind: "move_object",
      payload: {
        destination: { kind: "analytical_balance", id: "analytical_balance" },
        entity: { kind: "sample_label", id: "bench_tool_1-sample-label" },
        source: { kind: "trash", id: "trash_sample_label_1" },
      },
    });
    expect(resolveLabelDropCommand(createLimsTicketPayload(), { kind: "analytical_balance" })).toEqual({
      kind: "apply_printed_lims_label_to_analytical_balance_tool",
    });
  });

  it("routes trash label drops and rejects trash-to-trash sample label restores", () => {
    expect(resolveLabelDropCommand(createPaletteLabelPayload(), { kind: "trash_bin" })).toEqual({
      kind: "discard_sample_label_from_palette",
    });
    expect(resolveLabelDropCommand(createWorkbenchLabelPayload(), { kind: "trash_bin" })).toEqual({
      kind: "move_object",
      payload: {
        destination: { kind: "trash_bin", id: "trash_bin" },
        entity: { kind: "sample_label", id: "bench_tool_1-sample-label" },
        source: { kind: "workbench", id: "station_1" },
      },
    });
    expect(resolveLabelDropCommand(createLimsTicketPayload(), { kind: "trash_bin" })).toEqual({
      kind: "discard_printed_lims_label",
    });
    expect(resolveLabelDropCommand(createTrashLabelPayload(), { kind: "trash_bin" })).toBeNull();
  });
});
