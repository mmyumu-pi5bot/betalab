import type { DragEvent } from "react";

import {
  hasCompatibleDropTarget,
  readProduceDragPayload,
  readToolbarDragPayload,
  toDragDescriptor,
  writeProduceDragPayload,
  writeWorkspaceLiquidDragPayload,
} from "@/lib/workbench-dnd";
import { labLiquidCatalog } from "@/lib/lab-workflow-catalog";
import { executeGrinderProduceDropCommand } from "@/lib/produce-drop-command-executor";
import { resolveProduceDropCommand } from "@/lib/produce-drop-command-resolver";
import type {
  ExperimentProduceLot,
  ExperimentWorkspaceWidget,
  LiquidType,
  WorkspaceLiquidDragPayload,
} from "@/types/workbench";
import type { DragStateApi } from "@/hooks/use-drag-state";
import type { DropDraft } from "@/hooks/use-drop-draft";
import type { DropDraftField } from "@/components/drop-draft-card";
import type {
  MoveObjectPayload,
  StartGrinderCyclePayload,
} from "@/types/api-payloads";

export type GrinderDndExperimentApi = {
  moveObject: (payload: MoveObjectPayload) => void;
  startGrinderCycle: (payload: StartGrinderCyclePayload) => void;
};

type GrinderDndOptions = {
  buildDebugProduceDraftFields: () => DropDraftField[];
  dndDisabledByAction: boolean;
  dragState: Pick<DragStateApi, "clearDropTargets" | "setActiveDragItem" | "showDropTargets">;
  experimentApi: GrinderDndExperimentApi;
  grinderWidget: ExperimentWorkspaceWidget | null;
  isCommandPending: boolean;
  pendingDropDraft: DropDraft | null;
  setPendingDropDraft: (draft: DropDraft | null) => void;
};

export type GrinderDndApi = {
  grinderCanAttempt: boolean;
  grinderDisplayLabel: string;
  grinderDisplayMode: string;
  grinderDndDisabled: boolean;
  grinderInfoLine1: string;
  grinderInfoLine1Right: string;
  grinderInfoLine2: string;
  grinderInfoLine2Right: string;
  grinderLiquids: NonNullable<ExperimentWorkspaceWidget["liquids"]>;
  grinderProduceLots: ExperimentProduceLot[];
  grinderProgressPercent: number;
  grinderStatus: "running" | "ready" | "idle";
  handleGrinderDragOver: (event: DragEvent<HTMLDivElement>) => void;
  handleGrinderDrop: (event: DragEvent<HTMLDivElement>) => void;
  handleGrinderLiquidDragStart: (
    liquid: NonNullable<ExperimentWorkspaceWidget["liquids"]>[number],
    dataTransfer: DataTransfer,
  ) => void;
  handleGrinderProduceDragStart: (
    produceLot: ExperimentProduceLot,
    dataTransfer: DataTransfer,
  ) => void;
  handleStartGrinder: () => void;
  grinderLotIsWaste: boolean;
  isGrinderRunning: boolean;
  pendingGrinderDropDraft: DropDraft | null;
};

type GrinderDisplayMode =
  | "complete"
  | "idle"
  | "jammed"
  | "overload"
  | "ready"
  | "running"
  | "warning";

export function useGrinderDnd({
  buildDebugProduceDraftFields,
  dndDisabledByAction,
  dragState,
  experimentApi,
  grinderWidget,
  isCommandPending,
  pendingDropDraft,
  setPendingDropDraft,
}: GrinderDndOptions): GrinderDndApi {
  const { clearDropTargets, setActiveDragItem, showDropTargets } = dragState;

  const grinderProduceLots = grinderWidget?.produceLots ?? [];
  const grinderLiquids: NonNullable<ExperimentWorkspaceWidget["liquids"]> =
    grinderWidget?.liquids ?? [];
  const grinderLoadedLot = grinderProduceLots[0] ?? null;
  const grinderHasProduceLot = grinderProduceLots.length > 0;
  const grinderLotIsWaste = (grinderLoadedLot?.materialState ?? "whole") === "waste";
  const grinderFault = grinderWidget?.grinderFault ?? null;
  const grinderRunRemainingMs = grinderWidget?.grinderRunRemainingMs ?? 0;
  const grinderRunDurationMs = grinderWidget?.grinderRunDurationMs ?? 0;
  const isGrinderRunning = grinderRunRemainingMs > 0;
  const grinderProgressPercent =
    grinderRunDurationMs > 0
      ? Math.max(
          0,
          Math.min(
            ((grinderRunDurationMs - grinderRunRemainingMs) / grinderRunDurationMs) * 100,
            100,
          ),
        )
      : 0;
  const pendingGrinderDropDraft =
    pendingDropDraft?.targetKind === "workspace_widget" &&
    pendingDropDraft.targetId === "grinder"
      ? pendingDropDraft
      : null;
  const grinderCanAttempt = Boolean(grinderWidget?.grinderCanStart) && !pendingGrinderDropDraft;
  const grinderDndDisabled = dndDisabledByAction || isGrinderRunning;

  const grinderStatus: "running" | "ready" | "idle" =
    isGrinderRunning && grinderFault !== "motor_jammed"
      ? "running"
      : grinderCanAttempt
        ? "ready"
        : "idle";

  const grinderDisplayMode = (grinderWidget?.grinderDisplayMode ?? "idle") as GrinderDisplayMode;

  const grinderDisplayLabel =
    grinderDisplayMode === "running"
      ? "RUNNING"
      : grinderDisplayMode === "complete"
        ? "COMPLETE"
        : grinderDisplayMode === "warning"
          ? "WARNING"
          : grinderDisplayMode === "overload"
            ? "OVERLOAD"
            : grinderDisplayMode === "jammed"
              ? "JAMMED"
              : grinderDisplayMode === "ready"
                ? "READY"
                : "STANDBY";

  const grinderInfoLine1 =
    grinderDisplayMode === "running"
      ? `Progress ${Math.round(grinderProgressPercent)}%`
      : grinderDisplayMode === "warning"
        ? "Torque high"
        : "RPM 00000";

  const grinderInfoLine1Right =
    grinderDisplayMode === "running" || grinderDisplayMode === "warning"
      ? "RPM 10000"
      : grinderDisplayMode === "ready"
        ? "Cycle 30s"
        : "";

  const grinderInfoLine2 =
    grinderDisplayMode === "running"
      ? "Load nominal"
      : grinderDisplayMode === "warning"
        ? "Jam risk"
        : grinderDisplayMode === "ready"
          ? "Load ready"
          : grinderDisplayMode === "complete"
            ? "Rotor stopped"
            : grinderDisplayMode === "overload"
              ? "Load too high"
              : grinderDisplayMode === "jammed"
                ? "Start lock"
                : "Rotor stopped";

  const grinderInfoLine2Right =
    grinderDisplayMode === "running"
      ? "Cryo mode"
      : grinderDisplayMode === "warning"
        ? "Pre-cool now"
        : grinderDisplayMode === "ready"
          ? "Cryo armed"
          : grinderDisplayMode === "complete"
            ? "Unload lot"
            : grinderDisplayMode === "overload"
              ? "Cut first"
              : grinderDisplayMode === "jammed"
                ? "Pre-cool"
                : grinderHasProduceLot
                  ? "Cycle ready"
                  : "No sample";

  const handleOpenGrinderLiquidDraft = (liquidId: "dry_ice_pellets") => {
    const liquidDefinition = labLiquidCatalog[liquidId];
    setPendingDropDraft({
      commandType: "add_liquid_to_workspace_widget",
      fields: [
        {
          ariaLabel: "Dry ice draft mass",
          id: "volume_ml",
          inputStep: 1,
          label: "Mass",
          stepAmount: 100,
          unitLabel: "g",
          value: liquidDefinition?.transfer_volume_ml ?? 1000,
          wheelStep: 100,
        },
      ],
      itemId: liquidId,
      targetId: "grinder",
      targetKind: "workspace_widget",
      title: `Dose ${liquidDefinition?.name ?? "Dry ice pellets"}`,
    });
  };

  const handleGrinderLiquidDragStart = (
    liquid: NonNullable<ExperimentWorkspaceWidget["liquids"]>[number],
    dataTransfer: DataTransfer,
  ) => {
    if (grinderDndDisabled) {
      return;
    }
    const allowedDropTargets = ["trash_bin"] as const;
    const payload: WorkspaceLiquidDragPayload = {
      allowedDropTargets: [...allowedDropTargets],
      entityKind: "liquid",
      liquidEntryId: liquid.id,
      liquidType: liquid.liquidId as LiquidType,
      sourceId: liquid.id,
      sourceKind: "grinder",
      widgetId: "grinder",
    };
    writeWorkspaceLiquidDragPayload(dataTransfer, payload);
    showDropTargets([...allowedDropTargets]);
    setActiveDragItem(toDragDescriptor(payload));
  };

  const handleGrinderDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (grinderDndDisabled) {
      return;
    }
    if (hasCompatibleDropTarget(event.dataTransfer, "grinder_widget")) {
      event.preventDefault();
    }
  };

  const handleGrinderDrop = (event: DragEvent<HTMLDivElement>) => {
    if (grinderDndDisabled) {
      return;
    }
    if (!hasCompatibleDropTarget(event.dataTransfer, "grinder_widget")) {
      return;
    }

    const toolbarPayload = readToolbarDragPayload(event.dataTransfer);
    if (toolbarPayload?.itemType === "liquid") {
      event.preventDefault();
      clearDropTargets();
      if (toolbarPayload.itemId === "dry_ice_pellets") {
        handleOpenGrinderLiquidDraft("dry_ice_pellets");
      }
      return;
    }

    const producePayload = readProduceDragPayload(event.dataTransfer);
    if (!producePayload) {
      return;
    }

    event.preventDefault();
    clearDropTargets();

    const command = resolveProduceDropCommand(producePayload, {
      kind: "workspace_widget",
      widgetId: "grinder",
    });
    if (command) {
      executeGrinderProduceDropCommand(command, experimentApi, {
        buildDebugProduceDraftFields,
        setPendingDropDraft,
      });
    }
  };

  const handleStartGrinder = () => {
    if (!grinderCanAttempt || isGrinderRunning || isCommandPending) {
      return;
    }
    void experimentApi.startGrinderCycle({ widget_id: "grinder" });
  };

  const handleGrinderProduceDragStart = (
    produceLot: ExperimentProduceLot,
    dataTransfer: DataTransfer,
  ) => {
    if (grinderDndDisabled) {
      return;
    }
    const allowedDropTargets = produceLot.allowedDropTargets ?? [];
    writeProduceDragPayload(dataTransfer, {
      allowedDropTargets,
      entityKind: "produce",
      produceLotId: produceLot.id,
      produceType: produceLot.produceType,
      sourceId: produceLot.id,
      sourceKind: "grinder",
    });
    showDropTargets(allowedDropTargets);
    setActiveDragItem({
      allowedDropTargets,
      entityKind: "produce",
      produceLotId: produceLot.id,
      produceType: produceLot.produceType,
      sourceId: produceLot.id,
      sourceKind: "grinder",
    });
  };

  return {
    grinderCanAttempt,
    grinderDisplayLabel,
    grinderDisplayMode,
    grinderDndDisabled,
    grinderInfoLine1,
    grinderInfoLine1Right,
    grinderInfoLine2,
    grinderInfoLine2Right,
    grinderLiquids,
    grinderProduceLots,
    grinderProgressPercent,
    grinderStatus,
    handleGrinderDragOver,
    handleGrinderDrop,
    handleGrinderLiquidDragStart,
    handleGrinderProduceDragStart,
    handleStartGrinder,
    grinderLotIsWaste,
    isGrinderRunning,
    pendingGrinderDropDraft,
  };
}
