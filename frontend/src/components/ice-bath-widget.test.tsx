import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { IceBathWidget } from "@/components/ice-bath-widget";

describe("IceBathWidget", () => {
  it("shows an empty tray and invites a tube", () => {
    render(
      <IceBathWidget isDropHighlighted={false} onDragOver={vi.fn()} onDrop={vi.fn()} />,
    );

    expect(screen.queryByTestId("ice-bath-illustration-tube")).not.toBeInTheDocument();
    expect(screen.getByTestId("ice-bath-hint")).toHaveTextContent(/Stand a tube here/);
  });

  it("stands the tube in the ice once one is dropped in", () => {
    render(
      <IceBathWidget
        isDropHighlighted={false}
        onDragOver={vi.fn()}
        onDrop={vi.fn()}
        stagedContent={<div>50 mL tube</div>}
      />,
    );

    expect(screen.getByTestId("ice-bath-illustration-tube")).toBeInTheDocument();
    expect(screen.getByText("50 mL tube")).toBeInTheDocument();
    expect(screen.getByTestId("ice-bath-hint")).toHaveTextContent(/Chilling/);
  });

  it("marks the dropzone when a compatible tube is being dragged", () => {
    render(<IceBathWidget isDropHighlighted onDragOver={vi.fn()} onDrop={vi.fn()} />);

    expect(screen.getByTestId("ice-bath-dropzone")).toHaveAttribute(
      "data-drop-highlighted",
      "true",
    );
  });
});
