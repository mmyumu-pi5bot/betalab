import type { Page, Route } from "@playwright/test";

import { getToolDropTargets } from "../../src/test-support/drop-targets";
import type { Experiment, ExperimentListEntry } from "../../src/types/experiment";
import type {
  BenchSlot,
  BenchToolInstance,
  ExperimentProduceLot,
  ExperimentWorkspaceWidget,
  RackSlot,
  TrashToolEntry,
  ToolType,
} from "../../src/types/workbench";

type CommandRecord = {
  payload: Record<string, unknown>;
  type: string;
};

type MockWorkbenchApi = {
  commands: CommandRecord[];
};

type MockWorkbenchApiOptions = {
  savedExperiments?: ExperimentListEntry[];
};

const defaultAuditLog = [
  "Experiment created",
  "Start by dragging an extraction tool onto the bench.",
];

function makeEmptyBenchSlotContainment() {
  return {
    accepts: [
      { entityKind: "tool" as const },
      { entityKind: "produce" as const },
    ],
    blockedReason: null,
    canReceive: true,
    capacity: 1,
    children: [],
    remainingCapacity: 1,
  };
}

function makeSlots(count = 2): BenchSlot[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `station_${index + 1}`,
    label: `Station ${index + 1}`,
    containment: makeEmptyBenchSlotContainment(),
    dropTargetTypes: ["workbench_slot"] as DropTargetType[],
    tool: null,
  }));
}

function makeRackSlots(): RackSlot[] {
  return Array.from({ length: 12 }, (_, index) => ({
    id: `rack_slot_${index + 1}`,
    label: `Position ${index + 1}`,
    tool: null,
  }));
}

function makeWorkspaceWidgets(): ExperimentWorkspaceWidget[] {
  return [
    {
      id: "workbench",
      isPresent: true,
      isTrashed: false,
      label: "Workbench",
      trashable: false,
      widgetType: "workbench",
      x: 234,
      y: 0,
    },
    {
      id: "trash",
      isPresent: true,
      isTrashed: false,
      label: "Trash",
      trashable: false,
      widgetType: "trash",
      x: 1530,
      y: 0,
    },
    {
      id: "rack",
      isPresent: false,
      isTrashed: false,
      label: "Autosampler rack",
      trashable: true,
      widgetType: "autosampler_rack",
      x: 234,
      y: 886,
    },
    {
      id: "instrument",
      isPresent: false,
      isTrashed: false,
      label: "LC-MS/MS",
      trashable: true,
      widgetType: "lc_msms_instrument",
      x: 812,
      y: 886,
    },
    {
      id: "basket",
      isPresent: true,
      isTrashed: false,
      label: "Produce basket",
      trashable: false,
      widgetType: "produce_basket",
      x: 1460,
      y: 248,
    },
  ];
}


function makeTool(toolId: string): BenchToolInstance {
  const toolMap: Record<string, Omit<BenchToolInstance, "id" | "allowedDropTargets" | "isDraggable">> = {
    autosampler_rack_widget: {
      accepts_liquids: false,
      accent: "sky",
      capacity_ml: 0,
      label: "Autosampler rack",
      liquids: [],
      produceLots: [],
      subtitle: "Sequence staging",
      toolId: "autosampler_rack_widget",
      toolType: "beaker" as ToolType,
      trashable: true,
    },
    beaker_rinse: {
      accepts_liquids: true,
      accent: "rose",
      capacity_ml: 100,
      label: "Bench beaker",
      liquids: [],
      produceLots: [],
      subtitle: "Temporary holding",
      toolId: "beaker_rinse",
      toolType: "beaker",
      trashable: true,
    },
    centrifuge_tube_50ml: {
      accepts_liquids: true,
      accent: "amber",
      capacity_ml: 50,
      label: "50 mL centrifuge tube",
      liquids: [],
      produceLots: [],
      subtitle: "QuEChERS extraction",
      toolId: "centrifuge_tube_50ml",
      toolType: "centrifuge_tube",
      trashable: true,
    },
    cleanup_tube_dspe: {
      accepts_liquids: true,
      accent: "emerald",
      capacity_ml: 15,
      label: "d-SPE cleanup tube",
      liquids: [],
      produceLots: [],
      subtitle: "Matrix cleanup",
      toolId: "cleanup_tube_dspe",
      toolType: "cleanup_tube",
      trashable: true,
    },
    sample_vial_lcms: {
      accepts_liquids: true,
      accent: "sky",
      capacity_ml: 2,
      label: "Autosampler vial",
      liquids: [],
      produceLots: [],
      subtitle: "Injection ready",
      toolId: "sample_vial_lcms",
      toolType: "sample_vial",
      trashable: true,
    },
    sealed_sampling_bag: {
      accepts_liquids: false,
      accent: "emerald",
      capacity_ml: 500,
      label: "Sealed sampling bag",
      liquids: [],
      produceLots: [],
      subtitle: "Field collection",
      toolId: "sealed_sampling_bag",
      toolType: "sample_bag",
      trashable: true,
    },
  };

  const baseTool = toolMap[toolId];
  if (!baseTool) {
    throw new Error(`Unsupported mock tool id: ${toolId}`);
  }

  return {
    id: `bench_tool_${toolId}`,
    contactImpurityMgPerG: 0,
    isDraggable: true,
    ...baseTool,
    allowedDropTargets: getToolDropTargets(baseTool.toolType),
    produceFractions: [],
  };
}

function makeExperiment(): Experiment {
  return {
    analyticalBalance: { tareMassG: null, taredToolId: null },
    audit_log: [...defaultAuditLog],
    basketTool: null,
    id: "experiment_pesticides",
    last_simulation_at: "2026-03-29T00:00:00Z",
    limsEntries: [],
    limsReception: {
      grossMassOffsetG: 0,
      harvestDate: "",
      id: null,
      indicativeMassG: 0,
      labSampleCode: null,
      measuredGrossMassG: null,
      measuredSampleMassG: null,
      orchardName: "",
      printedLabelTicket: null,
      status: "awaiting_reception",
    },
    rack: { slots: makeRackSlots() },
    snapshot_version: 1,
    spatula: { isLoaded: false, produceFractions: [], sourceToolId: null },
    status: "preparing",
    trash: { produceLots: [], sampleLabels: [], tools: [] },
    workbench: { slots: makeSlots() },
    workspace: { produceBasketLots: [], widgets: makeWorkspaceWidgets() },
  };
}

function makeExperimentListEntry(experiment: Experiment): ExperimentListEntry {
  return {
    id: experiment.id,
    last_audit_entry: experiment.audit_log.at(-1) ?? null,
    last_simulation_at: experiment.last_simulation_at,
    snapshot_version: experiment.snapshot_version,
    status: experiment.status,
    updated_at: experiment.last_simulation_at,
  };
}

function appendAudit(experiment: Experiment, message: string) {
  return {
    ...experiment,
    audit_log: [...experiment.audit_log, message],
    snapshot_version: experiment.snapshot_version + 1,
  };
}

function cloneExperiment(experiment: Experiment): Experiment {
  return structuredClone(experiment);
}

function requireSlot(experiment: Experiment, slotId: string) {
  const slot = experiment.workbench.slots.find((candidate) => candidate.id === slotId);
  if (!slot) {
    throw new Error(`Unknown workbench slot: ${slotId}`);
  }
  return slot;
}

function requireRackSlot(experiment: Experiment, rackSlotId: string) {
  const slot = experiment.rack.slots.find((candidate) => candidate.id === rackSlotId);
  if (!slot) {
    throw new Error(`Unknown rack slot: ${rackSlotId}`);
  }
  return slot;
}

function requireTrashTool(experiment: Experiment, trashToolId: string) {
  const tool = experiment.trash.tools.find((candidate) => candidate.id === trashToolId);
  if (!tool) {
    throw new Error(`Unknown trash tool: ${trashToolId}`);
  }
  return tool;
}

function nextTrashToolId(experiment: Experiment) {
  return `trash_tool_${experiment.trash.tools.length + 1}`;
}

function requireWorkbenchSlotByToolId(experiment: Experiment, toolId: string) {
  const slot = experiment.workbench.slots.find((candidate) => candidate.tool?.id === toolId);
  if (!slot) {
    throw new Error(`Unknown workbench tool: ${toolId}`);
  }
  return slot;
}

function applyCommand(
  experiment: Experiment,
  type: string,
  payload: Record<string, unknown>,
): Experiment {
  const next = cloneExperiment(experiment);

  switch (type) {
    case "add_workbench_slot": {
      const nextIndex = next.workbench.slots.length + 1;
      next.workbench.slots.push({
        id: `station_${nextIndex}`,
        label: `Station ${nextIndex}`,
        tool: null,
      });
      return appendAudit(next, `Station ${nextIndex} added to workbench.`);
    }
    case "remove_workbench_slot": {
      const slotId = String(payload.slot_id);
      next.workbench.slots = next.workbench.slots.filter((slot) => slot.id !== slotId);
      return appendAudit(next, `${slotId.replace("_", " ")} removed from workbench.`);
    }
    case "place_tool_on_workbench": {
      const slot = requireSlot(next, String(payload.slot_id));
      slot.tool = makeTool(String(payload.tool_id));
      return appendAudit(next, `${slot.tool.label} placed on ${slot.label}.`);
    }
    case "add_workspace_widget": {
      const widgetId = String(payload.widget_id);
      const widget = next.workspace.widgets.find((candidate) => candidate.id === widgetId);
      if (!widget) {
        throw new Error(`Unknown workspace widget: ${widgetId}`);
      }
      widget.isPresent = true;
      widget.isTrashed = false;
      widget.x = Number(payload.x);
      widget.y = Number(payload.y);
      return appendAudit(next, `${widget.label} added to workspace.`);
    }
    case "place_workbench_tool_in_rack_slot": {
      const sourceSlot = requireSlot(next, String(payload.source_slot_id));
      const rackSlot = requireRackSlot(next, String(payload.rack_slot_id));
      rackSlot.tool = sourceSlot.tool;
      sourceSlot.tool = null;
      return appendAudit(next, `${rackSlot.tool?.label ?? "Tool"} placed in ${rackSlot.label}.`);
    }
    case "discard_workbench_tool": {
      const slot = requireSlot(next, String(payload.slot_id));
      if (!slot.tool) {
        throw new Error(`No tool to discard in ${slot.id}`);
      }
      const trashTool: TrashToolEntry = {
        id: nextTrashToolId(next),
        originLabel: slot.label,
        tool: slot.tool,
      };
      next.trash.tools.push(trashTool);
      slot.tool = null;
      return appendAudit(next, `${trashTool.tool.label} discarded from ${trashTool.originLabel}.`);
    }
    case "restore_trashed_tool_to_workbench_slot": {
      const slot = requireSlot(next, String(payload.target_slot_id));
      const trashToolId = String(payload.trash_tool_id);
      const trashTool = requireTrashTool(next, trashToolId);
      slot.tool = trashTool.tool;
      next.trash.tools = next.trash.tools.filter((entry) => entry.id !== trashToolId);
      return appendAudit(next, `${slot.tool.label} restored to ${slot.label}.`);
    }
    case "create_produce_lot": {
      const produceLot: ExperimentProduceLot = {
        id: `produce_${next.workspace.produceBasketLots.length + 1}`,
        label: `Apple lot ${next.workspace.produceBasketLots.length + 1}`,
        produceType: "apple",
        totalMassG: 2450,
        unitCount: 12,
      };
      next.workspace.produceBasketLots.push(produceLot);
      return appendAudit(next, `${produceLot.label} added to the basket.`);
    }
    default:
      throw new Error(`Unsupported mock command: ${type}`);
  }
}

async function fulfillJson(route: Route, status: number, body: unknown) {
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: "application/json",
    status,
  });
}

function parseJsonBody(route: Route): Record<string, unknown> {
  const body = route.request().postDataJSON();
  if (body && typeof body === "object") {
    return body as Record<string, unknown>;
  }

  return {};
}

export async function mockWorkbenchApi(
  page: Page,
  options: MockWorkbenchApiOptions = {},
): Promise<MockWorkbenchApi> {
  let experiment = makeExperiment();
  let savedExperiments = options.savedExperiments
    ? structuredClone(options.savedExperiments)
    : [];
  const commands: CommandRecord[] = [];

  const apiPattern = /^http:\/\/(?:localhost|127\.0\.0\.1):(8000|8010)\/experiments(?:\/.*)?$/;

  await page.route(apiPattern, async (route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname;

    // --- /experiments list ---
    if (path === "/experiments") {
      if (method === "GET") {
        await fulfillJson(route, 200, savedExperiments);
        return;
      }
      if (method === "POST") {
        experiment = makeExperiment();
        savedExperiments = [
          makeExperimentListEntry(experiment),
          ...savedExperiments.filter((entry) => entry.id !== experiment.id),
        ];
        await fulfillJson(route, 200, experiment);
        return;
      }
      await route.fallback();
      return;
    }

    // --- /experiments/{id} and sub-paths ---
    if (method === "GET" && path === `/experiments/${experiment.id}`) {
      await fulfillJson(route, 200, experiment);
      return;
    }

    if (method === "DELETE" && path === `/experiments/${experiment.id}`) {
      savedExperiments = savedExperiments.filter((entry) => entry.id !== experiment.id);
      await route.fulfill({ body: "", status: 204 });
      return;
    }

    if (path.endsWith("/stream")) {
      await route.fulfill({ body: "Not Found", status: 404 });
      return;
    }

    let command: CommandRecord | null = null;

    if (method === "POST" && path === `/experiments/${experiment.id}/workbench/slots`) {
      command = { payload: {}, type: "add_workbench_slot" };
    } else if (method === "DELETE" && path.match(new RegExp(`/experiments/${experiment.id}/workbench/slots/[^/]+$`))) {
      command = {
        payload: { slot_id: decodeURIComponent(path.split("/").at(-1) ?? "") },
        type: "remove_workbench_slot",
      };
    } else if (method === "POST" && path.match(new RegExp(`/experiments/${experiment.id}/workbench/slots/[^/]+/place-tool$`))) {
      const body = parseJsonBody(route);
      command = {
        payload: {
          slot_id: decodeURIComponent(path.split("/").at(-2) ?? ""),
          tool_id: String(body.tool_id),
        },
        type: "place_tool_on_workbench",
      };
    } else if (method === "POST" && path === `/experiments/${experiment.id}/workspace/widgets`) {
      const body = parseJsonBody(route);
      command = {
        payload: {
          widget_id: String(body.widget_id),
          x: Number(body.offset_x),
          y: Number(body.offset_y),
        },
        type: "add_workspace_widget",
      };
    } else if (method === "POST" && path.match(new RegExp(`/experiments/${experiment.id}/rack/slots/[^/]+/place-tool-from-workbench$`))) {
      const body = parseJsonBody(route);
      command = {
        payload: {
          rack_slot_id: decodeURIComponent(path.split("/").at(-2) ?? ""),
          source_slot_id: String(body.source_slot_id),
        },
        type: "place_workbench_tool_in_rack_slot",
      };
    } else if (method === "POST" && path.match(new RegExp(`/experiments/${experiment.id}/workbench/tools/[^/]+/discard$`))) {
      const toolId = decodeURIComponent(path.split("/").at(-2) ?? "");
      const slot = requireWorkbenchSlotByToolId(experiment, toolId);
      command = {
        payload: { slot_id: slot.id },
        type: "discard_workbench_tool",
      };
    } else if (method === "POST" && path.match(new RegExp(`/experiments/${experiment.id}/trash/tools/[^/]+/restore-to-workbench$`))) {
      const body = parseJsonBody(route);
      command = {
        payload: {
          target_slot_id: String(body.target_slot_id),
          trash_tool_id: decodeURIComponent(path.split("/").at(-2) ?? ""),
        },
        type: "restore_trashed_tool_to_workbench_slot",
      };
    }

    if (!command) {
      await route.fallback();
      return;
    }

    commands.push(command);
    experiment = applyCommand(experiment, command.type, command.payload);
    savedExperiments = [
      makeExperimentListEntry(experiment),
      ...savedExperiments.filter((entry) => entry.id !== experiment.id),
    ];
    await fulfillJson(route, 200, experiment);
  });

  return { commands };
}
