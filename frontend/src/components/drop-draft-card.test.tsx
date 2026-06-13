import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DropDraftCard } from "@/components/drop-draft-card";

describe("DropDraftCard", () => {
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
