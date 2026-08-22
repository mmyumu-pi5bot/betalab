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
    isMassCheckAcknowledged: false,
    ...overrides,
  };
}

describe("LimsWidget", () => {
  it("shows declared, gross, packaging tare, and calculated received net masses separately", () => {
    render(
      <LimsWidget
        entries={[]}
        onAcknowledgeMassCheck={vi.fn()}
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

  it("records the review against the reception rather than the component", () => {
    // Holding the acknowledgement in component state made every page reload silently
    // un-review the calculation, and sent a mid-tutorial learner back to a button they
    // had already pressed.
    const onAcknowledgeMassCheck = vi.fn();
    render(
      <LimsWidget
        entries={[]}
        onAcknowledgeMassCheck={onAcknowledgeMassCheck}
        onPrintLabel={vi.fn()}
        onSaveReception={vi.fn()}
        reception={reception()}
      />,
    );

    const summary = screen.getByRole("button", { name: "Review reception mass calculation" });
    expect(summary).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Review")).toBeInTheDocument();

    fireEvent.click(summary);

    expect(onAcknowledgeMassCheck).toHaveBeenCalledWith(undefined);
  });

  it("shows the calculation as reviewed on a freshly mounted widget", () => {
    render(
      <LimsWidget
        entries={[]}
        onAcknowledgeMassCheck={vi.fn()}
        onPrintLabel={vi.fn()}
        onSaveReception={vi.fn()}
        reception={reception({ isMassCheckAcknowledged: true })}
      />,
    );

    const summary = screen.getByRole("button", { name: "Review reception mass calculation" });
    expect(summary).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Reviewed")).toBeInTheDocument();
  });

  it("names the entry it reviewed when browsing a saved record", () => {
    const onAcknowledgeMassCheck = vi.fn();
    const saved = reception({ id: "lims_1", labSampleCode: "S-2026-0001", status: "received" });
    render(
      <LimsWidget
        entries={[saved]}
        onAcknowledgeMassCheck={onAcknowledgeMassCheck}
        onPrintLabel={vi.fn()}
        onSaveReception={vi.fn()}
        reception={saved}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Review reception mass calculation" }));

    expect(onAcknowledgeMassCheck).toHaveBeenCalledWith("lims_1");
  });



});
