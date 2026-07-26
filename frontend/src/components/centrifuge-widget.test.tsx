import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CentrifugeWidget } from "@/components/centrifuge-widget";

describe("CentrifugeWidget", () => {
  it("shows the separated phases and starts a ready cycle", () => {
    const onStart = vi.fn();
    render(
      <CentrifugeWidget
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
    expect(screen.getByTestId("centrifuge-progress-bar")).toHaveStyle({ width: "65%" });
    fireEvent.click(screen.getByTestId("centrifuge-start-button"));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("cannot start without a tube", () => {
    render(
      <CentrifugeWidget
        isCommandPending={false}
        isDropHighlighted={false}
        isRunning={false}
        onDragOver={vi.fn()}
        onDrop={vi.fn()}
        onStart={vi.fn()}
        progressPercent={0}
        separationProgress={0}
      />,
    );

    expect(screen.getByTestId("centrifuge-start-button")).toBeDisabled();
    expect(screen.queryByTestId("centrifuge-visible-phases")).not.toBeInTheDocument();
  });
});
