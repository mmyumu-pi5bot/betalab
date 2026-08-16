import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { VortexWidget } from "@/components/vortex-widget";

describe("VortexWidget", () => {
  it("anchors the tutorial on the progress track, not on the bar filling it", () => {
    render(
      <VortexWidget
        isCommandPending={false}
        isDropHighlighted={false}
        isRunning
        onDragOver={vi.fn()}
        onDrop={vi.fn()}
        onStart={vi.fn()}
        progressPercent={0}
        stagedContent={<div>50 mL tube</div>}
      />,
    );

    const progressBar = screen.getByTestId("vortex-progress-bar");
    expect(progressBar).toHaveStyle({ width: "0%" });
    // At 0% the bar has no box to highlight; the track keeps its own.
    expect(progressBar.parentElement).toHaveAttribute(
      "data-tutorial-anchor",
      "vortex-progress-bar",
    );
  });
});
