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
  it("reads occupied rack positions, prefills roles and submits a ready sequence", () => {
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
    expect(within(rows[0]).getByDisplayValue("Calibration")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Position 4")).toBeInTheDocument();
    expect(within(rows[1]).getByDisplayValue("Sample")).toBeInTheDocument();

    const launchButton = screen.getByRole("button", { name: "Launch acquisition" });
    expect(launchButton).toBeEnabled();
    fireEvent.click(launchButton);

    expect(onRun).toHaveBeenCalledWith({
      method_id: "apple_pesticides_mrm_v1",
      injections: [
        expect.objectContaining({
          rack_slot_id: "rack_slot_2",
          sample_name: "Cal 10",
          sample_type: "calibration",
          calibration_level_ng_per_ml: 10,
        }),
        expect.objectContaining({
          rack_slot_id: "rack_slot_4",
          sample_name: "Apple A",
          sample_type: "sample",
          calibration_level_ng_per_ml: null,
        }),
      ],
    });
  });

  it("blocks launch until the step-one calibration/sample contract is valid", () => {
    render(
      <AcquisitionConsoleHarness
        onRun={vi.fn()}
        rackSlots={[rackSlot(1, "sample"), rackSlot(2, "sample")]}
      />,
    );

    expect(screen.getByText(/one calibration and one sample/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Launch acquisition" })).toBeDisabled();

    const firstRow = screen.getAllByTestId("acquisition-sequence-row")[0];
    fireEvent.change(within(firstRow).getByLabelText("Type"), {
      target: { value: "calibration" },
    });
    fireEvent.change(within(firstRow).getByLabelText("Calibration level (ng/mL)"), {
      target: { value: "25" },
    });

    expect(screen.getByText(/sequence ready/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Launch acquisition" })).toBeEnabled();
  });
});
