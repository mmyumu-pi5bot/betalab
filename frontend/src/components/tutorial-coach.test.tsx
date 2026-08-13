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

    expect(screen.getByText("Weigh the received sample bag")).toBeInTheDocument();
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
