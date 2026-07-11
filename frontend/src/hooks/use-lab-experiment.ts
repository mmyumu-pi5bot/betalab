"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createExperiment, getExperiment, subscribeToExperimentStream } from "@/lib/api";
import { mutationFns, type MutationFn } from "@/lib/experiment-mutation-fns";
import { useCommandPending } from "@/hooks/use-command-pending";
import type { Experiment } from "@/types/experiment";
import type {
  AddLiquidToAnalyticalBalanceToolPayload,
  AddLiquidToToolPayload,
  AddLiquidToWorkbenchToolPayload,
  AddLiquidToWorkspaceWidgetPayload,
  AddWorkspaceWidgetPayload,
  ApplyPrintedLimsLabelPayload,
  BasketToolReferencePayload,
  ApplyPrintedLimsLabelToAnalyticalBalanceToolPayload,
  ApplySampleLabelToGrossBalanceToolPayload,
  ApplySampleLabelToAnalyticalBalanceToolPayload,
  ApplySampleLabelToWorkbenchToolPayload,
  CloseWorkbenchToolPayload,
  CompleteGrinderCyclePayload,
  CreateDebugProduceLotOnWorkbenchPayload,
  CreateDebugProduceLotToWidgetPayload,
  CreateDebugToolPresetPayload,
  CreateLimsReceptionPayload,
  CreateProduceLotPayload,
  CutWorkbenchProduceLotPayload,
  DiscardRackToolPayload,
  DiscardWorkbenchToolPayload,
  StoreWorkbenchToolPayload,
  StoreWorkspaceWidgetPayload,
  LoadSpatulaFromWorkbenchToolPayload,
  MoveAnalyticalBalanceToolToRackPayload,
  MoveAnalyticalBalanceToolToWorkbenchPayload,
  MoveGrossBalanceToolToRackPayload,
  MoveGrossBalanceToolToWorkbenchPayload,
  MoveRackToolBetweenSlotsPayload,
  MoveRackToolToAnalyticalBalancePayload,
  MoveRackToolToGrossBalancePayload,
  MoveObjectPayload,
  MoveWorkbenchToolToAnalyticalBalancePayload,
  MoveWorkbenchToolToGrossBalancePayload,
  MoveWorkspaceWidgetPayload,
  OpenWorkbenchToolPayload,
  PlaceReceivedBagOnWorkbenchPayload,
  PlaceToolInRackSlotPayload,
  PlaceToolOnAnalyticalBalancePayload,
  PlaceToolOnGrossBalancePayload,
  PlaceWorkbenchToolInRackSlotPayload,
  PourSpatulaIntoWorkbenchToolPayload,
  PourSpatulaIntoAnalyticalBalanceToolPayload,
  PrintLimsLabelPayload,
  RecordGrossWeightPayload,
  RemoveLiquidFromWorkbenchToolPayload,
  RemoveLiquidFromWorkspaceWidgetPayload,
  RemoveRackToolToWorkbenchSlotPayload,
  RemoveWorkbenchSlotPayload,
  RestoreTrashedToolToAnalyticalBalancePayload,
  RestoreTrashedToolToGrossBalancePayload,
  RestoreTrashedToolToRackSlotPayload,
  RestoreTrashedToolToVortexPayload,
  RestoreTrashedToolToWorkbenchSlotPayload,
  MoveRackToolToVortexPayload,
  MoveVortexToolToWorkbenchPayload,
  MoveWorkbenchToolToVortexPayload,
  PlaceToolOnVortexPayload,
  SetGrossBalanceContainerOffsetPayload,
  StartGrinderCyclePayload,
  UpdateAnalyticalBalanceToolSampleLabelTextPayload,
  UpdateWorkbenchToolSampleLabelTextPayload,
} from "@/types/api-payloads";

type LabExperimentState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { experiment: Experiment; status: "ready" };

type UseLabExperimentOptions = {
  defaultErrorMessage: string;
  defaultStatusMessage: string;
  experimentId?: string;
};


export function useLabExperiment({
  defaultErrorMessage,
  defaultStatusMessage,
  experimentId,
}: UseLabExperimentOptions) {
  const [state, setState] = useState<LabExperimentState>({ status: "loading" });
  const [statusMessage, setStatusMessage] = useState(defaultStatusMessage);
  const latestSnapshotVersionRef = useRef(0);
  const grossBalanceOffsetQueuedPayloadRef = useRef<Record<string, unknown> | null>(null);
  const grossBalanceOffsetInFlightRef = useRef(false);
  const { isPending: isCommandPending, isPendingRef: isCommandPendingRef, setPending: setCommandPending } = useCommandPending();

  const getLatestStatusMessage = useCallback((experiment: Experiment) => {
    return experiment.audit_log.at(-1) ?? defaultStatusMessage;
  }, [defaultStatusMessage]);

  const applyExperimentSnapshot = useCallback((experiment: Experiment) => {
    if (experiment.snapshot_version < latestSnapshotVersionRef.current) {
      return;
    }
    latestSnapshotVersionRef.current = experiment.snapshot_version;
    setState({ status: "ready", experiment });
    setStatusMessage(getLatestStatusMessage(experiment));
  }, [getLatestStatusMessage]);

  const loadExperiment = useCallback(async () => {
    latestSnapshotVersionRef.current = 0;
    setState({ status: "loading" });

    try {
      const experiment = experimentId
        ? await getExperiment(experimentId)
        : await createExperiment();
      applyExperimentSnapshot(experiment);
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : defaultErrorMessage,
      });
    }
  }, [applyExperimentSnapshot, defaultErrorMessage, experimentId]);

  useEffect(() => {
    void loadExperiment();
  }, [loadExperiment]);

  const readyExperimentId = state.status === "ready" ? state.experiment.id : null;

  useEffect(() => {
    if (!readyExperimentId) {
      return;
    }
    return subscribeToExperimentStream(readyExperimentId, {
      onError: (error) => {
        setStatusMessage(error.message);
      },
      onMessage: (experiment) => {
        applyExperimentSnapshot(experiment);
      },
    });
  }, [applyExperimentSnapshot, readyExperimentId]);

  const runMutation = async (
    mutation: MutationFn,
    payload?: Record<string, unknown>,
    options?: { onSuccess?: (updatedExperiment: Experiment) => void },
  ) => {
    if (state.status !== "ready") {
      return;
    }

    const activeExperimentId = state.experiment.id;
    let updatedExperiment: Experiment;

    try {
      updatedExperiment = await mutation(activeExperimentId, payload);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "Experiment not found") {
        throw error;
      }
      if (experimentId) {
        throw error;
      }
      const recreatedExperiment = await createExperiment();
      updatedExperiment = await mutation(recreatedExperiment.id, payload);
    }

    applyExperimentSnapshot(updatedExperiment);
    options?.onSuccess?.(updatedExperiment);
  };

  const executeMutation = async (
    mutation: MutationFn,
    payload?: Record<string, unknown>,
    options?: { onSuccess?: (updatedExperiment: Experiment) => void },
  ) => {
    if (state.status !== "ready" || isCommandPendingRef.current) {
      return;
    }

    setCommandPending(true);

    try {
      await runMutation(mutation, payload, options);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Experiment mutation failed");
    } finally {
      setCommandPending(false);
    }
  };

  const executeGrossBalanceOffsetMutation = async (payload: Record<string, unknown>) => {
    if (state.status !== "ready") {
      return;
    }

    grossBalanceOffsetQueuedPayloadRef.current = payload;

    if (grossBalanceOffsetInFlightRef.current) {
      return;
    }

    grossBalanceOffsetInFlightRef.current = true;
    setCommandPending(true);

    try {
      while (grossBalanceOffsetQueuedPayloadRef.current) {
        const nextPayload = grossBalanceOffsetQueuedPayloadRef.current;
        grossBalanceOffsetQueuedPayloadRef.current = null;
        await runMutation(mutationFns.setGrossBalanceContainerOffset, nextPayload);
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Experiment mutation failed");
    } finally {
      grossBalanceOffsetInFlightRef.current = false;
      grossBalanceOffsetQueuedPayloadRef.current = null;
      setCommandPending(false);
    }
  };

  const exec = (fn: MutationFn, payload?: Record<string, unknown>) =>
    executeMutation(fn, payload);

  return {
    isCommandPending,
    loadExperiment,
    state,
    statusMessage,

    // ── Workbench ────────────────────────────────────────────────────────────
    workbench: {
      addSlot: () => exec(mutationFns.addWorkbenchSlot),
      removeSlot: (p: RemoveWorkbenchSlotPayload) => exec(mutationFns.removeWorkbenchSlot, p),
      placeTool: (p: PlaceWorkbenchToolInRackSlotPayload) => exec(mutationFns.placeWorkbenchToolInRackSlot, p),
      openTool: (p: OpenWorkbenchToolPayload) => exec(mutationFns.openWorkbenchTool, p),
      closeTool: (p: CloseWorkbenchToolPayload) => exec(mutationFns.closeWorkbenchTool, p),
      discardTool: (p: DiscardWorkbenchToolPayload) => exec(mutationFns.discardWorkbenchTool, p),
      storeTool: (p: StoreWorkbenchToolPayload) => exec(mutationFns.storeWorkbenchTool, p),
      addLiquid: (p: AddLiquidToWorkbenchToolPayload) => exec(mutationFns.addLiquidToWorkbenchTool, p),
      removeLiquid: (p: RemoveLiquidFromWorkbenchToolPayload) => exec(mutationFns.removeLiquidFromWorkbenchTool, p),
      applySampleLabel: (p: ApplySampleLabelToWorkbenchToolPayload) => exec(mutationFns.applySampleLabelToWorkbenchTool, p),
      updateSampleLabelText: (p: UpdateWorkbenchToolSampleLabelTextPayload) => exec(mutationFns.updateWorkbenchToolSampleLabelText, p),
      moveToolToGrossBalance: (p: MoveWorkbenchToolToGrossBalancePayload) => exec(mutationFns.moveWorkbenchToolToGrossBalance, p),
      moveToolToAnalyticalBalance: (p: MoveWorkbenchToolToAnalyticalBalancePayload) => exec(mutationFns.moveWorkbenchToolToAnalyticalBalance, p),
      moveToolToVortex: (p: MoveWorkbenchToolToVortexPayload) => exec(mutationFns.moveWorkbenchToolToVortex, p),
      cutProduceLot: (p: CutWorkbenchProduceLotPayload) => exec(mutationFns.cutWorkbenchProduceLot, p),
      discardSampleLabelFromPalette: () => exec(mutationFns.discardSampleLabelFromPalette),
      restoreToolFromTrash: (p: RestoreTrashedToolToWorkbenchSlotPayload) => exec(mutationFns.restoreTrashedToolToWorkbenchSlot, p),
    },

    // ── Rack ─────────────────────────────────────────────────────────────────
    rack: {
      placeTool: (p: PlaceToolInRackSlotPayload) => exec(mutationFns.placeToolInRackSlot, p),
      moveTool: (p: MoveRackToolBetweenSlotsPayload) => exec(mutationFns.moveRackToolBetweenSlots, p),
      discardTool: (p: DiscardRackToolPayload) => exec(mutationFns.discardRackTool, p),
      moveToolToWorkbench: (p: RemoveRackToolToWorkbenchSlotPayload) => exec(mutationFns.removeRackToolToWorkbenchSlot, p),
      moveToolToGrossBalance: (p: MoveRackToolToGrossBalancePayload) => exec(mutationFns.moveRackToolToGrossBalance, p),
      moveToolToAnalyticalBalance: (p: MoveRackToolToAnalyticalBalancePayload) => exec(mutationFns.moveRackToolToAnalyticalBalance, p),
      moveToolToVortex: (p: MoveRackToolToVortexPayload) => exec(mutationFns.moveRackToolToVortex, p),
      restoreToolFromTrash: (p: RestoreTrashedToolToRackSlotPayload) => exec(mutationFns.restoreTrashedToolToRackSlot, p),
    },

    // ── Workspace (widgets) ──────────────────────────────────────────────────
    workspace: {
      addWidget: (p: AddWorkspaceWidgetPayload) => exec(mutationFns.addWorkspaceWidget, p),
      moveWidget: (p: MoveWorkspaceWidgetPayload) => exec(mutationFns.moveWorkspaceWidget, p),
      storeWidget: (p: StoreWorkspaceWidgetPayload) => exec(mutationFns.storeWorkspaceWidget, p),
      addLiquid: (p: AddLiquidToWorkspaceWidgetPayload) => exec(mutationFns.addLiquidToWorkspaceWidget, p),
      removeLiquid: (p: RemoveLiquidFromWorkspaceWidgetPayload) => exec(mutationFns.removeLiquidFromWorkspaceWidget, p),
    },

    // ── Gross balance ────────────────────────────────────────────────────────
    grossBalance: {
      placeTool: (p: PlaceToolOnGrossBalancePayload) => exec(mutationFns.placeToolOnGrossBalance, p),
      openTool: () => exec(mutationFns.openGrossBalanceTool),
      closeTool: () => exec(mutationFns.closeGrossBalanceTool),
      discardTool: () => exec(mutationFns.discardGrossBalanceTool),
      moveToolToWorkbench: (p: MoveGrossBalanceToolToWorkbenchPayload) => exec(mutationFns.moveGrossBalanceToolToWorkbench, p),
      moveToolToRack: (p: MoveGrossBalanceToolToRackPayload) => exec(mutationFns.moveGrossBalanceToolToRack, p),
      moveToolToAnalyticalBalance: () => exec(mutationFns.moveGrossBalanceToolToAnalyticalBalance),
      moveToolToVortex: () => exec(mutationFns.moveGrossBalanceToolToVortex),
      applySampleLabel: (p?: ApplySampleLabelToGrossBalanceToolPayload) => exec(mutationFns.applySampleLabelToGrossBalanceTool, p),
      recordWeight: (p?: RecordGrossWeightPayload) => exec(mutationFns.recordGrossWeight, p),
      setContainerOffset: (p: SetGrossBalanceContainerOffsetPayload) => executeGrossBalanceOffsetMutation(p),
      moveBasketTool: (p: BasketToolReferencePayload) => exec(mutationFns.moveBasketToolToGrossBalance, p),
      applyLimsLabel: () => exec(mutationFns.applyPrintedLimsLabelToGrossBalanceBag),
      restoreToolFromTrash: (p: RestoreTrashedToolToGrossBalancePayload) => exec(mutationFns.restoreTrashedToolToGrossBalance, p),
    },

    // ── Analytical balance ───────────────────────────────────────────────────
    analyticalBalance: {
      placeTool: (p: PlaceToolOnAnalyticalBalancePayload) => exec(mutationFns.placeToolOnAnalyticalBalance, p),
      openTool: () => exec(mutationFns.openAnalyticalBalanceTool),
      closeTool: () => exec(mutationFns.closeAnalyticalBalanceTool),
      discardTool: () => exec(mutationFns.discardAnalyticalBalanceTool),
      tare: () => exec(mutationFns.tareAnalyticalBalance),
      recordSampleMass: () => exec(mutationFns.recordAnalyticalSampleMass),
      moveToolToWorkbench: (p: MoveAnalyticalBalanceToolToWorkbenchPayload) => exec(mutationFns.moveAnalyticalBalanceToolToWorkbench, p),
      moveToolToRack: (p: MoveAnalyticalBalanceToolToRackPayload) => exec(mutationFns.moveAnalyticalBalanceToolToRack, p),
      moveToolToGrossBalance: () => exec(mutationFns.moveAnalyticalBalanceToolToGrossBalance),
      moveToolToVortex: () => exec(mutationFns.moveAnalyticalBalanceToolToVortex),
      applySampleLabel: (p?: ApplySampleLabelToAnalyticalBalanceToolPayload) => exec(mutationFns.applySampleLabelToAnalyticalBalanceTool, p),
      applyLimsLabel: (p?: ApplyPrintedLimsLabelToAnalyticalBalanceToolPayload) => exec(mutationFns.applyPrintedLimsLabelToAnalyticalBalanceTool, p),
      updateSampleLabelText: (p: UpdateAnalyticalBalanceToolSampleLabelTextPayload) => exec(mutationFns.updateAnalyticalBalanceToolSampleLabelText, p),
      addLiquid: (p: AddLiquidToAnalyticalBalanceToolPayload) => exec(mutationFns.addLiquidToAnalyticalBalanceTool, p),
      restoreToolFromTrash: (p: RestoreTrashedToolToAnalyticalBalancePayload) => exec(mutationFns.restoreTrashedToolToAnalyticalBalance, p),
      loadSpatula: () => exec(mutationFns.loadSpatulaFromAnalyticalBalanceTool),
      pourSpatula: (p: PourSpatulaIntoAnalyticalBalanceToolPayload) => exec(mutationFns.pourSpatulaIntoAnalyticalBalanceTool, p),
    },

    // ── Vortex ────────────────────────────────────────────────────────────────
    vortex: {
      closeTool: () => exec(mutationFns.closeVortexTool),
      placeTool: (p: PlaceToolOnVortexPayload) => exec(mutationFns.placeToolOnVortex, p),
      discard: () => exec(mutationFns.discardVortexTool),
      openTool: () => exec(mutationFns.openVortexTool),
      start: () => exec(mutationFns.startVortexCycle),
      moveToolToWorkbench: (p: MoveVortexToolToWorkbenchPayload) => exec(mutationFns.moveVortexToolToWorkbench, p),
      moveToolToGrossBalance: () => exec(mutationFns.moveVortexToolToGrossBalance),
      moveToolToAnalyticalBalance: () => exec(mutationFns.moveVortexToolToAnalyticalBalance),
      restoreToolFromTrash: (p: RestoreTrashedToolToVortexPayload) => exec(mutationFns.restoreTrashedToolToVortex, p),
    },

    // ── Grinder ───────────────────────────────────────────────────────────────
    grinder: {
      start: (p: StartGrinderCyclePayload) => exec(mutationFns.startGrinderCycle, p),
      complete: (p: CompleteGrinderCyclePayload) => exec(mutationFns.completeGrinderCycle, p),
    },

    // ── Spatula ───────────────────────────────────────────────────────────────
    spatula: {
      load: (p: LoadSpatulaFromWorkbenchToolPayload) => exec(mutationFns.loadSpatulaFromWorkbenchTool, p),
      discard: () => exec(mutationFns.discardSpatula),
      pour: (p: PourSpatulaIntoWorkbenchToolPayload) => exec(mutationFns.pourSpatulaIntoWorkbenchTool, p),
    },

    pipette: {
      aspirate: (p: { tool_id: string; delta_volume_ml: number }) => exec(mutationFns.aspiratePipette, p),
      dispense: (p: { tool_id: string; delta_volume_ml: number }) => exec(mutationFns.dispensePipette, p),
    },

    // ── DnD (generic move) ───────────────────────────────────────────────────
    dnd: {
      addLiquidToTool: (p: AddLiquidToToolPayload) => exec(mutationFns.addLiquidToTool, p),
      moveObject: (p: MoveObjectPayload) => exec(mutationFns.moveObject, p),
    },

    // ── LIMS / Reception ──────────────────────────────────────────────────────
    lims: {
      createReception: (p: CreateLimsReceptionPayload) => exec(mutationFns.createLimsReception, p),
      printLabel: (p?: PrintLimsLabelPayload) => exec(mutationFns.printLimsLabel, p),
      discardLabel: () => exec(mutationFns.discardPrintedLimsLabel),
      applyLabel: (p: ApplyPrintedLimsLabelPayload) => exec(mutationFns.applyPrintedLimsLabel, p),
      applyLabelToBasketBag: () => exec(mutationFns.applyPrintedLimsLabelToBasketBag),
      placeReceivedBag: (p: PlaceReceivedBagOnWorkbenchPayload) => exec(mutationFns.placeReceivedBagOnWorkbench, p),
      discardBasketTool: (p: BasketToolReferencePayload) => exec(mutationFns.discardBasketTool, p),
    },

    // ── LC-MS/MS ──────────────────────────────────────────────────────────────
    lcmsms: {
      addCalibration: (p: { vial_tool_id: string; level_ng_per_ml: number }) =>
        exec(mutationFns.addCalibrationToVial, p),
      pourExtract: (p: { tube_tool_id: string; vial_tool_id: string }) =>
        exec(mutationFns.pourExtractToVial, p),
      runSequence: () => exec(mutationFns.runSequence),
    },

    // ── Produce / debug ───────────────────────────────────────────────────────
    produce: {
      create: (p: CreateProduceLotPayload) => exec(mutationFns.createProduceLot, p),
      debugSpawnOnWorkbench: (p: CreateDebugProduceLotOnWorkbenchPayload) => exec(mutationFns.createDebugProduceLotOnWorkbench, p),
      debugSpawnToWidget: (p: CreateDebugProduceLotToWidgetPayload) => exec(mutationFns.createDebugProduceLotToWidget, p),
      debugSpawnTool: (p: CreateDebugToolPresetPayload) => exec(mutationFns.createDebugToolPreset, p),
    },
  };
}
