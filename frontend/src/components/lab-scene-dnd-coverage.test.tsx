import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LabScene } from "@/components/lab-scene";
import {
  buildDndCoverageExperiment,
  dndSourceCases,
  dndTargetCases,
  type DndCoverageScenario,
} from "@/test-support/lab-scene-dnd-test-helpers";

vi.mock("@/lib/api", async () => await import("@/test-support/api-mock"));

import { createExperiment, sendExperimentCommand } from "@/test-support/api-mock";

function normalizeDragSourceTestId(testId: string): string {
  if (testId.startsWith("toolbar-item-")) {
    return "toolbar-item";
  }
  if (testId.startsWith("debug-palette-preset-")) {
    return "debug-palette-preset";
  }
  if (testId.startsWith("bench-tool-card-balance-")) {
    return "gross-balance-tool";
  }
  if (testId.startsWith("bench-tool-card-")) {
    return "workbench-tool";
  }
  if (testId.startsWith("sample-label-card-")) {
    return "workbench-sample-label";
  }
  if (testId.startsWith("bench-produce-lot-")) {
    return "workbench-produce-lot";
  }
  if (testId.startsWith("bench-surface-produce-lot-")) {
    return "workbench-surface-produce-lot";
  }
  if (testId.startsWith("autosampler-rack-drag-edge-")) {
    return "autosampler-rack";
  }
  if (testId.startsWith("rack-illustration-slot-")) {
    return "rack-tool";
  }
  if (testId.startsWith("rack-slot-summary-")) {
    return "rack-tool";
  }
  if (testId.startsWith("rack-slot-tool-")) {
    return "rack-tool";
  }
  if (testId.startsWith("trash-tool-")) {
    return "trash-tool";
  }
  if (testId.startsWith("trash-produce-lot-")) {
    return "trash-produce-lot";
  }
  if (testId.startsWith("trash-sample-label-")) {
    return "trash-sample-label";
  }
  if (testId.startsWith("trash-widget-")) {
    return "trash-widget";
  }
  if (testId.startsWith("gross-balance-produce-")) {
    return "gross-balance-produce";
  }
  if (testId.startsWith("basket-produce-")) {
    return "basket-produce";
  }
  if (testId === "basket-received-bag") {
    return "basket-received-bag";
  }
  if (testId.startsWith("grinder-produce-")) {
    return "grinder-produce";
  }
  if (testId === "gross-balance-staged-item") {
    return "gross-balance-produce";
  }
  if (testId.startsWith("grinder-liquid-")) {
    return "grinder-liquid";
  }
  // One printed ticket, two places to grab it: the card and the printer it sticks out
  // of. Same entity, same allowed targets — one family in the matrix.
  if (testId.startsWith("lims-printed-ticket")) {
    return "lims-printed-ticket";
  }
  return testId;
}

const knownDragSourceFamilies = new Set(
  dndSourceCases.map((sourceCase) => normalizeDragSourceTestId(sourceCase.sourceTestId)),
);

function normalizeDropTargetTestId(testId: string): string {
  if (testId.startsWith("bench-slot-")) {
    return "bench-slot";
  }
  if (testId.startsWith("rack-illustration-slot-")) {
    return "rack-illustration-slot";
  }
  return testId;
}

const knownDropTargetFamilies = new Set(
  dndTargetCases.map((targetCase) => normalizeDropTargetTestId(targetCase.id)),
);

async function renderCoverageScenario(scenario: DndCoverageScenario) {
  vi.stubEnv("NEXT_PUBLIC_ENABLE_DEBUG_INVENTORY", "true");
  const experiment = buildDndCoverageExperiment(scenario);
  vi.mocked(createExperiment).mockResolvedValue(experiment);
  vi.mocked(sendExperimentCommand).mockResolvedValue(experiment);

  const view = render(<LabScene />);

  await waitFor(() => {
    expect(screen.getByTestId("widget-workspace")).toBeInTheDocument();
    expect(screen.getByTestId("widget-debug-inventory")).toBeInTheDocument();
    expect(screen.getByTestId("trash-dropzone")).toBeInTheDocument();
  });

  fireEvent.click(screen.getByTestId("trash-dropzone"));
  fireEvent.click(screen.getByTestId("basket-open-button"));

  await waitFor(() => {
    expect(screen.getByTestId("trash-dialog-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("basket-dialog-overlay")).toBeInTheDocument();
  });

  return view;
}

describe("LabScene DnD coverage guards", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it.each([
    "inventory",
    "surface-and-balance-produce",
  ] satisfies DndCoverageScenario[])(
    "keeps rendered draggable component families registered in the DnD matrix for %s",
    async (scenario) => {
      const { container } = await renderCoverageScenario(scenario);
      const renderedDraggableFamilies = Array.from(
        container.querySelectorAll<HTMLElement>("[data-testid][draggable='true']"),
      ).map((element) => normalizeDragSourceTestId(element.dataset.testid ?? ""));
      const unknownFamilies = renderedDraggableFamilies.filter(
        (family) => family.length > 0 && !knownDragSourceFamilies.has(family),
      );

      expect(new Set(unknownFamilies)).toEqual(new Set());
    },
  );

  it("keeps rendered drop targets registered in the DnD matrix", async () => {
    const { container } = await renderCoverageScenario("inventory");
    const renderedTargetFamilies = Array.from(
      container.querySelectorAll<HTMLElement>("[data-testid][data-drop-highlighted]"),
    ).map((element) => normalizeDropTargetTestId(element.dataset.testid ?? ""));
    const unknownTargetFamilies = renderedTargetFamilies.filter(
      (family) => family.length > 0 && !knownDropTargetFamilies.has(family),
    );

    expect(new Set(unknownTargetFamilies)).toEqual(new Set());
  });
});
