import { describe, expect, it } from "vitest";

import {
  getTutorialProduceDropIntervention,
  getTutorialTareIntervention,
} from "@/lib/tutorial-action-guard";
import type { Experiment } from "@/types/experiment";
import type { ProduceDragPayload } from "@/types/workbench";

const payload: ProduceDragPayload = {
  allowedDropTargets: ["workbench_slot"],
  entityKind: "produce",
  produceLotId: "apples_1",
  produceType: "apple",
  sourceId: "bag_1",
  sourceKind: "workbench",
  sourceSlotId: "station_1",
};

function experiment(): Experiment {
  return {
    id: "tutorial_experiment",
    status: "preparing",
    last_simulation_at: "2026-08-14T10:00:00Z",
    snapshot_version: 1,
    workbench: {
      slots: [
        { id: "station_1", label: "Station 1", tool: null },
        {
          id: "station_2",
          label: "Station 2",
          tool: {
            id: "board_1",
            toolId: "cutting_board_hdpe",
            label: "Cutting board",
            subtitle: "",
            accent: "slate",
            toolType: "cutting_board",
            capacity_ml: 0,
            canReceiveLiquids: false,
            canReceiveProduce: true,
            canSeal: false,
            isDraggable: true,
            allowedDropTargets: [],
            liquids: [],
          },
        },
      ],
    },
    rack: { allowedDropTargets: [], isDraggable: true, state: "available", slots: [] },
    trash: { children: [], discardedFrom: {}, produceLots: [], sampleLabels: [] },
    workspace: { produceBasketLots: [], widgets: [] },
    basketTools: [],
    produceMaterialStates: [],
    spatula: { isLoaded: false, sourceToolId: null },
    pipette: { capacityMl: 1, volumeMl: 0, sourceToolId: null },
    analyticalBalance: { tareMassG: null, taredToolId: null },
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
    audit_log: [],
  };
}

describe("tutorial action guard", () => {
  it("blocks produce dropped onto a bare station during an active tutorial", () => {
    expect(
      getTutorialProduceDropIntervention({
        experiment: experiment(),
        isTutorialProtected: true,
        payload,
        targetSlotId: "station_1",
      }),
    ).toMatchObject({
      anchor: "bench-tool-card-board_1",
      title: "Contamination prevented",
    });
  });

  it("allows the same produce to be dropped onto a cutting board", () => {
    expect(
      getTutorialProduceDropIntervention({
        experiment: experiment(),
        isTutorialProtected: true,
        payload,
        targetSlotId: "station_2",
      }),
    ).toBeNull();
  });

  it("keeps normal experiments unrestricted", () => {
    expect(
      getTutorialProduceDropIntervention({
        experiment: experiment(),
        isTutorialProtected: false,
        payload,
        targetSlotId: "station_1",
      }),
    ).toBeNull();
  });

  it("protects the empty-tube tare after powder has been added", () => {
    const state = experiment();
    state.workspace.widgets = [
      {
        id: "analytical_balance",
        widgetType: "workbench",
        label: "Analytical balance",
        isDraggable: true,
        allowedDropTargets: [],
        isStorable: true,
        canStore: false,
        anchor: "top-left",
        offsetX: 0,
        offsetY: 0,
        isPresent: true,
        tool: {
          ...state.workbench.slots[1].tool!,
          id: "tube_1",
          toolType: "centrifuge_tube",
          powderMassG: 1.25,
        },
      },
    ];

    expect(
      getTutorialTareIntervention({ experiment: state, isTutorialProtected: true }),
    ).toMatchObject({
      anchor: "analytical-balance-tare",
      continueLabel: "Keep the empty-tube tare",
      title: "Tare protected",
    });
  });

  it("allows tare before powder is added and outside the tutorial", () => {
    const state = experiment();

    expect(
      getTutorialTareIntervention({ experiment: state, isTutorialProtected: true }),
    ).toBeNull();

    state.workspace.widgets = [
      {
        id: "analytical_balance",
        widgetType: "workbench",
        label: "Analytical balance",
        isDraggable: true,
        allowedDropTargets: [],
        isStorable: true,
        canStore: false,
        anchor: "top-left",
        offsetX: 0,
        offsetY: 0,
        isPresent: true,
        tool: {
          ...state.workbench.slots[1].tool!,
          id: "tube_1",
          toolType: "centrifuge_tube",
          powderMassG: 1.25,
        },
      },
    ];
    expect(
      getTutorialTareIntervention({ experiment: state, isTutorialProtected: false }),
    ).toBeNull();
  });
});
