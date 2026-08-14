import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TutorialCoach } from "@/components/tutorial-coach";
import {
  calibrationSampleTutorial,
  evaluateTutorial,
} from "@/lib/tutorial-engine";
import type { Experiment } from "@/types/experiment";

function emptyExperiment(): Experiment {
  return {
    id: "experiment_1",
    status: "preparing",
    last_simulation_at: "2026-08-10T08:00:00Z",
    snapshot_version: 1,
    workbench: { slots: [] },
    rack: { allowedDropTargets: [], isDraggable: true, state: "available", slots: [] },
    trash: { children: [], discardedFrom: {}, produceLots: [], sampleLabels: [] },
    workspace: { produceBasketLots: [], widgets: [] },
    limsReception: {
      id: null,
      orchardName: "",
      harvestDate: "",
      indicativeMassG: 0,
      measuredGrossMassG: null,
      grossMassOffsetG: 0,
      measuredSampleMassG: null,
      labSampleCode: null,
      status: "awaiting_reception",
      printedLabelTicket: null,
    },
    limsEntries: [],
    basketTools: [],
    produceMaterialStates: [],
    spatula: { isLoaded: false, sourceToolId: null },
    pipette: { capacityMl: 1, volumeMl: 0, sourceToolId: null },
    analyticalBalance: { tareMassG: null, taredToolId: null },
    audit_log: [],
  };
}

describe("TutorialCoach", () => {
  it("shows the current objective without intercepting the highlighted target", () => {
    const target = document.createElement("div");
    target.dataset.tutorialAnchor = "palette-item-gross_balance_widget";
    target.getBoundingClientRect = () =>
      ({ left: 20, top: 40, width: 100, height: 50, right: 120, bottom: 90 }) as DOMRect;
    document.body.appendChild(target);

    render(
      <TutorialCoach
        active
        evaluation={evaluateTutorial(calibrationSampleTutorial, emptyExperiment())}
        onPause={vi.fn()}
        onRestart={vi.fn()}
        onResume={vi.fn()}
      />,
    );

    expect(screen.getByText("Deploy the Gross balance")).toBeInTheDocument();
    expect(screen.getByText("Drag to workspace")).toBeInTheDocument();
    expect(screen.getByTestId("tutorial-action-icon")).toHaveTextContent("↗");
    expect(screen.getByTestId("tutorial-spotlight-action-icon")).toHaveTextContent("↗");
    expect(screen.getByTestId("tutorial-spotlight")).toHaveClass("pointer-events-none");
    expect(screen.getByTestId("tutorial-spotlight")).not.toHaveClass("transition-all");

    target.remove();
  });

  it("does not recenter the viewport when only the experiment snapshot changes", () => {
    const scrollIntoView = vi.fn();
    const target = document.createElement("div");
    target.dataset.tutorialAnchor = "palette-item-gross_balance_widget";
    target.scrollIntoView = scrollIntoView;
    target.getBoundingClientRect = () =>
      ({ left: 20, top: 40, width: 100, height: 50, right: 120, bottom: 90 }) as DOMRect;
    document.body.appendChild(target);
    const requestAnimationFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callback(0);
        return 1;
      });

    const initialExperiment = emptyExperiment();
    const { rerender } = render(
      <TutorialCoach
        active
        evaluation={evaluateTutorial(calibrationSampleTutorial, initialExperiment)}
        onPause={vi.fn()}
        onRestart={vi.fn()}
        onResume={vi.fn()}
      />,
    );

    rerender(
      <TutorialCoach
        active
        evaluation={evaluateTutorial(calibrationSampleTutorial, {
          ...initialExperiment,
          snapshot_version: 2,
        })}
        onPause={vi.fn()}
        onRestart={vi.fn()}
        onResume={vi.fn()}
      />,
    );

    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    requestAnimationFrame.mockRestore();
    target.remove();
  });

  it("hides the spotlight when the target is outside the viewport", () => {
    const target = document.createElement("div");
    target.dataset.tutorialAnchor = "palette-item-gross_balance_widget";
    target.getBoundingClientRect = () =>
      ({ left: 20, top: -80, width: 100, height: 50, right: 120, bottom: -30 }) as DOMRect;
    document.body.appendChild(target);

    render(
      <TutorialCoach
        active
        evaluation={evaluateTutorial(calibrationSampleTutorial, emptyExperiment())}
        onPause={vi.fn()}
        onRestart={vi.fn()}
        onResume={vi.fn()}
      />,
    );

    expect(screen.getByTestId("tutorial-spotlight")).toHaveStyle({ display: "none" });

    target.remove();
  });

  it("hides the spotlight when the palette clips the target", () => {
    const paletteViewport = document.createElement("div");
    paletteViewport.style.overflowY = "auto";
    paletteViewport.getBoundingClientRect = () =>
      ({ left: 0, top: 100, width: 300, height: 300, right: 300, bottom: 400 }) as DOMRect;
    const target = document.createElement("div");
    target.dataset.tutorialAnchor = "palette-item-gross_balance_widget";
    target.getBoundingClientRect = () =>
      ({ left: 20, top: 60, width: 100, height: 30, right: 120, bottom: 90 }) as DOMRect;
    paletteViewport.appendChild(target);
    document.body.appendChild(paletteViewport);

    render(
      <TutorialCoach
        active
        evaluation={evaluateTutorial(calibrationSampleTutorial, emptyExperiment())}
        onPause={vi.fn()}
        onRestart={vi.fn()}
        onResume={vi.fn()}
      />,
    );

    expect(screen.getByTestId("tutorial-spotlight")).toHaveStyle({ display: "none" });

    paletteViewport.remove();
  });

  it("moves the spotlight synchronously with a scroll event", () => {
    let targetTop = 120;
    const target = document.createElement("div");
    target.dataset.tutorialAnchor = "palette-item-gross_balance_widget";
    target.getBoundingClientRect = () =>
      ({
        left: 20,
        top: targetTop,
        width: 100,
        height: 50,
        right: 120,
        bottom: targetTop + 50,
      }) as DOMRect;
    document.body.appendChild(target);

    render(
      <TutorialCoach
        active
        evaluation={evaluateTutorial(calibrationSampleTutorial, emptyExperiment())}
        onPause={vi.fn()}
        onRestart={vi.fn()}
        onResume={vi.fn()}
      />,
    );
    const spotlight = screen.getByTestId("tutorial-spotlight");
    expect(spotlight).toHaveStyle({ top: "112px" });

    targetTop = 220;
    window.dispatchEvent(new Event("scroll"));

    expect(spotlight).toHaveStyle({ top: "212px" });

    target.remove();
  });

  it("highlights the closed basket before the sample bag inside it", () => {
    const basketButton = document.createElement("button");
    basketButton.dataset.testid = "basket-open-button";
    basketButton.getBoundingClientRect = () =>
      ({ bottom: 170, height: 100, left: 40, right: 180, top: 70, width: 140 } as DOMRect);
    document.body.appendChild(basketButton);
    const state = emptyExperiment();
    state.workspace.widgets = [{
      id: "gross_balance",
      widgetType: "gross_balance",
      label: "Gross balance",
      isDraggable: true,
      allowedDropTargets: [],
      isStorable: true,
      canStore: true,
      anchor: "top-left",
      offsetX: 0,
      offsetY: 0,
      isPresent: true,
      isTrashed: false,
    }];
    state.basketTools = [{
      id: "bag_1",
      toolId: "sealed_sampling_bag",
      label: "Sampling bag",
      subtitle: "",
      accent: "emerald",
      toolType: "sample_bag",
      capacity_ml: 500,
      canReceiveLiquids: false,
      canReceiveProduce: true,
      canSeal: true,
      isDraggable: true,
      allowedDropTargets: [],
      liquids: [],
    }];

    render(
      <TutorialCoach
        active
        evaluation={evaluateTutorial(calibrationSampleTutorial, state)}
        onPause={vi.fn()}
        onRestart={vi.fn()}
        onResume={vi.fn()}
      />,
    );

    expect(screen.getByText("Open the Produce basket")).toBeInTheDocument();
    expect(screen.getByText("Click the highlighted basket")).toBeInTheDocument();
    expect(screen.getByTestId("tutorial-spotlight")).toHaveStyle({
      left: "32px",
      top: "62px",
    });

    basketButton.remove();
  });

  it("guides each LIMS field with the value from the bag label", () => {
    const orchardInput = document.createElement("input");
    orchardInput.dataset.tutorialAnchor = "lims-orchard-name";
    const harvestInput = document.createElement("input");
    harvestInput.dataset.tutorialAnchor = "lims-harvest-date";
    const massInput = document.createElement("input");
    massInput.dataset.tutorialAnchor = "lims-indicative-mass";
    const createButton = document.createElement("button");
    createButton.dataset.tutorialAnchor = "lims-create-record";
    for (const element of [orchardInput, harvestInput, massInput, createButton]) {
      element.getBoundingClientRect = () =>
        ({ bottom: 170, height: 40, left: 40, right: 240, top: 130, width: 200 } as DOMRect);
      document.body.appendChild(element);
    }

    const state = emptyExperiment();
    state.limsReception.measuredGrossMassG = 2987.4;
    state.workspace.widgets = [
      {
        id: "lims",
        widgetType: "lims_terminal",
        label: "LIMS",
        isDraggable: true,
        allowedDropTargets: [],
        isStorable: true,
        canStore: true,
        anchor: "top-left",
        offsetX: 0,
        offsetY: 0,
        isPresent: true,
        isTrashed: false,
      },
      {
        id: "gross_balance",
        widgetType: "gross_balance",
        label: "Gross balance",
        isDraggable: true,
        allowedDropTargets: [],
        isStorable: true,
        canStore: true,
        anchor: "top-left",
        offsetX: 0,
        offsetY: 0,
        isPresent: true,
        isTrashed: false,
        tool: {
          id: "bag_1",
          toolId: "sealed_sampling_bag",
          label: "Sampling bag",
          subtitle: "",
          accent: "emerald",
          toolType: "sample_bag",
          capacity_ml: 500,
          canReceiveLiquids: false,
          canReceiveProduce: true,
          canSeal: true,
          fieldLabelText:
            "Golden Ridge Orchard • Harvest 2026-08-07 • Approx. 3.00 kg",
          isDraggable: true,
          allowedDropTargets: [],
          liquids: [],
        },
      },
    ];

    render(
      <TutorialCoach
        active
        evaluation={evaluateTutorial(calibrationSampleTutorial, state, ["weigh-received-sample"])}
        onPause={vi.fn()}
        onRestart={vi.fn()}
        onResume={vi.fn()}
      />,
    );

    expect(screen.getByText("Enter the orchard / producer")).toBeInTheDocument();
    expect(screen.getAllByText(/Golden Ridge Orchard/)).not.toHaveLength(0);

    fireEvent.input(orchardInput, { target: { value: "Golden Ridge Orchard" } });
    expect(screen.getByText("Enter the harvest date")).toBeInTheDocument();
    expect(screen.getAllByText(/2026-08-07/)).not.toHaveLength(0);

    fireEvent.input(harvestInput, { target: { value: "2026-08-07" } });
    expect(screen.getByText("Enter the indicative field mass")).toBeInTheDocument();
    expect(screen.getAllByText(/3000 g/)).not.toHaveLength(0);

    fireEvent.input(massInput, { target: { value: "3000" } });
    expect(screen.getByText("Create the LIMS record")).toBeInTheDocument();
    expect(screen.getByText(/2987.4 g/)).toBeInTheDocument();

    for (const element of [orchardInput, harvestInput, massInput, createButton]) {
      element.remove();
    }
  });

  it("can be paused and resumed", () => {
    const onPause = vi.fn();
    const onResume = vi.fn();
    const evaluation = evaluateTutorial(calibrationSampleTutorial, emptyExperiment());
    const { rerender } = render(
      <TutorialCoach
        active
        evaluation={evaluation}
        onPause={onPause}
        onRestart={vi.fn()}
        onResume={onResume}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Pause tutorial" }));
    expect(onPause).toHaveBeenCalledTimes(1);

    rerender(
      <TutorialCoach
        active={false}
        evaluation={evaluation}
        onPause={onPause}
        onRestart={vi.fn()}
        onResume={onResume}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Resume tutorial" }));
    expect(onResume).toHaveBeenCalledTimes(1);
  });
});
