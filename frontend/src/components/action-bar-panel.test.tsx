import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ActionBarPanel } from "@/components/action-bar-panel";

describe("ActionBarPanel", () => {
  it("marks the pipette for remote debug inspection without embedding its state", () => {
    render(
      <ActionBarPanel
        activeActionId={null}
        onToggleAction={vi.fn()}
        pipette={{
          capacityMl: 1,
          volumeMl: 0.5,
          sourceToolId: "tube_1",
        }}
      />,
    );

    const button = screen.getByRole("button", { name: "Micropipette" });
    expect(button).toHaveAttribute("data-debug-kind", "pipette");
    expect(button).toHaveAttribute("data-debug-id", "pipette");
    expect(button).not.toHaveAttribute("data-debug-model");
  });
});
