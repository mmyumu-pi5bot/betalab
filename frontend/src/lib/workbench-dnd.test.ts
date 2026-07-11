import { describe, expect, it } from "vitest";

import {
  hasCompatibleDropTarget,
  readBenchToolDragPayload,
  readProduceDragPayload,
  readRackToolDragPayload,
  readSampleLabelDragPayload,
  readToolbarDragPayload,
  readWorkspaceLiquidDragPayload,
  writeBenchToolDragPayload,
  writeProduceDragPayload,
  writeRackToolDragPayload,
  writeSampleLabelDragPayload,
  writeToolbarDragPayload,
  writeWorkspaceLiquidDragPayload,
} from "@/lib/workbench-dnd";
import type { ToolbarDragPayload } from "@/types/workbench";

type MockDataTransfer = DataTransfer & {
  data: Map<string, string>;
};

function createDataTransfer(): MockDataTransfer {
  const data = new Map<string, string>();

  return {
    data,
    dropEffect: "copy",
    effectAllowed: "copy",
    files: [] as unknown as FileList,
    items: [] as unknown as DataTransferItemList,
    types: [],
    clearData: (format?: string) => {
      if (format) {
        data.delete(format);
      } else {
        data.clear();
      }
    },
    getData: (format: string) => data.get(format) ?? "",
    setData: (format: string, value: string) => {
      data.set(format, value);
    },
    setDragImage: () => {},
  } as MockDataTransfer;
}

function syncTypes(dataTransfer: MockDataTransfer) {
  Object.defineProperty(dataTransfer, "types", {
    configurable: true,
    value: Array.from(dataTransfer.data.keys()),
  });
}

function writePayload(dataTransfer: MockDataTransfer, payload: ToolbarDragPayload) {
  writeToolbarDragPayload(dataTransfer, payload);
  syncTypes(dataTransfer);
}

describe("workbench dnd helpers", () => {
  it("marks toolbar autosampler vials as compatible with both stations and rack slots", () => {
    const dataTransfer = createDataTransfer();

    writePayload(dataTransfer, {
      allowedDropTargets: ["workbench_slot", "rack_slot"],
      entityId: "sample_vial_lcms",
      entityKind: "tool",
      itemId: "sample_vial_lcms",
      itemType: "tool",
      sourceId: "sample_vial_lcms",
      sourceKind: "palette",
      toolType: "sample_vial",
    });

    expect(hasCompatibleDropTarget(dataTransfer, "workbench_slot")).toBe(true);
    expect(hasCompatibleDropTarget(dataTransfer, "rack_slot")).toBe(true);
    expect(readToolbarDragPayload(dataTransfer)).toEqual({
      allowedDropTargets: ["workbench_slot", "rack_slot"],
      entityId: "sample_vial_lcms",
      entityKind: "tool",
      itemId: "sample_vial_lcms",
      itemType: "tool",
      sourceId: "sample_vial_lcms",
      sourceKind: "palette",
      toolType: "sample_vial",
    });
  });

  it("marks workspace widget drags as workspace-only drops", () => {
    const dataTransfer = createDataTransfer();

    writePayload(dataTransfer, {
      allowedDropTargets: ["workspace_canvas"],
      entityKind: "workspace_widget",
      itemId: "autosampler_rack_widget",
      itemType: "workspace_widget",
      sourceId: "autosampler_rack_widget",
      sourceKind: "palette",
      widgetType: "autosampler_rack",
    });

    expect(hasCompatibleDropTarget(dataTransfer, "workbench_slot")).toBe(false);
    expect(hasCompatibleDropTarget(dataTransfer, "workspace_canvas")).toBe(true);
    expect(readToolbarDragPayload(dataTransfer)).toEqual({
      allowedDropTargets: ["workspace_canvas"],
      entityKind: "workspace_widget",
      itemId: "autosampler_rack_widget",
      itemType: "workspace_widget",
      sourceId: "autosampler_rack_widget",
      sourceKind: "palette",
      widgetType: "autosampler_rack",
    });
  });

  it("marks palette sampling label drags as workbench-and-trash drops", () => {
    const dataTransfer = createDataTransfer();

    writePayload(dataTransfer, {
      allowedDropTargets: ["workbench_slot", "trash_bin"],
      entityKind: "sample_label",
      itemId: "sampling_bag_label",
      itemType: "sample_label",
      sourceId: "sampling_bag_label",
      sourceKind: "palette",
    });

    expect(hasCompatibleDropTarget(dataTransfer, "workbench_slot")).toBe(true);
    expect(hasCompatibleDropTarget(dataTransfer, "trash_bin")).toBe(true);
    expect(hasCompatibleDropTarget(dataTransfer, "rack_slot")).toBe(false);
    expect(readToolbarDragPayload(dataTransfer)).toEqual({
      allowedDropTargets: ["workbench_slot", "trash_bin"],
      entityKind: "sample_label",
      itemId: "sampling_bag_label",
      itemType: "sample_label",
      sourceId: "sampling_bag_label",
      sourceKind: "palette",
    });
  });

  it("reads workbench sample label drags as workbench-and-trash compatible", () => {
    const dataTransfer = createDataTransfer();

    writeSampleLabelDragPayload(dataTransfer, {
      allowedDropTargets: ["workbench_slot", "trash_bin"],
      entityKind: "sample_label",
      label: {
        id: "bench_tool_bag-sample-label",
        labelKind: "manual",
        text: "LOT-2026-041",
        receivedDate: null,
        sampleCode: null,
        isDraggable: true,
        allowedDropTargets: ["workbench_slot", "analytical_balance_widget", "trash_bin"],
      },
      sampleLabelId: "bench_tool_bag-sample-label",
      sampleLabelText: "LOT-2026-041",
      sourceId: "station_1",
      sourceKind: "workbench",
      sourceSlotId: "station_1",
    });
    syncTypes(dataTransfer);

    expect(hasCompatibleDropTarget(dataTransfer, "workbench_slot")).toBe(true);
    expect(hasCompatibleDropTarget(dataTransfer, "trash_bin")).toBe(true);
    expect(readSampleLabelDragPayload(dataTransfer)).toEqual({
      allowedDropTargets: ["workbench_slot", "trash_bin"],
      entityKind: "sample_label",
      label: {
        id: "bench_tool_bag-sample-label",
        labelKind: "manual",
        text: "LOT-2026-041",
        receivedDate: null,
        sampleCode: null,
        isDraggable: true,
        allowedDropTargets: ["workbench_slot", "analytical_balance_widget", "trash_bin"],
      },
      sampleLabelId: "bench_tool_bag-sample-label",
      sampleLabelText: "LOT-2026-041",
      sourceId: "station_1",
      sourceKind: "workbench",
      sourceSlotId: "station_1",
    });
  });

  it("marks basket produce drags as workbench-and-trash drops", () => {
    const dataTransfer = createDataTransfer();

    writeProduceDragPayload(dataTransfer, {
      allowedDropTargets: ["workbench_slot", "trash_bin"],
      entityKind: "produce",
      produceLotId: "produce_1",
      produceType: "apple",
      sourceId: "produce_1",
      sourceKind: "basket",
    });
    syncTypes(dataTransfer);

    expect(hasCompatibleDropTarget(dataTransfer, "workbench_slot")).toBe(true);
    expect(hasCompatibleDropTarget(dataTransfer, "trash_bin")).toBe(true);
    expect(hasCompatibleDropTarget(dataTransfer, "rack_slot")).toBe(false);
    expect(readProduceDragPayload(dataTransfer)).toEqual({
      allowedDropTargets: ["workbench_slot", "trash_bin"],
      entityKind: "produce",
      produceLotId: "produce_1",
      produceType: "apple",
      sourceId: "produce_1",
      sourceKind: "basket",
    });
  });

  it("marks workbench produce drags as workbench-and-trash drops", () => {
    const dataTransfer = createDataTransfer();

    writeProduceDragPayload(dataTransfer, {
      allowedDropTargets: ["workbench_slot", "trash_bin"],
      entityKind: "produce",
      produceLotId: "produce_1",
      produceType: "apple",
      sourceId: "produce_1",
      sourceKind: "workbench",
      sourceSlotId: "station_1",
    });
    syncTypes(dataTransfer);

    expect(hasCompatibleDropTarget(dataTransfer, "trash_bin")).toBe(true);
    expect(hasCompatibleDropTarget(dataTransfer, "workbench_slot")).toBe(true);
    expect(readProduceDragPayload(dataTransfer)).toEqual({
      allowedDropTargets: ["workbench_slot", "trash_bin"],
      entityKind: "produce",
      produceLotId: "produce_1",
      produceType: "apple",
      sourceId: "produce_1",
      sourceKind: "workbench",
      sourceSlotId: "station_1",
    });
  });

  it("marks grinder produce drags as workbench-and-trash drops", () => {
    const dataTransfer = createDataTransfer();

    writeProduceDragPayload(dataTransfer, {
      allowedDropTargets: ["workbench_slot", "trash_bin"],
      entityKind: "produce",
      produceLotId: "produce_1",
      produceType: "apple",
      sourceId: "produce_1",
      sourceKind: "grinder",
    });
    syncTypes(dataTransfer);

    expect(hasCompatibleDropTarget(dataTransfer, "trash_bin")).toBe(true);
    expect(hasCompatibleDropTarget(dataTransfer, "workbench_slot")).toBe(true);
    expect(readProduceDragPayload(dataTransfer)).toEqual({
      allowedDropTargets: ["workbench_slot", "trash_bin"],
      entityKind: "produce",
      produceLotId: "produce_1",
      produceType: "apple",
      sourceId: "produce_1",
      sourceKind: "grinder",
    });
  });

  it("marks grinder liquid drags as trash drops", () => {
    const dataTransfer = createDataTransfer();

    writeWorkspaceLiquidDragPayload(dataTransfer, {
      allowedDropTargets: ["trash_bin"],
      entityKind: "liquid",
      liquidEntryId: "workspace_liquid_1",
      liquidType: "dry_ice_pellets",
      sourceId: "workspace_liquid_1",
      sourceKind: "grinder",
      widgetId: "grinder",
    });
    syncTypes(dataTransfer);

    expect(hasCompatibleDropTarget(dataTransfer, "trash_bin")).toBe(true);
    expect(hasCompatibleDropTarget(dataTransfer, "workbench_slot")).toBe(false);
    expect(readWorkspaceLiquidDragPayload(dataTransfer)).toEqual({
      allowedDropTargets: ["trash_bin"],
      entityKind: "liquid",
      liquidEntryId: "workspace_liquid_1",
      liquidType: "dry_ice_pellets",
      sourceId: "workspace_liquid_1",
      sourceKind: "grinder",
      widgetId: "grinder",
    });
  });

  it("marks trash produce drags as workbench-and-trash drops", () => {
    const dataTransfer = createDataTransfer();

    writeProduceDragPayload(dataTransfer, {
      allowedDropTargets: ["workbench_slot", "trash_bin"],
      entityKind: "produce",
      produceLotId: "produce_1",
      produceType: "apple",
      sourceId: "produce_1",
      sourceKind: "trash",
      trashProduceLotId: "trash_produce_lot_1",
    });
    syncTypes(dataTransfer);

    expect(hasCompatibleDropTarget(dataTransfer, "trash_bin")).toBe(true);
    expect(hasCompatibleDropTarget(dataTransfer, "workbench_slot")).toBe(true);
    expect(readProduceDragPayload(dataTransfer)).toEqual({
      allowedDropTargets: ["workbench_slot", "trash_bin"],
      entityKind: "produce",
      produceLotId: "produce_1",
      produceType: "apple",
      sourceId: "produce_1",
      sourceKind: "trash",
      trashProduceLotId: "trash_produce_lot_1",
    });
  });

  it("marks autosampler vial drags as compatible with both stations and rack slots", () => {
    const dataTransfer = createDataTransfer();

    writeBenchToolDragPayload(dataTransfer, {
      allowedDropTargets: ["workbench_slot", "rack_slot", "trash_bin"],
      entityId: "bench_tool_1",
      entityKind: "tool",
      sourceId: "station_1",
      sourceKind: "workbench",
      sourceSlotId: "station_1",
      toolId: "sample_vial_lcms",
      toolType: "sample_vial",
    });
    syncTypes(dataTransfer);

    expect(hasCompatibleDropTarget(dataTransfer, "rack_slot")).toBe(true);
    expect(hasCompatibleDropTarget(dataTransfer, "workbench_slot")).toBe(true);
    expect(hasCompatibleDropTarget(dataTransfer, "trash_bin")).toBe(true);
    expect(readBenchToolDragPayload(dataTransfer)).toEqual({
      allowedDropTargets: ["workbench_slot", "rack_slot", "trash_bin"],
      entityId: "bench_tool_1",
      entityKind: "tool",
      sourceId: "station_1",
      sourceKind: "workbench",
      sourceSlotId: "station_1",
      toolId: "sample_vial_lcms",
      toolType: "sample_vial",
    });
  });

  it("marks non-vial bench tools as station-only moves", () => {
    const dataTransfer = createDataTransfer();

    writeBenchToolDragPayload(dataTransfer, {
      allowedDropTargets: ["workbench_slot", "trash_bin"],
      entityId: "bench_tool_2",
      entityKind: "tool",
      sourceId: "station_2",
      sourceKind: "workbench",
      sourceSlotId: "station_2",
      toolId: "hdpe_storage_jar_2l",
      toolType: "storage_jar",
    });
    syncTypes(dataTransfer);

    expect(hasCompatibleDropTarget(dataTransfer, "workbench_slot")).toBe(true);
    expect(hasCompatibleDropTarget(dataTransfer, "rack_slot")).toBe(false);
    expect(hasCompatibleDropTarget(dataTransfer, "trash_bin")).toBe(true);
    expect(readBenchToolDragPayload(dataTransfer)).toEqual({
      allowedDropTargets: ["workbench_slot", "trash_bin"],
      entityId: "bench_tool_2",
      entityKind: "tool",
      sourceId: "station_2",
      sourceKind: "workbench",
      sourceSlotId: "station_2",
      toolId: "hdpe_storage_jar_2l",
      toolType: "storage_jar",
    });
  });

  it("marks rack vial drags as station-compatible moves", () => {
    const dataTransfer = createDataTransfer();

    writeRackToolDragPayload(dataTransfer, {
      allowedDropTargets: ["workbench_slot", "trash_bin"],
      entityId: "rack_tool_1",
      entityKind: "tool",
      rackSlotId: "rack_slot_1",
      sourceId: "rack_slot_1",
      sourceKind: "rack",
      toolId: "sample_vial_lcms",
      toolType: "sample_vial",
    });
    syncTypes(dataTransfer);

    expect(hasCompatibleDropTarget(dataTransfer, "workbench_slot")).toBe(true);
    expect(hasCompatibleDropTarget(dataTransfer, "rack_slot")).toBe(false);
    expect(hasCompatibleDropTarget(dataTransfer, "trash_bin")).toBe(true);
    expect(readRackToolDragPayload(dataTransfer)).toEqual({
      allowedDropTargets: ["workbench_slot", "trash_bin"],
      entityId: "rack_tool_1",
      entityKind: "tool",
      rackSlotId: "rack_slot_1",
      sourceId: "rack_slot_1",
      sourceKind: "rack",
      toolId: "sample_vial_lcms",
      toolType: "sample_vial",
    });
  });
});
