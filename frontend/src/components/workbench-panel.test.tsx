import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { WorkbenchPanel } from "@/components/workbench-panel";
import type { WorkbenchPanelHandlers } from "@/components/workbench-panel";
import {
  writeBenchToolDragPayload,
  writeProduceDragPayload,
  writeRackToolDragPayload,
  writeSampleLabelDragPayload,
  writeToolbarDragPayload,
} from "@/lib/workbench-dnd";
import {
  canToolAcceptLiquids,
  canToolAcceptProduce,
  canToolBeSealed,
  canToolReceiveContents,
  getOpenEmptyToolContainment,
} from "@/test-support/tool-capabilities";
import type { BenchSlot, BenchToolInstance } from "@/types/workbench";

import { getProduceLotDropTargets, getSampleLabelDropTargets, getToolDropTargets, isToolStorable } from "@/test-support/drop-targets";
import type { BenchLabel, ExperimentProduceLot } from "@/types/workbench";

function makeProduceLot(overrides: Partial<ExperimentProduceLot> & { id: string }): ExperimentProduceLot {
  return {
    label: "Apple lot 1",
    produceType: "apple",
    totalMassG: 2450,
    unitCount: 12,
    isContaminated: false,
    isDraggable: true,
    allowedDropTargets: getProduceLotDropTargets(),
    ...overrides,
  };
}

function makeSampleBagLabel(overrides: Partial<BenchLabel> = {}): BenchLabel {
  return {
    id: "bench_tool_bag-sample-label",
    labelKind: "manual",
    text: "LOT-2026-041",
    receivedDate: null,
    sampleCode: null,
    isDraggable: true,
    allowedDropTargets: getSampleLabelDropTargets(),
    ...overrides,
  };
}

function withToolCapabilities(tool: BenchToolInstance): BenchToolInstance {
  const isStorable = tool.isStorable ?? isToolStorable(tool.toolType);
  const canStore =
    tool.canStore ??
    (isStorable &&
      (tool.produceLots?.length ?? 0) === 0 &&
      (tool.produceFractions?.length ?? 0) === 0 &&
      tool.liquids.length === 0 &&
      (tool.labels?.length ?? 0) === 0);
  const toolWithCapabilities = {
    ...tool,
    canReceiveContents: tool.canReceiveContents ?? canToolReceiveContents(tool.toolType, tool.isSealed ?? false),
    canReceiveLiquids: tool.canReceiveLiquids ?? canToolAcceptLiquids(tool.toolType),
    canReceiveProduce: tool.canReceiveProduce ?? canToolAcceptProduce(tool.toolType),
    canSeal: tool.canSeal ?? canToolBeSealed(tool.toolType),
    isStorable,
    canStore,
  };
  return {
    ...toolWithCapabilities,
    containment: toolWithCapabilities.containment ?? getOpenEmptyToolContainment(toolWithCapabilities.toolType),
  };
}

// Adapter: accepts flat handler props (test convention) and maps to the WorkbenchPanel
// handlers object. Unknown props like onLiquidVolumeChange / statusMessage are captured
// in ...rest and silently ignored — they were test artifacts with no corresponding prop.
type FlatHandlerProps = WorkbenchPanelHandlers & {
  slots: ComponentProps<typeof WorkbenchPanel>["slots"];
  dndDisabled?: boolean;
  renderPendingContent?: ComponentProps<typeof WorkbenchPanel>["renderPendingContent"];
  [key: string]: unknown;
};

function PesticideWorkbenchPanel({
  slots,
  dndDisabled,
  renderPendingContent,
  canDragBenchTool,
  isBenchSlotHighlighted,
  onAddWorkbenchSlot,
  onApplyLimsLabelTicket,
  onApplySampleLabel,
  onBenchToolClick,
  onBenchToolDragEnd,
  onBenchToolDragStart,
  onBenchToolDrop,
  onBenchToolIllustrationClick,
  onBenchToolPointerDown,
  onBenchToolPointerUp,
  onMoveObject,
  onProduceDrop,
  onProduceLotClick,
  onProduceLotDragStart,
  onRemoveLiquid,
  onRemoveWorkbenchSlot,
  onSampleLabelDragEnd,
  onSampleLabelDragStart,
  onSampleLabelTextChange,
  onStoreWorkbenchTool,
  onToggleToolSeal,
  onToolbarItemDrop,
}: FlatHandlerProps) {
  const enhancedSlots = slots.map((slot) => ({
    ...slot,
    tool: slot.tool ? withToolCapabilities(slot.tool) : null,
  })).map((slot) => ({
    ...slot,
    containment: slot.containment ?? {
      accepts: [{ entityKind: "tool" }, { entityKind: "produce" }],
      blockedReason:
        slot.tool !== null || (slot.surfaceProduceLots?.length ?? 0) > 0
          ? "occupied"
          : null,
      canReceive: slot.tool === null && (slot.surfaceProduceLots?.length ?? 0) === 0,
      capacity: 1,
      children: [
        ...(slot.tool
          ? [{ entityKind: "tool" as const, id: slot.tool.id, toolType: slot.tool.toolType }]
          : []),
        ...((slot.surfaceProduceLots ?? []).map((produceLot) => ({
          entityKind: "produce" as const,
          id: produceLot.id,
          produceType: produceLot.produceType,
        }))),
      ],
      remainingCapacity: slot.tool === null && (slot.surfaceProduceLots?.length ?? 0) === 0 ? 1 : 0,
    },
  }));
  return (
    <WorkbenchPanel
      dndDisabled={dndDisabled}
      handlers={{
        canDragBenchTool,
        isBenchSlotHighlighted,
        onAddWorkbenchSlot,
        onApplyLimsLabelTicket,
        onApplySampleLabel,
        onBenchToolClick,
        onBenchToolDragEnd,
        onBenchToolDragStart,
        onBenchToolDrop,
        onBenchToolIllustrationClick,
        onBenchToolPointerDown,
        onBenchToolPointerUp,
        onMoveObject,
        onProduceDrop,
        onProduceLotClick,
        onProduceLotDragStart,
        onRemoveLiquid,
        onRemoveWorkbenchSlot,
        onSampleLabelDragEnd,
        onSampleLabelDragStart,
        onSampleLabelTextChange,
        onStoreWorkbenchTool,
        onToggleToolSeal,
        onToolbarItemDrop,
      }}
      renderPendingContent={renderPendingContent}
      slots={enhancedSlots}
    />
  );
}

const slots: BenchSlot[] = [
  { id: "station_1", label: "Station 1", tool: null, dropTargetTypes: ["workbench_slot"] },
  { id: "station_2", label: "Station 2", tool: null, dropTargetTypes: ["workbench_slot"] },
];

type MockDataTransfer = DataTransfer & {
  data: Map<string, string>;
  types: string[];
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
  };
}

function syncTypes(dataTransfer: MockDataTransfer) {
  Object.defineProperty(dataTransfer, "types", {
    configurable: true,
    value: Array.from(dataTransfer.data.keys()),
  });
}

function writePayload(
  dataTransfer: MockDataTransfer,
  payload: Parameters<typeof writeToolbarDragPayload>[1],
) {
  writeToolbarDragPayload(dataTransfer, payload);
  syncTypes(dataTransfer);
}

describe("WorkbenchPanel", () => {
  it("renders empty stations with add/remove controls", () => {
    render(
      <PesticideWorkbenchPanel
        onAddWorkbenchSlot={vi.fn()}
        onLiquidVolumeChange={vi.fn()}
        onRemoveLiquid={vi.fn()}
        onRemoveWorkbenchSlot={vi.fn()}
        slots={slots}
        statusMessage="Start by dragging an extraction tool onto the bench."
        onToolbarItemDrop={vi.fn()}
      />,
    );

    expect(screen.getByText("Station 1")).toBeInTheDocument();
    expect(screen.getByText("Station 2")).toBeInTheDocument();
    expect(screen.getAllByText("Empty station")).toHaveLength(2);
    expect(screen.getByTestId("add-workbench-slot-button")).toBeInTheDocument();
    expect(screen.getByTestId("remove-workbench-slot-button-station_1")).toBeEnabled();
  });

  it("adds a station and only allows removing empty ones", () => {
    const onAddWorkbenchSlot = vi.fn();
    const onRemoveWorkbenchSlot = vi.fn();

    render(
      <PesticideWorkbenchPanel
        onAddWorkbenchSlot={onAddWorkbenchSlot}
        onLiquidVolumeChange={vi.fn()}
        onRemoveLiquid={vi.fn()}
        onRemoveWorkbenchSlot={onRemoveWorkbenchSlot}
        slots={[
          { id: "station_1", label: "Station 1", tool: null },
          {
            id: "station_2",
            label: "Station 2",
            tool: {
              id: "bench_tool_1",
              toolId: "sample_vial_lcms",
              label: "Autosampler vial",
              subtitle: "Injection ready",
              accent: "sky",
              toolType: "sample_vial",
              capacity_ml: 2,
              liquids: [],
            },
          },
        ]}
        statusMessage="Ready."
        onToolbarItemDrop={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("add-workbench-slot-button"));
    fireEvent.click(screen.getByTestId("remove-workbench-slot-button-station_1"));

    expect(onAddWorkbenchSlot).toHaveBeenCalledTimes(1);
    expect(onRemoveWorkbenchSlot).toHaveBeenCalledWith("station_1");
    expect(screen.getByTestId("remove-workbench-slot-button-station_2")).toBeDisabled();
  });

  it("shows an inventory store action for empty cutting boards", () => {
    const onStoreWorkbenchTool = vi.fn();

    render(
      <PesticideWorkbenchPanel
        onLiquidVolumeChange={vi.fn()}
        onRemoveLiquid={vi.fn()}
        onStoreWorkbenchTool={onStoreWorkbenchTool}
        onToolbarItemDrop={vi.fn()}
        slots={[
          {
            id: "station_1",
            label: "Station 1",
            tool: {
              accent: "emerald",
              capacity_ml: 0,
              canReceiveProduce: true,
              id: "bench_tool_board",
              label: "Cutting board",
              liquids: [],
              produceLots: [],
              subtitle: "Prep surface",
              toolId: "cutting_board_hdpe",
              toolType: "cutting_board",
            },
          },
        ]}
        statusMessage="Ready."
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Store Cutting board in inventory" }));

    expect(onStoreWorkbenchTool).toHaveBeenCalledWith("station_1");
  });

  it("disables cutting board storage until the board is empty", () => {
    const onStoreWorkbenchTool = vi.fn();

    render(
      <PesticideWorkbenchPanel
        onLiquidVolumeChange={vi.fn()}
        onRemoveLiquid={vi.fn()}
        onStoreWorkbenchTool={onStoreWorkbenchTool}
        onToolbarItemDrop={vi.fn()}
        slots={[
          {
            id: "station_1",
            label: "Station 1",
            tool: {
              accent: "emerald",
              capacity_ml: 0,
              canReceiveProduce: true,
              id: "bench_tool_board",
              label: "Cutting board",
              liquids: [],
              produceLots: [
                {
                  allowedDropTargets: ["workbench_slot", "grinder_widget", "trash_bin", "gross_balance_widget"],
                  id: "produce_lot_1",
                  isDraggable: true,
                  label: "Apple lot",
                  produceType: "apple",
                  unitCount: 1,
                },
              ],
              subtitle: "Prep surface",
              toolId: "cutting_board_hdpe",
              toolType: "cutting_board",
            },
          },
        ]}
        statusMessage="Ready."
      />,
    );

    expect(screen.getByRole("button", { name: "Store Cutting board in inventory" })).toBeDisabled();
    expect(onStoreWorkbenchTool).not.toHaveBeenCalled();
  });

  it("shows multi-liquid tools with multiple fill segments", () => {
    render(
      <PesticideWorkbenchPanel
        onLiquidVolumeChange={vi.fn()}
        onRemoveLiquid={vi.fn()}
        onToolbarItemDrop={vi.fn()}
        slots={[
          {
            id: "station_1",
            label: "Station 1",
            tool: {
              id: "bench_tool_1",
              toolId: "centrifuge_tube_50ml",
              label: "50 mL centrifuge tube",
              subtitle: "Extraction ready",
              accent: "sky",
              toolType: "centrifuge_tube",
              capacity_ml: 50,
              liquids: [
                {
                  id: "bench_liquid_1",
                  liquidId: "acetonitrile_extraction",
                  name: "Acetonitrile",
                  volume_ml: 10,
                  accent: "amber",
                },
                {
                  id: "bench_liquid_2",
                  liquidId: "matrix_blank",
                  name: "Matrix blank",
                  volume_ml: 5,
                  accent: "emerald",
                },
              ],
            },
          },
        ]}
        statusMessage="Bench ready."
      />,
    );

    expect(
      screen
        .getByTestId("bench-slot-station_1")
        .querySelector("[data-kind='centrifuge_tube']"),
    ).toHaveAttribute("data-fill-segments", "2");
  });

  it("renders powder layers inside powder-loaded tubes", () => {
    render(
      <PesticideWorkbenchPanel
        onLiquidVolumeChange={vi.fn()}
        onRemoveLiquid={vi.fn()}
        onToolbarItemDrop={vi.fn()}
        slots={[
          {
            id: "station_1",
            label: "Station 1",
            tool: {
              id: "bench_tool_tube",
              toolId: "centrifuge_tube_50ml",
              label: "50 mL centrifuge tube",
              subtitle: "Extraction ready",
              accent: "sky",
              toolType: "centrifuge_tube",
              capacity_ml: 50,
              powderMassG: 1.4,
              liquids: [],
              produceFractions: [
                { id: "powder_1", produceLotId: "lot_1", produceMaterialStateId: "state_ground_1", massG: 1.4 },
              ],
            },
          },
          {
            id: "station_2",
            label: "Station 2",
            tool: {
              id: "bench_tool_cleanup",
              toolId: "cleanup_tube_dspe",
              label: "d-SPE cleanup tube",
              subtitle: "Cleanup ready",
              accent: "sky",
              toolType: "cleanup_tube",
              capacity_ml: 15,
              powderMassG: 0.8,
              liquids: [],
              produceFractions: [
                { id: "powder_2", produceLotId: "lot_2", produceMaterialStateId: "state_ground_2", massG: 0.8 },
              ],
            },
          },
        ]}
        statusMessage="Bench ready."
      />,
    );

    expect(
      screen
        .getByTestId("bench-tool-card-bench_tool_tube")
        .querySelector("[data-kind='centrifuge_tube'] [data-powder-layer='true']"),
    ).toBeTruthy();
    expect(
      screen
        .getByTestId("bench-tool-card-bench_tool_cleanup")
        .querySelector("[data-kind='cleanup_tube'] [data-powder-layer='true']"),
    ).toBeTruthy();
  });

  it("hides removable liquid cards when the tool contains slurry", () => {
    render(
      <PesticideWorkbenchPanel
        onLiquidVolumeChange={vi.fn()}
        onRemoveLiquid={vi.fn()}
        onToolbarItemDrop={vi.fn()}
        slots={[
          {
            id: "station_1",
            label: "Station 1",
            tool: {
              id: "bench_tool_tube",
              toolId: "centrifuge_tube_50ml",
              label: "50 mL centrifuge tube",
              subtitle: "Extraction ready",
              accent: "sky",
              toolType: "centrifuge_tube",
              capacity_ml: 50,
              containsSlurry: true,
              liquids: [
                {
                  id: "bench_liquid_1",
                  liquidId: "acetonitrile_extraction",
                  name: "Acetonitrile",
                  volume_ml: 10,
                  accent: "amber",
                },
              ],
              produceLots: [makeProduceLot({ id: "lot_1", materialState: "slurry" })],
            },
          },
        ]}
        statusMessage="Bench ready."
      />,
    );

    const toolCard = screen.getByTestId("bench-tool-card-bench_tool_tube");
    expect(toolCard).toHaveTextContent("Slurry present");
    expect(screen.queryByText("Acetonitrile")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove Acetonitrile" })).not.toBeInTheDocument();
  });

  it("marks sealable tool illustrations with their seal state", () => {
    render(
      <PesticideWorkbenchPanel
        onRemoveLiquid={vi.fn()}
        slots={[
          {
            id: "station_1",
            label: "Station 1",
            tool: {
              id: "bench_tool_jar_open",
              toolId: "hdpe_storage_jar_2l",
              label: "Wide-neck HDPE jar",
              subtitle: "Bulk powder storage",
              accent: "amber",
              toolType: "storage_jar",
              capacity_ml: 2000,
              isSealed: false,
              liquids: [],
              produceLots: [],
            },
          },
          {
            id: "station_2",
            label: "Station 2",
            tool: {
              id: "bench_tool_jar_closed",
              toolId: "hdpe_storage_jar_2l",
              label: "Wide-neck HDPE jar",
              subtitle: "Bulk powder storage",
              accent: "amber",
              toolType: "storage_jar",
              capacity_ml: 2000,
              isSealed: true,
              liquids: [],
              produceLots: [],
            },
          },
        ]}
        statusMessage="Ready."
        onToolbarItemDrop={vi.fn()}
      />,
    );

    expect(
      screen
        .getByTestId("bench-tool-card-bench_tool_jar_open")
        .querySelector("[data-kind='storage_jar']"),
    ).toHaveAttribute("data-seal-state", "open");
    expect(
      screen
        .getByTestId("bench-tool-card-bench_tool_jar_closed")
        .querySelector("[data-kind='storage_jar']"),
    ).toHaveAttribute("data-seal-state", "sealed");
  });

  it("marks autosampler vial illustrations as sealable and sealed", () => {
    render(
      <PesticideWorkbenchPanel
        onRemoveLiquid={vi.fn()}
        slots={[
          {
            id: "station_1",
            label: "Station 1",
            tool: {
              id: "bench_tool_vial_closed",
              toolId: "sample_vial_lcms",
              label: "Autosampler vial",
              subtitle: "Injection ready",
              accent: "sky",
              toolType: "sample_vial",
              capacity_ml: 2,
              isSealed: true,
              liquids: [],
              produceLots: [],
            },
          },
        ]}
        statusMessage="Ready."
        onToolbarItemDrop={vi.fn()}
      />,
    );

    expect(
      screen
        .getByTestId("bench-tool-card-bench_tool_vial_closed")
        .querySelector("[data-kind='sample_vial']"),
    ).toHaveAttribute("data-seal-state", "sealed");
  });

  it("renders a filled sampling bag with visible produce state", () => {
    render(
      <PesticideWorkbenchPanel
        onLiquidVolumeChange={vi.fn()}
        onRemoveLiquid={vi.fn()}
        onToolbarItemDrop={vi.fn()}
        slots={[
          {
            id: "station_1",
            label: "Station 1",
            tool: {
              id: "bench_tool_bag",
              toolId: "sealed_sampling_bag",
              label: "Sealed sampling bag",
              subtitle: "Field collection",
              accent: "emerald",
              toolType: "sample_bag",
              capacity_ml: 500,
              produceLots: [
                makeProduceLot({ id: "produce_1", materialState: "cut" }),
              ],
              liquids: [],
            },
          },
        ]}
        statusMessage="Ready."
      />,
    );

    expect(
      screen
        .getByTestId("bench-slot-station_1")
        .querySelector("[data-kind='sample_bag']"),
    ).toHaveAttribute("data-produce-lot-count", "1");
    expect(
      screen
        .getByTestId("bench-slot-station_1")
        .querySelector("[data-kind='sample_bag']"),
    ).toHaveAttribute("data-primary-produce-cut-state", "cut");
    expect(screen.getByText("Apple lot 1")).toBeInTheDocument();
    expect(screen.getByText("12 units")).toBeInTheDocument();
  });

  it("derives the produce lot display name from the produce state on workbench surfaces", () => {
    render(
      <PesticideWorkbenchPanel
        onRemoveLiquid={vi.fn()}
        onToolbarItemDrop={vi.fn()}
        slots={[
          {
            id: "station_1",
            label: "Station 1",
            surfaceProduceLots: [
              makeProduceLot({ id: "produce_1", materialState: "ground" }),
            ],
            tool: null,
          },
        ]}
        statusMessage="Ready."
      />,
    );

    expect(screen.getByText("Apple lot 1 powder")).toBeInTheDocument();
  });

  it("renders direct station produce with the apple icon", () => {
    render(
      <PesticideWorkbenchPanel
        onLiquidVolumeChange={vi.fn()}
        onRemoveLiquid={vi.fn()}
        onToolbarItemDrop={vi.fn()}
        slots={[
          {
            id: "station_1",
            label: "Station 1",
            tool: null,
            surfaceProduceLots: [
              makeProduceLot({ id: "produce_1", isContaminated: true }),
            ],
          },
        ]}
        statusMessage="Ready."
      />,
    );

    expect(screen.getByLabelText("Apple lot illustration")).toBeInTheDocument();
    expect(screen.getByText("Apple lot 1")).toBeInTheDocument();
    expect(screen.getByText("12 units")).toBeInTheDocument();
  });

  it("shows a thermometer for cold produce resting on a station", () => {
    render(
      <PesticideWorkbenchPanel
        onLiquidVolumeChange={vi.fn()}
        onRemoveLiquid={vi.fn()}
        onToolbarItemDrop={vi.fn()}
        slots={[
          {
            id: "station_1",
            label: "Station 1",
            tool: null,
            surfaceProduceLots: [
              makeProduceLot({ id: "produce_1", temperatureC: 4.2 }),
            ],
          },
        ]}
        statusMessage="Ready."
      />,
    );

    expect(screen.getByText("4.2°C")).toBeInTheDocument();
  });

  it("renders cutting board produce with the apple icon", () => {
    render(
      <PesticideWorkbenchPanel
        onLiquidVolumeChange={vi.fn()}
        onRemoveLiquid={vi.fn()}
        onToolbarItemDrop={vi.fn()}
        slots={[
          {
            id: "station_1",
            label: "Station 1",
            tool: {
              id: "bench_tool_board",
              toolId: "cutting_board_hdpe",
              label: "Cutting board",
              subtitle: "Prep surface",
              accent: "amber",
              toolType: "cutting_board",
              capacity_ml: 0,
              produceLots: [
                makeProduceLot({ id: "produce_1" }),
              ],
              liquids: [],
            },
          },
        ]}
        statusMessage="Ready."
      />,
    );

    expect(screen.getByLabelText("Apple lot illustration")).toBeInTheDocument();
    expect(screen.getByText("Apple lot 1")).toBeInTheDocument();
    expect(screen.getByText("12 units")).toBeInTheDocument();
  });

  it("renders cut produce on a cutting board with the cut apple variant", () => {
    render(
      <PesticideWorkbenchPanel
        onLiquidVolumeChange={vi.fn()}
        onRemoveLiquid={vi.fn()}
        onToolbarItemDrop={vi.fn()}
        slots={[
          {
            id: "station_1",
            label: "Station 1",
            tool: {
              id: "bench_tool_board",
              toolId: "cutting_board_hdpe",
              label: "Cutting board",
              subtitle: "Prep surface",
              accent: "amber",
              toolType: "cutting_board",
              capacity_ml: 0,
              produceLots: [
                makeProduceLot({ id: "produce_1", materialState: "cut" }),
              ],
              liquids: [],
            },
          },
        ]}
        statusMessage="Ready."
      />,
    );

    expect(screen.getAllByTestId("apple-illustration").at(-1)).toHaveAttribute("data-variant", "cut");
  });

  it("shows the sample label on the sampling bag illustration", () => {
    render(
      <PesticideWorkbenchPanel
        onLiquidVolumeChange={vi.fn()}
        onRemoveLiquid={vi.fn()}
        onToolbarItemDrop={vi.fn()}
        slots={[
          {
            id: "station_1",
            label: "Station 1",
            tool: {
              id: "bench_tool_bag",
              toolId: "sealed_sampling_bag",
              label: "Sealed sampling bag",
              subtitle: "Field collection",
              accent: "emerald",
              toolType: "sample_bag",
              capacity_ml: 500,
              isDraggable: true,
              allowedDropTargets: getToolDropTargets("sample_bag"),
              labels: [makeSampleBagLabel({ text: "LOT-2026-041" })],
              produceLots: [],
              liquids: [],
            },
          },
        ]}
        statusMessage="Ready."
      />,
    );

    expect(
      screen
        .getByTestId("bench-slot-station_1")
        .querySelector("[data-kind='sample_bag']"),
    ).toHaveAttribute("data-sample-label-text", "LOT-2026-041");
    expect(screen.getByText("LOT-2026-041")).toBeInTheDocument();
  });

  it("accepts tool drags on stations and forwards the drop payload", () => {
    const onToolbarItemDrop = vi.fn();
    const dataTransfer = createDataTransfer();
    writePayload(dataTransfer, {
      allowedDropTargets: ["workbench_slot"],
      entityId: "sample_vial_lcms",
      entityKind: "tool",
      itemId: "sample_vial_lcms",
      itemType: "tool",
      sourceId: "sample_vial_lcms",
      sourceKind: "palette",
      toolType: "sample_vial",
    });

    render(
      <PesticideWorkbenchPanel
        onLiquidVolumeChange={vi.fn()}
        onRemoveLiquid={vi.fn()}
        onToolbarItemDrop={onToolbarItemDrop}
        slots={slots}
        statusMessage="Ready."
      />,
    );

    const station = screen.getByTestId("bench-slot-station_1");
    const dragOverEvent = createEvent.dragOver(station, { dataTransfer });
    fireEvent(station, dragOverEvent);
    fireEvent.drop(station, { dataTransfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    expect(onToolbarItemDrop).toHaveBeenCalledWith("station_1", {
      allowedDropTargets: ["workbench_slot"],
      entityId: "sample_vial_lcms",
      entityKind: "tool",
      itemId: "sample_vial_lcms",
      itemType: "tool",
      sourceId: "sample_vial_lcms",
      sourceKind: "palette",
      toolType: "sample_vial",
    });
  });

  it("rejects liquid drags on empty stations", () => {
    const onToolbarItemDrop = vi.fn();
    const dataTransfer = createDataTransfer();
    writePayload(dataTransfer, {
      allowedDropTargets: ["workbench_slot"],
      entityKind: "liquid",
      itemId: "acetonitrile_extraction",
      itemType: "liquid",
      liquidType: "acetonitrile",
      sourceId: "acetonitrile_extraction",
      sourceKind: "palette",
    });

    render(
      <PesticideWorkbenchPanel
        onLiquidVolumeChange={vi.fn()}
        onRemoveLiquid={vi.fn()}
        onToolbarItemDrop={onToolbarItemDrop}
        slots={slots}
        statusMessage="Ready."
      />,
    );

    const station = screen.getByTestId("bench-slot-station_1");
    const dragOverEvent = createEvent.dragOver(station, { dataTransfer });
    fireEvent(station, dragOverEvent);
    fireEvent.drop(station, { dataTransfer });

    expect(dragOverEvent.defaultPrevented).toBe(false);
    expect(onToolbarItemDrop).not.toHaveBeenCalled();
  });

  it("accepts liquid drags only on stations that already contain a compatible tool", () => {
    const onToolbarItemDrop = vi.fn();
    const dataTransfer = createDataTransfer();
    writePayload(dataTransfer, {
      allowedDropTargets: ["workbench_slot"],
      entityKind: "liquid",
      itemId: "acetonitrile_extraction",
      itemType: "liquid",
      liquidType: "acetonitrile",
      sourceId: "acetonitrile_extraction",
      sourceKind: "palette",
    });

    render(
      <PesticideWorkbenchPanel
        onLiquidVolumeChange={vi.fn()}
        onRemoveLiquid={vi.fn()}
        onToolbarItemDrop={onToolbarItemDrop}
        slots={[
          {
            id: "station_1",
            label: "Station 1",
            dropTargetTypes: ["workbench_slot"],
            tool: {
              id: "bench_tool_1",
              toolId: "sample_vial_lcms",
              label: "Autosampler vial",
              subtitle: "Injection ready",
              accent: "sky",
              toolType: "sample_vial",
              capacity_ml: 2,
              liquids: [],
            },
          },
          slots[1],
        ]}
        statusMessage="Ready."
      />,
    );

    const station = screen.getByTestId("bench-slot-station_1");
    const dragOverEvent = createEvent.dragOver(station, { dataTransfer });
    fireEvent(station, dragOverEvent);
    fireEvent.drop(station, { dataTransfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    expect(onToolbarItemDrop).toHaveBeenCalledWith("station_1", {
      allowedDropTargets: ["workbench_slot"],
      entityKind: "liquid",
      itemId: "acetonitrile_extraction",
      itemType: "liquid",
      liquidType: "acetonitrile",
      sourceId: "acetonitrile_extraction",
      sourceKind: "palette",
    });
  });

  it("rejects workspace widget drags on stations", () => {
    const onToolbarItemDrop = vi.fn();
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

    render(
      <PesticideWorkbenchPanel
        onLiquidVolumeChange={vi.fn()}
        onRemoveLiquid={vi.fn()}
        onToolbarItemDrop={onToolbarItemDrop}
        slots={slots}
        statusMessage="Ready."
      />,
    );

    const station = screen.getByTestId("bench-slot-station_1");
    const dragOverEvent = createEvent.dragOver(station, { dataTransfer });
    fireEvent(station, dragOverEvent);
    fireEvent.drop(station, { dataTransfer });

    expect(dragOverEvent.defaultPrevented).toBe(false);
    expect(onToolbarItemDrop).not.toHaveBeenCalled();
  });

  it("accepts sample label drags only on unlabeled sampling bags", () => {
    const onApplySampleLabel = vi.fn();
    const dataTransfer = createDataTransfer();
    writePayload(dataTransfer, {
      allowedDropTargets: ["workbench_slot", "trash_bin"],
      entityKind: "sample_label",
      itemId: "sampling_bag_label",
      itemType: "sample_label",
      sourceId: "sampling_bag_label",
      sourceKind: "palette",
    });

    render(
      <PesticideWorkbenchPanel
        onApplySampleLabel={onApplySampleLabel}
        onLiquidVolumeChange={vi.fn()}
        onRemoveLiquid={vi.fn()}
        onToolbarItemDrop={vi.fn()}
        slots={[
          {
            id: "station_1",
            label: "Station 1",
            dropTargetTypes: ["workbench_slot"],
            tool: {
              id: "bench_tool_bag",
              toolId: "sealed_sampling_bag",
              label: "Sealed sampling bag",
              subtitle: "Field collection",
              accent: "emerald",
              toolType: "sample_bag",
              capacity_ml: 500,
              isDraggable: true,
              allowedDropTargets: getToolDropTargets("sample_bag"),
              labels: [],
              liquids: [],
              produceLots: [],
            },
          },
          slots[1],
        ]}
        statusMessage="Ready."
      />,
    );

    const station = screen.getByTestId("bench-slot-station_1");
    const dragOverEvent = createEvent.dragOver(station, { dataTransfer });
    fireEvent(station, dragOverEvent);
    fireEvent.drop(station, { dataTransfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    expect(onApplySampleLabel).toHaveBeenCalledWith("station_1");
  });

  it("moves a labeled sample label to another unlabeled sampling bag", () => {
    const onMoveObject = vi.fn();
    const dataTransfer = createDataTransfer();
    writeSampleLabelDragPayload(dataTransfer, {
      allowedDropTargets: ["workbench_slot", "trash_bin"],
      entityKind: "sample_label",
      label: makeSampleBagLabel({ text: "LOT-2026-041" }),
      sampleLabelId: "bench_tool_bag-sample-label",
      sampleLabelText: "LOT-2026-041",
      sourceId: "station_1",
      sourceKind: "workbench",
      sourceSlotId: "station_1",
    });
    syncTypes(dataTransfer);

    render(
      <PesticideWorkbenchPanel
        onMoveObject={onMoveObject}
        onLiquidVolumeChange={vi.fn()}
        onRemoveLiquid={vi.fn()}
        onToolbarItemDrop={vi.fn()}
        slots={[
          {
            id: "station_1",
            label: "Station 1",
            dropTargetTypes: ["workbench_slot"],
            tool: {
              id: "bench_tool_bag",
              toolId: "sealed_sampling_bag",
              label: "Sealed sampling bag",
              subtitle: "Field collection",
              accent: "emerald",
              toolType: "sample_bag",
              capacity_ml: 500,
              isDraggable: true,
              allowedDropTargets: getToolDropTargets("sample_bag"),
              labels: [makeSampleBagLabel({ id: "bench_tool_bag-sample-label", text: "LOT-2026-041" })],
              liquids: [],
              produceLots: [],
            },
          },
          {
            id: "station_2",
            label: "Station 2",
            dropTargetTypes: ["workbench_slot"],
            tool: {
              id: "bench_tool_bag_2",
              toolId: "sealed_sampling_bag",
              label: "Sealed sampling bag",
              subtitle: "Field collection",
              accent: "emerald",
              toolType: "sample_bag",
              capacity_ml: 500,
              isDraggable: true,
              allowedDropTargets: getToolDropTargets("sample_bag"),
              labels: [],
              liquids: [],
              produceLots: [],
            },
          },
        ]}
        statusMessage="Ready."
      />,
    );

    const station = screen.getByTestId("bench-slot-station_2");
    const dragOverEvent = createEvent.dragOver(station, { dataTransfer });
    fireEvent(station, dragOverEvent);
    fireEvent.drop(station, { dataTransfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    expect(onMoveObject).toHaveBeenCalledWith({
      destination: { kind: "workbench_tool", id: "station_2" },
      entity: { kind: "sample_label", id: "bench_tool_bag-sample-label" },
      source: { kind: "workbench", id: "station_1" },
    });
  });

  it("accepts produce drags only on stations containing an open sampling bag", () => {
    const onProduceDrop = vi.fn();
    const dataTransfer = createDataTransfer();
    writeProduceDragPayload(dataTransfer, {
      allowedDropTargets: ["workbench_slot"],
      entityKind: "produce",
      produceLotId: "produce_1",
      produceType: "apple",
      sourceId: "produce_1",
      sourceKind: "basket",
    });
    syncTypes(dataTransfer);

    render(
      <PesticideWorkbenchPanel
        onLiquidVolumeChange={vi.fn()}
        onProduceDrop={onProduceDrop}
        onRemoveLiquid={vi.fn()}
        onToolbarItemDrop={vi.fn()}
        slots={[
          {
            id: "station_1",
            label: "Station 1",
            dropTargetTypes: ["workbench_slot"],
            tool: {
              id: "bench_tool_bag",
              toolId: "sealed_sampling_bag",
              label: "Sealed sampling bag",
              subtitle: "Field collection",
              accent: "emerald",
              toolType: "sample_bag",
              capacity_ml: 500,
              isSealed: false,
              produceLots: [],
              liquids: [],
            },
          },
          slots[1],
        ]}
        statusMessage="Ready."
      />,
    );

    const station = screen.getByTestId("bench-slot-station_1");
    const dragOverEvent = createEvent.dragOver(station, { dataTransfer });
    fireEvent(station, dragOverEvent);
    fireEvent.drop(station, { dataTransfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    expect(onProduceDrop).toHaveBeenCalledWith("station_1", {
      allowedDropTargets: ["workbench_slot"],
      entityKind: "produce",
      produceLotId: "produce_1",
      produceType: "apple",
      sourceId: "produce_1",
      sourceKind: "basket",
    });
  });

  it("rejects produce drags on stations without a sealed sampling bag", () => {
    const onProduceDrop = vi.fn();
    const dataTransfer = createDataTransfer();
    writeProduceDragPayload(dataTransfer, {
      allowedDropTargets: ["workbench_slot"],
      entityKind: "produce",
      produceLotId: "produce_1",
      produceType: "apple",
      sourceId: "produce_1",
      sourceKind: "basket",
    });
    syncTypes(dataTransfer);

    render(
      <PesticideWorkbenchPanel
        onLiquidVolumeChange={vi.fn()}
        onProduceDrop={onProduceDrop}
        onRemoveLiquid={vi.fn()}
        onToolbarItemDrop={vi.fn()}
        slots={[
          {
            id: "station_1",
            label: "Station 1",
            tool: {
              id: "bench_tool_tube",
              toolId: "centrifuge_tube_50ml",
              label: "50 mL centrifuge tube",
              subtitle: "Extraction ready",
              accent: "amber",
              toolType: "centrifuge_tube",
              capacity_ml: 50,
              produceLots: [],
              liquids: [],
            },
          },
          slots[1],
        ]}
        statusMessage="Ready."
      />,
    );

    const station = screen.getByTestId("bench-slot-station_1");
    const dragOverEvent = createEvent.dragOver(station, { dataTransfer });
    fireEvent(station, dragOverEvent);
    fireEvent.drop(station, { dataTransfer });

    expect(dragOverEvent.defaultPrevented).toBe(false);
    expect(onProduceDrop).not.toHaveBeenCalled();
  });

  it("rejects produce drags on sealed produce containers", () => {
    const onProduceDrop = vi.fn();
    const dataTransfer = createDataTransfer();
    writeProduceDragPayload(dataTransfer, {
      allowedDropTargets: ["workbench_slot"],
      entityKind: "produce",
      produceLotId: "produce_1",
      produceType: "apple",
      sourceId: "produce_1",
      sourceKind: "basket",
    });
    syncTypes(dataTransfer);

    render(
      <PesticideWorkbenchPanel
        onProduceDrop={onProduceDrop}
        onRemoveLiquid={vi.fn()}
        onToolbarItemDrop={vi.fn()}
        slots={[
          {
            id: "station_1",
            label: "Station 1",
            tool: {
              id: "bench_tool_bag",
              toolId: "sealed_sampling_bag",
              label: "Sealed sampling bag",
              subtitle: "Field collection",
              accent: "emerald",
              toolType: "sample_bag",
              capacity_ml: 500,
              isSealed: true,
              produceLots: [],
              liquids: [],
            },
          },
          slots[1],
        ]}
        statusMessage="Ready."
      />,
    );

    const station = screen.getByTestId("bench-slot-station_1");
    const dragOverEvent = createEvent.dragOver(station, { dataTransfer });
    fireEvent(station, dragOverEvent);
    fireEvent.drop(station, { dataTransfer });

    expect(dragOverEvent.defaultPrevented).toBe(false);
    expect(onProduceDrop).not.toHaveBeenCalled();
  });

  it("rejects produce drags on sampling bags that already contain a lot", () => {
    const onProduceDrop = vi.fn();
    const dataTransfer = createDataTransfer();
    writeProduceDragPayload(dataTransfer, {
      allowedDropTargets: ["workbench_slot"],
      entityKind: "produce",
      produceLotId: "produce_2",
      produceType: "apple",
      sourceId: "produce_2",
      sourceKind: "basket",
    });
    syncTypes(dataTransfer);

    render(
      <PesticideWorkbenchPanel
        onLiquidVolumeChange={vi.fn()}
        onProduceDrop={onProduceDrop}
        onRemoveLiquid={vi.fn()}
        onToolbarItemDrop={vi.fn()}
        slots={[
          {
            id: "station_1",
            label: "Station 1",
            tool: {
              id: "bench_tool_bag",
              toolId: "sealed_sampling_bag",
              label: "Sealed sampling bag",
              subtitle: "Field collection",
              accent: "emerald",
              toolType: "sample_bag",
              capacity_ml: 500,
              produceLots: [
                makeProduceLot({ id: "produce_1" }),
              ],
              liquids: [],
            },
          },
          slots[1],
        ]}
        statusMessage="Ready."
      />,
    );

    const station = screen.getByTestId("bench-slot-station_1");
    const dragOverEvent = createEvent.dragOver(station, { dataTransfer });
    fireEvent(station, dragOverEvent);
    fireEvent.drop(station, { dataTransfer });

    expect(dragOverEvent.defaultPrevented).toBe(false);
    expect(onProduceDrop).not.toHaveBeenCalled();
  });

  it("accepts produce drags coming from a workbench sample bag on empty sampling bags", () => {
    const onProduceDrop = vi.fn();
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

    render(
      <PesticideWorkbenchPanel
        onLiquidVolumeChange={vi.fn()}
        onProduceDrop={onProduceDrop}
        onRemoveLiquid={vi.fn()}
        onToolbarItemDrop={vi.fn()}
        slots={[
          {
            id: "station_1",
            label: "Station 1",
            dropTargetTypes: ["workbench_slot"],
            tool: {
              id: "bench_tool_bag",
              toolId: "sealed_sampling_bag",
              label: "Sealed sampling bag",
              subtitle: "Field collection",
              accent: "emerald",
              toolType: "sample_bag",
              capacity_ml: 500,
              produceLots: [],
              liquids: [],
            },
          },
          {
            id: "station_2",
            label: "Station 2",
            dropTargetTypes: ["workbench_slot"],
            tool: {
              id: "bench_tool_bag_2",
              toolId: "sealed_sampling_bag",
              label: "Sealed sampling bag",
              subtitle: "Field collection",
              accent: "emerald",
              toolType: "sample_bag",
              capacity_ml: 500,
              produceLots: [],
              liquids: [],
            },
          },
        ]}
        statusMessage="Ready."
      />,
    );

    const station = screen.getByTestId("bench-slot-station_2");
    const dragOverEvent = createEvent.dragOver(station, { dataTransfer });
    fireEvent(station, dragOverEvent);
    fireEvent.drop(station, { dataTransfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    expect(onProduceDrop).toHaveBeenCalledWith("station_2", {
      allowedDropTargets: ["workbench_slot", "trash_bin"],
      entityKind: "produce",
      produceLotId: "produce_1",
      produceType: "apple",
      sourceId: "produce_1",
      sourceKind: "workbench",
      sourceSlotId: "station_1",
    });
  });

  it("accepts produce drags coming from trash on empty sampling bags", () => {
    const onProduceDrop = vi.fn();
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

    render(
      <PesticideWorkbenchPanel
        onLiquidVolumeChange={vi.fn()}
        onProduceDrop={onProduceDrop}
        onRemoveLiquid={vi.fn()}
        onToolbarItemDrop={vi.fn()}
        slots={[
          {
            id: "station_1",
            label: "Station 1",
            dropTargetTypes: ["workbench_slot"],
            tool: {
              id: "bench_tool_bag",
              toolId: "sealed_sampling_bag",
              label: "Sealed sampling bag",
              subtitle: "Field collection",
              accent: "emerald",
              toolType: "sample_bag",
              capacity_ml: 500,
              produceLots: [],
              liquids: [],
            },
          },
          slots[1],
        ]}
        statusMessage="Ready."
      />,
    );

    const station = screen.getByTestId("bench-slot-station_1");
    const dragOverEvent = createEvent.dragOver(station, { dataTransfer });
    fireEvent(station, dragOverEvent);
    fireEvent.drop(station, { dataTransfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    expect(onProduceDrop).toHaveBeenCalledWith("station_1", {
      allowedDropTargets: ["workbench_slot", "trash_bin"],
      entityKind: "produce",
      produceLotId: "produce_1",
      produceType: "apple",
      sourceId: "produce_1",
      sourceKind: "trash",
      trashProduceLotId: "trash_produce_lot_1",
    });
  });

  it("forwards bench-tool drops between stations", () => {
    const onBenchToolDrop = vi.fn();
    const dataTransfer = createDataTransfer();
    writeBenchToolDragPayload(dataTransfer, {
      allowedDropTargets: ["workbench_slot"],
      entityId: "bench_tool_1",
      entityKind: "tool",
      sourceId: "station_1",
      sourceKind: "workbench",
      sourceSlotId: "station_1",
      toolId: "beaker_rinse",
      toolType: "beaker",
    });
    syncTypes(dataTransfer);

    render(
      <PesticideWorkbenchPanel
        onBenchToolDrop={onBenchToolDrop}
        onLiquidVolumeChange={vi.fn()}
        onRemoveLiquid={vi.fn()}
        onToolbarItemDrop={vi.fn()}
        slots={slots}
        statusMessage="Ready."
      />,
    );

    const station = screen.getByTestId("bench-slot-station_2");
    const dragOverEvent = createEvent.dragOver(station, { dataTransfer });
    fireEvent(station, dragOverEvent);
    fireEvent.drop(station, { dataTransfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    expect(onBenchToolDrop).toHaveBeenCalledWith("station_2", {
      allowedDropTargets: ["workbench_slot"],
      entityId: "bench_tool_1",
      entityKind: "tool",
      sourceId: "station_1",
      sourceKind: "workbench",
      sourceSlotId: "station_1",
      toolId: "beaker_rinse",
      toolType: "beaker",
    });
  });

  it("forwards rack-tool drops onto stations", () => {
    const onBenchToolDrop = vi.fn();
    const dataTransfer = createDataTransfer();
    writeRackToolDragPayload(dataTransfer, {
      allowedDropTargets: ["workbench_slot"],
      entityId: "rack_tool_1",
      entityKind: "tool",
      rackSlotId: "rack_slot_1",
      sourceId: "rack_slot_1",
      sourceKind: "rack",
      toolId: "sample_vial_lcms",
      toolType: "sample_vial",
    });
    syncTypes(dataTransfer);

    render(
      <PesticideWorkbenchPanel
        onBenchToolDrop={onBenchToolDrop}
        onLiquidVolumeChange={vi.fn()}
        onRemoveLiquid={vi.fn()}
        onToolbarItemDrop={vi.fn()}
        slots={slots}
        statusMessage="Ready."
      />,
    );

    const station = screen.getByTestId("bench-slot-station_2");
    const dragOverEvent = createEvent.dragOver(station, { dataTransfer });
    fireEvent(station, dragOverEvent);
    fireEvent.drop(station, { dataTransfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    expect(onBenchToolDrop).toHaveBeenCalledWith("station_2", {
      allowedDropTargets: ["workbench_slot"],
      entityId: "rack_tool_1",
      entityKind: "tool",
      rackSlotId: "rack_slot_1",
      sourceId: "rack_slot_1",
      sourceKind: "rack",
      toolId: "sample_vial_lcms",
      toolType: "sample_vial",
    });
  });

  it("exposes any configured bench tool as draggable", () => {
    render(
      <PesticideWorkbenchPanel
        canDragBenchTool={() => true}
        onBenchToolDragStart={vi.fn()}
        onLiquidVolumeChange={vi.fn()}
        onRemoveLiquid={vi.fn()}
        onToolbarItemDrop={vi.fn()}
        slots={[
          {
            id: "station_1",
            label: "Station 1",
            tool: {
              id: "bench_tool_vial",
              toolId: "sample_vial_lcms",
              label: "Autosampler vial",
              subtitle: "Injection ready",
              accent: "sky",
              toolType: "sample_vial",
              capacity_ml: 2,
              liquids: [],
            },
          },
          {
            id: "station_2",
            label: "Station 2",
            tool: {
              id: "bench_tool_tube",
              toolId: "centrifuge_tube_50ml",
              label: "50 mL centrifuge tube",
              subtitle: "Extraction ready",
              accent: "amber",
              toolType: "centrifuge_tube",
              capacity_ml: 50,
              liquids: [
                {
                  id: "bench_liquid_2",
                  liquidId: "apple_extract",
                  name: "Apple extract",
                  volume_ml: 10,
                  accent: "rose",
                },
              ],
            },
          },
        ]}
        statusMessage="Ready."
      />,
    );

    expect(screen.getByTestId("bench-tool-card-bench_tool_vial")).toHaveAttribute(
      "draggable",
      "true",
    );
    expect(screen.getByTestId("bench-tool-card-bench_tool_tube")).toHaveAttribute(
      "draggable",
      "true",
    );
  });
});
