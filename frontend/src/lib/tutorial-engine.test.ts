import { describe, expect, it } from "vitest";

import {
  CALIBRATION_SAMPLE_TUTORIAL_ID,
  calibrationSampleTutorial,
  evaluateTutorial,
} from "@/lib/tutorial-engine";
import type { Experiment } from "@/types/experiment";
import type { ExperimentWorkspaceWidget } from "@/types/workbench";

const widgetIds = [
  "gross_balance",
  "analytical_balance",
  "grinder",
  "vortex",
  "centrifuge",
  "rack",
  "instrument",
] as const;

function widget(
  id: ExperimentWorkspaceWidget["id"],
  overrides: Partial<ExperimentWorkspaceWidget> = {},
): ExperimentWorkspaceWidget {
  return {
    id,
    widgetType: id === "instrument" ? "lc_msms_instrument" : "workbench",
    label: id,
    isDraggable: true,
    allowedDropTargets: [],
    isStorable: true,
    canStore: true,
    anchor: "top-left",
    offsetX: 0,
    offsetY: 0,
    isPresent: false,
    isTrashed: false,
    ...overrides,
  };
}

function experiment(overrides: Partial<Experiment> = {}): Experiment {
  return {
    id: "experiment_tutorial",
    status: "preparing",
    last_simulation_at: "2026-08-10T08:00:00Z",
    snapshot_version: 1,
    workbench: { slots: [] },
    rack: { allowedDropTargets: [], isDraggable: true, state: "available", slots: [] },
    trash: { children: [], discardedFrom: {}, produceLots: [], sampleLabels: [] },
    workspace: {
      produceBasketLots: [],
      widgets: widgetIds.map((id) => widget(id)),
    },
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
    ...overrides,
  };
}

describe("calibration sample tutorial", () => {
  it("gives explicit UI actions for the first reception steps", () => {
    const weigh = calibrationSampleTutorial.steps.find(
      (entry) => entry.id === "weigh-received-sample",
    );
    const register = calibrationSampleTutorial.steps.find(
      (entry) => entry.id === "register-and-label-sample",
    );
    const store = calibrationSampleTutorial.steps.find(
      (entry) => entry.id === "store-gross-balance",
    );

    expect(weigh?.instruction).toContain("Drag");
    expect(weigh?.instruction).toContain("drop");
    expect(weigh?.hint).toContain("automatically records");
    expect(register?.instruction).toContain("Create LIMS record");
    expect(register?.instruction).toContain("Print label");
    expect(register?.hint).toContain("Drag");
    expect(store?.instruction).toContain("Drag");
    expect(store?.instruction).toContain("Store in inventory");
  });

  it("explains drag and drop whenever equipment must be deployed", () => {
    const deployStepIds = [
      "grind-sample",
      "weigh-test-portion",
      "vortex-extract",
      "separate-extract",
      "stage-vials",
      "launch-sequence",
    ];

    for (const stepId of deployStepIds) {
      const tutorialStep = calibrationSampleTutorial.steps.find(
        (entry) => entry.id === stepId,
      );
      expect(tutorialStep?.instruction, stepId).toContain("Drag");
      expect(tutorialStep?.instruction, stepId).toContain("drop");
    }
  });

  it("starts with reception and asks for the gross balance just in time", () => {
    const result = evaluateTutorial(calibrationSampleTutorial, experiment());

    expect(calibrationSampleTutorial.id).toBe(CALIBRATION_SAMPLE_TUTORIAL_ID);
    expect(result.currentStep?.id).toBe("weigh-received-sample");
    expect(result.currentStep?.anchor(result.experiment)).toBe(
      "palette-item-gross_balance_widget",
    );
    expect(result.completedStepIds).toEqual([]);
  });

  it("targets the deployed gross balance until the reception weight is recorded", () => {
    const ready = experiment({
      workspace: {
        produceBasketLots: [],
        widgets: widgetIds.map((id) =>
          widget(id, { isPresent: id === "gross_balance" }),
        ),
      },
    });

    const result = evaluateTutorial(calibrationSampleTutorial, ready);

    expect(result.currentStep?.id).toBe("weigh-received-sample");
    expect(result.currentChapter.id).toBe("reception");
    expect(result.currentStep?.anchor(result.experiment)).toBe("widget-gross_balance");
  });

  it("asks to store the gross balance after the labelled reception is complete", () => {
    const labelledBag = {
      id: "bag_1",
      toolId: "sealed_sampling_bag",
      label: "Sampling bag",
      subtitle: "",
      accent: "emerald" as const,
      toolType: "sample_bag" as const,
      capacity_ml: 500,
      canReceiveLiquids: false,
      canReceiveProduce: true,
      canSeal: true,
      isDraggable: true,
      allowedDropTargets: [],
      liquids: [],
      labels: [
        {
          id: "label_1",
          labelKind: "lims" as const,
          text: "APP-2026-0001",
          sampleCode: "APP-2026-0001",
          isDraggable: true,
          allowedDropTargets: [],
        },
      ],
    };
    const state = experiment({
      basketTools: [labelledBag],
      limsReception: {
        ...experiment().limsReception,
        measuredGrossMassG: 2500,
        labSampleCode: "APP-2026-0001",
        status: "received",
      },
      workspace: {
        produceBasketLots: [],
        widgets: widgetIds.map((id) =>
          widget(id, { isPresent: id === "gross_balance" }),
        ),
      },
    });

    const result = evaluateTutorial(calibrationSampleTutorial, state);

    expect(result.currentStep?.id).toBe("store-gross-balance");
    expect(result.currentStep?.anchor(result.experiment)).toBe("widget-gross_balance");
  });

  it("keeps completed quest steps when a later physical move invalidates their snapshot predicate", () => {
    const state = experiment({
      limsReception: {
        ...experiment().limsReception,
        measuredGrossMassG: null,
        labSampleCode: "APP-2026-0001",
        status: "received",
      },
      basketTools: [
        {
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
          labels: [
            {
              id: "label_1",
              labelKind: "lims",
              text: "APP-2026-0001",
              sampleCode: "APP-2026-0001",
              isDraggable: true,
              allowedDropTargets: [],
            },
          ],
        },
      ],
      workspace: {
        produceBasketLots: [],
        widgets: widgetIds.map((id) =>
          widget(id, { isPresent: id === "gross_balance" }),
        ),
      },
    });

    const result = evaluateTutorial(calibrationSampleTutorial, state, [
      "weigh-received-sample",
      "register-and-label-sample",
    ]);

    expect(result.completedStepIds).toEqual([
      "weigh-received-sample",
      "register-and-label-sample",
    ]);
    expect(result.currentStep?.id).toBe("store-gross-balance");
    expect(result.progressPercent).toBe(11);
  });

  it("credits an out-of-order calibration without skipping missing prerequisites", () => {
    const calibrationTool = {
      id: "cal-vial",
      toolId: "sample_vial_lcms",
      label: "Autosampler vial",
      subtitle: "",
      accent: "sky" as const,
      toolType: "sample_vial" as const,
      capacity_ml: 2,
      canReceiveLiquids: true,
      canReceiveProduce: false,
      canSeal: true,
      isDraggable: true,
      allowedDropTargets: [],
      liquids: [],
      calibrationContext: { levelNgPerMl: 10, compoundIds: ["boscalid"] },
    };
    const state = experiment({
      workbench: {
        slots: [{ id: "station_1", label: "Station 1", tool: calibrationTool }],
      },
    });

    const result = evaluateTutorial(calibrationSampleTutorial, state);

    expect(result.completedStepIds).toContain("prepare-calibration-vial");
    expect(result.currentStep?.id).toBe("weigh-received-sample");
  });

  it("finishes only after a completed run contains a calibrant and a sample", () => {
    const finished = experiment({
      workspace: {
        produceBasketLots: [],
        widgets: [
          ...widgetIds.filter((id) => id !== "instrument").map((id) =>
            widget(id, { isPresent: false }),
          ),
          widget("instrument", {
            isPresent: false,
            sequenceRuns: [
              {
                id: "run_1",
                methodId: "method",
                methodSnapshot: {} as never,
                totalDurationS: 20,
                elapsedS: 20,
                injections: [
                  { status: "calibration" },
                  { status: "ok" },
                ] as never,
              },
            ],
          }),
        ],
      },
    });

    const result = evaluateTutorial(calibrationSampleTutorial, finished);

    expect(result.isComplete).toBe(true);
    expect(result.currentStep).toBeNull();
    expect(result.completedStepIds).toHaveLength(calibrationSampleTutorial.steps.length);
  });
});
