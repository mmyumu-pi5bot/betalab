import { translateNow } from "@/lib/i18n";
import type { ProduceDropCommand } from "@/lib/produce-drop-command-resolver";
import type { DropDraft } from "@/hooks/use-drop-draft";
import type { MoveObjectPayload } from "@/types/api-payloads";

type SetPendingDropDraft = (draft: DropDraft | null) => void;

type WorkbenchProduceDropApi = {
  moveObject: (payload: MoveObjectPayload) => void;
};

type GrossBalanceProduceDropApi = {
  moveObject: (payload: MoveObjectPayload) => void;
};

type GrinderProduceDropApi = {
  moveObject: (payload: MoveObjectPayload) => void;
};

function openProduceDraft(
  command:
    | Extract<ProduceDropCommand, { kind: "create_debug_produce_lot_on_workbench" }>
    | Extract<ProduceDropCommand, { kind: "create_debug_produce_lot_to_widget" }>,
  setPendingDropDraft: SetPendingDropDraft,
  buildDebugProduceDraftFields: () => DropDraft["fields"],
) {
  setPendingDropDraft({
    commandType:
      command.kind === "create_debug_produce_lot_on_workbench"
        ? "create_debug_produce_lot_on_workbench"
        : "create_debug_produce_lot_to_widget",
    confirmLabel: translateNow("draft.spawn"),
    fields: buildDebugProduceDraftFields(),
    presetId: command.payload.presetId,
    targetId:
      command.kind === "create_debug_produce_lot_on_workbench"
        ? command.payload.targetSlotId
        : command.payload.widgetId,
    targetKind:
      command.kind === "create_debug_produce_lot_on_workbench"
        ? "bench_slot"
        : "workspace_widget",
    title: translateNow("draft.configureApplePowder"),
  });
}

export function executeWorkbenchProduceDropCommand(
  command: ProduceDropCommand,
  api: WorkbenchProduceDropApi,
  options: {
    buildDebugProduceDraftFields: () => DropDraft["fields"];
    setPendingDropDraft: SetPendingDropDraft;
  },
): boolean {
  if (command.kind === "create_debug_produce_lot_on_workbench") {
    openProduceDraft(command, options.setPendingDropDraft, options.buildDebugProduceDraftFields);
    return true;
  }
  if (command.kind === "move_object") {
    void api.moveObject(command.payload);
    return true;
  }
  return false;
}

export function executeGrossBalanceProduceDropCommand(
  command: ProduceDropCommand,
  api: GrossBalanceProduceDropApi,
  options: {
    buildDebugProduceDraftFields: () => DropDraft["fields"];
    setPendingDropDraft: SetPendingDropDraft;
  },
): boolean {
  if (command.kind === "create_debug_produce_lot_to_widget") {
    openProduceDraft(command, options.setPendingDropDraft, options.buildDebugProduceDraftFields);
    return true;
  }
  if (command.kind === "move_object") {
    void api.moveObject(command.payload);
    return true;
  }
  return false;
}

export function executeGrinderProduceDropCommand(
  command: ProduceDropCommand,
  api: GrinderProduceDropApi,
  options: {
    buildDebugProduceDraftFields: () => DropDraft["fields"];
    setPendingDropDraft: SetPendingDropDraft;
  },
): boolean {
  if (command.kind === "create_debug_produce_lot_to_widget") {
    openProduceDraft(command, options.setPendingDropDraft, options.buildDebugProduceDraftFields);
    return true;
  }
  if (command.kind === "move_object") {
    void api.moveObject(command.payload);
    return true;
  }
  return false;
}
