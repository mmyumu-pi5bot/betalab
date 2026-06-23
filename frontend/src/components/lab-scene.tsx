"use client";

import { useEffect, useRef, useState } from "react";

import { LabSceneView } from "@/components/lab-scene-view";
import type { FlatExperimentApi } from "@/types/flat-experiment-api";
import { DebugInspectorPopup } from "@/components/debug-inspector-popup";
import { DropDraftCard } from "@/components/drop-draft-card";
import { useDebugInspector } from "@/hooks/use-debug-inspector";
import { useAnalyticalBalanceDnd } from "@/hooks/use-analytical-balance-dnd";
import { useDragState } from "@/hooks/use-drag-state";
import { useGrinderDnd } from "@/hooks/use-grinder-dnd";
import { useGrossBalanceDnd } from "@/hooks/use-gross-balance-dnd";
import { useDropDraft } from "@/hooks/use-drop-draft";
import { useLabExperiment } from "@/hooks/use-lab-experiment";
import { useRackDnd } from "@/hooks/use-rack-dnd";
import { useActionMode } from "@/hooks/use-action-mode";
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
  buildDebugSlurryTubeDraftFields,
  debugProducePresets,
  debugSlurryTubePreset,
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
import type { ToolbarCategory } from "@/types/workbench";

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
      if (payload.source.kind !== "palette" || payload.entity.id !== "apple_slurry_centrifuge_tube") {
        flatApi.moveObject(payload);
        return;
      }
      setPendingDropDraft({
        commandType: "create_debug_tool_preset",
        confirmLabel: "Spawn",
        destinationKind: payload.destination.kind as
          | "analytical_balance"
          | "gross_balance"
          | "trash_bin"
          | "vortex"
          | "workbench_slot",
        fields: buildDebugSlurryTubeDraftFields(),
        presetId: "apple_slurry_centrifuge_tube",
        targetId: payload.destination.id,
        targetKind: "workspace_widget",
        title: "Configure Apple slurry tube",
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
  const { inspection: debugInspection, clear: clearDebugInspection } = useDebugInspector();
  const [isBasketOpen, setIsBasketOpen] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [toolbarCategories, setToolbarCategories] = useState<ToolbarCategory[]>([]);
  const inventoryDropRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const spatula =
    state.status === "ready"
      ? state.experiment.spatula
      : { isLoaded: false, produceFractions: [], sourceToolId: null };

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
    workspaceCursor,
    handleSpatulaAnalyticalBalancePointerDown,
    handleSpatulaToolCardClick,
    handleSpatulaToolIllustrationClick,
    handleSpatulaToolPointerDown,
    handleSpatulaToolPointerUp,
    handleSpatulaTrashClick,
    spatulaCursorPosition,
    spatulaHintMessage,
    stopSpatulaPour,
  } = useActionMode({ clearDropTargets, experimentApi: dndApi, spatula });

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
        debugToolPresets: [debugSlurryTubePreset],
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
        setActiveActionId,
        spatula,
        spatulaCursorPosition,
        spatulaHintMessage,
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
        handlePourExtract: (tubeToolId: string) => {
          const allSlots = [
            ...state.experiment.workbench.slots,
            ...state.experiment.rack.slots,
          ];
          const vial = allSlots
            .flatMap((s) => (s.tool ? [s.tool] : []))
            .find((t) => t.toolType === "sample_vial" && !t.injectionContext);
          if (vial) {
            void experimentApi.lcmsms.pourExtract({ tube_tool_id: tubeToolId, vial_tool_id: vial.id });
          }
        },
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
      {pendingDropDraft?.commandType === "create_debug_tool_preset" ? (
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
