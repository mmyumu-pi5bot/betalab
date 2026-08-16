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
    // The drag gesture is drawn, not spelled with a glyph.
    const actionIcon = screen.getByTestId("tutorial-action-icon");
    const spotlightActionIcon = screen.getByTestId("tutorial-spotlight-action-icon");
    expect(actionIcon).toHaveAttribute("data-action-kind", "drag");
    expect(actionIcon.querySelector("svg")).not.toBeNull();
    expect(actionIcon).toHaveTextContent("");
    expect(spotlightActionIcon).toHaveAttribute("data-action-kind", "drag");
    expect(spotlightActionIcon.querySelector("svg")).not.toBeNull();
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

  it("spotlights the visible part of a target taller than the viewport", () => {
    // Tall widgets (the acquisition console, a rack column) regularly overflow the
    // bottom of the screen: the halo must stay on what the learner can see.
    const target = document.createElement("div");
    target.dataset.tutorialAnchor = "palette-item-gross_balance_widget";
    target.getBoundingClientRect = () =>
      ({
        bottom: window.innerHeight + 600,
        height: window.innerHeight + 400,
        left: 20,
        right: 320,
        top: 200,
        width: 300,
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

    expect(screen.getByTestId("tutorial-spotlight")).toHaveStyle({
      display: "block",
      height: `${window.innerHeight - 192}px`,
      left: "12px",
      top: "192px",
      width: "316px",
    });
    expect(screen.getByTestId("tutorial-spotlight-action-icon")).toBeInTheDocument();

    target.remove();
  });

  it("spotlights a control whose ancestor hugs it, such as a button inside a foreignObject", () => {
    // The centrifuge start button lives in a 36 px <foreignObject> that scales down
    // to ~17 px on screen. Clipping the halo to that box left nothing to draw, so
    // the padding is allowed to spill over an ancestor that merely hugs the target.
    const foreignObject = document.createElement("div");
    foreignObject.style.overflow = "hidden";
    foreignObject.getBoundingClientRect = () =>
      ({ bottom: 462, height: 17, left: 469, right: 486, top: 445, width: 17 } as DOMRect);
    const startButton = document.createElement("button");
    startButton.dataset.tutorialAnchor = "palette-item-gross_balance_widget";
    startButton.getBoundingClientRect = () =>
      ({ bottom: 462, height: 17, left: 469, right: 486, top: 445, width: 17 } as DOMRect);
    foreignObject.appendChild(startButton);
    document.body.appendChild(foreignObject);

    render(
      <TutorialCoach
        active
        evaluation={evaluateTutorial(calibrationSampleTutorial, emptyExperiment())}
        onPause={vi.fn()}
        onRestart={vi.fn()}
        onResume={vi.fn()}
      />,
    );

    expect(screen.getByTestId("tutorial-spotlight")).toHaveStyle({
      display: "block",
      height: "33px",
      left: "461px",
      top: "437px",
      width: "33px",
    });

    foreignObject.remove();
  });

  it("prefers a tutorial anchor over an element carrying the same test id", () => {
    // A progress track and the bar filling it share the same name: the track is the
    // one to highlight, since the bar is zero-wide when the run starts.
    const track = document.createElement("div");
    track.dataset.tutorialAnchor = "palette-item-gross_balance_widget";
    track.getBoundingClientRect = () =>
      ({ bottom: 210, height: 10, left: 100, right: 300, top: 200, width: 200 } as DOMRect);
    const fill = document.createElement("div");
    fill.dataset.testid = "palette-item-gross_balance_widget";
    fill.getBoundingClientRect = () =>
      ({ bottom: 210, height: 10, left: 100, right: 100, top: 200, width: 0 } as DOMRect);
    track.appendChild(fill);
    document.body.appendChild(track);

    render(
      <TutorialCoach
        active
        evaluation={evaluateTutorial(calibrationSampleTutorial, emptyExperiment())}
        onPause={vi.fn()}
        onRestart={vi.fn()}
        onResume={vi.fn()}
      />,
    );

    expect(screen.getByTestId("tutorial-spotlight")).toHaveStyle({
      display: "block",
      height: "26px",
      left: "92px",
      top: "192px",
      width: "216px",
    });

    track.remove();
  });

  it("moves the spotlight to the launch button once the acquisition console is open", async () => {
    const openConsole = document.createElement("button");
    openConsole.dataset.tutorialAnchor = "instrument-open-console";
    openConsole.getBoundingClientRect = () =>
      ({ bottom: 140, height: 40, left: 100, right: 260, top: 100, width: 160 } as DOMRect);
    document.body.appendChild(openConsole);

    const step = calibrationSampleTutorial.steps.find((entry) => entry.id === "launch-sequence")!;
    const state = emptyExperiment();
    render(
      <TutorialCoach
        active
        evaluation={{
          completedStepIds: [],
          currentChapter: calibrationSampleTutorial.chapters[0],
          currentStep: { ...step, anchor: () => "instrument-console-next" },
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

    expect(screen.getByTestId("tutorial-spotlight")).toHaveStyle({ left: "92px", top: "92px" });

    // The button that opened the console stays in the DOM, and comes first in
    // document order: the launch button still has to win.
    const launch = document.createElement("button");
    launch.dataset.tutorialAnchor = "instrument-launch";
    launch.getBoundingClientRect = () =>
      ({ bottom: 540, height: 36, left: 400, right: 560, top: 504, width: 160 } as DOMRect);
    document.body.appendChild(launch);

    await waitFor(() => {
      expect(screen.getByTestId("tutorial-spotlight")).toHaveStyle({
        left: "392px",
        top: "496px",
      });
    });

    openConsole.remove();
    launch.remove();
  });

  it("keeps the action badge inside the halo when the target overflows the top edge", () => {
    const target = document.createElement("div");
    target.dataset.tutorialAnchor = "palette-item-gross_balance_widget";
    target.getBoundingClientRect = () =>
      ({ bottom: 500, height: 800, left: 20, right: 320, top: -300, width: 300 }) as DOMRect;
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

    expect(screen.getByTestId("tutorial-spotlight")).toHaveStyle({ display: "block", top: "0px" });
    expect(screen.getByTestId("tutorial-spotlight-action-icon")).toHaveStyle({ top: "2px" });

    target.remove();
  });

  it("still spotlights the LIMS store button flush against the widget card edge", () => {
    // The widget card clips its content, and the store button sits 7 px below that
    // edge — closer than the spotlight halo, whose margin spills 1 px over the card
    // edge rather than dropping the highlight.
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

  it("asks to open the collapsed inventory section before the item inside it", async () => {
    const category = document.createElement("article");
    category.dataset.tutorialCategory = "workspace_equipment";
    category.dataset.tutorialCategoryLabel = "Workspace equipment";
    const toggle = document.createElement("button");
    toggle.setAttribute("aria-expanded", "false");
    toggle.getBoundingClientRect = () =>
      ({ bottom: 90, height: 30, left: 30, right: 230, top: 60, width: 200 } as DOMRect);
    const panel = document.createElement("div");
    const item = document.createElement("div");
    item.dataset.tutorialAnchor = "palette-item-gross_balance_widget";
    item.getBoundingClientRect = () =>
      ({ bottom: 220, height: 60, left: 40, right: 220, top: 160, width: 180 } as DOMRect);
    panel.appendChild(item);
    category.append(toggle, panel);
    document.body.appendChild(category);

    render(
      <TutorialCoach
        active
        evaluation={evaluateTutorial(calibrationSampleTutorial, emptyExperiment())}
        onPause={vi.fn()}
        onRestart={vi.fn()}
        onResume={vi.fn()}
      />,
    );

    expect(screen.getByText("Open the Workspace equipment section")).toBeInTheDocument();
    // The learner opens the section: the coach never clicks it for them.
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("tutorial-spotlight")).toHaveStyle({ left: "22px", top: "52px" });

    toggle.setAttribute("aria-expanded", "true");

    await waitFor(() => {
      expect(screen.getByTestId("tutorial-spotlight")).toHaveStyle({
        left: "32px",
        top: "152px",
      });
    });
    expect(screen.getByText("Deploy the Gross balance")).toBeInTheDocument();

    category.remove();
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

  it("highlights the expected drop destination only while an item is dragged", async () => {
    const source = document.createElement("div");
    source.dataset.tutorialAnchor = "palette-item-gross_balance_widget";
    source.getBoundingClientRect = () =>
      ({ left: 20, top: 40, width: 100, height: 50, right: 120, bottom: 90 }) as DOMRect;
    document.body.appendChild(source);
    const destination = document.createElement("div");
    destination.dataset.tutorialAnchor = "workspace";
    destination.getBoundingClientRect = () =>
      ({ left: 200, top: 120, width: 300, height: 200, right: 500, bottom: 320 }) as DOMRect;
    document.body.appendChild(destination);

    const evaluation = evaluateTutorial(calibrationSampleTutorial, emptyExperiment());
    const { rerender } = render(
      <TutorialCoach
        active
        evaluation={evaluation}
        onPause={vi.fn()}
        onRestart={vi.fn()}
        onResume={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("tutorial-drop-spotlight")).not.toBeInTheDocument();

    rerender(
      <TutorialCoach
        active
        evaluation={evaluation}
        isDragging
        onPause={vi.fn()}
        onRestart={vi.fn()}
        onResume={vi.fn()}
      />,
    );

    const dropSpotlight = screen.getByTestId("tutorial-drop-spotlight");
    await waitFor(() => {
      expect(dropSpotlight).toHaveStyle({ display: "block", left: "192px", top: "112px" });
    });
    expect(dropSpotlight).toHaveClass("border-yellow-400");
    expect(dropSpotlight).toHaveClass("pointer-events-none");
    // The source stays highlighted so the learner keeps seeing what is in hand.
    expect(screen.getByTestId("tutorial-spotlight")).toHaveStyle({ left: "12px", top: "32px" });

    source.remove();
    destination.remove();
  });

  it("clamps the drop destination to the visible area when the target overflows it", async () => {
    const source = document.createElement("div");
    source.dataset.tutorialAnchor = "palette-item-gross_balance_widget";
    source.getBoundingClientRect = () =>
      ({ left: 20, top: 40, width: 100, height: 50, right: 120, bottom: 90 }) as DOMRect;
    document.body.appendChild(source);
    // The workspace canvas is taller than the viewport and lives inside clipping
    // ancestors: it is never fully visible, but it is still the drop target.
    const destination = document.createElement("div");
    destination.dataset.tutorialAnchor = "workspace";
    destination.getBoundingClientRect = () =>
      ({ left: 40, top: 60, width: 900, height: 1200, right: 940, bottom: 1260 }) as DOMRect;
    document.body.appendChild(destination);

    render(
      <TutorialCoach
        active
        evaluation={evaluateTutorial(calibrationSampleTutorial, emptyExperiment())}
        isDragging
        onPause={vi.fn()}
        onRestart={vi.fn()}
        onResume={vi.fn()}
      />,
    );

    const dropSpotlight = screen.getByTestId("tutorial-drop-spotlight");
    await waitFor(() => {
      expect(dropSpotlight).toHaveStyle({
        display: "block",
        left: "32px",
        top: "52px",
        width: `${Math.min(948, window.innerWidth) - 32}px`,
        height: `${Math.min(1268, window.innerHeight) - 52}px`,
      });
    });

    source.remove();
    destination.remove();
  });

  it("hides the drop destination once the target is scrolled out of the visible area", async () => {
    const source = document.createElement("div");
    source.dataset.tutorialAnchor = "palette-item-gross_balance_widget";
    source.getBoundingClientRect = () =>
      ({ left: 20, top: 40, width: 100, height: 50, right: 120, bottom: 90 }) as DOMRect;
    document.body.appendChild(source);
    const destination = document.createElement("div");
    destination.dataset.tutorialAnchor = "workspace";
    destination.getBoundingClientRect = () =>
      ({
        left: 40,
        top: window.innerHeight + 200,
        width: 300,
        height: 200,
        right: 340,
        bottom: window.innerHeight + 400,
      }) as DOMRect;
    document.body.appendChild(destination);

    render(
      <TutorialCoach
        active
        evaluation={evaluateTutorial(calibrationSampleTutorial, emptyExperiment())}
        isDragging
        onPause={vi.fn()}
        onRestart={vi.fn()}
        onResume={vi.fn()}
      />,
    );

    expect(screen.getByTestId("tutorial-drop-spotlight")).toHaveStyle({ display: "none" });

    source.remove();
    destination.remove();
  });

  it("keeps the drop destination hidden while an intervention is displayed", () => {
    const destination = document.createElement("div");
    destination.dataset.tutorialAnchor = "workspace";
    destination.getBoundingClientRect = () =>
      ({ left: 200, top: 120, width: 300, height: 200, right: 500, bottom: 320 }) as DOMRect;
    document.body.appendChild(destination);

    render(
      <TutorialCoach
        active
        evaluation={evaluateTutorial(calibrationSampleTutorial, emptyExperiment())}
        intervention={{
          actionLabel: "Use the highlighted Cutting board",
          anchor: "palette-item-cutting_board_hdpe",
          continueLabel: "Continue tutorial",
          hint: "The attempted drop was cancelled.",
          instruction: "Drop them onto the highlighted Cutting board instead.",
          leaveLabel: "Leave tutorial and place anyway",
          title: "Contamination prevented",
        }}
        isDragging
        onPause={vi.fn()}
        onRestart={vi.fn()}
        onResume={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("tutorial-drop-spotlight")).not.toBeInTheDocument();
    // Non-drag actions keep their glyph.
    expect(screen.getByTestId("tutorial-action-icon")).toHaveTextContent("●");

    destination.remove();
  });
  it("sets the cementation deadline apart from the instruction it applies to", () => {
    // Buried in the paragraph, the 15 s window reads as decoration until it has
    // already expired, so it gets its own alarm-coloured line and a stopwatch.
    const tube = {
      id: "extraction_tube",
      toolId: "centrifuge_tube_50ml",
      label: "50 mL tube",
      subtitle: "",
      accent: "sky" as const,
      toolType: "centrifuge_tube" as const,
      capacity_ml: 50,
      canReceiveLiquids: true,
      canReceiveProduce: true,
      canSeal: true,
      isDraggable: true,
      allowedDropTargets: [],
      powderMassG: 10.002,
      liquids: [
        { liquidId: "istd_solution", label: "ISTD", volume_ml: 0.05 },
        { liquidId: "acetonitrile_extraction", label: "MeCN", volume_ml: 10 },
      ],
    };
    const state: Experiment = {
      ...emptyExperiment(),
      analyticalBalance: { tareMassG: 12, taredToolId: "extraction_tube" },
      workbench: { slots: [{ id: "station_1", label: "Station 1", tool: tube }] },
    };

    render(
      <TutorialCoach
        active
        evaluation={evaluateTutorial(calibrationSampleTutorial, state, [
          "weigh-received-sample",
          "register-and-label-sample",
          "store-gross-balance",
          "cut-sample",
          "grind-sample",
          "store-grinder",
          "weigh-test-portion",
          "store-analytical-balance",
        ])}
        onPause={vi.fn()}
        onRestart={vi.fn()}
        onResume={vi.fn()}
      />,
    );

    const deadline = screen.getByTestId("tutorial-deadline");
    expect(deadline).toHaveTextContent("15 seconds");
    expect(deadline.className).toContain("rose");
    expect(deadline.querySelector("svg")).not.toBeNull();
  });

  it("keeps the deadline line off steps that are not on the clock", () => {
    render(
      <TutorialCoach
        active
        evaluation={evaluateTutorial(calibrationSampleTutorial, emptyExperiment())}
        onPause={vi.fn()}
        onRestart={vi.fn()}
        onResume={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("tutorial-deadline")).not.toBeInTheDocument();
  });
  it("runs a chrono while the salts react, and stops it once mixing starts", () => {
    const reactingTube = (phase: string, cementationProgress: number) => ({
      id: "extraction_tube",
      toolId: "centrifuge_tube_50ml",
      label: "50 mL tube",
      subtitle: "",
      accent: "sky" as const,
      toolType: "centrifuge_tube" as const,
      capacity_ml: 50,
      canReceiveLiquids: true,
      canReceiveProduce: true,
      canSeal: true,
      isDraggable: true,
      allowedDropTargets: [],
      powderMassG: 10.002,
      liquids: [
        { liquidId: "istd_solution", label: "ISTD", volume_ml: 0.05 },
        { liquidId: "acetonitrile_extraction", label: "MeCN", volume_ml: 10 },
      ],
      quechersState: {
        saltsAdded: true,
        phase,
        faults: [],
        isUsable: true,
        cementationProgress,
      },
    });
    const stateWith = (phase: string, cementationProgress: number): Experiment => ({
      ...emptyExperiment(),
      analyticalBalance: { tareMassG: 12, taredToolId: "extraction_tube" },
      workbench: {
        slots: [
          {
            id: "station_1",
            label: "Station 1",
            tool: reactingTube(phase, cementationProgress),
          },
        ],
      },
    });
    const completed = [
      "weigh-received-sample",
      "register-and-label-sample",
      "store-gross-balance",
      "cut-sample",
      "grind-sample",
      "store-grinder",
      "weigh-test-portion",
      "store-analytical-balance",
    ];

    const { rerender } = render(
      <TutorialCoach
        active
        evaluation={evaluateTutorial(
          calibrationSampleTutorial,
          stateWith("reacting", 0.2),
          completed,
        )}
        onPause={vi.fn()}
        onRestart={vi.fn()}
        onResume={vi.fn()}
      />,
    );

    // 20% of the 15 s window burnt leaves 12.0 s.
    expect(screen.getByTestId("tutorial-countdown-seconds")).toHaveTextContent("12.0s");
    expect(screen.getByTestId("tutorial-countdown-bar")).toHaveStyle({ width: "80%" });
    // The chrono replaces the static warning rather than stacking with it.
    expect(screen.queryByTestId("tutorial-deadline")).not.toBeInTheDocument();

    rerender(
      <TutorialCoach
        active
        evaluation={evaluateTutorial(
          calibrationSampleTutorial,
          stateWith("reacting", 0.9),
          completed,
        )}
        onPause={vi.fn()}
        onRestart={vi.fn()}
        onResume={vi.fn()}
      />,
    );

    expect(screen.getByTestId("tutorial-countdown-seconds")).toHaveTextContent("1.5s");

    rerender(
      <TutorialCoach
        active
        evaluation={evaluateTutorial(
          calibrationSampleTutorial,
          stateWith("mixing", 0.9),
          completed,
        )}
        onPause={vi.fn()}
        onRestart={vi.fn()}
        onResume={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("tutorial-countdown")).not.toBeInTheDocument();
  });

  // Both halos measure their target with a synchronous getBoundingClientRect, and both
  // watch the whole body. Re-measuring once per mutation record pinned the main thread
  // during a drag, which mutates drop targets continuously.
  it("coalesces a burst of unrelated DOM mutations into a single measurement", async () => {
    let measurements = 0;
    const target = document.createElement("div");
    target.dataset.tutorialAnchor = "palette-item-gross_balance_widget";
    target.getBoundingClientRect = () => {
      measurements += 1;
      return { left: 20, top: 40, width: 100, height: 50, right: 120, bottom: 90 } as DOMRect;
    };
    document.body.appendChild(target);
    const noise: HTMLElement[] = [];

    try {
      render(
        <TutorialCoach
          active
          evaluation={evaluateTutorial(calibrationSampleTutorial, emptyExperiment())}
          onPause={vi.fn()}
          onRestart={vi.fn()}
          onResume={vi.fn()}
        />,
      );
      await waitFor(() => {
        expect(screen.getByTestId("tutorial-spotlight")).toHaveStyle({ display: "block" });
      });

      const settled = measurements;
      // Each mutation is delivered in its own observer callback, the way a dragover
      // toggling drop-target classes frame after frame does.
      for (let index = 0; index < 25; index += 1) {
        const node = document.createElement("span");
        node.dataset.noise = `${index}`;
        document.body.appendChild(node);
        noise.push(node);
        await Promise.resolve();
      }

      // Nothing is measured while the mutations are still being delivered.
      expect(measurements).toBe(settled);

      await waitFor(() => {
        expect(measurements).toBeGreaterThan(settled);
      });
      // 25 mutation batches inside one frame must cost one measurement, not 25.
      expect(measurements - settled).toBeLessThanOrEqual(2);
    } finally {
      noise.forEach((node) => node.remove());
      target.remove();
    }
  });

  it("ignores its own halo style writes so the two spotlights cannot feed each other", async () => {
    let measurements = 0;
    const source = document.createElement("div");
    source.dataset.tutorialAnchor = "palette-item-gross_balance_widget";
    source.getBoundingClientRect = () => {
      measurements += 1;
      return { left: 20, top: 40, width: 100, height: 50, right: 120, bottom: 90 } as DOMRect;
    };
    document.body.appendChild(source);
    const destination = document.createElement("div");
    destination.dataset.tutorialAnchor = "workspace";
    destination.getBoundingClientRect = () =>
      ({ left: 200, top: 120, width: 300, height: 200, right: 500, bottom: 320 }) as DOMRect;
    document.body.appendChild(destination);

    try {
      render(
        <TutorialCoach
          active
          evaluation={evaluateTutorial(calibrationSampleTutorial, emptyExperiment())}
          isDragging
          onPause={vi.fn()}
          onRestart={vi.fn()}
          onResume={vi.fn()}
        />,
      );
      const dropSpotlight = await screen.findByTestId("tutorial-drop-spotlight");
      await waitFor(() => {
        expect(dropSpotlight).toHaveStyle({ display: "block" });
      });

      await new Promise((resolve) => {
        window.requestAnimationFrame(() => resolve(null));
      });
      const settled = measurements;

      // A halo repositioning itself must not wake the other halo's observer.
      dropSpotlight.style.left = "999px";
      screen.getByTestId("tutorial-spotlight").style.top = "888px";
      await new Promise((resolve) => {
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve(null)));
      });

      expect(measurements).toBe(settled);
    } finally {
      source.remove();
      destination.remove();
    }
  });
});
