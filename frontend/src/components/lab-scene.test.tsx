import { act, createEvent, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LabScene } from "@/components/lab-scene";
import {
  getLimsLabelTicketDropTargets,
  getProduceLotDropTargets,
  getSampleLabelDropTargets,
  getToolDropTargets,
} from "@/test-support/drop-targets";
import {
  canToolAcceptProduce,
  canToolBeSealed,
  getOpenEmptyToolContainment,
} from "@/test-support/tool-capabilities";
import type { Experiment } from "@/types/experiment";
import type {
  BenchLabel,
  BenchSlot,
  BenchToolInstance,
  ExperimentProduceLot,
  ExperimentWorkspaceWidget,
  LimsReception,
  RackSlot,
  TrashProduceLotEntry,
  TrashSampleLabelEntry,
} from "@/types/workbench";

vi.mock("@/lib/api", async () => await import("@/test-support/api-mock"));

import {
  aspiratePipette,
  createExperiment,
  emitExperimentSnapshot,
  getAcquisitionMethod,
  getAcquisitionMethodCatalog,
  renameExperiment,
  resetApiMocks,
  sendExperimentCommand,
  subscribeToExperimentStream,
} from "@/test-support/api-mock";

const PesticideWorkbench = LabScene;

function mockInventoryDropzoneBounds(dropzone: Element) {
  Object.defineProperty(dropzone, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      bottom: 480,
      height: 360,
      left: 0,
      right: 220,
      top: 120,
      width: 220,
      x: 0,
      y: 120,
      toJSON: () => {},
    }),
  });
}

type MockDataTransfer = {
  data: Map<string, string>;
  dropEffect: string;
  effectAllowed: string;
  types: string[];
  getData: (type: string) => string;
  setData: (type: string, value: string) => void;
};

type Deferred<T> = {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T) => void;
};

function createDataTransfer(): MockDataTransfer {
  const data = new Map<string, string>();
  const dataTransfer = {
    data,
    dropEffect: "copy",
    effectAllowed: "copy",
    types: [] as string[],
    getData: (type: string) => data.get(type) ?? "",
    setData: (type: string, value: string) => {
      data.set(type, value);
      dataTransfer.types = Array.from(data.keys());
    },
  };

  return dataTransfer;
}

function expectToolMoveCommand(
  entityId: string,
  sourceKind: string,
  sourceId: string,
  destinationKind: string,
  destinationId: string,
) {
  expect(sendExperimentCommand).toHaveBeenCalledWith(
    "experiment_pesticides",
    "move_object",
    {
      entity: { kind: "tool", id: entityId },
      source: { kind: sourceKind, id: sourceId },
      destination: { kind: destinationKind, id: destinationId },
    },
  );
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, reject, resolve };
}

function makeSlots(overrides: Partial<BenchSlot>[] = [], count = Math.max(2, overrides.length)): BenchSlot[] {
  const baseSlots: BenchSlot[] = Array.from({ length: count }, (_, index) => ({
    id: `station_${index + 1}`,
    label: `Station ${index + 1}`,
    tool: null,
  }));

  return baseSlots
    .map((slot, index) => ({
      ...slot,
      ...(overrides[index] ?? {}),
    }))
    .map((slot) => ({
      ...slot,
      dropTargetTypes:
        slot.dropTargetTypes && slot.dropTargetTypes.length > 0
          ? slot.dropTargetTypes
          : ["workbench_slot"],
      containment: slot.containment ?? {
        accepts: [{ entityKind: "tool" }, { entityKind: "produce" }],
        blockedReason:
          slot.tool !== null || (slot.surfaceProduceLots?.length ?? 0) > 0
            ? "occupied"
            : null,
        canReceive: slot.tool === null && (slot.surfaceProduceLots?.length ?? 0) === 0,
        capacity: 1,
        children: [
          ...(slot.tool
            ? [{ entityKind: "tool" as const, id: slot.tool.id, toolType: slot.tool.toolType }]
            : []),
          ...((slot.surfaceProduceLots ?? []).map((produceLot) => ({
            entityKind: "produce" as const,
            id: produceLot.id,
            produceType: produceLot.produceType,
          }))),
        ],
        remainingCapacity: slot.tool === null && (slot.surfaceProduceLots?.length ?? 0) === 0 ? 1 : 0,
      },
    }));
}

function makeTool(overrides: Partial<BenchToolInstance> = {}): BenchToolInstance {
  const toolType = overrides.toolType ?? "sample_vial";
  const isSealed = overrides.isSealed ?? false;
  const tool = {
    id: "bench_tool_1",
    toolId: "sample_vial_lcms",
    label: "Autosampler vial",
    subtitle: "Injection ready",
    accent: "sky",
    toolType,
    capacity_ml: 2,
    canReceiveProduce: canToolAcceptProduce(toolType),
    canSeal: canToolBeSealed(toolType),
    isSealed,
    isDraggable: true,
    allowedDropTargets: getToolDropTargets(toolType),
    labels: [],
    produceLots: [],
    liquids: [],
    ...overrides,
  };
  return {
    ...tool,
    containment: tool.containment ?? getOpenEmptyToolContainment(toolType),
  };
}

function makeSampleBagLabel(overrides: Partial<BenchLabel> = {}): BenchLabel {
  return {
    id: "bench_tool_1-sample-label",
    labelKind: "manual",
    text: "LOT-2026-041",
    receivedDate: null,
    sampleCode: null,
    isDraggable: true,
    allowedDropTargets: getSampleLabelDropTargets(),
    ...overrides,
  };
}

function makeRackSlots(overrides: Partial<RackSlot>[] = []): RackSlot[] {
  const baseSlots: RackSlot[] = Array.from({ length: 12 }, (_, index) => ({
    id: `rack_slot_${index + 1}`,
    label: `Position ${index + 1}`,
    dropTargetTypes: ["rack_slot"],
    tool: null,
  }));

  return baseSlots.map((slot, index) => ({
    ...slot,
    ...(overrides[index] ?? {}),
  })).map((slot) => ({
    ...slot,
    containment: slot.containment ?? {
      accepts: [{ entityKind: "tool", toolType: "sample_vial" }],
      blockedReason: slot.tool === null ? null : "occupied",
      canReceive: slot.tool === null,
      capacity: 1,
      children: slot.tool
        ? [{ entityKind: "tool", id: slot.tool.id, toolType: slot.tool.toolType }]
        : [],
      remainingCapacity: slot.tool === null ? 1 : 0,
    },
  }));
}

function makeWorkspaceWidgets(
  overrides: Partial<ExperimentWorkspaceWidget>[] = [],
): ExperimentWorkspaceWidget[] {
  const normalizedOverrides =
    overrides.length === 8
      ? [overrides[0], overrides[1], {}, overrides[2], overrides[3], overrides[4], overrides[5], overrides[6], overrides[7]]
      : overrides;
  const baseWidgets: ExperimentWorkspaceWidget[] = [
    {
      id: "lims",
      widgetType: "lims_terminal",
      label: "LIMS terminal",
      dropTargetTypes: [],
      anchor: "top-left",
      offsetX: 24,
      offsetY: 886,
      isPresent: true,
      isTrashed: false,
    },
    {
      id: "gross_balance",
      widgetType: "gross_balance",
      label: "Gross balance",
      dropTargetTypes: ["gross_balance_widget"],
      anchor: "top-left",
      offsetX: 364,
      offsetY: 886,
      isPresent: false,
      isTrashed: false,
    },
    {
      id: "analytical_balance",
      widgetType: "analytical_balance",
      label: "Analytical balance",
      dropTargetTypes: ["analytical_balance_widget"],
      anchor: "top-left",
      offsetX: 688,
      offsetY: 886,
      isPresent: false,
      isTrashed: false,
    },
    {
      id: "workbench",
      widgetType: "workbench",
      label: "Workbench",
      dropTargetTypes: [],
      anchor: "top-left",
      offsetX: 24,
      offsetY: 24,
      isPresent: true,
      isTrashed: false,
    },
    {
      id: "trash",
      widgetType: "trash",
      label: "Trash",
      dropTargetTypes: [],
      anchor: "top-left",
      offsetX: 1276,
      offsetY: 24,
      isPresent: true,
      isTrashed: false,
    },
    {
      id: "rack",
      widgetType: "autosampler_rack",
      label: "Autosampler rack",
      dropTargetTypes: [],
      anchor: "top-left",
      offsetX: 234,
      offsetY: 886,
      isPresent: false,
      isTrashed: false,
    },
    {
      id: "instrument",
      widgetType: "lc_msms_instrument",
      label: "LC-MS/MS",
      dropTargetTypes: [],
      anchor: "top-left",
      offsetX: 812,
      offsetY: 886,
      isPresent: false,
      isTrashed: false,
    },
    {
      id: "basket",
      widgetType: "produce_basket",
      label: "Produce basket",
      dropTargetTypes: [],
      anchor: "top-left",
      offsetX: 1276,
      offsetY: 262,
      isPresent: true,
      isTrashed: false,
    },
    {
      id: "grinder",
      widgetType: "cryogenic_grinder",
      label: "Cryogenic grinder",
      dropTargetTypes: ["grinder_widget"],
      anchor: "top-left",
      offsetX: 980,
      offsetY: 886,
      isPresent: false,
      isTrashed: false,
    },
    {
      id: "vortex",
      widgetType: "vortex_mixer",
      label: "Vortex mixer",
      dropTargetTypes: ["vortex_widget"],
      anchor: "top-left",
      offsetX: 1444,
      offsetY: 886,
      isPresent: false,
      isTrashed: false,
    },
  ];

  const storableWidgetIds = new Set(["lims", "rack", "instrument", "grinder", "gross_balance", "analytical_balance", "vortex"]);

  return baseWidgets.map((widget, index) => {
    const merged = { ...widget, ...(normalizedOverrides[index] ?? {}) };
    const isDraggable =
      storableWidgetIds.has(merged.id) &&
      (merged.isTrashed ||
        (merged.tool == null &&
          (merged.produceLots?.length ?? 0) === 0 &&
          (merged.liquids?.length ?? 0) === 0));
    return {
      ...merged,
      isStorable: storableWidgetIds.has(merged.id),
      canStore: isDraggable,
      isDraggable,
      allowedDropTargets: isDraggable ? (["workspace_canvas"] as const) : [],
      ...(merged.id === "grinder"
        ? buildGrinderSnapshotFields(merged)
        : {}),
    };
  });
}

function buildGrinderSnapshotFields(widget: ExperimentWorkspaceWidget): Partial<ExperimentWorkspaceWidget> {
  const produceLot = widget.produceLots?.[0] ?? null;
  const materialState = produceLot?.materialState ?? "whole";
  const temperatureC = produceLot?.temperatureC ?? 20;
  const isRunning = (widget.grinderRunRemainingMs ?? 0) > 0;
  const startBlockReason =
    isRunning
      ? "running"
      : produceLot === null
        ? "empty"
        : materialState === "whole"
          ? "must_be_cut"
          : materialState === "ground"
            ? "already_ground"
            : materialState === "waste"
              ? "waste"
              : temperatureC > -20
                ? "not_cold_enough"
                : null;
  const displayMode =
    widget.grinderDisplayMode ??
    (materialState === "ground"
      ? "complete"
      : widget.grinderFault === "motor_jammed" || startBlockReason === "not_cold_enough"
        ? "jammed"
        : isRunning && temperatureC > -20
          ? "warning"
          : isRunning
            ? "running"
            : startBlockReason === null
              ? "ready"
              : startBlockReason === "must_be_cut"
                ? "overload"
                : "idle");
  return {
    grinderCanStart: widget.grinderCanStart ?? (startBlockReason === null),
    grinderDisplayMode: displayMode,
    grinderStartBlockReason: widget.grinderStartBlockReason ?? startBlockReason,
  };
}

function makeProduceLot(overrides: Partial<ExperimentProduceLot> & { id: string }): ExperimentProduceLot {
  return {
    label: "Apple lot 1",
    produceType: "apple",
    totalMassG: 2450,
    unitCount: 12,
    isContaminated: false,
    isDraggable: true,
    allowedDropTargets: getProduceLotDropTargets(),
    ...overrides,
  };
}

function makeWorkbenchExperiment({
  analyticalBalance = { tareMassG: null, taredToolId: null },
  auditLog = ["Experiment created", "Receive the grower bag, weigh it, then register it in the LIMS."],
  journalEntries = auditLog.map((message, index) => ({
    id: `journal_${index}`,
    occurredAt: "2026-03-28T19:00:00Z",
    category: message.includes("moved in workspace") || message.includes("repositioned in workspace")
      ? "layout" as const
      : "manipulation" as const,
    severity: "info" as const,
    message,
  })),
  basketProduceLots = [],
  basketTools = [],
  lastSimulationAt = "2026-03-28T19:00:00Z",
  limsReception = makeLimsReception(),
  limsEntries = limsReception.labSampleCode ? [limsReception] : [],
  rackState = "available",
  rackSlots = makeRackSlots(),
  snapshotVersion = 1,
  slots = makeSlots(),
  trashProduceLots = [],
  trashSampleLabels = [],
  trashTools = [],
  workspaceWidgets = makeWorkspaceWidgets(),
}: {
  analyticalBalance?: Experiment["analyticalBalance"];
  auditLog?: string[];
  journalEntries?: Experiment["journalEntries"];
  basketProduceLots?: ExperimentProduceLot[];
  basketTools?: BenchToolInstance[];
  lastSimulationAt?: string;
  limsEntries?: LimsReception[];
  limsReception?: LimsReception;
  rackState?: Experiment["rack"]["state"];
  rackSlots?: RackSlot[];
  snapshotVersion?: number;
  slots?: BenchSlot[];
  trashProduceLots?: TrashProduceLotEntry[];
    trashSampleLabels?: TrashSampleLabelEntry[];
  trashTools?: BenchToolInstance[];
  workspaceWidgets?: ExperimentWorkspaceWidget[];
} = {}): Experiment {
  const normalizedWorkspaceWidgets = workspaceWidgets.map((widget) => {
    if (widget.id !== "rack" || !rackSlots.some((slot) => slot.tool !== null)) {
      return widget;
    }
    return {
      ...widget,
      canStore: false,
      isDraggable: false,
      allowedDropTargets: [],
    };
  });
  const normalizedSlots = slots.map((slot) => ({
    ...slot,
    tool: slot.tool ? makeTool(slot.tool) : null,
  }));
  const normalizedRackSlots = rackSlots.map((slot) => ({
    ...slot,
    tool: slot.tool ? makeTool(slot.tool) : null,
  }));

  return {
    id: "experiment_pesticides",
    status: "preparing",
    last_simulation_at: lastSimulationAt,
    snapshot_version: snapshotVersion,
    workbench: { slots: normalizedSlots },
    rack: {
      allowedDropTargets: rackState === "available" ? ["lcmsms_instrument"] : [],
      isDraggable: rackState === "available",
      state: rackState,
      slots: normalizedRackSlots,
    },
    trash: { children: (trashTools ?? []).map((tool) => makeTool(tool)), discardedFrom: {}, produceLots: trashProduceLots, sampleLabels: trashSampleLabels },
    workspace: { produceBasketLots: basketProduceLots, widgets: normalizedWorkspaceWidgets },
    basketTools: basketTools.map((tool) => makeTool(tool)),
      spatula: {
        isLoaded: false,
        produceFractions: [],
        sourceToolId: null,
      },
    pipette: { capacityMl: 1, volumeMl: 0, sourceToolId: null },
    analyticalBalance,
    limsReception,
    limsEntries,
    journalEntries,
    audit_log: auditLog,
  };
}

function makeLimsReception(overrides: Partial<LimsReception> = {}): LimsReception {
  return {
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
    ...overrides,
  };
}

function makePrintedLimsTicket(
  overrides: Partial<NonNullable<LimsReception["printedLabelTicket"]>> = {},
): NonNullable<LimsReception["printedLabelTicket"]> {
  return {
    id: "lims_ticket_1",
    sampleCode: "APP-0001-01",
    labelText: "APP-0001-01",
    receivedDate: "2026-04-03",
    isDraggable: true,
    allowedDropTargets: getLimsLabelTicketDropTargets(),
    ...overrides,
  };
}

function makeSampleBagTool(overrides: Partial<BenchToolInstance> = {}): BenchToolInstance {
  return makeTool({
    toolId: "sealed_sampling_bag",
    label: "Sealed sampling bag",
    subtitle: "Field collection",
    accent: "emerald",
    toolType: "sample_bag",
    capacity_ml: 500,
    produceLots: [],
    ...overrides,
  });
}

function makeTrashToolEntry(overrides: Partial<BenchToolInstance> = {}): BenchToolInstance {
  return makeTool(overrides);
}

function makeTrashProduceLotEntry(
  overrides: Partial<TrashProduceLotEntry> = {},
): TrashProduceLotEntry {
  return {
    id: "trash_produce_lot_1",
    originLabel: "Produce basket",
    produceLot: makeProduceLot({ id: "produce_1" }),
    ...overrides,
  };
}

function makeTrashSampleLabelEntry(
  overrides: Partial<TrashSampleLabelEntry> = {},
): TrashSampleLabelEntry {
  return {
    id: "trash_sample_label_1",
    originLabel: "Sealed sampling bag",
    label: {
      id: "trash_sample_label_label_1",
      labelKind: "manual",
      text: "LOT-2026-041",
      receivedDate: null,
      sampleCode: null,
      isDraggable: true,
      allowedDropTargets: getSampleLabelDropTargets(),
    },
    ...overrides,
  };
}

function makeWorkspaceWithRackVisible(overrides: Partial<ExperimentWorkspaceWidget> = {}) {
  return makeWorkspaceWidgets([{}, {}, {}, {}, {}, { isPresent: true, ...overrides }, {}, {}, {}]);
}

function makeWorkspaceWithRackAndInstrumentVisible(
  rackOverrides: Partial<ExperimentWorkspaceWidget> = {},
  instrumentOverrides: Partial<ExperimentWorkspaceWidget> = {},
) {
  return makeWorkspaceWidgets([
    {},
    {},
    {},
    {},
    {},
    { isPresent: true, ...rackOverrides },
    { isPresent: true, ...instrumentOverrides },
    {},
    {},
  ]);
}

function makeWorkspaceWithGrinderVisible(overrides: Partial<ExperimentWorkspaceWidget> = {}) {
  return makeWorkspaceWidgets([{}, {}, {}, {}, {}, {}, {}, {}, { isPresent: true, ...overrides }]);
}

function makeWorkspaceWithGrossBalanceVisible(
  overrides: Partial<ExperimentWorkspaceWidget> = {},
) {
  return makeWorkspaceWidgets([{}, { isPresent: true, ...overrides }, {}, {}, {}, {}, {}, {}, {}]);
}

function makeWorkspaceWithAnalyticalBalanceVisible(
  overrides: Partial<ExperimentWorkspaceWidget> = {},
) {
  return makeWorkspaceWidgets([{}, {}, { isPresent: true, ...overrides }, {}, {}, {}, {}, {}, {}]);
}

function makeWorkspaceWithVortexVisible(
  overrides: Partial<ExperimentWorkspaceWidget> = {},
) {
  return makeWorkspaceWidgets([{}, {}, {}, {}, {}, {}, {}, {}, {}, { isPresent: true, ...overrides }]);
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  resetApiMocks();
});

describe("LabScene", () => {
  it("renders the guided tutorial from the experiment route", async () => {
    window.localStorage.clear();
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment());

    render(<PesticideWorkbench tutorialId="calibration-sample-v1" />);

    expect(await screen.findByRole("complementary", { name: "Guided tutorial" })).toBeInTheDocument();
    expect(screen.getByText("Deploy the Gross balance")).toBeInTheDocument();
    // The session is written by an effect, which the coach being on screen does not guarantee.
    await waitFor(() => {
      expect(window.localStorage.getItem("betalab:tutorial-sessions:v1")).toContain(
        "experiment_pesticides",
      );
    });
  });

  it("marks the tutorial drop destination while an item is being dragged", async () => {
    window.localStorage.clear();
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([
          {
            tool: makeSampleBagTool({
              id: "bag_1",
              isSealed: false,
              produceLots: [makeProduceLot({ id: "produce_1" })],
            }),
          },
          {},
        ]),
      }),
    );

    render(<PesticideWorkbench tutorialId="calibration-sample-v1" />);

    const apples = await screen.findByTestId("bench-produce-lot-produce_1");
    // The first objective is to deploy the gross balance, so the workspace canvas is
    // the expected destination. jsdom reports zero-sized rects, so give it a real one.
    Object.defineProperty(screen.getByTestId("widget-workspace"), "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: 620,
        height: 500,
        left: 260,
        right: 960,
        top: 120,
        width: 700,
        x: 260,
        y: 120,
        toJSON: () => {},
      }),
    });
    expect(screen.queryByTestId("tutorial-drop-spotlight")).not.toBeInTheDocument();

    fireEvent.dragStart(apples, { dataTransfer: createDataTransfer() });

    const dropSpotlight = await screen.findByTestId("tutorial-drop-spotlight");
    expect(dropSpotlight).toHaveClass("border-yellow-400");
    await waitFor(() => {
      expect(dropSpotlight).toHaveStyle({
        display: "block",
        left: "252px",
        top: "112px",
      });
    });

    fireEvent.dragEnd(apples);

    await waitFor(() => {
      expect(screen.queryByTestId("tutorial-drop-spotlight")).not.toBeInTheDocument();
    });
  });

  it("stays in free mode when the tutorial was finished", async () => {
    window.localStorage.clear();
    window.localStorage.setItem(
      "betalab:tutorial-sessions:v1",
      JSON.stringify({
        "calibration-sample-v1::experiment_pesticides": {
          tutorialId: "calibration-sample-v1",
          experimentId: "experiment_pesticides",
          status: "completed",
          completedStepIds: [],
          version: 1,
        },
      }),
    );
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment());

    render(<PesticideWorkbench tutorialId="calibration-sample-v1" />);

    expect(await screen.findByTestId("workbench-header")).toBeInTheDocument();
    // The saved session is only read once the experiment is loaded, so the coach may
    // be mounted for one render before free mode takes over.
    await waitFor(() => {
      expect(
        screen.queryByRole("complementary", { name: "Guided tutorial" }),
      ).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Resume tutorial" })).not.toBeInTheDocument();
  });

  it("prevents irreversible produce contamination in the tutorial unless the learner leaves", async () => {
    window.localStorage.clear();
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([
          {
            tool: makeSampleBagTool({
              id: "bag_1",
              isSealed: false,
              produceLots: [makeProduceLot({ id: "produce_1" })],
            }),
          },
          {},
        ]),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(makeWorkbenchExperiment());

    render(<PesticideWorkbench tutorialId="calibration-sample-v1" />);

    const apples = await screen.findByTestId("bench-produce-lot-produce_1");
    const bareStation = screen.getByTestId("bench-slot-station_2");
    const transfer = createDataTransfer();
    fireEvent.dragStart(apples, { dataTransfer: transfer });
    fireEvent.drop(bareStation, { dataTransfer: transfer });

    expect(await screen.findByText("Contamination prevented")).toBeInTheDocument();
    expect(sendExperimentCommand).not.toHaveBeenCalledWith(
      "experiment_pesticides",
      "move_object",
      expect.anything(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Leave tutorial and place anyway" }),
    );

    await waitFor(() => {
      expect(sendExperimentCommand).toHaveBeenCalledWith(
        "experiment_pesticides",
        "move_object",
        {
          destination: { kind: "workbench_tool", id: "station_2" },
          entity: { kind: "produce_lot", id: "produce_1" },
          source: { kind: "workbench", id: "station_1" },
        },
      );
    });
    expect(window.localStorage.getItem("betalab:tutorial-sessions:v1")).toContain(
      '"status":"abandoned"',
    );
    expect(screen.queryByRole("complementary", { name: "Guided tutorial" })).not.toBeInTheDocument();
  });

  it("prevents a second tare after powder is added during the tutorial", async () => {
    window.localStorage.clear();
    const analyticalTube = makeTool({
      id: "analytical_tube_1",
      toolId: "centrifuge_tube_50ml",
      label: "50 mL centrifuge tube",
      toolType: "centrifuge_tube",
      produceFractions: [
        {
          id: "powder_1",
          produceLotId: "lot_1",
          produceMaterialStateId: "ground_1",
          massG: 1.25,
        },
      ],
    });
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        analyticalBalance: { tareMassG: 12, taredToolId: null },
        workspaceWidgets: makeWorkspaceWithAnalyticalBalanceVisible({ tool: analyticalTube }),
      }),
    );

    render(<PesticideWorkbench tutorialId="calibration-sample-v1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Tare" }));

    expect(await screen.findByText("Tare protected")).toBeInTheDocument();
    expect(screen.getByText(/The tube already contains powder/)).toBeInTheDocument();
    expect(sendExperimentCommand).not.toHaveBeenCalledWith(
      "experiment_pesticides",
      "tare_analytical_balance",
      {},
    );
    expect(
      screen.getByRole("button", { name: "Keep the empty-tube tare" }),
    ).toBeInTheDocument();
  });

  it("routes a real pipette click on a filled tube to the aspiration API", async () => {
    const tube = makeTool({
      id: "tube_1",
      label: "Filled tube",
      toolId: "centrifuge_tube_50ml",
      toolType: "centrifuge_tube",
      capacity_ml: 50,
      liquids: [{ id: "liquid_1", liquidId: "acetonitrile_extraction", name: "Acetonitrile", volume_ml: 10, accent: "amber" }],
    });
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment({ slots: makeSlots([{ tool: tube }]) }));

    render(<PesticideWorkbench />);
    await screen.findByText("Filled tube");
    const pipetteButton = screen.getByRole("button", { name: "Micropipette" });
    fireEvent.click(pipetteButton);
    await waitFor(() => expect(pipetteButton).toHaveAttribute("aria-pressed", "true"));
    fireEvent.pointerDown(screen.getByTestId("bench-tool-card-tube_1"), { button: 0 });
    expect(screen.getByLabelText(/Aspirating/)).toBeInTheDocument();
    fireEvent.pointerUp(window);

    await waitFor(() => expect(aspiratePipette).toHaveBeenCalledWith(
      "experiment_pesticides",
      { tool_id: "tube_1", delta_volume_ml: 0.05 },
    ));
  });

  it("starts with an empty bench loaded from the backend", async () => {
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment());

    render(<PesticideWorkbench />);

    expect(screen.getByText("Creating pesticide workbench from backend...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText("Empty station")).toHaveLength(2);
    });

    expect(screen.getByTestId("toolbar-item-autosampler_rack_widget")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-item-lc_msms_instrument_widget")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-item-cryogenic_grinder_widget")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-item-cutting_board_hdpe")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-item-sealed_sampling_bag")).toBeInTheDocument();
    expect(screen.queryByTestId("toolbar-item-produce_basket_widget")).not.toBeInTheDocument();
    expect(screen.getByTestId("widget-basket")).toBeInTheDocument();
    expect(screen.queryByTestId("widget-rack")).not.toBeInTheDocument();
    expect(screen.queryByTestId("widget-instrument")).not.toBeInTheDocument();
  });

  it("starts with two workbench stations and can add a station", async () => {
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment());
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        auditLog: ["Station 3 added to workbench."],
        slots: makeSlots([], 3),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByText("Station 1")).toBeInTheDocument();
      expect(screen.getByText("Station 2")).toBeInTheDocument();
    });

    expect(screen.queryByText("Station 3")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("add-workbench-slot-button"));

    await waitFor(() => {
      expect(screen.getByText("Station 3")).toBeInTheDocument();
    });

    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "add_workbench_slot",
      {},
    );
  });

  it("removes an empty workbench station", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([], 3),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        auditLog: ["Station 3 removed from workbench."],
        slots: makeSlots(),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByText("Station 3")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("remove-workbench-slot-button-station_3"));

    await waitFor(() => {
      expect(screen.queryByText("Station 3")).not.toBeInTheDocument();
    });

    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "remove_workbench_slot",
      { slot_id: "station_3" },
    );
  });

  it("uses snapshot draggability for a workbench tool card", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([
          {
            tool: makeTool({
              allowedDropTargets: ["trash_bin"],
              isDraggable: false,
            }),
          },
        ]),
      }),
    );

    render(<PesticideWorkbench />);

    expect(await screen.findByTestId("bench-tool-card-bench_tool_1")).toHaveAttribute(
      "draggable",
      "false",
    );
  });

  it("keeps inventory and actions panels in sticky sidebars outside the workspace", async () => {
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment());

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("widget-inventory")).toBeInTheDocument();
      expect(screen.getByTestId("widget-actions")).toBeInTheDocument();
    });

    const inventoryWidget = screen.getByTestId("widget-inventory");
    const actionsWidget = screen.getByTestId("widget-actions");

    expect(inventoryWidget).toHaveClass("xl:sticky");
    expect(inventoryWidget).toHaveClass("xl:top-6");
    expect(actionsWidget).toHaveClass("xl:sticky");
    expect(actionsWidget).toHaveClass("xl:top-6");
  });

  it("renders a breadcrumb link back to the experiments home", async () => {
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment());

    render(<PesticideWorkbench />);

    expect(await screen.findByRole("link", { name: "Experiments" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("button", { name: "Open experiment journal" })).toBeInTheDocument();
    expect(screen.queryByText("Custom layout")).not.toBeInTheDocument();
  });

  it("renames the current experiment from the workspace header", async () => {
    const experiment = makeWorkbenchExperiment();
    vi.mocked(createExperiment).mockResolvedValue(experiment);
    vi.mocked(renameExperiment).mockResolvedValue({
      ...experiment,
      name: "Validated extraction",
      snapshot_version: 2,
    });

    render(<PesticideWorkbench />);

    fireEvent.click(await screen.findByRole("button", { name: "Rename experiment" }));
    const input = screen.getByRole("textbox", { name: "Experiment name" });
    fireEvent.change(input, { target: { value: "Validated extraction" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(renameExperiment).toHaveBeenCalledWith(
        "experiment_pesticides",
        "Validated extraction",
      );
    });
    expect(await screen.findByRole("heading", { name: "Validated extraction" })).toBeInTheDocument();
  });

  it("shows a separate debug produce palette and spawns its preset on drop", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEBUG_INVENTORY", "true");
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([
          {
            tool: makeTool({
              toolId: "hdpe_storage_jar_2l",
              label: "Wide-neck HDPE jar",
              subtitle: "Bulk powder storage",
              toolType: "storage_jar",
              capacity_ml: 2000,
              produceLots: [],
            }),
          },
        ]),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([
          {
            tool: makeTool({
              toolId: "hdpe_storage_jar_2l",
              label: "Wide-neck HDPE jar",
              subtitle: "Bulk powder storage",
              toolType: "storage_jar",
              capacity_ml: 2000,
              produceLots: [
                makeProduceLot({
                  id: "produce_debug_1",
                  label: "Apple powder lot",
                  unitCount: null,
                  materialState: "ground",
                  residualCo2MassG: 18,
                  temperatureC: -62,
                }),
              ],
            }),
          },
        ]),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("widget-debug-inventory")).toBeInTheDocument();
    });

    const preset = screen.getByTestId("debug-palette-preset-apple_powder_residual_co2");
    expect(preset).toHaveTextContent("Apple powder lot");
    expect(
      within(preset).getByTestId("apple-illustration"),
    ).toHaveAttribute("data-variant", "ground");

    const transfer = createDataTransfer();
    fireEvent.dragStart(preset, { dataTransfer: transfer });
    const dragOverEvent = createEvent.dragOver(screen.getByTestId("bench-slot-station_1"), {
      dataTransfer: transfer,
    });
    fireEvent(screen.getByTestId("bench-slot-station_1"), dragOverEvent);
    fireEvent.drop(screen.getByTestId("bench-slot-station_1"), { dataTransfer: transfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    expect(await screen.findByLabelText("Debug powder mass")).toHaveValue(2450);
    expect(await screen.findByLabelText("Debug powder temperature")).toHaveValue(-62);
    expect(screen.getByLabelText("Debug powder residual CO2")).toHaveValue(18);
    fireEvent.change(screen.getByLabelText("Debug powder residual CO2"), {
      target: { value: "19" },
    });
    fireEvent.change(screen.getByLabelText("Debug powder mass"), {
      target: { value: "3000" },
    });
    fireEvent.click(screen.getByText("Spawn"));
    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "create_debug_produce_lot_on_workbench",
      {
        preset_id: "apple_powder_residual_co2",
        residual_co2_mass_g: 19,
        target_slot_id: "station_1",
        total_mass_g: 3000,
        temperature_c: -62,
      },
    );
  });

  it("configures and spawns the debug apple slurry tube on its first drop", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEBUG_INVENTORY", "true");
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment());
    vi.mocked(sendExperimentCommand).mockResolvedValue(makeWorkbenchExperiment());

    render(<PesticideWorkbench />);

    const preset = await screen.findByTestId(
      "debug-palette-preset-apple_slurry_centrifuge_tube",
    );
    expect(preset).toHaveTextContent("Apple slurry tube");
    expect(preset).toHaveTextContent("10 g apple slurry");

    const transfer = createDataTransfer();
    fireEvent.dragStart(preset, { dataTransfer: transfer });
    fireEvent.drop(screen.getByTestId("bench-slot-station_1"), { dataTransfer: transfer });

    expect(await screen.findByLabelText("Debug slurry apple mass")).toHaveValue(10);
    expect(screen.queryByLabelText("Debug slurry liquid volume")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Debug slurry temperature")).toHaveValue(20);
    fireEvent.change(screen.getByLabelText("Debug slurry apple mass"), {
      target: { value: "12.5" },
    });
    fireEvent.click(screen.getByText("Spawn"));

    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "create_debug_tool_preset",
      {
        destination_id: "station_1",
        destination_kind: "workbench_slot",
        preset_id: "apple_slurry_centrifuge_tube",
        produce_mass_g: 12.5,
        temperature_c: 20,
      },
    );
  });

  it("configures and spawns the vortexed slurry tube ready to centrifuge", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEBUG_INVENTORY", "true");
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment());
    vi.mocked(sendExperimentCommand).mockResolvedValue(makeWorkbenchExperiment());

    render(<PesticideWorkbench />);

    const preset = await screen.findByTestId(
      "debug-palette-preset-vortexed_slurry_centrifuge_tube",
    );
    expect(preset).toHaveTextContent("Vortexed slurry tube");

    const transfer = createDataTransfer();
    fireEvent.dragStart(preset, { dataTransfer: transfer });
    fireEvent.drop(screen.getByTestId("bench-slot-station_1"), { dataTransfer: transfer });

    expect(await screen.findByText("Configure Vortexed slurry tube")).toBeInTheDocument();
    expect(screen.getByLabelText("Debug slurry apple mass")).toHaveValue(10);
    fireEvent.click(screen.getByText("Spawn"));

    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "create_debug_tool_preset",
      {
        destination_id: "station_1",
        destination_kind: "workbench_slot",
        preset_id: "vortexed_slurry_centrifuge_tube",
        produce_mass_g: 10,
        temperature_c: 20,
      },
    );
  });

  it("configures and spawns the centrifuged slurry tube ready to pipette", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEBUG_INVENTORY", "true");
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment());
    vi.mocked(sendExperimentCommand).mockResolvedValue(makeWorkbenchExperiment());

    render(<PesticideWorkbench />);

    const preset = await screen.findByTestId(
      "debug-palette-preset-separated_slurry_centrifuge_tube",
    );
    expect(preset).toHaveTextContent("Centrifuged slurry tube");

    const transfer = createDataTransfer();
    fireEvent.dragStart(preset, { dataTransfer: transfer });
    fireEvent.drop(screen.getByTestId("bench-slot-station_1"), { dataTransfer: transfer });

    expect(await screen.findByText("Configure Centrifuged slurry tube")).toBeInTheDocument();
    expect(screen.getByLabelText("Debug slurry apple mass")).toHaveValue(10);
    fireEvent.click(screen.getByText("Spawn"));

    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "create_debug_tool_preset",
      {
        destination_id: "station_1",
        destination_kind: "workbench_slot",
        preset_id: "separated_slurry_centrifuge_tube",
        produce_mass_g: 10,
        temperature_c: 20,
      },
    );
  });

  it("configures and spawns a prepared apple vial at the chosen preparation quality", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEBUG_INVENTORY", "true");
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment());
    vi.mocked(sendExperimentCommand).mockResolvedValue(makeWorkbenchExperiment());

    render(<PesticideWorkbench />);

    const preset = await screen.findByTestId("debug-palette-preset-apple_extract_vial");
    expect(preset).toHaveTextContent("Prepared apple vial");

    const transfer = createDataTransfer();
    fireEvent.dragStart(preset, { dataTransfer: transfer });
    fireEvent.drop(screen.getByTestId("bench-slot-station_1"), { dataTransfer: transfer });

    expect(await screen.findByText("Configure Prepared apple vial")).toBeInTheDocument();
    expect(screen.getByLabelText("Debug extract apple mass")).toHaveValue(10);
    expect(screen.getByLabelText("Debug extract solvent volume")).toHaveValue(10);
    expect(screen.getByLabelText("Debug sampling accuracy")).toHaveValue(100);
    fireEvent.change(screen.getByLabelText("Debug extraction recovery"), {
      target: { value: "60" },
    });
    fireEvent.click(screen.getByText("Spawn"));

    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "create_debug_tool_preset",
      {
        destination_id: "station_1",
        destination_kind: "workbench_slot",
        preset_id: "apple_extract_vial",
        produce_mass_g: 10,
        extract_volume_ml: 10,
        extraction_recovery_percent: 60,
        sampling_accuracy_percent: 100,
        istd_volume_ml: 0.1,
      },
    );
  });

  it("takes a ready-to-use calibration vial off the shelf at the chosen level", async () => {
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment());
    vi.mocked(sendExperimentCommand).mockResolvedValue(makeWorkbenchExperiment());

    render(<PesticideWorkbench />);

    const item = await screen.findByTestId("toolbar-item-calibration_standard_vial");
    expect(item).toHaveTextContent("Calibration standard vial");

    const transfer = createDataTransfer();
    fireEvent.dragStart(item, { dataTransfer: transfer });
    fireEvent.drop(screen.getByTestId("bench-slot-station_2"), { dataTransfer: transfer });

    expect(await screen.findByText("Pick the calibration level")).toBeInTheDocument();
    expect(screen.getByLabelText("Calibration level in ng/mL")).toHaveValue(10);
    fireEvent.click(screen.getByText("Take vial"));

    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "place_calibration_standard_vial",
      {
        destination_id: "station_2",
        destination_kind: "workbench_slot",
        level_ng_per_ml: 10,
      },
    );
  });

  it("racks a calibration vial straight from the palette without touching the bench", async () => {
    const experiment = makeWorkbenchExperiment({
      workspaceWidgets: makeWorkspaceWithRackVisible(),
    });
    vi.mocked(createExperiment).mockResolvedValue(experiment);
    vi.mocked(sendExperimentCommand).mockResolvedValue(experiment);

    render(<PesticideWorkbench />);

    const item = await screen.findByTestId("toolbar-item-calibration_standard_vial");
    await waitFor(() => {
      expect(screen.getByTestId("rack-illustration-slot-1")).toBeInTheDocument();
    });
    const transfer = createDataTransfer();
    fireEvent.dragStart(item, { dataTransfer: transfer });
    fireEvent.drop(screen.getByTestId("rack-illustration-slot-1"), { dataTransfer: transfer });

    expect(await screen.findByText("Pick the calibration level")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Take vial"));

    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "place_calibration_standard_vial",
      {
        destination_id: "rack_slot_1",
        destination_kind: "rack_slot",
        level_ng_per_ml: 10,
      },
    );
  });

  it("configures and spawns a calibration stock tube to pipette later", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEBUG_INVENTORY", "true");
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment());
    vi.mocked(sendExperimentCommand).mockResolvedValue(makeWorkbenchExperiment());

    render(<PesticideWorkbench />);

    const preset = await screen.findByTestId(
      "debug-palette-preset-calibration_standard_tube",
    );
    expect(preset).toHaveTextContent("Calibration stock tube");

    const transfer = createDataTransfer();
    fireEvent.dragStart(preset, { dataTransfer: transfer });
    fireEvent.drop(screen.getByTestId("bench-slot-station_1"), { dataTransfer: transfer });

    expect(await screen.findByText("Configure Calibration stock tube")).toBeInTheDocument();
    expect(screen.getByLabelText("Debug calibration stock level")).toHaveValue(100);
    fireEvent.click(screen.getByText("Spawn"));

    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "create_debug_tool_preset",
      {
        destination_id: "station_1",
        destination_kind: "workbench_slot",
        preset_id: "calibration_standard_tube",
        level_ng_per_ml: 100,
      },
    );
  });

  it.each([
    ["centrifuge tube", "centrifuge_tube_50ml", "centrifuge_tube"],
    ["autosampler vial", "sample_vial_lcms", "sample_vial"],
  ] as const)("adds debug apple slurry to an existing %s", async (_label, toolId, toolType) => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEBUG_INVENTORY", "true");
    const targetTool = makeTool({ toolId, toolType });
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({ slots: makeSlots([{ tool: targetTool }]) }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(makeWorkbenchExperiment());

    render(<PesticideWorkbench />);

    const preset = await screen.findByTestId(
      "debug-palette-preset-apple_slurry_centrifuge_tube",
    );
    const station = screen.getByTestId("bench-slot-station_1");
    const transfer = createDataTransfer();
    fireEvent.dragStart(preset, { dataTransfer: transfer });
    const dragOverEvent = createEvent.dragOver(station, { dataTransfer: transfer });
    fireEvent(station, dragOverEvent);
    fireEvent.drop(station, { dataTransfer: transfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    const inlineControls = await within(station).findByTestId("debug-slurry-inline-controls");
    expect(inlineControls).toHaveClass("border-sky-200", "bg-sky-50/80");
    expect(screen.queryByText("Configure Apple slurry")).not.toBeInTheDocument();
    expect(document.querySelector(".fixed.inset-0.z-50")).not.toBeInTheDocument();
    expect(within(inlineControls).getByLabelText("Debug slurry apple mass")).toHaveValue(10);
    expect(within(inlineControls).queryByLabelText("Debug slurry liquid volume")).not.toBeInTheDocument();
    expect(within(inlineControls).getByLabelText("Debug slurry temperature")).toHaveValue(20);
    fireEvent.click(within(inlineControls).getByText("Add"));
    await waitFor(() => expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "create_debug_tool_preset",
      expect.objectContaining({
        destination_id: "station_1",
        destination_kind: "workbench_tool",
        preset_id: "apple_slurry_centrifuge_tube",
        produce_mass_g: 10,
        temperature_c: 20,
      }),
    ));
  });

  it("adds QuEChERS salts to a debug apple slurry tube on the workbench", async () => {
    const debugTube = makeTool({
      toolId: "centrifuge_tube_50ml",
      label: "50 mL centrifuge tube",
      subtitle: "QuEChERS extraction",
      toolType: "centrifuge_tube",
      capacity_ml: 50,
      containsSlurry: true,
      produceLots: [
        makeProduceLot({
          id: "debug_slurry_1",
          label: "Apple slurry",
          materialState: "slurry",
          temperatureC: 20,
          total_mass_g: 10,
          unitCount: null,
        }),
      ],
      liquids: [],
    });
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({ slots: makeSlots([{ tool: debugTube }]) }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([
          {
            tool: {
              ...debugTube,
              quechersState: {
                ...debugTube.quechersState!,
                saltsAdded: true,
                phase: "reacting",
              },
            },
          },
        ]),
      }),
    );

    render(<PesticideWorkbench />);

    const salts = await screen.findByTestId("toolbar-item-quechers_salts");
    const transfer = createDataTransfer();
    fireEvent.dragStart(salts, { dataTransfer: transfer });
    fireEvent.drop(screen.getByTestId("bench-slot-station_1"), { dataTransfer: transfer });

    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "add_liquid_to_tool",
      {
        tool_id: debugTube.id,
        liquid_id: "quechers_salts",
        volume_ml: 1,
      },
    );
  });

  it("closes a sealable jar from the workbench card", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([
          {
            tool: makeTool({
              toolId: "hdpe_storage_jar_2l",
              label: "Wide-neck HDPE jar",
              subtitle: "Bulk powder storage",
              toolType: "storage_jar",
              capacity_ml: 2000,
              isSealed: false,
              produceLots: [],
            }),
          },
        ]),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([
          {
            tool: makeTool({
              toolId: "hdpe_storage_jar_2l",
              label: "Wide-neck HDPE jar",
              subtitle: "Bulk powder storage",
              toolType: "storage_jar",
              capacity_ml: 2000,
              isSealed: true,
              produceLots: [],
            }),
          },
        ]),
      }),
    );

    render(<PesticideWorkbench />);

    fireEvent.click(await screen.findByRole("button", { name: "Close Wide-neck HDPE jar" }));

    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "close_workbench_tool",
      {
        slot_id: "station_1",
      },
    );
  });

  it("opens a sealed jar from the workbench card", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([
          {
            tool: makeTool({
              toolId: "hdpe_storage_jar_2l",
              label: "Wide-neck HDPE jar",
              subtitle: "Bulk powder storage",
              toolType: "storage_jar",
              capacity_ml: 2000,
              isSealed: true,
              produceLots: [],
            }),
          },
        ]),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([
          {
            tool: makeTool({
              toolId: "hdpe_storage_jar_2l",
              label: "Wide-neck HDPE jar",
              subtitle: "Bulk powder storage",
              toolType: "storage_jar",
              capacity_ml: 2000,
              isSealed: false,
              produceLots: [],
            }),
          },
        ]),
      }),
    );

    render(<PesticideWorkbench />);

    fireEvent.click(await screen.findByRole("button", { name: "Open Wide-neck HDPE jar" }));

    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "open_workbench_tool",
      {
        slot_id: "station_1",
      },
    );
  });

  it("shows the debug produce draft when dropped onto an empty station surface", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEBUG_INVENTORY", "true");
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment());

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("widget-debug-inventory")).toBeInTheDocument();
    });

    const preset = screen.getByTestId("debug-palette-preset-apple_powder_residual_co2");
    const transfer = createDataTransfer();

    fireEvent.dragStart(preset, { dataTransfer: transfer });
    fireEvent.drop(screen.getByTestId("bench-slot-station_1"), { dataTransfer: transfer });

    expect(await screen.findByLabelText("Debug powder mass")).toHaveValue(2450);
    expect(screen.getByLabelText("Debug powder temperature")).toHaveValue(-62);
    expect(screen.getByLabelText("Debug powder residual CO2")).toHaveValue(18);
  });

  it("shows the debug produce draft when dropped directly onto the gross balance", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEBUG_INVENTORY", "true");
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithGrossBalanceVisible(),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("widget-debug-inventory")).toBeInTheDocument();
    });

    const preset = screen.getByTestId("debug-palette-preset-apple_powder_residual_co2");
    const balance = screen.getByTestId("gross-balance-dropzone");
    const transfer = createDataTransfer();

    fireEvent.dragStart(preset, { dataTransfer: transfer });
    const dragOverEvent = createEvent.dragOver(balance, { dataTransfer: transfer });
    fireEvent(balance, dragOverEvent);
    fireEvent.drop(balance, { dataTransfer: transfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    expect(await screen.findByLabelText("Debug powder mass")).toHaveValue(2450);
    expect(screen.getByLabelText("Debug powder temperature")).toHaveValue(-62);
    expect(screen.getByLabelText("Debug powder residual CO2")).toHaveValue(18);
  });

  it("shows the backend error state and retries experiment creation", async () => {
    vi.mocked(createExperiment)
      .mockRejectedValueOnce(new Error("Backend unavailable"))
      .mockResolvedValueOnce(makeWorkbenchExperiment());

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByText("Backend connection error")).toBeInTheDocument();
    });

    expect(screen.getByText("Backend unavailable")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(screen.getAllByText("Empty station")).toHaveLength(2);
    });

    expect(createExperiment).toHaveBeenCalledTimes(2);
  });

  it("recreates the experiment and retries the command when the backend forgets the session", async () => {
    vi.mocked(createExperiment)
      .mockResolvedValueOnce(makeWorkbenchExperiment())
      .mockResolvedValueOnce(makeWorkbenchExperiment({ auditLog: ["Experiment recreated"] }));
    vi.mocked(sendExperimentCommand)
      .mockRejectedValueOnce(new Error("Experiment not found"))
      .mockResolvedValueOnce(
        makeWorkbenchExperiment({
          auditLog: ["Sealed sampling bag placed on Station 1."],
          slots: makeSlots([
            {
              tool: makeTool({
                toolId: "sealed_sampling_bag",
                label: "Sealed sampling bag",
                subtitle: "Field collection",
                toolType: "sample_bag",
                accent: "emerald",
                capacity_ml: 500,
              }),
            },
          ]),
        }),
      );

    render(<PesticideWorkbench />);

    const station = await screen.findByTestId("bench-slot-station_1");
    const toolTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("toolbar-item-sealed_sampling_bag"), {
      dataTransfer: toolTransfer,
    });

    const dragOverEvent = createEvent.dragOver(station, { dataTransfer: toolTransfer });
    fireEvent(station, dragOverEvent);
    fireEvent.drop(station, { dataTransfer: toolTransfer });

    await waitFor(() => {
      expect(
        within(screen.getByTestId("bench-slot-station_1")).getByText("Sealed sampling bag"),
      ).toBeInTheDocument();
    });

    expect(createExperiment).toHaveBeenCalledTimes(2);
    expect(sendExperimentCommand).toHaveBeenNthCalledWith(
      1,
      "experiment_pesticides",
      "move_object",
      {
        entity: { kind: "tool", id: "sealed_sampling_bag" },
        source: { kind: "palette", id: "sealed_sampling_bag" },
        destination: { kind: "workbench_slot", id: "station_1" },
      },
    );
    expect(sendExperimentCommand).toHaveBeenNthCalledWith(
      2,
      "experiment_pesticides",
      "move_object",
      {
        entity: { kind: "tool", id: "sealed_sampling_bag" },
        source: { kind: "palette", id: "sealed_sampling_bag" },
        destination: { kind: "workbench_slot", id: "station_1" },
      },
    );
  });

  it("keeps the produce basket visible and adds the optional workspace equipment widgets", async () => {
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment());
    vi.mocked(sendExperimentCommand)
      .mockResolvedValueOnce(
        makeWorkbenchExperiment({
          workspaceWidgets: makeWorkspaceWithRackVisible({
            anchor: "top-left",
            offsetX: 379,
            offsetY: 388,
          }),
        }),
      )
      .mockResolvedValueOnce(
        makeWorkbenchExperiment({
          workspaceWidgets: makeWorkspaceWithRackAndInstrumentVisible(
            { anchor: "top-left", offsetX: 379, offsetY: 388 },
            { anchor: "top-left", offsetX: 655, offsetY: 388 },
          ),
        }),
      );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("widget-workspace")).toBeInTheDocument();
    });

    expect(screen.getByTestId("widget-basket")).toBeInTheDocument();

    const workspace = screen.getByTestId("widget-workspace");

    expect(
      within(screen.getByTestId("widget-basket")).getByTestId("produce-basket-illustration"),
    ).toHaveAttribute(
      "data-item-count",
      "6",
    );

    const rackTransfer = createDataTransfer();

    fireEvent.dragStart(screen.getByTestId("toolbar-item-autosampler_rack_widget"), {
      dataTransfer: rackTransfer,
    });
    fireEvent.dragOver(workspace, { dataTransfer: rackTransfer });
    fireEvent.drop(workspace, { clientX: 480, clientY: 420, dataTransfer: rackTransfer });

    await waitFor(() => {
      expect(screen.getByTestId("widget-rack")).toBeInTheDocument();
    });

    expect(screen.getByTestId("autosampler-rack-illustration")).toHaveAttribute(
      "data-occupied-count",
      "0",
    );

    const instrumentTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("toolbar-item-lc_msms_instrument_widget"), {
      dataTransfer: instrumentTransfer,
    });
    fireEvent.dragOver(workspace, { dataTransfer: instrumentTransfer });
    fireEvent.drop(workspace, { clientX: 980, clientY: 420, dataTransfer: instrumentTransfer });

    await waitFor(() => {
      expect(screen.getByTestId("widget-instrument")).toBeInTheDocument();
    });

    expect(screen.getByTestId("lc-msms-instrument-illustration")).toHaveAttribute(
      "data-status",
      "idle",
    );
  });

  it("does not create duplicate equipment widgets when the same palette item is dropped twice", async () => {
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment());
    vi.mocked(sendExperimentCommand)
      .mockResolvedValueOnce(
        makeWorkbenchExperiment({
          workspaceWidgets: makeWorkspaceWithRackVisible({
            anchor: "top-left",
            offsetX: 206,
            offsetY: 388,
          }),
        }),
      )
      .mockResolvedValueOnce(
        makeWorkbenchExperiment({
          workspaceWidgets: makeWorkspaceWithRackVisible({
            anchor: "top-left",
            offsetX: 466,
            offsetY: 488,
          }),
        }),
      );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("widget-workspace")).toBeInTheDocument();
    });

    const workspace = screen.getByTestId("widget-workspace");
    const rackTransfer = createDataTransfer();

    fireEvent.dragStart(screen.getByTestId("toolbar-item-autosampler_rack_widget"), {
      dataTransfer: rackTransfer,
    });
    fireEvent.dragOver(workspace, { dataTransfer: rackTransfer });
    fireEvent.drop(workspace, { clientX: 480, clientY: 420, dataTransfer: rackTransfer });

    await waitFor(() => {
      expect(screen.getByTestId("widget-rack")).toBeInTheDocument();
    });

    fireEvent.dragStart(screen.getByTestId("toolbar-item-autosampler_rack_widget"), {
      dataTransfer: rackTransfer,
    });
    fireEvent.dragOver(workspace, { dataTransfer: rackTransfer });
    fireEvent.drop(workspace, { clientX: 740, clientY: 520, dataTransfer: rackTransfer });

    expect(screen.getAllByTestId("widget-rack")).toHaveLength(1);
  });

  it("ignores non-equipment drops on the workspace canvas", async () => {
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment());

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("widget-workspace")).toBeInTheDocument();
    });

    const workspace = screen.getByTestId("widget-workspace");
    const toolTransfer = createDataTransfer();

    fireEvent.dragStart(screen.getByTestId("toolbar-item-sample_vial_lcms"), {
      dataTransfer: toolTransfer,
    });
    fireEvent.dragOver(workspace, { dataTransfer: toolTransfer });
    fireEvent.drop(workspace, { clientX: 480, clientY: 420, dataTransfer: toolTransfer });

    expect(screen.queryByTestId("widget-rack")).not.toBeInTheDocument();
    expect(screen.queryByTestId("widget-instrument")).not.toBeInTheDocument();
    expect(sendExperimentCommand).not.toHaveBeenCalled();
  });

  it("accepts dragover on an empty station when dragging a tool from the palette", async () => {
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment());
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        auditLog: ["Autosampler vial placed on Station 1."],
        slots: makeSlots([{ tool: makeTool() }]),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("bench-slot-station_1")).toBeInTheDocument();
    });

    const toolTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("toolbar-item-sample_vial_lcms"), {
      dataTransfer: toolTransfer,
    });

    const station = screen.getByTestId("bench-slot-station_1");
    const dragOverEvent = createEvent.dragOver(station, { dataTransfer: toolTransfer });
    fireEvent(station, dragOverEvent);
    fireEvent.drop(station, { dataTransfer: toolTransfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);

    await waitFor(() => {
      expect(
        within(screen.getByTestId("bench-slot-station_1")).getByText("Autosampler vial"),
      ).toBeInTheDocument();
    });
  });

  it("highlights only the workspace canvas when dragging a workspace widget from the palette", async () => {
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment());

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("widget-workspace")).toBeInTheDocument();
    });

    const widgetTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("toolbar-item-autosampler_rack_widget"), {
      dataTransfer: widgetTransfer,
    });

    expect(screen.getByTestId("widget-workspace")).toHaveAttribute("data-drop-highlighted", "true");
    expect(screen.getByTestId("bench-slot-station_1")).toHaveAttribute("data-drop-highlighted", "false");
    expect(screen.getByTestId("inventory-dropzone")).toHaveAttribute("data-drop-highlighted", "false");
    expect(screen.getByTestId("trash-dropzone")).toHaveAttribute("data-drop-highlighted", "false");

    fireEvent.dragEnd(screen.getByTestId("toolbar-item-autosampler_rack_widget"));

    expect(screen.getByTestId("widget-workspace")).toHaveAttribute("data-drop-highlighted", "false");
  });

  it("highlights only occupied compatible stations when dragging a liquid", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([{ tool: makeTool() }]),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("bench-slot-station_1")).toBeInTheDocument();
    });

    const liquidTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("toolbar-item-acetonitrile_extraction"), {
      dataTransfer: liquidTransfer,
    });

    expect(screen.getByTestId("bench-slot-station_1")).toHaveAttribute("data-drop-highlighted", "true");
    expect(screen.getByTestId("bench-slot-station_2")).toHaveAttribute("data-drop-highlighted", "false");
    expect(screen.getByTestId("widget-workspace")).toHaveAttribute("data-drop-highlighted", "false");
    expect(screen.getByTestId("trash-dropzone")).toHaveAttribute("data-drop-highlighted", "false");

    fireEvent.dragEnd(screen.getByTestId("toolbar-item-acetonitrile_extraction"));

    expect(screen.getByTestId("bench-slot-station_1")).toHaveAttribute("data-drop-highlighted", "false");
  });

  it("highlights stations, rack slots, and trash when dragging an autosampler vial", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([{ tool: makeTool() }]),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([{ tool: makeTool() }]),
        workspaceWidgets: makeWorkspaceWithRackVisible({
          anchor: "top-left",
          offsetX: 206,
          offsetY: 388,
        }),
      }),
    );

    render(<PesticideWorkbench />);

    const workspace = await screen.findByTestId("widget-workspace");
    const rackTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("toolbar-item-autosampler_rack_widget"), {
      dataTransfer: rackTransfer,
    });
    fireEvent.drop(workspace, { clientX: 480, clientY: 420, dataTransfer: rackTransfer });

    await waitFor(() => {
      expect(screen.getByTestId("widget-rack")).toBeInTheDocument();
    });

    const vialTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("bench-tool-card-bench_tool_1"), {
      dataTransfer: vialTransfer,
    });

    expect(screen.getByTestId("bench-slot-station_2")).toHaveAttribute("data-drop-highlighted", "true");
    expect(screen.getByTestId("rack-illustration-slot-1")).toHaveAttribute("data-drop-highlighted", "true");
    expect(screen.getByTestId("trash-dropzone")).toHaveAttribute("data-drop-highlighted", "true");
    expect(screen.getByTestId("widget-workspace")).toHaveAttribute("data-drop-highlighted", "false");

    fireEvent.dragEnd(screen.getByTestId("bench-tool-card-bench_tool_1"));

    expect(screen.getByTestId("bench-slot-station_2")).toHaveAttribute("data-drop-highlighted", "false");
    expect(screen.getByTestId("rack-illustration-slot-1")).toHaveAttribute("data-drop-highlighted", "false");
    expect(screen.getByTestId("trash-dropzone")).toHaveAttribute("data-drop-highlighted", "false");
  });

  it("discards a bench tool when dropped into the trash", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([{ tool: makeTool({ toolType: "sample_vial", toolId: "sample_vial_lcms", label: "Autosampler vial" }) }]),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        auditLog: ["Autosampler vial discarded from Station 1."],
        slots: makeSlots(),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("bench-tool-card-bench_tool_1")).toBeInTheDocument();
    });

    const toolTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("bench-tool-card-bench_tool_1"), {
      dataTransfer: toolTransfer,
    });
    fireEvent.dragOver(screen.getByTestId("trash-dropzone"), { dataTransfer: toolTransfer });
    fireEvent.drop(screen.getByTestId("trash-dropzone"), { dataTransfer: toolTransfer });

    await waitFor(() => {
      expect(within(screen.getByTestId("bench-slot-station_1")).getByText("Empty station")).toBeInTheDocument();
    });

    expectToolMoveCommand("bench_tool_1", "workbench", "station_1", "trash_bin", "trash_bin");
  });

  it("discards a rack vial when dropped into the trash", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        rackSlots: makeRackSlots([{ tool: makeTool() }]),
        workspaceWidgets: makeWorkspaceWithRackVisible(),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        auditLog: ["Autosampler vial discarded from Position 1."],
        rackSlots: makeRackSlots(),
        workspaceWidgets: makeWorkspaceWithRackVisible(),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("rack-slot-tool-1")).toBeInTheDocument();
    });

    const vialTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("rack-slot-tool-1"), {
      dataTransfer: vialTransfer,
    });
    fireEvent.dragOver(screen.getByTestId("trash-dropzone"), { dataTransfer: vialTransfer });
    fireEvent.drop(screen.getByTestId("trash-dropzone"), { dataTransfer: vialTransfer });

    await waitFor(() => {
      expect(screen.queryByTestId("rack-slot-tool-1")).not.toBeInTheDocument();
    });

    expectToolMoveCommand("bench_tool_1", "rack", "rack_slot_1", "trash_bin", "trash_bin");
  });

  it("removes a workspace equipment widget when dropped on the trash", async () => {
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment());
    vi.mocked(sendExperimentCommand)
      .mockResolvedValueOnce(
        makeWorkbenchExperiment({
          workspaceWidgets: makeWorkspaceWithRackVisible({
            anchor: "top-left",
            offsetX: 206,
            offsetY: 388,
          }),
        }),
      )
      .mockResolvedValueOnce(
        makeWorkbenchExperiment({
          workspaceWidgets: makeWorkspaceWidgets(),
        }),
      );

    render(<PesticideWorkbench />);

    const workspace = await screen.findByTestId("widget-workspace");
    const rackTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("toolbar-item-autosampler_rack_widget"), {
      dataTransfer: rackTransfer,
    });
    fireEvent.drop(workspace, { clientX: 480, clientY: 420, dataTransfer: rackTransfer });

    await waitFor(() => {
      expect(screen.getByTestId("widget-rack")).toBeInTheDocument();
    });

    mockInventoryDropzoneBounds(screen.getByTestId("inventory-dropzone"));

    fireEvent.mouseDown(within(screen.getByTestId("widget-rack")).getByText("Autosampler rack"), {
      button: 0,
      clientX: 500,
      clientY: 430,
    });
    window.dispatchEvent(new MouseEvent("mouseup", { clientX: 100, clientY: 220 }));

    await waitFor(() => {
      expect(screen.queryByTestId("widget-rack")).not.toBeInTheDocument();
    });

    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "store_workspace_widget",
      { widget_id: "rack" },
    );
  });

  it("stores the LIMS widget from its header action", async () => {
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment());
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWidgets([
          { id: "lims", isPresent: false, isTrashed: false },
          {},
          {},
          {},
          {},
          {},
          {},
          {},
        ]),
      }),
    );

    render(<PesticideWorkbench />);

    const limsWidget = await screen.findByTestId("widget-lims");
    fireEvent.click(within(limsWidget).getByTestId("store-workspace-widget-lims"));

    await waitFor(() => {
      expect(screen.queryByTestId("widget-lims")).not.toBeInTheDocument();
    });

    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "store_workspace_widget",
      { widget_id: "lims" },
    );
  });

  it("disables storing equipment from the header while it still contains an item", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithGrossBalanceVisible({
          tool: makeTool({
            toolId: "sealed_sampling_bag",
            label: "Received sampling bag",
            subtitle: "Field collection",
            toolType: "sample_bag",
            capacity_ml: 500,
          }),
        }),
      }),
    );

    render(<PesticideWorkbench />);

    const button = await screen.findByTestId("store-workspace-widget-gross_balance");
    expect(button).toBeDisabled();

    fireEvent.click(button);

    expect(sendExperimentCommand).not.toHaveBeenCalledWith(
      "experiment_pesticides",
      "store_workspace_widget",
      { widget_id: "gross_balance" },
    );
  });

  it("disables storing the rack from the header while it still contains vials", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        rackSlots: makeRackSlots([{ tool: makeTool() }]),
        workspaceWidgets: makeWorkspaceWithRackVisible(),
      }),
    );

    render(<PesticideWorkbench />);

    const button = await screen.findByTestId("store-workspace-widget-rack");
    expect(button).toBeDisabled();

    fireEvent.click(button);

    expect(sendExperimentCommand).not.toHaveBeenCalledWith(
      "experiment_pesticides",
      "store_workspace_widget",
      { widget_id: "rack" },
    );
  });

  it("does not store the workbench when dragged onto the inventory", async () => {
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment());

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("widget-workbench")).toBeInTheDocument();
    });

    mockInventoryDropzoneBounds(screen.getByTestId("inventory-dropzone"));

    fireEvent.mouseDown(screen.getByText("Workbench"), {
      button: 0,
      clientX: 260,
      clientY: 24,
    });
    window.dispatchEvent(new MouseEvent("mouseup", { clientX: 100, clientY: 220 }));

    expect(screen.getByTestId("widget-workbench")).toBeInTheDocument();
  });

  it("opens the trash view on click and lists deleted tools and widgets from the backend", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        trashProduceLots: [
          {
            id: "trash_produce_lot_1",
            originLabel: "Sealed sampling bag",
            produceLot: makeProduceLot({ id: "produce_1" }),
          },
        ],
        trashTools: [
          makeTrashToolEntry({ liquids: [{ accent: "amber", id: "liq_1", liquidId: "acetonitrile", name: "Acetonitrile", volume_ml: 1 }] }),
        ],
        workspaceWidgets: makeWorkspaceWidgets([
          {},
          {},
          {},
          {},
          { isPresent: false, isTrashed: true },
          { isPresent: false, isTrashed: true },
          {},
          {},
        ]),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("trash-dropzone")).toBeInTheDocument();
    });

    expect(screen.getByTestId("trash-count-badge")).toHaveTextContent("4");

    fireEvent.click(screen.getByTestId("trash-dropzone"));

    const dialog = await screen.findByRole("dialog");
    expect(screen.getByTestId("trash-dialog-overlay")).toHaveClass("absolute");
    expect(screen.getByTestId("trash-dialog-overlay")).toHaveClass("top-full");
    expect(within(dialog).getByTestId("trash-tool-bench_tool_1")).toBeInTheDocument();
    expect(within(dialog).getByTestId("trash-produce-lot-trash_produce_lot_1")).toBeInTheDocument();
    expect(within(dialog).getByTestId("trash-widget-rack")).toBeInTheDocument();
    expect(within(dialog).getByTestId("trash-widget-instrument")).toBeInTheDocument();
  });

  it("closes the trash view when clicking the trash icon again", async () => {
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment());

    render(<PesticideWorkbench />);

    const trashButton = await screen.findByTestId("trash-dropzone");

    fireEvent.click(trashButton);
    await waitFor(() => {
      expect(screen.getByTestId("trash-dialog-overlay")).toBeInTheDocument();
    });

    fireEvent.click(trashButton);
    await waitFor(() => {
      expect(screen.queryByTestId("trash-dialog-overlay")).not.toBeInTheDocument();
    });
  });

  it("opens the produce basket view on click and creates an apple through the backend", async () => {
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment());
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        auditLog: ["Apple lot 1 created in a received sampling bag."],
        basketTools: [makeSampleBagTool({
          id: "bench_tool_bag",
          label: "Received sampling bag",
          subtitle: "Field reception",
          fieldLabelText: "Martin Orchard • Harvest 2026-03-29 • Approx. 2.50 kg",
          produceLots: [
            makeProduceLot({ id: "produce_1" }),
          ],
        })],
      }),
    );

    render(<PesticideWorkbench />);

    const basketOpenButton = await screen.findByTestId("basket-open-button");

    expect(screen.queryByTestId("basket-dialog-overlay")).not.toBeInTheDocument();
    expect(screen.getByTestId("basket-count-badge")).toHaveTextContent("0");

    fireEvent.click(basketOpenButton);

    const dialog = await screen.findByRole("dialog");
    expect(screen.getByTestId("basket-dialog-overlay")).toHaveClass("absolute");
    expect(screen.getByTestId("basket-dialog-overlay")).toHaveClass("top-full");
    expect(within(dialog).getByText("No produce lots created yet.")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByTestId("basket-create-apple-lot-button"));

    await waitFor(() => {
      expect(within(dialog).getByText("Received sampling bag")).toBeInTheDocument();
    });

    expect(within(dialog).getByTestId("basket-received-bag")).toBeInTheDocument();
    expect(within(dialog).getByText("Martin Orchard • Harvest 2026-03-29 • Approx. 2.50 kg")).toBeInTheDocument();
    expect(screen.getByTestId("basket-count-badge")).toHaveTextContent("1");
    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "create_produce_lot",
      { produce_type: "apple" },
    );
  });

  it("closes the produce basket view when clicking the basket icon again", async () => {
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment());

    render(<PesticideWorkbench />);

    const basketOpenButton = await screen.findByTestId("basket-open-button");

    fireEvent.click(basketOpenButton);
    await waitFor(() => {
      expect(screen.getByTestId("basket-dialog-overlay")).toBeInTheDocument();
    });

    fireEvent.click(basketOpenButton);
    await waitFor(() => {
      expect(screen.queryByTestId("basket-dialog-overlay")).not.toBeInTheDocument();
    });
  });

  it("does not open the trash view when clicking the trash icon in spatula mode", async () => {
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment());

    render(<PesticideWorkbench />);

    fireEvent.click(await screen.findByRole("button", { name: "Powder spatula" }));
    fireEvent.click(await screen.findByTestId("trash-dropzone"));

    expect(screen.queryByTestId("trash-dialog-overlay")).not.toBeInTheDocument();
  });

  it("does not open the produce basket when clicking it in spatula mode", async () => {
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment());

    render(<PesticideWorkbench />);

    fireEvent.click(await screen.findByRole("button", { name: "Powder spatula" }));
    fireEvent.click(await screen.findByTestId("basket-open-button"));

    expect(screen.queryByTestId("basket-dialog-overlay")).not.toBeInTheDocument();
  });

  it("moves basket produce into a sealed sampling bag", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        basketProduceLots: [
          makeProduceLot({ id: "produce_1" }),
        ],
        slots: makeSlots([{ tool: makeSampleBagTool() }]),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        basketProduceLots: [],
        slots: makeSlots([
          {
            tool: makeSampleBagTool({
              produceLots: [
                makeProduceLot({ id: "produce_1" }),
              ],
            }),
          },
        ]),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("bench-slot-station_1")).toBeInTheDocument();
    });

    fireEvent.click(await screen.findByTestId("basket-open-button"));
    const basketProduce = await screen.findByTestId("basket-produce-produce_1");
    const transfer = createDataTransfer();

    fireEvent.dragStart(basketProduce, { dataTransfer: transfer });
    const dragOverEvent = createEvent.dragOver(screen.getByTestId("bench-slot-station_1"), {
      dataTransfer: transfer,
    });
    fireEvent(screen.getByTestId("bench-slot-station_1"), dragOverEvent);
    fireEvent.drop(screen.getByTestId("bench-slot-station_1"), { dataTransfer: transfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);

    await waitFor(() => {
      expect(
        within(screen.getByTestId("bench-slot-station_1")).getByText("Apple lot 1"),
      ).toBeInTheDocument();
    });

    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "move_object",
      {
        destination: { kind: "workbench_tool", id: "station_1" },
        entity: { kind: "produce_lot", id: "produce_1" },
        source: { kind: "basket", id: "produce_basket" },
      },
    );
    expect(screen.getByTestId("basket-count-badge")).toHaveTextContent("0");
  });

  it("moves basket produce onto an empty station and marks it contaminated", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        basketProduceLots: [
          makeProduceLot({ id: "produce_1" }),
        ],
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        auditLog: ["Apple lot 1 placed directly on Station 2 and marked contaminated."],
        basketProduceLots: [],
        slots: makeSlots([
          {},
          {
            surfaceProduceLots: [
              makeProduceLot({ id: "produce_1", isContaminated: true }),
            ],
          },
        ]),
      }),
    );

    render(<PesticideWorkbench />);

    fireEvent.click(await screen.findByTestId("basket-open-button"));
    const basketProduce = await screen.findByTestId("basket-produce-produce_1");
    const transfer = createDataTransfer();

    fireEvent.dragStart(basketProduce, { dataTransfer: transfer });
    const dragOverEvent = createEvent.dragOver(screen.getByTestId("bench-slot-station_2"), {
      dataTransfer: transfer,
    });
    fireEvent(screen.getByTestId("bench-slot-station_2"), dragOverEvent);
    fireEvent.drop(screen.getByTestId("bench-slot-station_2"), { dataTransfer: transfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "move_object",
      {
        destination: { kind: "workbench_tool", id: "station_2" },
        entity: { kind: "produce_lot", id: "produce_1" },
        source: { kind: "basket", id: "produce_basket" },
      },
    );

    await waitFor(() => {
      expect(
        within(screen.getByTestId("bench-slot-station_2")).getByText("Apple lot 1"),
      ).toBeInTheDocument();
    });
  });

  it("drops a basket apple lot into the grinder", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        basketProduceLots: [
          makeProduceLot({ id: "produce_1" }),
        ],
        workspaceWidgets: makeWorkspaceWithGrinderVisible(),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        basketProduceLots: [],
        workspaceWidgets: makeWorkspaceWithGrinderVisible({
          produceLots: [
            makeProduceLot({ id: "produce_1" }),
          ],
        }),
      }),
    );

    render(<PesticideWorkbench />);

    fireEvent.click(await screen.findByTestId("basket-open-button"));
    const basketProduce = await screen.findByTestId("basket-produce-produce_1");
    const transfer = createDataTransfer();

    fireEvent.dragStart(basketProduce, { dataTransfer: transfer });
    const dragOverEvent = createEvent.dragOver(screen.getByTestId("grinder-dropzone"), {
      dataTransfer: transfer,
    });
    fireEvent(screen.getByTestId("grinder-dropzone"), dragOverEvent);
    fireEvent.drop(screen.getByTestId("grinder-dropzone"), { dataTransfer: transfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "move_object",
      {
        destination: { kind: "workspace_widget", id: "grinder" },
        entity: { kind: "produce_lot", id: "produce_1" },
        source: { kind: "basket", id: "produce_basket" },
      },
    );

    await waitFor(() => {
      expect(screen.getByTestId("grinder-produce-produce_1")).toBeInTheDocument();
    });
  });

  it("opens a dosing popover when dry ice pellets are dropped into the grinder", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithGrinderVisible(),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("grinder-dropzone")).toBeInTheDocument();
    });

    const transfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("toolbar-item-dry_ice_pellets"), {
      dataTransfer: transfer,
    });
    const dragOverEvent = createEvent.dragOver(screen.getByTestId("grinder-dropzone"), {
      dataTransfer: transfer,
    });
    fireEvent(screen.getByTestId("grinder-dropzone"), dragOverEvent);
    fireEvent.drop(screen.getByTestId("grinder-dropzone"), { dataTransfer: transfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    expect(sendExperimentCommand).not.toHaveBeenCalled();
    expect(screen.getByText("Dose Dry ice pellets (CO2)")).toBeInTheDocument();
    expect(screen.getByLabelText("Dry ice draft mass")).toHaveValue(1000);
  });

  it("sends the dosed dry ice mass only after the user confirms the grinder popover", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithGrinderVisible(),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithGrinderVisible({
          liquids: [
            {
              id: "workspace_liquid_1",
              liquidId: "dry_ice_pellets",
              name: "Dry ice pellets",
              volume_ml: 1200,
              accent: "sky",
            },
          ],
        }),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("grinder-dropzone")).toBeInTheDocument();
    });

    const transfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("toolbar-item-dry_ice_pellets"), {
      dataTransfer: transfer,
    });
    fireEvent.drop(screen.getByTestId("grinder-dropzone"), { dataTransfer: transfer });

    fireEvent.change(screen.getByLabelText("Dry ice draft mass"), {
      target: { value: "1200" },
    });
    fireEvent.click(screen.getByText("Add"));

    await waitFor(() => {
      expect(sendExperimentCommand).toHaveBeenCalledWith(
        "experiment_pesticides",
        "add_liquid_to_workspace_widget",
        {
          widget_id: "grinder",
          liquid_id: "dry_ice_pellets",
          volume_ml: 1200,
        },
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Dry ice pellets")).toBeInTheDocument();
    });
  });

  it("shows poured dry ice as a read-only mass label in the grinder", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithGrinderVisible({
          liquids: [
            {
              id: "workspace_liquid_1",
              liquidId: "dry_ice_pellets",
              name: "Dry ice pellets",
              volume_ml: 1000,
              accent: "sky",
            },
          ],
        }),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByText("1000 g")).toBeInTheDocument();
    });

    expect(screen.queryByLabelText("Dry ice pellets mass")).not.toBeInTheDocument();
  });

  it("keeps the grinder power button disabled until a produce lot is loaded", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithGrinderVisible(),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("grinder-power-button")).toBeInTheDocument();
    });

    expect(screen.getByTestId("grinder-lcd-status")).toHaveTextContent("STANDBY");
    expect(screen.getByTestId("grinder-lcd-message")).toHaveTextContent("Awaiting load");
    expect(screen.getByTestId("grinder-power-button")).toBeDisabled();
  });

  it("shows OVERLOAD on the grinder lcd when the backend reports a whole apple lot", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithGrinderVisible({
          produceLots: [
            makeProduceLot({ id: "produce_1", materialState: "whole", temperatureC: 2 }),
          ],
        }),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("grinder-power-button")).toBeInTheDocument();
    });

    expect(screen.getByTestId("grinder-lcd-status")).toHaveTextContent("OVERLOAD");
    expect(screen.getByTestId("grinder-lcd-message")).toHaveTextContent("Whole fruit detected");
    expect(screen.getByTestId("cryogenic-grinder-illustration")).toHaveAttribute(
      "data-status",
      "idle",
    );
  });

  it("shows JAMMED on the grinder lcd when the backend reports produce that is not cold enough", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithGrinderVisible({
          produceLots: [
            makeProduceLot({ id: "produce_1", materialState: "cut", temperatureC: 12 }),
          ],
        }),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("grinder-power-button")).toBeInTheDocument();
    });

    expect(screen.getByTestId("grinder-lcd-status")).toHaveTextContent("JAMMED");
    expect(screen.getByTestId("grinder-lcd-message")).toHaveTextContent("Product not cold enough");
    expect(screen.getByTestId("cryogenic-grinder-illustration")).toHaveAttribute(
      "data-status",
      "idle",
    );
  });

  it("reads the loaded lot temperature on the grinder illustration", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithGrinderVisible({
          produceLots: [
            makeProduceLot({ id: "produce_1", materialState: "cut", temperatureC: -52.3 }),
          ],
        }),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("grinder-power-button")).toBeInTheDocument();
    });

    const readout = screen.getByTestId("grinder-temperature-readout");
    expect(readout).toHaveTextContent("-52°C");
    expect(readout).toHaveAttribute("data-tone", "cryogenic");
  });

  it("shows no grinder temperature reading while the chamber is empty", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithGrinderVisible({ produceLots: [] }),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("grinder-power-button")).toBeInTheDocument();
    });

    expect(screen.getByTestId("grinder-temperature-readout")).toHaveTextContent("--°C");
  });

  it("starts a backend-authoritative grinder cycle from the power button", async () => {
    const grinderReadyExperiment = makeWorkbenchExperiment({
      workspaceWidgets: makeWorkspaceWithGrinderVisible({
        grinderRunDurationMs: 0,
        grinderRunRemainingMs: 0,
        produceLots: [
          makeProduceLot({ id: "produce_1", materialState: "cut", temperatureC: -45 }),
        ],
        liquids: [
          {
            id: "workspace_liquid_1",
            liquidId: "dry_ice_pellets",
            name: "Dry ice pellets",
            volume_ml: 1000,
            accent: "sky",
          },
        ],
      }),
    });
    vi.mocked(createExperiment).mockResolvedValue(grinderReadyExperiment);
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithGrinderVisible({
          grinderRunDurationMs: 30000,
          grinderRunRemainingMs: 30000,
          produceLots: [
            makeProduceLot({ id: "produce_1", materialState: "cut", temperatureC: -75 }),
          ],
          liquids: [
            {
              id: "workspace_liquid_1",
              liquidId: "dry_ice_pellets",
              name: "Dry ice pellets",
              volume_ml: 400,
              accent: "sky",
            },
          ],
        }),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("grinder-power-button")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByTestId("grinder-lcd-status")).toHaveTextContent("READY");
      expect(screen.getByTestId("grinder-power-button")).not.toBeDisabled();
    });

    fireEvent.click(screen.getByTestId("grinder-power-button"));

    await waitFor(() => {
      expect(sendExperimentCommand).toHaveBeenCalledWith(
        "experiment_pesticides",
        "start_grinder_cycle",
        { widget_id: "grinder" },
      );
    });

    act(() => {
      emitExperimentSnapshot(
        "experiment_pesticides",
        makeWorkbenchExperiment({
          snapshotVersion: 2,
          workspaceWidgets: makeWorkspaceWithGrinderVisible({
            grinderRunDurationMs: 30000,
            grinderRunRemainingMs: 15000,
            produceLots: [
              makeProduceLot({ id: "produce_1", materialState: "cut", temperatureC: -69.2 }),
            ],
            liquids: [
              {
                id: "workspace_liquid_1",
                liquidId: "dry_ice_pellets",
                name: "Dry ice pellets",
                volume_ml: 390.4,
                accent: "sky",
              },
            ],
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("grinder-lcd-status")).toHaveTextContent("RUNNING");
      expect(screen.getByTestId("grinder-lcd-progress-bar")).toBeInTheDocument();
      expect(screen.getByTestId("grinder-lcd-panel")).toHaveAttribute(
        "data-tutorial-anchor",
        "grinder-progress",
      );
      expect(screen.getByTestId("grinder-lcd-progress-bar")).not.toHaveAttribute(
        "data-tutorial-anchor",
      );
      expect(screen.getByTestId("grinder-lcd-rpm")).toHaveTextContent("RPM 10000");
      expect(screen.getByTestId("grinder-lcd-load")).toHaveTextContent("Cryo mode");
      expect(screen.getByTestId("grinder-power-button")).toBeDisabled();
      expect(screen.getByTestId("grinder-produce-produce_1")).not.toHaveAttribute("draggable", "true");
      expect(screen.getByTestId("grinder-liquid-workspace_liquid_1")).not.toHaveAttribute("draggable", "true");
      expect(screen.getByTestId("cryogenic-grinder-illustration")).toHaveAttribute(
        "data-status",
        "running",
      );
    });

    const runningDropTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("toolbar-item-dry_ice_pellets"), {
      dataTransfer: runningDropTransfer,
    });
    const runningDragOverEvent = createEvent.dragOver(screen.getByTestId("grinder-dropzone"), {
      dataTransfer: runningDropTransfer,
    });
    fireEvent(screen.getByTestId("grinder-dropzone"), runningDragOverEvent);
    fireEvent.drop(screen.getByTestId("grinder-dropzone"), { dataTransfer: runningDropTransfer });
    expect(runningDragOverEvent.defaultPrevented).toBe(false);

    act(() => {
      emitExperimentSnapshot(
        "experiment_pesticides",
        makeWorkbenchExperiment({
          snapshotVersion: 3,
          workspaceWidgets: makeWorkspaceWithGrinderVisible({
            grinderRunDurationMs: 0,
            grinderRunRemainingMs: 0,
            produceLots: [
              makeProduceLot({ id: "produce_1", materialState: "ground", residualCo2MassG: 381.7, temperatureC: -65.1 }),
            ],
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("grinder-lcd-status")).toHaveTextContent("COMPLETE");
      expect(screen.getByTestId("grinder-lcd-message")).toHaveTextContent("Unload ground product");
      expect(screen.getByTestId("grinder-power-button")).toBeDisabled();
      expect(screen.getByTestId("grinder-produce-produce_1")).toHaveTextContent("Apple lot 1 powder");
    });
    expect(within(screen.getByTestId("grinder-produce-produce_1")).getByTestId("degassing-indicator")).toBeInTheDocument();
    expect(within(screen.getByTestId("grinder-produce-produce_1")).getByTestId("degassing-indicator-fill")).toHaveStyle({
      height: "100%",
    });
    expect(screen.queryByText("Dry ice pellets")).not.toBeInTheDocument();
  });

  it("shows a thermometer for grinder produce and updates it from the experiment stream", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithGrinderVisible({
          produceLots: [
            makeProduceLot({ id: "produce_1", temperatureC: 12 }),
          ],
          liquids: [
            {
              id: "workspace_liquid_1",
              liquidId: "dry_ice_pellets",
              name: "Dry ice pellets",
              volume_ml: 1000,
              accent: "sky",
            },
          ],
        }),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByText("12.0°C")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(subscribeToExperimentStream).toHaveBeenCalledWith(
        "experiment_pesticides",
        expect.objectContaining({
          onMessage: expect.any(Function),
        }),
      );
    });

    act(() => {
      emitExperimentSnapshot(
        "experiment_pesticides",
        makeWorkbenchExperiment({
          snapshotVersion: 2,
          workspaceWidgets: makeWorkspaceWithGrinderVisible({
            produceLots: [
              makeProduceLot({ id: "produce_1", temperatureC: 8 }),
            ],
            liquids: [
              {
                id: "workspace_liquid_1",
                liquidId: "dry_ice_pellets",
                name: "Dry ice pellets",
                volume_ml: 998.4,
                accent: "sky",
              },
            ],
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText("8.0°C")).toBeInTheDocument();
    });
    expect(sendExperimentCommand).not.toHaveBeenCalled();
  });

  it("shows WARNING while a running grinder enters the high-torque temperature band", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithGrinderVisible({
          grinderRunDurationMs: 30000,
          grinderRunRemainingMs: 10000,
          produceLots: [
            makeProduceLot({ id: "produce_1", materialState: "cut", temperatureC: -15 }),
          ],
          liquids: [
            {
              id: "workspace_liquid_1",
              liquidId: "dry_ice_pellets",
              name: "Dry ice pellets",
              volume_ml: 40,
              accent: "sky",
            },
          ],
        }),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("grinder-lcd-status")).toHaveTextContent("WARNING");
      expect(screen.getByTestId("grinder-lcd-rpm")).toHaveTextContent("RPM 10000");
      expect(screen.getByTestId("grinder-lcd-load")).toHaveTextContent("Pre-cool now");
    });
  });

  it("shows JAMMED when the backend reports a grinder motor jam", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithGrinderVisible({
          grinderFault: "motor_jammed",
          grinderRunDurationMs: 0,
          grinderRunRemainingMs: 0,
          produceLots: [
            makeProduceLot({ id: "produce_1", materialState: "cut", temperatureC: -8 }),
          ],
        }),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("grinder-lcd-status")).toHaveTextContent("JAMMED");
      expect(screen.getByTestId("grinder-lcd-message")).toHaveTextContent("Product not cold enough");
      expect(screen.getByTestId("grinder-lcd-load")).toHaveTextContent("Pre-cool");
    });
  });

  it("updates cold workbench produce from the experiment stream", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([
          {
            tool: makeSampleBagTool({
              produceLots: [
                makeProduceLot({ id: "produce_1", temperatureC: 4.2 }),
              ],
            }),
          },
        ]),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByText("4.2°C")).toBeInTheDocument();
    });

    act(() => {
      emitExperimentSnapshot(
        "experiment_pesticides",
        makeWorkbenchExperiment({
          snapshotVersion: 2,
          slots: makeSlots([
            {
              tool: makeSampleBagTool({
                produceLots: [
                  makeProduceLot({ id: "produce_1", temperatureC: 6.1 }),
                ],
              }),
            },
          ]),
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText("6.1°C")).toBeInTheDocument();
    });
    expect(sendExperimentCommand).not.toHaveBeenCalled();
  });

  it("keeps showing a degassing indicator after ground produce leaves the grinder", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([
          {
            tool: makeSampleBagTool({
              produceLots: [
                makeProduceLot({ id: "produce_1", materialState: "ground", residualCo2MassG: 42.5, temperatureC: -58.1 }),
              ],
            }),
          },
        ]),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("bench-produce-lot-produce_1")).toHaveAttribute("data-degassing", "true");
    });
    expect(within(screen.getByTestId("bench-produce-lot-produce_1")).getByTestId("degassing-indicator")).toBeInTheDocument();
  });

  it("pauses cryogenic ticks while the grinder dosing draft is open", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithGrinderVisible(),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("grinder-dropzone")).toBeInTheDocument();
    });

    const transfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("toolbar-item-dry_ice_pellets"), {
      dataTransfer: transfer,
    });
    fireEvent.drop(screen.getByTestId("grinder-dropzone"), { dataTransfer: transfer });

    vi.useFakeTimers();
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(sendExperimentCommand).not.toHaveBeenCalled();
  });

  it("disables drag and drop interactions while the knife action is selected", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        basketProduceLots: [
          makeProduceLot({ id: "produce_1" }),
        ],
        rackSlots: makeRackSlots([
          {
            tool: makeTool({
              id: "rack_tool_1",
              toolId: "sample_vial_lcms",
              label: "Autosampler vial",
              subtitle: "Injection ready",
              accent: "sky",
              toolType: "sample_vial",
              capacity_ml: 2,
              liquids: [],
            }),
          },
        ]),
        workspaceWidgets: makeWorkspaceWidgets([
          {},
          {},
          {},
          {},
          { isPresent: true },
          {},
          {},
          {
            isPresent: true,
            produceLots: [
              makeProduceLot({ id: "grinder_produce_1", label: "Cold apple lot", materialState: "cut", temperatureC: -35 }),
            ],
          },
        ]),
      }),
    );

    render(<PesticideWorkbench />);

    fireEvent.click(await screen.findByRole("button", { name: "Stainless steel knife" }));

    const toolbarItem = screen.getByTestId("toolbar-item-sample_vial_lcms");
    const basketOpenButton = await screen.findByTestId("basket-open-button");
    fireEvent.click(basketOpenButton);
    const basketProduce = await screen.findByTestId("basket-produce-produce_1");
    const rackTool = screen.getByTestId("rack-slot-tool-1");
    const grinderProduce = await screen.findByTestId("grinder-produce-grinder_produce_1");

    expect(toolbarItem).not.toHaveAttribute("draggable", "true");
    expect(basketProduce).not.toHaveAttribute("draggable", "true");
    expect(rackTool).not.toHaveAttribute("draggable", "true");
    expect(grinderProduce).not.toHaveAttribute("draggable", "true");

    const transfer = createDataTransfer();
    fireEvent.dragStart(toolbarItem, { dataTransfer: transfer });
    const dragOverEvent = createEvent.dragOver(screen.getByTestId("bench-slot-station_1"), {
      dataTransfer: transfer,
    });
    fireEvent(screen.getByTestId("bench-slot-station_1"), dragOverEvent);

    expect(dragOverEvent.defaultPrevented).toBe(false);
    expect(sendExperimentCommand).not.toHaveBeenCalled();
  });

  it("toggles the knife action with the K shortcut", async () => {
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment());

    render(<PesticideWorkbench />);

    const knifeButton = await screen.findByRole("button", { name: "Stainless steel knife" });

    expect(knifeButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.keyDown(window, { key: "k" });
    expect(knifeButton).toHaveAttribute("aria-pressed", "true");

    fireEvent.keyDown(window, { key: "K" });
    expect(knifeButton).toHaveAttribute("aria-pressed", "false");
  });

  it("loads the spatula when clicking a storage jar in spatula mode", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([
          {
            tool: makeTool({
              id: "bench_tool_jar",
              toolId: "hdpe_storage_jar_2l",
              label: "Wide-neck HDPE jar",
              subtitle: "Bulk powder storage",
              toolType: "storage_jar",
              capacity_ml: 2000,
              powderMassG: 60,
            }),
          },
        ]),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        auditLog: ["Spatula loaded from Wide-neck HDPE jar."],
        slots: makeSlots([
          {
            tool: makeTool({
              id: "bench_tool_jar",
              toolId: "hdpe_storage_jar_2l",
              label: "Wide-neck HDPE jar",
              subtitle: "Bulk powder storage",
              toolType: "storage_jar",
              capacity_ml: 2000,
              powderMassG: 58.4,
            }),
          },
        ]),
      }),
    );

    render(<PesticideWorkbench />);

    fireEvent.click(await screen.findByRole("button", { name: "Powder spatula" }));
    fireEvent.click(screen.getByTestId("bench-tool-illustration-bench_tool_jar"));

    await waitFor(() => {
      expect(sendExperimentCommand).toHaveBeenCalledWith(
        "experiment_pesticides",
        "load_spatula_from_workbench_tool",
        { slot_id: "station_1" },
      );
    });
  });

  it("cuts a whole apple on a cutting board when clicking it in knife mode", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([
          {
            tool: {
              id: "bench_tool_board",
              toolId: "cutting_board_hdpe",
              label: "Cutting board",
              subtitle: "Prep surface",
              accent: "amber",
              toolType: "cutting_board",
              capacity_ml: 0,
              produceLots: [
                makeProduceLot({ id: "produce_1", materialState: "whole" }),
              ],
              liquids: [],
            },
          },
        ]),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        auditLog: ["Apple lot 1 cut on Cutting board."],
        slots: makeSlots([
          {
            tool: {
              id: "bench_tool_board",
              toolId: "cutting_board_hdpe",
              label: "Cutting board",
              subtitle: "Prep surface",
              accent: "amber",
              toolType: "cutting_board",
              capacity_ml: 0,
              produceLots: [
                makeProduceLot({ id: "produce_1", materialState: "cut" }),
              ],
              liquids: [],
            },
          },
        ]),
      }),
    );

    render(<PesticideWorkbench />);

    fireEvent.click(await screen.findByRole("button", { name: "Stainless steel knife" }));
    fireEvent.click(await screen.findByTestId("bench-produce-lot-produce_1"));

    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "cut_workbench_produce_lot",
      { slot_id: "station_1", produce_lot_id: "produce_1" },
    );

    await waitFor(() => {
      expect(screen.getByText("Apple lot 1")).toBeInTheDocument();
    });
    expect(screen.getByTestId("apple-illustration")).toHaveAttribute("data-variant", "cut");
  });

  it("applies a sampling label from the palette onto an unlabeled sampling bag", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([{ tool: makeSampleBagTool() }]),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([{ tool: makeSampleBagTool({ labels: [makeSampleBagLabel({ text: "" })] }) }]),
      }),
    );

    render(<PesticideWorkbench />);

    const station = await screen.findByTestId("bench-slot-station_1");
    const labelItem = screen.getByTestId("toolbar-item-sampling_bag_label");
    const transfer = createDataTransfer();

    fireEvent.dragStart(labelItem, { dataTransfer: transfer });
    const dragOverEvent = createEvent.dragOver(station, { dataTransfer: transfer });
    fireEvent(station, dragOverEvent);
    fireEvent.drop(station, { dataTransfer: transfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "apply_sample_label_to_workbench_tool",
      { slot_id: "station_1" },
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Sample label text")).toBeInTheDocument();
    });
  });

  it("moves the received basket bag onto an empty bench station", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        basketTools: [makeSampleBagTool({
          id: "received_bag_1",
          fieldLabelText: "Martin Orchard • Harvest 2026-03-29 • Approx. 2.50 kg",
          produceLots: [
            makeProduceLot({ id: "produce_1", label: "Orchard apple lot" }),
          ],
        })],
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        basketTools: [],
        slots: makeSlots([{ tool: makeSampleBagTool({ id: "received_bag_1" }) }]),
      }),
    );

    render(<PesticideWorkbench />);

    fireEvent.click(await screen.findByTestId("basket-open-button"));
    const bagCard = await screen.findByTestId("basket-received-bag");
    const station = screen.getByTestId("bench-slot-station_1");
    const transfer = createDataTransfer();

    fireEvent.dragStart(bagCard, { dataTransfer: transfer });
    const dragOverEvent = createEvent.dragOver(station, { dataTransfer: transfer });
    fireEvent(station, dragOverEvent);
    fireEvent.drop(station, { dataTransfer: transfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    expectToolMoveCommand("received_bag_1", "basket", "received_bag_1", "workbench_slot", "station_1");
  });

  it("records gross balance weight when a workbench object is dropped onto the scale", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([
          {
            tool: makeTool({
              toolId: "sealed_sampling_bag",
              label: "Received sampling bag",
              subtitle: "Field reception",
              toolType: "sample_bag",
              capacity_ml: 500,
              produceLots: [
                makeProduceLot({ id: "produce_1" }),
              ],
            }),
          },
        ]),
        workspaceWidgets: makeWorkspaceWithGrossBalanceVisible(),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        limsReception: makeLimsReception({ measuredGrossMassG: 2486 }),
        workspaceWidgets: makeWorkspaceWithGrossBalanceVisible({
          tool: makeTool({
            id: "bench_tool_1",
            toolId: "sealed_sampling_bag",
            label: "Received sampling bag",
            subtitle: "Field reception",
            toolType: "sample_bag",
            capacity_ml: 500,
            produceLots: [
              makeProduceLot({ id: "produce_1" }),
            ],
          }),
        }),
      }),
    );

    render(<PesticideWorkbench />);

    const tool = await screen.findByTestId("bench-tool-card-bench_tool_1");
    const balance = screen.getByTestId("gross-balance-dropzone");
    const transfer = createDataTransfer();

    fireEvent.dragStart(tool, { dataTransfer: transfer });
    const dragOverEvent = createEvent.dragOver(balance, { dataTransfer: transfer });
    fireEvent(balance, dragOverEvent);
    fireEvent.drop(balance, { dataTransfer: transfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    await waitFor(() => {
      expectToolMoveCommand("bench_tool_1", "workbench", "station_1", "gross_balance", "gross_balance");
    });
    expect(screen.getByTestId("gross-balance-staged-item")).toBeInTheDocument();
    expect(screen.queryByTestId("bench-tool-card-bench_tool_1")).not.toBeInTheDocument();
    expect(screen.getAllByText("2486.0 g")).toHaveLength(3);
  });

  it("adjusts the gross balance container offset with +/- buttons and updates the net display", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        limsReception: makeLimsReception({
          measuredGrossMassG: 2486,
          grossMassOffsetG: -35,
        }),
        workspaceWidgets: makeWorkspaceWithGrossBalanceVisible(),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        limsReception: makeLimsReception({
          measuredGrossMassG: 2486,
          grossMassOffsetG: -36,
        }),
        workspaceWidgets: makeWorkspaceWithGrossBalanceVisible(),
      }),
    );

    render(<PesticideWorkbench />);

    expect(await screen.findAllByText("2486.0 g")).toHaveLength(2);
    expect(screen.getByText("-35 g")).toBeInTheDocument();
    expect(screen.getByText("2451.0 g")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Decrease gross balance offset" }));

    await waitFor(() => {
      expect(sendExperimentCommand).toHaveBeenCalledWith(
        "experiment_pesticides",
        "set_gross_balance_container_offset",
        { gross_mass_offset_g: -36 },
      );
    });

    expect(await screen.findByText("-36 g")).toBeInTheDocument();
    expect(screen.getAllByText("2450.0 g")).toHaveLength(2);
  });

  it("allows creating a LIMS record from manual entry without a gross weight", async () => {
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment());
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        limsReception: makeLimsReception({
          orchardName: "Martin Orchard",
          harvestDate: "2026-03-29",
          indicativeMassG: 2041.1,
          measuredGrossMassG: null,
          labSampleCode: "APP-0001-01",
          status: "awaiting_label_application",
        }),
      }),
    );

    render(<PesticideWorkbench />);

    fireEvent.change(await screen.findByLabelText("Orchard / producer"), {
      target: { value: "Martin Orchard" },
    });
    fireEvent.change(screen.getByLabelText("Harvest date"), {
      target: { value: "2026-03-29" },
    });
    fireEvent.change(screen.getByLabelText("Declared mass from bag label (g)"), {
      target: { value: "2041.1" },
    });

    const createButton = screen.getByRole("button", { name: "Create LIMS record" });
    expect(createButton).toBeEnabled();

    fireEvent.click(createButton);

    await waitFor(() => {
      expect(sendExperimentCommand).toHaveBeenCalledWith(
        "experiment_pesticides",
        "create_lims_reception",
        {
          orchard_name: "Martin Orchard",
          harvest_date: "2026-03-29",
          indicative_mass_g: 2041.1,
          measured_gross_mass_g: null,
          measured_sample_mass_g: null,
        },
      );
    });
  });

  it("allows creating a LIMS record with a manually entered sample mass", async () => {
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment());
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        limsReception: makeLimsReception({
          orchardName: "Martin Orchard",
          harvestDate: "2026-03-29",
          indicativeMassG: 2041.1,
          measuredSampleMassG: 10,
          labSampleCode: "APP-0001-01",
          status: "awaiting_label_application",
        }),
      }),
    );

    render(<PesticideWorkbench />);

    fireEvent.change(await screen.findByLabelText("Orchard / producer"), {
      target: { value: "Martin Orchard" },
    });
    fireEvent.change(screen.getByLabelText("Harvest date"), {
      target: { value: "2026-03-29" },
    });
    fireEvent.change(screen.getByLabelText("Declared mass from bag label (g)"), {
      target: { value: "2041.1" },
    });
    fireEvent.change(screen.getByLabelText("Sample mass (g)"), {
      target: { value: "10.00" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create LIMS record" }));

    await waitFor(() => {
      expect(sendExperimentCommand).toHaveBeenCalledWith(
        "experiment_pesticides",
        "create_lims_reception",
        {
          orchard_name: "Martin Orchard",
          harvest_date: "2026-03-29",
          indicative_mass_g: 2041.1,
          measured_gross_mass_g: null,
          measured_sample_mass_g: 10,
        },
      );
    });
  });

  it("keeps New entry selected when the user switches away from the current entry", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        limsReception: makeLimsReception({
          id: "lims_entry_1",
          orchardName: "Martin Orchard",
          harvestDate: "2026-03-29",
          indicativeMassG: 2041.1,
          measuredGrossMassG: null,
          labSampleCode: "APP-0001-01",
          status: "awaiting_label_application",
        }),
      }),
    );

    render(<PesticideWorkbench />);

    const recordSelect = await screen.findByLabelText("Record");
    expect(recordSelect).toHaveValue("lims_entry_1");

    fireEvent.change(recordSelect, { target: { value: "new" } });

    await waitFor(() => {
      expect(recordSelect).toHaveValue("new");
      expect(screen.getByRole("button", { name: "Create LIMS record" })).toBeInTheDocument();
    });
  });

  it("clears the sample mass field when switching to a LIMS entry without one", async () => {
    const entryWithSampleMass = makeLimsReception({
      id: "lims_entry_1",
      orchardName: "Martin Orchard",
      harvestDate: "2026-03-29",
      indicativeMassG: 2041.1,
      measuredSampleMassG: 10,
      labSampleCode: "APP-0001-01",
      status: "awaiting_label_application",
    });
    const entryWithoutSampleMass = makeLimsReception({
      id: "lims_entry_2",
      orchardName: "Martin Orchard",
      harvestDate: "2026-03-30",
      indicativeMassG: 1998.4,
      measuredSampleMassG: null,
      labSampleCode: "APP-0001-02",
      status: "awaiting_label_application",
    });

    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        limsReception: entryWithSampleMass,
        limsEntries: [entryWithSampleMass, entryWithoutSampleMass],
      }),
    );

    render(<PesticideWorkbench />);

    const recordSelect = await screen.findByLabelText("Record");
    const sampleMassInput = screen.getByLabelText("Sample mass (g)");

    await waitFor(() => {
      expect(sampleMassInput).toHaveValue(10);
    });

    fireEvent.change(recordSelect, { target: { value: "lims_entry_2" } });

    expect(sampleMassInput).toHaveValue(null);
    expect(screen.getByText(/Sample mass: --/)).toBeInTheDocument();
  });

  it("does not copy the current LIMS sample mass into a new entry", async () => {
    const existingEntry = makeLimsReception({
      id: "lims_entry_1",
      orchardName: "Martin Orchard",
      harvestDate: "2026-03-29",
      indicativeMassG: 2041.1,
      measuredSampleMassG: 10.02,
      labSampleCode: "APP-0001-01",
      status: "awaiting_label_application",
    });

    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        limsReception: existingEntry,
        limsEntries: [existingEntry],
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        limsReception: makeLimsReception({
          id: "lims_entry_2",
          orchardName: "Second Orchard",
          harvestDate: "2026-03-30",
          indicativeMassG: 1998.4,
          measuredSampleMassG: null,
          labSampleCode: "APP-0001-02",
          status: "awaiting_label_application",
        }),
      }),
    );

    render(<PesticideWorkbench />);

    const recordSelect = await screen.findByLabelText("Record");
    fireEvent.change(recordSelect, { target: { value: "new" } });
    fireEvent.change(screen.getByLabelText("Orchard / producer"), {
      target: { value: "Second Orchard" },
    });
    fireEvent.change(screen.getByLabelText("Harvest date"), {
      target: { value: "2026-03-30" },
    });
    fireEvent.change(screen.getByLabelText("Declared mass from bag label (g)"), {
      target: { value: "1998.4" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create LIMS record" }));

    await waitFor(() => {
      expect(sendExperimentCommand).toHaveBeenCalledWith(
        "experiment_pesticides",
        "create_lims_reception",
        {
          orchard_name: "Second Orchard",
          harvest_date: "2026-03-30",
          indicative_mass_g: 1998.4,
          measured_gross_mass_g: null,
          measured_sample_mass_g: null,
        },
      );
    });
  });

  it("discards the received sampling bag from the basket into the trash", async () => {
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment({
      basketTools: [makeSampleBagTool({
        id: "basket_bag_1",
        fieldLabelText: "Martin Orchard • Harvest 2026-03-29 • Approx. 2.50 kg",
      })],
    }));
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        basketTools: [],
        trashTools: [
          makeSampleBagTool({
            id: "basket_bag_1",
            fieldLabelText: "Martin Orchard • Harvest 2026-03-29 • Approx. 2.50 kg",
          }),
        ],
      }),
    );

    render(<PesticideWorkbench />);

    fireEvent.click(await screen.findByTestId("basket-open-button"));
    const bag = await screen.findByTestId("basket-received-bag");
    const trash = screen.getByTestId("trash-dropzone");
    const transfer = createDataTransfer();

    fireEvent.dragStart(bag, { dataTransfer: transfer });
    const dragOverEvent = createEvent.dragOver(trash, { dataTransfer: transfer });
    fireEvent(trash, dragOverEvent);
    fireEvent.drop(trash, { dataTransfer: transfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    await waitFor(() => {
      expectToolMoveCommand("basket_bag_1", "basket", "basket_bag_1", "trash_bin", "trash_bin");
    });
  });

  it("keeps the basket create button visible even when the basket already contains a received bag", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        basketTools: [makeSampleBagTool({
          id: "basket_bag_1",
          isSealed: true,
          fieldLabelText: "Martin Orchard • Harvest 2026-03-29 • Approx. 2.50 kg",
        })],
      }),
    );

    render(<PesticideWorkbench />);

    fireEvent.click(await screen.findByTestId("basket-open-button"));
    expect(await screen.findByTestId("basket-create-apple-lot-button")).toBeInTheDocument();
    expect(screen.getByTestId("basket-received-bag")).toBeInTheDocument();
  });

  it("drops the ticket onto a bag when it is dragged out of the printer itself", async () => {
    // Same entity, same target, same command — only the hand's starting point differs.
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([
          {
            tool: makeSampleBagTool({
              id: "bench_tool_1",
              fieldLabelText: "Martin Orchard • Harvest 2026-03-29 • Approx. 2.50 kg",
            }),
          },
        ]),
        limsReception: makeLimsReception({
          measuredGrossMassG: 2486,
          labSampleCode: "APP-0001-01",
          status: "awaiting_label_application",
          printedLabelTicket: makePrintedLimsTicket(),
        }),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(makeWorkbenchExperiment());

    render(<PesticideWorkbench />);

    const printer = await screen.findByTestId("lims-printed-ticket-printer");
    const station = screen.getByTestId("bench-slot-station_1");
    const transfer = createDataTransfer();

    fireEvent.dragStart(printer, { dataTransfer: transfer });
    const dragOverEvent = createEvent.dragOver(station, { dataTransfer: transfer });
    fireEvent(station, dragOverEvent);
    fireEvent.drop(station, { dataTransfer: transfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(sendExperimentCommand).toHaveBeenCalledWith(
        "experiment_pesticides",
        "apply_printed_lims_label",
        { slot_id: "station_1" },
      );
    });
  });

  it("prints a LIMS ticket and drops it onto the received sampling bag", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([
          {
            tool: makeSampleBagTool({
              id: "bench_tool_1",
              fieldLabelText: "Martin Orchard • Harvest 2026-03-29 • Approx. 2.50 kg",
            }),
          },
        ]),
        limsReception: makeLimsReception({
          measuredGrossMassG: 2486,
          labSampleCode: "APP-0001-01",
          status: "awaiting_label_application",
          printedLabelTicket: makePrintedLimsTicket(),
        }),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([
          {
            tool: makeSampleBagTool({
              id: "bench_tool_1",
              fieldLabelText: "Martin Orchard • Harvest 2026-03-29 • Approx. 2.50 kg",
              labels: [makeSampleBagLabel({ text: "APP-0001-01" })],
            }),
          },
        ]),
        limsReception: makeLimsReception({
          measuredGrossMassG: 2486,
          labSampleCode: "APP-0001-01",
          status: "received",
          printedLabelTicket: null,
        }),
      }),
    );

    render(<PesticideWorkbench />);

    const ticket = await screen.findByTestId("lims-printed-ticket");
    const station = screen.getByTestId("bench-slot-station_1");
    const transfer = createDataTransfer();

    fireEvent.dragStart(ticket, { dataTransfer: transfer });
    const dragOverEvent = createEvent.dragOver(station, { dataTransfer: transfer });
    fireEvent(station, dragOverEvent);
    fireEvent.drop(station, { dataTransfer: transfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(sendExperimentCommand).toHaveBeenCalledWith(
        "experiment_pesticides",
        "apply_printed_lims_label",
        { slot_id: "station_1" },
      );
    });
  });

  it("applies a LIMS ticket onto a tube on the workbench", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([
          {
            tool: makeTool({
              id: "bench_tube_1",
              toolId: "centrifuge_tube_50ml",
              label: "50 mL centrifuge tube",
              subtitle: "Tube on bench",
              toolType: "centrifuge_tube",
              capacity_ml: 50,
            }),
          },
        ]),
        limsReception: makeLimsReception({
          measuredGrossMassG: 2486,
          labSampleCode: "APP-0001-01",
          status: "awaiting_label_application",
          printedLabelTicket: makePrintedLimsTicket(),
        }),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([
          {
            tool: makeTool({
              id: "bench_tube_1",
              toolId: "centrifuge_tube_50ml",
              label: "50 mL centrifuge tube",
              subtitle: "Tube on bench",
              toolType: "centrifuge_tube",
              capacity_ml: 50,
              labels: [
                makeSampleBagLabel({
                  id: "bench_tube_1-lims-label",
                  labelKind: "lims",
                  text: "APP-0001-01",
                  sampleCode: "APP-0001-01",
                  receivedDate: "2026-04-03",
                }),
              ],
            }),
          },
        ]),
        limsReception: makeLimsReception({
          measuredGrossMassG: 2486,
          labSampleCode: "APP-0001-01",
          status: "received",
          printedLabelTicket: null,
        }),
      }),
    );

    render(<PesticideWorkbench />);

    const ticket = await screen.findByTestId("lims-printed-ticket");
    const station = screen.getByTestId("bench-slot-station_1");
    const transfer = createDataTransfer();

    fireEvent.dragStart(ticket, { dataTransfer: transfer });
    const dragOverEvent = createEvent.dragOver(station, { dataTransfer: transfer });
    fireEvent(station, dragOverEvent);
    fireEvent.drop(station, { dataTransfer: transfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(sendExperimentCommand).toHaveBeenCalledWith(
        "experiment_pesticides",
        "apply_printed_lims_label",
        { slot_id: "station_1" },
      );
    });
  });

  it("applies a LIMS ticket onto a jar on the workbench", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([
          {
            tool: makeTool({
              id: "bench_jar_1",
              toolId: "storage_jar_250ml",
              label: "Storage jar",
              subtitle: "Jar on bench",
              toolType: "storage_jar",
              capacity_ml: 250,
            }),
          },
        ]),
        limsReception: makeLimsReception({
          measuredGrossMassG: 2486,
          labSampleCode: "APP-0001-01",
          status: "awaiting_label_application",
          printedLabelTicket: makePrintedLimsTicket(),
        }),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([
          {
            tool: makeTool({
              id: "bench_jar_1",
              toolId: "storage_jar_250ml",
              label: "Storage jar",
              subtitle: "Jar on bench",
              toolType: "storage_jar",
              capacity_ml: 250,
              labels: [
                makeSampleBagLabel({
                  id: "bench_jar_1-lims-label",
                  labelKind: "lims",
                  text: "APP-0001-01",
                  sampleCode: "APP-0001-01",
                  receivedDate: "2026-04-03",
                }),
              ],
            }),
          },
        ]),
        limsReception: makeLimsReception({
          measuredGrossMassG: 2486,
          labSampleCode: "APP-0001-01",
          status: "received",
          printedLabelTicket: null,
        }),
      }),
    );

    render(<PesticideWorkbench />);

    const ticket = await screen.findByTestId("lims-printed-ticket");
    const station = screen.getByTestId("bench-slot-station_1");
    const transfer = createDataTransfer();

    fireEvent.dragStart(ticket, { dataTransfer: transfer });
    const dragOverEvent = createEvent.dragOver(station, { dataTransfer: transfer });
    fireEvent(station, dragOverEvent);
    fireEvent.drop(station, { dataTransfer: transfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(sendExperimentCommand).toHaveBeenCalledWith(
        "experiment_pesticides",
        "apply_printed_lims_label",
        { slot_id: "station_1" },
      );
    });
  });

  it("applies a LIMS ticket onto a received sampling bag while it is staged on the gross balance", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([
          {
            tool: makeSampleBagTool({
              id: "bench_tool_1",
              fieldLabelText: "Martin Orchard • Harvest 2026-03-29 • Approx. 2.50 kg",
            }),
          },
        ]),
        limsReception: makeLimsReception({
          measuredGrossMassG: 2486,
          labSampleCode: "APP-0001-01",
          status: "awaiting_label_application",
          printedLabelTicket: makePrintedLimsTicket(),
        }),
        workspaceWidgets: makeWorkspaceWithGrossBalanceVisible(),
      }),
    );
    vi.mocked(sendExperimentCommand).mockImplementation(async (_experimentId, type) => {
      if (type === "move_object") {
        return makeWorkbenchExperiment({
          slots: makeSlots([
            {
              tool: makeSampleBagTool({
                id: "bench_tool_1",
                fieldLabelText: "Martin Orchard • Harvest 2026-03-29 • Approx. 2.50 kg",
              }),
            },
          ]),
          limsReception: makeLimsReception({
            measuredGrossMassG: 2486,
            labSampleCode: "APP-0001-01",
            status: "awaiting_label_application",
            printedLabelTicket: makePrintedLimsTicket(),
          }),
          workspaceWidgets: makeWorkspaceWithGrossBalanceVisible({
            tool: makeSampleBagTool({
              id: "bench_tool_1",
              fieldLabelText: "Martin Orchard • Harvest 2026-03-29 • Approx. 2.50 kg",
            }),
          }),
        });
      }

      return makeWorkbenchExperiment({
        slots: makeSlots([
          {
            tool: makeSampleBagTool({
              id: "bench_tool_1",
              fieldLabelText: "Martin Orchard • Harvest 2026-03-29 • Approx. 2.50 kg",
              labels: [makeSampleBagLabel({ text: "APP-0001-01" })],
            }),
          },
        ]),
        limsReception: makeLimsReception({
          measuredGrossMassG: 2486,
          labSampleCode: "APP-0001-01",
          status: "received",
          printedLabelTicket: null,
        }),
        workspaceWidgets: makeWorkspaceWithGrossBalanceVisible({
          tool: makeSampleBagTool({
            id: "bench_tool_1",
            fieldLabelText: "Martin Orchard • Harvest 2026-03-29 • Approx. 2.50 kg",
            labels: [makeSampleBagLabel({ text: "APP-0001-01" })],
          }),
        }),
      });
    });

    render(<PesticideWorkbench />);

    const bag = await screen.findByTestId("bench-tool-card-bench_tool_1");
    const balance = screen.getByTestId("gross-balance-dropzone");
    const bagTransfer = createDataTransfer();

    fireEvent.dragStart(bag, { dataTransfer: bagTransfer });
    fireEvent.dragOver(balance, { dataTransfer: bagTransfer });
    fireEvent.drop(balance, { dataTransfer: bagTransfer });

    const ticket = await screen.findByTestId("lims-printed-ticket");
    const stagedBag = screen.getByTestId("gross-balance-staged-item");
    const ticketTransfer = createDataTransfer();

    fireEvent.dragStart(ticket, { dataTransfer: ticketTransfer });
    const dragOverEvent = createEvent.dragOver(stagedBag, { dataTransfer: ticketTransfer });
    fireEvent(stagedBag, dragOverEvent);
    fireEvent.drop(stagedBag, { dataTransfer: ticketTransfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(sendExperimentCommand).toHaveBeenCalledWith(
        "experiment_pesticides",
        "apply_printed_lims_label_to_gross_balance_bag",
        {},
      );
    });
  });

  it("applies a LIMS ticket onto a basket bag while it is staged on the gross balance", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        basketTools: [makeSampleBagTool({
          id: "basket_bag_1",
          fieldLabelText: "Martin Orchard • Harvest 2026-03-29 • Approx. 2.50 kg",
        })],
        limsReception: makeLimsReception({
          measuredGrossMassG: 2486,
          labSampleCode: "APP-0001-01",
          status: "awaiting_label_application",
          printedLabelTicket: makePrintedLimsTicket(),
        }),
        workspaceWidgets: makeWorkspaceWithGrossBalanceVisible(),
      }),
    );
    vi.mocked(sendExperimentCommand).mockImplementation(async (_experimentId, type) => {
      if (type === "move_object") {
        return makeWorkbenchExperiment({
          basketTools: [],
          limsReception: makeLimsReception({
            measuredGrossMassG: 2486,
            labSampleCode: "APP-0001-01",
            status: "awaiting_label_application",
            printedLabelTicket: makePrintedLimsTicket(),
          }),
          workspaceWidgets: makeWorkspaceWithGrossBalanceVisible({
            tool: makeSampleBagTool({
              id: "basket_bag_1",
              fieldLabelText: "Martin Orchard • Harvest 2026-03-29 • Approx. 2.50 kg",
            }),
          }),
        });
      }

      return makeWorkbenchExperiment({
        basketTools: [makeSampleBagTool({
          id: "basket_bag_1",
          fieldLabelText: "Martin Orchard • Harvest 2026-03-29 • Approx. 2.50 kg",
          labels: [makeSampleBagLabel({ text: "APP-0001-01" })],
        })],
        limsReception: makeLimsReception({
          measuredGrossMassG: 2486,
          labSampleCode: "APP-0001-01",
          status: "received",
          printedLabelTicket: null,
        }),
        workspaceWidgets: makeWorkspaceWithGrossBalanceVisible({
          tool: makeSampleBagTool({
            id: "basket_bag_1",
            fieldLabelText: "Martin Orchard • Harvest 2026-03-29 • Approx. 2.50 kg",
            labels: [makeSampleBagLabel({ text: "APP-0001-01" })],
          }),
        }),
      });
    });

    render(<PesticideWorkbench />);

    fireEvent.click(await screen.findByTestId("basket-open-button"));

    const bag = await screen.findByTestId("basket-received-bag");
    const balance = screen.getByTestId("gross-balance-dropzone");
    const bagTransfer = createDataTransfer();

    fireEvent.dragStart(bag, { dataTransfer: bagTransfer });
    fireEvent.dragOver(balance, { dataTransfer: bagTransfer });
    fireEvent.drop(balance, { dataTransfer: bagTransfer });

    const ticket = await screen.findByTestId("lims-printed-ticket");
    const stagedBag = screen.getByTestId("gross-balance-staged-item");
    const ticketTransfer = createDataTransfer();

    fireEvent.dragStart(ticket, { dataTransfer: ticketTransfer });
    const dragOverEvent = createEvent.dragOver(stagedBag, { dataTransfer: ticketTransfer });
    fireEvent(stagedBag, dragOverEvent);
    fireEvent.drop(stagedBag, { dataTransfer: ticketTransfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(sendExperimentCommand).toHaveBeenCalledWith(
        "experiment_pesticides",
        "apply_printed_lims_label_to_gross_balance_bag",
        {},
      );
    });
  });

  it("allows dragging produce out of an open sampling bag while it is on the gross balance", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithGrossBalanceVisible({
          tool: makeSampleBagTool({
            id: "balance_bag_1",
            isSealed: false,
            produceLots: [
              makeProduceLot({ id: "produce_1" }),
            ],
          }),
        }),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([
          {
            tool: makeSampleBagTool({
              id: "bench_tool_1",
              produceLots: [
                makeProduceLot({ id: "produce_1" }),
              ],
            }),
          },
        ]),
        workspaceWidgets: makeWorkspaceWithGrossBalanceVisible({
          tool: makeSampleBagTool({
            id: "balance_bag_1",
            isSealed: false,
            produceLots: [],
          }),
        }),
      }),
    );

    render(<PesticideWorkbench />);

    const produceCard = await screen.findByTestId("bench-produce-lot-produce_1");
    const station = screen.getByTestId("bench-slot-station_1");
    const transfer = createDataTransfer();

    fireEvent.dragStart(produceCard, { dataTransfer: transfer });
    const dragOverEvent = createEvent.dragOver(station, { dataTransfer: transfer });
    fireEvent(station, dragOverEvent);
    fireEvent.drop(station, { dataTransfer: transfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(sendExperimentCommand).toHaveBeenCalledWith(
        "experiment_pesticides",
        "move_object",
        {
          destination: { kind: "workbench_tool", id: "station_1" },
          entity: { kind: "produce_lot", id: "produce_1" },
          source: { kind: "gross_balance", id: "gross_balance" },
        },
      );
    });
  });

  it("allows dragging loose produce from the gross balance surface onto the workbench", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithGrossBalanceVisible({
          produceLots: [
            makeProduceLot({ id: "produce_1", label: "Apple powder 1", totalMassG: 10, unitCount: null, materialState: "ground" }),
          ],
        }),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([
          {
            surfaceProduceLots: [
              makeProduceLot({ id: "produce_1", label: "Apple powder 1", totalMassG: 10, unitCount: null, materialState: "ground" }),
            ],
          },
        ]),
        workspaceWidgets: makeWorkspaceWithGrossBalanceVisible({
          produceLots: [],
        }),
      }),
    );

    render(<PesticideWorkbench />);

    const produceCard = await screen.findByTestId("gross-balance-produce-produce_1");
    const station = screen.getByTestId("bench-slot-station_1");
    const transfer = createDataTransfer();

    fireEvent.dragStart(produceCard, { dataTransfer: transfer });
    const dragOverEvent = createEvent.dragOver(station, { dataTransfer: transfer });
    fireEvent(station, dragOverEvent);
    fireEvent.drop(station, { dataTransfer: transfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(sendExperimentCommand).toHaveBeenCalledWith(
        "experiment_pesticides",
        "move_object",
        {
          destination: { kind: "workbench_tool", id: "station_1" },
          entity: { kind: "produce_lot", id: "produce_1" },
          source: { kind: "gross_balance", id: "gross_balance" },
        },
      );
    });
  });

  it("allows discarding loose produce from the gross balance surface into the trash", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithGrossBalanceVisible({
          produceLots: [
            makeProduceLot({ id: "produce_1", label: "Apple powder 1", totalMassG: 10, unitCount: null, materialState: "ground" }),
          ],
        }),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        trashProduceLots: [
          {
            id: "trash_produce_1",
            originLabel: "Gross balance",
            produceLot: makeProduceLot({ id: "produce_1", label: "Apple powder 1", totalMassG: 10, unitCount: null, materialState: "ground" }),
          },
        ],
        workspaceWidgets: makeWorkspaceWithGrossBalanceVisible({
          produceLots: [],
        }),
      }),
    );

    render(<PesticideWorkbench />);

    const produceCard = await screen.findByTestId("gross-balance-produce-produce_1");
    const trash = screen.getByTestId("trash-dropzone");
    const transfer = createDataTransfer();

    fireEvent.dragStart(produceCard, { dataTransfer: transfer });
    const dragOverEvent = createEvent.dragOver(trash, { dataTransfer: transfer });
    fireEvent(trash, dragOverEvent);
    fireEvent.drop(trash, { dataTransfer: transfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(sendExperimentCommand).toHaveBeenCalledWith(
        "experiment_pesticides",
        "move_object",
        {
          destination: { kind: "trash_bin", id: "trash_bin" },
          entity: { kind: "produce_lot", id: "produce_1" },
          source: { kind: "gross_balance", id: "gross_balance" },
        },
      );
    });
  });

  it("discards a printed LIMS ticket directly into the trash", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        limsReception: makeLimsReception({
          measuredGrossMassG: 2486,
          labSampleCode: "APP-0001-01",
          status: "awaiting_label_application",
          printedLabelTicket: makePrintedLimsTicket(),
        }),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        limsReception: makeLimsReception({
          measuredGrossMassG: 2486,
          labSampleCode: "APP-0001-01",
          status: "awaiting_label_application",
          printedLabelTicket: null,
        }),
        trashSampleLabels: [
          {
            id: "trash_sample_label_1",
            originLabel: "LIMS terminal",
            labels: [makeSampleBagLabel({ text: "APP-0001-01" })],
          },
        ],
      }),
    );

    render(<PesticideWorkbench />);

    const ticket = await screen.findByTestId("lims-printed-ticket");
    const trash = screen.getByTestId("trash-dropzone");
    const transfer = createDataTransfer();

    fireEvent.dragStart(ticket, { dataTransfer: transfer });
    const dragOverEvent = createEvent.dragOver(trash, { dataTransfer: transfer });
    fireEvent(trash, dragOverEvent);
    fireEvent.drop(trash, { dataTransfer: transfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(sendExperimentCommand).toHaveBeenCalledWith(
        "experiment_pesticides",
        "discard_printed_lims_label",
        {},
      );
    });

    fireEvent.click(trash);
    expect(await screen.findByTestId("trash-sample-label-trash_sample_label_1")).toBeInTheDocument();
  });


  it("shows a small printer ticket indicator when a LIMS ticket is present", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        limsReception: makeLimsReception({
          measuredGrossMassG: 2486,
          labSampleCode: "APP-0001-01",
          status: "awaiting_label_application",
          printedLabelTicket: makePrintedLimsTicket(),
        }),
      }),
    );

    render(<PesticideWorkbench />);

    expect(await screen.findByTestId("lims-printer-ticket")).toBeInTheDocument();
  });

  it("updates the sampling label text on blur", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([{ tool: makeSampleBagTool({ labels: [makeSampleBagLabel({ text: "" })] }) }]),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([{ tool: makeSampleBagTool({ labels: [makeSampleBagLabel({ text: "LOT-2026-041" })] }) }]),
      }),
    );

    render(<PesticideWorkbench />);

    const input = await screen.findByLabelText("Sample label text");
    fireEvent.change(input, { target: { value: "LOT-2026-041" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(sendExperimentCommand).toHaveBeenCalledWith(
        "experiment_pesticides",
        "update_workbench_tool_sample_label_text",
        { label_id: "bench_tool_1-sample-label", slot_id: "station_1", sample_label_text: "LOT-2026-041" },
      );
    });
  });

  it("discards a sampling bag label from the bench into the trash", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([{ tool: makeSampleBagTool({ labels: [makeSampleBagLabel({ text: "LOT-2026-041" })] }) }]),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([{ tool: makeSampleBagTool() }]),
        trashSampleLabels: [makeTrashSampleLabelEntry()],
      }),
    );

    render(<PesticideWorkbench />);

    const sampleLabel = await screen.findByTestId("sample-label-card-bench_tool_1");
    const trash = screen.getByTestId("trash-dropzone");
    const transfer = createDataTransfer();

    fireEvent.dragStart(sampleLabel, { dataTransfer: transfer });
    const dragOverEvent = createEvent.dragOver(trash, { dataTransfer: transfer });
    fireEvent(trash, dragOverEvent);
    fireEvent.drop(trash, { dataTransfer: transfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);

    await waitFor(() => {
      expect(sendExperimentCommand).toHaveBeenCalledWith(
        "experiment_pesticides",
        "move_object",
        {
          destination: { kind: "trash_bin", id: "trash_bin" },
          entity: { kind: "sample_label", id: "bench_tool_1-sample-label" },
          source: { kind: "workbench", id: "station_1" },
        },
      );
    });
  });

  it("restores a trashed sampling bag label onto an unlabeled sampling bag", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([{ tool: makeSampleBagTool() }]),
        trashSampleLabels: [makeTrashSampleLabelEntry()],
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([{ tool: makeSampleBagTool({ labels: [makeSampleBagLabel({ text: "LOT-2026-041" })] }) }]),
        trashSampleLabels: [],
      }),
    );

    render(<PesticideWorkbench />);

    fireEvent.click(await screen.findByTestId("trash-dropzone"));
    const trashedLabel = await screen.findByTestId("trash-sample-label-trash_sample_label_1");
    const station = screen.getByTestId("bench-slot-station_1");
    const transfer = createDataTransfer();

    fireEvent.dragStart(trashedLabel, { dataTransfer: transfer });
    const dragOverEvent = createEvent.dragOver(station, { dataTransfer: transfer });
    fireEvent(station, dragOverEvent);
    fireEvent.drop(station, { dataTransfer: transfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);

    await waitFor(() => {
      expect(sendExperimentCommand).toHaveBeenCalledWith(
        "experiment_pesticides",
        "move_object",
        {
          destination: { kind: "workbench_tool", id: "station_1" },
          entity: { kind: "sample_label", id: "trash_sample_label_1" },
          source: { kind: "trash", id: "trash_sample_label_1" },
        },
      );
    });
  });

  it("discards a produce lot directly from the basket into the trash", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        basketProduceLots: [
          makeProduceLot({ id: "produce_1" }),
        ],
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        basketProduceLots: [],
        trashProduceLots: [makeTrashProduceLotEntry()],
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("basket-open-button")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("basket-open-button"));
    const basketProduce = await screen.findByTestId("basket-produce-produce_1");
    const transfer = createDataTransfer();

    fireEvent.dragStart(basketProduce, { dataTransfer: transfer });
    fireEvent.dragOver(screen.getByTestId("trash-dropzone"), { dataTransfer: transfer });
    fireEvent.drop(screen.getByTestId("trash-dropzone"), { dataTransfer: transfer });

    await waitFor(() => {
      expect(screen.getByTestId("basket-count-badge")).toHaveTextContent("0");
    });

    fireEvent.click(screen.getByTestId("trash-dropzone"));
    const dialog = within(screen.getByTestId("trash-dialog-overlay")).getByRole("dialog");
    expect(within(dialog).getByTestId("trash-produce-lot-trash_produce_lot_1")).toBeInTheDocument();
    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "move_object",
      {
        destination: { kind: "trash_bin", id: "trash_bin" },
        entity: { kind: "produce_lot", id: "produce_1" },
        source: { kind: "basket", id: "produce_basket" },
      },
    );
  });

  it("moves a produce lot from one sealed sampling bag to another", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([
          {
            tool: makeSampleBagTool({
              produceLots: [
                makeProduceLot({ id: "produce_1" }),
              ],
            }),
          },
          { tool: makeSampleBagTool({ id: "bench_tool_2" }) },
        ]),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([
          { tool: makeSampleBagTool() },
          {
            tool: makeSampleBagTool({
              id: "bench_tool_2",
              produceLots: [
                makeProduceLot({ id: "produce_1" }),
              ],
            }),
          },
        ]),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("bench-produce-lot-produce_1")).toBeInTheDocument();
    });

    const transfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("bench-produce-lot-produce_1"), {
      dataTransfer: transfer,
    });
    fireEvent.dragOver(screen.getByTestId("bench-slot-station_2"), { dataTransfer: transfer });
    fireEvent.drop(screen.getByTestId("bench-slot-station_2"), { dataTransfer: transfer });

    await waitFor(() => {
      expect(
        within(screen.getByTestId("bench-slot-station_2")).getByText("Apple lot 1"),
      ).toBeInTheDocument();
    });

    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "move_object",
      {
        destination: { kind: "workbench_tool", id: "station_2" },
        entity: { kind: "produce_lot", id: "produce_1" },
        source: { kind: "workbench", id: "station_1" },
      },
    );
  });

  it("does not allow dragging a produce lot out of a closed sample bag", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([
          {
            tool: makeSampleBagTool({
              isSealed: true,
              produceLots: [
                makeProduceLot({ id: "produce_1" }),
              ],
            }),
          },
          { tool: makeSampleBagTool({ id: "bench_tool_2" }) },
        ]),
      }),
    );

    render(<PesticideWorkbench />);

    const produceLotCard = await screen.findByTestId("bench-produce-lot-produce_1");
    expect(produceLotCard).not.toHaveAttribute("draggable", "true");

    const transfer = createDataTransfer();
    fireEvent.dragStart(produceLotCard, { dataTransfer: transfer });

    expect(screen.getByTestId("bench-slot-station_1")).toHaveAttribute("data-drop-highlighted", "false");
    expect(screen.getByTestId("bench-slot-station_2")).toHaveAttribute("data-drop-highlighted", "false");
    expect(sendExperimentCommand).not.toHaveBeenCalled();
  });

  it("shows declared contents without liquid removal in a closed container", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([
          {
            tool: makeTool({
              isSealed: true,
              liquids: [
                {
                  id: "bench_liquid_1",
                  liquidId: "acetonitrile_extraction",
                  name: "Acetonitrile",
                  volume_ml: 2,
                  accent: "amber",
                },
              ],
            }),
          },
        ]),
      }),
    );

    render(<PesticideWorkbench />);

    const declaredContents = await screen.findByRole("region", { name: "Declared contents" });
    expect(within(declaredContents).getByText("Acetonitrile")).toBeInTheDocument();
    expect(within(declaredContents).getByText("2.00 mL")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove Acetonitrile" })).not.toBeInTheDocument();
    expect(sendExperimentCommand).not.toHaveBeenCalled();
  });

  it("discards a produce lot from a sealed sampling bag when dropped into the trash", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([
          {
            tool: makeSampleBagTool({
              produceLots: [
                makeProduceLot({ id: "produce_1" }),
              ],
            }),
          },
        ]),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        auditLog: ["Apple lot 1 discarded from Sealed sampling bag."],
        trashProduceLots: [
          {
            id: "trash_produce_lot_1",
            originLabel: "Sealed sampling bag",
            produceLot: makeProduceLot({ id: "produce_1" }),
          },
        ],
        slots: makeSlots([{ tool: makeSampleBagTool() }]),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("bench-produce-lot-produce_1")).toBeInTheDocument();
    });

    const transfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("bench-produce-lot-produce_1"), {
      dataTransfer: transfer,
    });
    fireEvent.dragOver(screen.getByTestId("trash-dropzone"), { dataTransfer: transfer });
    fireEvent.drop(screen.getByTestId("trash-dropzone"), { dataTransfer: transfer });

    await waitFor(() => {
      expect(screen.queryByTestId("bench-produce-lot-produce_1")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("trash-dropzone"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByTestId("trash-produce-lot-trash_produce_lot_1")).toBeInTheDocument();
    expect(within(dialog).getByText("Apple lot 1")).toBeInTheDocument();

    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "move_object",
      {
        destination: { kind: "trash_bin", id: "trash_bin" },
        entity: { kind: "produce_lot", id: "produce_1" },
        source: { kind: "workbench", id: "station_1" },
      },
    );
  });

  it("restores a trashed produce lot into a sealed sampling bag", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        trashProduceLots: [makeTrashProduceLotEntry()],
        slots: makeSlots([{ tool: makeSampleBagTool() }]),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        trashProduceLots: [],
        slots: makeSlots([
          {
            tool: makeSampleBagTool({
              produceLots: [
                makeProduceLot({ id: "produce_1" }),
              ],
            }),
          },
        ]),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("trash-dropzone")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("trash-dropzone"));
    const trashedProduceLot = await screen.findByTestId("trash-produce-lot-trash_produce_lot_1");
    const transfer = createDataTransfer();

    fireEvent.dragStart(trashedProduceLot, { dataTransfer: transfer });
    fireEvent.dragOver(screen.getByTestId("bench-slot-station_1"), { dataTransfer: transfer });
    fireEvent.drop(screen.getByTestId("bench-slot-station_1"), { dataTransfer: transfer });

    await waitFor(() => {
      expect(
        within(screen.getByTestId("bench-slot-station_1")).getByText("Apple lot 1"),
      ).toBeInTheDocument();
    });

    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "move_object",
      {
        destination: { kind: "workbench_tool", id: "station_1" },
        entity: { kind: "produce_lot", id: "produce_1" },
        source: { kind: "trash", id: "trash_produce_lot_1" },
      },
    );
  });

  it("discards a palette tool directly into the trash", async () => {
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment());
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        trashTools: [
          makeSampleBagTool({ id: "bench_tool_bag" }),
        ],
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("toolbar-item-sealed_sampling_bag")).toBeInTheDocument();
    });

    const transfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("toolbar-item-sealed_sampling_bag"), {
      dataTransfer: transfer,
    });
    fireEvent.dragOver(screen.getByTestId("trash-dropzone"), { dataTransfer: transfer });
    fireEvent.drop(screen.getByTestId("trash-dropzone"), { dataTransfer: transfer });

    fireEvent.click(screen.getByTestId("trash-dropzone"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByTestId("trash-tool-bench_tool_bag")).toBeInTheDocument();
    expectToolMoveCommand("sealed_sampling_bag", "palette", "sealed_sampling_bag", "trash_bin", "trash_bin");
  });

  it("restores a trashed tool to a workbench station from the trash view", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        trashTools: [makeTrashToolEntry()],
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([{ tool: makeTool() }]),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("trash-dropzone")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("trash-dropzone"));

    const trashTool = await screen.findByTestId("trash-tool-bench_tool_1");
    const transfer = createDataTransfer();

    fireEvent.dragStart(trashTool, { dataTransfer: transfer });
    fireEvent.dragOver(screen.getByTestId("bench-slot-station_1"), { dataTransfer: transfer });
    fireEvent.drop(screen.getByTestId("bench-slot-station_1"), { dataTransfer: transfer });

    await waitFor(() => {
      expect(
        within(screen.getByTestId("bench-slot-station_1")).getByText("Autosampler vial"),
      ).toBeInTheDocument();
    });

    expectToolMoveCommand("bench_tool_1", "trash", "bench_tool_1", "workbench_slot", "station_1");
  });

  it("restores a deleted workspace widget from the trash view into the workspace", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWidgets([
          {},
          {},
          {},
          {},
          { isPresent: false, isTrashed: true },
          {},
          {},
          {},
        ]),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithRackVisible({
          anchor: "top-left",
          offsetX: 379,
          offsetY: 388,
        }),
      }),
    );

    render(<PesticideWorkbench />);

    const workspace = await screen.findByTestId("widget-workspace");
    fireEvent.click(screen.getByTestId("trash-dropzone"));

    const trashedWidget = await screen.findByTestId("trash-widget-rack");
    const transfer = createDataTransfer();

    fireEvent.dragStart(trashedWidget, { dataTransfer: transfer });
    fireEvent.dragOver(workspace, { dataTransfer: transfer });
    fireEvent.drop(workspace, { clientX: 480, clientY: 420, dataTransfer: transfer });

    await waitFor(() => {
      expect(screen.getByTestId("widget-rack")).toBeInTheDocument();
    });

    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "add_workspace_widget",
      expect.objectContaining({ widget_id: "rack" }),
    );
  });

  it("does not store the produce basket when dragged onto the inventory", async () => {
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment());

    render(<PesticideWorkbench />);

    const basket = await screen.findByTestId("widget-basket");
    mockInventoryDropzoneBounds(screen.getByTestId("inventory-dropzone"));

    fireEvent.mouseDown(within(basket).getByText("Produce basket"), {
      button: 0,
      clientX: 1480,
      clientY: 280,
    });
    window.dispatchEvent(new MouseEvent("mouseup", { clientX: 100, clientY: 220 }));

    expect(screen.getByTestId("widget-basket")).toBeInTheDocument();
    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "move_workspace_widget",
      expect.objectContaining({ widget_id: "basket" }),
    );
    expect(sendExperimentCommand).not.toHaveBeenCalledWith(
      "experiment_pesticides",
      "store_workspace_widget",
      { widget_id: "basket" },
    );
  });

  it("moves any bench tool from one station to another through the generic drop system", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([
          {
            tool: makeTool({
              toolId: "centrifuge_tube_50ml",
              label: "50 mL centrifuge tube",
              subtitle: "QuEChERS extraction",
              toolType: "centrifuge_tube",
              capacity_ml: 50,
            }),
          },
        ]),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        auditLog: ["50 mL centrifuge tube moved from Station 1 to Station 2."],
        slots: makeSlots([
          { tool: null },
          {
            tool: makeTool({
              toolId: "centrifuge_tube_50ml",
              label: "50 mL centrifuge tube",
              subtitle: "QuEChERS extraction",
              toolType: "centrifuge_tube",
              capacity_ml: 50,
            }),
          },
        ]),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(
        within(screen.getByTestId("bench-slot-station_1")).getByText("50 mL centrifuge tube"),
      ).toBeInTheDocument();
    });

    const toolTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("bench-tool-card-bench_tool_1"), {
      dataTransfer: toolTransfer,
    });
    fireEvent.dragOver(screen.getByTestId("bench-slot-station_2"), { dataTransfer: toolTransfer });
    fireEvent.drop(screen.getByTestId("bench-slot-station_2"), { dataTransfer: toolTransfer });

    await waitFor(() => {
      expect(
        within(screen.getByTestId("bench-slot-station_2")).getByText("50 mL centrifuge tube"),
      ).toBeInTheDocument();
    });

    expectToolMoveCommand("bench_tool_1", "workbench", "station_1", "workbench_slot", "station_2");
  });

  it("moves an autosampler vial from a station into the rack", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithRackVisible({
          anchor: "top-left",
          offsetX: 379,
          offsetY: 388,
        }),
        slots: makeSlots([
          {
            tool: makeTool({
              liquids: [
                {
                  id: "bench_liquid_1",
                  liquidId: "acetonitrile_extraction",
                  name: "Acetonitrile",
                  volume_ml: 1.2,
                  accent: "amber",
                },
              ],
            }),
          },
        ]),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        auditLog: ["Autosampler vial moved from Station 1 to Position 1."],
        workspaceWidgets: makeWorkspaceWithRackVisible({
          anchor: "top-left",
          offsetX: 379,
          offsetY: 388,
        }),
        rackSlots: makeRackSlots([{ tool: makeTool({
          liquids: [
            {
              id: "bench_liquid_1",
              liquidId: "acetonitrile_extraction",
              name: "Acetonitrile",
              volume_ml: 1.2,
              accent: "amber",
            },
          ],
        }) }]),
        slots: makeSlots([{ tool: null }]),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("bench-tool-card-bench_tool_1")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByTestId("widget-rack")).toBeInTheDocument();
    });

    const vialTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("bench-tool-card-bench_tool_1"), {
      dataTransfer: vialTransfer,
    });
    fireEvent.dragOver(screen.getByTestId("rack-illustration-slot-1"), { dataTransfer: vialTransfer });
    fireEvent.drop(screen.getByTestId("rack-illustration-slot-1"), { dataTransfer: vialTransfer });

    await waitFor(() => {
      expect(within(screen.getByTestId("rack-slot-summary-1")).getByText("Autosampler vial")).toBeInTheDocument();
    });

    expect(screen.getByTestId("autosampler-rack-illustration")).toHaveAttribute(
      "data-occupied-count",
      "1",
    );
    expect(screen.getByTestId("autosampler-rack-illustration-slot-liquid-1")).toHaveAttribute(
      "fill",
      "#f59e0b",
    );
    expect(within(screen.getByTestId("bench-slot-station_1")).getByText("Empty station")).toBeInTheDocument();
    expectToolMoveCommand("bench_tool_1", "workbench", "station_1", "rack_slot", "rack_slot_1");
  });

  it("moves an autosampler vial from the palette directly into the rack", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithRackVisible({
          anchor: "top-left",
          offsetX: 379,
          offsetY: 388,
        }),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        auditLog: ["Autosampler vial placed in Position 1."],
        workspaceWidgets: makeWorkspaceWithRackVisible({
          anchor: "top-left",
          offsetX: 379,
          offsetY: 388,
        }),
        rackSlots: makeRackSlots([{ tool: makeTool() }]),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("widget-rack")).toBeInTheDocument();
    });

    const vialTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("toolbar-item-sample_vial_lcms"), {
      dataTransfer: vialTransfer,
    });

    expect(screen.getByTestId("rack-illustration-slot-1")).toHaveAttribute(
      "data-drop-highlighted",
      "true",
    );

    fireEvent.dragOver(screen.getByTestId("rack-illustration-slot-1"), { dataTransfer: vialTransfer });
    fireEvent.drop(screen.getByTestId("rack-illustration-slot-1"), { dataTransfer: vialTransfer });

    await waitFor(() => {
      expect(within(screen.getByTestId("rack-slot-summary-1")).getByText("Autosampler vial")).toBeInTheDocument();
    });

    expectToolMoveCommand("sample_vial_lcms", "palette", "sample_vial_lcms", "rack_slot", "rack_slot_1");
  });

  it("returns a vial from the rack to a station through the backend rack model", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        rackSlots: makeRackSlots([{ tool: makeTool() }]),
        slots: makeSlots(),
        workspaceWidgets: makeWorkspaceWithRackVisible(),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        auditLog: ["Autosampler vial moved from Position 1 to Station 1."],
        rackSlots: makeRackSlots(),
        slots: makeSlots([{ tool: makeTool() }]),
        workspaceWidgets: makeWorkspaceWithRackVisible(),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("rack-slot-tool-1")).toBeInTheDocument();
    });

    const rackToBenchTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("rack-illustration-slot-1"), {
      dataTransfer: rackToBenchTransfer,
    });
    fireEvent.dragOver(screen.getByTestId("bench-slot-station_1"), { dataTransfer: rackToBenchTransfer });
    fireEvent.drop(screen.getByTestId("bench-slot-station_1"), { dataTransfer: rackToBenchTransfer });

    await waitFor(() => {
      expect(
        within(screen.getByTestId("bench-slot-station_1")).getByText("Autosampler vial"),
      ).toBeInTheDocument();
    });

    expect(screen.queryByTestId("rack-slot-summary-1")).not.toBeInTheDocument();
    expect(within(screen.getByTestId("rack-summary")).getByText("No vial staged yet.")).toBeInTheDocument();
    expectToolMoveCommand("bench_tool_1", "rack", "rack_slot_1", "workbench_slot", "station_1");
  });

  it("caps a vial from its rack slot card without unracking it", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        rackSlots: makeRackSlots([{ tool: makeTool({ isSealed: false }) }]),
        slots: makeSlots(),
        workspaceWidgets: makeWorkspaceWithRackVisible(),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        rackSlots: makeRackSlots([{ tool: makeTool({ isSealed: true }) }]),
        slots: makeSlots(),
        workspaceWidgets: makeWorkspaceWithRackVisible(),
      }),
    );

    render(<PesticideWorkbench />);

    fireEvent.click(await screen.findByRole("button", { name: "Close Autosampler vial" }));

    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "close_rack_tool",
      { rack_slot_id: "rack_slot_1" },
    );

    expect(await screen.findByRole("button", { name: "Open Autosampler vial" })).toBeInTheDocument();
  });

  it("moves a vial from the rack to another station through the generic drop system", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        rackSlots: makeRackSlots([{ tool: makeTool() }]),
        slots: makeSlots(),
        workspaceWidgets: makeWorkspaceWithRackVisible(),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        auditLog: ["Autosampler vial moved from Position 1 to Station 2."],
        rackSlots: makeRackSlots(),
        slots: makeSlots([
          { tool: null },
          { tool: makeTool() },
        ]),
        workspaceWidgets: makeWorkspaceWithRackVisible(),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("rack-slot-tool-1")).toBeInTheDocument();
    });

    const rackToBenchTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("rack-slot-tool-1"), {
      dataTransfer: rackToBenchTransfer,
    });
    fireEvent.dragOver(screen.getByTestId("bench-slot-station_2"), { dataTransfer: rackToBenchTransfer });
    fireEvent.drop(screen.getByTestId("bench-slot-station_2"), { dataTransfer: rackToBenchTransfer });

    await waitFor(() => {
      expect(
        within(screen.getByTestId("bench-slot-station_2")).getByText("Autosampler vial"),
      ).toBeInTheDocument();
    });

    expect(screen.queryByTestId("rack-slot-summary-1")).not.toBeInTheDocument();
    expect(within(screen.getByTestId("rack-summary")).getByText("No vial staged yet.")).toBeInTheDocument();
    expectToolMoveCommand("bench_tool_1", "rack", "rack_slot_1", "workbench_slot", "station_2");
  });

  it("moves a vial from one rack slot to another", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        rackSlots: makeRackSlots([{ tool: makeTool() }]),
        workspaceWidgets: makeWorkspaceWithRackVisible(),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        auditLog: ["Autosampler vial moved from Position 1 to Position 2."],
        rackSlots: makeRackSlots([{ tool: null }, { tool: makeTool() }]),
        workspaceWidgets: makeWorkspaceWithRackVisible(),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("rack-slot-tool-1")).toBeInTheDocument();
    });

    const rackTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("rack-slot-summary-1"), {
      dataTransfer: rackTransfer,
    });
    fireEvent.dragOver(screen.getByTestId("rack-illustration-slot-2"), { dataTransfer: rackTransfer });
    fireEvent.drop(screen.getByTestId("rack-illustration-slot-2"), { dataTransfer: rackTransfer });

    await waitFor(() => {
      expect(within(screen.getByTestId("rack-slot-summary-2")).getByText("Autosampler vial")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("rack-slot-summary-1")).not.toBeInTheDocument();
    expectToolMoveCommand("bench_tool_1", "rack", "rack_slot_1", "rack_slot", "rack_slot_2");
  });

  it("places a tool and then adds a liquid through backend commands", async () => {
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment());
    vi.mocked(sendExperimentCommand)
      .mockResolvedValueOnce(
        makeWorkbenchExperiment({
          auditLog: ["Autosampler vial placed on Station 1."],
          slots: makeSlots([{ tool: makeTool() }]),
        }),
      )
      .mockResolvedValueOnce(
        makeWorkbenchExperiment({
          auditLog: ["Acetonitrile added to Autosampler vial at 2 mL (remaining capacity)."],
          slots: makeSlots([
            {
              tool: makeTool({
                liquids: [
                  {
                    id: "bench_liquid_1",
                    liquidId: "acetonitrile_extraction",
                    name: "Acetonitrile",
                    volume_ml: 2,
                    accent: "amber",
                  },
                ],
              }),
            },
          ]),
        }),
      );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getAllByText("Empty station")).toHaveLength(2);
    });

    const toolTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("toolbar-item-sample_vial_lcms"), {
      dataTransfer: toolTransfer,
    });
    fireEvent.drop(screen.getByTestId("bench-slot-station_1"), { dataTransfer: toolTransfer });

    await waitFor(() => {
      expect(screen.getByText("Autosampler vial placed on Station 1.")).toBeInTheDocument();
    });

    expect(
      screen
        .getByTestId("bench-slot-station_1")
        .querySelector("[data-kind='sample_vial']"),
    ).toHaveAttribute("data-tone", "neutral");

    const liquidTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("toolbar-item-acetonitrile_extraction"), {
      dataTransfer: liquidTransfer,
    });
    fireEvent.drop(screen.getByTestId("bench-slot-station_1"), { dataTransfer: liquidTransfer });
    expect(sendExperimentCommand).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Dose Acetonitrile")).toBeInTheDocument();
    expect(screen.getByLabelText("Acetonitrile draft volume")).toHaveValue(10);

    fireEvent.click(screen.getByText("Add"));

    await waitFor(() => {
      expect(
        screen.getByText("Acetonitrile added to Autosampler vial at 2 mL (remaining capacity)."),
      ).toBeInTheDocument();
    });

    expect(
      screen
        .getByTestId("bench-slot-station_1")
        .querySelector("[data-kind='sample_vial']"),
    ).toHaveAttribute("data-tone", "neutral");
    expect(
      screen
        .getByTestId("bench-slot-station_1")
        .querySelector("[data-kind='sample_vial']"),
    ).toHaveAttribute("data-fill-segments", "1");

    expect(sendExperimentCommand).toHaveBeenNthCalledWith(
      1,
      "experiment_pesticides",
      "move_object",
      {
        entity: { kind: "tool", id: "sample_vial_lcms" },
        source: { kind: "palette", id: "sample_vial_lcms" },
        destination: { kind: "workbench_slot", id: "station_1" },
      },
    );
    expect(sendExperimentCommand).toHaveBeenNthCalledWith(
      2,
      "experiment_pesticides",
      "add_liquid_to_workbench_tool",
      { slot_id: "station_1", liquid_id: "acetonitrile_extraction", volume_ml: 10 },
    );
    expect(within(screen.getByTestId("bench-slot-station_1")).getByText("Acetonitrile")).toBeInTheDocument();
  });

  it("shows a syncing status and ignores additional commands while one is pending", async () => {
    const deferredCommand = createDeferred<Experiment>();
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment());
    vi.mocked(sendExperimentCommand).mockReturnValue(deferredCommand.promise);

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getAllByText("Empty station")).toHaveLength(2);
    });

    const firstTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("toolbar-item-sample_vial_lcms"), {
      dataTransfer: firstTransfer,
    });
    fireEvent.drop(screen.getByTestId("bench-slot-station_1"), { dataTransfer: firstTransfer });

    await waitFor(() => {
      expect(screen.getByText(/Syncing\.\.\./)).toBeInTheDocument();
    });

    const secondTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("toolbar-item-centrifuge_tube_50ml"), {
      dataTransfer: secondTransfer,
    });
    fireEvent.drop(screen.getByTestId("bench-slot-station_2"), { dataTransfer: secondTransfer });

    expect(sendExperimentCommand).toHaveBeenCalledTimes(1);

    deferredCommand.resolve(
      makeWorkbenchExperiment({
        auditLog: ["Autosampler vial placed on Station 1."],
        slots: makeSlots([{ tool: makeTool() }]),
      }),
    );

    await waitFor(() => {
      expect(screen.getByText("Autosampler vial placed on Station 1.")).toBeInTheDocument();
    });
  });

  it("sends the selected dosed volume when adding a liquid to a bench tool", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([{ tool: makeTool({ toolId: "centrifuge_tube_50ml", label: "50 mL centrifuge tube", toolType: "centrifuge_tube", capacity_ml: 50 }) }]),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        auditLog: ["Acetonitrile increased to 15 mL in 50 mL centrifuge tube."],
        slots: makeSlots([
          {
            tool: makeTool({
              toolId: "centrifuge_tube_50ml",
              label: "50 mL centrifuge tube",
              toolType: "centrifuge_tube",
              capacity_ml: 50,
              liquids: [
                {
                  id: "bench_liquid_1",
                  liquidId: "acetonitrile_extraction",
                  name: "Acetonitrile",
                  volume_ml: 15,
                  accent: "amber",
                },
              ],
            }),
          },
        ]),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(
        within(screen.getByTestId("bench-slot-station_1")).getByText("50 mL centrifuge tube"),
      ).toBeInTheDocument();
    });

    const liquidTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("toolbar-item-acetonitrile_extraction"), {
      dataTransfer: liquidTransfer,
    });
    fireEvent.drop(screen.getByTestId("bench-slot-station_1"), { dataTransfer: liquidTransfer });
    fireEvent.change(screen.getByLabelText("Acetonitrile draft volume"), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByText("Add"));

    await waitFor(() => {
      expect(screen.getByText("Acetonitrile increased to 15 mL in 50 mL centrifuge tube.")).toBeInTheDocument();
    });

    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "add_liquid_to_workbench_tool",
      {
        slot_id: "station_1",
        liquid_id: "acetonitrile_extraction",
        volume_ml: 5,
      },
    );
    expect(within(screen.getByTestId("bench-slot-station_1")).getByText("Acetonitrile")).toBeInTheDocument();
  });

  it("does not offer individual liquid removal from a tool", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([
          {
            tool: makeTool({
              liquids: [
                {
                  id: "bench_liquid_1",
                  liquidId: "acetonitrile_extraction",
                  name: "Acetonitrile",
                  volume_ml: 2,
                  accent: "amber",
                },
              ],
            }),
          },
        ]),
      }),
    );
    render(<PesticideWorkbench />);

    const declaredContents = await screen.findByRole("region", { name: "Declared contents" });
    expect(within(declaredContents).getByText("Acetonitrile")).toBeInTheDocument();
    expect(within(declaredContents).getByText("2.00 mL")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove Acetonitrile" })).not.toBeInTheDocument();
    expect(sendExperimentCommand).not.toHaveBeenCalled();
  });

  it("surfaces backend command failures in the status panel without mutating the bench", async () => {
    vi.mocked(createExperiment).mockResolvedValue(makeWorkbenchExperiment());
    vi.mocked(sendExperimentCommand).mockRejectedValue(new Error("Station 1 is unavailable"));

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getAllByText("Empty station")).toHaveLength(2);
    });

    const toolTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("toolbar-item-sample_vial_lcms"), {
      dataTransfer: toolTransfer,
    });
    fireEvent.drop(screen.getByTestId("bench-slot-station_1"), { dataTransfer: toolTransfer });

    await waitFor(() => {
      expect(screen.getByText("Station 1 is unavailable")).toBeInTheDocument();
    });

    expect(screen.getAllByText("Empty station")).toHaveLength(2);
    expect(sendExperimentCommand).toHaveBeenCalledTimes(1);
  });

  it("accepts a second liquid drop on a station that already contains a filled tool", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([
          {
            tool: makeTool({
              liquids: [
                {
                  id: "bench_liquid_1",
                  liquidId: "acetonitrile_extraction",
                  name: "Acetonitrile",
                  volume_ml: 1,
                  accent: "amber",
                },
              ],
            }),
          },
        ]),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        auditLog: ["ISTD solution added to Autosampler vial."],
        slots: makeSlots([
          {
            tool: makeTool({
              liquids: [
                {
                  id: "bench_liquid_1",
                  liquidId: "acetonitrile_extraction",
                  name: "Acetonitrile",
                  volume_ml: 1,
                  accent: "amber",
                },
                {
                  id: "bench_liquid_2",
                  liquidId: "istd_solution",
                  name: "ISTD solution",
                  volume_ml: 0.05,
                  accent: "emerald",
                },
              ],
            }),
          },
        ]),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("bench-slot-station_1")).toBeInTheDocument();
    });

    const liquidTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("toolbar-item-istd_solution"), {
      dataTransfer: liquidTransfer,
    });

    const station = screen.getByTestId("bench-slot-station_1");
    const dragOverEvent = createEvent.dragOver(station, { dataTransfer: liquidTransfer });
    fireEvent(station, dragOverEvent);
    fireEvent.drop(station, { dataTransfer: liquidTransfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    expect(sendExperimentCommand).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Add"));

    await waitFor(() => {
      expect(screen.getByText("ISTD solution added to Autosampler vial.")).toBeInTheDocument();
    });

    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "add_liquid_to_workbench_tool",
      { slot_id: "station_1", liquid_id: "istd_solution", volume_ml: 0.05 },
    );
    expect(
      within(screen.getByTestId("bench-slot-station_1")).getByText("ISTD solution"),
    ).toBeInTheDocument();
  });

  it("keeps the instrument idle until the staged rack is loaded", async () => {
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        slots: makeSlots([{ tool: makeTool() }]),
        workspaceWidgets: makeWorkspaceWithRackAndInstrumentVisible(),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        rackSlots: makeRackSlots([{ tool: makeTool() }]),
        slots: makeSlots([{ tool: null }]),
        workspaceWidgets: makeWorkspaceWithRackAndInstrumentVisible(),
      }),
    );

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("bench-tool-card-bench_tool_1")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByTestId("widget-rack")).toBeInTheDocument();
      expect(screen.getByTestId("widget-instrument")).toBeInTheDocument();
    });

    const vialTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("bench-tool-card-bench_tool_1"), {
      dataTransfer: vialTransfer,
    });
    fireEvent.dragOver(screen.getByTestId("rack-illustration-slot-1"), { dataTransfer: vialTransfer });
    fireEvent.drop(screen.getByTestId("rack-illustration-slot-1"), { dataTransfer: vialTransfer });

    await waitFor(() => {
      expect(screen.getByTestId("autosampler-rack-illustration")).toHaveAttribute(
        "data-occupied-count",
        "1",
      );
    });

    expect(screen.getByTestId("autosampler-rack-illustration")).toHaveAttribute(
      "data-tone",
      "active",
    );
    expect(screen.getByTestId("lc-msms-instrument-illustration")).toHaveAttribute(
      "data-status",
      "idle",
    );
    expect(screen.getByTestId("autosampler-rack-drag-edge-top")).toHaveAttribute(
      "draggable",
      "true",
    );
    expect(screen.queryByTestId("rack-load-status")).not.toBeInTheDocument();
  });

  it("tares the analytical balance from its button", async () => {
    const analyticalTube = makeTool({
      toolId: "centrifuge_tube_50ml",
      label: "50 mL centrifuge tube",
      subtitle: "QuEChERS extraction",
      toolType: "centrifuge_tube",
      capacity_ml: 50,
    });
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithAnalyticalBalanceVisible({ tool: analyticalTube }),
      }) as Experiment,
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(makeWorkbenchExperiment() as Experiment);

    render(<PesticideWorkbench />);

    await waitFor(() => {
      expect(screen.getByTestId("analytical-balance-dropzone")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Tare" }));

    await waitFor(() => {
      expect(sendExperimentCommand).toHaveBeenCalledWith(
        "experiment_pesticides",
        "tare_analytical_balance",
        {},
      );
    });
  });

  it("applies a sample label onto a tube staged on the analytical balance", async () => {
    const analyticalTube = makeTool({
      id: "analytical_tube_1",
      toolId: "centrifuge_tube_50ml",
      label: "50 mL centrifuge tube",
      subtitle: "Tube on balance",
      toolType: "centrifuge_tube",
      capacity_ml: 50,
    });

    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithAnalyticalBalanceVisible({ tool: analyticalTube }),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithAnalyticalBalanceVisible({
          tool: {
            ...analyticalTube,
            labels: [
              {
                id: "analytical_label_1",
                labelKind: "manual",
                text: "",
              },
            ],
          },
        }),
      }),
    );

    render(<PesticideWorkbench />);

    const labelItem = await screen.findByTestId("toolbar-item-sampling_bag_label");
    const balance = screen.getByTestId("analytical-balance-dropzone");
    const transfer = createDataTransfer();

    fireEvent.dragStart(labelItem, { dataTransfer: transfer });
    const dragOverEvent = createEvent.dragOver(balance, { dataTransfer: transfer });
    fireEvent(balance, dragOverEvent);
    fireEvent.drop(balance, { dataTransfer: transfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(sendExperimentCommand).toHaveBeenCalledWith(
        "experiment_pesticides",
        "apply_sample_label_to_analytical_balance_tool",
        {},
      );
    });
    expect(await screen.findByLabelText("Sample label text")).toBeInTheDocument();
  });

  it("applies a sample label when dropped directly on the analytical balance tube card", async () => {
    const analyticalTube = makeTool({
      id: "analytical_tube_1",
      toolId: "centrifuge_tube_50ml",
      label: "50 mL centrifuge tube",
      subtitle: "Tube on balance",
      toolType: "centrifuge_tube",
      capacity_ml: 50,
    });

    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithAnalyticalBalanceVisible({ tool: analyticalTube }),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithAnalyticalBalanceVisible({
          tool: {
            ...analyticalTube,
            labels: [
              {
                id: "analytical_label_1",
                labelKind: "manual",
                text: "",
              },
            ],
          },
        }),
      }),
    );

    render(<PesticideWorkbench />);

    const labelItem = await screen.findByTestId("toolbar-item-sampling_bag_label");
    const tubeCard = screen.getByTestId("bench-tool-card-analytical-analytical_tube_1");
    const transfer = createDataTransfer();

    fireEvent.dragStart(labelItem, { dataTransfer: transfer });
    const dragOverEvent = createEvent.dragOver(tubeCard, { dataTransfer: transfer });
    fireEvent(tubeCard, dragOverEvent);
    fireEvent.drop(tubeCard, { dataTransfer: transfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(sendExperimentCommand).toHaveBeenCalledWith(
        "experiment_pesticides",
        "apply_sample_label_to_analytical_balance_tool",
        {},
      );
    });
  });

  it("applies a sample label when dropped on the analytical balance tube illustration button", async () => {
    const analyticalTube = makeTool({
      id: "analytical_tube_1",
      toolId: "centrifuge_tube_50ml",
      label: "50 mL centrifuge tube",
      subtitle: "Tube on balance",
      toolType: "centrifuge_tube",
      capacity_ml: 50,
    });

    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithAnalyticalBalanceVisible({ tool: analyticalTube }),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithAnalyticalBalanceVisible({
          tool: {
            ...analyticalTube,
            labels: [
              {
                id: "analytical_label_1",
                labelKind: "manual",
                text: "",
              },
            ],
          },
        }),
      }),
    );

    render(<PesticideWorkbench />);

    const labelItem = await screen.findByTestId("toolbar-item-sampling_bag_label");
    const illustration = screen.getByTestId("bench-tool-illustration-analytical-analytical_tube_1");
    const transfer = createDataTransfer();

    fireEvent.dragStart(labelItem, { dataTransfer: transfer });
    const dragOverEvent = createEvent.dragOver(illustration, { dataTransfer: transfer });
    fireEvent(illustration, dragOverEvent);
    fireEvent.drop(illustration, { dataTransfer: transfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(sendExperimentCommand).toHaveBeenCalledWith(
        "experiment_pesticides",
        "apply_sample_label_to_analytical_balance_tool",
        {},
      );
    });
  });

  it("applies a printed LIMS ticket onto a tube staged on the analytical balance", async () => {
    const analyticalTube = makeTool({
      id: "analytical_tube_1",
      toolId: "centrifuge_tube_50ml",
      label: "50 mL centrifuge tube",
      subtitle: "Tube on balance",
      toolType: "centrifuge_tube",
      capacity_ml: 50,
    });

    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        limsReception: makeLimsReception({
          measuredGrossMassG: 2486,
          labSampleCode: "APP-0001-01",
          status: "awaiting_label_application",
          printedLabelTicket: makePrintedLimsTicket(),
        }),
        workspaceWidgets: makeWorkspaceWithAnalyticalBalanceVisible({ tool: analyticalTube }),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        limsReception: makeLimsReception({
          measuredGrossMassG: 2486,
          labSampleCode: "APP-0001-01",
          status: "received",
          printedLabelTicket: null,
        }),
        workspaceWidgets: makeWorkspaceWithAnalyticalBalanceVisible({
          tool: {
            ...analyticalTube,
            labels: [
              {
                id: "analytical_lims_label_1",
                labelKind: "lims",
                text: "APP-0001-01",
                sampleCode: "APP-0001-01",
                receivedDate: "2026-04-03",
              },
            ],
          },
        }),
      }),
    );

    render(<PesticideWorkbench />);

    const ticket = await screen.findByTestId("lims-printed-ticket");
    const tubeCard = screen.getByTestId("bench-tool-card-analytical-analytical_tube_1");
    const transfer = createDataTransfer();

    fireEvent.dragStart(ticket, { dataTransfer: transfer });
    const dragOverEvent = createEvent.dragOver(tubeCard, { dataTransfer: transfer });
    fireEvent(tubeCard, dragOverEvent);
    fireEvent.drop(tubeCard, { dataTransfer: transfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(sendExperimentCommand).toHaveBeenCalledWith(
        "experiment_pesticides",
        "apply_printed_lims_label_to_analytical_balance_tool",
        {},
      );
    });
  });

  it("opens a liquid dosing draft when dropped on the analytical balance tube", async () => {
    const analyticalTube = makeTool({
      id: "analytical_tube_1",
      toolId: "centrifuge_tube_50ml",
      label: "50 mL centrifuge tube",
      subtitle: "Tube on balance",
      toolType: "centrifuge_tube",
      capacity_ml: 50,
    });

    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithAnalyticalBalanceVisible({ tool: analyticalTube }),
      }),
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(
      makeWorkbenchExperiment({
        auditLog: ["Acetonitrile added to 50 mL centrifuge tube."],
        workspaceWidgets: makeWorkspaceWithAnalyticalBalanceVisible({
          tool: {
            ...analyticalTube,
            liquids: [
              {
                id: "analytical_liquid_1",
                liquidId: "acetonitrile_extraction",
                name: "Acetonitrile",
                volume_ml: 10,
                accent: "amber",
              },
            ],
          },
        }),
      }),
    );

    render(<PesticideWorkbench />);

    const liquidItem = await screen.findByTestId("toolbar-item-acetonitrile_extraction");
    const tubeCard = screen.getByTestId("bench-tool-card-analytical-analytical_tube_1");
    const transfer = createDataTransfer();

    fireEvent.dragStart(liquidItem, { dataTransfer: transfer });
    const dragOverEvent = createEvent.dragOver(tubeCard, { dataTransfer: transfer });
    fireEvent(tubeCard, dragOverEvent);
    fireEvent.drop(tubeCard, { dataTransfer: transfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    expect(sendExperimentCommand).not.toHaveBeenCalled();
    expect(screen.getByText("Dose Acetonitrile")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Add"));

    await waitFor(() => {
      expect(sendExperimentCommand).toHaveBeenCalledWith(
        "experiment_pesticides",
        "add_liquid_to_analytical_balance_tool",
        { liquid_id: "acetonitrile_extraction", volume_ml: 10 },
      );
    });
    expect(screen.getByText("Acetonitrile added to 50 mL centrifuge tube.")).toBeInTheDocument();
  });

  it("closes a tube from the analytical balance card", async () => {
    const analyticalTube = makeTool({
      toolId: "centrifuge_tube_50ml",
      label: "50 mL centrifuge tube",
      subtitle: "QuEChERS extraction",
      toolType: "centrifuge_tube",
      capacity_ml: 50,
      isSealed: false,
    });
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithAnalyticalBalanceVisible({ tool: analyticalTube }),
      }) as Experiment,
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(makeWorkbenchExperiment() as Experiment);

    render(<PesticideWorkbench />);

    fireEvent.click(await screen.findByRole("button", { name: "Close 50 mL centrifuge tube" }));

    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "close_analytical_balance_tool",
      {},
    );
  });

  it("adds QuEChERS salts to a debug tube on the vortex", async () => {
    const vortexTube = makeTool({
      toolId: "centrifuge_tube_50ml",
      label: "50 mL centrifuge tube",
      subtitle: "QuEChERS extraction",
      toolType: "centrifuge_tube",
      capacity_ml: 50,
      containsSlurry: true,
      liquids: [],
    });
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithVortexVisible({ tool: vortexTube }),
      }) as Experiment,
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(makeWorkbenchExperiment() as Experiment);

    render(<PesticideWorkbench />);

    const salts = await screen.findByTestId("toolbar-item-quechers_salts");
    const vortexItem = screen.getByTestId("vortex-staged-item");
    const transfer = createDataTransfer();
    fireEvent.dragStart(salts, { dataTransfer: transfer });
    const dragOverEvent = createEvent.dragOver(vortexItem, { dataTransfer: transfer });
    fireEvent(vortexItem, dragOverEvent);
    fireEvent.drop(vortexItem, { dataTransfer: transfer });

    expect(dragOverEvent.defaultPrevented).toBe(true);
    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "add_liquid_to_tool",
      { tool_id: vortexTube.id, liquid_id: "quechers_salts", volume_ml: 1 },
    );
  });

  it("closes a tube from the vortex card", async () => {
    const vortexTube = makeTool({
      toolId: "centrifuge_tube_50ml",
      label: "50 mL centrifuge tube",
      subtitle: "QuEChERS extraction",
      toolType: "centrifuge_tube",
      capacity_ml: 50,
      isSealed: false,
    });
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithVortexVisible({ tool: vortexTube }),
      }) as Experiment,
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(makeWorkbenchExperiment() as Experiment);

    render(<PesticideWorkbench />);

    fireEvent.click(await screen.findByRole("button", { name: "Close 50 mL centrifuge tube" }));

    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "close_vortex_tool",
      {},
    );
  });

  it("anchors the tutorial to the seal button of the tube staged in the vortex", async () => {
    const vortexTube = makeTool({
      toolId: "centrifuge_tube_50ml",
      label: "50 mL centrifuge tube",
      subtitle: "QuEChERS extraction",
      toolType: "centrifuge_tube",
      capacity_ml: 50,
      isSealed: false,
    });
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithVortexVisible({ tool: vortexTube }),
      }) as Experiment,
    );

    render(<PesticideWorkbench />);

    const closeButton = await screen.findByRole("button", { name: "Close 50 mL centrifuge tube" });
    expect(closeButton).toHaveAttribute("data-tutorial-anchor", `seal-tool-${vortexTube.id}`);
  });

  it("opens a sealed tube from the vortex card", async () => {
    const vortexTube = makeTool({
      toolId: "centrifuge_tube_50ml",
      label: "50 mL centrifuge tube",
      subtitle: "QuEChERS extraction",
      toolType: "centrifuge_tube",
      capacity_ml: 50,
      isSealed: true,
    });
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithVortexVisible({ tool: vortexTube }),
      }) as Experiment,
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(makeWorkbenchExperiment() as Experiment);

    render(<PesticideWorkbench />);

    fireEvent.click(await screen.findByRole("button", { name: "Open 50 mL centrifuge tube" }));

    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "open_vortex_tool",
      {},
    );
  });

  it("opens a sealed tube from the analytical balance card", async () => {
    const analyticalTube = makeTool({
      toolId: "centrifuge_tube_50ml",
      label: "50 mL centrifuge tube",
      subtitle: "QuEChERS extraction",
      toolType: "centrifuge_tube",
      capacity_ml: 50,
      isSealed: true,
    });
    vi.mocked(createExperiment).mockResolvedValue(
      makeWorkbenchExperiment({
        workspaceWidgets: makeWorkspaceWithAnalyticalBalanceVisible({ tool: analyticalTube }),
      }) as Experiment,
    );
    vi.mocked(sendExperimentCommand).mockResolvedValue(makeWorkbenchExperiment() as Experiment);

    render(<PesticideWorkbench />);

    fireEvent.click(await screen.findByRole("button", { name: "Open 50 mL centrifuge tube" }));

    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "open_analytical_balance_tool",
      {},
    );
  });

  it("loads the rack into the LC-MS/MS before enabling the acquisition console", async () => {
    const experiment = makeWorkbenchExperiment({
      rackSlots: makeRackSlots([{ tool: makeTool({ id: "sample_vial" }) }]),
      workspaceWidgets: makeWorkspaceWidgets([
        {},
        {},
        {},
        {},
        {},
        { isPresent: true },
        { isPresent: true },
      ]),
    });
    const loadedExperiment = {
      ...experiment,
      snapshot_version: experiment.snapshot_version + 1,
      rack: { ...experiment.rack, state: "loaded" as const },
    };
    vi.mocked(createExperiment).mockResolvedValue(experiment);
    vi.mocked(sendExperimentCommand).mockResolvedValue(loadedExperiment);

    render(<PesticideWorkbench />);

    expect(
      await screen.findByRole("button", { name: "Open acquisition console" }),
    ).toBeDisabled();
    const dataTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("autosampler-rack-drag-edge-top"), {
      dataTransfer,
    });
    const instrumentDropzone = screen.getByTestId("lcmsms-instrument-dropzone");
    expect(instrumentDropzone).toHaveAttribute("data-drop-highlighted", "true");
    const dragOverEvent = createEvent.dragOver(instrumentDropzone, { dataTransfer });
    fireEvent(instrumentDropzone, dragOverEvent);
    expect(dragOverEvent.defaultPrevented).toBe(true);
    fireEvent.drop(instrumentDropzone, { dataTransfer });

    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "load_rack_into_instrument",
      {},
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open acquisition console" })).toBeEnabled();
    });
    expect(screen.getByText("Rack loaded in LC-MS/MS")).toBeInTheDocument();
  });

  it("unloads the rack so its vials can be moved again", async () => {
    const loadedExperiment = makeWorkbenchExperiment({
      rackState: "loaded",
      rackSlots: makeRackSlots([{ tool: makeTool({ id: "sample_vial" }) }]),
      workspaceWidgets: makeWorkspaceWithRackAndInstrumentVisible(),
    });
    const unloadedExperiment = {
      ...loadedExperiment,
      snapshot_version: loadedExperiment.snapshot_version + 1,
      rack: {
        ...loadedExperiment.rack,
        allowedDropTargets: ["lcmsms_instrument" as const],
        isDraggable: true,
        state: "available" as const,
      },
    };
    vi.mocked(createExperiment).mockResolvedValue(loadedExperiment);
    vi.mocked(sendExperimentCommand).mockResolvedValue(unloadedExperiment);

    render(<PesticideWorkbench />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Unload rack from LC-MS/MS" }),
    );

    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "unload_rack_from_instrument",
      {},
    );
    await waitFor(() => {
      expect(screen.queryByTestId("rack-load-status")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("autosampler-rack-drag-edge-top")).toHaveAttribute(
      "draggable",
      "true",
    );
    expect(screen.getByTestId("rack-illustration-slot-1")).toHaveAttribute(
      "draggable",
      "true",
    );
  });

  it("opens the LC-MS/MS console from the instrument and launches its configured sequence", async () => {
    const experiment = makeWorkbenchExperiment({
      rackState: "loaded",
      rackSlots: makeRackSlots([
        {
          tool: makeTool({
            id: "calibration_vial",
            fieldLabelText: "Cal 10",
            calibrationContext: { levelNgPerMl: 10, compoundIds: ["boscalid"] },
          }),
        },
        {
          tool: makeTool({
            id: "sample_vial",
            fieldLabelText: "Apple A",
          }),
        },
      ]),
      workspaceWidgets: makeWorkspaceWidgets([
        {},
        {},
        {},
        {},
        {},
        { isPresent: true },
        { isPresent: true },
      ]),
    });
    vi.mocked(createExperiment).mockResolvedValue(experiment);
    vi.mocked(sendExperimentCommand).mockResolvedValue(experiment);

    render(<PesticideWorkbench />);

    const acquisitionConsoleToggle = await screen.findByRole("button", {
      name: "Open acquisition console",
    });
    fireEvent.click(acquisitionConsoleToggle);
    expect(screen.getByRole("dialog", { name: "LC-MS/MS acquisition console" })).toBeInTheDocument();
    expect(acquisitionConsoleToggle).toHaveAccessibleName("Close acquisition console");
    expect(
      screen.getAllByRole("button", { name: "Close acquisition console" }),
    ).toHaveLength(1);

    fireEvent.click(acquisitionConsoleToggle);
    expect(
      screen.queryByRole("dialog", { name: "LC-MS/MS acquisition console" }),
    ).not.toBeInTheDocument();
    expect(acquisitionConsoleToggle).toHaveAccessibleName("Open acquisition console");

    fireEvent.click(acquisitionConsoleToggle);
    fireEvent.click(screen.getByRole("button", { name: "Launch acquisition" }));

    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "run_sequence",
      {
        method_id: "apple_pesticides_mrm_v1",
        injections: [
          expect.objectContaining({
            rack_slot_id: "rack_slot_1",
            sample_name: "Cal 10",
          }),
          expect.objectContaining({
            rack_slot_id: "rack_slot_2",
            sample_name: "Apple A",
          }),
        ],
      },
    );
  });

  it("starts the configured acquisition run from the illustration power button", async () => {
    const experiment = makeWorkbenchExperiment({
      rackState: "loaded",
      rackSlots: makeRackSlots([
        {
          tool: makeTool({
            id: "calibration_vial",
            fieldLabelText: "Cal 10",
            calibrationContext: { levelNgPerMl: 10, compoundIds: ["boscalid"] },
          }),
        },
        {
          tool: makeTool({
            id: "sample_vial",
            fieldLabelText: "Apple A",
          }),
        },
      ]),
      workspaceWidgets: makeWorkspaceWidgets([
        {},
        {},
        {},
        {},
        {},
        { isPresent: true },
        { isPresent: true },
      ]),
    });
    vi.mocked(createExperiment).mockResolvedValue(experiment);
    vi.mocked(sendExperimentCommand).mockResolvedValue(experiment);

    render(<PesticideWorkbench />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Open acquisition console" }),
    );
    const sampleRow = screen.getAllByTestId("acquisition-sequence-row")[1];
    fireEvent.change(within(sampleRow).getByLabelText("Sample name"), {
      target: { value: "Configured apple sample" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Start the acquisition run" }),
    );

    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "run_sequence",
      {
        method_id: "apple_pesticides_mrm_v1",
        injections: [
          expect.objectContaining({
            rack_slot_id: "rack_slot_1",
            sample_name: "Cal 10",
          }),
          expect.objectContaining({
            rack_slot_id: "rack_slot_2",
            sample_name: "Configured apple sample",
          }),
        ],
      },
    );
    expect(
      screen.queryByRole("dialog", { name: "LC-MS/MS acquisition console" }),
    ).not.toBeInTheDocument();
  });

  it("shows the loaded method in the console and sends the selected one at launch", async () => {
    const experiment = makeWorkbenchExperiment({
      rackState: "loaded",
      rackSlots: makeRackSlots([
        { tool: makeTool({ id: "sample_vial", fieldLabelText: "Apple A" }) },
      ]),
      workspaceWidgets: makeWorkspaceWidgets([
        {},
        {},
        {},
        {},
        {},
        { isPresent: true },
        { isPresent: true },
      ]),
    });
    vi.mocked(createExperiment).mockResolvedValue(experiment);
    vi.mocked(sendExperimentCommand).mockResolvedValue(experiment);
    vi.mocked(getAcquisitionMethodCatalog).mockResolvedValue([
      {
        id: "apple_pesticides_mrm_v1",
        name: "Apple pesticides — MRM",
        version: "1.0.0",
        runtimeS: 720,
        isEducational: true,
        provenanceNote: "Educational method.",
        isBuiltIn: true,
        compoundCount: 2,
        transitionCount: 3,
      },
      {
        id: "apple_pesticides_mrm_v2",
        name: "Apple pesticides — MRM",
        version: "2.0.0",
        runtimeS: 900,
        isEducational: true,
        provenanceNote: "Educational method.",
        isBuiltIn: false,
        compoundCount: 3,
        transitionCount: 6,
      },
    ]);

    render(<PesticideWorkbench />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Open acquisition console" }),
    );

    const summary = await screen.findByTestId("method-summary");
    expect(summary).toHaveTextContent("12:00 run");
    expect(getAcquisitionMethod).toHaveBeenCalledWith("apple_pesticides_mrm_v1");

    // The full method sheet lives in the modal manager, not in the console.
    fireEvent.click(screen.getByRole("button", { name: "Manage methods" }));
    const manager = await screen.findByRole("dialog", {
      name: "Acquisition method manager",
    });
    const viewer = within(manager).getByRole("region", {
      name: "Acquisition method details",
    });
    expect(within(viewer).getByTestId("method-runtime")).toHaveTextContent("12:00");
    fireEvent.click(within(manager).getByRole("button", { name: "Close method manager" }));

    const selector = screen.getByLabelText("Acquisition method");
    await waitFor(() => expect(within(selector).getAllByRole("option")).toHaveLength(2));
    fireEvent.change(selector, { target: { value: "apple_pesticides_mrm_v2" } });

    fireEvent.click(screen.getByRole("button", { name: "Launch acquisition" }));

    expect(sendExperimentCommand).toHaveBeenCalledWith(
      "experiment_pesticides",
      "run_sequence",
      expect.objectContaining({ method_id: "apple_pesticides_mrm_v2" }),
    );
  });

});
