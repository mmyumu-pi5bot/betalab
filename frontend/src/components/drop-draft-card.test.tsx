import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DropDraftCard } from "@/components/drop-draft-card";

describe("DropDraftCard", () => {
  it("places cancel beside the confirm action in the shared footer", () => {
    render(
      <DropDraftCard
        confirmLabel="Add"
        fields={[]}
        onCancel={vi.fn()}
        onChangeField={vi.fn()}
        onConfirm={vi.fn()}
        title="Configure liquid volume"
      />,
    );

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    const confirmButton = screen.getByRole("button", { name: "Add" });
    expect(cancelButton.parentElement).toBe(confirmButton.parentElement);
  });

  it("uses the shared temperature indicator for temperature fields", () => {
    render(
      <DropDraftCard
        fields={[
          {
            ariaLabel: "Temperature",
            id: "temperature_c",
            label: "Temperature",
            stepAmount: 5,
            unitLabel: "C",
            value: -20,
            visual: "temperature",
          },
        ]}
        onCancel={vi.fn()}
        onChangeField={vi.fn()}
        onConfirm={vi.fn()}
        title="Configure"
      />,
    );

    expect(screen.getByLabelText("Cooling fast • -20.0 C")).toBeInTheDocument();
    expect(screen.getByTestId("temperature-indicator-fill")).toBeInTheDocument();
  });
});
