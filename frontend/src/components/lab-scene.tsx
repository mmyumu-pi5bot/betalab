"use client";

import { useEffect, useRef, useState } from "react";

import { LabSceneView } from "@/components/lab-scene-view";
import type { FlatExperimentApi } from "@/types/flat-experiment-api";
import { DebugInspectorPopup } from "@/components/debug-inspector-popup";
import { DropDraftCard, DropDraftForm } from "@/components/drop-draft-card";
import { useDebugInspector } from "@/hooks/use-debug-inspector";
import { useAnalyticalBalanceDnd } from "@/hooks/use-analytical-balance-dnd";
import { useDragState } from "@/hooks/use-drag-state";
import { useGrinderDnd } from "@/hooks/use-grinder-dnd";
import { useGrossBalanceDnd } from "@/hooks/use-gross-balance-dnd";
import { useDropDraft } from "@/hooks/use-drop-draft";
import { useLabExperiment } from "@/hooks/use-lab-experiment";
import { useRackDnd } from "@/hooks/use-rack-dnd";
import { useActionMode } from "@/hooks/use-action-mode";
import { useCentrifugeDnd } from "@/hooks/use-centrifuge-dnd";
import { useTrashDnd } from "@/hooks/use-trash-dnd";
import { useVortexDnd } from "@/hooks/use-vortex-dnd";
import { useWorkbenchDnd } from "@/hooks/use-workbench-dnd";
import { useWorkbenchHandlers } from "@/hooks/use-workbench-handlers";
import { useWorkspaceActions } from "@/hooks/use-workspace-actions";
import { useWorkspaceDrop } from "@/hooks/use-workspace-drop";
import {
  useWorkspaceLayout,
} from "@/hooks/use-workspace-layout";
import {
  buildDebugProduceDraftFields,
  buildDebugToolPresetDraftFields,
  debugProducePresets,
  debugToolPresets,
  debugToolPresetsById,
  formatProduceLotMetadata,
  getApproximateToolMassG,
  getRackIllustrationSlotPosition,
  labSceneWidgetFrameSpecs,
  labSceneWidgetIds,
  labSceneWidgetStorability,
  rackSlotCount,
  roundMass,
  type LabSceneWidgetId,
} from "@/lib/lab-scene-config";
import { getToolbarCatalog } from "@/lib/api";
import type { CreateDebugToolPresetPayload } from "@/types/api-payloads";
import type { DebugToolPresetId, ToolbarCategory } from "@/types/workbench";

const defaultStatusMessage = "Start by dragging an extraction tool onto the bench.";
const defaultErrorMessage = "Unable to load lab scene";
type WidgetId = LabSceneWidgetId;

type LabSceneProps = {
  experimentId?: string;
};

export function LabScene({ experimentId }: LabSceneProps = {}) {
  const experimentApi = useLabExperiment({
    defaultErrorMessage,
    defaultStatusMessage,
    experimentId,
  });
  const { state, statusMessage, isCommandPending, loadExperiment } = experimentApi;

  // Flat adapter — maps grouped API back to the flat shape expected by consumer hooks.
  const flatApi: FlatExperimentApi = {
    // LC-MS/MS
    addCalibrationToVial: (p) => void experimentApi.lcmsms.addCalibration(p),
    // Workbench
    addWorkbenchSlot: experimentApi.workbench.addSlot,
    addLiquidToWorkbenchTool: experimentApi.workbench.addLiquid,
    applySampleLabelToWorkbenchTool: experimentApi.workbench.applySampleLabel,
    closeWorkbenchTool: experimentApi.workbench.closeTool,
    cutWorkbenchProduceLot: experimentApi.workbench.cutProduceLot,
    discardSampleLabelFromPalette: experimentApi.workbench.discardSampleLabelFromPalette,
    openWorkbenchTool: experimentApi.workbench.openTool,
    removeLiquidFromWorkbenchTool: experimentApi.workbench.removeLiquid,
    removeWorkbenchSlot: experimentApi.workbench.removeSlot,
    storeWorkbenchTool: experimentApi.workbench.storeTool,
    updateWorkbenchToolSampleLabelText: experimentApi.workbench.updateSampleLabelText,
    // Workspace
    addWorkspaceWidget: experimentApi.workspace.addWidget,
    addLiquidToWorkspaceWidget: experimentApi.workspace.addLiquid,
    removeLiquidFromWorkspaceWidget: experimentApi.workspace.removeLiquid,
    // Gross balance
    applyPrintedLimsLabelToGrossBalanceBag: experimentApi.grossBalance.applyLimsLabel,
    applySampleLabelToGrossBalanceTool: experimentApi.grossBalance.applySampleLabel,
    closeGrossBalanceTool: experimentApi.grossBalance.closeTool,
    moveGrossBalanceToolToAnalyticalBalance: experimentApi.grossBalance.moveToolToAnalyticalBalance,
    openGrossBalanceTool: experimentApi.grossBalance.openTool,
    setGrossBalanceContainerOffset: experimentApi.grossBalance.setContainerOffset,
    // Analytical balance
    addLiquidToAnalyticalBalanceTool: experimentApi.analyticalBalance.addLiquid,
    applyPrintedLimsLabelToAnalyticalBalanceTool: experimentApi.analyticalBalance.applyLimsLabel,
    applySampleLabelToAnalyticalBalanceTool: experimentApi.analyticalBalance.applySampleLabel,
    closeAnalyticalBalanceTool: experimentApi.analyticalBalance.closeTool,
    loadSpatulaFromAnalyticalBalanceTool: experimentApi.analyticalBalance.loadSpatula,
    openAnalyticalBalanceTool: experimentApi.analyticalBalance.openTool,
    pourSpatulaIntoAnalyticalBalanceTool: experimentApi.analyticalBalance.pourSpatula,
    tareAnalyticalBalance: experimentApi.analyticalBalance.tare,
    updateAnalyticalBalanceToolSampleLabelText: experimentApi.analyticalBalance.updateSampleLabelText,
    // Grinder
    startGrinderCycle: experimentApi.grinder.start,
    // Spatula
    discardSpatula: experimentApi.spatula.discard,
    loadSpatulaFromWorkbenchTool: experimentApi.spatula.load,
    pourSpatulaIntoWorkbenchTool: experimentApi.spatula.pour,
    aspiratePipette: experimentApi.pipette.aspirate,
    dispensePipette: experimentApi.pipette.dispense,
    // DnD
    addLiquidToTool: experimentApi.dnd.addLiquidToTool,
    moveObject: experimentApi.dnd.moveObject,
    // LIMS
    applyPrintedLimsLabel: experimentApi.lims.applyLabel,
    applyPrintedLimsLabelToBasketBag: experimentApi.lims.applyLabelToBasketBag,
    createLimsReception: experimentApi.lims.createReception,
    discardPrintedLimsLabel: experimentApi.lims.discardLabel,
    printLimsLabel: experimentApi.lims.printLabel,
    // Produce / debug
    createDebugProduceLotOnWorkbench: experimentApi.produce.debugSpawnOnWorkbench,
    createDebugProduceLotToWidget: experimentApi.produce.debugSpawnToWidget,
    createDebugToolPreset: experimentApi.produce.debugSpawnTool,
    createProduceLot: experimentApi.produce.create,
  };

  const {
    pendingDropDraft,
    setPendingDropDraft,
    handleUpdateDropDraftField,
    handleConfirmDropDraft,
  } = useDropDraft(flatApi);
  const dndApi: FlatExperimentApi = {
    ...flatApi,
    moveObject: (payload) => {
      const preset =
        payload.source.kind === "palette" ? debugToolPresetsById[payload.entity.id] : undefined;
      if (!preset) {
        flatApi.moveObject(payload);
        return;
      }
      setPendingDropDraft({
        commandType: "create_debug_tool_preset",
        confirmLabel: "Spawn",
        destinationKind:
          payload.destination.kind as CreateDebugToolPresetPayload["destination_kind"],
        fields: buildDebugToolPresetDraftFields(preset.id as DebugToolPresetId),
        presetId: preset.id,
        targetId: payload.destination.id,
        targetKind: "workspace_widget",
        title: `Configure ${preset.name}`,
      });
    },
  };
  const {
    activeDropTargets,
    activeDragItem,
    clearDropTargets,
    isDropTargetHighlighted,
    setActiveDragItem,
    setActiveDropTargets,
    showDropTargets,
  } = useDragState();
  const { inspection: debugInspection, clear: clearDebugInspection } =
    useDebugInspector(experimentId);
  const [isBasketOpen, setIsBasketOpen] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [toolbarCategories, setToolbarCategories] = useState<ToolbarCategory[]>([]);
  const inventoryDropRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const spatula =
    state.status === "ready"
      ? state.experiment.spatula
      : { isLoaded: false, produceFractions: [], sourceToolId: null };
  const pipette =
    state.status === "ready"
      ? state.experiment.pipette
      : { capacityMl: 1, volumeMl: 0, sourceToolId: null };

  useEffect(() => {
    let isMounted = true;

    void getToolbarCatalog()
      .then((categories) => {
        if (isMounted) {
          setToolbarCategories(categories);
        }
      })
      .catch(() => {
        if (isMounted) {
          setToolbarCategories([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const {
    activeActionId,
    setActiveActionId,
    dndDisabledByAction,
    isKnifeMode,
    isSpatulaMode,
    isPipetteMode,
    workspaceCursor,
    handleSpatulaAnalyticalBalancePointerDown,
    handleSpatulaToolCardClick,
    handleSpatulaToolIllustrationClick,
    handleSpatulaToolPointerDown,
    handleSpatulaToolPointerUp,
    handleSpatulaTrashClick,
    spatulaCursorPosition,
    spatulaHintMessage,
    pipetteHintMessage,
    displayPipette,
    stopPipetteHold,
    stopSpatulaPour,
  } = useActionMode({ clearDropTargets, experimentApi: dndApi, pipette, spatula });

  const liveWidgetIds: WidgetId[] =
    state.status === "ready"
      ? state.experiment.workspace.widgets
          .filter((widget) => widget.isPresent)
          .map((widget) => widget.id)
      : [];

  const {
    activeWidgetId,
    handleWidgetDragStart,
    handleWidgetHeightChange,
    registerWidgetNode,
    widgetHeights,
    widgetLayout,
    widgetOrder,
    workspaceHeight,
  } = useWorkspaceLayout<WidgetId>({
    fixedWidgetIds: [],
    getIsWidgetStorable: (widgetId) => labSceneWidgetStorability[widgetId],
    inventoryDropRef,
    initialLayout: labSceneWidgetFrameSpecs,
    initialOrder: [...labSceneWidgetIds],
    onStoreWidget: (widgetId) => {
      clearDropTargets();
      void experimentApi.workspace.storeWidget({ widget_id: widgetId });
    },
    onMoveWidget: (widgetId, nextPosition) => {
      void experimentApi.workspace.moveWidget({
        widget_id: widgetId,
        anchor: nextPosition.anchor,
        offset_x: nextPosition.offsetX,
        offset_y: nextPosition.offsetY,
      });
    },
    onWidgetDragStateChange: (widgetId, activeDropTarget) => {
      const nextDropTargets = activeDropTarget && widgetId ? [activeDropTarget] : [];
      setActiveDropTargets((currentDropTargets) => {
        if (
          currentDropTargets.length === nextDropTargets.length &&
          currentDropTargets.every((target, index) => target === nextDropTargets[index])
        ) {
          return currentDropTargets;
        }
        return nextDropTargets;
      });
    },
    presentWidgetIds: liveWidgetIds,
    syncKey:
      state.status === "ready"
        ? `${state.experiment.id}:${JSON.stringify(state.experiment.workspace.widgets)}`
        : null,
    widgets:
      state.status === "ready"
        ? state.experiment.workspace.widgets.map((widget) => ({
            anchor: widget.anchor,
            id: widget.id,
            offsetX: widget.offsetX,
            offsetY: widget.offsetY,
          }))
        : [],
    workspaceRef,
  });

  const rackSlots = state.status === "ready" ? state.experiment.rack.slots : [];
  const analyticalBalanceTool =
    state.status === "ready"
      ? (state.experiment.workspace.widgets.find((w) => w.id === "analytical_balance")?.tool ?? null)
      : null;
  const grossBalanceTool =
    state.status === "ready"
      ? (state.experiment.workspace.widgets.find((w) => w.id === "gross_balance")?.tool ?? null)
      : null;
  const grossBalanceProduceLot =
    state.status === "ready"
      ? (state.experiment.workspace.widgets.find((w) => w.id === "gross_balance")?.produceLots?.[0] ?? null)
      : null;
  const hasPrintedLabelTicket =
    state.status === "ready"
      ? state.experiment.limsReception.printedLabelTicket !== null
      : false;
  const grinderWidget =
    state.status === "ready"
      ? (state.experiment.workspace.widgets.find((w) => w.id === "grinder") ?? null)
      : null;
  const vortexTool =
    state.status === "ready"
      ? (state.experiment.workspace.widgets.find((w) => w.id === "vortex")?.tool ?? null)
      : null;
  const centrifugeWidget =
    state.status === "ready"
      ? (state.experiment.workspace.widgets.find((w) => w.id === "centrifuge") ?? null)
      : null;
  const centrifugeTool = centrifugeWidget?.tool ?? null;
  const isCentrifugeRunning = (centrifugeWidget?.centrifugeRunRemainingMs ?? 0) > 0;

  const rackDnd = useRackDnd({
    dndDisabledByAction,
    dragState: { activeDragItem, activeDropTargets, clearDropTargets, setActiveDragItem, showDropTargets },
    experimentApi: dndApi,
    rackSlots,
  });

  const grinderDnd = useGrinderDnd({
    buildDebugProduceDraftFields,
    dndDisabledByAction,
    dragState: { clearDropTargets, setActiveDragItem, showDropTargets },
    experimentApi: dndApi,
    grinderWidget,
    isCommandPending,
    pendingDropDraft,
    setPendingDropDraft,
  });

  const grossBalanceDnd = useGrossBalanceDnd({
    buildDebugProduceDraftFields,
    dndDisabledByAction,
    dragState: { activeDropTargets, activeDragItem, clearDropTargets, setActiveDragItem, showDropTargets },
    experimentApi: dndApi,
    grossBalanceProduceLot,
    grossBalanceTool,
    hasPrintedLabelTicket,
    setPendingDropDraft,
  });

  const analyticalBalanceDnd = useAnalyticalBalanceDnd({
    analyticalBalanceTool,
    dndDisabledByAction,
    dragState: { activeDragItem, clearDropTargets, setActiveDragItem, showDropTargets },
    experimentApi: dndApi,
    setPendingDropDraft,
  });

  const trashDnd = useTrashDnd({
    dndDisabledByAction,
    dragState: { clearDropTargets, setActiveDragItem, showDropTargets },
    experimentApi: dndApi,
    isGrinderRunning: grinderDnd.isGrinderRunning,
  });

  const workbenchDnd = useWorkbenchDnd({
    buildDebugProduceDraftFields,
    dndDisabledByAction,
    dragState: { clearDropTargets, setActiveDragItem, showDropTargets },
    experimentApi: dndApi,
    isKnifeMode,
    setPendingDropDraft,
  });

  const vortexDnd = useVortexDnd({
    vortexTool,
    dndDisabledByAction,
    dragState: { clearDropTargets, setActiveDragItem, showDropTargets },
    experimentApi: dndApi,
  });
  const centrifugeDnd = useCentrifugeDnd({
    centrifugeTool,
    dndDisabledByAction,
    dragState: { clearDropTargets, setActiveDragItem, showDropTargets },
    experimentApi: dndApi,
    isRunning: isCentrifugeRunning,
  });

  const { handleWorkspaceDragOver, handleWorkspaceDrop } = useWorkspaceDrop({
    clearDropTargets,
    dndDisabledByAction,
    experimentApi: dndApi,
    widgetHeights,
    widgetLayout,
    workspaceRef,
  });

  const readyExperiment = state.status === "ready" ? state.experiment : null;
  const grossBalanceNetMassG =
    readyExperiment?.limsReception.measuredGrossMassG === null || readyExperiment === null
      ? null
      : readyExperiment.limsReception.measuredGrossMassG +
        readyExperiment.limsReception.grossMassOffsetG;

  const workbenchHandlers = useWorkbenchHandlers({
    activeDragItem,
    activeDropTargets,
    clearDropTargets,
    dndDisabledByAction,
    experimentApi: dndApi,
    hasPrintedLabelTicket,
    setPendingDropDraft,
    workbenchSlots: readyExperiment?.workbench.slots ?? [],
  });

  const workspaceActions = useWorkspaceActions({
    analyticalBalanceTool,
    experimentApi: dndApi,
    grossBalanceTool,
    grossBalanceNetMassG,
    measuredSampleMassG: readyExperiment?.limsReception.measuredSampleMassG ?? null,
  });

  if (state.status === "loading") {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.12),_transparent_30%),linear-gradient(180deg,#fffaf0_0%,#eef6ff_100%)] px-4 py-8 text-slate-950 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <div className="mx-auto max-w-[1800px] rounded-[2rem] border border-slate-200 bg-white/90 p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Betalab</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Laboratory workspace</h1>
          <p className="mt-4 text-sm text-slate-600">Creating pesticide workbench from backend...</p>
        </div>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.12),_transparent_30%),linear-gradient(180deg,#fffaf0_0%,#eef6ff_100%)] px-4 py-8 text-slate-950 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <div className="mx-auto max-w-[1800px] rounded-[2rem] border border-rose-200 bg-white/90 p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-700">
            Backend connection error
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Laboratory workspace</h1>
          <p className="mt-4 text-sm text-slate-600">{state.message}</p>
          <button
            className="mt-6 rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white"
            onClick={() => { void loadExperiment(); }}
            type="button"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  const slots = state.experiment.workbench.slots;
  const basketTools = state.experiment.basketTools;
  const trashedProduceLots = state.experiment.trash.produceLots;
  const trashedSampleLabels = state.experiment.trash.sampleLabels;
  const trashedTools = state.experiment.trash.children;
  const discardedFrom = state.experiment.trash.discardedFrom;
  const trashedWidgets = state.experiment.workspace.widgets.filter(
    (widget) => widget.isTrashed && widget.isStorable,
  );
  const analyticalBalanceMeasuredMassG = analyticalBalanceTool
    ? getApproximateToolMassG(analyticalBalanceTool, 3)
    : state.experiment.analyticalBalance.tareMassG !== null
      ? 0
      : null;
  const analyticalBalanceNetMassG =
    analyticalBalanceMeasuredMassG === null ||
    state.experiment.analyticalBalance.tareMassG === null
      ? null
      : roundMass(
          analyticalBalanceMeasuredMassG - state.experiment.analyticalBalance.tareMassG,
          3,
        );

  const renderPendingBenchDropDraft = (slotId: string) => {
    const pendingBenchDraft =
      pendingDropDraft?.targetKind === "bench_slot" && pendingDropDraft.targetId === slotId
        ? pendingDropDraft
        : null;
    if (!pendingBenchDraft) {
      return null;
    }
    if (
      pendingBenchDraft.commandType === "create_debug_tool_preset" &&
      pendingBenchDraft.destinationKind === "workbench_tool"
    ) {
      return (
        <div
          className="space-y-2 rounded-[1rem] border border-sky-200 bg-sky-50/80 px-4 py-4"
          data-testid="debug-slurry-inline-controls"
        >
          <DropDraftForm
            confirmLabel={pendingBenchDraft.confirmLabel}
            fields={pendingBenchDraft.fields}
            onCancel={() => setPendingDropDraft(null)}
            onChangeField={handleUpdateDropDraftField}
            onConfirm={handleConfirmDropDraft}
            showCancel
          />
        </div>
      );
    }
    return (
      <DropDraftCard
        confirmLabel={pendingBenchDraft.confirmLabel}
        fields={pendingBenchDraft.fields}
        onCancel={() => setPendingDropDraft(null)}
        onChangeField={handleUpdateDropDraftField}
        onConfirm={handleConfirmDropDraft}
        title={pendingBenchDraft.title}
      />
    );
  };

  const rackLoadedCount = rackSlots.filter((slot) => slot.tool).length;
  const rackOccupiedSlots = rackSlots.flatMap((slot, index) => (slot.tool ? [index + 1] : []));
  const rackOccupiedSlotLiquids = Object.fromEntries(
    rackSlots.flatMap((slot, index) => (slot.tool ? [[index + 1, slot.tool.liquids] as const] : [])),
  );
  const instrumentStatus = rackLoadedCount > 0 ? ("ready" as const) : ("idle" as const);
  const isTrashEmpty =
    trashedTools.length === 0 &&
    trashedProduceLots.length === 0 &&
    trashedSampleLabels.length === 0 &&
    trashedWidgets.length === 0;
  const debugInventoryEnabled = process.env.NEXT_PUBLIC_ENABLE_DEBUG_INVENTORY === "true";

  return (
    <>
      <LabSceneView
      balances={{
        analyticalBalanceMeasuredMassG,
        analyticalBalanceNetMassG,
        grossBalanceNetMassG: grossBalanceNetMassG ?? 0,
      }}
      debug={{
        debugInventoryEnabled,
        debugProducePresets,
        debugToolPresets,
      }}
      inventory={{
        toolbarCategories,
      }}
      display={{
        basketProduceLots: state.experiment.workspace.produceBasketLots,
        basketTools,
        rackSlots,
        slots,
        discardedFrom,
        trashProduceLots: trashedProduceLots,
        trashTools: trashedTools,
        trashedSampleLabels,
        trashedWidgets,
      }}
      dnd={{
        analyticalBalance: analyticalBalanceDnd,
        centrifuge: centrifugeDnd,
        clearDropTargets,
        dndDisabledByAction,
        grinder: grinderDnd,
        grossBalance: grossBalanceDnd,
        inventoryDropRef,
        isDropTargetHighlighted,
        rack: rackDnd,
        setActiveDragItem,
        showDropTargets,
        trash: trashDnd,
        vortex: vortexDnd,
        workbench: workbenchDnd,
      }}
      dropDraft={{
        handleConfirmDropDraft,
        handleUpdateDropDraftField,
        pendingDropDraft,
        renderPendingBenchDropDraft,
        setPendingDropDraft,
      }}
      experiment={state.experiment}
      rack={{
        getRackIllustrationSlotPosition,
        instrumentStatus,
        rackLoadedCount,
        rackOccupiedSlotLiquids,
        rackOccupiedSlots,
        rackSlotCount,
      }}
      spatula={{
        activeActionId,
        handleSpatulaAnalyticalBalancePointerDown,
        handleSpatulaToolCardClick,
        handleSpatulaToolIllustrationClick,
        handleSpatulaToolPointerDown,
        handleSpatulaToolPointerUp,
        handleSpatulaTrashClick,
        isSpatulaMode,
        isPipetteMode,
        setActiveActionId,
        spatula,
        spatulaCursorPosition,
        spatulaHintMessage,
        pipette: displayPipette,
        pipetteHintMessage,
        stopPipetteHold,
        stopSpatulaPour,
      }}
      ui={{
        isBasketOpen,
        isCommandPending,
        isTrashEmpty,
        isTrashOpen,
        setIsBasketOpen,
        setIsTrashOpen,
        statusMessage,
      }}
      workbench={{
        canApplyLimsLabelToSlot: workbenchHandlers.canApplyLimsLabelToSlot,
        formatProduceLotMetadata,
        handleAddWorkbenchSlot: workbenchHandlers.handleAddWorkbenchSlot,
        handleApplyLimsLabelTicket: workbenchHandlers.handleApplyLimsLabelTicket,
        handleApplySampleLabel: workbenchHandlers.handleApplySampleLabel,
        handleMoveObject: workbenchHandlers.handleMoveObject,
        handleRemoveLiquid: workbenchHandlers.handleRemoveLiquid,
        handleRemoveWorkbenchSlot: workbenchHandlers.handleRemoveWorkbenchSlot,
        handleStoreWorkbenchTool: workbenchHandlers.handleStoreWorkbenchTool,
        handleSampleLabelTextChange: workbenchHandlers.handleSampleLabelTextChange,
        handleToggleToolSeal: workbenchHandlers.handleToggleToolSeal,
        handleToolbarItemDrop: workbenchHandlers.handleToolbarItemDrop,
        isBenchSlotHighlighted: workbenchHandlers.isBenchSlotHighlighted,
      }}
      workspace={{
        activeWidgetId,
        handleWidgetDragStart,
        handleWidgetHeightChange,
        handleWorkspaceDragOver,
        handleWorkspaceDrop,
        liveWidgetIds,
        registerWidgetNode,
        widgetLayout,
        widgetOrder,
        workspaceCursor,
        workspaceHeight,
        workspaceRef,
      }}
      workspaceActions={{
        ...workspaceActions,
        onRunSequence: () => { void experimentApi.lcmsms.runSequence(); },
        onStartCentrifuge: () => { void experimentApi.centrifuge.start(); },
        onToggleCentrifugeToolSeal: () => {
          if (!centrifugeTool) {
            return;
          }
          if (centrifugeTool.isSealed) {
            void experimentApi.centrifuge.openTool();
            return;
          }
          void experimentApi.centrifuge.closeTool();
        },
        onStartVortex: () => { void experimentApi.vortex.start(); },
        onStoreWorkspaceWidget: (widgetId) => {
          clearDropTargets();
          void experimentApi.workspace.storeWidget({ widget_id: widgetId });
        },
        onToggleVortexToolSeal: () => {
          if (!vortexTool) {
            return;
          }
          if (vortexTool.isSealed) {
            void experimentApi.vortex.openTool();
            return;
          }
          void experimentApi.vortex.closeTool();
        },
      }}
      />
      {debugInspection ? (
        <DebugInspectorPopup inspection={debugInspection} onClose={clearDebugInspection} />
      ) : null}
      {pendingDropDraft?.commandType === "create_debug_tool_preset" &&
      pendingDropDraft.destinationKind !== "workbench_tool" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
          <div className="w-full max-w-md rounded-[1.5rem] bg-white p-3 shadow-2xl">
            <DropDraftCard
              confirmLabel={pendingDropDraft.confirmLabel}
              fields={pendingDropDraft.fields}
              onCancel={() => setPendingDropDraft(null)}
              onChangeField={handleUpdateDropDraftField}
              onConfirm={handleConfirmDropDraft}
              title={pendingDropDraft.title}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
