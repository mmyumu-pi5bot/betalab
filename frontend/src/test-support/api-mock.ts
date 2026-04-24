import { vi } from "vitest";

import type { Experiment } from "@/types/experiment";

export const createExperiment = vi.fn<() => Promise<Experiment>>();
export const sendExperimentCommand = vi.fn<
  (experimentId: string, type: string, payload: Record<string, unknown>) => Promise<Experiment>
>();
const streamSubscriptions = new Map<
  string,
  {
    onError?: (error: Error) => void;
    onMessage: (experiment: Experiment) => void;
  }
>();

function wrapCommand(type: string, buildPayload?: (payload?: Record<string, unknown>) => Record<string, unknown>) {
  return vi.fn((experimentId: string, payload?: Record<string, unknown>) =>
    sendExperimentCommand(experimentId, type, buildPayload ? buildPayload(payload) : payload ?? {}),
  );
}

export const addWorkbenchSlot = vi.fn((experimentId: string) =>
  sendExperimentCommand(experimentId, "add_workbench_slot", {}),
);
export const removeWorkbenchSlot = wrapCommand("remove_workbench_slot");
export const placeToolOnWorkbench = wrapCommand("place_tool_on_workbench");
export const moveToolBetweenWorkbenchSlots = wrapCommand("move_tool_between_workbench_slots");
export const moveTool = wrapCommand("move_tool");
export const placeToolFromPalette = wrapCommand("place_tool_from_palette");
export const discardWorkbenchTool = wrapCommand("discard_workbench_tool");
export const discardToolFromPalette = wrapCommand("discard_tool_from_palette");
export const discardSampleLabelFromPalette = wrapCommand("discard_sample_label_from_palette");
export const restoreTrashedToolToWorkbenchSlot = wrapCommand("restore_trashed_tool_to_workbench_slot");
export const addWorkspaceWidget = wrapCommand("add_workspace_widget");
export const moveWorkspaceWidget = wrapCommand("move_workspace_widget");
export const storeWorkspaceWidget = wrapCommand("store_workspace_widget");
export const addLiquidToWorkspaceWidget = wrapCommand("add_liquid_to_workspace_widget");
export const updateWorkspaceWidgetLiquidVolume = wrapCommand("update_workspace_widget_liquid_volume");
export const removeLiquidFromWorkspaceWidget = wrapCommand("remove_liquid_from_workspace_widget");
export const completeGrinderCycle = wrapCommand("complete_grinder_cycle");
export const startGrinderCycle = wrapCommand("start_grinder_cycle");
export const addWorkspaceProduceLotToWidget = wrapCommand("add_workspace_produce_lot_to_widget");
export const moveWorkbenchProduceLotToWidget = wrapCommand("move_workbench_produce_lot_to_widget");
export const restoreTrashedProduceLotToWidget = wrapCommand("restore_trashed_produce_lot_to_widget");
export const createProduceLot = wrapCommand("create_produce_lot");
export const placeReceivedBagOnWorkbench = wrapCommand("place_received_bag_on_workbench");
export const discardBasketTool = vi.fn((experimentId: string, payload?: Record<string, unknown>) =>
  sendExperimentCommand(experimentId, "discard_basket_tool", payload ?? {}),
);
export const moveWorkbenchToolToGrossBalance = wrapCommand("move_workbench_tool_to_gross_balance");
export const moveWorkbenchToolToAnalyticalBalance = wrapCommand("move_workbench_tool_to_analytical_balance");
export const moveBasketToolToGrossBalance = vi.fn((experimentId: string, payload?: Record<string, unknown>) =>
  sendExperimentCommand(experimentId, "move_basket_tool_to_gross_balance", payload ?? {}),
);
export const moveAnalyticalBalanceToolToGrossBalance = vi.fn((experimentId: string) =>
  sendExperimentCommand(experimentId, "move_analytical_balance_tool_to_gross_balance", {}),
);
export const placeToolOnGrossBalance = wrapCommand("place_tool_on_gross_balance");
export const placeToolOnAnalyticalBalance = wrapCommand("place_tool_on_analytical_balance");
export const moveRackToolToGrossBalance = wrapCommand("move_rack_tool_to_gross_balance");
export const moveRackToolToAnalyticalBalance = wrapCommand("move_rack_tool_to_analytical_balance");
export const restoreTrashedToolToGrossBalance = wrapCommand("restore_trashed_tool_to_gross_balance");
export const restoreTrashedToolToAnalyticalBalance = wrapCommand("restore_trashed_tool_to_analytical_balance");
export const moveGrossBalanceToolToWorkbench = wrapCommand("move_gross_balance_tool_to_workbench");
export const moveGrossBalanceToolToRack = wrapCommand("move_gross_balance_tool_to_rack");
export const moveGrossBalanceToolToAnalyticalBalance = vi.fn((experimentId: string) =>
  sendExperimentCommand(experimentId, "move_gross_balance_tool_to_analytical_balance", {}),
);
export const moveAnalyticalBalanceToolToWorkbench = wrapCommand("move_analytical_balance_tool_to_workbench");
export const moveAnalyticalBalanceToolToRack = wrapCommand("move_analytical_balance_tool_to_rack");
export const discardGrossBalanceTool = vi.fn((experimentId: string) =>
  sendExperimentCommand(experimentId, "discard_gross_balance_tool", {}),
);
export const discardAnalyticalBalanceTool = vi.fn((experimentId: string) =>
  sendExperimentCommand(experimentId, "discard_analytical_balance_tool", {}),
);
export const openGrossBalanceTool = vi.fn((experimentId: string) =>
  sendExperimentCommand(experimentId, "open_gross_balance_tool", {}),
);
export const closeGrossBalanceTool = vi.fn((experimentId: string) =>
  sendExperimentCommand(experimentId, "close_gross_balance_tool", {}),
);
export const openAnalyticalBalanceTool = vi.fn((experimentId: string) =>
  sendExperimentCommand(experimentId, "open_analytical_balance_tool", {}),
);
export const closeAnalyticalBalanceTool = vi.fn((experimentId: string) =>
  sendExperimentCommand(experimentId, "close_analytical_balance_tool", {}),
);
export const recordGrossWeight = vi.fn((experimentId: string, payload?: Record<string, unknown>) =>
  sendExperimentCommand(experimentId, "record_gross_weight", payload ?? {}),
);
export const setGrossBalanceContainerOffset = wrapCommand("set_gross_balance_container_offset");
export const tareAnalyticalBalance = vi.fn((experimentId: string) =>
  sendExperimentCommand(experimentId, "tare_analytical_balance", {}),
);
export const recordAnalyticalSampleMass = vi.fn((experimentId: string) =>
  sendExperimentCommand(experimentId, "record_analytical_sample_mass", {}),
);
export const moveWorkspaceProduceLotToGrossBalance = wrapCommand("move_workspace_produce_lot_to_gross_balance");
export const moveWorkbenchProduceLotToGrossBalance = wrapCommand("move_workbench_produce_lot_to_gross_balance");
export const moveWidgetProduceLotToGrossBalance = wrapCommand("move_widget_produce_lot_to_gross_balance");
export const restoreTrashedProduceLotToGrossBalance = wrapCommand("restore_trashed_produce_lot_to_gross_balance");
export const moveGrossBalanceProduceLotToWorkbench = wrapCommand("move_gross_balance_produce_lot_to_workbench");
export const moveGrossBalanceProduceLotToWidget = vi.fn((experimentId: string, payload?: Record<string, unknown>) =>
  sendExperimentCommand(experimentId, "move_gross_balance_produce_lot_to_widget", payload ?? {}),
);
export const discardGrossBalanceProduceLot = vi.fn((experimentId: string, payload?: Record<string, unknown>) =>
  sendExperimentCommand(experimentId, "discard_gross_balance_produce_lot", payload ?? {}),
);
export const createLimsReception = wrapCommand("create_lims_reception");
export const printLimsLabel = vi.fn((experimentId: string, payload?: Record<string, unknown>) =>
  sendExperimentCommand(experimentId, "print_lims_label", payload ?? {}),
);
export const discardPrintedLimsLabel = vi.fn((experimentId: string) =>
  sendExperimentCommand(experimentId, "discard_printed_lims_label", {}),
);
export const applyPrintedLimsLabel = wrapCommand("apply_printed_lims_label");
export const applyPrintedLimsLabelToGrossBalanceBag = vi.fn((experimentId: string) =>
  sendExperimentCommand(experimentId, "apply_printed_lims_label_to_gross_balance_bag", {}),
);
export const applyPrintedLimsLabelToAnalyticalBalanceTool = vi.fn((experimentId: string) =>
  sendExperimentCommand(experimentId, "apply_printed_lims_label_to_analytical_balance_tool", {}),
);
export const applyPrintedLimsLabelToBasketBag = vi.fn((experimentId: string) =>
  sendExperimentCommand(experimentId, "apply_printed_lims_label_to_basket_bag", {}),
);
export const applySampleLabelToGrossBalanceTool = vi.fn((experimentId: string) =>
  sendExperimentCommand(experimentId, "apply_sample_label_to_gross_balance_tool", {}),
);
export const applySampleLabelToAnalyticalBalanceTool = vi.fn((experimentId: string) =>
  sendExperimentCommand(experimentId, "apply_sample_label_to_analytical_balance_tool", {}),
);
export const createDebugProduceLotOnWorkbench = wrapCommand("create_debug_produce_lot_on_workbench");
export const createDebugProduceLotToWidget = wrapCommand("create_debug_produce_lot_to_widget");
export const discardWorkspaceProduceLot = wrapCommand("discard_workspace_produce_lot");
export const moveWidgetProduceLotToWorkbenchTool = wrapCommand("move_widget_produce_lot_to_workbench_tool");
export const discardWidgetProduceLot = wrapCommand("discard_widget_produce_lot");
export const placeToolInRackSlot = wrapCommand("place_tool_in_rack_slot");
export const placeWorkbenchToolInRackSlot = wrapCommand("place_workbench_tool_in_rack_slot");
export const moveRackToolBetweenSlots = wrapCommand("move_rack_tool_between_slots");
export const removeRackToolToWorkbenchSlot = wrapCommand("remove_rack_tool_to_workbench_slot");
export const discardRackTool = wrapCommand("discard_rack_tool");
export const restoreTrashedToolToRackSlot = wrapCommand("restore_trashed_tool_to_rack_slot");
export const addLiquidToWorkbenchTool = wrapCommand("add_liquid_to_workbench_tool");
export const addLiquidToAnalyticalBalanceTool = wrapCommand("add_liquid_to_analytical_balance_tool");
export const addProduceLotToWorkbenchTool = wrapCommand("add_produce_lot_to_workbench_tool");
export const discardProduceLotFromWorkbenchTool = wrapCommand("discard_produce_lot_from_workbench_tool");
export const cutWorkbenchProduceLot = wrapCommand("cut_workbench_produce_lot");
export const moveProduceLotBetweenWorkbenchTools = wrapCommand("move_produce_lot_between_workbench_tools");
export const restoreTrashedProduceLotToWorkbenchTool = wrapCommand("restore_trashed_produce_lot_to_workbench_tool");
export const removeLiquidFromWorkbenchTool = wrapCommand("remove_liquid_from_workbench_tool");
export const applySampleLabelToWorkbenchTool = wrapCommand("apply_sample_label_to_workbench_tool");
export const closeWorkbenchTool = wrapCommand("close_workbench_tool");
export const openWorkbenchTool = wrapCommand("open_workbench_tool");
export const discardSpatula = vi.fn((experimentId: string) =>
  sendExperimentCommand(experimentId, "discard_spatula", {}),
);
export const loadSpatulaFromWorkbenchTool = wrapCommand("load_spatula_from_workbench_tool");
export const loadSpatulaFromAnalyticalBalanceTool = vi.fn((experimentId: string) =>
  sendExperimentCommand(experimentId, "load_spatula_from_analytical_balance_tool", {}),
);
export const pourSpatulaIntoWorkbenchTool = wrapCommand("pour_spatula_into_workbench_tool");
export const pourSpatulaIntoAnalyticalBalanceTool = wrapCommand("pour_spatula_into_analytical_balance_tool");
export const updateAnalyticalBalanceToolSampleLabelText = wrapCommand("update_analytical_balance_tool_sample_label_text");
export const updateWorkbenchToolSampleLabelText = wrapCommand("update_workbench_tool_sample_label_text");
export const moveWorkbenchSampleLabelToGrossBalance = wrapCommand("move_workbench_sample_label_to_gross_balance");
export const moveWorkbenchSampleLabelToAnalyticalBalance = wrapCommand("move_workbench_sample_label_to_analytical_balance");
export const moveSampleLabelBetweenWorkbenchTools = wrapCommand("move_sample_label_between_workbench_tools");
export const discardSampleLabelFromWorkbenchTool = wrapCommand("discard_sample_label_from_workbench_tool");
export const restoreTrashedSampleLabelToGrossBalance = wrapCommand("restore_trashed_sample_label_to_gross_balance");
export const restoreTrashedSampleLabelToAnalyticalBalance = wrapCommand("restore_trashed_sample_label_to_analytical_balance");
export const restoreTrashedSampleLabelToWorkbenchTool = wrapCommand("restore_trashed_sample_label_to_workbench_tool");
export const moveWorkbenchToolToVortex = wrapCommand("move_workbench_tool_to_vortex");
export const moveRackToolToVortex = wrapCommand("move_rack_tool_to_vortex");
export const moveAnalyticalBalanceToolToVortex = wrapCommand("move_analytical_balance_tool_to_vortex");
export const moveGrossBalanceToolToVortex = wrapCommand("move_gross_balance_tool_to_vortex");
export const placeToolOnVortex = wrapCommand("place_tool_on_vortex");
export const restoreTrashedToolToVortex = wrapCommand("restore_trashed_tool_to_vortex");
export const moveVortexToolToWorkbench = wrapCommand("move_vortex_tool_to_workbench");
export const moveVortexToolToAnalyticalBalance = wrapCommand("move_vortex_tool_to_analytical_balance");
export const moveVortexToolToGrossBalance = wrapCommand("move_vortex_tool_to_gross_balance");
export const discardVortexTool = wrapCommand("discard_vortex_tool");
export const startVortexCycle = wrapCommand("start_vortex_cycle");
export const subscribeToExperimentStream = vi.fn((experimentId: string, handlers: {
  onError?: (error: Error) => void;
  onMessage: (experiment: Experiment) => void;
}) => {
  streamSubscriptions.set(experimentId, handlers);
  return () => {
    streamSubscriptions.delete(experimentId);
  };
});

export function emitExperimentSnapshot(experimentId: string, experiment: Experiment) {
  streamSubscriptions.get(experimentId)?.onMessage(experiment);
}

export function resetApiMocks() {
  vi.clearAllMocks();
  streamSubscriptions.clear();
}
