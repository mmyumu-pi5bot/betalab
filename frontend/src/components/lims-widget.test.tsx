import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LimsWidget } from "@/components/lims-widget";
import type { LimsReception } from "@/types/workbench";

function reception(overrides: Partial<LimsReception> = {}): LimsReception {
  return {
    id: null,
    orchardName: "",
    harvestDate: "",
    indicativeMassG: 0,
    measuredGrossMassG: 2536,
    packagingTareMassG: 36,
    grossMassOffsetG: 0,
    measuredSampleMassG: null,
    labSampleCode: null,
    status: "awaiting_reception",
    printedLabelTicket: null,
    ...overrides,
  };
}

describe("LimsWidget", () => {
  it("shows declared, gross, packaging tare, and calculated received net masses separately", () => {
    render(
      <LimsWidget
        entries={[]}
        onPrintLabel={vi.fn()}
        onSaveReception={vi.fn()}
        reception={reception()}
      />,
    );

    expect(screen.getByText("Declared mass")).toBeInTheDocument();
    expect(screen.getByText("Measured gross")).toBeInTheDocument();
    expect(screen.getByText("Packaging tare")).toBeInTheDocument();
    expect(screen.getByText("Measured net")).toBeInTheDocument();
    expect(screen.getByText("2536.0 g")).toBeInTheDocument();
    expect(screen.getByText("36.0 g")).toBeInTheDocument();
    expect(screen.getByText("2500.0 g")).toBeInTheDocument();
    expect(screen.getByText(/gross mass minus the known bag tare/i)).toBeInTheDocument();
  });

  it("lets the tutorial verify that the user reviewed the reception calculation", () => {
    render(
      <LimsWidget
        entries={[]}
        onPrintLabel={vi.fn()}
        onSaveReception={vi.fn()}
        reception={reception()}
      />,
    );

    const summary = screen.getByRole("button", { name: "Review reception mass calculation" });
    expect(summary).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(summary);

    expect(summary).toHaveAttribute("aria-pressed", "true");
  });
});
