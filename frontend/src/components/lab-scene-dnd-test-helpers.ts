import {
  labToolCatalog,
  labWorkflowCategories,
} from "@/lib/lab-workflow-catalog";
import {
  getLimsLabelTicketDropTargets,
  getProduceLotDropTargets,
  getSampleLabelDropTargets,
  getToolDropTargets,
} from "@/test-support/drop-targets";
import {
  canToolAcceptLiquids,
  canToolAcceptProduce,
  canToolBeSealed,
  canToolReceiveContents,
  getOpenEmptyToolContainment,
} from "@/test-support/tool-capabilities";
import { getWorkspaceEquipmentWidgetId } from "@/lib/workspace-widget-ids";
import type { Experiment } from "@/types/experiment";
import type {
  BenchSlot,
  BenchToolInstance,
  ExperimentProduceLot,
  ExperimentWorkspaceWidget,
  LimsReception,
  RackSlot,
  TrashProduceLotEntry,
  TrashSampleLabelEntry,
  ToolbarItem,
  ToolCatalogItem,
  WorkspaceWidgetType,
} from "@/types/workbench";
import { expect } from "vitest";

const pesticideToolCatalog = labToolCatalog;

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

type MockDataTransfer = {
  data: Map<string, string>;
  dropEffect: string;
  effectAllowed: string;
  types: string[];
  getData: (type: string) => string;
  setData: (type: string, value: string) => void;
};

export type DndTargetId =
  | "bench-slot-station_1"
  | "bench-slot-station_2"
  | "grinder-dropzone"
  | "gross-balance-dropzone"
  | "analytical-balance-dropzone"
  | "inventory-dropzone"
  | "rack-illustration-slot-1"
  | "vortex-dropzone"
  | "widget-workspace"
  | "trash-dropzone";

export type DndCoverageScenario =
  | "inventory"
  | "surface-and-balance-produce";

type ExpectedCommand = {
  payload: unknown;
  type: string;
};

type DndSourceCase = {
  availableTargets: DndTargetId[];
  buildExperiment: () => Experiment;
  expectRackWidget: boolean;
  id: string;
  label: string;
  openBasket: boolean;
  openTrash: boolean;
  sourceTestId: string;
  targetExpectations: Partial<
    Record<
      DndTargetId,
      {
        command: ExpectedCommand | null;
        compatible: boolean;
      }
    >
  >;
};

const toolbarItems = labWorkflowCategories.flatMap((category) => category.items);
const toolItems = toolbarItems.filter((item): item is ToolCatalogItem => item.itemType === "tool");
const paletteItems = toolbarItems.filter((item) => item.itemType !== "sample_label");
const sampleVialItem = labToolCatalog.sample_vial_lcms;
const sampleBagItem = pesticideToolCatalog.sealed_sampling_bag;
const trashableToolItems = toolItems.filter((item) => getToolDropTargets(item.toolType).includes("trash_bin"));
const weighableToolItems = toolItems.filter(
  (item) => getToolDropTargets(item.toolType).includes("analytical_balance_widget"),
);

const analyticalBalanceCompatibleSourceIds = new Set<string>([
  ...weighableToolItems.map((item) => `palette-${item.id}`),
  ...weighableToolItems.map((item) => `workbench-${item.id}`),
  ...weighableToolItems.map((item) => `trash-tool-${item.id}`),
  "rack-sample_vial",
  "gross-balance-sample-vial",
]);

const analyticalBalanceDraftSourceIds = new Set<string>([
  "palette-acetonitrile_extraction",
  "palette-apple_extract",
  "palette-ultrapure_water_rinse",
]);

const grossBalanceCompatibleSourceIds = new Set<string>([
  ...toolItems.map((item) => `palette-${item.id}`),
  ...toolItems.map((item) => `workbench-${item.id}`),
  ...toolItems.map((item) => `trash-tool-${item.id}`),
  "basket-received-bag",
  "basket-produce-lot-apple",
  "workbench-produce-lot-apple",
  "workbench-surface-produce-lot-apple",
  "grinder-produce-lot-apple",
  "trash-produce-lot-apple",
  "rack-sample_vial",
  "palette-sampling_bag_label",
  "workbench-sample-label",
  "trash-sample-label",
  "lims-printed-ticket",
]);

export const dndTargetCases: {
  assertDragOver: boolean;
  id: DndTargetId;
  label: string;
}[] = [
  { id: "bench-slot-station_1", label: "occupied station", assertDragOver: true },
  { id: "bench-slot-station_2", label: "empty station", assertDragOver: true },
  { id: "grinder-dropzone", label: "grinder", assertDragOver: true },
  { id: "gross-balance-dropzone", label: "gross balance", assertDragOver: true },
  { id: "analytical-balance-dropzone", label: "analytical balance", assertDragOver: true },
  { id: "inventory-dropzone", label: "inventory", assertDragOver: true },
  { id: "rack-illustration-slot-1", label: "rack slot", assertDragOver: true },
  { id: "vortex-dropzone", label: "vortex", assertDragOver: true },
  { id: "widget-workspace", label: "workspace canvas", assertDragOver: false },
  { id: "trash-dropzone", label: "trash", assertDragOver: true },
];

export function createDataTransfer(): MockDataTransfer {
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

function makeSlots(overrides: Partial<BenchSlot>[] = [], count = Math.max(2, overrides.length)): BenchSlot[] {
  const baseSlots: BenchSlot[] = Array.from({ length: count }, (_, index) => ({
    id: `station_${index + 1}`,
    label: `Station ${index + 1}`,
    surfaceProduceLots: [],
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
      isPresent: true,
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
      isPresent: true,
      isTrashed: false,
    },
    {
      id: "workbench",
      widgetType: "workbench",
      label: "Workbench",
      dropTargetTypes: [],
      anchor: "top-left",
      offsetX: 234,
      offsetY: 0,
      isPresent: true,
      isTrashed: false,
    },
    {
      id: "trash",
      widgetType: "trash",
      label: "Trash",
      dropTargetTypes: [],
      anchor: "top-right",
      offsetX: 0,
      offsetY: 0,
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
      isPresent: true,
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
      anchor: "top-right",
      offsetX: 70,
      offsetY: 248,
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
      isPresent: true,
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
      isPresent: true,
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
    };
  });
}

function makeTool(item: ToolCatalogItem, overrides: Partial<BenchToolInstance> = {}): BenchToolInstance {
  const toolType = overrides.toolType ?? item.toolType;
  const isSealed = overrides.isSealed ?? false;
  const sampleLabelText = (overrides as Partial<BenchToolInstance> & { sampleLabelText?: string | null })
    .sampleLabelText;
  const sampleLabelReceivedDate = (
    overrides as Partial<BenchToolInstance> & { sampleLabelReceivedDate?: string | null }
  ).sampleLabelReceivedDate;
  const derivedLabels =
    overrides.labels ??
    (sampleLabelText
      ? [
          {
            id: `${overrides.id ?? "bench_tool_1"}-sample-label`,
            labelKind: sampleLabelReceivedDate ? "lims" : "manual",
            text: sampleLabelText,
            receivedDate: sampleLabelReceivedDate ?? null,
            sampleCode: sampleLabelReceivedDate ? sampleLabelText : null,
            isDraggable: true,
            allowedDropTargets: getSampleLabelDropTargets(),
          },
        ]
      : []);

  const tool = {
    id: "bench_tool_1",
    toolId: item.id,
    label: item.name,
    subtitle: item.subtitle,
    accent: item.accent,
    toolType,
    capacity_ml: item.capacity_ml,
    canReceiveContents: canToolReceiveContents(toolType, isSealed),
    canReceiveLiquids: canToolAcceptLiquids(toolType),
    canReceiveProduce: canToolAcceptProduce(toolType),
    canSeal: canToolBeSealed(toolType),
    isSealed,
    isDraggable: true,
    allowedDropTargets: getToolDropTargets(toolType),
    labels: derivedLabels,
    produceLots: [],
    liquids: [],
    ...overrides,
  };
  return {
    ...tool,
    containment: tool.containment ?? getOpenEmptyToolContainment(toolType),
  };
}

function makeTrashToolEntry(item: ToolCatalogItem): BenchToolInstance {
  return makeTool(item);
}

function makeTrashProduceLotEntry(): TrashProduceLotEntry {
  return {
    id: "trash_produce_lot_1",
    originLabel: "Produce basket",
    produceLot: makeProduceLot({ id: "produce_1" }),
  };
}

function makeTrashSampleLabelEntry(): TrashSampleLabelEntry {
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
  };
}

function makeExperiment({
  basketTools = [],
  limsReception = makeLimsReception(),
  slots = makeSlots(),
  rackSlots = makeRackSlots(),
  trashProduceLots = [],
  trashSampleLabels = [],
  trashTools = [],
  produceBasketLots = [],
  workspaceWidgets = makeWorkspaceWidgets(),
}: {
  basketTools?: BenchToolInstance[];
  limsReception?: LimsReception;
  slots?: BenchSlot[];
  rackSlots?: RackSlot[];
  trashProduceLots?: TrashProduceLotEntry[];
  trashSampleLabels?: TrashSampleLabelEntry[];
  trashTools?: BenchToolInstance[];
  produceBasketLots?: Experiment["workspace"]["produceBasketLots"];
  workspaceWidgets?: ExperimentWorkspaceWidget[];
} = {}): Experiment {
  return {
    id: "experiment_pesticides",
    status: "preparing",
    last_simulation_at: "2026-03-28T19:00:00Z",
    snapshot_version: 1,
    workbench: { slots },
    rack: { slots: rackSlots },
    trash: { children: trashTools, discardedFrom: {}, produceLots: trashProduceLots, sampleLabels: trashSampleLabels },
    workspace: { produceBasketLots, widgets: workspaceWidgets },
    basketTools,
    spatula: {
      isLoaded: false,
      produceFractions: [],
      sourceToolId: null,
    },
    analyticalBalance: {
      tareMassG: null,
      taredToolId: null,
    },
    limsReception,
    limsEntries: limsReception.labSampleCode ? [limsReception] : [],
    audit_log: ["Experiment created", "Receive the grower bag, weigh it, then register it in the LIMS."],
  };
}

function makeLimsReception(overrides: Partial<LimsReception> = {}): LimsReception {
  return {
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
    ...overrides,
  };
}

function makePrintedLimsTicket(
  overrides: Partial<NonNullable<LimsReception["printedLabelTicket"]>> = {},
): NonNullable<LimsReception["printedLabelTicket"]> {
  return {
    id: "lims_ticket_1",
    sampleCode: "APP-2026-0001",
    labelText: "APP-2026-0001",
    receivedDate: "2026-04-03",
    isDraggable: true,
    allowedDropTargets: getLimsLabelTicketDropTargets(),
    ...overrides,
  };
}

function createPaletteSourceCase(item: ToolbarItem): DndSourceCase {
  const widgetId = item.itemType === "workspace_widget" ? getWorkspaceEquipmentWidgetId(item.id) : null;

  return {
    id: `palette-${item.id}`,
    label: `palette ${item.name}`,
    sourceTestId: `toolbar-item-${item.id}`,
    openBasket: false,
    openTrash: false,
    expectRackWidget: true,
    availableTargets: [
      "bench-slot-station_1",
      "bench-slot-station_2",
      "analytical-balance-dropzone",
      "grinder-dropzone",
      "rack-illustration-slot-1",
      "widget-workspace",
      "trash-dropzone",
    ],
    buildExperiment: () =>
      makeExperiment({
        slots: makeSlots([{ tool: makeTool(sampleVialItem) }]),
      }),
    targetExpectations: {
      "bench-slot-station_1": {
        compatible: item.itemType === "liquid" && item.id !== "dry_ice_pellets",
        command: null,
      },
      "bench-slot-station_2": {
        compatible: item.itemType === "tool",
        command:
          item.itemType === "tool"
            ? {
                type: "place_tool_on_workbench",
                payload: {
                  slot_id: "station_2",
                  tool_id: item.id,
                },
              }
            : null,
      },
      "grinder-dropzone": {
        compatible: item.itemType === "liquid" && item.id === "dry_ice_pellets",
        command: null,
      },
      "rack-illustration-slot-1": {
        compatible: item.itemType === "tool" && item.toolType === "sample_vial",
        command:
          item.itemType === "tool" && item.toolType === "sample_vial"
            ? {
                type: "place_tool_from_palette",
                payload: {
                  tool_id: item.id,
                  destination_kind: "rack_slot",
                  destination_id: "rack_slot_1",
                },
              }
            : null,
      },
      "widget-workspace": {
        compatible: item.itemType === "workspace_widget",
        command:
          item.itemType === "workspace_widget" && widgetId
            ? {
                type: "add_workspace_widget",
                payload: expect.objectContaining({ widget_id: widgetId }),
              }
            : null,
      },
      "trash-dropzone": {
        compatible: item.itemType === "tool" && getToolDropTargets(item.toolType).includes("trash_bin"),
        command:
          item.itemType === "tool" && getToolDropTargets(item.toolType).includes("trash_bin")
            ? {
                type: "place_tool_from_palette",
                payload: {
                  tool_id: item.id,
                  destination_kind: "trash_bin",
                  destination_id: "trash_bin",
                },
              }
            : null,
      },
    },
  };
}

function createPaletteSampleLabelSourceCase(): DndSourceCase {
  return {
    id: "palette-sampling_bag_label",
    label: "palette Sampling label",
    sourceTestId: "toolbar-item-sampling_bag_label",
    openBasket: false,
    openTrash: false,
    expectRackWidget: true,
    availableTargets: [
      "bench-slot-station_1",
      "bench-slot-station_2",
      "analytical-balance-dropzone",
      "gross-balance-dropzone",
      "grinder-dropzone",
      "rack-illustration-slot-1",
      "widget-workspace",
      "trash-dropzone",
    ],
    buildExperiment: () =>
      makeExperiment({
        slots: makeSlots([
          { tool: makeTool(sampleBagItem, { id: "bench_tool_bag", sampleLabelText: "LOT-1" }) },
          { tool: makeTool(sampleBagItem, { id: "bench_tool_bag_2", sampleLabelText: null }) },
        ]),
        workspaceWidgets: makeWorkspaceWidgets([
          {},
          { tool: makeTool(sampleBagItem, { id: "gross_balance_bag", sampleLabelText: null }) },
          { tool: makeTool(sampleVialItem, { id: "analytical_tube" }) },
        ]),
      }),
    targetExpectations: {
      "bench-slot-station_1": {
        compatible: true,
        command: {
          type: "apply_sample_label_to_workbench_tool",
          payload: { slot_id: "station_1" },
        },
      },
      "bench-slot-station_2": {
        compatible: true,
        command: {
          type: "apply_sample_label_to_workbench_tool",
          payload: { slot_id: "station_2" },
        },
      },
      "analytical-balance-dropzone": {
        compatible: true,
        command: {
          type: "apply_sample_label_to_analytical_balance_tool",
          payload: {},
        },
      },
      "gross-balance-dropzone": {
        compatible: true,
        command: {
          type: "apply_sample_label_to_gross_balance_tool",
          payload: {},
        },
      },
      "grinder-dropzone": {
        compatible: false,
        command: null,
      },
      "rack-illustration-slot-1": {
        compatible: false,
        command: null,
      },
      "widget-workspace": {
        compatible: false,
        command: null,
      },
      "trash-dropzone": {
        compatible: true,
        command: {
          type: "discard_sample_label_from_palette",
          payload: {},
        },
      },
    },
  };
}

function createDebugProducePresetSourceCase(): DndSourceCase {
  return {
    id: "debug-palette-apple_powder_residual_co2",
    label: "debug palette apple powder preset",
    sourceTestId: "debug-palette-preset-apple_powder_residual_co2",
    openBasket: false,
    openTrash: false,
    expectRackWidget: true,
    availableTargets: [
      "bench-slot-station_1",
      "bench-slot-station_2",
      "grinder-dropzone",
      "gross-balance-dropzone",
      "rack-illustration-slot-1",
      "widget-workspace",
      "trash-dropzone",
    ],
    buildExperiment: () =>
      makeExperiment({
        slots: makeSlots([{ tool: makeTool(sampleVialItem) }]),
      }),
    targetExpectations: {
      "bench-slot-station_1": {
        compatible: false,
        command: null,
      },
      "bench-slot-station_2": {
        compatible: true,
        command: null,
      },
      "grinder-dropzone": {
        compatible: true,
        command: null,
      },
      "gross-balance-dropzone": {
        compatible: true,
        command: null,
      },
      "rack-illustration-slot-1": {
        compatible: false,
        command: null,
      },
      "widget-workspace": {
        compatible: false,
        command: null,
      },
      "trash-dropzone": {
        compatible: true,
        command: null,
      },
    },
  };
}

function createWorkbenchToolSourceCase(item: ToolCatalogItem): DndSourceCase {
  return {
    id: `workbench-${item.id}`,
    label: `workbench ${item.name}`,
    sourceTestId: "bench-tool-card-bench_tool_1",
    openBasket: false,
    openTrash: false,
    expectRackWidget: true,
    availableTargets: [
      "bench-slot-station_1",
      "bench-slot-station_2",
      "analytical-balance-dropzone",
      "grinder-dropzone",
      "rack-illustration-slot-1",
      "widget-workspace",
      "trash-dropzone",
    ],
    buildExperiment: () =>
      makeExperiment({
        slots: makeSlots([{ tool: makeTool(item) }]),
      }),
    targetExpectations: {
      "bench-slot-station_1": {
        compatible: false,
        command: null,
      },
      "bench-slot-station_2": {
        compatible: true,
        command: {
          type: "move_tool",
          payload: {
            source_kind: "workbench",
            source_id: "station_1",
            destination_kind: "workbench_slot",
            destination_id: "station_2",
          },
        },
      },
      "grinder-dropzone": {
        compatible: false,
        command: null,
      },
      "rack-illustration-slot-1": {
        compatible: item.toolType === "sample_vial",
        command:
          item.toolType === "sample_vial"
            ? {
                type: "move_tool",
                payload: {
                  source_kind: "workbench",
                  source_id: "station_1",
                  destination_kind: "rack_slot",
                  destination_id: "rack_slot_1",
                },
              }
            : null,
      },
      "widget-workspace": {
        compatible: false,
        command: null,
      },
      "trash-dropzone": {
        compatible: getToolDropTargets(item.toolType).includes("trash_bin"),
        command:
          getToolDropTargets(item.toolType).includes("trash_bin")
            ? {
                type: "move_tool",
                payload: {
                  source_kind: "workbench",
                  source_id: "station_1",
                  destination_kind: "trash_bin",
                  destination_id: "trash_bin",
                },
              }
            : null,
      },
    },
  };
}

function createRackSourceCase(): DndSourceCase {
  return {
    id: "rack-sample_vial",
    label: "rack autosampler vial",
    sourceTestId: "rack-illustration-slot-1",
    openBasket: false,
    openTrash: false,
    expectRackWidget: true,
    availableTargets: [
      "bench-slot-station_1",
      "bench-slot-station_2",
      "grinder-dropzone",
      "rack-illustration-slot-1",
      "widget-workspace",
      "trash-dropzone",
    ],
    buildExperiment: () =>
      makeExperiment({
        slots: makeSlots([{ tool: makeTool(sampleVialItem) }]),
        rackSlots: makeRackSlots([{ tool: makeTool(sampleVialItem) }]),
      }),
    targetExpectations: {
      "bench-slot-station_1": {
        compatible: false,
        command: null,
      },
      "bench-slot-station_2": {
        compatible: true,
        command: {
          type: "move_tool",
          payload: {
            source_kind: "rack",
            source_id: "rack_slot_1",
            destination_kind: "workbench_slot",
            destination_id: "station_2",
          },
        },
      },
      "grinder-dropzone": {
        compatible: false,
        command: null,
      },
      "rack-illustration-slot-1": {
        compatible: false,
        command: null,
      },
      "widget-workspace": {
        compatible: false,
        command: null,
      },
      "trash-dropzone": {
        compatible: true,
        command: {
          type: "move_tool",
          payload: {
            source_kind: "rack",
            source_id: "rack_slot_1",
            destination_kind: "trash_bin",
            destination_id: "trash_bin",
          },
        },
      },
    },
  };
}

function createTrashToolSourceCase(item: ToolCatalogItem): DndSourceCase {
  return {
    id: `trash-tool-${item.id}`,
    label: `trash ${item.name}`,
    sourceTestId: "trash-tool-bench_tool_1",
    openBasket: false,
    openTrash: true,
    expectRackWidget: true,
    availableTargets: [
      "bench-slot-station_1",
      "bench-slot-station_2",
      "grinder-dropzone",
      "rack-illustration-slot-1",
      "widget-workspace",
      "trash-dropzone",
    ],
    buildExperiment: () =>
      makeExperiment({
        slots: makeSlots([{ tool: makeTool(sampleVialItem) }]),
        trashTools: [makeTrashToolEntry(item)],
      }),
    targetExpectations: {
      "bench-slot-station_1": {
        compatible: false,
        command: null,
      },
      "bench-slot-station_2": {
        compatible: true,
        command: {
          type: "move_tool",
          payload: {
            source_kind: "trash",
            source_id: "bench_tool_1",
            destination_kind: "workbench_slot",
            destination_id: "station_2",
          },
        },
      },
      "grinder-dropzone": {
        compatible: false,
        command: null,
      },
      "rack-illustration-slot-1": {
        compatible: item.toolType === "sample_vial",
        command:
          item.toolType === "sample_vial"
            ? {
                type: "move_tool",
                payload: {
                  source_kind: "trash",
                  source_id: "bench_tool_1",
                  destination_kind: "rack_slot",
                  destination_id: "rack_slot_1",
                },
              }
            : null,
      },
      "widget-workspace": {
        compatible: false,
        command: null,
      },
      "trash-dropzone": {
        compatible: true,
        command: null,
      },
    },
  };
}

function createTrashWidgetSourceCase(
  widgetId: "rack" | "instrument" | "basket" | "grinder",
  widgetType: WorkspaceWidgetType,
  label: string,
): DndSourceCase {
  const rackIsPresent = widgetId !== "rack";
  const grinderIsPresent = widgetId !== "grinder";

  return {
    id: `trash-widget-${widgetId}`,
    label: `trash ${label}`,
    sourceTestId: `trash-widget-${widgetId}`,
    openBasket: false,
    openTrash: true,
    expectRackWidget: rackIsPresent,
    availableTargets: [
      "bench-slot-station_1",
      "bench-slot-station_2",
      ...(grinderIsPresent ? (["grinder-dropzone"] as const) : []),
      ...(rackIsPresent ? (["rack-illustration-slot-1"] as const) : []),
      "widget-workspace",
      "trash-dropzone",
    ],
    buildExperiment: () =>
      makeExperiment({
        slots: makeSlots([{ tool: makeTool(sampleVialItem) }]),
        workspaceWidgets: makeWorkspaceWidgets([
          {},
          {},
          {},
          {},
          widgetId === "rack"
            ? { isPresent: false, isTrashed: true }
            : { isPresent: true, isTrashed: false },
          widgetId === "instrument"
            ? { isPresent: false, isTrashed: true }
            : {},
          widgetId === "basket"
            ? { isPresent: false, isTrashed: true }
            : {},
          widgetId === "grinder"
            ? { isPresent: false, isTrashed: true }
            : { isPresent: true, isTrashed: false },
        ]),
      }),
    targetExpectations: {
      "bench-slot-station_1": {
        compatible: false,
        command: null,
      },
      "bench-slot-station_2": {
        compatible: false,
        command: null,
      },
      "grinder-dropzone": {
        compatible: false,
        command: null,
      },
      "rack-illustration-slot-1": {
        compatible: false,
        command: null,
      },
      "widget-workspace": {
        compatible: true,
        command: {
          type: "add_workspace_widget",
          payload: expect.objectContaining({ widget_id: widgetId }),
        },
      },
      "trash-dropzone": {
        compatible: false,
        command: null,
      },
    },
  };
}

function createBasketProduceSourceCase(): DndSourceCase {
  return {
    id: "basket-produce-lot-apple",
    label: "basket apple lot",
    sourceTestId: "basket-produce-produce_1",
    openBasket: true,
    openTrash: false,
    expectRackWidget: true,
    availableTargets: [
      "bench-slot-station_1",
      "bench-slot-station_2",
      "grinder-dropzone",
      "rack-illustration-slot-1",
      "widget-workspace",
      "trash-dropzone",
    ],
    buildExperiment: () =>
      makeExperiment({
        slots: makeSlots([
          { tool: makeTool(sampleBagItem, { id: "bench_tool_bag" }) },
        ]),
        produceBasketLots: [makeProduceLot({ id: "produce_1" })],
        workspaceWidgets: makeWorkspaceWidgets(),
      }),
    targetExpectations: {
      "bench-slot-station_1": {
        compatible: true,
        command: {
          type: "add_produce_lot_to_workbench_tool",
          payload: {
            slot_id: "station_1",
            produce_lot_id: "produce_1",
          },
        },
      },
      "bench-slot-station_2": {
        compatible: true,
        command: {
          type: "add_produce_lot_to_workbench_tool",
          payload: {
            slot_id: "station_2",
            produce_lot_id: "produce_1",
          },
        },
      },
      "grinder-dropzone": {
        compatible: true,
        command: {
          type: "add_workspace_produce_lot_to_widget",
          payload: {
            widget_id: "grinder",
            produce_lot_id: "produce_1",
          },
        },
      },
      "rack-illustration-slot-1": {
        compatible: false,
        command: null,
      },
      "widget-workspace": {
        compatible: false,
        command: null,
      },
      "trash-dropzone": {
        compatible: true,
        command: {
          type: "discard_workspace_produce_lot",
          payload: {
            produce_lot_id: "produce_1",
          },
        },
      },
    },
  };
}

function createBasketReceivedBagSourceCase(): DndSourceCase {
  return {
    id: "basket-received-bag",
    label: "basket received sampling bag",
    sourceTestId: "basket-received-bag",
    openBasket: true,
    openTrash: false,
    expectRackWidget: true,
    availableTargets: [
      "bench-slot-station_1",
      "bench-slot-station_2",
      "grinder-dropzone",
      "rack-illustration-slot-1",
      "widget-workspace",
      "trash-dropzone",
    ],
    buildExperiment: () =>
      makeExperiment({
        basketTools: [makeTool(sampleBagItem, {
          id: "basket_bag_1",
          sampleLabelText: null,
        })],
        slots: makeSlots([{ tool: makeTool(sampleVialItem) }]),
      }),
    targetExpectations: {
      "bench-slot-station_1": { compatible: false, command: null },
      "bench-slot-station_2": {
        compatible: true,
        command: {
          type: "move_tool",
          payload: {
            source_kind: "basket",
            source_id: "basket_bag_1",
            destination_kind: "workbench_slot",
            destination_id: "station_2",
          },
        },
      },
      "grinder-dropzone": { compatible: false, command: null },
      "rack-illustration-slot-1": { compatible: false, command: null },
      "widget-workspace": { compatible: false, command: null },
      "trash-dropzone": {
        compatible: true,
        command: {
          type: "move_tool",
          payload: {
            source_kind: "basket",
            source_id: "basket_bag_1",
            destination_kind: "trash_bin",
            destination_id: "trash_bin",
          },
        },
      },
    },
  };
}

function createWorkbenchProduceLotSourceCase(): DndSourceCase {
  return {
    id: "workbench-produce-lot-apple",
    label: "workbench apple lot",
    sourceTestId: "bench-produce-lot-produce_1",
    openBasket: false,
    openTrash: false,
    expectRackWidget: true,
    availableTargets: [
      "bench-slot-station_1",
      "bench-slot-station_2",
      "grinder-dropzone",
      "rack-illustration-slot-1",
      "widget-workspace",
      "trash-dropzone",
    ],
    buildExperiment: () =>
      makeExperiment({
        slots: makeSlots([
          {
            tool: makeTool(sampleBagItem, {
              id: "bench_tool_bag",
              produceLots: [makeProduceLot({ id: "produce_1" })],
              containment: {
                accepts: [{ entityKind: "sample_label" }, { entityKind: "lims_label_ticket" }],
                blockedReason: null,
                canReceive: true,
                capacity: 3,
                children: [{ entityKind: "produce", id: "produce_1", produceType: "apple" }],
                remainingCapacity: 2,
              },
            }),
          },
          { tool: makeTool(sampleBagItem, { id: "bench_tool_bag_2" }) },
        ]),
      }),
    targetExpectations: {
      "bench-slot-station_1": {
        compatible: false,
        command: null,
      },
      "bench-slot-station_2": {
        compatible: true,
        command: {
          type: "move_produce_lot_between_workbench_tools",
          payload: {
            source_slot_id: "station_1",
            target_slot_id: "station_2",
            produce_lot_id: "produce_1",
          },
        },
      },
      "grinder-dropzone": {
        compatible: true,
        command: {
          type: "move_workbench_produce_lot_to_widget",
          payload: {
            source_slot_id: "station_1",
            widget_id: "grinder",
            produce_lot_id: "produce_1",
          },
        },
      },
      "rack-illustration-slot-1": {
        compatible: false,
        command: null,
      },
      "widget-workspace": {
        compatible: false,
        command: null,
      },
      "trash-dropzone": {
        compatible: true,
        command: {
          type: "discard_produce_lot_from_workbench_tool",
          payload: {
            slot_id: "station_1",
            produce_lot_id: "produce_1",
          },
        },
      },
    },
  };
}

function createWorkbenchSurfaceProduceLotSourceCase(): DndSourceCase {
  return {
    id: "workbench-surface-produce-lot-apple",
    label: "workbench surface apple lot",
    sourceTestId: "bench-surface-produce-lot-produce_1",
    openBasket: false,
    openTrash: false,
    expectRackWidget: true,
    availableTargets: [
      "bench-slot-station_1",
      "bench-slot-station_2",
      "grinder-dropzone",
      "rack-illustration-slot-1",
      "widget-workspace",
      "trash-dropzone",
    ],
    buildExperiment: () =>
      makeExperiment({
        slots: makeSlots([
          {
            surfaceProduceLots: [makeProduceLot({ id: "produce_1", isContaminated: true })],
          },
          { tool: makeTool(sampleBagItem, { id: "bench_tool_bag_2" }) },
        ]),
      }),
    targetExpectations: {
      "bench-slot-station_1": {
        compatible: false,
        command: null,
      },
      "bench-slot-station_2": {
        compatible: true,
        command: {
          type: "move_produce_lot_between_workbench_tools",
          payload: {
            source_slot_id: "station_1",
            target_slot_id: "station_2",
            produce_lot_id: "produce_1",
          },
        },
      },
      "grinder-dropzone": {
        compatible: true,
        command: {
          type: "move_workbench_produce_lot_to_widget",
          payload: {
            source_slot_id: "station_1",
            widget_id: "grinder",
            produce_lot_id: "produce_1",
          },
        },
      },
      "rack-illustration-slot-1": {
        compatible: false,
        command: null,
      },
      "widget-workspace": {
        compatible: false,
        command: null,
      },
      "trash-dropzone": {
        compatible: true,
        command: {
          type: "discard_produce_lot_from_workbench_tool",
          payload: {
            slot_id: "station_1",
            produce_lot_id: "produce_1",
          },
        },
      },
    },
  };
}

function createGrinderProduceLotSourceCase(): DndSourceCase {
  return {
    id: "grinder-produce-lot-apple",
    label: "grinder apple lot",
    sourceTestId: "grinder-produce-produce_1",
    openBasket: false,
    openTrash: false,
    expectRackWidget: true,
    availableTargets: [
      "bench-slot-station_1",
      "bench-slot-station_2",
      "grinder-dropzone",
      "rack-illustration-slot-1",
      "widget-workspace",
      "trash-dropzone",
    ],
    buildExperiment: () =>
      makeExperiment({
        slots: makeSlots([{ tool: makeTool(sampleBagItem, { id: "bench_tool_bag" }) }]),
        workspaceWidgets: makeWorkspaceWidgets([
          {},
          {},
          {},
          {},
          {},
          {},
          {},
          {
            isPresent: true,
            produceLots: [makeProduceLot({ id: "produce_1" })],
          },
        ]),
      }),
    targetExpectations: {
      "bench-slot-station_1": {
        compatible: true,
        command: {
          type: "move_widget_produce_lot_to_workbench_tool",
          payload: {
            widget_id: "grinder",
            target_slot_id: "station_1",
            produce_lot_id: "produce_1",
          },
        },
      },
      "bench-slot-station_2": {
        compatible: true,
        command: {
          type: "move_widget_produce_lot_to_workbench_tool",
          payload: {
            widget_id: "grinder",
            target_slot_id: "station_2",
            produce_lot_id: "produce_1",
          },
        },
      },
      "grinder-dropzone": {
        compatible: true,
        command: null,
      },
      "rack-illustration-slot-1": {
        compatible: false,
        command: null,
      },
      "widget-workspace": {
        compatible: false,
        command: null,
      },
      "trash-dropzone": {
        compatible: true,
        command: {
          type: "discard_widget_produce_lot",
          payload: {
            widget_id: "grinder",
            produce_lot_id: "produce_1",
          },
        },
      },
    },
  };
}

function createGrinderLiquidSourceCase(): DndSourceCase {
  return {
    id: "grinder-liquid-dry-ice",
    label: "grinder dry ice pellets",
    sourceTestId: "grinder-liquid-workspace_liquid_1",
    openBasket: false,
    openTrash: false,
    expectRackWidget: true,
    availableTargets: [
      "bench-slot-station_1",
      "bench-slot-station_2",
      "grinder-dropzone",
      "rack-illustration-slot-1",
      "widget-workspace",
      "trash-dropzone",
    ],
    buildExperiment: () =>
      makeExperiment({
        workspaceWidgets: makeWorkspaceWidgets([
          {},
          {},
          {},
          {},
          {},
          {},
          {},
          {
            isPresent: true,
            liquids: [
              {
                id: "workspace_liquid_1",
                liquidId: "dry_ice_pellets",
                name: "Dry ice pellets",
                volume_ml: 1000,
                accent: "sky",
              },
            ],
          },
        ]),
      }),
    targetExpectations: {
      "bench-slot-station_1": { compatible: false, command: null },
      "bench-slot-station_2": { compatible: false, command: null },
      "grinder-dropzone": { compatible: false, command: null },
      "rack-illustration-slot-1": { compatible: false, command: null },
      "widget-workspace": { compatible: false, command: null },
      "trash-dropzone": {
        compatible: true,
        command: {
          type: "remove_liquid_from_workspace_widget",
          payload: {
            widget_id: "grinder",
            liquid_entry_id: "workspace_liquid_1",
          },
        },
      },
    },
  };
}

function createTrashProduceLotSourceCase(): DndSourceCase {
  return {
    id: "trash-produce-lot-apple",
    label: "trash apple lot",
    sourceTestId: "trash-produce-lot-trash_produce_lot_1",
    openBasket: false,
    openTrash: true,
    expectRackWidget: true,
    availableTargets: [
      "bench-slot-station_1",
      "bench-slot-station_2",
      "grinder-dropzone",
      "rack-illustration-slot-1",
      "widget-workspace",
      "trash-dropzone",
    ],
    buildExperiment: () =>
      makeExperiment({
        slots: makeSlots([{ tool: makeTool(sampleBagItem, { id: "bench_tool_bag" }) }]),
        trashProduceLots: [makeTrashProduceLotEntry()],
      }),
    targetExpectations: {
      "bench-slot-station_1": {
        compatible: true,
        command: {
          type: "restore_trashed_produce_lot_to_workbench_tool",
          payload: {
            target_slot_id: "station_1",
            trash_produce_lot_id: "trash_produce_lot_1",
          },
        },
      },
      "bench-slot-station_2": {
        compatible: true,
        command: {
          type: "restore_trashed_produce_lot_to_workbench_tool",
          payload: {
            target_slot_id: "station_2",
            trash_produce_lot_id: "trash_produce_lot_1",
          },
        },
      },
      "grinder-dropzone": {
        compatible: true,
        command: {
          type: "restore_trashed_produce_lot_to_widget",
          payload: {
            widget_id: "grinder",
            trash_produce_lot_id: "trash_produce_lot_1",
          },
        },
      },
      "rack-illustration-slot-1": {
        compatible: false,
        command: null,
      },
      "widget-workspace": {
        compatible: false,
        command: null,
      },
      "trash-dropzone": {
        compatible: true,
        command: null,
      },
    },
  };
}

function createWorkbenchSampleLabelSourceCase(): DndSourceCase {
  return {
    id: "workbench-sample-label",
    label: "workbench sample label",
    sourceTestId: "sample-label-card-bench_tool_bag",
    openBasket: false,
    openTrash: false,
    expectRackWidget: true,
    availableTargets: [
      "bench-slot-station_1",
      "bench-slot-station_2",
      "analytical-balance-dropzone",
      "gross-balance-dropzone",
      "grinder-dropzone",
      "rack-illustration-slot-1",
      "widget-workspace",
      "trash-dropzone",
    ],
    buildExperiment: () =>
      makeExperiment({
        slots: makeSlots([
          { tool: makeTool(sampleBagItem, { id: "bench_tool_bag", sampleLabelText: "LOT-2026-041" }) },
          { tool: makeTool(sampleBagItem, { id: "bench_tool_bag_2", sampleLabelText: null }) },
        ]),
        workspaceWidgets: makeWorkspaceWidgets([
          {},
          { tool: makeTool(sampleBagItem, { id: "gross_balance_bag", sampleLabelText: null }) },
          { tool: makeTool(sampleVialItem, { id: "analytical_tube" }) },
        ]),
      }),
    targetExpectations: {
      "bench-slot-station_1": { compatible: true, command: null },
      "bench-slot-station_2": {
        compatible: true,
        command: {
          type: "move_sample_label_between_workbench_tools",
          payload: {
            label_id: "bench_tool_bag-sample-label",
            source_slot_id: "station_1",
            target_slot_id: "station_2",
          },
        },
      },
      "analytical-balance-dropzone": {
        compatible: true,
        command: {
          type: "move_workbench_sample_label_to_analytical_balance",
          payload: {
            label_id: "bench_tool_bag-sample-label",
            source_slot_id: "station_1",
          },
        },
      },
      "gross-balance-dropzone": {
        compatible: true,
        command: {
          type: "move_workbench_sample_label_to_gross_balance",
          payload: {
            label_id: "bench_tool_bag-sample-label",
            source_slot_id: "station_1",
          },
        },
      },
      "grinder-dropzone": {
        compatible: false,
        command: null,
      },
      "rack-illustration-slot-1": { compatible: false, command: null },
      "widget-workspace": { compatible: false, command: null },
      "trash-dropzone": {
        compatible: true,
        command: {
          type: "discard_sample_label_from_workbench_tool",
          payload: {
            label_id: "bench_tool_bag-sample-label",
            slot_id: "station_1",
          },
        },
      },
    },
  };
}

function createTrashSampleLabelSourceCase(): DndSourceCase {
  return {
    id: "trash-sample-label",
    label: "trash sample label",
    sourceTestId: "trash-sample-label-trash_sample_label_1",
    openBasket: false,
    openTrash: true,
    expectRackWidget: true,
    availableTargets: [
      "bench-slot-station_1",
      "bench-slot-station_2",
      "analytical-balance-dropzone",
      "gross-balance-dropzone",
      "grinder-dropzone",
      "rack-illustration-slot-1",
      "widget-workspace",
      "trash-dropzone",
    ],
    buildExperiment: () =>
      makeExperiment({
        slots: makeSlots([
          { tool: makeTool(sampleBagItem, { id: "bench_tool_bag", sampleLabelText: null }) },
          { tool: makeTool(sampleBagItem, { id: "bench_tool_bag_2", sampleLabelText: "LOT-1" }) },
        ]),
        trashSampleLabels: [makeTrashSampleLabelEntry()],
        workspaceWidgets: makeWorkspaceWidgets([
          {},
          { tool: makeTool(sampleBagItem, { id: "gross_balance_bag", sampleLabelText: null }) },
          { tool: makeTool(sampleVialItem, { id: "analytical_tube" }) },
        ]),
      }),
    targetExpectations: {
      "bench-slot-station_1": {
        compatible: true,
        command: {
          type: "restore_trashed_sample_label_to_workbench_tool",
          payload: {
            target_slot_id: "station_1",
            trash_sample_label_id: "trash_sample_label_1",
          },
        },
      },
      "grinder-dropzone": { compatible: false, command: null },
      "bench-slot-station_2": {
        compatible: true,
        command: {
          type: "restore_trashed_sample_label_to_workbench_tool",
          payload: {
            target_slot_id: "station_2",
            trash_sample_label_id: "trash_sample_label_1",
          },
        },
      },
      "analytical-balance-dropzone": {
        compatible: true,
        command: {
          type: "restore_trashed_sample_label_to_analytical_balance",
          payload: {
            trash_sample_label_id: "trash_sample_label_1",
          },
        },
      },
      "gross-balance-dropzone": {
        compatible: true,
        command: {
          type: "restore_trashed_sample_label_to_gross_balance",
          payload: {
            trash_sample_label_id: "trash_sample_label_1",
          },
        },
      },
      "rack-illustration-slot-1": { compatible: false, command: null },
      "widget-workspace": { compatible: false, command: null },
      "trash-dropzone": { compatible: true, command: null },
    },
  };
}

function createLimsPrintedTicketSourceCase(): DndSourceCase {
  const analyticalTube = makeTool(sampleVialItem, {
    id: "analytical_tube_1",
    label: "50 mL centrifuge tube",
    subtitle: "Tube on balance",
    toolId: "centrifuge_tube_50ml",
    toolType: "centrifuge_tube",
    capacity_ml: 50,
    sampleLabelText: null,
  });

  return {
    id: "lims-printed-ticket",
    label: "LIMS printed ticket",
    sourceTestId: "lims-printed-ticket",
    openBasket: false,
    openTrash: false,
    expectRackWidget: true,
    availableTargets: [
      "bench-slot-station_1",
      "bench-slot-station_2",
      "analytical-balance-dropzone",
      "gross-balance-dropzone",
      "grinder-dropzone",
      "rack-illustration-slot-1",
      "widget-workspace",
      "trash-dropzone",
    ],
    buildExperiment: () =>
      makeExperiment({
        slots: makeSlots([
          { tool: makeTool(sampleBagItem, { id: "bench_tool_bag", sampleLabelText: null }) },
          { tool: makeTool(sampleBagItem, { id: "bench_tool_bag_2", sampleLabelText: "LOT-1" }) },
        ]),
        workspaceWidgets: makeWorkspaceWidgets([
          {},
          { tool: makeTool(sampleBagItem, { id: "gross_balance_bag", sampleLabelText: null }) },
          { tool: analyticalTube },
        ]),
        limsReception: makeLimsReception({
          orchardName: "Martin Orchard",
          harvestDate: "2026-03-29",
          indicativeMassG: 2500,
          measuredGrossMassG: null,
          labSampleCode: "APP-2026-0001",
          status: "awaiting_label_application",
          printedLabelTicket: makePrintedLimsTicket(),
        }),
      }),
    targetExpectations: {
      "bench-slot-station_1": {
        compatible: true,
        command: {
          type: "apply_printed_lims_label",
          payload: {
            slot_id: "station_1",
          },
        },
      },
      "bench-slot-station_2": {
        compatible: true,
        command: {
          type: "apply_printed_lims_label",
          payload: {
            slot_id: "station_2",
          },
        },
      },
      "analytical-balance-dropzone": {
        compatible: true,
        command: {
          type: "apply_printed_lims_label_to_analytical_balance_tool",
          payload: {},
        },
      },
      "grinder-dropzone": { compatible: false, command: null },
      "rack-illustration-slot-1": { compatible: false, command: null },
      "widget-workspace": { compatible: false, command: null },
      "trash-dropzone": {
        compatible: true,
        command: {
          type: "discard_printed_lims_label",
          payload: {},
        },
      },
      "gross-balance-dropzone": {
        compatible: true,
        command: {
          type: "apply_printed_lims_label_to_gross_balance_bag",
          payload: {},
        },
      },
    },
  };
}

function createGrossBalanceToolSourceCase(): DndSourceCase {
  return {
    id: "gross-balance-sample-vial",
    label: "gross balance autosampler vial",
    sourceTestId: "bench-tool-card-balance-bench_tool_1",
    openBasket: false,
    openTrash: false,
    expectRackWidget: true,
    availableTargets: [
      "bench-slot-station_1",
      "bench-slot-station_2",
      "grinder-dropzone",
      "gross-balance-dropzone",
      "analytical-balance-dropzone",
      "rack-illustration-slot-1",
      "widget-workspace",
      "trash-dropzone",
    ],
    buildExperiment: () =>
      makeExperiment({
        slots: makeSlots([{ tool: makeTool(sampleVialItem) }]),
        workspaceWidgets: makeWorkspaceWidgets([
          {},
          { isPresent: true, tool: makeTool(sampleVialItem) },
          {},
          {},
          {},
          {},
          {},
          {},
        ]),
      }),
    targetExpectations: {
      "bench-slot-station_1": { compatible: false, command: null },
      "bench-slot-station_2": {
        compatible: true,
        command: {
          type: "move_tool",
          payload: {
            source_kind: "gross_balance",
            source_id: "gross_balance",
            destination_kind: "workbench_slot",
            destination_id: "station_2",
          },
        },
      },
      "grinder-dropzone": { compatible: false, command: null },
      "gross-balance-dropzone": { compatible: true, command: null },
      "rack-illustration-slot-1": {
        compatible: true,
        command: {
          type: "move_tool",
          payload: {
            source_kind: "gross_balance",
            source_id: "gross_balance",
            destination_kind: "rack_slot",
            destination_id: "rack_slot_1",
          },
        },
      },
      "widget-workspace": { compatible: false, command: null },
      "trash-dropzone": {
        compatible: true,
        command: {
          type: "move_tool",
          payload: {
            source_kind: "gross_balance",
            source_id: "gross_balance",
            destination_kind: "trash_bin",
            destination_id: "trash_bin",
          },
        },
      },
    },
  };
}

function createGrossBalanceProduceSourceCase(): DndSourceCase {
  return {
    id: "gross-balance-produce-lot-apple",
    label: "gross balance apple lot",
    sourceTestId: "gross-balance-produce-produce_1",
    openBasket: false,
    openTrash: false,
    expectRackWidget: true,
    availableTargets: [
      "bench-slot-station_1",
      "bench-slot-station_2",
      "grinder-dropzone",
      "gross-balance-dropzone",
      "rack-illustration-slot-1",
      "widget-workspace",
      "trash-dropzone",
    ],
    buildExperiment: () =>
      makeExperiment({
        slots: makeSlots([{ tool: makeTool(sampleBagItem, { id: "bench_tool_bag" }) }]),
        workspaceWidgets: makeWorkspaceWidgets([
          {},
          {
            isPresent: true,
            produceLots: [makeProduceLot({ id: "produce_1" })],
          },
          {},
          {},
          {},
          {},
          {},
          {},
        ]),
      }),
    targetExpectations: {
      "bench-slot-station_1": {
        compatible: true,
        command: {
          type: "move_gross_balance_produce_lot_to_workbench",
          payload: {
            produce_lot_id: "produce_1",
            target_slot_id: "station_1",
          },
        },
      },
      "bench-slot-station_2": {
        compatible: true,
        command: {
          type: "move_gross_balance_produce_lot_to_workbench",
          payload: {
            produce_lot_id: "produce_1",
            target_slot_id: "station_2",
          },
        },
      },
      "grinder-dropzone": {
        compatible: true,
        command: {
          type: "move_gross_balance_produce_lot_to_widget",
          payload: { produce_lot_id: "produce_1" },
        },
      },
      "gross-balance-dropzone": { compatible: true, command: null },
      "rack-illustration-slot-1": { compatible: false, command: null },
      "widget-workspace": { compatible: false, command: null },
      "trash-dropzone": {
        compatible: true,
        command: {
          type: "discard_gross_balance_produce_lot",
          payload: { produce_lot_id: "produce_1" },
        },
      },
    },
  };
}

const baseDndSourceCases: DndSourceCase[] = [
  ...paletteItems.map(createPaletteSourceCase),
  createPaletteSampleLabelSourceCase(),
  createDebugProducePresetSourceCase(),
  ...toolItems.map(createWorkbenchToolSourceCase),
  createBasketReceivedBagSourceCase(),
  createBasketProduceSourceCase(),
  createWorkbenchProduceLotSourceCase(),
  createWorkbenchSurfaceProduceLotSourceCase(),
  createGrinderProduceLotSourceCase(),
  createGrinderLiquidSourceCase(),
  createWorkbenchSampleLabelSourceCase(),
  createLimsPrintedTicketSourceCase(),
  createGrossBalanceToolSourceCase(),
  createGrossBalanceProduceSourceCase(),
  createTrashProduceLotSourceCase(),
  createTrashSampleLabelSourceCase(),
  createRackSourceCase(),
  ...trashableToolItems.map(createTrashToolSourceCase),
  createTrashWidgetSourceCase("rack", "autosampler_rack", "Autosampler rack"),
  createTrashWidgetSourceCase("instrument", "lc_msms_instrument", "LC-MS/MS"),
  createTrashWidgetSourceCase("grinder", "cryogenic_grinder", "Cryogenic grinder"),
];

function getGrossBalanceTargetExpectation(sourceCase: DndSourceCase) {
  if (!grossBalanceCompatibleSourceIds.has(sourceCase.id)) {
    return {
      compatible: false,
      command: null,
    };
  }

  if (sourceCase.id.startsWith("palette-")) {
    const toolId = sourceCase.id.replace("palette-", "");
    return {
      compatible: true,
      command: {
        type: "place_tool_from_palette",
        payload: {
          tool_id: toolId,
          destination_kind: "gross_balance",
          destination_id: "gross_balance",
        },
      },
    };
  }

  if (
    sourceCase.id === "workbench-produce-lot-apple" ||
    sourceCase.id === "workbench-surface-produce-lot-apple"
  ) {
    return {
      compatible: true,
      command: {
        type: "move_workbench_produce_lot_to_gross_balance",
        payload: {
          source_slot_id: "station_1",
          produce_lot_id: "produce_1",
        },
      },
    };
  }

  if (sourceCase.id.startsWith("workbench-")) {
    return {
      compatible: true,
      command: {
        type: "move_tool",
        payload: {
          source_kind: "workbench",
          source_id: "station_1",
          destination_kind: "gross_balance",
          destination_id: "gross_balance",
        },
      },
    };
  }

  if (sourceCase.id.startsWith("trash-tool-")) {
    return {
      compatible: true,
      command: {
        type: "move_tool",
        payload: {
          source_kind: "trash",
          source_id: "bench_tool_1",
          destination_kind: "gross_balance",
          destination_id: "gross_balance",
        },
      },
    };
  }

  if (sourceCase.id === "basket-received-bag") {
    return {
      compatible: true,
      command: {
        type: "move_tool",
        payload: {
          source_kind: "basket",
          source_id: "basket_bag_1",
          destination_kind: "gross_balance",
          destination_id: "gross_balance",
        },
      },
    };
  }

  if (sourceCase.id === "basket-produce-lot-apple") {
    return {
      compatible: true,
      command: {
        type: "move_workspace_produce_lot_to_gross_balance",
        payload: {
          produce_lot_id: "produce_1",
        },
      },
    };
  }

  if (sourceCase.id === "grinder-produce-lot-apple") {
    return {
      compatible: true,
      command: {
        type: "move_widget_produce_lot_to_gross_balance",
        payload: {
          produce_lot_id: "produce_1",
        },
      },
    };
  }

  if (sourceCase.id === "trash-produce-lot-apple") {
    return {
      compatible: true,
      command: {
        type: "restore_trashed_produce_lot_to_gross_balance",
        payload: {
          trash_produce_lot_id: "trash_produce_lot_1",
        },
      },
    };
  }

  if (sourceCase.id === "rack-sample_vial") {
    return {
      compatible: true,
      command: {
        type: "move_tool",
        payload: {
          source_kind: "rack",
          source_id: "rack_slot_1",
          destination_kind: "gross_balance",
          destination_id: "gross_balance",
        },
      },
    };
  }

  if (sourceCase.id === "palette-sampling_bag_label") {
    return {
      compatible: true,
      command: {
        type: "apply_sample_label_to_gross_balance_tool",
        payload: {},
      },
    };
  }

  if (sourceCase.id === "workbench-sample-label") {
    return {
      compatible: true,
      command: {
        type: "move_workbench_sample_label_to_gross_balance",
        payload: {
          label_id: "bench_tool_bag-sample-label",
          source_slot_id: "station_1",
        },
      },
    };
  }

  if (sourceCase.id === "trash-sample-label") {
    return {
      compatible: true,
      command: {
        type: "restore_trashed_sample_label_to_gross_balance",
        payload: {
          trash_sample_label_id: "trash_sample_label_1",
        },
      },
    };
  }

  if (sourceCase.id === "lims-printed-ticket") {
    return {
      compatible: true,
      command: {
        type: "apply_printed_lims_label_to_gross_balance_bag",
        payload: {},
      },
    };
  }

  return {
    compatible: false,
    command: null,
  };
}

function getAnalyticalBalanceTargetExpectation(sourceCase: DndSourceCase) {
  if (analyticalBalanceDraftSourceIds.has(sourceCase.id)) {
    return { compatible: true, command: null };
  }

  if (!analyticalBalanceCompatibleSourceIds.has(sourceCase.id)) {
    return { compatible: false, command: null };
  }

  if (sourceCase.id.startsWith("palette-")) {
    const toolId = sourceCase.id.replace("palette-", "");
    return {
      compatible: true,
      command: {
        type: "place_tool_from_palette",
        payload: { tool_id: toolId, destination_kind: "analytical_balance", destination_id: "analytical_balance" },
      },
    };
  }

  if (sourceCase.id.startsWith("workbench-")) {
    return {
      compatible: true,
      command: {
        type: "move_tool",
        payload: { source_kind: "workbench", source_id: "station_1", destination_kind: "analytical_balance", destination_id: "analytical_balance" },
      },
    };
  }

  if (sourceCase.id.startsWith("trash-tool-")) {
    return {
      compatible: true,
      command: {
        type: "move_tool",
        payload: { source_kind: "trash", source_id: "bench_tool_1", destination_kind: "analytical_balance", destination_id: "analytical_balance" },
      },
    };
  }

  if (sourceCase.id === "rack-sample_vial") {
    return {
      compatible: true,
      command: {
        type: "move_tool",
        payload: { source_kind: "rack", source_id: "rack_slot_1", destination_kind: "analytical_balance", destination_id: "analytical_balance" },
      },
    };
  }

  if (sourceCase.id === "gross-balance-sample-vial") {
    return {
      compatible: true,
      command: {
        type: "move_tool",
        payload: { source_kind: "gross_balance", source_id: "gross_balance", destination_kind: "analytical_balance", destination_id: "analytical_balance" },
      },
    };
  }

  return { compatible: false, command: null };
}

const vortexCompatibleToolTypes = new Set(["centrifuge_tube", "cleanup_tube"]);

function getVortexTargetExpectation(sourceCase: DndSourceCase): { compatible: boolean; command: null | { type: string; payload: unknown } } {
  if (sourceCase.id.startsWith("palette-")) {
    const toolId = sourceCase.id.replace("palette-", "");
    const item = toolItems.find((t) => t.id === toolId);
    if (item && vortexCompatibleToolTypes.has(item.toolType)) {
      return {
        compatible: true,
        command: {
          type: "place_tool_from_palette",
          payload: { tool_id: toolId, destination_kind: "vortex", destination_id: "vortex" },
        },
      };
    }
    return { compatible: false, command: null };
  }

  if (sourceCase.id.startsWith("workbench-")) {
    const toolId = sourceCase.id.replace("workbench-", "");
    const item = toolItems.find((t) => t.id === toolId);
    if (item && vortexCompatibleToolTypes.has(item.toolType)) {
      return {
        compatible: true,
        command: {
          type: "move_tool",
          payload: { source_kind: "workbench", source_id: "station_1", destination_kind: "vortex", destination_id: "vortex" },
        },
      };
    }
    return { compatible: false, command: null };
  }

  if (sourceCase.id.startsWith("trash-tool-")) {
    const toolId = sourceCase.id.replace("trash-tool-", "");
    const item = toolItems.find((t) => t.id === toolId);
    if (item && vortexCompatibleToolTypes.has(item.toolType)) {
      return {
        compatible: true,
        command: {
          type: "move_tool",
          payload: { source_kind: "trash", source_id: "bench_tool_1", destination_kind: "vortex", destination_id: "vortex" },
        },
      };
    }
    return { compatible: false, command: null };
  }

  if (sourceCase.id === "rack-sample_vial") {
    return { compatible: false, command: null };
  }

  return { compatible: false, command: null };
}

export const dndSourceCases: DndSourceCase[] = baseDndSourceCases.map((sourceCase) => ({
  ...sourceCase,
  availableTargets: [
    ...(sourceCase.availableTargets.includes("gross-balance-dropzone")
      ? sourceCase.availableTargets
      : [...sourceCase.availableTargets, "gross-balance-dropzone"]),
    "analytical-balance-dropzone",
    "vortex-dropzone",
  ],
  targetExpectations: {
    ...sourceCase.targetExpectations,
    "gross-balance-dropzone":
      sourceCase.targetExpectations["gross-balance-dropzone"] ??
      getGrossBalanceTargetExpectation(sourceCase),
    "analytical-balance-dropzone":
      sourceCase.targetExpectations["analytical-balance-dropzone"] ??
      getAnalyticalBalanceTargetExpectation(sourceCase),
    "vortex-dropzone":
      sourceCase.targetExpectations["vortex-dropzone"] ??
      getVortexTargetExpectation(sourceCase),
  },
}));

export function buildDndCoverageExperiment(scenario: DndCoverageScenario): Experiment {
  if (scenario === "surface-and-balance-produce") {
    return makeExperiment({
      slots: makeSlots([
        {
          tool: makeTool(sampleVialItem),
        },
        {
          surfaceProduceLots: [
            makeProduceLot({ id: "produce_1", isContaminated: true, label: "Apple powder 1", totalMassG: 10, materialState: "ground", unitCount: null }),
          ],
        },
      ]),
      workspaceWidgets: makeWorkspaceWidgets([
        {},
        {
          isPresent: true,
          produceLots: [
            makeProduceLot({ id: "produce_1", label: "Apple powder 2", totalMassG: 12, materialState: "ground", unitCount: null }),
          ],
        },
        {},
        {},
        {},
        {},
        {},
        {},
      ]),
    });
  }

  return makeExperiment({
    basketTools: [makeTool(sampleBagItem, {
      id: "basket_bag_1",
    })],
    slots: makeSlots([
      {
        tool: makeTool(sampleVialItem, {
          id: "bench_tool_1",
        }),
      },
      {
        tool: makeTool(sampleBagItem, {
          id: "bench_tool_bag",
          labels: [
            {
              id: "bench_tool_bag-sample-label",
              labelKind: "manual",
              text: "LOT-2026-041",
              receivedDate: null,
              sampleCode: null,
            },
          ],
          produceLots: [
            makeProduceLot({ id: "produce_1" }),
          ],
        }),
      },
    ]),
    rackSlots: makeRackSlots([
      { tool: makeTool(sampleVialItem) },
    ]),
    trashProduceLots: [makeTrashProduceLotEntry()],
    trashSampleLabels: [makeTrashSampleLabelEntry()],
    trashTools: [makeTrashToolEntry(sampleVialItem)],
    produceBasketLots: [makeProduceLot({ id: "produce_1" })],
    workspaceWidgets: makeWorkspaceWidgets([
      {},
      { isPresent: true, tool: makeTool(sampleVialItem) },
      {},
      {},
      {},
      { isPresent: false, isTrashed: true },
      {},
      {
        isPresent: true,
        liquids: [
          {
            id: "workspace_liquid_1",
            liquidId: "dry_ice_pellets",
            name: "Dry ice pellets",
            volume_ml: 1000,
            accent: "sky",
          },
        ],
        produceLots: [
          makeProduceLot({ id: "produce_1", label: "Apple powder 1", materialState: "ground" }),
        ],
      },
    ]),
    limsReception: makeLimsReception({
      orchardName: "Martin Orchard",
      harvestDate: "2026-03-29",
      indicativeMassG: 2500,
      measuredGrossMassG: null,
      labSampleCode: "APP-2026-0001",
      status: "awaiting_label_application",
      printedLabelTicket: makePrintedLimsTicket(),
    }),
  });
}
