"use client";

import type { Dispatch, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode, RefObject, SetStateAction } from "react";
import type { DragEvent } from "react";

import { ActionBarPanel } from "@/components/action-bar-panel";
import { ExperimentAppHeader } from "@/components/experiment-app-header";
import { LabSceneInventoryPanel } from "@/components/lab-scene-inventory-panel";
import { LabSceneWorkspaceCanvas } from "@/components/lab-scene-workspace-canvas";
import { SpatulaOverlay } from "@/components/lab-scene-spatula-overlay";
import { PipetteOverlay } from "@/components/lab-scene-pipette-overlay";
import type { DebugProducePreset } from "@/components/debug-produce-palette";
import type { CentrifugeDndApi } from "@/hooks/use-centrifuge-dnd";
import type { IceBathDndApi } from "@/hooks/use-ice-bath-dnd";
import type { AnalyticalBalanceDndApi } from "@/hooks/use-analytical-balance-dnd";
import type { DropDraft } from "@/hooks/use-drop-draft";
import type { GrinderDndApi } from "@/hooks/use-grinder-dnd";
import type { GrossBalanceDndApi } from "@/hooks/use-gross-balance-dnd";
import type { RackDndApi } from "@/hooks/use-rack-dnd";
import type { TrashDndApi } from "@/hooks/use-trash-dnd";
import type { VortexDndApi } from "@/hooks/use-vortex-dnd";
import type { WorkbenchDndApi } from "@/hooks/use-workbench-dnd";
import type { WidgetLayout } from "@/hooks/use-workspace-layout";
import type { Experiment } from "@/types/experiment";
import type {
  BenchSlot,
  BenchToolInstance,
  DragDescriptor,
  DropTargetType,
  ExperimentProduceLot,
  ExperimentWorkspaceWidget,
  RackSlot,
  PipetteState,
  SpatulaState,
  ToolbarCategory,
  ToolbarItem,
  ToolbarDragPayload,
  TrashProduceLotEntry,
  TrashSampleLabelEntry,
} from "@/types/workbench";
import type { MoveObjectPayload, RunSequencePayload } from "@/types/api-payloads";

type LabSceneViewProps = {
  experiment: Experiment;
  balances: {
    analyticalBalanceMeasuredMassG: number | null;
    analyticalBalanceNetMassG: number | null;
    grossBalanceNetMassG: number;
  };
  debug: {
    debugInventoryEnabled: boolean;
    debugProducePresets: DebugProducePreset[];
    debugToolPresets: ToolbarItem[];
  };
  inventory: {
    toolbarCategories: ToolbarCategory[];
  };
  display: {
    basketProduceLots: ExperimentProduceLot[];
    basketTools: BenchToolInstance[];
    discardedFrom: Record<string, string>;
    rackSlots: RackSlot[];
    slots: BenchSlot[];
    trashProduceLots: TrashProduceLotEntry[];
    trashTools: BenchToolInstance[];
    trashedSampleLabels: TrashSampleLabelEntry[];
    trashedWidgets: ExperimentWorkspaceWidget[];
  };
  dnd: {
    analyticalBalance: AnalyticalBalanceDndApi;
    centrifuge: CentrifugeDndApi;
    iceBath: IceBathDndApi;
    clearDropTargets: () => void;
    dndDisabledByAction: boolean;
    grinder: GrinderDndApi;
    grossBalance: GrossBalanceDndApi;
    inventoryDropRef: RefObject<HTMLDivElement | null>;
    isDropTargetHighlighted: (target: DropTargetType) => boolean;
    rack: RackDndApi;
    setActiveDragItem: (item: DragDescriptor | null) => void;
    showDropTargets: (targets: readonly DropTargetType[]) => void;
    trash: TrashDndApi;
    vortex: VortexDndApi;
    workbench: WorkbenchDndApi;
  };
  dropDraft: {
    handleConfirmDropDraft: () => void;
    handleUpdateDropDraftField: (fieldId: string, value: number) => void;
    pendingDropDraft: DropDraft | null;
    renderPendingBenchDropDraft: (slotId: string) => ReactNode;
    setPendingDropDraft: Dispatch<SetStateAction<DropDraft | null>>;
  };
  rack: {
    getRackIllustrationSlotPosition: (index: number) => { left: string; top: string };
    instrumentStatus: "completed" | "idle" | "ready" | "running";
    rackLoadedCount: number;
    rackOccupiedSlotLiquids: Record<number, BenchToolInstance["liquids"]>;
    rackOccupiedSlots: number[];
    rackOpenSlots: number[];
    rackSlotCount: number;
  };
  spatula: {
    activeActionId: string | null;
    handleSpatulaAnalyticalBalancePointerDown: (tool: BenchToolInstance, event: ReactPointerEvent<HTMLElement>) => void;
    handleSpatulaToolCardClick: (slotId: string, tool: BenchToolInstance, event: ReactMouseEvent<HTMLElement>) => void;
    handleSpatulaToolIllustrationClick: (slotId: string, tool: BenchToolInstance, event: ReactMouseEvent<HTMLButtonElement>) => void;
    handleSpatulaToolPointerDown: (slotId: string, tool: BenchToolInstance, event: ReactPointerEvent<HTMLElement>) => void;
    handleSpatulaToolPointerUp: () => void;
    handleSpatulaTrashClick: () => void;
    isSpatulaMode: boolean;
    isPipetteMode: boolean;
    setActiveActionId: Dispatch<SetStateAction<string | null>>;
    spatula: SpatulaState;
    spatulaCursorPosition: { x: number; y: number } | null;
    spatulaHintMessage: string | null;
    pipette: PipetteState;
    pipetteHintMessage: string | null;
    stopPipetteHold: () => void;
    stopSpatulaPour: () => void;
  };
  ui: {
    hasSyncError: boolean;
    isBasketOpen: boolean;
    isCommandPending: boolean;
    isTrashEmpty: boolean;
    isTrashOpen: boolean;
    onRenameExperiment: (name: string) => Promise<boolean>;
    setIsBasketOpen: Dispatch<SetStateAction<boolean>>;
    setIsTrashOpen: Dispatch<SetStateAction<boolean>>;
    statusMessage: string;
  };
  workbench: {
    canApplyLimsLabelToSlot: (slot: BenchSlot) => boolean;
    formatProduceLotMetadata: (lot: ExperimentProduceLot) => string | null;
    handleAddWorkbenchSlot: () => void;
    handleApplyLimsLabelTicket: (payload: { basketBag?: true; grossBalanceBag?: true; slotId?: string }) => void;
    handleApplySampleLabel: (slotId: string) => void;
    handleMoveObject: (payload: MoveObjectPayload) => void;
    handleRemoveLiquid: (slotId: string, liquidId: string) => void;
    handleRemoveWorkbenchSlot: (slotId: string) => void;
    handleStoreWorkbenchTool: (slotId: string) => void;
    handleSampleLabelTextChange: (slotId: string, labelId: string, text: string) => void;
    handleToggleToolSeal: (slotId: string, tool: BenchToolInstance) => void;
    handleToolbarItemDrop: (slotId: string, payload: ToolbarDragPayload) => void;
    isBenchSlotHighlighted: (slot: BenchSlot) => boolean;
  };
  workspace: {
    activeWidgetId: string | null;
    handleWidgetDragStart: (widgetId: string, event: ReactMouseEvent<HTMLDivElement>) => void;
    handleWidgetHeightChange: (widgetId: string, height: number) => void;
    handleWorkspaceDragOver: (event: DragEvent<HTMLDivElement>) => void;
    handleWorkspaceDrop: (event: DragEvent<HTMLDivElement>) => void;
    liveWidgetIds: string[];
    registerWidgetNode: (widgetId: string, node: HTMLDivElement | null) => void;
    widgetLayout: Record<string, WidgetLayout>;
    widgetOrder: string[];
    workspaceCursor: string | undefined;
    workspaceHeight: number;
    workspaceRef: RefObject<HTMLDivElement | null>;
  };
  workspaceActions: {
    handleAnalyticalBalanceToolSealToggle: () => void;
    handleBalanceToolSealToggle: () => void;
    handleCreateAppleLot: () => void;
    handleSaveLimsReception: (payload: {
      entry_id?: string;
      harvest_date: string;
      indicative_mass_g: number;
      measured_sample_mass_g: number | null;
      orchard_name: string;
    }) => void;
    onStartVortex: () => void;
    onStartCentrifuge: () => void;
    onStoreWorkspaceWidget: (widgetId: ExperimentWorkspaceWidget["id"]) => void;
    onToggleVortexToolSeal: () => void;
    onToggleCentrifugeToolSeal: () => void;
    onToggleIceBathToolSeal: () => void;
    onCommitGrossBalanceOffset: (nextOffsetG: number) => void;
    onAcknowledgeReceptionMassCheck: (entryId?: string) => void;
    onPrintLimsLabel: (entryId?: string) => void;
    onLoadRackIntoInstrument: () => void;
    onRunSequence: (payload: RunSequencePayload) => void;
    onSkipAcquisition: () => void;
    onUnloadRackFromInstrument: () => void;
    onTareAnalyticalBalance: () => void;
  };
};

export function LabSceneView({
  balances,
  debug,
  display,
  dnd,
  dropDraft,
  experiment,
  inventory,
  rack,
  spatula,
  ui,
  workbench,
  workspace,
  workspaceActions,
}: LabSceneViewProps) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.12),_transparent_30%),linear-gradient(180deg,#fffaf0_0%,#eef6ff_100%)] px-4 py-8 text-slate-950 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
      <div className="mx-auto w-full">
        <ExperimentAppHeader
          experimentName={experiment.name || experiment.id}
          hasSyncError={ui.hasSyncError}
          isSyncing={ui.isCommandPending}
          journalEntries={experiment.journalEntries}
          onRenameExperiment={ui.onRenameExperiment}
          statusMessage={ui.statusMessage}
        />

        <div className="mt-6 grid gap-4 xl:grid-cols-[202px_minmax(0,1fr)_92px] xl:items-start xl:gap-6">
          <LabSceneInventoryPanel
            debug={debug}
            dnd={{
              clearDropTargets: dnd.clearDropTargets,
              dndDisabledByAction: dnd.dndDisabledByAction,
              inventoryDropRef: dnd.inventoryDropRef,
              isInventoryDropHighlighted: dnd.isDropTargetHighlighted("inventory_panel"),
              setActiveDragItem: dnd.setActiveDragItem,
              showDropTargets: dnd.showDropTargets,
              workbench: dnd.workbench,
            }}
            toolbarCategories={inventory.toolbarCategories}
          />

          <LabSceneWorkspaceCanvas
            balances={balances}
            display={display}
            dnd={dnd}
            dropDraft={dropDraft}
            experiment={experiment}
            rack={rack}
            spatula={{
              handleSpatulaAnalyticalBalancePointerDown: spatula.handleSpatulaAnalyticalBalancePointerDown,
              handleSpatulaToolCardClick: spatula.handleSpatulaToolCardClick,
              handleSpatulaToolIllustrationClick: spatula.handleSpatulaToolIllustrationClick,
              handleSpatulaToolPointerDown: spatula.handleSpatulaToolPointerDown,
              handleSpatulaToolPointerUp: spatula.handleSpatulaToolPointerUp,
              handleSpatulaTrashClick: spatula.handleSpatulaTrashClick,
              isSpatulaMode: spatula.isSpatulaMode,
            }}
            ui={ui}
            workbench={workbench}
            workspace={workspace}
            workspaceActions={workspaceActions}
          />

          <div className="xl:sticky xl:top-6 xl:self-start" data-testid="widget-actions">
            <ActionBarPanel
              activeActionId={spatula.activeActionId}
              pipette={spatula.pipette}
              onToggleAction={(actionId) => {
                dnd.clearDropTargets();
                spatula.stopSpatulaPour();
                spatula.stopPipetteHold();
                spatula.setActiveActionId((current) => (current === actionId ? null : actionId));
              }}
            />
          </div>
        </div>
      </div>

      <SpatulaOverlay
        cursorPosition={spatula.spatulaCursorPosition}
        isSpatulaMode={spatula.isSpatulaMode}
        spatula={spatula.spatula}
      />
      <PipetteOverlay
        hint={spatula.pipetteHintMessage}
        isPipetteMode={spatula.isPipetteMode}
        pipette={spatula.pipette}
      />
    </main>
  );
}
