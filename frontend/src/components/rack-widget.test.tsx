import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RackWidget } from "@/components/rack-widget";
import { getRackIllustrationSlotPosition } from "@/lib/lab-scene-config";

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
