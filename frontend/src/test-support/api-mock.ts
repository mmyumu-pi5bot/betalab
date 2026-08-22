import { vi } from "vitest";

import {
  acquisitionMethodCatalogFixture,
  acquisitionMethodFixture,
  mrmReferenceCatalogFixture,
} from "@/test-support/acquisition-method-fixture";
import { toolbarCatalogFixture } from "@/test-support/toolbar-catalog-fixture";
import type { Experiment } from "@/types/experiment";
import type {
  AcquisitionMethod,
  AcquisitionMethodSummary,
  MrmTransition,
  ReferenceCompound,
  SavedAcquisitionMethod,
  ToolbarCategory,
} from "@/types/workbench";

export const createExperiment = vi.fn<() => Promise<Experiment>>();
export const renameExperiment = vi.fn<
  (experimentId: string, name: string) => Promise<Experiment>
>();
export const getToolbarCatalog = vi.fn<() => Promise<ToolbarCategory[]>>(() =>
  Promise.resolve(toolbarCatalogFixture),
);
export const getAcquisitionMethodCatalog = vi.fn<() => Promise<AcquisitionMethodSummary[]>>(
  () => Promise.resolve(acquisitionMethodCatalogFixture),
);
export const getAcquisitionMethod = vi.fn<(methodId: string) => Promise<AcquisitionMethod>>(
  () => Promise.resolve(acquisitionMethodFixture),
);
export const getMrmReferenceCatalog = vi.fn<() => Promise<ReferenceCompound[]>>(() =>
  Promise.resolve(mrmReferenceCatalogFixture),
);
export const proposeMrmTransitions = vi.fn<(compoundIds: string[]) => Promise<MrmTransition[]>>(
  () => Promise.resolve(acquisitionMethodFixture.transitions),
);
export const duplicateAcquisitionMethod = vi.fn<
  (payload: {
    name: string;
    newMethodId: string;
    sourceMethodId: string;
    version: string;
  }) => Promise<SavedAcquisitionMethod>
>((payload) =>
  Promise.resolve({
    method: { ...acquisitionMethodFixture, id: payload.newMethodId, isBuiltIn: false },
    warnings: [],
  }),
);
export const saveAcquisitionMethod = vi.fn<
  (
    methodId: string,
    payload: {
      name: string;
      runtimeS: number;
      transitions: MrmTransition[];
      version: string;
    },
  ) => Promise<SavedAcquisitionMethod>
>((methodId) =>
  Promise.resolve({
    method: { ...acquisitionMethodFixture, id: methodId, isBuiltIn: false },
    warnings: [],
  }),
);
export const deleteAcquisitionMethod = vi.fn<(methodId: string) => Promise<void>>(() =>
  Promise.resolve(),
);
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
export const moveObject = wrapCommand("move_object");
export const discardWorkbenchTool = wrapCommand("discard_workbench_tool");
export const storeWorkbenchTool = wrapCommand("store_workbench_tool");
export const discardSampleLabelFromPalette = wrapCommand("discard_sample_label_from_palette");
export const restoreTrashedToolToWorkbenchSlot = wrapCommand("restore_trashed_tool_to_workbench_slot");
export const addWorkspaceWidget = wrapCommand("add_workspace_widget");
export const moveWorkspaceWidget = wrapCommand("move_workspace_widget");
export const storeWorkspaceWidget = wrapCommand("store_workspace_widget");
export const addLiquidToWorkspaceWidget = wrapCommand("add_liquid_to_workspace_widget");
export const addLiquidToTool = wrapCommand("add_liquid_to_tool");
export const updateWorkspaceWidgetLiquidVolume = wrapCommand("update_workspace_widget_liquid_volume");
export const removeLiquidFromWorkspaceWidget = wrapCommand("remove_liquid_from_workspace_widget");
export const completeGrinderCycle = wrapCommand("complete_grinder_cycle");
export const startGrinderCycle = wrapCommand("start_grinder_cycle");
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
export const createLimsReception = wrapCommand("create_lims_reception");
export const acknowledgeReceptionMassCheck = vi.fn(
  (experimentId: string, payload?: Record<string, unknown>) =>
    sendExperimentCommand(experimentId, "acknowledge_reception_mass_check", payload ?? {}),
);
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
export const createDebugToolPreset = wrapCommand("create_debug_tool_preset");
export const placeToolInRackSlot = wrapCommand("place_tool_in_rack_slot");
export const placeWorkbenchToolInRackSlot = wrapCommand("place_workbench_tool_in_rack_slot");
export const moveRackToolBetweenSlots = wrapCommand("move_rack_tool_between_slots");
export const removeRackToolToWorkbenchSlot = wrapCommand("remove_rack_tool_to_workbench_slot");
export const discardRackTool = wrapCommand("discard_rack_tool");
export const restoreTrashedToolToRackSlot = wrapCommand("restore_trashed_tool_to_rack_slot");
export const addLiquidToWorkbenchTool = wrapCommand("add_liquid_to_workbench_tool");
export const addLiquidToAnalyticalBalanceTool = wrapCommand("add_liquid_to_analytical_balance_tool");
export const cutWorkbenchProduceLot = wrapCommand("cut_workbench_produce_lot");
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
export const closeVortexTool = wrapCommand("close_vortex_tool");
export const openVortexTool = wrapCommand("open_vortex_tool");
export const startVortexCycle = wrapCommand("start_vortex_cycle");
export const startCentrifugeCycle = wrapCommand("start_centrifuge_cycle");
export const closeCentrifugeTool = wrapCommand("close_centrifuge_tool");
export const openCentrifugeTool = wrapCommand("open_centrifuge_tool");
export const closeIceBathTool = wrapCommand("close_ice_bath_tool");
export const openIceBathTool = wrapCommand("open_ice_bath_tool");
export const pourExtractToVial = wrapCommand("pour_extract_to_vial");
export const aspiratePipette = wrapCommand("aspirate_pipette");
export const dispensePipette = wrapCommand("dispense_pipette");
export const addCalibrationToVial = wrapCommand("add_calibration_to_vial");
export const loadRackIntoInstrument = wrapCommand("load_rack_into_instrument");
export const runSequence = wrapCommand("run_sequence");
export const skipAcquisition = wrapCommand("skip_acquisition");
export const unloadRackFromInstrument = wrapCommand("unload_rack_from_instrument");
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
  getToolbarCatalog.mockResolvedValue(toolbarCatalogFixture);
  getAcquisitionMethodCatalog.mockResolvedValue(acquisitionMethodCatalogFixture);
  getAcquisitionMethod.mockResolvedValue(acquisitionMethodFixture);
  getMrmReferenceCatalog.mockResolvedValue(mrmReferenceCatalogFixture);
  proposeMrmTransitions.mockResolvedValue(acquisitionMethodFixture.transitions);
  duplicateAcquisitionMethod.mockImplementation((payload) =>
    Promise.resolve({
      method: { ...acquisitionMethodFixture, id: payload.newMethodId, isBuiltIn: false },
      warnings: [],
    }),
  );
  saveAcquisitionMethod.mockImplementation((methodId) =>
    Promise.resolve({
      method: { ...acquisitionMethodFixture, id: methodId, isBuiltIn: false },
      warnings: [],
    }),
  );
  deleteAcquisitionMethod.mockResolvedValue(undefined);
  streamSubscriptions.clear();
}
