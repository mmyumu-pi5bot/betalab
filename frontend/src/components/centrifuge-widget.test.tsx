import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CentrifugeWidget } from "@/components/centrifuge-widget";

describe("CentrifugeWidget", () => {
  it("shows the separated phases and starts a ready cycle", () => {
    const onStart = vi.fn();
    render(
      <CentrifugeWidget
        canStart
        isCommandPending={false}
        isDropHighlighted
        isRunning={false}
        onDragOver={vi.fn()}
        onDrop={vi.fn()}
        onStart={onStart}
        progressPercent={65}
        separationProgress={0.65}
        stagedContent={<div>50 mL tube</div>}
      />,
    );

    expect(screen.getByTestId("centrifuge-visible-phases")).toBeInTheDocument();
    const progressBar = screen.getByTestId("centrifuge-progress-bar");
    expect(progressBar).toHaveStyle({ width: "65%" });
    // The tutorial highlights the track, which keeps its box at 0%.
    expect(progressBar.parentElement).toHaveAttribute(
      "data-tutorial-anchor",
      "centrifuge-progress-bar",
    );
    const illustration = screen.getByTestId("centrifuge-illustration");
    const powerButton = within(illustration).getByTestId("centrifuge-start-button");
    fireEvent.click(powerButton);
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("shows the backend block reason when the tube is not physically ready", () => {
    render(
      <CentrifugeWidget
        canStart={false}
        isCommandPending={false}
        isDropHighlighted={false}
        isRunning={false}
        onDragOver={vi.fn()}
        onDrop={vi.fn()}
        onStart={vi.fn()}
        progressPercent={0}
        separationProgress={0}
        startBlockReason="Add a tube to centrifuge."
      />,
    );

    expect(screen.getByTestId("centrifuge-start-button")).toBeDisabled();
    expect(screen.queryByTestId("centrifuge-visible-phases")).not.toBeInTheDocument();
    expect(screen.getByText("Add a tube to centrifuge.")).toBeInTheDocument();
  });
});
