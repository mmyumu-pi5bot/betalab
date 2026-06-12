import type { Experiment, ExperimentListEntry } from "@/types/experiment";
import type {
  AnalyticalBalanceState,
  BenchLabel,
  BenchLiquidPortion,
  BenchSlot,
  BenchToolInstance,
  ContainedEntity,
  Containment,
  ContainmentRule,
  DragEntityKind,
  DropTargetType,
  ExperimentProduceLot,
  ExperimentWorkspaceWidget,
  LimsReception,
  ProduceFraction,
  ProduceMaterialState,
  PrintedLabelTicket,
  RackSlot,
  SpatulaState,
  ToolbarCategory,
  ToolbarItem,
  TrashProduceLotEntry,
  TrashSampleLabelEntry,
  WidgetAnchor,
} from "@/types/workbench";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const experimentCache = new Map<string, Experiment>();

type ApiRequest = {
  body?: Record<string, unknown>;
  method: "DELETE" | "PATCH" | "POST";
  path: string;
};

type MutationPayload = Record<string, unknown> | undefined;
type DndObjectRef = {
  id: string;
  kind: string;
};
type StreamHandlers = {
  onError?: (error: Error) => void;
  onMessage: (experiment: Experiment) => void;
};

function normalizeAllowedDropTargets(raw: unknown): DropTargetType[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.filter((target): target is DropTargetType => typeof target === "string");
}

function normalizeContainedEntity(raw: unknown): ContainedEntity | null {
  if (raw === null || typeof raw !== "object") {
    return null;
  }
  const entity = raw as Record<string, unknown>;
  const entityKind = entity.entityKind ?? entity.entity_kind;
  if (typeof entityKind !== "string") {
    return null;
  }
  return {
    entityKind: entityKind as DragEntityKind,
    id: String(entity.id ?? ""),
    liquidType:
      entity.liquidType !== undefined
        ? String(entity.liquidType) as ContainedEntity["liquidType"]
        : entity.liquid_type !== undefined && entity.liquid_type !== null
          ? String(entity.liquid_type) as ContainedEntity["liquidType"]
          : null,
    produceType:
      entity.produceType !== undefined
        ? String(entity.produceType) as ContainedEntity["produceType"]
        : entity.produce_type !== undefined && entity.produce_type !== null
          ? String(entity.produce_type) as ContainedEntity["produceType"]
          : null,
    toolType:
      entity.toolType !== undefined
        ? String(entity.toolType) as ContainedEntity["toolType"]
        : entity.tool_type !== undefined && entity.tool_type !== null
          ? String(entity.tool_type) as ContainedEntity["toolType"]
          : null,
  };
}

function normalizeContainmentRule(raw: unknown): ContainmentRule | null {
  if (raw === null || typeof raw !== "object") {
    return null;
  }
  const rule = raw as Record<string, unknown>;
  const entityKind = rule.entityKind ?? rule.entity_kind;
  if (typeof entityKind !== "string") {
    return null;
  }
  return {
    entityKind: entityKind as DragEntityKind,
    liquidType:
      rule.liquidType !== undefined
        ? String(rule.liquidType) as ContainmentRule["liquidType"]
        : rule.liquid_type !== undefined && rule.liquid_type !== null
          ? String(rule.liquid_type) as ContainmentRule["liquidType"]
          : null,
    toolType:
      rule.toolType !== undefined
        ? String(rule.toolType) as ContainmentRule["toolType"]
        : rule.tool_type !== undefined && rule.tool_type !== null
          ? String(rule.tool_type) as ContainmentRule["toolType"]
          : null,
  };
}

function normalizeContainment(raw: unknown): Containment | null {
  if (raw === null || typeof raw !== "object") {
    return null;
  }
  const containment = raw as Record<string, unknown>;
  return {
    accepts: ((containment.accepts ?? []) as unknown[])
      .map(normalizeContainmentRule)
      .filter((rule): rule is ContainmentRule => rule !== null),
    blockedReason:
      containment.blockedReason !== undefined && containment.blockedReason !== null
        ? String(containment.blockedReason)
        : containment.blocked_reason !== undefined && containment.blocked_reason !== null
          ? String(containment.blocked_reason)
          : null,
    canReceive: Boolean(containment.canReceive ?? containment.can_receive ?? false),
    capacity: Number(containment.capacity ?? 0),
    children: ((containment.children ?? []) as unknown[])
      .map(normalizeContainedEntity)
      .filter((child): child is ContainedEntity => child !== null),
    remainingCapacity: Number(containment.remainingCapacity ?? containment.remaining_capacity ?? 0),
  };
}

function normalizeContainedEntities(raw: unknown): ContainedEntity[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map(normalizeContainedEntity).filter((child): child is ContainedEntity => child !== null);
}

async function buildApiError(response: Response, fallbackMessage: string): Promise<Error> {
  try {
    const payload = (await response.json()) as { detail?: string };
    if (typeof payload.detail === "string" && payload.detail.length > 0) {
      return new Error(payload.detail);
    }
  } catch {
    // Ignore non-JSON error payloads and fall back to the default message.
  }

  return new Error(fallbackMessage);
}

async function sendMutationRequest(
  experimentId: string,
  request: ApiRequest,
): Promise<Experiment> {
  const response = await fetch(`${API_BASE_URL}${request.path}`, {
    method: request.method,
    ...(request.body
      ? {
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request.body),
        }
      : {}),
  });

  if (!response.ok) {
    throw await buildApiError(response, "Failed to send experiment mutation");
  }

  const experiment = normalizeExperiment((await response.json()) as Experiment);
  experimentCache.set(experimentId, experiment);
  return experiment;
}

export async function createExperiment(): Promise<Experiment> {
  const response = await fetch(`${API_BASE_URL}/experiments`, {
    method: "POST",
  });

  if (!response.ok) {
    throw await buildApiError(response, "Failed to create experiment");
  }

  const experiment = normalizeExperiment((await response.json()) as Experiment);
  experimentCache.set(experiment.id, experiment);
  return experiment;
}

export async function getExperiment(experimentId: string): Promise<Experiment> {
  const response = await fetch(`${API_BASE_URL}/experiments/${experimentId}`);

  if (!response.ok) {
    throw await buildApiError(response, "Failed to fetch experiment");
  }

  const experiment = normalizeExperiment((await response.json()) as Experiment);
  experimentCache.set(experiment.id, experiment);
  return experiment;
}

export async function listExperiments(): Promise<ExperimentListEntry[]> {
  const response = await fetch(`${API_BASE_URL}/experiments`);

  if (!response.ok) {
    throw await buildApiError(response, "Failed to fetch experiments");
  }

  const payload = (await response.json()) as ExperimentListEntry[];
  return payload.map((entry) => ({
    ...entry,
    last_simulation_at: String(entry.last_simulation_at),
    updated_at: String(entry.updated_at),
    last_audit_entry:
      entry.last_audit_entry === null || entry.last_audit_entry === undefined
        ? null
        : String(entry.last_audit_entry),
  }));
}

function normalizeToolbarItem(rawItem: Record<string, unknown>): ToolbarItem {
  const itemType = String(rawItem.itemType ?? rawItem.item_type);
  const base = {
    accent: String(rawItem.accent) as ToolbarItem["accent"],
    allowedDropTargets: normalizeAllowedDropTargets(rawItem.allowedDropTargets ?? rawItem.allowed_drop_targets),
    description: String(rawItem.description ?? ""),
    id: String(rawItem.id),
    name: String(rawItem.name),
    subtitle: String(rawItem.subtitle ?? ""),
  };

  if (itemType === "tool") {
    return {
      ...base,
      canReceiveLiquids: Boolean(rawItem.canReceiveLiquids ?? rawItem.can_receive_liquids),
      canReceiveProduce: Boolean(rawItem.canReceiveProduce ?? rawItem.can_receive_produce),
      canSeal: Boolean(rawItem.canSeal ?? rawItem.can_seal),
      isDiscardable: Boolean(rawItem.isDiscardable ?? rawItem.is_discardable ?? true),
      isStorable: Boolean(rawItem.isStorable ?? rawItem.is_storable ?? false),
      capacity_ml: Number(rawItem.capacity_ml ?? 0),
      itemType: "tool",
      toolType: String(rawItem.toolType ?? rawItem.tool_type) as Extract<ToolbarItem, { itemType: "tool" }>["toolType"],
    };
  }
  if (itemType === "liquid") {
    return {
      ...base,
      itemType: "liquid",
      liquidType: String(rawItem.liquidType ?? rawItem.liquid_type) as Extract<ToolbarItem, { itemType: "liquid" }>["liquidType"],
      transfer_volume_ml: Number(rawItem.transfer_volume_ml ?? 0),
    };
  }
  if (itemType === "workspace_widget") {
    return {
      ...base,
      itemType: "workspace_widget",
      widgetType: String(rawItem.widgetType ?? rawItem.widget_type) as Extract<ToolbarItem, { itemType: "workspace_widget" }>["widgetType"],
    };
  }
  return {
    ...base,
    itemType: "sample_label",
  };
}

export async function getToolbarCatalog(): Promise<ToolbarCategory[]> {
  const response = await fetch(`${API_BASE_URL}/experiments/catalog/toolbar`);

  if (!response.ok) {
    throw await buildApiError(response, "Failed to fetch toolbar catalog");
  }

  const payload = (await response.json()) as Array<Record<string, unknown>>;
  return payload.map((category) => ({
    description: String(category.description ?? ""),
    id: String(category.id),
    items: ((category.items ?? []) as Array<Record<string, unknown>>).map((item) =>
      normalizeToolbarItem(item),
    ),
    label: String(category.label ?? ""),
  }));
}

export async function deleteExperiment(experimentId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/experiments/${experimentId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw await buildApiError(response, "Failed to delete experiment");
  }

  experimentCache.delete(experimentId);
}

export function subscribeToExperimentStream(
  experimentId: string,
  handlers: StreamHandlers,
): () => void {
  const streamUrl = new URL(`${API_BASE_URL}/experiments/${experimentId}/stream`);
  streamUrl.protocol = streamUrl.protocol === "https:" ? "wss:" : "ws:";

  let activeSocket: WebSocket | null = null;
  let reconnectTimeoutId: number | null = null;
  let isDisposed = false;

  const clearReconnectTimeout = () => {
    if (reconnectTimeoutId !== null) {
      window.clearTimeout(reconnectTimeoutId);
      reconnectTimeoutId = null;
    }
  };

  const scheduleReconnect = () => {
    if (isDisposed || reconnectTimeoutId !== null) {
      return;
    }

    reconnectTimeoutId = window.setTimeout(() => {
      reconnectTimeoutId = null;
      connect();
    }, 1000);
  };

  const connect = () => {
    if (isDisposed) {
      return;
    }

    if (activeSocket && activeSocket.readyState !== WebSocket.CLOSED) {
      return;
    }

    const socket = new WebSocket(streamUrl.toString());
    activeSocket = socket;

    socket.onopen = () => {
      clearReconnectTimeout();
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as Experiment;
        const experiment = normalizeExperiment(payload);
        experimentCache.set(experiment.id, experiment);
        handlers.onMessage(experiment);
      } catch {
        handlers.onError?.(new Error("Failed to parse experiment stream payload"));
      }
    };

    socket.onerror = () => {
      // Browser WebSocket errors are intentionally opaque; rely on close + reconnect.
    };

    socket.onclose = () => {
      if (activeSocket === socket) {
        activeSocket = null;
      }
      scheduleReconnect();
    };
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      clearReconnectTimeout();
      connect();
    }
  };

  const handleOnline = () => {
    clearReconnectTimeout();
    connect();
  };

  connect();
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("online", handleOnline);

  return () => {
    isDisposed = true;
    clearReconnectTimeout();
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("online", handleOnline);
    activeSocket?.close();
  };
}

function getCachedExperiment(experimentId: string): Experiment | undefined {
  return experimentCache.get(experimentId);
}

function findWorkbenchToolId(experimentId: string, slotId: string): string {
  const toolId = getCachedExperiment(experimentId)?.workbench.slots.find((slot) => slot.id === slotId)?.tool?.id;
  if (toolId) {
    return toolId;
  }

  throw new Error("Unknown workbench tool");
}

function findRackToolId(experimentId: string, rackSlotId: string): string {
  const toolId = getCachedExperiment(experimentId)?.rack.slots.find((slot) => slot.id === rackSlotId)?.tool?.id;
  if (toolId) {
    return toolId;
  }

  throw new Error("Unknown rack tool");
}

function requirePayload(payload: MutationPayload): Record<string, unknown> {
  return payload ?? {};
}

function requireDndObjectRef(payload: Record<string, unknown>, fieldName: string): DndObjectRef {
  const value = payload[fieldName];
  if (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    "id" in value &&
    typeof value.kind === "string" &&
    typeof value.id === "string"
  ) {
    return { kind: value.kind, id: value.id };
  }

  throw new Error(`Missing ${fieldName}`);
}

// All drag-and-drop moves go through moveObject -> POST /dnd/move.
// Explicit UI actions that are not drag-based (balance measurements, dedicated operation buttons)
// use their own typed endpoints below. Do not call moveObject for those.
export function moveObject(experimentId: string, payload: MutationPayload): Promise<Experiment> {
  const body = requirePayload(payload);
  const destination = requireDndObjectRef(body, "destination");
  const entity = requireDndObjectRef(body, "entity");
  const source = requireDndObjectRef(body, "source");

  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/dnd/move`,
    body: { destination, entity, source },
  });
}

function requireString(payload: Record<string, unknown>, fieldName: string): string {
  const value = payload[fieldName];
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  throw new Error(`Missing ${fieldName}`);
}

function requireNumber(payload: Record<string, unknown>, fieldName: string): number {
  const value = payload[fieldName];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  throw new Error(`Missing ${fieldName}`);
}

function optionalNumberBody(payload: Record<string, unknown>, fieldName: string): Record<string, number> {
  const value = payload[fieldName];
  if (value === undefined) {
    return {};
  }

  return { [fieldName]: requireNumber(payload, fieldName) };
}

export async function addWorkbenchSlot(experimentId: string, payload?: MutationPayload): Promise<Experiment> {
  void payload;
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/workbench/slots`,
  });
}

export async function removeWorkbenchSlot(experimentId: string, payload: MutationPayload): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "DELETE",
    path: `/experiments/${experimentId}/workbench/slots/${requireString(body, "slot_id")}`,
  });
}


export async function discardWorkbenchTool(experimentId: string, payload: MutationPayload): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/workbench/tools/${findWorkbenchToolId(experimentId, requireString(body, "slot_id"))}/discard`,
  });
}

export async function storeWorkbenchTool(experimentId: string, payload: MutationPayload): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/workbench/tools/${findWorkbenchToolId(experimentId, requireString(body, "slot_id"))}/store`,
  });
}

export async function discardSampleLabelFromPalette(experimentId: string, payload?: MutationPayload): Promise<Experiment> {
  void payload;
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/palette/sample-labels/discard`,
  });
}

export async function restoreTrashedToolToWorkbenchSlot(experimentId: string, payload: MutationPayload): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/trash/tools/${requireString(body, "trash_tool_id")}/restore-to-workbench`,
    body: { target_slot_id: requireString(body, "target_slot_id") },
  });
}

export async function addWorkspaceWidget(experimentId: string, payload: MutationPayload): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/workspace/widgets`,
    body: {
      widget_id: requireString(body, "widget_id"),
      anchor: requireString(body, "anchor"),
      offset_x: requireNumber(body, "offset_x"),
      offset_y: requireNumber(body, "offset_y"),
    },
  });
}

export async function moveWorkspaceWidget(experimentId: string, payload: MutationPayload): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/workspace/widgets/${requireString(body, "widget_id")}/move`,
    body: {
      anchor: requireString(body, "anchor"),
      offset_x: requireNumber(body, "offset_x"),
      offset_y: requireNumber(body, "offset_y"),
    },
  });
}

export async function storeWorkspaceWidget(experimentId: string, payload: MutationPayload): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/workspace/widgets/${requireString(body, "widget_id")}/store`,
  });
}

export async function addLiquidToWorkspaceWidget(experimentId: string, payload: MutationPayload): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/workspace/widgets/${requireString(body, "widget_id")}/liquids`,
    body: {
      liquid_id: requireString(body, "liquid_id"),
      ...optionalNumberBody(body, "volume_ml"),
    },
  });
}

export async function removeLiquidFromWorkspaceWidget(experimentId: string, payload: MutationPayload): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "DELETE",
    path: `/experiments/${experimentId}/workspace/widgets/${requireString(body, "widget_id")}/liquids/${requireString(body, "liquid_entry_id")}`,
  });
}

export async function completeGrinderCycle(experimentId: string, payload: MutationPayload): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/workspace/widgets/${requireString(body, "widget_id")}/complete-grinder-cycle`,
  });
}

export async function startGrinderCycle(experimentId: string, payload: MutationPayload): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/workspace/widgets/${requireString(body, "widget_id")}/start-grinder-cycle`,
  });
}

export async function createProduceLot(experimentId: string, payload: MutationPayload): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/workspace/produce-lots`,
    body: { produce_type: requireString(body, "produce_type") },
  });
}

export async function placeReceivedBagOnWorkbench(experimentId: string, payload: MutationPayload): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/reception/bag/place-on-workbench`,
    body: { target_slot_id: requireString(body, "target_slot_id"), tool_id: requireString(body, "tool_id") },
  });
}

export async function discardBasketTool(experimentId: string, payload: MutationPayload): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/reception/bag/discard`,
    body: { tool_id: requireString(body, "tool_id") },
  });
}

export async function moveWorkbenchToolToGrossBalance(
  experimentId: string,
  payload: MutationPayload,
): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/gross-balance/place-workbench-tool`,
    body: { slot_id: requireString(body, "source_slot_id") },
  });
}

export async function moveWorkbenchToolToAnalyticalBalance(
  experimentId: string,
  payload: MutationPayload,
): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/analytical-balance/place-workbench-tool`,
    body: { slot_id: requireString(body, "source_slot_id") },
  });
}

export async function addLiquidToAnalyticalBalanceTool(
  experimentId: string,
  payload: MutationPayload,
): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/analytical-balance/liquids`,
    body: {
      liquid_id: requireString(body, "liquid_id"),
      volume_ml: requireNumber(body, "volume_ml"),
    },
  });
}

export async function moveBasketToolToGrossBalance(
  experimentId: string,
  payload: MutationPayload,
): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/gross-balance/place-basket-tool`,
    body: { tool_id: requireString(body, "tool_id") },
  });
}

export async function moveAnalyticalBalanceToolToGrossBalance(
  experimentId: string,
  payload?: MutationPayload,
): Promise<Experiment> {
  void payload;
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/gross-balance/place-analytical-balance-tool`,
  });
}

export async function placeToolOnGrossBalance(
  experimentId: string,
  payload: MutationPayload,
): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/gross-balance/place-tool`,
    body: { tool_id: requireString(body, "tool_id") },
  });
}

export async function placeToolOnAnalyticalBalance(
  experimentId: string,
  payload: MutationPayload,
): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/analytical-balance/place-tool`,
    body: { tool_id: requireString(body, "tool_id") },
  });
}

export async function moveRackToolToGrossBalance(
  experimentId: string,
  payload: MutationPayload,
): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/gross-balance/place-rack-tool`,
    body: { rack_slot_id: requireString(body, "rack_slot_id") },
  });
}

export async function moveRackToolToAnalyticalBalance(
  experimentId: string,
  payload: MutationPayload,
): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/analytical-balance/place-rack-tool`,
    body: { rack_slot_id: requireString(body, "rack_slot_id") },
  });
}

export async function moveGrossBalanceToolToAnalyticalBalance(
  experimentId: string,
  payload?: MutationPayload,
): Promise<Experiment> {
  void payload;
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/analytical-balance/place-gross-balance-tool`,
  });
}

export async function restoreTrashedToolToGrossBalance(
  experimentId: string,
  payload: MutationPayload,
): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/gross-balance/restore-trash-tool/${requireString(body, "trash_tool_id")}`,
  });
}

export async function restoreTrashedToolToAnalyticalBalance(
  experimentId: string,
  payload: MutationPayload,
): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/analytical-balance/restore-trash-tool/${requireString(body, "trash_tool_id")}`,
  });
}

export async function moveGrossBalanceToolToWorkbench(
  experimentId: string,
  payload: MutationPayload,
): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/gross-balance/move-tool-to-workbench`,
    body: { target_slot_id: requireString(body, "target_slot_id") },
  });
}

export async function moveAnalyticalBalanceToolToWorkbench(
  experimentId: string,
  payload: MutationPayload,
): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/analytical-balance/move-tool-to-workbench`,
    body: { target_slot_id: requireString(body, "target_slot_id") },
  });
}

export async function moveGrossBalanceToolToRack(
  experimentId: string,
  payload: MutationPayload,
): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/gross-balance/move-tool-to-rack`,
    body: { rack_slot_id: requireString(body, "rack_slot_id") },
  });
}

export async function moveAnalyticalBalanceToolToRack(
  experimentId: string,
  payload: MutationPayload,
): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/analytical-balance/move-tool-to-rack`,
    body: { rack_slot_id: requireString(body, "rack_slot_id") },
  });
}

export async function discardGrossBalanceTool(
  experimentId: string,
  payload?: MutationPayload,
): Promise<Experiment> {
  void payload;
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/gross-balance/discard-tool`,
  });
}

export async function discardAnalyticalBalanceTool(
  experimentId: string,
  payload?: MutationPayload,
): Promise<Experiment> {
  void payload;
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/analytical-balance/discard-tool`,
  });
}

export async function tareAnalyticalBalance(
  experimentId: string,
  payload?: MutationPayload,
): Promise<Experiment> {
  void payload;
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/analytical-balance/tare`,
  });
}

export async function openAnalyticalBalanceTool(
  experimentId: string,
  payload?: MutationPayload,
): Promise<Experiment> {
  void payload;
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/analytical-balance/open-tool`,
  });
}

export async function closeAnalyticalBalanceTool(
  experimentId: string,
  payload?: MutationPayload,
): Promise<Experiment> {
  void payload;
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/analytical-balance/close-tool`,
  });
}

export async function recordAnalyticalSampleMass(
  experimentId: string,
  payload?: MutationPayload,
): Promise<Experiment> {
  void payload;
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/analytical-balance/record-sample-mass`,
  });
}

export async function openGrossBalanceTool(
  experimentId: string,
  payload?: MutationPayload,
): Promise<Experiment> {
  void payload;
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/gross-balance/open-tool`,
  });
}

export async function closeGrossBalanceTool(
  experimentId: string,
  payload?: MutationPayload,
): Promise<Experiment> {
  void payload;
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/gross-balance/close-tool`,
  });
}

export async function recordGrossWeight(experimentId: string, payload?: MutationPayload): Promise<Experiment> {
  const body = payload && "measured_gross_mass_g" in payload ? payload : undefined;
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/reception/gross-weight/record`,
    ...(body
      ? {
          body: {
            measured_gross_mass_g: requireNumber(body, "measured_gross_mass_g"),
          },
        }
      : {}),
  });
}

export async function setGrossBalanceContainerOffset(
  experimentId: string,
  payload: MutationPayload,
): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/gross-balance/container-offset`,
    body: {
      gross_mass_offset_g: requireNumber(body, "gross_mass_offset_g"),
    },
  });
}

export async function createLimsReception(experimentId: string, payload: MutationPayload): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/lims/reception`,
    body: {
      entry_id:
        body.entry_id === undefined || body.entry_id === null
          ? null
          : requireString(body, "entry_id"),
      orchard_name: requireString(body, "orchard_name"),
      harvest_date: requireString(body, "harvest_date"),
      indicative_mass_g: requireNumber(body, "indicative_mass_g"),
      measured_gross_mass_g:
        body.measured_gross_mass_g === undefined || body.measured_gross_mass_g === null
          ? null
          : requireNumber(body, "measured_gross_mass_g"),
      measured_sample_mass_g:
        body.measured_sample_mass_g === undefined || body.measured_sample_mass_g === null
          ? null
          : requireNumber(body, "measured_sample_mass_g"),
    },
  });
}

export async function printLimsLabel(experimentId: string, payload?: MutationPayload): Promise<Experiment> {
  const entryId =
    payload && payload.entry_id !== undefined && payload.entry_id !== null
      ? requireString(payload, "entry_id")
      : null;
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/lims/print-label`,
    body: entryId === null ? undefined : { entry_id: entryId },
  });
}

export async function discardPrintedLimsLabel(experimentId: string, payload?: MutationPayload): Promise<Experiment> {
  void payload;
  return sendMutationRequest(experimentId, {
    method: "DELETE",
    path: `/experiments/${experimentId}/lims/printed-label`,
  });
}

export async function applyPrintedLimsLabel(experimentId: string, payload: MutationPayload): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/lims/apply-label-to-workbench-bag`,
    body: { slot_id: requireString(body, "slot_id") },
  });
}

export async function applyPrintedLimsLabelToBasketBag(
  experimentId: string,
  payload?: MutationPayload,
): Promise<Experiment> {
  void payload;
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/lims/apply-label-to-basket-bag`,
  });
}

export async function applyPrintedLimsLabelToGrossBalanceBag(
  experimentId: string,
  payload?: MutationPayload,
): Promise<Experiment> {
  void payload;
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/lims/apply-label-to-gross-balance-bag`,
  });
}

export async function applyPrintedLimsLabelToAnalyticalBalanceTool(
  experimentId: string,
  payload?: MutationPayload,
): Promise<Experiment> {
  void payload;
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/lims/apply-label-to-analytical-balance-tool`,
  });
}

export async function createDebugProduceLotOnWorkbench(
  experimentId: string,
  payload: MutationPayload,
): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/debug/produce-presets/${requireString(body, "preset_id")}/spawn-on-workbench`,
    body: {
      target_slot_id: requireString(body, "target_slot_id"),
      ...optionalNumberBody(body, "total_mass_g"),
      ...optionalNumberBody(body, "temperature_c"),
      ...optionalNumberBody(body, "residual_co2_mass_g"),
    },
  });
}

export async function createDebugProduceLotToWidget(
  experimentId: string,
  payload: MutationPayload,
): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/debug/produce-presets/${requireString(body, "preset_id")}/spawn-on-widget`,
    body: {
      widget_id: requireString(body, "widget_id"),
      ...optionalNumberBody(body, "total_mass_g"),
      ...optionalNumberBody(body, "temperature_c"),
      ...optionalNumberBody(body, "residual_co2_mass_g"),
    },
  });
}

export async function placeToolInRackSlot(experimentId: string, payload: MutationPayload): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/rack/slots/${requireString(body, "rack_slot_id")}/place-tool-from-palette`,
    body: { tool_id: requireString(body, "tool_id") },
  });
}

export async function placeWorkbenchToolInRackSlot(experimentId: string, payload: MutationPayload): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/rack/slots/${requireString(body, "rack_slot_id")}/place-tool-from-workbench`,
    body: { source_slot_id: requireString(body, "source_slot_id") },
  });
}

export async function moveRackToolBetweenSlots(experimentId: string, payload: MutationPayload): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/rack/tools/${findRackToolId(experimentId, requireString(body, "source_rack_slot_id"))}/move-to-slot`,
    body: { target_rack_slot_id: requireString(body, "target_rack_slot_id") },
  });
}

export async function removeRackToolToWorkbenchSlot(experimentId: string, payload: MutationPayload): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/rack/tools/${findRackToolId(experimentId, requireString(body, "rack_slot_id"))}/move-to-workbench-slot`,
    body: { target_slot_id: requireString(body, "target_slot_id") },
  });
}

export async function discardRackTool(experimentId: string, payload: MutationPayload): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/rack/tools/${findRackToolId(experimentId, requireString(body, "rack_slot_id"))}/discard`,
  });
}

export async function restoreTrashedToolToRackSlot(experimentId: string, payload: MutationPayload): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/trash/tools/${requireString(body, "trash_tool_id")}/restore-to-rack`,
    body: { rack_slot_id: requireString(body, "rack_slot_id") },
  });
}

export async function addLiquidToWorkbenchTool(experimentId: string, payload: MutationPayload): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/workbench/tools/${findWorkbenchToolId(experimentId, requireString(body, "slot_id"))}/liquids`,
    body: {
      liquid_id: requireString(body, "liquid_id"),
      ...optionalNumberBody(body, "volume_ml"),
    },
  });
}

export async function cutWorkbenchProduceLot(experimentId: string, payload: MutationPayload): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/workbench/produce-lots/${requireString(body, "produce_lot_id")}/cut`,
    body: { slot_id: requireString(body, "slot_id") },
  });
}

export async function removeLiquidFromWorkbenchTool(experimentId: string, payload: MutationPayload): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "DELETE",
    path: `/experiments/${experimentId}/workbench/tools/${findWorkbenchToolId(experimentId, requireString(body, "slot_id"))}/liquids/${requireString(body, "liquid_entry_id")}`,
  });
}

export async function applySampleLabelToWorkbenchTool(experimentId: string, payload: MutationPayload): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/workbench/tools/${findWorkbenchToolId(experimentId, requireString(body, "slot_id"))}/sample-label`,
  });
}

export async function applySampleLabelToAnalyticalBalanceTool(
  experimentId: string,
  payload?: MutationPayload,
): Promise<Experiment> {
  void payload;
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/analytical-balance/sample-label`,
  });
}

export async function applySampleLabelToGrossBalanceTool(
  experimentId: string,
  payload?: MutationPayload,
): Promise<Experiment> {
  void payload;
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/gross-balance/sample-label`,
  });
}

export async function closeWorkbenchTool(experimentId: string, payload: MutationPayload): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/workbench/tools/${findWorkbenchToolId(experimentId, requireString(body, "slot_id"))}/close`,
  });
}

export async function openWorkbenchTool(experimentId: string, payload: MutationPayload): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/workbench/tools/${findWorkbenchToolId(experimentId, requireString(body, "slot_id"))}/open`,
  });
}

export async function discardSpatula(experimentId: string): Promise<Experiment> {
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/spatula/discard`,
  });
}

export async function loadSpatulaFromWorkbenchTool(experimentId: string, payload: MutationPayload): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/workbench/tools/${findWorkbenchToolId(experimentId, requireString(body, "slot_id"))}/spatula/load`,
  });
}

export async function pourSpatulaIntoWorkbenchTool(experimentId: string, payload: MutationPayload): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/workbench/tools/${findWorkbenchToolId(experimentId, requireString(body, "slot_id"))}/spatula/pour`,
    body: { delta_mass_g: requireNumber(body, "delta_mass_g") },
  });
}

export async function loadSpatulaFromAnalyticalBalanceTool(experimentId: string, payload: MutationPayload): Promise<Experiment> {
  void payload;
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/analytical-balance/spatula/load`,
  });
}

export async function pourSpatulaIntoAnalyticalBalanceTool(experimentId: string, payload: MutationPayload): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/analytical-balance/spatula/pour`,
    body: { delta_mass_g: requireNumber(body, "delta_mass_g") },
  });
}

export async function updateWorkbenchToolSampleLabelText(experimentId: string, payload: MutationPayload): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "PATCH",
    path: `/experiments/${experimentId}/workbench/tools/${findWorkbenchToolId(experimentId, requireString(body, "slot_id"))}/sample-labels/${requireString(body, "label_id")}`,
    body: { sample_label_text: requireString(body, "sample_label_text") },
  });
}

export async function updateAnalyticalBalanceToolSampleLabelText(
  experimentId: string,
  payload: MutationPayload,
): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "PATCH",
    path: `/experiments/${experimentId}/analytical-balance/sample-labels/${requireString(body, "label_id")}`,
    body: { sample_label_text: requireString(body, "sample_label_text") },
  });
}

export async function placeToolOnVortex(
  experimentId: string,
  payload: MutationPayload,
): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/vortex/tool/place?tool_id=${requireString(body, "tool_id")}`,
  });
}

export async function moveWorkbenchToolToVortex(
  experimentId: string,
  payload: MutationPayload,
): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/vortex/tool/workbench?source_slot_id=${requireString(body, "source_slot_id")}`,
  });
}

export async function moveRackToolToVortex(
  experimentId: string,
  payload: MutationPayload,
): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/vortex/tool/rack?rack_slot_id=${requireString(body, "rack_slot_id")}`,
  });
}

export async function restoreTrashedToolToVortex(
  experimentId: string,
  payload: MutationPayload,
): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/vortex/tool/trash?trash_tool_id=${requireString(body, "trash_tool_id")}`,
  });
}

export async function moveVortexToolToWorkbench(
  experimentId: string,
  payload: MutationPayload,
): Promise<Experiment> {
  const body = requirePayload(payload);
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/vortex/tool/move-to-workbench?target_slot_id=${requireString(body, "target_slot_id")}`,
  });
}

export async function moveAnalyticalBalanceToolToVortex(
  experimentId: string,
  payload?: MutationPayload,
): Promise<Experiment> {
  void payload;
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/vortex/tool/analytical-balance`,
  });
}

export async function moveGrossBalanceToolToVortex(
  experimentId: string,
  payload?: MutationPayload,
): Promise<Experiment> {
  void payload;
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/vortex/tool/gross-balance`,
  });
}

export async function moveVortexToolToAnalyticalBalance(
  experimentId: string,
  payload?: MutationPayload,
): Promise<Experiment> {
  void payload;
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/vortex/tool/move-to-analytical-balance`,
  });
}

export async function moveVortexToolToGrossBalance(
  experimentId: string,
  payload?: MutationPayload,
): Promise<Experiment> {
  void payload;
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/vortex/tool/move-to-gross-balance`,
  });
}

export async function discardVortexTool(
  experimentId: string,
  payload?: MutationPayload,
): Promise<Experiment> {
  void payload;
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/vortex/tool/discard`,
  });
}

export async function closeVortexTool(
  experimentId: string,
  payload?: MutationPayload,
): Promise<Experiment> {
  void payload;
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/vortex/tool/close`,
  });
}

export async function openVortexTool(
  experimentId: string,
  payload?: MutationPayload,
): Promise<Experiment> {
  void payload;
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/vortex/tool/open`,
  });
}

export async function startVortexCycle(
  experimentId: string,
  payload?: MutationPayload,
): Promise<Experiment> {
  void payload;
  return sendMutationRequest(experimentId, {
    method: "POST",
    path: `/experiments/${experimentId}/vortex/start`,
  });
}

function normalizeExperiment(experiment: Experiment): Experiment {
  const rawTrash = experiment.trash as Experiment["trash"] & Record<string, unknown>;
  const rawWorkspace = experiment.workspace as Experiment["workspace"] & Record<string, unknown>;
  const materialStates = ((
    (experiment as Experiment & Record<string, unknown>).produceMaterialStates ??
    (experiment as Experiment & Record<string, unknown>).produce_material_states ??
    []
  ) as unknown[]).map((state) =>
    normalizeProduceMaterialState(state as ProduceMaterialState & Record<string, unknown>),
  );
  const statesByLotId = new Map(materialStates.map((state) => [state.produceLotId, state]));
  const statesById = new Map(materialStates.map((state) => [state.id, state]));
  const basketFractions = normalizeProduceFractions(
    rawWorkspace.produceBasketFractions ?? rawWorkspace.produce_basket_fractions,
  );

  return {
    ...experiment,
    last_simulation_at: String(
      (experiment as Experiment & Record<string, unknown>).last_simulation_at ??
      (experiment as Experiment & Record<string, unknown>).lastSimulationAt ??
      "",
    ),
    snapshot_version: Number(
      (experiment as Experiment & Record<string, unknown>).snapshot_version ??
      (experiment as Experiment & Record<string, unknown>).snapshotVersion ??
      0,
    ),
    workbench: {
      slots: experiment.workbench.slots.map((slot) => normalizeBenchSlot(slot, materialStates)),
    },
    rack: {
      slots: experiment.rack.slots.map((slot) => normalizeRackSlot(slot, materialStates)),
    },
    trash: {
      children: (
        experiment.trash.children ??
        rawTrash.children ??
        []
      ).map((tool) => normalizeBenchTool(tool as BenchToolInstance & Record<string, unknown>, materialStates)),
      discardedFrom: (experiment.trash.discardedFrom ?? rawTrash.discarded_from ?? {}) as Record<string, string>,
      produceLots: (
        experiment.trash.produceLots ??
        rawTrash.produce_lots ??
        []
      ).map(
          normalizeTrashProduceLot,
        ),
      sampleLabels: (
        experiment.trash.sampleLabels ??
        rawTrash.sample_labels ??
        []
      ).map(
          normalizeTrashSampleLabel,
        ),
    },
    workspace: {
      produceBasketLots: (
        experiment.workspace.produceBasketLots ??
        rawWorkspace.produce_basket_lots ??
        []
      ).map(
          (lot) =>
            normalizeProduceLot(
              lot as ExperimentProduceLot & Record<string, unknown>,
              buildProduceLotNormalizationContext(statesByLotId, statesById, basketFractions),
            ),
        ),
      widgets: experiment.workspace.widgets.map((widget) => normalizeWorkspaceWidget(widget, materialStates)),
    },
    limsReception: normalizeLimsReception(
      (
        (experiment as Experiment & Record<string, unknown>).limsReception ??
        (experiment as Experiment & Record<string, unknown>).lims_reception
      ) as LimsReception & Record<string, unknown>,
    ),
    limsEntries: (
      (experiment as Experiment & Record<string, unknown>).limsEntries ??
      (experiment as Experiment & Record<string, unknown>).lims_entries ??
      []
    ).map((entry) =>
      normalizeLimsReception(entry as LimsReception & Record<string, unknown>),
    ),
    produceMaterialStates: materialStates,
    basketTools: (() => {
      const raw = experiment as Experiment & Record<string, unknown>;
      const rawList =
        (raw.basketTools as unknown[]) ??
        (raw.basket_tools as unknown[]) ??
        [];
      return rawList.map((t) =>
        normalizeBenchTool(t as BenchToolInstance & Record<string, unknown>, materialStates),
      );
    })(),
    spatula: normalizeSpatulaState(
      ((experiment as Experiment & Record<string, unknown>).spatula ?? {}) as
        SpatulaState &
        Record<string, unknown>,
    ),
    analyticalBalance: normalizeAnalyticalBalanceState(
      (
        (experiment as Experiment & Record<string, unknown>).analyticalBalance ??
        (experiment as Experiment & Record<string, unknown>).analytical_balance ??
        {}
      ) as AnalyticalBalanceState & Record<string, unknown>,
    ),
  };
}

function normalizeBenchSlot(slot: BenchSlot, materialStates: ProduceMaterialState[] = []): BenchSlot {
  const rawSlot = slot as BenchSlot & Record<string, unknown>;
  const rawSurfaceProduceLots = (
    slot.surfaceProduceLots ??
    rawSlot.surface_produce_lots ??
    []
  ) as unknown[];
  const statesByLotId = new Map(materialStates.map((state) => [state.produceLotId, state]));
  const statesById = new Map(materialStates.map((state) => [state.id, state]));
  const surfaceFractions = normalizeProduceFractions(
    rawSlot.surfaceProduceFractions ?? rawSlot.surface_produce_fractions,
  );

  return {
    children: normalizeContainedEntities(rawSlot.children),
    containment: normalizeContainment(rawSlot.containment),
    id: slot.id,
    label: slot.label,
    dropTargetTypes: normalizeAllowedDropTargets(slot.dropTargetTypes ?? rawSlot.drop_target_types),
    surfaceProduceLots: rawSurfaceProduceLots.map((lot) =>
      normalizeProduceLot(
        lot as ExperimentProduceLot & Record<string, unknown>,
        buildProduceLotNormalizationContext(statesByLotId, statesById, surfaceFractions),
      ),
    ),
    tool: slot.tool
      ? normalizeBenchTool(slot.tool as BenchToolInstance & Record<string, unknown>, materialStates)
      : null,
  };
}

function normalizeBenchTool(
  tool: BenchToolInstance & Record<string, unknown>,
  materialStates: ProduceMaterialState[],
): BenchToolInstance {
  const statesByLotId = new Map(materialStates.map((state) => [state.produceLotId, state]));
  const statesById = new Map(materialStates.map((state) => [state.id, state]));
  const rawProduceLots = (tool.produceLots ?? tool.produce_lots ?? []) as unknown[];
  const produceFractions = normalizeProduceFractions(tool.produceFractions ?? tool.produce_fractions).map(
    (fraction) => {
      const materialState = statesById.get(fraction.produceMaterialStateId);
      return {
        ...fraction,
        materialState: materialState?.materialState,
      };
    },
  );
  const produceLotContext = buildProduceLotNormalizationContext(statesByLotId, statesById, produceFractions);
  const produceLots = rawProduceLots.map((lot) =>
    normalizeProduceLot(lot as ExperimentProduceLot & Record<string, unknown>, produceLotContext),
  );
  const powderMassG = getGroundProduceMassG(produceFractions, materialStates);
  const containsSlurry =
    produceLots.some((lot) => lot.materialState === "slurry") ||
    produceFractions.some((fraction) => statesById.get(fraction.produceMaterialStateId)?.materialState === "slurry");
  const rawQuechersState = (tool.quechersState ?? tool.quechers_state ?? {}) as Record<string, unknown>;

  return {
    id: tool.id,
    toolId: String(tool.toolId ?? tool.tool_id),
    label: tool.label,
    subtitle: tool.subtitle,
    accent: tool.accent,
    toolType: String(tool.toolType ?? tool.tool_type) as BenchToolInstance["toolType"],
    capacity_ml: Number(tool.capacity_ml),
    canReceiveContents: Boolean(tool.canReceiveContents ?? tool.can_receive_contents),
    canReceiveLiquids: Boolean(tool.canReceiveLiquids ?? tool.can_receive_liquids),
    canReceiveProduce: Boolean(tool.canReceiveProduce ?? tool.can_receive_produce),
    canSeal: Boolean(tool.canSeal ?? tool.can_seal),
    contactImpurityMgPerG: Number(tool.contactImpurityMgPerG ?? tool.contact_impurity_mg_per_g ?? 0),
    internalPressureBar: Number(tool.internalPressureBar ?? tool.internal_pressure_bar ?? 1.0),
    trappedCo2MassG: Number(tool.trappedCo2MassG ?? tool.trapped_co2_mass_g ?? 0),
    isSealed: Boolean(tool.isSealed ?? tool.is_sealed ?? false),
    closureFault:
      tool.closureFault !== undefined
        ? tool.closureFault === null
          ? null
          : String(tool.closureFault)
        : tool.closure_fault !== undefined && tool.closure_fault !== null
          ? String(tool.closure_fault)
          : null,
    fieldLabelText:
      tool.fieldLabelText !== undefined
        ? (tool.fieldLabelText as string | null)
        : tool.field_label_text !== undefined
          ? (tool.field_label_text as string | null)
          : null,
    isDraggable: Boolean(tool.isDraggable ?? tool.is_draggable),
    isDiscardable: Boolean(tool.isDiscardable ?? tool.is_discardable ?? true),
    isStorable: Boolean(tool.isStorable ?? tool.is_storable ?? false),
    canStore: Boolean(tool.canStore ?? tool.can_store ?? false),
    allowedDropTargets: normalizeAllowedDropTargets(tool.allowedDropTargets ?? tool.allowed_drop_targets),
    children: normalizeContainedEntities(tool.children),
    containment: normalizeContainment(tool.containment),
    labels: ((tool.labels ?? []) as Array<BenchLabel & Record<string, unknown>>).map((label) =>
      normalizeBenchLabel(label),
    ),
    produceLots,
    produceFractions,
    powderMassG,
    containsSlurry,
    liquids:
      (tool.liquids as BenchLiquidPortion[] | undefined)?.map((liquid) =>
        normalizeBenchLiquid(liquid as BenchLiquidPortion & Record<string, unknown>),
      ) ?? [],
    quechersState: {
      saltsAdded: Boolean(rawQuechersState.saltsAdded ?? rawQuechersState.salts_added ?? false),
      phase: String(rawQuechersState.phase ?? "idle") as NonNullable<
        BenchToolInstance["quechersState"]
      >["phase"],
      temperatureC: Number(rawQuechersState.temperatureC ?? rawQuechersState.temperature_c ?? 20),
      cementationProgress: Number(
        rawQuechersState.cementationProgress ?? rawQuechersState.cementation_progress ?? 0,
      ),
      thermalDegradationProgress: Number(
        rawQuechersState.thermalDegradationProgress ??
          rawQuechersState.thermal_degradation_progress ??
          0,
      ),
      reactionElapsedSeconds: Number(
        rawQuechersState.reactionElapsedSeconds ?? rawQuechersState.reaction_elapsed_seconds ?? 0,
      ),
      fault:
        rawQuechersState.fault === undefined || rawQuechersState.fault === null
          ? null
          : String(rawQuechersState.fault),
      isUsable: Boolean(rawQuechersState.isUsable ?? rawQuechersState.is_usable ?? true),
    },
  };
}

function normalizeProduceMaterialState(
  state: ProduceMaterialState & Record<string, unknown>,
): ProduceMaterialState {
  return {
    id: String(state.id ?? ""),
    produceLotId: String(state.produceLotId ?? state.produce_lot_id ?? ""),
    materialState: String(state.materialState ?? state.material_state ?? "whole") as ProduceMaterialState["materialState"],
    temperatureC: Number(state.temperatureC ?? state.temperature_c ?? 20),
    grindQualityLabel:
      state.grindQualityLabel !== undefined
        ? (state.grindQualityLabel as string | null)
        : state.grind_quality_label !== undefined
          ? (state.grind_quality_label as string | null)
          : null,
    homogeneityScore:
      state.homogeneityScore !== undefined && state.homogeneityScore !== null
        ? Number(state.homogeneityScore)
        : state.homogeneity_score !== undefined && state.homogeneity_score !== null
          ? Number(state.homogeneity_score)
          : null,
    residualCo2MassG: Number(state.residualCo2MassG ?? state.residual_co2_mass_g ?? 0),
  };
}

function normalizeProduceFractions(raw: unknown): ProduceFraction[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((fraction: Record<string, unknown>) => {
    const exposureIdsRaw = fraction.exposureContainerIds ?? fraction.exposure_container_ids;
    return {
      id: String(fraction.id ?? ""),
      produceLotId: String(fraction.produceLotId ?? fraction.produce_lot_id ?? ""),
      produceMaterialStateId: String(
        fraction.produceMaterialStateId ?? fraction.produce_material_state_id ?? "",
      ),
      isMixed: Boolean(fraction.isMixed ?? fraction.is_mixed ?? false),
      massG: Number(fraction.massG ?? fraction.mass_g ?? 0),
      unitCount:
        fraction.unitCount !== undefined && fraction.unitCount !== null
          ? Number(fraction.unitCount)
          : fraction.unit_count !== undefined && fraction.unit_count !== null
            ? Number(fraction.unit_count)
            : null,
      isContaminated: Boolean(fraction.isContaminated ?? fraction.is_contaminated ?? false),
      impurityMassMg: Number(fraction.impurityMassMg ?? fraction.impurity_mass_mg ?? 0),
      exposureContainerIds: Array.isArray(exposureIdsRaw)
        ? exposureIdsRaw.map((id: unknown) => String(id))
        : [],
      locationKind: (fraction.locationKind ?? fraction.location_kind ?? null) as ProduceFraction["locationKind"],
      locationId:
        fraction.locationId !== undefined
          ? (fraction.locationId as string | null)
          : fraction.location_id !== undefined
            ? (fraction.location_id as string | null)
            : null,
      containerId:
        fraction.containerId !== undefined
          ? (fraction.containerId as string | null)
          : fraction.container_id !== undefined
            ? (fraction.container_id as string | null)
            : null,
      containerLabel:
        fraction.containerLabel !== undefined
          ? (fraction.containerLabel as string | null)
          : fraction.container_label !== undefined
            ? (fraction.container_label as string | null)
            : null,
    };
  });
}

function normalizeSpatulaState(
  spatula: SpatulaState & Record<string, unknown>,
): SpatulaState {
  const produceFractions = normalizeProduceFractions(spatula.produceFractions ?? spatula.produce_fractions);
  const normalized: SpatulaState = {
    isLoaded: Boolean(spatula.isLoaded ?? spatula.is_loaded ?? false),
    produceFractions,
    sourceToolId:
      spatula.sourceToolId !== undefined
        ? (spatula.sourceToolId as string | null)
        : spatula.source_tool_id !== undefined
          ? (spatula.source_tool_id as string | null)
          : null,
  };
  const allowedLoadSourceToolTypes = spatula.allowedLoadSourceToolTypes ?? spatula.allowed_load_source_tool_types;
  if (Array.isArray(allowedLoadSourceToolTypes)) {
    normalized.allowedLoadSourceToolTypes = allowedLoadSourceToolTypes as SpatulaState["allowedLoadSourceToolTypes"];
  }
  const allowedPourTargetToolTypes = spatula.allowedPourTargetToolTypes ?? spatula.allowed_pour_target_tool_types;
  if (Array.isArray(allowedPourTargetToolTypes)) {
    normalized.allowedPourTargetToolTypes = allowedPourTargetToolTypes as SpatulaState["allowedPourTargetToolTypes"];
  }
  if (spatula.canDiscard !== undefined || spatula.can_discard !== undefined) {
    normalized.canDiscard = Boolean(spatula.canDiscard ?? spatula.can_discard);
  }
  if (spatula.clickIncrementMuG !== undefined || spatula.click_increment_mu_g !== undefined) {
    normalized.clickIncrementMuG = Number(spatula.clickIncrementMuG ?? spatula.click_increment_mu_g);
  }
  if (spatula.clickIncrementSigmaG !== undefined || spatula.click_increment_sigma_g !== undefined) {
    normalized.clickIncrementSigmaG = Number(spatula.clickIncrementSigmaG ?? spatula.click_increment_sigma_g);
  }
  if (spatula.holdInitialRateG !== undefined || spatula.hold_initial_rate_g !== undefined) {
    normalized.holdInitialRateG = Number(spatula.holdInitialRateG ?? spatula.hold_initial_rate_g);
  }
  if (spatula.holdIntervalMs !== undefined || spatula.hold_interval_ms !== undefined) {
    normalized.holdIntervalMs = Number(spatula.holdIntervalMs ?? spatula.hold_interval_ms);
  }
  if (spatula.holdLiftRateGPerPx !== undefined || spatula.hold_lift_rate_g_per_px !== undefined) {
    normalized.holdLiftRateGPerPx = Number(spatula.holdLiftRateGPerPx ?? spatula.hold_lift_rate_g_per_px);
  }
  if (spatula.holdMaxRateG !== undefined || spatula.hold_max_rate_g !== undefined) {
    normalized.holdMaxRateG = Number(spatula.holdMaxRateG ?? spatula.hold_max_rate_g);
  }
  if (spatula.holdThresholdMs !== undefined || spatula.hold_threshold_ms !== undefined) {
    normalized.holdThresholdMs = Number(spatula.holdThresholdMs ?? spatula.hold_threshold_ms);
  }
  return normalized;
}

function getGroundProduceMassG(
  produceFractions: ProduceFraction[],
  materialStates: ProduceMaterialState[],
): number {
  const statesById = new Map(materialStates.map((state) => [state.id, state]));
  return produceFractions.reduce(
    (sum, fraction) =>
      statesById.get(fraction.produceMaterialStateId)?.materialState === "ground" ? sum + fraction.massG : sum,
    0,
  );
}

function normalizeAnalyticalBalanceState(
  analyticalBalance: AnalyticalBalanceState & Record<string, unknown>,
): AnalyticalBalanceState {
  return {
    tareMassG:
      analyticalBalance.tareMassG !== undefined && analyticalBalance.tareMassG !== null
        ? Number(analyticalBalance.tareMassG)
        : analyticalBalance.tare_mass_g !== undefined && analyticalBalance.tare_mass_g !== null
          ? Number(analyticalBalance.tare_mass_g)
          : null,
    taredToolId:
      analyticalBalance.taredToolId !== undefined
        ? (analyticalBalance.taredToolId as string | null)
        : analyticalBalance.tared_tool_id !== undefined
          ? (analyticalBalance.tared_tool_id as string | null)
          : null,
  };
}

function normalizeBenchLabel(label: BenchLabel & Record<string, unknown>): BenchLabel {
  return {
    id: String(label.id),
    labelKind: String(label.labelKind ?? label.label_kind ?? "manual") as BenchLabel["labelKind"],
    text: String(label.text ?? ""),
    receivedDate:
      label.receivedDate !== undefined
        ? (label.receivedDate as string | null)
        : label.received_date !== undefined
          ? (label.received_date as string | null)
          : null,
    sampleCode:
      label.sampleCode !== undefined
        ? (label.sampleCode as string | null)
        : label.sample_code !== undefined
          ? (label.sample_code as string | null)
          : null,
    isDraggable: Boolean(label.isDraggable ?? label.is_draggable),
    allowedDropTargets: normalizeAllowedDropTargets(label.allowedDropTargets ?? label.allowed_drop_targets),
  };
}

function normalizePrintedLabelTicket(
  ticket: PrintedLabelTicket & Record<string, unknown>,
): PrintedLabelTicket {
  return {
    id: String(ticket.id),
    sampleCode: String(ticket.sampleCode ?? ticket.sample_code),
    labelText: String(ticket.labelText ?? ticket.label_text),
    receivedDate: String(ticket.receivedDate ?? ticket.received_date ?? ""),
    isDraggable: Boolean(ticket.isDraggable ?? ticket.is_draggable),
    allowedDropTargets: normalizeAllowedDropTargets(ticket.allowedDropTargets ?? ticket.allowed_drop_targets),
  };
}

function normalizeLimsReception(
  reception: (LimsReception & Record<string, unknown>) | null | undefined,
): LimsReception {
  return {
    id:
      reception?.id !== undefined && reception.id !== null
        ? String(reception.id)
        : null,
    orchardName: String(reception?.orchardName ?? reception?.orchard_name ?? ""),
    harvestDate: String(reception?.harvestDate ?? reception?.harvest_date ?? ""),
    indicativeMassG: Number(reception?.indicativeMassG ?? reception?.indicative_mass_g ?? 0),
    measuredGrossMassG:
      reception?.measuredGrossMassG !== undefined && reception.measuredGrossMassG !== null
        ? Number(reception.measuredGrossMassG)
      : reception?.measured_gross_mass_g !== undefined && reception.measured_gross_mass_g !== null
          ? Number(reception.measured_gross_mass_g)
          : null,
    grossMassOffsetG:
      reception?.grossMassOffsetG !== undefined && reception.grossMassOffsetG !== null
        ? Number(reception.grossMassOffsetG)
        : reception?.gross_mass_offset_g !== undefined && reception.gross_mass_offset_g !== null
          ? Number(reception.gross_mass_offset_g)
          : 0,
    measuredSampleMassG:
      reception?.measuredSampleMassG !== undefined && reception.measuredSampleMassG !== null
        ? Number(reception.measuredSampleMassG)
      : reception?.measured_sample_mass_g !== undefined && reception.measured_sample_mass_g !== null
          ? Number(reception.measured_sample_mass_g)
          : null,
    labSampleCode:
      reception?.labSampleCode !== undefined
        ? (reception.labSampleCode as string | null)
        : reception?.lab_sample_code !== undefined
          ? (reception.lab_sample_code as string | null)
          : null,
    status: String(reception?.status ?? "awaiting_reception") as LimsReception["status"],
    printedLabelTicket:
      reception?.printedLabelTicket !== undefined && reception.printedLabelTicket !== null
        ? normalizePrintedLabelTicket(
            reception.printedLabelTicket as PrintedLabelTicket & Record<string, unknown>,
          )
        : reception?.printed_label_ticket !== undefined && reception.printed_label_ticket !== null
          ? normalizePrintedLabelTicket(
              reception.printed_label_ticket as PrintedLabelTicket & Record<string, unknown>,
            )
          : null,
  };
}

function normalizeRackSlot(slot: RackSlot, materialStates: ProduceMaterialState[] = []): RackSlot {
  const rawSlot = slot as RackSlot & Record<string, unknown>;
  return {
    children: normalizeContainedEntities(rawSlot.children),
    containment: normalizeContainment(rawSlot.containment),
    id: slot.id,
    label: slot.label,
    dropTargetTypes: normalizeAllowedDropTargets(
      rawSlot.dropTargetTypes ??
      rawSlot.drop_target_types,
    ),
    tool: slot.tool
      ? normalizeBenchTool(slot.tool as BenchToolInstance & Record<string, unknown>, materialStates)
      : null,
  };
}

function normalizeBenchLiquid(liquid: BenchLiquidPortion & Record<string, unknown>): BenchLiquidPortion {
  return {
    id: liquid.id,
    liquidId: String(liquid.liquidId ?? liquid.liquid_id),
    name: liquid.name,
    volume_ml: Number(liquid.volume_ml),
    accent: liquid.accent,
  };
}

function normalizeTrashProduceLot(entry: TrashProduceLotEntry & Record<string, unknown>): TrashProduceLotEntry {
  const produceFractionRaw = entry.produceFraction ?? entry.produce_fraction;
  const produceFractions =
    produceFractionRaw === undefined || produceFractionRaw === null
      ? []
      : normalizeProduceFractions([produceFractionRaw]);

  return {
    id: String(entry.id),
    originLabel: String(entry.originLabel ?? entry.origin_label),
    produceLot: normalizeProduceLot(
      (entry.produceLot ?? entry.produce_lot) as ExperimentProduceLot & Record<string, unknown>,
      buildProduceLotNormalizationContext(new Map(), new Map(), produceFractions),
    ),
  };
}

function normalizeTrashSampleLabel(entry: TrashSampleLabelEntry & Record<string, unknown>): TrashSampleLabelEntry {
  return {
    id: String(entry.id),
    originLabel: String(entry.originLabel ?? entry.origin_label),
    label: normalizeBenchLabel((entry.label ?? {}) as BenchLabel & Record<string, unknown>),
  };
}

function normalizeWorkspaceWidget(
  widget: ExperimentWorkspaceWidget & Record<string, unknown>,
  materialStates: ProduceMaterialState[] = [],
): ExperimentWorkspaceWidget {
  const statesByLotId = new Map(materialStates.map((state) => [state.produceLotId, state]));
  const statesById = new Map(materialStates.map((state) => [state.id, state]));
  const rawProduceLots = (widget.produceLots ?? widget.produce_lots ?? []) as unknown[];
  const produceFractions = normalizeProduceFractions(widget.produceFractions ?? widget.produce_fractions);
  const produceLotContext = buildProduceLotNormalizationContext(statesByLotId, statesById, produceFractions);
  const rawTool = (widget.tool ?? (widget as Record<string, unknown>).tool) as
    | (BenchToolInstance & Record<string, unknown>)
    | null
    | undefined;

  return {
    children: normalizeContainedEntities(widget.children),
    containment: normalizeContainment(widget.containment),
    id: String(widget.id) as ExperimentWorkspaceWidget["id"],
    widgetType: String(widget.widgetType ?? widget.widget_type) as ExperimentWorkspaceWidget["widgetType"],
    label: String(widget.label),
    dropTargetTypes: normalizeAllowedDropTargets(widget.dropTargetTypes ?? widget.drop_target_types),
    isDraggable: Boolean(widget.isDraggable ?? widget.is_draggable ?? false),
    allowedDropTargets: normalizeAllowedDropTargets(widget.allowedDropTargets ?? widget.allowed_drop_targets),
    isStorable: Boolean(widget.isStorable ?? widget.is_storable ?? false),
    canStore: Boolean(widget.canStore ?? widget.can_store ?? false),
    anchor: String(widget.anchor ?? "top-left") as WidgetAnchor,
    grinderRunDurationMs: Number(widget.grinderRunDurationMs ?? widget.grinder_run_duration_ms ?? 0),
    grinderRunRemainingMs: Number(widget.grinderRunRemainingMs ?? widget.grinder_run_remaining_ms ?? 0),
    grinderFault:
      widget.grinderFault !== undefined
        ? String(widget.grinderFault)
        : widget.grinder_fault !== undefined && widget.grinder_fault !== null
          ? String(widget.grinder_fault)
          : null,
    grinderCanStart: Boolean(widget.grinderCanStart ?? widget.grinder_can_start ?? false),
    grinderStartBlockReason:
      widget.grinderStartBlockReason !== undefined && widget.grinderStartBlockReason !== null
        ? String(widget.grinderStartBlockReason)
        : widget.grinder_start_block_reason !== undefined && widget.grinder_start_block_reason !== null
          ? String(widget.grinder_start_block_reason)
          : null,
    grinderDisplayMode:
      widget.grinderDisplayMode !== undefined && widget.grinderDisplayMode !== null
        ? String(widget.grinderDisplayMode)
        : widget.grinder_display_mode !== undefined && widget.grinder_display_mode !== null
          ? String(widget.grinder_display_mode)
          : null,
    vortexRunDurationMs: Number(widget.vortexRunDurationMs ?? widget.vortex_run_duration_ms ?? 0),
    vortexRunRemainingMs: Number(widget.vortexRunRemainingMs ?? widget.vortex_run_remaining_ms ?? 0),
    offsetX: Number(widget.offsetX ?? widget.offset_x),
    offsetY: Number(widget.offsetY ?? widget.offset_y),
    isPresent: Boolean(widget.isPresent ?? widget.is_present),
    isTrashed: Boolean(widget.isTrashed ?? widget.is_trashed),
    tool:
      rawTool === undefined
        ? undefined
        : rawTool === null
          ? null
          : normalizeBenchTool(rawTool, materialStates),
    produceLots: rawProduceLots.map((lot) =>
      normalizeProduceLot(lot as ExperimentProduceLot & Record<string, unknown>, produceLotContext),
    ),
    liquids:
      (widget.liquids as BenchLiquidPortion[] | undefined)?.map((liquid) =>
        normalizeBenchLiquid(liquid as BenchLiquidPortion & Record<string, unknown>),
      ) ?? [],
  };
}

type ProduceLotNormalizationContext = {
  fractionsByLotId: Map<string, ProduceFraction>;
  statesById: Map<string, ProduceMaterialState>;
  statesByLotId: Map<string, ProduceMaterialState>;
};

function buildProduceLotNormalizationContext(
  statesByLotId: Map<string, ProduceMaterialState>,
  statesById: Map<string, ProduceMaterialState>,
  fractions: ProduceFraction[] = [],
): ProduceLotNormalizationContext {
  return {
    statesById,
    statesByLotId,
    fractionsByLotId: new Map(fractions.map((fraction) => [fraction.produceLotId, fraction])),
  };
}

function normalizeProduceLot(
  lot: ExperimentProduceLot & Record<string, unknown>,
  context: ProduceLotNormalizationContext,
): ExperimentProduceLot {
  const unitCountValue = lot.unitCount ?? lot.unit_count;
  const lotId = String(lot.id);
  const fractionRecord = context.fractionsByLotId.get(lotId);
  const stateRecord =
    (fractionRecord ? context.statesById.get(fractionRecord.produceMaterialStateId) : undefined) ??
    context.statesByLotId.get(lotId);
  const derivedState = stateRecord?.materialState;

  return {
    materialState: String(
      lot.materialState ?? lot.material_state ?? derivedState ?? "whole",
    ) as ExperimentProduceLot["materialState"],
    grindQualityLabel:
      stateRecord?.grindQualityLabel ??
      (lot.grindQualityLabel !== undefined
        ? String(lot.grindQualityLabel)
        : lot.grind_quality_label !== undefined && lot.grind_quality_label !== null
          ? String(lot.grind_quality_label)
          : null),
    homogeneityScore:
      stateRecord?.homogeneityScore ??
      (lot.homogeneityScore !== undefined
        ? Number(lot.homogeneityScore)
        : lot.homogeneity_score !== undefined && lot.homogeneity_score !== null
          ? Number(lot.homogeneity_score)
          : null),
    id: lotId,
    isContaminated: fractionRecord?.isContaminated ?? Boolean(lot.isContaminated ?? lot.is_contaminated),
    isDraggable: Boolean(lot.isDraggable ?? lot.is_draggable ?? true),
    allowedDropTargets: normalizeAllowedDropTargets(lot.allowedDropTargets ?? lot.allowed_drop_targets),
    label: String(lot.label),
    produceType: String(lot.produceType ?? lot.produce_type) as ExperimentProduceLot["produceType"],
    residualCo2MassG: Number(
      stateRecord?.residualCo2MassG ?? lot.residualCo2MassG ?? lot.residual_co2_mass_g ?? 0,
    ),
    temperatureC: Number(stateRecord?.temperatureC ?? lot.temperatureC ?? lot.temperature_c ?? 20),
    totalMassG: Number(lot.totalMassG ?? lot.total_mass_g),
    unitCount:
      unitCountValue !== undefined && unitCountValue !== null
        ? Number(unitCountValue)
        : fractionRecord?.unitCount ?? null,
  };
}
