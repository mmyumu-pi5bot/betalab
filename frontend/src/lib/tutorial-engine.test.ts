import { describe, expect, it } from "vitest";

import {
  CALIBRATION_SAMPLE_TUTORIAL_ID,
  calibrationSampleTutorial,
  evaluateTutorial,
  getLimsTutorialFieldPresentation,
  getLimsTutorialValues,
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
  "ice_bath",
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

  it("explains how gross mass, packaging tare, and received net mass relate", () => {
    const state = experiment({
      limsReception: {
        ...experiment().limsReception,
        measuredGrossMassG: 2536,
        packagingTareMassG: 36,
      },
    });

    expect(getLimsTutorialValues(state)).toMatchObject({
      measuredGrossMassG: 2536,
      packagingTareMassG: 36,
      measuredNetMassG: 2500,
    });
    expect(getLimsTutorialFieldPresentation(state, "mass-summary")).toMatchObject({
      title: "Review the reception weighing",
      action: { kind: "click", label: "Review the mass calculation" },
    });
    expect(
      getLimsTutorialFieldPresentation(state, "mass-summary").instruction,
    ).toContain("2536.0 g − 36.0 g = 2500.0 g");
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
    const state = experiment({
      workbench: { slots: [{ id: "station_1", label: "Station 1", tool: null }] },
    });
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
    // Dosing dry ice to the tenth of a gram is busywork: the tutorial rounds the
    // 1:1 target to the nearest 100 g so the learner types a round number.
    expect(presentation.instruction).toContain("2400 g");
    expect(presentation.action).toEqual({ kind: "drag", label: "Add 2400 g dry ice" });

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

  describe("chilling the tube before the salts", () => {
    const stepNamed = (id: string) => calibrationSampleTutorial.steps.find((entry) => entry.id === id)!;

    function reagentedTube(temperatureC: number) {
      return labTool("centrifuge_tube", {
        powderMassG: 10,
        produceFractions: [
          {
            id: "fraction_1",
            produceLotId: "lot_1",
            produceMaterialStateId: "state_1",
            massG: 10,
          },
        ],
        liquids: [
          { id: "istd_1", liquidId: "istd_solution", name: "ISTD", volume_ml: 0.05, accent: "emerald" },
          { id: "mecn_1", liquidId: "acetonitrile_extraction", name: "MeCN", volume_ml: 10, accent: "sky" },
        ],
        quechersState: {
          saltsAdded: false,
          phase: "idle",
          temperatureC,
          faults: [],
          isUsable: true,
        },
      });
    }

    function chillingState({
      bathDeployed = true,
      inBath,
      temperatureC,
    }: {
      bathDeployed?: boolean;
      inBath: boolean;
      temperatureC: number;
    }) {
      const tube = reagentedTube(temperatureC);
      return experiment({
        workbench: {
          slots: [{ id: "station_1", label: "Station 1", tool: inBath ? null : tube }],
        },
        workspace: {
          produceBasketLots: [],
          widgets: widgetIds.map((id) =>
            widget(id, {
              isPresent: id === "vortex" || (id === "ice_bath" && bathDeployed),
              tool: id === "ice_bath" && inBath ? tube : null,
            }),
          ),
        },
      });
    }

    it("asks for the ice bath once the mixer is standing by", () => {
      const state = chillingState({ bathDeployed: false, inBath: false, temperatureC: 20 });

      expect(stepNamed("chill-extraction").anchor(state)).toBe("palette-item-ice_bath_widget");
      expect(stepNamed("chill-extraction").dropAnchor?.(state)).toBe("workspace");
      expect(getTutorialStepPresentation(stepNamed("chill-extraction"), state).title).toBe(
        "Deploy the ice bath before the salts",
      );
    });

    it("sends the warm tube into the deployed bath", () => {
      const state = chillingState({ inBath: false, temperatureC: 20 });

      expect(stepNamed("chill-extraction").anchor(state)).toBe("bench-tool-card-centrifuge_tube_1");
      expect(stepNamed("chill-extraction").dropAnchor?.(state)).toBe("widget-ice_bath");
      expect(getTutorialStepPresentation(stepNamed("chill-extraction"), state).action).toEqual({
        kind: "drag",
        label: "Drag the tube into the ice bath",
      });
    });

    it("waits on the temperature instead of on a clock", () => {
      const state = chillingState({ inBath: true, temperatureC: 12 });

      expect(stepNamed("chill-extraction").isSatisfied(state)).toBe(false);
      expect(stepNamed("chill-extraction").anchor(state)).toBe("widget-ice_bath");
      expect(stepNamed("chill-extraction").dropAnchor?.(state)).toBeNull();
      expect(getTutorialStepPresentation(stepNamed("chill-extraction"), state).action?.kind).toBe("wait");
    });

    // The tube starts warming the instant it leaves the ice, so a step that re-read the
    // temperature would send the learner straight back to the bath, forever.
    it("stays satisfied once the tube has been read cold, even after it warms again", () => {
      expect(stepNamed("chill-extraction").isSatisfied(chillingState({ inBath: true, temperatureC: 0.4 }))).toBe(true);

      const warmedOnTheBench = chillingState({ inBath: false, temperatureC: 6 });
      const result = evaluateTutorial(calibrationSampleTutorial, warmedOnTheBench, [
        "weigh-received-sample",
        "register-and-label-sample",
        "store-gross-balance",
        "cut-sample",
        "grind-sample",
        "store-grinder",
        "weigh-test-portion",
        "store-analytical-balance",
        "prepare-extraction",
        "chill-extraction",
      ]);

      expect(result.completedStepIds).toContain("chill-extraction");
      expect(result.currentStep?.id).toBe("salt-extraction");
    });

    it("takes the chilled tube back out, because salts cannot go in through the ice", () => {
      const state = chillingState({ inBath: true, temperatureC: 0.4 });

      expect(stepNamed("salt-extraction").anchor(state)).toBe("widget-ice_bath");
      expect(stepNamed("salt-extraction").dropAnchor?.(state)).toBe("bench-slot-station_1");
      expect(getTutorialStepPresentation(stepNamed("salt-extraction"), state).title).toBe(
        "Take the chilled tube back out",
      );
    });

    it("points at the salts once the tube is back on the bench", () => {
      const state = chillingState({ inBath: false, temperatureC: 4 });

      expect(stepNamed("salt-extraction").anchor(state)).toBe("palette-item-quechers_salts");
      expect(stepNamed("salt-extraction").dropAnchor?.(state)).toBe("bench-tool-card-centrifuge_tube_1");
    });

    it("says why the cold matters, not just that it is required", () => {
      const state = chillingState({ bathDeployed: false, inBath: false, temperatureC: 20 });
      const presentation = getTutorialStepPresentation(stepNamed("chill-extraction"), state);

      expect(presentation.instruction).toContain("exotherm");
      expect(`${presentation.instruction} ${presentation.hint}`).toContain("30 °C");
    });

    it("puts the bath away with the mixer, once the cold protects nothing", () => {
      const storeStep = stepNamed("store-vortex");
      const mixedTube = labTool("centrifuge_tube", {
        id: "mixed_tube",
        quechersState: { saltsAdded: true, phase: "mixed", faults: [], isUsable: true },
      });
      const state = (bathIsPresent: boolean) =>
        experiment({
          workbench: { slots: [{ id: "station_1", label: "Station 1", tool: mixedTube }] },
          workspace: {
            produceBasketLots: [],
            widgets: widgetIds.map((id) => widget(id, { isPresent: id === "ice_bath" && bathIsPresent })),
          },
        });

      expect(storeStep.isSatisfied(state(true))).toBe(false);
      expect(storeStep.anchor(state(true))).toBe("store-widget-ice_bath");
      expect(getTutorialStepPresentation(storeStep, state(true)).title).toBe("Store the Ice bath");
      expect(storeStep.isSatisfied(state(false))).toBe(true);
    });
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
    expect(getTutorialStepPresentation(tutorialStep, cooling).action).toEqual({ kind: "wait", label: "Wait until −70 °C" });

    // −50 °C used to be "cold enough" and produced a granular grind. The step
    // must keep waiting there now, and only release inside the fine-powder band.
    const stillTooWarm = grinderState(-50);
    expect(tutorialStep.anchor(stillTooWarm)).toBe("temperature-lot_1");
    expect(getTutorialStepPresentation(tutorialStep, stillTooWarm).action).toEqual({
      kind: "wait",
      label: "Wait until −70 °C",
    });

    const ready = grinderState(-72);
    expect(tutorialStep.anchor(ready)).toBe("grinder-power-button");
    expect(getTutorialStepPresentation(tutorialStep, ready).action).toEqual({ kind: "click", label: "Click power" });

    const running = grinderState(-72, 3000);
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

  it("validates the stored analytical balance once the weighed tube sits on the workbench", () => {
    // Storing the balance requires taking the tube off the pan first, so the test
    // portion has to be recognised wherever the tube now stands.
    const weighedTube = labTool("centrifuge_tube", { powderMassG: 10.002 });
    const state = experiment({
      analyticalBalance: { tareMassG: 12, taredToolId: "centrifuge_tube_1" },
      workbench: { slots: [{ id: "station_1", label: "Station 1", tool: weighedTube }] },
    });
    const completed = calibrationSampleTutorial.steps
      .map((entry) => entry.id)
      .slice(
        0,
        calibrationSampleTutorial.steps.findIndex(
          (entry) => entry.id === "weigh-test-portion",
        ),
      );

    const result = evaluateTutorial(calibrationSampleTutorial, state, completed);

    expect(result.completedStepIds).toContain("weigh-test-portion");
    expect(result.completedStepIds).toContain("store-analytical-balance");
    expect(result.currentStep?.id).toBe("prepare-extraction");
  });

  it("asks for a workbench station whenever the next item has nowhere to land", () => {
    const fullWorkbench = {
      slots: [{
        id: "station_1",
        label: "Station 1",
        tool: labTool("storage_jar", { id: "powder_jar" }),
      }],
    };

    const weighedTube = labTool("centrifuge_tube", { powderMassG: 10.002 });
    const storeBalanceState = experiment({
      analyticalBalance: { tareMassG: 12, taredToolId: "centrifuge_tube_1" },
      workbench: fullWorkbench,
      workspace: {
        produceBasketLots: [],
        widgets: widgetIds.map((id) =>
          widget(id, {
            isPresent: id === "analytical_balance",
            tool: id === "analytical_balance" ? weighedTube : undefined,
          }),
        ),
      },
    });
    const storeBalanceStep = calibrationSampleTutorial.steps.find(
      (entry) => entry.id === "store-analytical-balance",
    )!;
    expect(storeBalanceStep.anchor(storeBalanceState)).toBe("add-workbench-slot-button");
    expect(getTutorialStepPresentation(storeBalanceStep, storeBalanceState)).toMatchObject({
      title: "Add a workbench station",
      action: { kind: "click", label: "Click +" },
    });

    const cutState = experiment({ workbench: fullWorkbench });
    const cutStep = calibrationSampleTutorial.steps.find((entry) => entry.id === "cut-sample")!;
    expect(cutStep.anchor(cutState)).toBe("add-workbench-slot-button");
    expect(getTutorialStepPresentation(cutStep, cutState).title).toBe("Add a workbench station");

    const vialState = experiment({ workbench: fullWorkbench });
    const vialStep = calibrationSampleTutorial.steps.find(
      (entry) => entry.id === "prepare-sample-vial",
    )!;
    expect(vialStep.anchor(vialState)).toBe("add-workbench-slot-button");
    expect(getTutorialStepPresentation(vialStep, vialState).title).toBe(
      "Add a workbench station",
    );

    const freeWorkbench = {
      slots: [...fullWorkbench.slots, { id: "station_2", label: "Station 2", tool: null }],
    };
    expect(cutStep.anchor(experiment({ workbench: freeWorkbench }))).toBe(
      "palette-item-cutting_board_hdpe",
    );
    expect(vialStep.anchor(experiment({ workbench: freeWorkbench }))).toBe(
      "palette-item-sample_vial_lcms",
    );
    expect(
      storeBalanceStep.anchor({ ...storeBalanceState, workbench: freeWorkbench }),
    ).toBe("widget-analytical_balance");
  });

  it("brings the separated tube to the bench and opens it before pipetting", () => {
    const separatedTube = (overrides: Record<string, unknown> = {}) =>
      labTool("centrifuge_tube", {
        isSealed: true,
        quechersState: { saltsAdded: true, phase: "separated", faults: [], isUsable: true },
        ...overrides,
      });
    const vialSlot = {
      id: "station_1",
      label: "Station 1",
      tool: labTool("sample_vial", { id: "vial_1" }),
    };
    const freeSlot = { id: "station_2", label: "Station 2", tool: null };
    const step = calibrationSampleTutorial.steps.find(
      (entry) => entry.id === "prepare-sample-vial",
    )!;

    const inCentrifuge = experiment({
      workbench: { slots: [vialSlot, freeSlot] },
      workspace: {
        produceBasketLots: [],
        widgets: widgetIds.map((id) =>
          widget(id, {
            isPresent: id === "centrifuge",
            tool: id === "centrifuge" ? separatedTube() : undefined,
          }),
        ),
      },
    });
    expect(step.anchor(inCentrifuge)).toBe("widget-centrifuge");
    expect(getTutorialStepPresentation(step, inCentrifuge).title).toBe(
      "Take the tube out of the centrifuge",
    );

    const sealedOnBench = experiment({
      workbench: {
        slots: [vialSlot, { ...freeSlot, tool: separatedTube() }],
      },
    });
    expect(step.anchor(sealedOnBench)).toBe("seal-tool-centrifuge_tube_1");
    expect(getTutorialStepPresentation(step, sealedOnBench).title).toBe(
      "Open the extraction tube",
    );

    const openOnBench = experiment({
      workbench: {
        slots: [vialSlot, { ...freeSlot, tool: separatedTube({ isSealed: false }) }],
      },
    });
    expect(step.anchor(openOnBench)).toBe("pipette-aspirate");
  });

  it("unloads the rack from the LC-MS/MS before emptying it", () => {
    const step = calibrationSampleTutorial.steps.find(
      (entry) => entry.id === "store-acquisition-equipment",
    )!;
    const rackWithVials = (state: "loaded" | "locked" | "completed" | "available") => ({
      allowedDropTargets: [],
      isDraggable: true,
      state,
      slots: [{ id: "rack_1", label: "A1", tool: labTool("sample_vial", { id: "vial_1" }) }],
    });

    // A finished run leaves the rack "completed", still sitting in the instrument.
    for (const state of ["loaded", "completed"] as const) {
      const inInstrument = experiment({ rack: rackWithVials(state) });
      expect(step.anchor(inInstrument), state).toBe("instrument-unload-rack");
      expect(getTutorialStepPresentation(step, inInstrument).title, state).toBe(
        "Unload the rack",
      );
    }

    const onWorkspace = experiment({ rack: rackWithVials("available") });
    expect(step.anchor(onWorkspace)).toBe("widget-rack");
    expect(getTutorialStepPresentation(step, onWorkspace).title).toBe(
      "Empty the Autosampler rack",
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
    expect(result.progressPercent).toBe(10);
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
  describe("drop destinations", () => {
    const stepById = (stepId: string) =>
      calibrationSampleTutorial.steps.find((entry) => entry.id === stepId)!;

    it("points a palette deployment at the workspace canvas", () => {
      const tutorialStep = stepById("weigh-received-sample");
      const state = experiment();

      expect(tutorialStep.anchor(state)).toBe("palette-item-gross_balance_widget");
      expect(tutorialStep.dropAnchor?.(state)).toBe("workspace");
    });

    it("points the sample bag at the deployed gross balance, then stops once it is weighed", () => {
      const tutorialStep = stepById("weigh-received-sample");
      const withBalance = {
        produceBasketLots: [],
        widgets: widgetIds.map((id) => widget(id, { isPresent: id === "gross_balance" })),
      };
      const bagInBasket = experiment({
        basketTools: [sampleBag()],
        workspace: withBalance,
      });

      expect(tutorialStep.anchor(bagInBasket)).toBe("basket-received-bag");
      expect(tutorialStep.dropAnchor?.(bagInBasket)).toBe("widget-gross_balance");

      const bagOnBalance = experiment({
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

      expect(tutorialStep.anchor(bagOnBalance)).toBe("widget-gross_balance");
      expect(tutorialStep.dropAnchor?.(bagOnBalance)).toBeNull();
    });

    it("points a bench placement at the first free station, and nowhere when there is none", () => {
      const tutorialStep = stepById("cut-sample");
      const occupiedStation = {
        id: "station_1",
        label: "Station 1",
        tool: labTool("storage_jar", { id: "powder_jar" }),
      };
      const freeBench = experiment({
        workbench: {
          slots: [occupiedStation, { id: "station_2", label: "Station 2", tool: null }],
        },
      });

      expect(tutorialStep.anchor(freeBench)).toBe("palette-item-cutting_board_hdpe");
      expect(tutorialStep.dropAnchor?.(freeBench)).toBe("bench-slot-station_2");

      const fullBench = experiment({ workbench: { slots: [occupiedStation] } });

      expect(tutorialStep.anchor(fullBench)).toBe("add-workbench-slot-button");
      expect(tutorialStep.dropAnchor?.(fullBench)).toBeNull();
    });

    it("points the apples at the cutting board wherever the board stands", () => {
      const bag = labTool("storage_jar", {
        id: "bag_1",
        toolType: "sample_bag",
        isSealed: false,
        produceLots: [
          {
            id: "lot_1",
            produceId: "apple",
            label: "Apples",
            totalMassG: 2000,
            unitCount: 12,
            isDraggable: true,
            allowedDropTargets: [],
            materialState: "whole",
          },
        ],
      });
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
      const tutorialStep = stepById("cut-sample");

      expect(tutorialStep.anchor(state)).toBe("bench-produce-lot-lot_1");
      expect(tutorialStep.dropAnchor?.(state)).toBe("bench-tool-card-board_1");
    });

    it("sends a compromised analytical tube to the trash", () => {
      const compromisedTube = labTool("centrifuge_tube", {
        id: "compromised_tube",
        powderMassG: 2,
      });
      const state = experiment({
        analyticalBalance: { tareMassG: 14, taredToolId: null },
        workspace: {
          produceBasketLots: [],
          widgets: widgetIds.map((id) =>
            widget(id, {
              isPresent: id === "analytical_balance",
              tool: id === "analytical_balance" ? compromisedTube : undefined,
            }),
          ),
        },
      });
      const tutorialStep = stepById("weigh-test-portion");

      expect(tutorialStep.anchor(state)).toBe("widget-analytical_balance");
      expect(tutorialStep.dropAnchor?.(state)).toBe("trash-dropzone");
    });

    it("points the loaded rack at the instrument, and nothing once it is loaded", () => {
      const tutorialStep = stepById("launch-sequence");
      const deployed = {
        produceBasketLots: [],
        widgets: widgetIds.map((id) =>
          widget(id, { isPresent: id === "instrument" || id === "rack" }),
        ),
      };
      const state = experiment({ workspace: deployed });

      expect(tutorialStep.anchor(state)).toBe("widget-rack");
      expect(tutorialStep.dropAnchor?.(state)).toBe("widget-instrument");

      const loaded = experiment({
        rack: { ...experiment().rack, state: "loaded" },
        workspace: deployed,
      });

      expect(tutorialStep.anchor(loaded)).toBe("instrument-console-next");
      expect(tutorialStep.dropAnchor?.(loaded)).toBeNull();
    });

    it("never points a click-only sub-step at a drop destination", () => {
      const state = experiment();

      for (const tutorialStep of calibrationSampleTutorial.steps) {
        const dropAnchor = tutorialStep.dropAnchor?.(state) ?? null;
        if (dropAnchor === null) {
          continue;
        }
        expect(dropAnchor, tutorialStep.id).not.toBe(tutorialStep.anchor(state));
      }
    });
  });
  describe("recovery from a cemented extraction tube", () => {
    // The QuEChERS salts set hard 15 s after touching the solvent. The tube is then
    // unusable for good, and the vortex refuses to start on it, so the tutorial has
    // to drop that tube and walk the learner back to a fresh test portion.
    const beforeExtraction = [
      "weigh-received-sample",
      "register-and-label-sample",
      "store-gross-balance",
      "cut-sample",
      "grind-sample",
      "store-grinder",
      "weigh-test-portion",
      "store-analytical-balance",
      "prepare-extraction",
    ];

    function cementedTube(overrides: Record<string, unknown> = {}) {
      return labTool("centrifuge_tube", {
        id: "cemented_tube",
        powderMassG: 10.002,
        liquids: [
          { liquidId: "istd_solution", label: "ISTD", volume_ml: 0.05 },
          { liquidId: "acetonitrile_extraction", label: "MeCN", volume_ml: 10 },
        ],
        quechersState: {
          saltsAdded: true,
          phase: "cemented",
          faults: ["cemented"],
          isUsable: false,
        },
        ...overrides,
      });
    }

    function powderJar() {
      return labTool("storage_jar", { id: "powder_jar", powderMassG: 900 });
    }

    it("rewinds to the test portion instead of leaving the learner on the vortex", () => {
      const state = experiment({
        analyticalBalance: { tareMassG: 12, taredToolId: "cemented_tube" },
        workbench: {
          slots: [
            { id: "station_1", label: "Station 1", tool: cementedTube() },
            { id: "station_2", label: "Station 2", tool: powderJar() },
          ],
        },
      });

      const result = evaluateTutorial(calibrationSampleTutorial, state, beforeExtraction);

      expect(result.currentStep?.id).toBe("weigh-test-portion");
      expect(result.completedStepIds).not.toContain("weigh-test-portion");
      expect(result.completedStepIds).not.toContain("prepare-extraction");
    });

    it("explains what went wrong and sends the dead tube to the trash", () => {
      const state = experiment({
        analyticalBalance: { tareMassG: 12, taredToolId: "cemented_tube" },
        workbench: {
          slots: [
            { id: "station_1", label: "Station 1", tool: cementedTube() },
            { id: "station_2", label: "Station 2", tool: powderJar() },
          ],
        },
      });

      const result = evaluateTutorial(calibrationSampleTutorial, state, beforeExtraction);
      const presentation = getTutorialStepPresentation(result.currentStep!, state);

      expect(presentation.title).toBe("The QuEChERS salts set hard");
      expect(presentation.instruction).toContain("15 seconds");
      expect(presentation.instruction).toContain("vortex");
      expect(presentation.instruction).toContain("Discard");
      expect(presentation.hint).toContain("ground sample");
      expect(result.currentStep?.anchor(state)).toBe("bench-tool-card-cemented_tube");
      expect(result.currentStep?.dropAnchor?.(state)).toBe("trash-dropzone");
    });

    it("reaches a tube cemented inside the vortex mixer", () => {
      const state = experiment({
        analyticalBalance: { tareMassG: 12, taredToolId: "cemented_tube" },
        workbench: { slots: [{ id: "station_1", label: "Station 1", tool: powderJar() }] },
        workspace: {
          produceBasketLots: [],
          widgets: widgetIds.map((id) =>
            widget(id, {
              isPresent: id === "vortex",
              tool: id === "vortex" ? cementedTube() : undefined,
            }),
          ),
        },
      });

      const result = evaluateTutorial(calibrationSampleTutorial, state, beforeExtraction);

      expect(result.currentStep?.id).toBe("weigh-test-portion");
      expect(result.currentStep?.anchor(state)).toBe("widget-vortex");
      expect(result.currentStep?.dropAnchor?.(state)).toBe("trash-dropzone");
    });

    it("stops counting the discarded tube as the tube being prepared", () => {
      // Trash retains what it is given, so the dead tube stays reachable forever. It
      // must not keep answering for "the extraction tube" once it is in there.
      const state = experiment({
        analyticalBalance: { tareMassG: 12, taredToolId: "cemented_tube" },
        trash: { ...experiment().trash, children: [cementedTube()] },
        workbench: { slots: [{ id: "station_1", label: "Station 1", tool: powderJar() }] },
      });

      const result = evaluateTutorial(calibrationSampleTutorial, state, beforeExtraction);
      const presentation = getTutorialStepPresentation(result.currentStep!, state);

      expect(result.currentStep?.id).toBe("weigh-test-portion");
      expect(presentation.title).toBe("Deploy the Analytical balance");
      expect(result.currentStep?.anchor(state)).toBe(
        "palette-item-analytical_balance_widget",
      );
    });

    it("lets the tutorial run to the end again once a fresh portion is weighed", () => {
      // The retained tube must not invalidate the chapter for good: a replacement
      // portion has to carry the learner forward exactly as the first one did.
      const state = experiment({
        analyticalBalance: { tareMassG: 12, taredToolId: "fresh_tube" },
        trash: { ...experiment().trash, children: [cementedTube()] },
        workbench: {
          slots: [
            {
              id: "station_1",
              label: "Station 1",
              tool: labTool("centrifuge_tube", { id: "fresh_tube", powderMassG: 10.001 }),
            },
          ],
        },
      });

      const result = evaluateTutorial(calibrationSampleTutorial, state, beforeExtraction);

      expect(result.completedStepIds).toContain("weigh-test-portion");
      expect(result.completedStepIds).toContain("store-analytical-balance");
      expect(result.currentStep?.id).toBe("prepare-extraction");
      expect(result.currentStep?.anchor(state)).toBe("palette-item-istd_solution");
      expect(result.currentStep?.dropAnchor?.(state)).toBe("bench-tool-card-fresh_tube");
    });

    it("recovers the same way from a tube vortexed without being sealed", () => {
      const contaminated = cementedTube({
        id: "spilled_tube",
        quechersState: {
          saltsAdded: true,
          phase: "contaminated",
          faults: ["vortexed_open"],
          isUsable: false,
        },
      });
      const state = experiment({
        analyticalBalance: { tareMassG: 12, taredToolId: "spilled_tube" },
        workbench: {
          slots: [
            { id: "station_1", label: "Station 1", tool: contaminated },
            { id: "station_2", label: "Station 2", tool: powderJar() },
          ],
        },
      });

      const result = evaluateTutorial(calibrationSampleTutorial, state, beforeExtraction);
      const presentation = getTutorialStepPresentation(result.currentStep!, state);

      expect(result.currentStep?.id).toBe("weigh-test-portion");
      expect(presentation.title).toBe("The extraction tube is lost");
      expect(presentation.instruction).toContain("Discard");
      expect(result.currentStep?.anchor(state)).toBe("bench-tool-card-spilled_tube");
    });
  });
  describe("warning before the QuEChERS salts are added", () => {
    // Adding the salts starts a 15 s countdown to cementation. Sending the learner
    // to fetch the mixer from the Inventory afterwards makes that window unwinnable,
    // so the mixer is deployed first and the deadline is announced before it starts.
    const beforeSalts = [
      "weigh-received-sample",
      "register-and-label-sample",
      "store-gross-balance",
      "cut-sample",
      "grind-sample",
      "store-grinder",
      "weigh-test-portion",
      "store-analytical-balance",
    ];

    // Already chilled: the ice bath sub-steps have their own tests, and these ones
    // are about the deadline the salts start.
    function wettedTube() {
      return labTool("centrifuge_tube", {
        id: "extraction_tube",
        powderMassG: 10.002,
        liquids: [
          { liquidId: "istd_solution", label: "ISTD", volume_ml: 0.05 },
          { liquidId: "acetonitrile_extraction", label: "MeCN", volume_ml: 10 },
        ],
        quechersState: {
          saltsAdded: false,
          phase: "idle",
          temperatureC: 3,
          faults: [],
          isUsable: true,
        },
        produceFractions: [
          {
            id: "fraction_1",
            produceLotId: "lot_1",
            produceMaterialStateId: "state_1",
            massG: 10.002,
          },
        ],
      });
    }

    function stateWith(vortexIsPresent: boolean) {
      return experiment({
        analyticalBalance: { tareMassG: 12, taredToolId: "extraction_tube" },
        workbench: {
          slots: [{ id: "station_1", label: "Station 1", tool: wettedTube() }],
        },
        workspace: {
          produceBasketLots: [],
          widgets: widgetIds.map((id) =>
            widget(id, { isPresent: vortexIsPresent && id === "vortex" }),
          ),
        },
      });
    }

    it("asks for the vortex mixer before the salts rather than after them", () => {
      const state = stateWith(false);

      const result = evaluateTutorial(calibrationSampleTutorial, state, beforeSalts);
      const presentation = getTutorialStepPresentation(result.currentStep!, state);

      expect(result.currentStep?.id).toBe("prepare-extraction");
      expect(result.currentStep?.anchor(state)).toBe("palette-item-vortex_mixer_widget");
      expect(result.currentStep?.dropAnchor?.(state)).toBe("workspace");
      expect(presentation.title).toBe("Deploy the Vortex mixer before the salts");
      expect(presentation.instruction).toContain("15 seconds");
    });

    it("announces the deadline on the salts themselves once the mixer is ready", () => {
      const state = stateWith(true);

      const result = evaluateTutorial(calibrationSampleTutorial, state, [
        ...beforeSalts,
        "prepare-extraction",
        "chill-extraction",
      ]);
      const presentation = getTutorialStepPresentation(result.currentStep!, state);

      expect(result.currentStep?.id).toBe("salt-extraction");
      expect(result.currentStep?.anchor(state)).toBe("palette-item-quechers_salts");
      expect(result.currentStep?.dropAnchor?.(state)).toBe(
        "bench-tool-card-extraction_tube",
      );
      expect(presentation.title).toBe("Add the QuEChERS salts");
      expect(presentation.instruction).toContain("15 seconds");
      expect(presentation.hint).toContain("seal");
    });

    it("keeps the earlier liquid sub-steps clear of the deadline warning", () => {
      const dryTube = labTool("centrifuge_tube", {
        id: "extraction_tube",
        powderMassG: 10.002,
      });
      const state = experiment({
        analyticalBalance: { tareMassG: 12, taredToolId: "extraction_tube" },
        workbench: { slots: [{ id: "station_1", label: "Station 1", tool: dryTube }] },
      });

      const result = evaluateTutorial(calibrationSampleTutorial, state, beforeSalts);
      const presentation = getTutorialStepPresentation(result.currentStep!, state);

      expect(result.currentStep?.anchor(state)).toBe("palette-item-istd_solution");
      expect(presentation.instruction).not.toContain("15 seconds");
    });
  });
  describe("progress after an extraction tube has been replaced", () => {
    // Wetting the test portion turns the ground powder into slurry, so the weighing
    // step stops being satisfied the moment the extraction starts. That is the normal
    // course of the chapter, and the ruined tube the trash keeps for good must never
    // turn it into a reason to walk the learner back.
    const spentState = {
      saltsAdded: true,
      phase: "cemented",
      faults: ["cemented"],
      isUsable: false,
    };

    function replacementTube(overrides: Record<string, unknown>) {
      return labTool("centrifuge_tube", {
        id: "fresh_tube",
        produceFractions: [{ id: "fraction_1", massG: 10.002 }],
        ...overrides,
      });
    }

    const completedThroughWeighing = [
      "weigh-received-sample",
      "register-and-label-sample",
      "store-gross-balance",
      "cut-sample",
      "grind-sample",
      "store-grinder",
      "weigh-test-portion",
      "store-analytical-balance",
    ];

    it("asks for the solvent after the ISTD rather than for the balance again", () => {
      // Powder mass reads 0 once the produce is slurry, which is exactly the state the
      // tube is in between the ISTD and the acetonitrile.
      const state = experiment({
        analyticalBalance: { tareMassG: 12, taredToolId: "fresh_tube" },
        trash: {
          ...experiment().trash,
          children: [
            labTool("centrifuge_tube", { id: "cemented_tube", quechersState: spentState }),
          ],
        },
        workbench: {
          slots: [
            {
              id: "station_1",
              label: "Station 1",
              tool: replacementTube({
                powderMassG: 0,
                containsSlurry: true,
                liquids: [{ liquidId: "istd_solution", label: "ISTD", volume_ml: 0.05 }],
              }),
            },
          ],
        },
      });

      const result = evaluateTutorial(
        calibrationSampleTutorial,
        state,
        completedThroughWeighing,
      );
      const presentation = getTutorialStepPresentation(result.currentStep!, state);

      expect(result.currentStep?.id).toBe("prepare-extraction");
      expect(result.completedStepIds).toContain("weigh-test-portion");
      expect(result.currentStep?.anchor(state)).toBe(
        "palette-item-acetonitrile_extraction",
      );
      expect(presentation.title).toBe("Add the extraction solvent");
    });

    it("still walks back while the ruined tube is the only line the learner has", () => {
      const state = experiment({
        analyticalBalance: { tareMassG: 12, taredToolId: "cemented_tube" },
        workbench: {
          slots: [
            {
              id: "station_1",
              label: "Station 1",
              tool: labTool("centrifuge_tube", {
                id: "cemented_tube",
                quechersState: spentState,
                powderMassG: 10.002,
                produceFractions: [{ id: "fraction_1", massG: 10.002 }],
              }),
            },
          ],
        },
      });

      const result = evaluateTutorial(
        calibrationSampleTutorial,
        state,
        completedThroughWeighing,
      );

      expect(result.currentStep?.id).toBe("weigh-test-portion");
      expect(result.completedStepIds).not.toContain("weigh-test-portion");
    });
  });
  describe("transferring enough extract into the sample vial", () => {
    // A quick click on the pipette commits one 0.05 mL step, which is exactly the
    // vial dead volume: the autosampler would draw nothing and every channel would
    // record baseline. The step has to hold until the vial can actually be injected.
    const separated = {
      saltsAdded: true,
      phase: "separated",
      faults: [],
      isUsable: true,
    };

    function stateWithVial(vialLiquidMl: number) {
      const vial = labTool("sample_vial", {
        id: "sample_vial_1",
        liquids: vialLiquidMl > 0
          ? [{ liquidId: "acetonitrile_extraction", label: "Extract", volume_ml: vialLiquidMl }]
          : [],
        injectionContext: vialLiquidMl > 0 ? { sourceTubeId: "extraction_tube" } : null,
      });
      return experiment({
        workbench: {
          slots: [
            {
              id: "station_1",
              label: "Station 1",
              tool: labTool("centrifuge_tube", {
                id: "extraction_tube",
                quechersState: separated,
                liquids: [
                  { liquidId: "acetonitrile_extraction", label: "MeCN", volume_ml: 9 },
                ],
              }),
            },
            { id: "station_2", label: "Station 2", tool: vial },
          ],
        },
      });
    }

    const completed = calibrationSampleTutorial.steps
      .map((entry) => entry.id)
      .slice(
        0,
        calibrationSampleTutorial.steps.findIndex(
          (entry) => entry.id === "prepare-sample-vial",
        ),
      );

    it("tells the learner to hold rather than to click once", () => {
      const state = stateWithVial(0);
      const tutorialStep = calibrationSampleTutorial.steps.find(
        (entry) => entry.id === "prepare-sample-vial",
      )!;
      const presentation = getTutorialStepPresentation(tutorialStep, state);

      expect(presentation.instruction).toContain("hold");
      expect(presentation.instruction).not.toContain("once to aspirate");
      expect(presentation.instruction).toContain("1.00 mL");
    });

    it("says to keep drawing before the pipette is emptied into the vial", () => {
      // Catching the short aliquot only after it lands makes the learner dispense,
      // be told it was not enough, and start over. The pipette is still in hand here.
      const state = experiment({
        ...stateWithVial(0),
        pipette: { capacityMl: 1, volumeMl: 0.05, sourceToolId: "extraction_tube" },
      });
      const tutorialStep = calibrationSampleTutorial.steps.find(
        (entry) => entry.id === "prepare-sample-vial",
      )!;
      const presentation = getTutorialStepPresentation(tutorialStep, state);

      expect(presentation.title).toBe("Draw more extract before dispensing");
      expect(presentation.instruction).toContain("0.05 mL");
      expect(tutorialStep.anchor(state)).toBe("pipette-aspirate");
    });

    it("lets a part-filled pipette top up a vial that is already close", () => {
      const state = experiment({
        ...stateWithVial(0.18),
        pipette: { capacityMl: 1, volumeMl: 0.05, sourceToolId: "extraction_tube" },
      });
      const tutorialStep = calibrationSampleTutorial.steps.find(
        (entry) => entry.id === "prepare-sample-vial",
      )!;

      expect(getTutorialStepPresentation(tutorialStep, state).title).toBe(
        "Add more extract to the vial",
      );
      expect(tutorialStep.anchor(state)).toBe("tool-type-sample_vial");
    });

    it("does not accept a vial holding only the dead volume", () => {
      const state = stateWithVial(0.05);

      const result = evaluateTutorial(calibrationSampleTutorial, state, completed);
      const presentation = getTutorialStepPresentation(result.currentStep!, state);

      expect(result.currentStep?.id).toBe("prepare-sample-vial");
      expect(result.completedStepIds).not.toContain("prepare-sample-vial");
      expect(presentation.title).toBe("Add more extract to the vial");
      expect(presentation.instruction).toContain("hold");
    });

    it("keeps the vial identified once the run has drawn it down", () => {
      // Each injection takes a few microlitres out of the vial, so a finished vial can
      // sit below the workable floor. That must not reopen the transfer step and send
      // the learner back to pipetting at the end of the run.
      const state = stateWithVial(0.04);
      const stagingCompleted = calibrationSampleTutorial.steps
        .map((entry) => entry.id)
        .slice(
          0,
          calibrationSampleTutorial.steps.findIndex((entry) => entry.id === "stage-vials"),
        );

      const result = evaluateTutorial(calibrationSampleTutorial, state, stagingCompleted);

      expect(result.completedStepIds).toContain("prepare-sample-vial");
      expect(result.currentStep?.id).not.toBe("prepare-sample-vial");
    });

    it("accepts a workable aliquot", () => {
      const state = stateWithVial(1);

      const result = evaluateTutorial(calibrationSampleTutorial, state, completed);

      expect(result.completedStepIds).toContain("prepare-sample-vial");
    });
  });
});
