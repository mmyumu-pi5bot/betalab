import { describe, expect, it } from "vitest";

import {
  CALIBRATION_SAMPLE_TUTORIAL_ID,
  calibrationSampleTutorial,
  evaluateTutorial,
  getTutorialStepPresentation,
} from "@/lib/tutorial-engine";
import type { Experiment } from "@/types/experiment";
import type { ExperimentWorkspaceWidget } from "@/types/workbench";

const widgetIds = [
  "lims",
  "gross_balance",
  "analytical_balance",
  "grinder",
  "vortex",
  "centrifuge",
  "rack",
  "instrument",
] as const;

function sampleBag() {
  return {
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
  };
}

function labTool(
  toolType: "centrifuge_tube" | "sample_vial" | "storage_jar",
  overrides: Record<string, unknown> = {},
) {
  return {
    id: `${toolType}_1`,
    toolId: `${toolType}_catalog`,
    label: toolType,
    subtitle: "",
    accent: "sky" as const,
    toolType,
    capacity_ml: 50,
    canReceiveLiquids: true,
    canReceiveProduce: toolType !== "sample_vial",
    canSeal: true,
    isDraggable: true,
    allowedDropTargets: [],
    liquids: [],
    ...overrides,
  };
}

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
    expect(getTutorialStepPresentation(result.currentStep!, result.experiment).action).toEqual({
      kind: "drag",
      label: "Drag to workspace",
    });
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

  it("asks to redeploy the LIMS terminal when it was stored during reception", () => {
    const state = experiment({
      limsReception: {
        ...experiment().limsReception,
        measuredGrossMassG: 2500,
      },
      workspace: {
        produceBasketLots: [],
        widgets: widgetIds.map((id) =>
          widget(id, {
            isPresent: id === "gross_balance",
            tool: id === "gross_balance" ? sampleBag() : undefined,
          }),
        ),
      },
    });

    const result = evaluateTutorial(calibrationSampleTutorial, state, [
      "weigh-received-sample",
    ]);
    const presentation = getTutorialStepPresentation(result.currentStep!, state);

    expect(result.currentStep?.id).toBe("register-and-label-sample");
    expect(result.currentStep?.anchor(state)).toBe("palette-item-lims_terminal_widget");
    expect(presentation.title).toBe("Deploy the LIMS terminal");
    expect(presentation.instruction).toContain("Drag");
    expect(presentation.instruction).toContain("drop");
  });

  it("provides exact beginner values and targets the LIMS form action", () => {
    const labelledBag = sampleBag();
    labelledBag.fieldLabelText =
      "Golden Ridge Orchard • Harvest 2026-08-07 • Approx. 3.00 kg";
    const state = experiment({
      limsReception: { ...experiment().limsReception, measuredGrossMassG: 2987.4 },
      workspace: {
        produceBasketLots: [],
        widgets: widgetIds.map((id) =>
          widget(id, {
            isPresent: id === "lims" || id === "gross_balance",
            tool: id === "gross_balance" ? labelledBag : undefined,
          }),
        ),
      },
    });
    const result = evaluateTutorial(calibrationSampleTutorial, state, ["weigh-received-sample"]);
    const presentation = getTutorialStepPresentation(result.currentStep!, state);

    expect(result.currentStep?.anchor(state)).toBe("lims-form-next-field");
    expect(presentation.instruction).toContain("Golden Ridge Orchard");
    expect(presentation.instruction).toContain("2026-08-07");
    expect(presentation.instruction).toContain("3000");
    expect(presentation.hint).toContain("2987.4 g");
    expect(presentation.hint).toContain("automatically");
    expect(presentation.action).toEqual({ kind: "type", label: "Enter the values, then click" });
  });

  it("asks to return the bag to the balance before continuing in LIMS", () => {
    const state = experiment({
      limsReception: {
        ...experiment().limsReception,
        measuredGrossMassG: null,
      },
      workbench: {
        slots: [{ id: "station_1", label: "Station 1", tool: sampleBag() }],
      },
      workspace: {
        produceBasketLots: [],
        widgets: widgetIds.map((id) =>
          widget(id, { isPresent: id === "lims" || id === "gross_balance" }),
        ),
      },
    });

    const result = evaluateTutorial(calibrationSampleTutorial, state, [
      "weigh-received-sample",
    ]);
    const presentation = getTutorialStepPresentation(result.currentStep!, state);

    expect(result.currentStep?.id).toBe("register-and-label-sample");
    expect(result.currentStep?.anchor(state)).toBe("bench-tool-card-bag_1");
    expect(presentation.title).toBe("Return the sample bag to the Gross balance");
    expect(presentation.instruction).toContain("Drag the sample bag");
    expect(presentation.hint).toContain("Keep the bag on the balance");
  });

  it.each([
    {
      stepId: "vortex-extract",
      completed: ["weigh-received-sample", "register-and-label-sample", "store-gross-balance", "cut-sample", "grind-sample", "store-grinder", "weigh-test-portion", "store-analytical-balance", "prepare-extraction"],
      widgetId: "vortex" as const,
      tool: labTool("centrifuge_tube", {
        powderMassG: 10,
        quechersState: { saltsAdded: true, phase: "armed", faults: [], isUsable: true },
      }),
      expectedTitle: "Return the extraction tube to the Vortex mixer",
    },
    {
      stepId: "separate-extract",
      completed: ["weigh-received-sample", "register-and-label-sample", "store-gross-balance", "cut-sample", "grind-sample", "store-grinder", "weigh-test-portion", "store-analytical-balance", "prepare-extraction", "vortex-extract", "store-vortex"],
      widgetId: "centrifuge" as const,
      tool: labTool("centrifuge_tube", {
        quechersState: { saltsAdded: true, phase: "mixed", faults: [], isUsable: true },
      }),
      expectedTitle: "Return the extraction tube to the Centrifuge",
    },
  ])("recovers a displaced extraction tube during $stepId", ({ completed, expectedTitle, stepId, tool, widgetId }) => {
    const state = experiment({
      trash: { ...experiment().trash, children: [tool] },
      workspace: {
        produceBasketLots: [],
        widgets: widgetIds.map((id) => widget(id, { isPresent: id === widgetId })),
      },
    });

    const result = evaluateTutorial(calibrationSampleTutorial, state, completed);
    const presentation = getTutorialStepPresentation(result.currentStep!, state);

    expect(result.currentStep?.id).toBe(stepId);
    expect(result.currentStep?.anchor(state)).toBe("trash-tool-centrifuge_tube_1");
    expect(presentation.title).toBe(expectedTitle);
  });

  it("asks for a new autosampler vial when none exists for the sample", () => {
    const state = experiment();
    const completed = calibrationSampleTutorial.steps
      .map((entry) => entry.id)
      .slice(0, calibrationSampleTutorial.steps.findIndex((entry) => entry.id === "prepare-sample-vial"));

    const result = evaluateTutorial(calibrationSampleTutorial, state, completed);
    const presentation = getTutorialStepPresentation(result.currentStep!, state);

    expect(result.currentStep?.id).toBe("prepare-sample-vial");
    expect(result.currentStep?.anchor(state)).toBe("palette-item-sample_vial_lcms");
    expect(presentation.title).toBe("Deploy an Autosampler vial");
  });

  it("points back to a prepared vial removed from the rack", () => {
    const sampleVial = labTool("sample_vial", {
      injectionContext: { sourceTubeId: "tube_1", sampleMassG: 10 },
      isSealed: true,
    });
    const calibrationVial = labTool("sample_vial", {
      id: "calibration_vial_1",
      calibrationContext: { levelNgPerMl: 10, compoundIds: ["boscalid"] },
      isSealed: true,
    });
    const state = experiment({
      workbench: { slots: [{ id: "station_1", label: "Station 1", tool: sampleVial }] },
      basketTools: [calibrationVial],
      workspace: {
        produceBasketLots: [],
        widgets: widgetIds.map((id) => widget(id, { isPresent: id === "rack" })),
      },
    });
    const completed = calibrationSampleTutorial.steps
      .map((entry) => entry.id)
      .slice(0, calibrationSampleTutorial.steps.findIndex((entry) => entry.id === "stage-vials"));

    const result = evaluateTutorial(calibrationSampleTutorial, state, completed);
    const presentation = getTutorialStepPresentation(result.currentStep!, state);

    expect(result.currentStep?.id).toBe("stage-vials");
    expect(result.currentStep?.anchor(state)).toBe("bench-tool-card-sample_vial_1");
    expect(presentation.title).toBe("Return the sample vial to the rack");
  });

  it("diagnoses missing consumables in their required order", () => {
    const grinderState = experiment({
      produceMaterialStates: [{ id: "state_1", produceLotId: "lot_1", materialState: "cut" }],
      workspace: {
        produceBasketLots: [],
        widgets: widgetIds.map((id) =>
          widget(id, {
            isPresent: id === "grinder",
            produceLots: id === "grinder"
              ? [{ id: "lot_1", label: "Cut apples", produceType: "apple", totalMassG: 2375.5, unitCount: 12, isDraggable: true, allowedDropTargets: [], materialState: "cut" }]
              : undefined,
          }),
        ),
      },
    });
    const grinderStep = calibrationSampleTutorial.steps.find((entry) => entry.id === "grind-sample")!;
    expect(grinderStep.anchor(grinderState)).toBe("palette-item-dry_ice_pellets");
    const presentation = getTutorialStepPresentation(grinderStep, grinderState);
    expect(presentation.title).toBe("Add Dry ice pellets");
    expect(presentation.instruction).toContain("2375.5 g");
    expect(presentation.action).toEqual({ kind: "drag", label: "Add 2375.5 g dry ice" });

    const extractionState = experiment({
      workbench: {
        slots: [{
          id: "station_1",
          label: "Station 1",
          tool: labTool("centrifuge_tube", {
            powderMassG: 10,
            liquids: [{ id: "istd_1", liquidId: "istd_solution", name: "ISTD", volume_ml: 0.05, accent: "emerald" }],
          }),
        }],
      },
    });
    const extractionStep = calibrationSampleTutorial.steps.find((entry) => entry.id === "prepare-extraction")!;
    expect(extractionStep.anchor(extractionState)).toBe("palette-item-acetonitrile_extraction");
    expect(getTutorialStepPresentation(extractionStep, extractionState).title).toBe("Add the extraction solvent");
  });

  it("highlights the apples themselves before they are loaded into the grinder", () => {
    const state = experiment({
      produceMaterialStates: [{ id: "state_1", produceLotId: "lot_1", materialState: "cut" }],
      workspace: {
        produceBasketLots: [{ id: "lot_1", label: "Apples", produceType: "apple", totalMassG: 2500, unitCount: 12, isDraggable: true, allowedDropTargets: [], materialState: "cut" }],
        widgets: widgetIds.map((id) => widget(id, { isPresent: id === "grinder" })),
      },
    });
    const tutorialStep = calibrationSampleTutorial.steps.find((entry) => entry.id === "grind-sample")!;

    expect(tutorialStep.anchor(state)).toBe("basket-produce-lot_1");
    expect(getTutorialStepPresentation(tutorialStep, state).action?.kind).toBe("drag");
  });

  it("shows novice cooling and power micro-actions for the grinder", () => {
    const grinderState = (temperatureC: number, remainingMs = 0) => experiment({
      workspace: {
        produceBasketLots: [],
        widgets: widgetIds.map((id) =>
          widget(id, {
            isPresent: id === "grinder",
            grinderRunRemainingMs: id === "grinder" ? remainingMs : undefined,
            produceLots: id === "grinder"
              ? [{ id: "lot_1", label: "Cut apples", produceType: "apple", totalMassG: 100, unitCount: 1, isDraggable: true, allowedDropTargets: [], materialState: "cut", temperatureC }]
              : undefined,
            liquids: id === "grinder"
              ? [{ id: "ice_1", liquidId: "dry_ice_pellets", name: "Dry ice", volume_ml: 1000, accent: "sky" }]
              : undefined,
          }),
        ),
      },
    });
    const tutorialStep = calibrationSampleTutorial.steps.find((entry) => entry.id === "grind-sample")!;

    const cooling = grinderState(-20);
    expect(tutorialStep.anchor(cooling)).toBe("temperature-lot_1");
    expect(getTutorialStepPresentation(tutorialStep, cooling).action).toEqual({ kind: "wait", label: "Wait until −45 °C" });

    const ready = grinderState(-50);
    expect(tutorialStep.anchor(ready)).toBe("grinder-power-button");
    expect(getTutorialStepPresentation(tutorialStep, ready).action).toEqual({ kind: "click", label: "Click power" });

    const running = grinderState(-50, 3000);
    expect(tutorialStep.anchor(running)).toBe("grinder-progress");
    expect(getTutorialStepPresentation(tutorialStep, running).action?.kind).toBe("wait");
  });

  it("highlights the LIMS store button before clearing reception equipment", () => {
    const labelledBag = sampleBag();
    labelledBag.labels = [{ id: "label_1", labelKind: "lims", text: "APP-1", sampleCode: "APP-1", isDraggable: true, allowedDropTargets: [] }];
    const state = experiment({
      limsReception: { ...experiment().limsReception, labSampleCode: "APP-1" },
      basketTools: [labelledBag],
      workspace: {
        produceBasketLots: [],
        widgets: widgetIds.map((id) => widget(id, { isPresent: id === "lims" || id === "gross_balance" })),
      },
    });
    const result = evaluateTutorial(calibrationSampleTutorial, state, ["weigh-received-sample", "register-and-label-sample"]);

    expect(result.currentStep?.anchor(state)).toBe("store-widget-lims");
    expect(getTutorialStepPresentation(result.currentStep!, state).title).toBe("Store the LIMS terminal");
  });

  it("asks to open the sample bag before moving its apples to the cutting board", () => {
    const bag = sampleBag();
    bag.isSealed = true;
    bag.produceLots = [{
      id: "lot_1",
      label: "Apples",
      produceType: "apple",
      totalMassG: 2500,
      unitCount: 12,
      isDraggable: false,
      allowedDropTargets: [],
      materialState: "whole",
    }];
    const board = labTool("storage_jar", {
      id: "board_1",
      toolType: "cutting_board",
      produceLots: [],
    });
    const state = experiment({
      workbench: {
        slots: [
          { id: "station_1", label: "Station 1", tool: bag },
          { id: "station_2", label: "Station 2", tool: board },
        ],
      },
    });
    const tutorialStep = calibrationSampleTutorial.steps.find(
      (entry) => entry.id === "cut-sample",
    )!;

    expect(tutorialStep.anchor(state)).toBe("seal-tool-bag_1");
    expect(getTutorialStepPresentation(tutorialStep, state)).toMatchObject({
      title: "Open the sample bag",
      action: { kind: "click", label: "Click Open" },
    });

    bag.isSealed = false;
    expect(tutorialStep.anchor(state)).toBe("bench-produce-lot-lot_1");
    expect(getTutorialStepPresentation(tutorialStep, state).title).toBe(
      "Place the apples on the Cutting board",
    );
  });

  it("asks for another workbench station before deploying the storage jar", () => {
    const fullWorkbench = {
      slots: [
        { id: "station_1", label: "Station 1", tool: sampleBag() },
        {
          id: "station_2",
          label: "Station 2",
          tool: labTool("storage_jar", { id: "board_1", toolType: "cutting_board" }),
        },
      ],
    };
    const state = experiment({
      workbench: fullWorkbench,
      workspace: {
        produceBasketLots: [],
        widgets: widgetIds.map((id) =>
          widget(id, {
            isPresent: id === "grinder",
            produceLots: id === "grinder"
              ? [{ id: "lot_1", label: "Ground apples", produceType: "apple", totalMassG: 2500, unitCount: null, isDraggable: true, allowedDropTargets: [], materialState: "ground" }]
              : undefined,
          }),
        ),
      },
    });
    const tutorialStep = calibrationSampleTutorial.steps.find(
      (entry) => entry.id === "store-grinder",
    )!;

    expect(tutorialStep.anchor(state)).toBe("add-workbench-slot-button");
    expect(getTutorialStepPresentation(tutorialStep, state)).toMatchObject({
      title: "Add a workbench station",
      action: { kind: "click", label: "Click +" },
    });

    state.workbench.slots.push({ id: "station_3", label: "Station 3", tool: null });
    expect(tutorialStep.anchor(state)).toBe("palette-item-hdpe_storage_jar_2l");
  });

  it("continues after the analytical balance reports a tare mass", () => {
    const tube = labTool("centrifuge_tube");
    const powderJar = labTool("storage_jar", { id: "powder_jar" });
    const state = experiment({
      analyticalBalance: { tareMassG: 12, taredToolId: null },
      workbench: {
        slots: [{ id: "station_1", label: "Station 1", tool: powderJar }],
      },
      workspace: {
        produceBasketLots: [],
        widgets: widgetIds.map((id) =>
          widget(id, {
            isPresent: id === "analytical_balance",
            tool: id === "analytical_balance" ? tube : undefined,
          }),
        ),
      },
    });
    const tutorialStep = calibrationSampleTutorial.steps.find(
      (entry) => entry.id === "weigh-test-portion",
    )!;

    expect(tutorialStep.anchor(state)).toBe(
      "spatula-load-powder:bench-tool-card-powder_jar",
    );
    expect(getTutorialStepPresentation(tutorialStep, state).title).toBe(
      "Add the test portion",
    );
  });

  it("recovers a tube removed during analytical weighing", () => {
    const tube = labTool("centrifuge_tube");
    const state = experiment({
      trash: { ...experiment().trash, children: [tube] },
      workspace: {
        produceBasketLots: [],
        widgets: widgetIds.map((id) => widget(id, { isPresent: id === "analytical_balance" })),
      },
    });
    const tutorialStep = calibrationSampleTutorial.steps.find((entry) => entry.id === "weigh-test-portion")!;

    expect(tutorialStep.anchor(state)).toBe("trash-tool-centrifuge_tube_1");
    expect(getTutorialStepPresentation(tutorialStep, state).title).toBe("Return the tube to the Analytical balance");
  });

  it("ignores a compromised trashed tube and asks for a fresh one", () => {
    const compromisedTube = labTool("centrifuge_tube", {
      id: "compromised_tube",
      produceFractions: [
        {
          id: "powder_1",
          produceLotId: "lot_1",
          produceMaterialStateId: "ground_1",
          massG: 2,
        },
      ],
    });
    const state = experiment({
      analyticalBalance: { tareMassG: 14, taredToolId: null },
      trash: { ...experiment().trash, children: [compromisedTube] },
      workspace: {
        produceBasketLots: [],
        widgets: widgetIds.map((id) => widget(id, { isPresent: id === "analytical_balance" })),
      },
    });
    const tutorialStep = calibrationSampleTutorial.steps.find(
      (entry) => entry.id === "weigh-test-portion",
    )!;

    expect(tutorialStep.anchor(state)).toBe("palette-item-centrifuge_tube_50ml");
    expect(getTutorialStepPresentation(tutorialStep, state).title).toBe(
      "Deploy a replacement 50 mL tube",
    );
  });

  it("asks to tare a fresh replacement tube instead of recovering the compromised one", () => {
    const compromisedTube = labTool("centrifuge_tube", {
      id: "compromised_tube",
      produceFractions: [
        {
          id: "powder_1",
          produceLotId: "lot_1",
          produceMaterialStateId: "ground_1",
          massG: 2,
        },
      ],
    });
    const replacementTube = labTool("centrifuge_tube", { id: "replacement_tube" });
    const state = experiment({
      analyticalBalance: { tareMassG: 14, taredToolId: null },
      trash: { ...experiment().trash, children: [compromisedTube] },
      workspace: {
        produceBasketLots: [],
        widgets: widgetIds.map((id) =>
          widget(id, {
            isPresent: id === "analytical_balance",
            tool: id === "analytical_balance" ? replacementTube : undefined,
          }),
        ),
      },
    });
    const tutorialStep = calibrationSampleTutorial.steps.find(
      (entry) => entry.id === "weigh-test-portion",
    )!;

    expect(tutorialStep.anchor(state)).toBe("analytical-balance-tare");
    expect(getTutorialStepPresentation(tutorialStep, state).title).toBe(
      "Tare the replacement tube",
    );
  });

  it("does not validate 10 g of powder against a tare taken after dosing", () => {
    const tube = labTool("centrifuge_tube", {
      id: "compromised_tube",
      produceFractions: [
        {
          id: "powder_1",
          produceLotId: "lot_1",
          produceMaterialStateId: "ground_1",
          massG: 10,
        },
      ],
    });
    const state = experiment({
      analyticalBalance: { tareMassG: 22, taredToolId: null },
      workspace: {
        produceBasketLots: [],
        widgets: widgetIds.map((id) =>
          widget(id, {
            isPresent: id === "analytical_balance",
            tool: id === "analytical_balance" ? tube : undefined,
          }),
        ),
      },
    });
    const tutorialStep = calibrationSampleTutorial.steps.find(
      (entry) => entry.id === "weigh-test-portion",
    )!;

    expect(tutorialStep.isSatisfied(state)).toBe(false);
    expect(tutorialStep.anchor(state)).toBe("widget-analytical_balance");
    expect(getTutorialStepPresentation(tutorialStep, state).title).toBe(
      "Replace the compromised tube",
    );

    state.analyticalBalance.tareMassG = 12;
    expect(tutorialStep.isSatisfied(state)).toBe(true);
  });

  it("guides final cleanup from the instrument while the rack is loaded", () => {
    const state = experiment({
      rack: { ...experiment().rack, state: "loaded" },
      workspace: {
        produceBasketLots: [],
        widgets: widgetIds.map((id) => widget(id, { isPresent: id === "rack" || id === "instrument" })),
      },
    });
    const tutorialStep = calibrationSampleTutorial.steps.find((entry) => entry.id === "store-acquisition-equipment")!;

    expect(tutorialStep.anchor(state)).toBe("instrument-unload-rack");
    expect(getTutorialStepPresentation(tutorialStep, state).title).toBe("Unload the rack");
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
    expect(result.currentStep?.anchor(result.experiment)).toBe("store-widget-gross_balance");
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
