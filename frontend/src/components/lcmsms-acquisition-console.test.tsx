import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  buildDefaultRunSequencePayload,
  LcMsMsAcquisitionConsole,
} from "@/components/lcmsms-acquisition-console";
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
  it("reads occupied rack positions and submits a ready sequence", () => {
    const onRun = vi.fn();
    render(
      <AcquisitionConsoleHarness
        onRun={onRun}
        rackSlots={[rackSlot(4, "sample"), rackSlot(2, "calibration")]}
      />,
    );

    expect(screen.getByDisplayValue("apple_pesticides_mrm_v1")).toBeDisabled();
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
