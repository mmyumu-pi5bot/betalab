import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", async () => await import("@/test-support/api-mock"));

import {
  buildDefaultRunSequencePayload,
  LcMsMsAcquisitionConsole,
} from "@/components/lcmsms-acquisition-console";
import {
  duplicateAcquisitionMethod,
  getAcquisitionMethod,
  getAcquisitionMethodCatalog,
  resetApiMocks,
} from "@/test-support/api-mock";
import type { RunSequencePayload } from "@/types/api-payloads";
import type { RackSlot } from "@/types/workbench";

function rackSlot(
  index: number,
  kind: "calibration" | "sample",
): RackSlot {
  return {
    id: `rack_slot_${index}`,
    label: `Position ${index}`,
    tool: {
      id: `vial_${index}`,
      toolId: "sample_vial_lcms",
      label: kind === "calibration" ? "Calibration vial" : "Sample vial",
      subtitle: "2 mL",
      accent: "sky",
      toolType: "sample_vial",
      capacity_ml: 2,
      canReceiveLiquids: true,
      canReceiveProduce: false,
      canSeal: true,
      isDraggable: true,
      allowedDropTargets: [],
      liquids: [],
      fieldLabelText: kind === "calibration" ? "Cal 10" : "Apple A",
      calibrationContext:
        kind === "calibration"
          ? { levelNgPerMl: 10, compoundIds: ["boscalid"] }
          : null,
    },
  } as RackSlot;
}

function AcquisitionConsoleHarness({
  onRun,
  rackSlots,
}: {
  onRun: (payload: RunSequencePayload) => void;
  rackSlots: RackSlot[];
}) {
  const [sequence, setSequence] = useState(() => buildDefaultRunSequencePayload(rackSlots));
  return (
    <LcMsMsAcquisitionConsole
      isCommandPending={false}
      onRun={() => onRun(sequence)}
      onSequenceChange={setSequence}
      sequence={sequence}
    />
  );
}

describe("LcMsMsAcquisitionConsole", () => {
  beforeEach(() => {
    resetApiMocks();
  });

  it("reads occupied rack positions and submits a ready sequence", () => {
    const onRun = vi.fn();
    render(
      <AcquisitionConsoleHarness
        onRun={onRun}
        rackSlots={[rackSlot(4, "sample"), rackSlot(2, "calibration")]}
      />,
    );

    const rows = screen.getAllByTestId("acquisition-sequence-row");
    expect(within(rows[0]).getByText("Position 2")).toBeInTheDocument();
    expect(within(rows[0]).getByDisplayValue("Cal 10")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Position 4")).toBeInTheDocument();
    expect(within(rows[1]).getByDisplayValue("Apple A")).toBeInTheDocument();

    const launchButton = screen.getByRole("button", { name: "Launch acquisition" });
    expect(launchButton).toBeEnabled();
    fireEvent.click(launchButton);

    expect(onRun).toHaveBeenCalledWith({
      method_id: "apple_pesticides_mrm_v1",
      injections: [
        expect.objectContaining({
          rack_slot_id: "rack_slot_2",
          sample_name: "Cal 10",
        }),
        expect.objectContaining({
          rack_slot_id: "rack_slot_4",
          sample_name: "Apple A",
        }),
      ],
    });
  });

  it("never asks how a vial will be used analytically", () => {
    render(
      <AcquisitionConsoleHarness
        onRun={vi.fn()}
        rackSlots={[rackSlot(1, "calibration"), rackSlot(2, "sample")]}
      />,
    );

    expect(screen.queryByLabelText("Type")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Calibration level (ng/mL)")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("acquisition-sequence-row")[0]).not.toHaveTextContent(
      /calibration level/i,
    );
  });

  it.each([
    ["a single vial", [rackSlot(1, "sample")]],
    ["several samples", [rackSlot(1, "sample"), rackSlot(2, "sample"), rackSlot(3, "sample")]],
    [
      "two calibrants and one sample",
      [rackSlot(1, "calibration"), rackSlot(2, "calibration"), rackSlot(3, "sample")],
    ],
  ])("accepts a sequence made of %s", (_label, rackSlots) => {
    render(<AcquisitionConsoleHarness onRun={vi.fn()} rackSlots={rackSlots} />);

    expect(screen.getAllByTestId("acquisition-sequence-row")).toHaveLength(rackSlots.length);
    expect(screen.getByText(/sequence ready/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Launch acquisition" })).toBeEnabled();
  });

  it("blocks launch when the rack holds no vial", () => {
    render(<AcquisitionConsoleHarness onRun={vi.fn()} rackSlots={[]} />);

    expect(screen.getByText(/at least one vial/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Launch acquisition" })).toBeDisabled();
  });

  it("blocks launch on an empty sample name and recovers when it is filled", () => {
    render(
      <AcquisitionConsoleHarness
        onRun={vi.fn()}
        rackSlots={[rackSlot(1, "sample"), rackSlot(2, "sample")]}
      />,
    );

    const firstRow = screen.getAllByTestId("acquisition-sequence-row")[0];
    fireEvent.change(within(firstRow).getByLabelText("Sample name"), {
      target: { value: "  " },
    });
    expect(screen.getByText(/needs a sample name/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Launch acquisition" })).toBeDisabled();

    fireEvent.change(within(firstRow).getByLabelText("Sample name"), {
      target: { value: "Apple B" },
    });
    expect(screen.getByText(/sequence ready/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Launch acquisition" })).toBeEnabled();
  });

  it("loads the selected method from the API and renders its viewer", async () => {
    render(<AcquisitionConsoleHarness onRun={vi.fn()} rackSlots={[rackSlot(1, "sample")]} />);

    expect(getAcquisitionMethodCatalog).toHaveBeenCalled();
    expect(getAcquisitionMethod).toHaveBeenCalledWith("apple_pesticides_mrm_v1");

    const viewer = await screen.findByRole("region", { name: "Acquisition method details" });
    expect(within(viewer).getByTestId("method-runtime")).toHaveTextContent("12:00");
    expect(within(viewer).getByTestId("method-transition-count")).toHaveTextContent("3");
    expect(within(viewer).getAllByTestId("method-transition-row")).toHaveLength(3);
    expect(within(viewer).getByTestId("method-glossary")).toHaveTextContent(/precursor/i);
  });

  it("offers the catalog methods and keeps the choice on the sequence", async () => {
    const onRun = vi.fn();
    getAcquisitionMethodCatalog.mockResolvedValue([
      {
        id: "apple_pesticides_mrm_v1",
        name: "Apple pesticides — MRM",
        version: "1.0.0",
        runtimeS: 720,
        isEducational: true,
        provenanceNote: "Educational method.",
        isBuiltIn: true,
        compoundCount: 2,
        transitionCount: 3,
      },
      {
        id: "apple_pesticides_mrm_v2",
        name: "Apple pesticides — MRM",
        version: "2.0.0",
        runtimeS: 900,
        isEducational: true,
        provenanceNote: "Educational method.",
        isBuiltIn: false,
        compoundCount: 3,
        transitionCount: 6,
      },
    ]);
    render(<AcquisitionConsoleHarness onRun={onRun} rackSlots={[rackSlot(1, "sample")]} />);

    const selector = await screen.findByLabelText("Acquisition method");
    await waitFor(() =>
      expect(within(selector).getAllByRole("option")).toHaveLength(2),
    );
    fireEvent.change(selector, { target: { value: "apple_pesticides_mrm_v2" } });

    await waitFor(() =>
      expect(getAcquisitionMethod).toHaveBeenCalledWith("apple_pesticides_mrm_v2"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Launch acquisition" }));
    expect(onRun).toHaveBeenCalledWith(
      expect.objectContaining({ method_id: "apple_pesticides_mrm_v2" }),
    );
  });

  it("selects the method independently of the vials in the rack", async () => {
    const onRun = vi.fn();
    const { rerender } = render(
      <AcquisitionConsoleHarness onRun={onRun} rackSlots={[rackSlot(1, "calibration")]} />,
    );
    await screen.findByRole("region", { name: "Acquisition method details" });

    // A rack holding only calibrants and a rack holding only samples must ask
    // for the very same method.
    rerender(<AcquisitionConsoleHarness onRun={onRun} rackSlots={[rackSlot(1, "sample")]} />);

    expect(getAcquisitionMethod).toHaveBeenCalledWith("apple_pesticides_mrm_v1");
    expect(
      getAcquisitionMethod.mock.calls.every(([methodId]) => methodId === "apple_pesticides_mrm_v1"),
    ).toBe(true);
  });

  it("surfaces a method that cannot be loaded without blocking the sequence", async () => {
    getAcquisitionMethod.mockRejectedValue(new Error("Method service unavailable"));
    render(<AcquisitionConsoleHarness onRun={vi.fn()} rackSlots={[rackSlot(1, "sample")]} />);

    expect(await screen.findByText("Method service unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Launch acquisition" })).toBeEnabled();
  });

  it("duplicating a method selects the copy for the sequence", async () => {
    const onRun = vi.fn();
    render(<AcquisitionConsoleHarness onRun={onRun} rackSlots={[rackSlot(1, "sample")]} />);

    fireEvent.click(await screen.findByRole("button", { name: "Duplicate method" }));

    await waitFor(() =>
      expect(duplicateAcquisitionMethod).toHaveBeenCalledWith(
        expect.objectContaining({ sourceMethodId: "apple_pesticides_mrm_v1" }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Launch acquisition" }));
    expect(onRun).toHaveBeenCalledWith(
      expect.objectContaining({ method_id: "apple_pesticides_mrm_v1_copy" }),
    );
  });

  it("blocks launch on duplicated output filenames", () => {
    render(
      <AcquisitionConsoleHarness
        onRun={vi.fn()}
        rackSlots={[rackSlot(1, "sample"), rackSlot(2, "sample")]}
      />,
    );

    const firstRow = screen.getAllByTestId("acquisition-sequence-row")[0];
    fireEvent.change(within(firstRow).getByLabelText("Output filename"), {
      target: { value: "02_apple_a.mzML" },
    });

    expect(screen.getByText(/filenames must be unique/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Launch acquisition" })).toBeDisabled();
  });
});
