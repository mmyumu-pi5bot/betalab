import { createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RackWidget } from "@/components/rack-widget";
import { getRackIllustrationSlotPosition } from "@/lib/lab-scene-config";
import type { BenchToolInstance, RackSlot } from "@/types/workbench";

const rackGrabEdgeTestIds = [
  "autosampler-rack-drag-edge-top",
  "autosampler-rack-drag-edge-bottom",
  "autosampler-rack-drag-edge-left",
  "autosampler-rack-drag-edge-right",
] as const;

function renderRackWidget(overrides: Partial<Parameters<typeof RackWidget>[0]> = {}) {
  const onRackDragStart = vi.fn();

  render(
    <RackWidget
      getSlotPosition={getRackIllustrationSlotPosition}
      isCommandPending={false}
      isLoadedIntoInstrument={false}
      isSlotHighlighted={() => false}
      loadedCount={0}
      occupiedSlotLiquids={{}}
      occupiedSlots={[]}
      openSlots={[]}
      onItemDragEnd={vi.fn()}
      onRackDragStart={onRackDragStart}
      onRackSlotDragOver={vi.fn()}
      onRackSlotDrop={vi.fn()}
      onRackToolDragStart={vi.fn()}
      rackSlots={[]}
      slotCount={12}
      {...overrides}
    />,
  );

  return { onRackDragStart };
}

describe("RackWidget rack drag", () => {
  it("drags the rack from any of its contours instead of a separate handle", () => {
    const { onRackDragStart } = renderRackWidget();

    expect(screen.queryByTestId("autosampler-rack-drag-handle")).not.toBeInTheDocument();

    rackGrabEdgeTestIds.forEach((testId, index) => {
      const edge = screen.getByTestId(testId);
      expect(edge).toHaveAttribute("draggable", "true");

      fireEvent.dragStart(edge, { dataTransfer: { setData: vi.fn(), types: [] } });
      expect(onRackDragStart).toHaveBeenCalledTimes(index + 1);
    });
  });

  it("drags the whole rack as the drag image, not the grabbed band", () => {
    renderRackWidget();

    const setDragImage = vi.fn();
    const edge = screen.getByTestId("autosampler-rack-drag-edge-left");
    const dragStartEvent = createEvent.dragStart(edge, {
      dataTransfer: { setData: vi.fn(), setDragImage, types: [] },
    });
    // jsdom drag events carry no pointer coordinates on their own.
    Object.defineProperty(dragStartEvent, "clientX", { value: 12 });
    Object.defineProperty(dragStartEvent, "clientY", { value: 30 });
    fireEvent(edge, dragStartEvent);

    const rackIllustration = screen.getByTestId("autosampler-rack-illustration").parentElement;
    expect(setDragImage).toHaveBeenCalledWith(rackIllustration, 12, 30);
  });

  it("keeps the contours clear of the slot drop zones", () => {
    renderRackWidget();

    const topEdge = screen.getByTestId("autosampler-rack-drag-edge-top");
    const leftEdge = screen.getByTestId("autosampler-rack-drag-edge-left");
    const firstSlot = getRackIllustrationSlotPosition(0);

    // The bands reach the first slot centre, then back off by 22 px: half a 36 px
    // slot drop zone plus a gap, so the two never overlap at any widget width.
    expect(topEdge.style.height).toMatch(/^calc\(([\d.]+)% - 22px\)$/);
    expect(leftEdge.style.width).toMatch(/^calc\(([\d.]+)% - 22px\)$/);
    expect(Number(topEdge.style.height.match(/[\d.]+/)?.[0])).toBeCloseTo(
      Number.parseFloat(firstSlot.top),
      3,
    );
    expect(Number(leftEdge.style.width.match(/[\d.]+/)?.[0])).toBeCloseTo(
      Number.parseFloat(firstSlot.left),
      3,
    );
  });

  it("stops offering the rack for drag while it sits in the instrument", () => {
    const { onRackDragStart } = renderRackWidget({
      dndDisabled: true,
      isLoadedIntoInstrument: true,
      loadedCount: 1,
    });

    rackGrabEdgeTestIds.forEach((testId) => {
      const edge = screen.getByTestId(testId);
      expect(edge).toHaveAttribute("draggable", "false");
      fireEvent.dragStart(edge, { dataTransfer: { setData: vi.fn(), types: [] } });
    });

    expect(onRackDragStart).not.toHaveBeenCalled();
    expect(screen.getByTestId("rack-load-status")).toHaveTextContent("Rack loaded in LC-MS/MS");
  });
});

function makeVial(overrides: Partial<BenchToolInstance> = {}): BenchToolInstance {
  return {
    id: "vial_1",
    toolId: "sample_vial_lcms",
    label: "Autosampler vial",
    subtitle: "Injection ready",
    accent: "sky",
    toolType: "sample_vial",
    capacity_ml: 2,
    canReceiveContents: true,
    canReceiveLiquids: true,
    canReceiveProduce: false,
    canSeal: true,
    isDraggable: true,
    isSealed: true,
    allowedDropTargets: ["rack_slot"],
    liquids: [
      {
        id: "extract_1",
        liquidId: "acetonitrile",
        name: "Extract",
        volume_ml: 1,
        accent: "amber",
      },
    ],
    ...overrides,
  };
}

function makeRackSlot(slotIndex: number, tool: BenchToolInstance | null): RackSlot {
  return {
    id: `slot_${slotIndex + 1}`,
    label: `P${slotIndex + 1}`,
    tool,
  };
}

describe("RackWidget slot cards", () => {
  it("reads the calibration level off a racked vial without unracking it", () => {
    const calibrationVial = makeVial({
      id: "cal_vial_1",
      toolId: "calibration_standard_vial",
      label: "Calibration standard vial",
      accent: "rose",
      calibrationContext: { levelNgPerMl: 10, compoundIds: ["chlorpyrifos"] },
    });

    renderRackWidget({
      loadedCount: 1,
      rackSlots: [makeRackSlot(0, calibrationVial)],
    });

    const card = screen.getByTestId("rack-slot-summary-1");
    expect(within(card).getByText("Calibration standard vial")).toBeInTheDocument();
    expect(within(card).getByTestId("rack-slot-detail-1")).toHaveTextContent("10 ng/mL");
    expect(within(card).getByTestId("rack-slot-tool-1")).toHaveTextContent("1.00 mL");
  });

  it("shows a tiny vial icon on every slot card and no temperature readout", () => {
    renderRackWidget({
      loadedCount: 1,
      rackSlots: [makeRackSlot(0, makeVial())],
    });

    const card = screen.getByTestId("rack-slot-summary-1");
    expect(within(card).getByTestId("rack-slot-icon-1")).toBeInTheDocument();
    expect(within(card).queryByTestId("temperature-indicator-fill")).not.toBeInTheDocument();
  });

  it("falls back to the written label when the vial carries no calibration level", () => {
    const labelledVial = makeVial({
      labels: [
        {
          id: "label_1",
          labelKind: "lims",
          text: "S-2026-0142",
          sampleCode: "S-2026-0142",
        },
      ],
    });

    renderRackWidget({
      loadedCount: 1,
      rackSlots: [makeRackSlot(0, labelledVial)],
    });

    expect(screen.getByTestId("rack-slot-detail-1")).toHaveTextContent("S-2026-0142");
  });
});

describe("RackWidget vial capping", () => {
  it("caps and uncaps a vial from its slot card", () => {
    const onToggleVialSeal = vi.fn();
    const openVial = makeVial({ isSealed: false });

    renderRackWidget({
      loadedCount: 1,
      onToggleVialSeal,
      rackSlots: [makeRackSlot(0, openVial)],
    });

    const capButton = screen.getByRole("button", { name: "Close Autosampler vial" });
    fireEvent.click(capButton);

    expect(onToggleVialSeal).toHaveBeenCalledWith(
      expect.objectContaining({ id: "slot_1" }),
      expect.objectContaining({ id: "vial_1" }),
    );
  });

  it("offers to open a vial that is already capped", () => {
    renderRackWidget({
      loadedCount: 1,
      onToggleVialSeal: vi.fn(),
      rackSlots: [makeRackSlot(0, makeVial({ isSealed: true }))],
    });

    expect(screen.getByRole("button", { name: "Open Autosampler vial" })).toBeInTheDocument();
  });

  it("keeps the caps out of reach while the rack sits in the instrument", () => {
    renderRackWidget({
      dndDisabled: true,
      isLoadedIntoInstrument: true,
      loadedCount: 1,
      onToggleVialSeal: vi.fn(),
      rackSlots: [makeRackSlot(0, makeVial({ isSealed: true }))],
    });

    expect(screen.getByRole("button", { name: "Open Autosampler vial" })).toBeDisabled();
  });
});
