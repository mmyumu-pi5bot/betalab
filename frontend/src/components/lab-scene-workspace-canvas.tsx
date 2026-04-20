"use client";

import type { Dispatch, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode, RefObject, SetStateAction } from "react";
import type { DragEvent } from "react";

import { AnalyticalBalanceWidget } from "@/components/analytical-balance-widget";
import { BenchToolCard } from "@/components/bench-tool-card";
import { DropDraftCard } from "@/components/drop-draft-card";
import { FloatingWidget } from "@/components/floating-widget";
import { GrinderWidgetContent } from "@/components/grinder-widget-content";
import { GrossBalanceWidget } from "@/components/gross-balance-widget";
import { LcMsMsInstrumentIllustration } from "@/components/illustrations/lc-msms-instrument-illustration";
import { LimsWidget } from "@/components/lims-widget";
import { ProduceBasketWidget } from "@/components/produce-basket-widget";
import { ProduceLotCard } from "@/components/produce-lot-card";
import { RackWidget } from "@/components/rack-widget";
import { TrashWidget } from "@/components/trash-widget";
import { VortexWidget } from "@/components/vortex-widget";
import { WorkbenchPanel } from "@/components/workbench-panel";
import { WorkspaceEquipmentWidget } from "@/components/workspace-equipment-widget";
import type { AnalyticalBalanceDndApi } from "@/hooks/use-analytical-balance-dnd";
import type { DropDraft } from "@/hooks/use-drop-draft";
import type { GrinderDndApi } from "@/hooks/use-grinder-dnd";
import type { GrossBalanceDndApi } from "@/hooks/use-gross-balance-dnd";
import type { RackDndApi } from "@/hooks/use-rack-dnd";
import type { TrashDndApi } from "@/hooks/use-trash-dnd";
import type { VortexDndApi } from "@/hooks/use-vortex-dnd";
import type { WorkbenchDndApi } from "@/hooks/use-workbench-dnd";
import type { WidgetLayout } from "@/hooks/use-workspace-layout";
import { canStoreWorkspaceWidget, canWorkspaceWidgetBeStored } from "@/lib/tool-drop-targets";
import { isWorkspaceEquipmentWidgetId } from "@/lib/workspace-widget-ids";
import type { Experiment } from "@/types/experiment";
import type {
  BenchLabel,
  BenchSlot,
  BenchToolInstance,
  DragDescriptor,
  DropTargetType,
  ExperimentProduceLot,
  ExperimentWorkspaceWidget,
  RackSlot,
  ToolbarDragPayload,
  TrashProduceLotEntry,
  TrashSampleLabelEntry,
  TrashToolEntry,
} from "@/types/workbench";

type LabSceneWorkspaceCanvasProps = {
  balances: {
    analyticalBalanceMeasuredMassG: number | null;
    analyticalBalanceNetMassG: number | null;
    grossBalanceNetMassG: number;
  };
  display: {
    basketProduceLots: ExperimentProduceLot[];
    basketTools: BenchToolInstance[];
    rackSlots: RackSlot[];
    slots: BenchSlot[];
    trashProduceLots: TrashProduceLotEntry[];
    trashTools: TrashToolEntry[];
    trashedSampleLabels: TrashSampleLabelEntry[];
    trashedWidgets: ExperimentWorkspaceWidget[];
  };
  dnd: {
    analyticalBalance: AnalyticalBalanceDndApi;
    clearDropTargets: () => void;
    dndDisabledByAction: boolean;
    grinder: GrinderDndApi;
    grossBalance: GrossBalanceDndApi;
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
  experiment: Experiment;
  rack: {
    getRackIllustrationSlotPosition: (index: number) => { left: string; top: string };
    instrumentStatus: "idle" | "ready";
    isRackSlotHighlighted: boolean;
    rackLoadedCount: number;
    rackOccupiedSlotLiquids: Record<number, BenchToolInstance["liquids"]>;
    rackOccupiedSlots: number[];
    rackSlotCount: number;
  };
  spatula: {
    handleSpatulaAnalyticalBalancePointerDown: (tool: BenchToolInstance, event: ReactPointerEvent<HTMLElement>) => void;
    handleSpatulaToolCardClick: (slotId: string, tool: BenchToolInstance, event: ReactMouseEvent<HTMLElement>) => void;
    handleSpatulaToolIllustrationClick: (slotId: string, tool: BenchToolInstance, event: ReactMouseEvent<HTMLButtonElement>) => void;
    handleSpatulaToolPointerDown: (slotId: string, tool: BenchToolInstance, event: ReactPointerEvent<HTMLElement>) => void;
    handleSpatulaToolPointerUp: () => void;
    handleSpatulaTrashClick: () => void;
    isSpatulaMode: boolean;
  };
  ui: {
    isBasketOpen: boolean;
    isCommandPending: boolean;
    isTrashEmpty: boolean;
    isTrashOpen: boolean;
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
    handleMoveSampleLabel: (targetSlotId: string, payload: { label?: BenchLabel; sourceSlotId?: string }) => void;
    handleRemoveLiquid: (slotId: string, liquidId: string) => void;
    handleRemoveWorkbenchSlot: (slotId: string) => void;
    handleRestoreTrashedSampleLabel: (targetSlotId: string, payload: { trashSampleLabelId?: string }) => void;
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
    onStoreWorkspaceWidget: (widgetId: ExperimentWorkspaceWidget["id"]) => void;
    onCommitGrossBalanceOffset: (nextOffsetG: number) => void;
    onPrintLimsLabel: (entryId?: string) => void;
    onTareAnalyticalBalance: () => void;
  };
};

export function LabSceneWorkspaceCanvas({
  balances,
  display,
  dnd,
  dropDraft,
  experiment,
  rack,
  spatula,
  ui,
  workbench,
  workspace,
  workspaceActions,
}: LabSceneWorkspaceCanvasProps) {
  const pendingGrossBalanceDropDraft =
    dropDraft.pendingDropDraft?.targetKind === "workspace_widget" &&
    dropDraft.pendingDropDraft.targetId === "gross_balance"
      ? dropDraft.pendingDropDraft
      : null;
  const pendingAnalyticalBalanceDropDraft =
    dropDraft.pendingDropDraft?.targetKind === "workspace_widget" &&
    dropDraft.pendingDropDraft.targetId === "analytical_balance"
      ? dropDraft.pendingDropDraft
      : null;

  const displayBalanceTool =
    experiment.workspace.widgets.find((w) => w.id === "gross_balance")?.tool ?? null;
  const displayBalanceProduceLot =
    experiment.workspace.widgets.find((w) => w.id === "gross_balance")?.produceLots?.[0] ?? null;
  const displayAnalyticalBalanceTool =
    experiment.workspace.widgets.find((w) => w.id === "analytical_balance")?.tool ?? null;
  const vortexWidget = experiment.workspace.widgets.find((w) => w.id === "vortex") ?? null;
  const vortexTool = vortexWidget?.tool ?? null;
  const vortexRunRemainingMs = vortexWidget?.vortexRunRemainingMs ?? 0;
  const vortexRunDurationMs = vortexWidget?.vortexRunDurationMs ?? 0;
  const isVortexRunning = vortexRunRemainingMs > 0;
  const vortexProgressPercent =
    vortexRunDurationMs > 0
      ? Math.round((1 - vortexRunRemainingMs / vortexRunDurationMs) * 100)
      : 0;
  const renderStoreWidgetAction = (widget: ExperimentWorkspaceWidget) => {
    if (!canWorkspaceWidgetBeStored(widget.id) || !widget.isPresent) {
      return undefined;
    }

    const isDisabled =
      !canStoreWorkspaceWidget(widget) ||
      (widget.id === "rack" && display.rackSlots.some((slot) => slot.tool !== null));

    return (
      <button
        aria-label="Store in inventory"
        className={`flex h-10 w-8 items-center justify-center rounded-[0.8rem] border shadow-sm transition ${
          isDisabled
            ? "cursor-not-allowed border-slate-200/80 bg-slate-100/90 text-slate-300"
            : "border-slate-200/90 bg-white/85 text-slate-500 hover:border-slate-300 hover:bg-white hover:text-slate-900"
        }`}
        data-no-widget-drag="true"
        data-testid={`store-workspace-widget-${widget.id}`}
        disabled={isDisabled}
        onClick={() => {
          workspaceActions.onStoreWorkspaceWidget(widget.id);
        }}
        title={isDisabled ? "Empty this equipment before storing it" : "Store in inventory"}
        type="button"
      >
        <svg
          aria-hidden="true"
          className="h-4.5 w-4.5"
          fill="none"
          viewBox="0 0 20 20"
        >
          <path
            d="M5.75 4.75H12.5C12.9142 4.75 13.25 5.08579 13.25 5.5V14.5C13.25 14.9142 12.9142 15.25 12.5 15.25H5.75C5.33579 15.25 5 14.9142 5 14.5V5.5C5 5.08579 5.33579 4.75 5.75 4.75Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M10.25 7L7.25 10L10.25 13"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
          <path
            d="M15.5 10H7.75"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.5"
          />
        </svg>
      </button>
    );
  };

  const grossBalanceStagedContent = pendingGrossBalanceDropDraft ? (
    <DropDraftCard
      confirmLabel={pendingGrossBalanceDropDraft.confirmLabel}
      fields={pendingGrossBalanceDropDraft.fields}
      onCancel={() => dropDraft.setPendingDropDraft(null)}
      onChangeField={dropDraft.handleUpdateDropDraftField}
      onConfirm={dropDraft.handleConfirmDropDraft}
      title={pendingGrossBalanceDropDraft.title}
    />
  ) : displayBalanceTool ? (
    <div
      data-testid="gross-balance-staged-item"
      onDragOver={dnd.grossBalance.handleBalanceStagedToolDragOver}
      onDrop={dnd.grossBalance.handleBalanceStagedToolDrop}
    >
      <BenchToolCard
        dataDropHighlighted={dnd.grossBalance.isGrossBalanceSampleBagHighlighted}
        draggable
        onDragEnd={dnd.clearDropTargets}
        onDragStart={(event) => dnd.grossBalance.handleBalanceItemDragStart(event.dataTransfer)}
        onDragOver={dnd.grossBalance.handleBalanceStagedToolDragOver}
        onDrop={dnd.grossBalance.handleBalanceStagedToolDrop}
        onProduceLotDragEnd={dnd.clearDropTargets}
        onProduceLotDragStart={(produceLot, event) =>
          dnd.grossBalance.handleGrossBalanceProduceLotDragStart(produceLot, event.dataTransfer)
        }
        onToggleSeal={workspaceActions.handleBalanceToolSealToggle}
        onRemoveLiquid={() => {}}
        tool={{ ...displayBalanceTool, id: `balance-${displayBalanceTool.id}` }}
      />
    </div>
  ) : displayBalanceProduceLot ? (
    <div
      className="cursor-grab rounded-[1rem] border border-amber-200 bg-amber-50/80 p-2.5 shadow-sm active:cursor-grabbing"
      data-testid="gross-balance-staged-item"
      draggable
      onDragEnd={dnd.clearDropTargets}
      onDragStart={(event) => dnd.grossBalance.handleBalanceItemDragStart(event.dataTransfer)}
    >
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
        Loose material on pan
      </p>
      <ProduceLotCard
        dataTestId={`gross-balance-produce-${displayBalanceProduceLot.id}`}
        draggable={false}
        metadata={workbench.formatProduceLotMetadata(displayBalanceProduceLot) ?? ""}
        produceLot={{ ...displayBalanceProduceLot, id: `balance-${displayBalanceProduceLot.id}` }}
        variant="expanded"
      />
    </div>
  ) : null;

  const analyticalBalanceStagedContent = pendingAnalyticalBalanceDropDraft ? (
    <DropDraftCard
      confirmLabel={pendingAnalyticalBalanceDropDraft.confirmLabel}
      fields={pendingAnalyticalBalanceDropDraft.fields}
      onCancel={() => dropDraft.setPendingDropDraft(null)}
      onChangeField={dropDraft.handleUpdateDropDraftField}
      onConfirm={dropDraft.handleConfirmDropDraft}
      title={pendingAnalyticalBalanceDropDraft.title}
    />
  ) : displayAnalyticalBalanceTool ? (
    <div
      data-testid="analytical-balance-staged-item"
      onDragOver={dnd.analyticalBalance.handleAnalyticalBalanceDragOver}
      onDrop={dnd.analyticalBalance.handleAnalyticalBalanceDrop}
      onPointerDown={(event) =>
        spatula.handleSpatulaAnalyticalBalancePointerDown(displayAnalyticalBalanceTool, event)
      }
      onPointerUp={spatula.handleSpatulaToolPointerUp}
    >
      <BenchToolCard
        draggable
        onDragEnd={dnd.clearDropTargets}
        onDragStart={(event) =>
          dnd.analyticalBalance.handleAnalyticalBalanceItemDragStart(event.dataTransfer)
        }
        onDragOver={dnd.analyticalBalance.handleAnalyticalBalanceDragOver}
        onDrop={dnd.analyticalBalance.handleAnalyticalBalanceDrop}
        onSampleLabelTextChange={dnd.analyticalBalance.handleAnalyticalBalanceSampleLabelTextChange}
        onToggleSeal={workspaceActions.handleAnalyticalBalanceToolSealToggle}
        onRemoveLiquid={() => {}}
        tool={{ ...displayAnalyticalBalanceTool, id: `analytical-${displayAnalyticalBalanceTool.id}` }}
      />
    </div>
  ) : null;

  const vortexStagedContent = vortexTool ? (
    <div
      data-testid="vortex-staged-item"
      onDragOver={dnd.vortex.handleVortexDragOver}
      onDrop={dnd.vortex.handleVortexDrop}
    >
      <BenchToolCard
        draggable
        onDragEnd={dnd.clearDropTargets}
        onDragStart={(event) => dnd.vortex.handleVortexItemDragStart(event.dataTransfer)}
        onDragOver={dnd.vortex.handleVortexDragOver}
        onDrop={dnd.vortex.handleVortexDrop}
        onRemoveLiquid={() => {}}
        tool={{ ...vortexTool, id: `vortex-${vortexTool.id}` }}
      />
    </div>
  ) : undefined;

  return (
    <section className="overflow-hidden rounded-[2.25rem] border border-white/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.75),rgba(255,255,255,0.55))] p-4 shadow-[0_28px_60px_rgba(15,23,42,0.08)] backdrop-blur xl:p-6">
      <div className="rounded-[1.6rem] border border-white/70 bg-white/65 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Custom layout
          </p>
          <p className="min-w-0 truncate text-sm text-slate-600">
            {ui.isCommandPending ? `${ui.statusMessage} Syncing...` : ui.statusMessage}
          </p>
        </div>
      </div>

      <div
        className={`relative mt-4 overflow-hidden rounded-[2rem] border border-dashed bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.75),rgba(248,250,252,0.7)_40%,rgba(226,232,240,0.55)_100%)] transition-colors ${
          dnd.isDropTargetHighlighted("workspace_canvas")
            ? "border-sky-300/90 ring-2 ring-sky-200/80"
            : "border-slate-300/80"
        }`}
        data-drop-highlighted={dnd.isDropTargetHighlighted("workspace_canvas") ? "true" : "false"}
        data-testid="widget-workspace"
        onDragOverCapture={workspace.handleWorkspaceDragOver}
        onDropCapture={workspace.handleWorkspaceDrop}
        ref={workspace.workspaceRef}
        style={{ cursor: workspace.workspaceCursor, minHeight: workspace.workspaceHeight }}
      >
        <div
          className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] bg-[size:32px_32px]"
          data-testid="workspace-drop-surface-grid"
        />
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.16),transparent_26%)]"
          data-testid="workspace-drop-surface-glow"
        />

        <FloatingWidget
          id="trash"
          isActive={workspace.activeWidgetId === "trash"}
          label="Trash Widget"
          onDragStart={(widgetId, event) => {
            if (dnd.dndDisabledByAction) return;
            workspace.handleWidgetDragStart(widgetId, event);
          }}
          onHeightChange={workspace.handleWidgetHeightChange}
          position={workspace.widgetLayout.trash}
          zIndex={10 + workspace.widgetOrder.indexOf("trash")}
        >
          <TrashWidget
            dndDisabled={dnd.dndDisabledByAction}
            formatProduceLotMetadata={(lot) => workbench.formatProduceLotMetadata(lot) ?? ""}
            isDropHighlighted={dnd.isDropTargetHighlighted("trash_bin")}
            isEmpty={ui.isTrashEmpty}
            isOpen={ui.isTrashOpen}
            onDragOver={dnd.trash.handleTrashDragOver}
            onDrop={dnd.trash.handleTrashDrop}
            onSpatulaDiscard={spatula.handleSpatulaTrashClick}
            onItemDragEnd={dnd.clearDropTargets}
            onToggle={() => {
              if (spatula.isSpatulaMode) {
                return;
              }
              ui.setIsTrashOpen((current) => !current);
            }}
            onToolDragStart={dnd.trash.handleTrashToolDragStart}
            onTrashedWidgetDragStart={dnd.trash.handleTrashedWidgetDragStart}
            onTrashProduceLotDragStart={dnd.trash.handleTrashProduceLotDragStart}
            onTrashSampleLabelDragStart={dnd.trash.handleTrashSampleLabelDragStart}
            trashedProduceLots={display.trashProduceLots}
            trashedSampleLabels={display.trashedSampleLabels}
            trashedTools={display.trashTools}
            trashedWidgets={display.trashedWidgets}
          />
        </FloatingWidget>

        {workspace.liveWidgetIds
          .filter(isWorkspaceEquipmentWidgetId)
          .map((widgetId) => {
            const widget = experiment.workspace.widgets.find((entry) => entry.id === widgetId);
            if (!widget) {
              return null;
            }
            const widgetDropTargets = widget.dropTargetTypes ?? [];
            const grossBalanceTargetType = widgetDropTargets.find((target) => target === "gross_balance_widget");
            const analyticalBalanceTargetType = widgetDropTargets.find(
              (target) => target === "analytical_balance_widget",
            );
            const grinderTargetType = widgetDropTargets.find((target) => target === "grinder_widget");
            const vortexTargetType = widgetDropTargets.find((target) => target === "vortex_widget");

            return (
            <FloatingWidget
              id={widgetId}
              isActive={workspace.activeWidgetId === widgetId}
              key={widgetId}
              label={
                widgetId === "lims"
                  ? "LIMS Widget"
                  : widgetId === "rack"
                    ? "Rack Widget"
                    : widgetId === "instrument"
                      ? "Instrument Widget"
                      : widgetId === "grinder"
                        ? "Grinder Widget"
                        : widgetId === "gross_balance"
                          ? "Gross Balance Widget"
                          : widgetId === "vortex"
                            ? "Vortex Widget"
                            : "Produce Basket Widget"
              }
              onDragStart={(id, event) => {
                if (dnd.dndDisabledByAction) return;
                workspace.handleWidgetDragStart(id, event);
              }}
              onHeightChange={workspace.handleWidgetHeightChange}
              position={workspace.widgetLayout[widgetId]}
              zIndex={10 + workspace.widgetOrder.indexOf(widgetId)}
            >
              {widgetId === "lims" ? (
                <LimsWidget
                  entries={experiment.limsEntries}
                  headerAction={renderStoreWidgetAction(widget)}
                  onPrintLabel={workspaceActions.onPrintLimsLabel}
                  onSaveReception={workspaceActions.handleSaveLimsReception}
                  onTicketDragEnd={dnd.clearDropTargets}
                  onTicketDragStart={dnd.workbench.handleLimsTicketDragStart}
                  reception={experiment.limsReception}
                />
              ) : widgetId === "basket" ? (
                <ProduceBasketWidget
                  basketTools={display.basketTools}
                  dndDisabled={dnd.dndDisabledByAction}
                  formatProduceLotMetadata={(lot) => workbench.formatProduceLotMetadata(lot) ?? ""}
                  isOpen={ui.isBasketOpen}
                  onBagDragStart={dnd.workbench.handleBasketToolDragStart}
                  onCreateAppleLot={workspaceActions.handleCreateAppleLot}
                  onItemDragEnd={dnd.clearDropTargets}
                  onProduceDragStart={dnd.workbench.handleBasketProduceDragStart}
                  onToggle={() => {
                    if (spatula.isSpatulaMode) {
                      return;
                    }
                    ui.setIsBasketOpen((current) => !current);
                  }}
                  produceLots={display.basketProduceLots}
                />
              ) : widgetId === "gross_balance" ? (
                <GrossBalanceWidget
                  headerAction={renderStoreWidgetAction(widget)}
                  isDropHighlighted={
                    grossBalanceTargetType ? dnd.isDropTargetHighlighted(grossBalanceTargetType) : false
                  }
                  grossMassOffsetG={experiment.limsReception.grossMassOffsetG}
                  measuredGrossMassG={experiment.limsReception.measuredGrossMassG}
                  netMassG={balances.grossBalanceNetMassG}
                  onCommitOffset={workspaceActions.onCommitGrossBalanceOffset}
                  onDragOver={dnd.grossBalance.handleGrossBalanceDragOver}
                  onDrop={dnd.grossBalance.handleGrossBalanceDrop}
                  stagedContent={grossBalanceStagedContent}
                />
              ) : widgetId === "analytical_balance" ? (
                <AnalyticalBalanceWidget
                  headerAction={renderStoreWidgetAction(widget)}
                  isDropHighlighted={
                    analyticalBalanceTargetType
                      ? dnd.isDropTargetHighlighted(analyticalBalanceTargetType)
                      : false
                  }
                  measuredMassG={balances.analyticalBalanceMeasuredMassG}
                  netMassG={balances.analyticalBalanceNetMassG}
                  onDragOver={dnd.analyticalBalance.handleAnalyticalBalanceDragOver}
                  onDrop={dnd.analyticalBalance.handleAnalyticalBalanceDrop}
                  onTare={workspaceActions.onTareAnalyticalBalance}
                  stagedContent={analyticalBalanceStagedContent}
                  tareMassG={experiment.analyticalBalance.tareMassG}
                />
              ) : widgetId === "rack" ? (
                <RackWidget
                  dndDisabled={dnd.dndDisabledByAction}
                  getSlotPosition={rack.getRackIllustrationSlotPosition}
                  headerAction={renderStoreWidgetAction(widget)}
                  isSlotHighlighted={rack.isRackSlotHighlighted}
                  loadedCount={rack.rackLoadedCount}
                  occupiedSlotLiquids={rack.rackOccupiedSlotLiquids}
                  occupiedSlots={rack.rackOccupiedSlots}
                  onItemDragEnd={dnd.clearDropTargets}
                  onRackSlotDragOver={dnd.rack.handleRackSlotDragOver}
                  onRackSlotDrop={dnd.rack.handleRackSlotDrop}
                  onRackToolDragStart={dnd.rack.handleRackToolDragStart}
                  rackSlots={display.rackSlots}
                  slotCount={rack.rackSlotCount}
                />
              ) : widgetId === "instrument" ? (
                <WorkspaceEquipmentWidget
                  eyebrow="LC-MS/MS"
                  headerAction={renderStoreWidgetAction(widget)}
                  footer={
                    rack.instrumentStatus === "ready"
                      ? "The instrument reads as sequence-ready because the rack now contains at least one autosampler vial."
                      : "Populate the rack with at least one autosampler vial to switch the instrument preview into a ready state."
                  }
                >
                  <LcMsMsInstrumentIllustration
                    className="mx-auto max-w-[36rem]"
                    status={rack.instrumentStatus}
                    testId="lc-msms-instrument-illustration"
                  />
                </WorkspaceEquipmentWidget>
              ) : widgetId === "vortex" ? (
                <VortexWidget
                  headerAction={renderStoreWidgetAction(widget)}
                  isCommandPending={ui.isCommandPending}
                  isDropHighlighted={
                    vortexTargetType ? dnd.isDropTargetHighlighted(vortexTargetType) : false
                  }
                  isRunning={isVortexRunning}
                  onDragOver={dnd.vortex.handleVortexDragOver}
                  onDrop={dnd.vortex.handleVortexDrop}
                  onStart={workspaceActions.onStartVortex}
                  progressPercent={vortexProgressPercent}
                  stagedContent={vortexStagedContent}
                />
              ) : (
                <WorkspaceEquipmentWidget
                  dataDropHighlighted={
                    grinderTargetType && dnd.isDropTargetHighlighted(grinderTargetType) ? "true" : "false"
                  }
                  dropZoneTestId="grinder-dropzone"
                  eyebrow="Cryogenic grinder"
                  headerAction={renderStoreWidgetAction(widget)}
                  onDragOver={dnd.grinder.handleGrinderDragOver}
                  onDrop={dnd.grinder.handleGrinderDrop}
                >
                  <GrinderWidgetContent
                    formatProduceLotMetadata={workbench.formatProduceLotMetadata}
                    grinder={dnd.grinder}
                    isCommandPending={ui.isCommandPending}
                    onCancelDropDraft={() => dropDraft.setPendingDropDraft(null)}
                    onChangeDropDraftField={dropDraft.handleUpdateDropDraftField}
                    onConfirmDropDraft={dropDraft.handleConfirmDropDraft}
                    onDragEnd={dnd.clearDropTargets}
                  />
                </WorkspaceEquipmentWidget>
              )}
            </FloatingWidget>
            );
          })}

        <FloatingWidget
          id="workbench"
          isActive={workspace.activeWidgetId === "workbench"}
          label="Workbench Widget"
          onDragStart={(id, event) => {
            if (dnd.dndDisabledByAction) return;
            workspace.handleWidgetDragStart(id, event);
          }}
          onHeightChange={workspace.handleWidgetHeightChange}
          position={workspace.widgetLayout.workbench}
          zIndex={5}
        >
          <WorkbenchPanel
            dndDisabled={dnd.dndDisabledByAction}
            onAddWorkbenchSlot={workbench.handleAddWorkbenchSlot}
            onApplyLimsLabelTicket={(slotId) => workbench.handleApplyLimsLabelTicket({ slotId })}
            onApplySampleLabel={workbench.handleApplySampleLabel}
            canDragBenchTool={dnd.workbench.canDragBenchTool}
            isBenchSlotHighlighted={workbench.isBenchSlotHighlighted}
            onBenchToolClick={spatula.handleSpatulaToolCardClick}
            onBenchToolDragEnd={dnd.clearDropTargets}
            onBenchToolIllustrationClick={spatula.handleSpatulaToolIllustrationClick}
            onBenchToolPointerDown={spatula.handleSpatulaToolPointerDown}
            onBenchToolPointerUp={spatula.handleSpatulaToolPointerUp}
            onBenchToolDragStart={dnd.workbench.handleBenchToolDragStart}
            onBenchToolDrop={dnd.workbench.handleBenchToolDrop}
            onProduceLotClick={dnd.workbench.handleWorkbenchProduceLotClick}
            onMoveSampleLabel={workbench.handleMoveSampleLabel}
            onProduceLotDragStart={dnd.workbench.handleWorkbenchProduceLotDragStart}
            onProduceDrop={dnd.workbench.handleProduceDrop}
            onRemoveLiquid={workbench.handleRemoveLiquid}
            onRemoveWorkbenchSlot={workbench.handleRemoveWorkbenchSlot}
            onRestoreTrashedSampleLabel={workbench.handleRestoreTrashedSampleLabel}
            onSampleLabelDragEnd={dnd.clearDropTargets}
            onSampleLabelDragStart={dnd.workbench.handleWorkbenchSampleLabelDragStart}
            onSampleLabelTextChange={workbench.handleSampleLabelTextChange}
            onToggleToolSeal={workbench.handleToggleToolSeal}
            renderPendingContent={(slot) => dropDraft.renderPendingBenchDropDraft(slot.id)}
            slots={display.slots}
            onToolbarItemDrop={workbench.handleToolbarItemDrop}
          />
        </FloatingWidget>
      </div>
    </section>
  );
}
