import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
      packagingTareMassG: 36,
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
    expect(screen.getByRole("complementary", { name: "Guided tutorial" })).toHaveClass(
      "border-amber-400",
    );
    expect(screen.getByRole("complementary", { name: "Guided tutorial" })).not.toHaveClass(
      "border-sky-200",
    );

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

  it("offers free mode instead of pausing once the tutorial is complete", () => {
    const onFinish = vi.fn();
    const onPause = vi.fn();

    render(
      <TutorialCoach
        active
        evaluation={{
          completedStepIds: calibrationSampleTutorial.steps.map((entry) => entry.id),
          currentChapter: calibrationSampleTutorial.chapters.at(-1)!,
          currentStep: null,
          experiment: emptyExperiment(),
          isComplete: true,
          progressPercent: 100,
          totalStepCount: calibrationSampleTutorial.steps.length,
        }}
        onFinish={onFinish}
        onPause={onPause}
        onRestart={vi.fn()}
        onResume={vi.fn()}
      />,
    );

    expect(screen.getByText("Tutorial complete")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pause tutorial" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Switch to free mode" }));
    expect(onFinish).toHaveBeenCalledTimes(1);
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

  it("still spotlights the LIMS store button flush against the widget card edge", () => {
    // The widget card clips its content, and the store button sits 7 px below that
    // edge — closer than the spotlight halo, which must not hide the highlight.
    const widgetCard = document.createElement("section");
    widgetCard.style.overflow = "hidden";
    widgetCard.getBoundingClientRect = () =>
      ({ bottom: 620, height: 520, left: 200, right: 580, top: 100, width: 380 } as DOMRect);
    const storeButton = document.createElement("button");
    storeButton.dataset.tutorialAnchor = "store-widget-lims";
    storeButton.getBoundingClientRect = () =>
      ({ bottom: 147, height: 40, left: 528, right: 560, top: 107, width: 32 } as DOMRect);
    widgetCard.appendChild(storeButton);
    document.body.appendChild(widgetCard);

    const state = emptyExperiment();
    state.limsReception.labSampleCode = "APP-1";
    state.workspace.widgets = [{
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
      labels: [{
        id: "label_1",
        labelKind: "lims",
        text: "APP-1",
        sampleCode: "APP-1",
        isDraggable: true,
        allowedDropTargets: [],
      }],
    }];

    render(
      <TutorialCoach
        active
        evaluation={evaluateTutorial(calibrationSampleTutorial, state, [
          "weigh-received-sample",
          "register-and-label-sample",
        ])}
        onPause={vi.fn()}
        onRestart={vi.fn()}
        onResume={vi.fn()}
      />,
    );

    expect(screen.getByText("Store the LIMS terminal")).toBeInTheDocument();
    expect(screen.getByTestId("tutorial-spotlight")).toHaveStyle({
      display: "block",
      left: "520px",
      top: "99px",
    });

    widgetCard.remove();
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
    expect(spotlight).toHaveClass("border-amber-400");
    expect(spotlight).not.toHaveClass("border-sky-400");
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

  it("guides the reception calculation before each LIMS field", async () => {
    const massSummary = document.createElement("button");
    massSummary.dataset.tutorialAnchor = "lims-mass-summary";
    massSummary.setAttribute("aria-pressed", "false");
    massSummary.addEventListener("click", () => {
      massSummary.setAttribute("aria-pressed", "true");
    });
    const orchardInput = document.createElement("input");
    orchardInput.dataset.tutorialAnchor = "lims-orchard-name";
    const harvestInput = document.createElement("input");
    harvestInput.dataset.tutorialAnchor = "lims-harvest-date";
    const massInput = document.createElement("input");
    massInput.dataset.tutorialAnchor = "lims-indicative-mass";
    const createButton = document.createElement("button");
    createButton.dataset.tutorialAnchor = "lims-create-record";
    for (const element of [massSummary, orchardInput, harvestInput, massInput, createButton]) {
      element.getBoundingClientRect = () =>
        ({ bottom: 170, height: 40, left: 40, right: 240, top: 130, width: 200 } as DOMRect);
      document.body.appendChild(element);
    }

    const state = emptyExperiment();
    state.limsReception.measuredGrossMassG = 2987.4;
    state.limsReception.packagingTareMassG = 36;
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

    expect(screen.getByText("Review the reception weighing")).toBeInTheDocument();
    expect(screen.getByText(/2987.4 g − 36.0 g = 2951.4 g/)).toBeInTheDocument();

    fireEvent.click(massSummary);
    expect(await screen.findByText("Enter the orchard / producer")).toBeInTheDocument();
    expect(screen.getAllByText(/Golden Ridge Orchard/)).not.toHaveLength(0);

    fireEvent.input(orchardInput, { target: { value: "Golden Ridge Orchard" } });
    expect(screen.getByText("Enter the harvest date")).toBeInTheDocument();
    expect(screen.getAllByText(/2026-08-07/)).not.toHaveLength(0);

    fireEvent.input(harvestInput, { target: { value: "2026-08-07" } });
    expect(screen.getByText("Enter the declared mass")).toBeInTheDocument();
    expect(screen.getAllByText(/3000 g/)).not.toHaveLength(0);

    fireEvent.input(massInput, { target: { value: "3000" } });
    expect(screen.getByText("Create the LIMS record")).toBeInTheDocument();
    expect(screen.getByText(/2987.4 g/)).toBeInTheDocument();

    for (const element of [massSummary, orchardInput, harvestInput, massInput, createButton]) {
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

  it("explains a prevented contamination and offers safe or explicit exit actions", () => {
    const board = document.createElement("div");
    board.dataset.testid = "bench-tool-card-board_1";
    board.getBoundingClientRect = () =>
      ({ bottom: 170, height: 80, left: 40, right: 240, top: 90, width: 200 } as DOMRect);
    document.body.appendChild(board);
    const onContinueTutorial = vi.fn();
    const onLeaveTutorial = vi.fn();

    render(
      <TutorialCoach
        active
        evaluation={evaluateTutorial(calibrationSampleTutorial, emptyExperiment())}
        intervention={{
          actionLabel: "Use the highlighted Cutting board",
          anchor: "bench-tool-card-board_1",
          continueLabel: "Continue tutorial",
          title: "Contamination prevented",
          instruction: "Do not place the apples directly on the workbench.",
          hint: "The attempted drop was cancelled.",
          leaveLabel: "Leave tutorial and place anyway",
        }}
        onContinueTutorial={onContinueTutorial}
        onLeaveTutorial={onLeaveTutorial}
        onPause={vi.fn()}
        onRestart={vi.fn()}
        onResume={vi.fn()}
      />,
    );

    expect(screen.getByText("Contamination prevented")).toBeInTheDocument();
    expect(screen.getByTestId("tutorial-spotlight")).toHaveStyle({
      left: "32px",
      top: "82px",
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue tutorial" }));
    fireEvent.click(screen.getByRole("button", { name: "Leave tutorial and place anyway" }));
    expect(onContinueTutorial).toHaveBeenCalledOnce();
    expect(onLeaveTutorial).toHaveBeenCalledOnce();
    board.remove();
  });

  it("asks to put the knife away before the step that needs a drag", async () => {
    const knife = document.createElement("button");
    knife.dataset.tutorialAnchor = "action-knife";
    knife.setAttribute("aria-pressed", "true");
    knife.getBoundingClientRect = () =>
      ({ bottom: 250, height: 48, left: 24, right: 72, top: 202, width: 48 } as DOMRect);
    const cutApples = document.createElement("div");
    cutApples.dataset.testid = "bench-produce-lot-lot_1";
    cutApples.getBoundingClientRect = () =>
      ({ bottom: 400, height: 90, left: 300, right: 440, top: 310, width: 140 } as DOMRect);
    document.body.append(knife, cutApples);

    const state = emptyExperiment();
    state.produceMaterialStates = [
      { id: "state_1", produceLotId: "lot_1", materialState: "cut" },
    ];
    state.workbench.slots = [{
      id: "station_1",
      label: "Station 1",
      tool: {
        id: "board_1",
        toolId: "cutting_board_hdpe",
        label: "Cutting board",
        subtitle: "",
        accent: "sky",
        toolType: "cutting_board",
        capacity_ml: 0,
        canReceiveLiquids: false,
        canReceiveProduce: true,
        canSeal: false,
        isDraggable: true,
        allowedDropTargets: [],
        liquids: [],
        produceLots: [{
          id: "lot_1",
          label: "Cut apples",
          produceType: "apple",
          totalMassG: 2500,
          unitCount: 12,
          isDraggable: true,
          allowedDropTargets: [],
          materialState: "cut",
        }],
      },
    }];
    state.workspace.widgets = [{
      id: "grinder",
      widgetType: "grinder",
      label: "Cryogenic grinder",
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
    const completed = calibrationSampleTutorial.steps
      .map((entry) => entry.id)
      .slice(
        0,
        calibrationSampleTutorial.steps.findIndex((entry) => entry.id === "grind-sample"),
      );

    render(
      <TutorialCoach
        active
        evaluation={evaluateTutorial(calibrationSampleTutorial, state, completed)}
        onPause={vi.fn()}
        onRestart={vi.fn()}
        onResume={vi.fn()}
      />,
    );

    expect(screen.getByText("Put the Stainless steel knife away")).toBeInTheDocument();
    expect(screen.getByTestId("tutorial-spotlight")).toHaveStyle({
      left: "16px",
      top: "194px",
    });

    knife.setAttribute("aria-pressed", "false");

    await waitFor(() => {
      expect(screen.getByText("Load the cut apples into the grinder")).toBeInTheDocument();
    });
    expect(screen.getByTestId("tutorial-spotlight")).toHaveStyle({
      left: "292px",
      top: "302px",
    });

    knife.remove();
    cutApples.remove();
  });

  it("asks to put the pipette away once it is empty, and not while it carries extract", () => {
    const pipette = document.createElement("button");
    pipette.dataset.tutorialAnchor = "action-pipette";
    pipette.setAttribute("aria-pressed", "true");
    pipette.getBoundingClientRect = () =>
      ({ bottom: 310, height: 48, left: 24, right: 72, top: 262, width: 48 } as DOMRect);
    const vial = document.createElement("div");
    vial.dataset.tutorialAnchor = "tool-type-sample_vial";
    vial.getBoundingClientRect = () =>
      ({ bottom: 220, height: 80, left: 300, right: 440, top: 140, width: 140 } as DOMRect);
    document.body.append(pipette, vial);

    const step = calibrationSampleTutorial.steps.find(
      (entry) => entry.id === "prepare-sample-vial",
    )!;
    const evaluationFor = (volumeMl: number) => {
      const state = emptyExperiment();
      state.pipette = { capacityMl: 1, volumeMl, sourceToolId: null };
      return {
        completedStepIds: [],
        currentChapter: calibrationSampleTutorial.chapters[0],
        currentStep: { ...step, anchor: () => "tool-type-sample_vial" },
        experiment: state,
        isComplete: false,
        progressPercent: 70,
        totalStepCount: calibrationSampleTutorial.steps.length,
      };
    };

    const { rerender } = render(
      <TutorialCoach
        active
        evaluation={evaluationFor(1)}
        onPause={vi.fn()}
        onRestart={vi.fn()}
        onResume={vi.fn()}
      />,
    );

    expect(screen.queryByText("Put the Micropipette away")).not.toBeInTheDocument();
    expect(screen.getByTestId("tutorial-spotlight")).toHaveStyle({ left: "292px", top: "132px" });

    rerender(
      <TutorialCoach
        active
        evaluation={evaluationFor(0)}
        onPause={vi.fn()}
        onRestart={vi.fn()}
        onResume={vi.fn()}
      />,
    );

    expect(screen.getByText("Put the Micropipette away")).toBeInTheDocument();
    expect(screen.getByText("Click it again or press P")).toBeInTheDocument();
    expect(screen.getByTestId("tutorial-spotlight")).toHaveStyle({ left: "16px", top: "254px" });

    pipette.remove();
    vial.remove();
  });

  it("leaves the knife selected while the step is the cutting itself", () => {
    const knife = document.createElement("button");
    knife.dataset.tutorialAnchor = "action-knife";
    knife.setAttribute("aria-pressed", "true");
    knife.getBoundingClientRect = () =>
      ({ bottom: 250, height: 48, left: 24, right: 72, top: 202, width: 48 } as DOMRect);
    const wholeApples = document.createElement("div");
    wholeApples.dataset.testid = "bench-produce-lot-lot_1";
    wholeApples.getBoundingClientRect = () =>
      ({ bottom: 400, height: 90, left: 300, right: 440, top: 310, width: 140 } as DOMRect);
    document.body.append(knife, wholeApples);

    const step = calibrationSampleTutorial.steps.find((entry) => entry.id === "cut-sample")!;
    render(
      <TutorialCoach
        active
        evaluation={{
          completedStepIds: [],
          currentChapter: calibrationSampleTutorial.chapters[0],
          currentStep: { ...step, anchor: () => "cut-apples-lot_1" },
          experiment: emptyExperiment(),
          isComplete: false,
          progressPercent: 30,
          totalStepCount: calibrationSampleTutorial.steps.length,
        }}
        onPause={vi.fn()}
        onRestart={vi.fn()}
        onResume={vi.fn()}
      />,
    );

    expect(screen.queryByText("Put the Stainless steel knife away")).not.toBeInTheDocument();
    expect(screen.getByTestId("tutorial-spotlight")).toHaveStyle({
      left: "292px",
      top: "302px",
    });

    knife.remove();
    wholeApples.remove();
  });

  it("moves the spotlight from the selected spatula to the powder jar", async () => {
    const spatula = document.createElement("button");
    spatula.dataset.tutorialAnchor = "action-spatula";
    spatula.setAttribute("aria-pressed", "false");
    spatula.getBoundingClientRect = () =>
      ({ bottom: 100, height: 40, left: 20, right: 100, top: 60, width: 80 } as DOMRect);
    const powderJar = document.createElement("div");
    powderJar.dataset.testid = "bench-tool-card-powder_jar";
    powderJar.getBoundingClientRect = () =>
      ({ bottom: 240, height: 100, left: 300, right: 440, top: 140, width: 140 } as DOMRect);
    document.body.append(spatula, powderJar);

    const state = emptyExperiment();
    const step = calibrationSampleTutorial.steps.find(
      (entry) => entry.id === "weigh-test-portion",
    )!;
    render(
      <TutorialCoach
        active
        evaluation={{
          completedStepIds: [],
          currentChapter: calibrationSampleTutorial.chapters[0],
          currentStep: {
            ...step,
            anchor: () => "spatula-load-powder:bench-tool-card-powder_jar",
          },
          experiment: state,
          isComplete: false,
          progressPercent: 50,
          totalStepCount: calibrationSampleTutorial.steps.length,
        }}
        onPause={vi.fn()}
        onRestart={vi.fn()}
        onResume={vi.fn()}
      />,
    );

    expect(screen.getByTestId("tutorial-spotlight")).toHaveStyle({ left: "12px", top: "52px" });

    spatula.setAttribute("aria-pressed", "true");

    await waitFor(() => {
      expect(screen.getByTestId("tutorial-spotlight")).toHaveStyle({
        left: "292px",
        top: "132px",
      });
    });

    spatula.remove();
    powderJar.remove();
  });
});
