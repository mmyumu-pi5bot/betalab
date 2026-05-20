"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  addLiquidToAnalyticalBalanceTool,
  addLiquidToWorkbenchTool,
  discardAnalyticalBalanceTool,
  addLiquidToWorkspaceWidget,
  addProduceLotToWorkbenchTool,
  addWorkbenchSlot,
  addWorkspaceProduceLotToWidget,
  addWorkspaceWidget,
  applyPrintedLimsLabelToGrossBalanceBag,
  applyPrintedLimsLabelToAnalyticalBalanceTool,
  applyPrintedLimsLabel,
  applyPrintedLimsLabelToBasketBag,
  applySampleLabelToGrossBalanceTool,
  applySampleLabelToAnalyticalBalanceTool,
  applySampleLabelToWorkbenchTool,
  closeAnalyticalBalanceTool,
  closeGrossBalanceTool,
  closeWorkbenchTool,
  completeGrinderCycle,
  createLimsReception,
  createExperiment,
  getExperiment,
  createDebugProduceLotOnWorkbench,
  createDebugProduceLotToWidget,
  createProduceLot,
  cutWorkbenchProduceLot,
  discardBasketTool,
  discardSpatula,
  discardGrossBalanceProduceLot,
  discardGrossBalanceTool,
  discardProduceLotFromWorkbenchTool,
  discardPrintedLimsLabel,
  discardRackTool,
  discardSampleLabelFromPalette,
  discardSampleLabelFromWorkbenchTool,
  discardToolFromPalette,
  discardWidgetProduceLot,
  discardWorkbenchTool,
  discardWorkspaceProduceLot,
  storeWorkspaceWidget,
  moveBasketToolToGrossBalance,
  moveAnalyticalBalanceToolToRack,
  moveAnalyticalBalanceToolToGrossBalance,
  moveAnalyticalBalanceToolToWorkbench,
  placeToolOnGrossBalance,
  placeToolOnAnalyticalBalance,
  moveGrossBalanceProduceLotToWidget,
  moveGrossBalanceToolToAnalyticalBalance,
  moveGrossBalanceProduceLotToWorkbench,
  moveGrossBalanceToolToRack,
  moveGrossBalanceToolToWorkbench,
  moveProduceLotBetweenWorkbenchTools,
  moveRackToolBetweenSlots,
  moveRackToolToGrossBalance,
  moveRackToolToAnalyticalBalance,
  moveWorkbenchSampleLabelToGrossBalance,
  moveWorkbenchSampleLabelToAnalyticalBalance,
  moveWorkbenchProduceLotToGrossBalance,
  moveWorkbenchToolToAnalyticalBalance,
  moveWorkbenchToolToGrossBalance,
  moveWidgetProduceLotToGrossBalance,
  moveWorkspaceProduceLotToGrossBalance,
  openAnalyticalBalanceTool,
  openGrossBalanceTool,
  moveSampleLabelBetweenWorkbenchTools,
  moveToolBetweenWorkbenchSlots,
  moveTool,
  moveWidgetProduceLotToWorkbenchTool,
  moveWorkbenchProduceLotToWidget,
  moveWorkspaceWidget,
  loadSpatulaFromWorkbenchTool,
  loadSpatulaFromAnalyticalBalanceTool,
  openWorkbenchTool,
  placeToolInRackSlot,
  placeReceivedBagOnWorkbench,
  placeToolOnWorkbench,
  placeToolFromPalette,
  placeWorkbenchToolInRackSlot,
  printLimsLabel,
  pourSpatulaIntoWorkbenchTool,
  pourSpatulaIntoAnalyticalBalanceTool,
  recordGrossWeight,
  recordAnalyticalSampleMass,
  setGrossBalanceContainerOffset,
  removeLiquidFromWorkbenchTool,
  removeLiquidFromWorkspaceWidget,
  removeRackToolToWorkbenchSlot,
  removeWorkbenchSlot,
  restoreTrashedProduceLotToWorkbenchTool,
  restoreTrashedProduceLotToGrossBalance,
  restoreTrashedSampleLabelToGrossBalance,
  restoreTrashedProduceLotToWidget,
  restoreTrashedSampleLabelToAnalyticalBalance,
  restoreTrashedToolToAnalyticalBalance,
  restoreTrashedSampleLabelToWorkbenchTool,
  restoreTrashedToolToGrossBalance,
  restoreTrashedToolToRackSlot,
  restoreTrashedToolToWorkbenchSlot,
  subscribeToExperimentStream,
  startGrinderCycle,
  startVortexCycle,
  discardVortexTool,
  storeWorkbenchTool,
  moveAnalyticalBalanceToolToVortex,
  moveGrossBalanceToolToVortex,
  moveRackToolToVortex,
  moveVortexToolToAnalyticalBalance,
  moveVortexToolToGrossBalance,
  moveVortexToolToWorkbench,
  moveWorkbenchToolToVortex,
  placeToolOnVortex,
  restoreTrashedToolToVortex,
  tareAnalyticalBalance,
  updateAnalyticalBalanceToolSampleLabelText,
  updateWorkbenchToolSampleLabelText,
} from "@/lib/api";
import type { Experiment } from "@/types/experiment";
import type {
  AddLiquidToAnalyticalBalanceToolPayload,
  AddLiquidToWorkbenchToolPayload,
  AddLiquidToWorkspaceWidgetPayload,
  AddProduceLotToWorkbenchToolPayload,
  AddWorkspaceProduceLotToWidgetPayload,
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
  CreateLimsReceptionPayload,
  CreateProduceLotPayload,
  CutWorkbenchProduceLotPayload,
  DiscardGrossBalanceProduceLotPayload,
  DiscardProduceLotFromWorkbenchToolPayload,
  DiscardRackToolPayload,
  DiscardSampleLabelFromWorkbenchToolPayload,
  DiscardToolFromPalettePayload,
  DiscardWidgetProduceLotPayload,
  DiscardWorkbenchToolPayload,
  DiscardWorkspaceProduceLotPayload,
  StoreWorkbenchToolPayload,
  StoreWorkspaceWidgetPayload,
  LoadSpatulaFromWorkbenchToolPayload,
  MoveAnalyticalBalanceToolToRackPayload,
  MoveAnalyticalBalanceToolToWorkbenchPayload,
  MoveGrossBalanceProduceLotToWidgetPayload,
  MoveGrossBalanceProduceLotToWorkbenchPayload,
  MoveGrossBalanceToolToRackPayload,
  MoveGrossBalanceToolToWorkbenchPayload,
  MoveProduceLotBetweenWorkbenchToolsPayload,
  MoveRackToolBetweenSlotsPayload,
  MoveRackToolToAnalyticalBalancePayload,
  MoveRackToolToGrossBalancePayload,
  MoveWorkbenchSampleLabelToGrossBalancePayload,
  MoveWorkbenchSampleLabelToAnalyticalBalancePayload,
  MoveSampleLabelBetweenWorkbenchToolsPayload,
  MoveToolBetweenWorkbenchSlotsPayload,
  MoveToolPayload,
  MoveWidgetProduceLotToGrossBalancePayload,
  MoveWidgetProduceLotToWorkbenchToolPayload,
  MoveWorkbenchProduceLotToGrossBalancePayload,
  MoveWorkbenchProduceLotToWidgetPayload,
  MoveWorkbenchToolToAnalyticalBalancePayload,
  MoveWorkbenchToolToGrossBalancePayload,
  MoveWorkspaceProduceLotToGrossBalancePayload,
  MoveWorkspaceWidgetPayload,
  OpenWorkbenchToolPayload,
  PlaceReceivedBagOnWorkbenchPayload,
  PlaceToolInRackSlotPayload,
  PlaceToolOnAnalyticalBalancePayload,
  PlaceToolOnGrossBalancePayload,
  PlaceToolOnWorkbenchPayload,
  PlaceToolFromPalettePayload,
  PlaceWorkbenchToolInRackSlotPayload,
  PourSpatulaIntoWorkbenchToolPayload,
  PourSpatulaIntoAnalyticalBalanceToolPayload,
  PrintLimsLabelPayload,
  RecordGrossWeightPayload,
  RemoveLiquidFromWorkbenchToolPayload,
  RemoveLiquidFromWorkspaceWidgetPayload,
  RemoveRackToolToWorkbenchSlotPayload,
  RemoveWorkbenchSlotPayload,
  RestoreTrashedProduceLotToGrossBalancePayload,
  RestoreTrashedProduceLotToWidgetPayload,
  RestoreTrashedProduceLotToWorkbenchToolPayload,
  RestoreTrashedSampleLabelToGrossBalancePayload,
  RestoreTrashedSampleLabelToAnalyticalBalancePayload,
  RestoreTrashedSampleLabelToWorkbenchToolPayload,
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

type MutationFn = (experimentId: string, payload?: Record<string, unknown>) => Promise<Experiment>;

const mutationFns = {
  addLiquidToAnalyticalBalanceTool,
  addLiquidToWorkbenchTool,
  discardAnalyticalBalanceTool,
  addLiquidToWorkspaceWidget,
  addProduceLotToWorkbenchTool,
  addWorkbenchSlot,
  addWorkspaceProduceLotToWidget,
  addWorkspaceWidget,
  applyPrintedLimsLabelToGrossBalanceBag,
  applyPrintedLimsLabelToAnalyticalBalanceTool,
  applyPrintedLimsLabel,
  applyPrintedLimsLabelToBasketBag,
  applySampleLabelToGrossBalanceTool,
  applySampleLabelToAnalyticalBalanceTool,
  applySampleLabelToWorkbenchTool,
  closeAnalyticalBalanceTool,
  closeGrossBalanceTool,
  closeWorkbenchTool,
  completeGrinderCycle,
  createLimsReception,
  createProduceLot,
  createDebugProduceLotOnWorkbench,
  createDebugProduceLotToWidget,
  cutWorkbenchProduceLot,
  discardBasketTool,
  discardGrossBalanceProduceLot,
  discardGrossBalanceTool,
  discardProduceLotFromWorkbenchTool,
  discardPrintedLimsLabel,
  discardRackTool,
  discardSampleLabelFromPalette,
  discardSampleLabelFromWorkbenchTool,
  discardToolFromPalette,
  discardWidgetProduceLot,
  discardWorkbenchTool,
  discardWorkspaceProduceLot,
  storeWorkspaceWidget,
  moveBasketToolToGrossBalance,
  moveAnalyticalBalanceToolToRack,
  moveAnalyticalBalanceToolToGrossBalance,
  moveAnalyticalBalanceToolToWorkbench,
  placeToolOnGrossBalance,
  placeToolOnAnalyticalBalance,
  moveGrossBalanceProduceLotToWidget,
  moveGrossBalanceToolToAnalyticalBalance,
  moveGrossBalanceProduceLotToWorkbench,
  moveGrossBalanceToolToRack,
  moveGrossBalanceToolToWorkbench,
  moveProduceLotBetweenWorkbenchTools,
  moveRackToolBetweenSlots,
  moveRackToolToGrossBalance,
  moveRackToolToAnalyticalBalance,
  moveWorkbenchSampleLabelToGrossBalance,
  moveWorkbenchSampleLabelToAnalyticalBalance,
  moveWorkbenchProduceLotToGrossBalance,
  moveWorkbenchToolToAnalyticalBalance,
  moveWorkbenchToolToGrossBalance,
  moveWidgetProduceLotToGrossBalance,
  moveWorkspaceProduceLotToGrossBalance,
  openAnalyticalBalanceTool,
  openGrossBalanceTool,
  moveSampleLabelBetweenWorkbenchTools,
  moveToolBetweenWorkbenchSlots,
  moveTool,
  moveWidgetProduceLotToWorkbenchTool,
  moveWorkbenchProduceLotToWidget,
  moveWorkspaceWidget,
  discardSpatula,
  loadSpatulaFromWorkbenchTool,
  loadSpatulaFromAnalyticalBalanceTool,
  openWorkbenchTool,
  placeToolInRackSlot,
  placeReceivedBagOnWorkbench,
  placeToolOnWorkbench,
  placeToolFromPalette,
  placeWorkbenchToolInRackSlot,
  printLimsLabel,
  pourSpatulaIntoWorkbenchTool,
  pourSpatulaIntoAnalyticalBalanceTool,
  recordGrossWeight,
  recordAnalyticalSampleMass,
  setGrossBalanceContainerOffset,
  removeLiquidFromWorkbenchTool,
  removeLiquidFromWorkspaceWidget,
  removeRackToolToWorkbenchSlot,
  removeWorkbenchSlot,
  restoreTrashedProduceLotToWorkbenchTool,
  restoreTrashedProduceLotToGrossBalance,
  restoreTrashedSampleLabelToGrossBalance,
  restoreTrashedProduceLotToWidget,
  restoreTrashedSampleLabelToAnalyticalBalance,
  restoreTrashedToolToAnalyticalBalance,
  restoreTrashedSampleLabelToWorkbenchTool,
  restoreTrashedToolToGrossBalance,
  restoreTrashedToolToRackSlot,
  restoreTrashedToolToWorkbenchSlot,
  startGrinderCycle,
  startVortexCycle,
  discardVortexTool,
  storeWorkbenchTool,
  moveAnalyticalBalanceToolToVortex,
  moveGrossBalanceToolToVortex,
  moveRackToolToVortex,
  moveVortexToolToAnalyticalBalance,
  moveVortexToolToGrossBalance,
  moveVortexToolToWorkbench,
  moveWorkbenchToolToVortex,
  placeToolOnVortex,
  restoreTrashedToolToVortex,
  tareAnalyticalBalance,
  updateAnalyticalBalanceToolSampleLabelText,
  updateWorkbenchToolSampleLabelText,
} satisfies Record<string, MutationFn>;

export function useLabExperiment({
  defaultErrorMessage,
  defaultStatusMessage,
  experimentId,
}: UseLabExperimentOptions) {
  const [state, setState] = useState<LabExperimentState>({ status: "loading" });
  const [statusMessage, setStatusMessage] = useState(defaultStatusMessage);
  const [isCommandPending, setIsCommandPending] = useState(false);
  const latestSnapshotVersionRef = useRef(0);
  const isCommandPendingRef = useRef(false);
  const grossBalanceOffsetQueuedPayloadRef = useRef<Record<string, unknown> | null>(null);
  const grossBalanceOffsetInFlightRef = useRef(false);

  const setCommandPending = (pending: boolean) => {
    isCommandPendingRef.current = pending;
    setIsCommandPending(pending);
  };

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

  return {
    isCommandPending,
    loadExperiment,
    state,
    statusMessage,
    addLiquidToAnalyticalBalanceTool: (payload: AddLiquidToAnalyticalBalanceToolPayload) =>
      executeMutation(mutationFns.addLiquidToAnalyticalBalanceTool, payload),
    addLiquidToWorkbenchTool: (payload: AddLiquidToWorkbenchToolPayload) =>
      executeMutation(mutationFns.addLiquidToWorkbenchTool, payload),
    addLiquidToWorkspaceWidget: (payload: AddLiquidToWorkspaceWidgetPayload) =>
      executeMutation(mutationFns.addLiquidToWorkspaceWidget, payload),
    addProduceLotToWorkbenchTool: (payload: AddProduceLotToWorkbenchToolPayload) =>
      executeMutation(mutationFns.addProduceLotToWorkbenchTool, payload),
    addWorkbenchSlot: () => executeMutation(mutationFns.addWorkbenchSlot),
    addWorkspaceProduceLotToWidget: (payload: AddWorkspaceProduceLotToWidgetPayload) =>
      executeMutation(mutationFns.addWorkspaceProduceLotToWidget, payload),
    addWorkspaceWidget: (payload: AddWorkspaceWidgetPayload) =>
      executeMutation(mutationFns.addWorkspaceWidget, payload),
    applyPrintedLimsLabel: (payload: ApplyPrintedLimsLabelPayload) =>
      executeMutation(mutationFns.applyPrintedLimsLabel, payload),
    applyPrintedLimsLabelToGrossBalanceBag: () =>
      executeMutation(mutationFns.applyPrintedLimsLabelToGrossBalanceBag),
    applyPrintedLimsLabelToAnalyticalBalanceTool: (
      payload?: ApplyPrintedLimsLabelToAnalyticalBalanceToolPayload,
    ) => executeMutation(mutationFns.applyPrintedLimsLabelToAnalyticalBalanceTool, payload),
    applyPrintedLimsLabelToBasketBag: () =>
      executeMutation(mutationFns.applyPrintedLimsLabelToBasketBag),
    applySampleLabelToGrossBalanceTool: (
      payload?: ApplySampleLabelToGrossBalanceToolPayload,
    ) => executeMutation(mutationFns.applySampleLabelToGrossBalanceTool, payload),
    applySampleLabelToAnalyticalBalanceTool: (
      payload?: ApplySampleLabelToAnalyticalBalanceToolPayload,
    ) => executeMutation(mutationFns.applySampleLabelToAnalyticalBalanceTool, payload),
    applySampleLabelToWorkbenchTool: (payload: ApplySampleLabelToWorkbenchToolPayload) =>
      executeMutation(mutationFns.applySampleLabelToWorkbenchTool, payload),
    closeGrossBalanceTool: () =>
      executeMutation(mutationFns.closeGrossBalanceTool),
    closeAnalyticalBalanceTool: () =>
      executeMutation(mutationFns.closeAnalyticalBalanceTool),
    closeWorkbenchTool: (payload: CloseWorkbenchToolPayload) =>
      executeMutation(mutationFns.closeWorkbenchTool, payload),
    completeGrinderCycle: (payload: CompleteGrinderCyclePayload) =>
      executeMutation(mutationFns.completeGrinderCycle, payload),
    startGrinderCycle: (payload: StartGrinderCyclePayload) =>
      executeMutation(mutationFns.startGrinderCycle, payload),
    createProduceLot: (payload: CreateProduceLotPayload) =>
      executeMutation(mutationFns.createProduceLot, payload),
    createDebugProduceLotOnWorkbench: (payload: CreateDebugProduceLotOnWorkbenchPayload) =>
      executeMutation(mutationFns.createDebugProduceLotOnWorkbench, payload),
    createDebugProduceLotToWidget: (payload: CreateDebugProduceLotToWidgetPayload) =>
      executeMutation(mutationFns.createDebugProduceLotToWidget, payload),
    createLimsReception: (payload: CreateLimsReceptionPayload) =>
      executeMutation(mutationFns.createLimsReception, payload),
    cutWorkbenchProduceLot: (payload: CutWorkbenchProduceLotPayload) =>
      executeMutation(mutationFns.cutWorkbenchProduceLot, payload),
    discardBasketTool: (payload: BasketToolReferencePayload) =>
      executeMutation(mutationFns.discardBasketTool, payload),
    discardAnalyticalBalanceTool: () =>
      executeMutation(mutationFns.discardAnalyticalBalanceTool),
    discardGrossBalanceProduceLot: (payload: DiscardGrossBalanceProduceLotPayload) =>
      executeMutation(mutationFns.discardGrossBalanceProduceLot, payload),
    discardGrossBalanceTool: () =>
      executeMutation(mutationFns.discardGrossBalanceTool),
    discardProduceLotFromWorkbenchTool: (payload: DiscardProduceLotFromWorkbenchToolPayload) =>
      executeMutation(mutationFns.discardProduceLotFromWorkbenchTool, payload),
    discardPrintedLimsLabel: () =>
      executeMutation(mutationFns.discardPrintedLimsLabel),
    discardRackTool: (payload: DiscardRackToolPayload) =>
      executeMutation(mutationFns.discardRackTool, payload),
    discardSampleLabelFromPalette: () =>
      executeMutation(mutationFns.discardSampleLabelFromPalette),
    discardSampleLabelFromWorkbenchTool: (payload: DiscardSampleLabelFromWorkbenchToolPayload) =>
      executeMutation(mutationFns.discardSampleLabelFromWorkbenchTool, payload),
    discardToolFromPalette: (payload: DiscardToolFromPalettePayload) =>
      executeMutation(mutationFns.discardToolFromPalette, payload),
    discardWidgetProduceLot: (payload: DiscardWidgetProduceLotPayload) =>
      executeMutation(mutationFns.discardWidgetProduceLot, payload),
    discardWorkbenchTool: (payload: DiscardWorkbenchToolPayload) =>
      executeMutation(mutationFns.discardWorkbenchTool, payload),
    discardWorkspaceProduceLot: (payload: DiscardWorkspaceProduceLotPayload) =>
      executeMutation(mutationFns.discardWorkspaceProduceLot, payload),
    storeWorkbenchTool: (payload: StoreWorkbenchToolPayload) =>
      executeMutation(mutationFns.storeWorkbenchTool, payload),
    storeWorkspaceWidget: (payload: StoreWorkspaceWidgetPayload) =>
      executeMutation(mutationFns.storeWorkspaceWidget, payload),
    moveBasketToolToGrossBalance: (payload: BasketToolReferencePayload) =>
      executeMutation(mutationFns.moveBasketToolToGrossBalance, payload),
    moveAnalyticalBalanceToolToGrossBalance: () =>
      executeMutation(mutationFns.moveAnalyticalBalanceToolToGrossBalance),
    moveAnalyticalBalanceToolToRack: (payload: MoveAnalyticalBalanceToolToRackPayload) =>
      executeMutation(mutationFns.moveAnalyticalBalanceToolToRack, payload),
    moveAnalyticalBalanceToolToWorkbench: (payload: MoveAnalyticalBalanceToolToWorkbenchPayload) =>
      executeMutation(mutationFns.moveAnalyticalBalanceToolToWorkbench, payload),
    placeToolOnAnalyticalBalance: (payload: PlaceToolOnAnalyticalBalancePayload) =>
      executeMutation(mutationFns.placeToolOnAnalyticalBalance, payload),
    placeToolOnGrossBalance: (payload: PlaceToolOnGrossBalancePayload) =>
      executeMutation(mutationFns.placeToolOnGrossBalance, payload),
    moveGrossBalanceProduceLotToWidget: (payload: MoveGrossBalanceProduceLotToWidgetPayload) =>
      executeMutation(mutationFns.moveGrossBalanceProduceLotToWidget, payload),
    moveGrossBalanceToolToAnalyticalBalance: () =>
      executeMutation(mutationFns.moveGrossBalanceToolToAnalyticalBalance),
    moveGrossBalanceProduceLotToWorkbench: (payload: MoveGrossBalanceProduceLotToWorkbenchPayload) =>
      executeMutation(mutationFns.moveGrossBalanceProduceLotToWorkbench, payload),
    moveGrossBalanceToolToRack: (payload: MoveGrossBalanceToolToRackPayload) =>
      executeMutation(mutationFns.moveGrossBalanceToolToRack, payload),
    moveGrossBalanceToolToWorkbench: (payload: MoveGrossBalanceToolToWorkbenchPayload) =>
      executeMutation(mutationFns.moveGrossBalanceToolToWorkbench, payload),
    moveProduceLotBetweenWorkbenchTools: (payload: MoveProduceLotBetweenWorkbenchToolsPayload) =>
      executeMutation(mutationFns.moveProduceLotBetweenWorkbenchTools, payload),
    moveRackToolBetweenSlots: (payload: MoveRackToolBetweenSlotsPayload) =>
      executeMutation(mutationFns.moveRackToolBetweenSlots, payload),
    moveRackToolToAnalyticalBalance: (payload: MoveRackToolToAnalyticalBalancePayload) =>
      executeMutation(mutationFns.moveRackToolToAnalyticalBalance, payload),
    moveRackToolToGrossBalance: (payload: MoveRackToolToGrossBalancePayload) =>
      executeMutation(mutationFns.moveRackToolToGrossBalance, payload),
    moveWorkbenchSampleLabelToGrossBalance: (
      payload: MoveWorkbenchSampleLabelToGrossBalancePayload,
    ) => executeMutation(mutationFns.moveWorkbenchSampleLabelToGrossBalance, payload),
    moveWorkbenchSampleLabelToAnalyticalBalance: (
      payload: MoveWorkbenchSampleLabelToAnalyticalBalancePayload,
    ) => executeMutation(mutationFns.moveWorkbenchSampleLabelToAnalyticalBalance, payload),
    moveSampleLabelBetweenWorkbenchTools: (payload: MoveSampleLabelBetweenWorkbenchToolsPayload) =>
      executeMutation(mutationFns.moveSampleLabelBetweenWorkbenchTools, payload),
    moveToolBetweenWorkbenchSlots: (payload: MoveToolBetweenWorkbenchSlotsPayload) =>
      executeMutation(mutationFns.moveToolBetweenWorkbenchSlots, payload),
    moveTool: (payload: MoveToolPayload) =>
      executeMutation(mutationFns.moveTool, payload),
    moveWorkbenchProduceLotToGrossBalance: (payload: MoveWorkbenchProduceLotToGrossBalancePayload) =>
      executeMutation(mutationFns.moveWorkbenchProduceLotToGrossBalance, payload),
    moveWorkbenchToolToAnalyticalBalance: (payload: MoveWorkbenchToolToAnalyticalBalancePayload) =>
      executeMutation(mutationFns.moveWorkbenchToolToAnalyticalBalance, payload),
    moveWorkbenchToolToGrossBalance: (payload: MoveWorkbenchToolToGrossBalancePayload) =>
      executeMutation(mutationFns.moveWorkbenchToolToGrossBalance, payload),
    moveWidgetProduceLotToWorkbenchTool: (payload: MoveWidgetProduceLotToWorkbenchToolPayload) =>
      executeMutation(mutationFns.moveWidgetProduceLotToWorkbenchTool, payload),
    moveWidgetProduceLotToGrossBalance: (payload: MoveWidgetProduceLotToGrossBalancePayload) =>
      executeMutation(mutationFns.moveWidgetProduceLotToGrossBalance, payload),
    moveWorkbenchProduceLotToWidget: (payload: MoveWorkbenchProduceLotToWidgetPayload) =>
      executeMutation(mutationFns.moveWorkbenchProduceLotToWidget, payload),
    moveWorkspaceProduceLotToGrossBalance: (payload: MoveWorkspaceProduceLotToGrossBalancePayload) =>
      executeMutation(mutationFns.moveWorkspaceProduceLotToGrossBalance, payload),
    moveWorkspaceWidget: (payload: MoveWorkspaceWidgetPayload) =>
      executeMutation(mutationFns.moveWorkspaceWidget, payload),
    discardSpatula: () =>
      executeMutation(mutationFns.discardSpatula),
    loadSpatulaFromWorkbenchTool: (payload: LoadSpatulaFromWorkbenchToolPayload) =>
      executeMutation(mutationFns.loadSpatulaFromWorkbenchTool, payload),
    loadSpatulaFromAnalyticalBalanceTool: () =>
      executeMutation(mutationFns.loadSpatulaFromAnalyticalBalanceTool),
    openGrossBalanceTool: () =>
      executeMutation(mutationFns.openGrossBalanceTool),
    openAnalyticalBalanceTool: () =>
      executeMutation(mutationFns.openAnalyticalBalanceTool),
    openWorkbenchTool: (payload: OpenWorkbenchToolPayload) =>
      executeMutation(mutationFns.openWorkbenchTool, payload),
    placeToolInRackSlot: (payload: PlaceToolInRackSlotPayload) =>
      executeMutation(mutationFns.placeToolInRackSlot, payload),
    placeReceivedBagOnWorkbench: (payload: PlaceReceivedBagOnWorkbenchPayload) =>
      executeMutation(mutationFns.placeReceivedBagOnWorkbench, payload),
    placeToolOnWorkbench: (payload: PlaceToolOnWorkbenchPayload) =>
      executeMutation(mutationFns.placeToolOnWorkbench, payload),
    placeToolFromPalette: (payload: PlaceToolFromPalettePayload) =>
      executeMutation(mutationFns.placeToolFromPalette, payload),
    placeWorkbenchToolInRackSlot: (payload: PlaceWorkbenchToolInRackSlotPayload) =>
      executeMutation(mutationFns.placeWorkbenchToolInRackSlot, payload),
    printLimsLabel: (payload?: PrintLimsLabelPayload) =>
      executeMutation(mutationFns.printLimsLabel, payload),
    pourSpatulaIntoWorkbenchTool: (payload: PourSpatulaIntoWorkbenchToolPayload) =>
      executeMutation(mutationFns.pourSpatulaIntoWorkbenchTool, payload),
    pourSpatulaIntoAnalyticalBalanceTool: (payload: PourSpatulaIntoAnalyticalBalanceToolPayload) =>
      executeMutation(mutationFns.pourSpatulaIntoAnalyticalBalanceTool, payload),
    recordGrossWeight: (payload?: RecordGrossWeightPayload) =>
      executeMutation(mutationFns.recordGrossWeight, payload),
    recordAnalyticalSampleMass: () =>
      executeMutation(mutationFns.recordAnalyticalSampleMass),
    setGrossBalanceContainerOffset: (payload: SetGrossBalanceContainerOffsetPayload) =>
      executeGrossBalanceOffsetMutation(payload),
    tareAnalyticalBalance: () =>
      executeMutation(mutationFns.tareAnalyticalBalance),
    removeLiquidFromWorkbenchTool: (payload: RemoveLiquidFromWorkbenchToolPayload) =>
      executeMutation(mutationFns.removeLiquidFromWorkbenchTool, payload),
    removeLiquidFromWorkspaceWidget: (payload: RemoveLiquidFromWorkspaceWidgetPayload) =>
      executeMutation(mutationFns.removeLiquidFromWorkspaceWidget, payload),
    removeRackToolToWorkbenchSlot: (payload: RemoveRackToolToWorkbenchSlotPayload) =>
      executeMutation(mutationFns.removeRackToolToWorkbenchSlot, payload),
    removeWorkbenchSlot: (payload: RemoveWorkbenchSlotPayload) =>
      executeMutation(mutationFns.removeWorkbenchSlot, payload),
    restoreTrashedProduceLotToGrossBalance: (payload: RestoreTrashedProduceLotToGrossBalancePayload) =>
      executeMutation(mutationFns.restoreTrashedProduceLotToGrossBalance, payload),
    restoreTrashedProduceLotToWorkbenchTool: (payload: RestoreTrashedProduceLotToWorkbenchToolPayload) =>
      executeMutation(mutationFns.restoreTrashedProduceLotToWorkbenchTool, payload),
    restoreTrashedProduceLotToWidget: (payload: RestoreTrashedProduceLotToWidgetPayload) =>
      executeMutation(mutationFns.restoreTrashedProduceLotToWidget, payload),
    restoreTrashedSampleLabelToGrossBalance: (
      payload: RestoreTrashedSampleLabelToGrossBalancePayload,
    ) => executeMutation(mutationFns.restoreTrashedSampleLabelToGrossBalance, payload),
    restoreTrashedSampleLabelToAnalyticalBalance: (
      payload: RestoreTrashedSampleLabelToAnalyticalBalancePayload,
    ) => executeMutation(mutationFns.restoreTrashedSampleLabelToAnalyticalBalance, payload),
    restoreTrashedSampleLabelToWorkbenchTool: (payload: RestoreTrashedSampleLabelToWorkbenchToolPayload) =>
      executeMutation(mutationFns.restoreTrashedSampleLabelToWorkbenchTool, payload),
    restoreTrashedToolToAnalyticalBalance: (payload: RestoreTrashedToolToAnalyticalBalancePayload) =>
      executeMutation(mutationFns.restoreTrashedToolToAnalyticalBalance, payload),
    restoreTrashedToolToGrossBalance: (payload: RestoreTrashedToolToGrossBalancePayload) =>
      executeMutation(mutationFns.restoreTrashedToolToGrossBalance, payload),
    restoreTrashedToolToRackSlot: (payload: RestoreTrashedToolToRackSlotPayload) =>
      executeMutation(mutationFns.restoreTrashedToolToRackSlot, payload),
    restoreTrashedToolToWorkbenchSlot: (payload: RestoreTrashedToolToWorkbenchSlotPayload) =>
      executeMutation(mutationFns.restoreTrashedToolToWorkbenchSlot, payload),
    startVortexCycle: () => executeMutation(mutationFns.startVortexCycle),
    discardVortexTool: () => executeMutation(mutationFns.discardVortexTool),
    moveAnalyticalBalanceToolToVortex: () => executeMutation(mutationFns.moveAnalyticalBalanceToolToVortex),
    moveGrossBalanceToolToVortex: () => executeMutation(mutationFns.moveGrossBalanceToolToVortex),
    moveRackToolToVortex: (payload: MoveRackToolToVortexPayload) =>
      executeMutation(mutationFns.moveRackToolToVortex, payload),
    moveVortexToolToAnalyticalBalance: () => executeMutation(mutationFns.moveVortexToolToAnalyticalBalance),
    moveVortexToolToGrossBalance: () => executeMutation(mutationFns.moveVortexToolToGrossBalance),
    moveVortexToolToWorkbench: (payload: MoveVortexToolToWorkbenchPayload) =>
      executeMutation(mutationFns.moveVortexToolToWorkbench, payload),
    moveWorkbenchToolToVortex: (payload: MoveWorkbenchToolToVortexPayload) =>
      executeMutation(mutationFns.moveWorkbenchToolToVortex, payload),
    placeToolOnVortex: (payload: PlaceToolOnVortexPayload) =>
      executeMutation(mutationFns.placeToolOnVortex, payload),
    restoreTrashedToolToVortex: (payload: RestoreTrashedToolToVortexPayload) =>
      executeMutation(mutationFns.restoreTrashedToolToVortex, payload),
    updateAnalyticalBalanceToolSampleLabelText: (
      payload: UpdateAnalyticalBalanceToolSampleLabelTextPayload,
    ) => executeMutation(mutationFns.updateAnalyticalBalanceToolSampleLabelText, payload),
    updateWorkbenchToolSampleLabelText: (payload: UpdateWorkbenchToolSampleLabelTextPayload) =>
      executeMutation(mutationFns.updateWorkbenchToolSampleLabelText, payload),
  };
}
