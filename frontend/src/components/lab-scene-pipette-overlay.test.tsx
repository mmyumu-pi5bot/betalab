import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PipetteOverlay } from "@/components/lab-scene-pipette-overlay";
import { resetPointerPositionTracking } from "@/lib/pointer-position";
import type { PipetteState } from "@/types/workbench";

const pipette: PipetteState = {
  capacityMl: 1,
  volumeMl: 0.5,
} as PipetteState;

function movePointerTo(x: number, y: number) {
  fireEvent(
    window,
    new MouseEvent("pointermove", { bubbles: true, clientX: x, clientY: y }),
  );
}

describe("PipetteOverlay", () => {
  afterEach(() => {
    resetPointerPositionTracking();
  });

  it("appears where the cursor already is when picked from the keyboard", () => {
    // Mounted but idle, the overlay is still tracking the pointer.
    const { rerender } = render(
      <PipetteOverlay hint={null} isPipetteMode={false} pipette={pipette} />,
    );
    movePointerTo(300, 200);

    // A keyboard shortcut turns the mode on without sending any pointer event.
    rerender(<PipetteOverlay hint={null} isPipetteMode pipette={pipette} />);

    const overlay = screen.getByLabelText("Pipette loaded");
    expect(overlay.style.opacity).toBe("1");
    expect(overlay.style.transform).toBe("translate3d(308px, 160px, 0)");
  });

  it("stays hidden while the pointer has never been seen", () => {
    render(<PipetteOverlay hint={null} isPipetteMode pipette={pipette} />);

    const overlay = screen.getByLabelText("Pipette loaded");
    expect(overlay.style.opacity).toBe("");
  });

  it("keeps following the pointer once it moves", () => {
    render(<PipetteOverlay hint={null} isPipetteMode pipette={pipette} />);

    movePointerTo(120, 90);

    // The move handler paints on the next frame.
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        const overlay = screen.getByLabelText("Pipette loaded");
        expect(overlay.style.transform).toBe("translate3d(128px, 50px, 0)");
        resolve();
      });
    });
  });
});
