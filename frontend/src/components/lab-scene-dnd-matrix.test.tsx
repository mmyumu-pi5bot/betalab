import { createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  if (sourceCase.availableTargets.includes("gross-balance-dropzone")) {
    await waitFor(() => {
      expect(screen.getByTestId("gross-balance-dropzone")).toBeInTheDocument();
    });
  } else {
    expect(screen.queryByTestId("gross-balance-dropzone")).not.toBeInTheDocument();
  }

  if (sourceCase.availableTargets.includes("analytical-balance-dropzone")) {
    await waitFor(() => {
      expect(screen.getByTestId("analytical-balance-dropzone")).toBeInTheDocument();
    });
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

describe("LabScene DnD matrix", () => {
  dndSourceCases.forEach((sourceCase) => {
    dndTargetCases.forEach((targetCase) => {
      const expectation = getExpectation(sourceCase, targetCase.id);

      it(`marks ${sourceCase.label} ${expectation?.compatible ? "compatible" : "incompatible"} with ${targetCase.label}`, async () => {
        await renderWorkbenchForSource(sourceCase);

        const dataTransfer = createDataTransfer();
        fireEvent.dragStart(screen.getByTestId(sourceCase.sourceTestId), { dataTransfer });

        const target = screen.queryByTestId(targetCase.id);
        if (target === null) {
          expect(expectation.compatible).toBe(false);
          return;
        }

        expect(target).toHaveAttribute(
          "data-drop-highlighted",
          expectation.compatible ? "true" : "false",
        );

        if (!targetCase.assertDragOver) {
          return;
        }

        const dragOverEvent = createEvent.dragOver(target, { dataTransfer });
        fireEvent(target, dragOverEvent);
        expect(dragOverEvent.defaultPrevented).toBe(expectation.compatible);
      });
    });
  });
});
