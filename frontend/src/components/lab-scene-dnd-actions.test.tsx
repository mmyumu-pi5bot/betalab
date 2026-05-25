import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LabScene } from "@/components/lab-scene";
import {
  createDataTransfer,
  dndSourceCases,
  dndTargetCases,
  type DndTargetId,
} from "@/test-support/lab-scene-dnd-test-helpers";

vi.mock("@/lib/api", async () => await import("@/test-support/api-mock"));

import { createExperiment, sendExperimentCommand } from "@/test-support/api-mock";

async function renderWorkbenchForSource(sourceCase: (typeof dndSourceCases)[number]) {
  vi.stubEnv("NEXT_PUBLIC_ENABLE_DEBUG_INVENTORY", "true");
  const experiment = sourceCase.buildExperiment();
  vi.mocked(createExperiment).mockResolvedValue(experiment);
  vi.mocked(sendExperimentCommand).mockResolvedValue(experiment);

  render(<LabScene />);

  await waitFor(() => {
    expect(screen.getByTestId("widget-workspace")).toBeInTheDocument();
    expect(screen.getByTestId("bench-slot-station_1")).toBeInTheDocument();
    expect(screen.getByTestId("bench-slot-station_2")).toBeInTheDocument();
    expect(screen.getByTestId("trash-dropzone")).toBeInTheDocument();
  });

  if (sourceCase.availableTargets.includes("grinder-dropzone")) {
    await waitFor(() => {
      expect(screen.getByTestId("grinder-dropzone")).toBeInTheDocument();
    });
  } else {
    expect(screen.queryByTestId("grinder-dropzone")).not.toBeInTheDocument();
  }

  if (sourceCase.expectRackWidget) {
    await waitFor(() => {
      expect(screen.getByTestId("widget-rack")).toBeInTheDocument();
      expect(screen.getByTestId("rack-illustration-slot-1")).toBeInTheDocument();
    });
  } else {
    expect(screen.queryByTestId("widget-rack")).not.toBeInTheDocument();
    expect(screen.queryByTestId("rack-illustration-slot-1")).not.toBeInTheDocument();
  }

  if (sourceCase.openTrash) {
    fireEvent.click(screen.getByTestId("trash-dropzone"));
    await waitFor(() => {
      expect(screen.getByTestId(sourceCase.sourceTestId)).toBeInTheDocument();
    });
  }

  if (sourceCase.openBasket) {
    fireEvent.click(screen.getByTestId("basket-open-button"));
    await waitFor(() => {
      expect(screen.getByTestId(sourceCase.sourceTestId)).toBeInTheDocument();
    });
  }
}

function getExpectation(
  sourceCase: (typeof dndSourceCases)[number],
  targetId: DndTargetId,
) {
  return sourceCase.targetExpectations[targetId] ?? { compatible: false, command: null };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("LabScene DnD actions", () => {
  it("routes palette workspace widget dropped on the workspace inner surface to add_workspace_widget", async () => {
    const sourceCase = dndSourceCases.find((entry) => entry.id === "palette-autosampler_rack_widget");
    expect(sourceCase).toBeDefined();
    await renderWorkbenchForSource(sourceCase!);

    const dataTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId(sourceCase!.sourceTestId), { dataTransfer });
    fireEvent.drop(screen.getByTestId("workspace-drop-surface-grid"), {
      clientX: 980,
      clientY: 420,
      dataTransfer,
    });

    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "add_workspace_widget",
      expect.objectContaining({ widget_id: "rack" }),
    );
  });

  dndSourceCases.forEach((sourceCase) => {
    dndTargetCases.forEach((targetCase) => {
      const expectation = getExpectation(sourceCase, targetCase.id);

      it(`routes ${sourceCase.label} -> ${targetCase.label} to ${
        expectation?.command?.type ?? "no backend command"
      }`, async () => {
        await renderWorkbenchForSource(sourceCase);

        const dataTransfer = createDataTransfer();
        fireEvent.dragStart(screen.getByTestId(sourceCase.sourceTestId), { dataTransfer });

        const target = screen.queryByTestId(targetCase.id);
        if (target === null) {
          expect(expectation.compatible).toBe(false);
          expect(sendExperimentCommand).not.toHaveBeenCalled();
          return;
        }

        const dropPayload =
          targetCase.id === "widget-workspace"
            ? { clientX: 980, clientY: 420, dataTransfer }
            : { dataTransfer };

        fireEvent.drop(target, dropPayload);

        if (!expectation?.command) {
          expect(sendExperimentCommand).not.toHaveBeenCalled();
          return;
        }

        expect(sendExperimentCommand).toHaveBeenCalledWith(
          "experiment_pesticides",
          expectation.command.type,
          expectation.command.payload,
        );
      });
    });
  });
});
