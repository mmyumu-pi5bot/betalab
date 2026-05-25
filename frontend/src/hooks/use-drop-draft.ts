import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { DropDraftField } from "@/components/drop-draft-card";
import type {
  AddLiquidToAnalyticalBalanceToolPayload,
  AddLiquidToWorkbenchToolPayload,
  AddLiquidToWorkspaceWidgetPayload,
  CreateDebugProduceLotOnWorkbenchPayload,
  CreateDebugProduceLotToWidgetPayload,
} from "@/types/api-payloads";

export type DropDraft = {
  commandType:
    | "add_liquid_to_analytical_balance_tool"
    | "add_liquid_to_workbench_tool"
    | "add_liquid_to_workspace_widget"
    | "create_debug_produce_lot_on_workbench"
    | "create_debug_produce_lot_to_widget";
  confirmLabel?: string;
  fields: DropDraftField[];
  itemId?: string;
  presetId?: string;
  targetId: string;
  targetKind: "bench_slot" | "workspace_widget";
  title: string;
};

export type DropDraftExperimentApi = {
  addLiquidToAnalyticalBalanceTool: (payload: AddLiquidToAnalyticalBalanceToolPayload) => void;
  addLiquidToWorkbenchTool: (payload: AddLiquidToWorkbenchToolPayload) => void;
  addLiquidToWorkspaceWidget: (payload: AddLiquidToWorkspaceWidgetPayload) => void;
  createDebugProduceLotOnWorkbench: (payload: CreateDebugProduceLotOnWorkbenchPayload) => void;
  createDebugProduceLotToWidget: (payload: CreateDebugProduceLotToWidgetPayload) => void;
};

type DropDraftApi = {
  pendingDropDraft: DropDraft | null;
  setPendingDropDraft: Dispatch<SetStateAction<DropDraft | null>>;
  handleUpdateDropDraftField: (fieldId: string, value: number) => void;
  handleConfirmDropDraft: () => void;
};

export function useDropDraft(experimentApi: DropDraftExperimentApi): DropDraftApi {
  const [pendingDropDraft, setPendingDropDraft] = useState<DropDraft | null>(null);

  const handleUpdateDropDraftField = (fieldId: string, value: number) => {
    setPendingDropDraft((current) =>
      current
        ? {
            ...current,
            fields: current.fields.map((field) =>
              field.id === fieldId
                ? { ...field, value: Math.max(value, field.minValue ?? 0) }
                : field,
            ),
          }
        : current,
    );
  };

  const handleConfirmDropDraft = () => {
    if (!pendingDropDraft) {
      return;
    }

    // Draft confirmations always submit a concrete numeric value, defaulting to 0
    // when a field is absent so the payload shape stays explicit.
    const getNumericFieldValue = (fieldId: string) =>
      pendingDropDraft.fields.find((field) => field.id === fieldId)?.value ?? 0;

    if (pendingDropDraft.commandType === "add_liquid_to_analytical_balance_tool") {
      void experimentApi.addLiquidToAnalyticalBalanceTool({
        liquid_id: pendingDropDraft.itemId ?? "",
        volume_ml: getNumericFieldValue("volume_ml"),
      });
      setPendingDropDraft(null);
      return;
    }

    if (pendingDropDraft.commandType === "add_liquid_to_workspace_widget") {
      void experimentApi.addLiquidToWorkspaceWidget({
        widget_id: pendingDropDraft.targetId,
        liquid_id: pendingDropDraft.itemId ?? "dry_ice_pellets",
        volume_ml: getNumericFieldValue("volume_ml"),
      });
      setPendingDropDraft(null);
      return;
    }

    if (pendingDropDraft.commandType === "add_liquid_to_workbench_tool") {
      void experimentApi.addLiquidToWorkbenchTool({
        slot_id: pendingDropDraft.targetId,
        liquid_id: pendingDropDraft.itemId ?? "",
        volume_ml: getNumericFieldValue("volume_ml"),
      });
      setPendingDropDraft(null);
      return;
    }

    if (
      pendingDropDraft.commandType === "create_debug_produce_lot_to_widget" &&
      pendingDropDraft.presetId
    ) {
      void experimentApi.createDebugProduceLotToWidget({
        preset_id: pendingDropDraft.presetId,
        residual_co2_mass_g: getNumericFieldValue("residual_co2_mass_g"),
        temperature_c: getNumericFieldValue("temperature_c"),
        total_mass_g: getNumericFieldValue("total_mass_g"),
        widget_id: pendingDropDraft.targetId,
      });
      setPendingDropDraft(null);
      return;
    }

    if (
      pendingDropDraft.commandType === "create_debug_produce_lot_on_workbench" &&
      pendingDropDraft.presetId
    ) {
      void experimentApi.createDebugProduceLotOnWorkbench({
        preset_id: pendingDropDraft.presetId,
        residual_co2_mass_g: getNumericFieldValue("residual_co2_mass_g"),
        target_slot_id: pendingDropDraft.targetId,
        temperature_c: getNumericFieldValue("temperature_c"),
        total_mass_g: getNumericFieldValue("total_mass_g"),
      });
      setPendingDropDraft(null);
    }
  };

  return {
    pendingDropDraft,
    setPendingDropDraft,
    handleUpdateDropDraftField,
    handleConfirmDropDraft,
  };
}
