import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { DropDraftField } from "@/components/drop-draft-card";
import type {
  AddLiquidToAnalyticalBalanceToolPayload,
  AddLiquidToWorkbenchToolPayload,
  AddLiquidToWorkspaceWidgetPayload,
  CreateDebugProduceLotOnWorkbenchPayload,
  CreateDebugProduceLotToWidgetPayload,
  CreateDebugToolPresetPayload,
  PlaceCalibrationStandardVialPayload,
} from "@/types/api-payloads";

export type DropDraft = {
  commandType:
    | "add_liquid_to_analytical_balance_tool"
    | "add_liquid_to_workbench_tool"
    | "add_liquid_to_workspace_widget"
    | "create_debug_produce_lot_on_workbench"
    | "create_debug_produce_lot_to_widget"
    | "create_debug_tool_preset"
    | "place_calibration_standard_vial";
  confirmLabel?: string;
  fields: DropDraftField[];
  itemId?: string;
  presetId?: string;
  destinationKind?: CreateDebugToolPresetPayload["destination_kind"];
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
  createDebugToolPreset: (payload: CreateDebugToolPresetPayload) => void;
  placeCalibrationStandardVial: (payload: PlaceCalibrationStandardVialPayload) => void;
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

    if (
      pendingDropDraft.commandType === "place_calibration_standard_vial" &&
      pendingDropDraft.destinationKind
    ) {
      void experimentApi.placeCalibrationStandardVial({
        level_ng_per_ml: getNumericFieldValue("level_ng_per_ml"),
        destination_kind: pendingDropDraft.destinationKind,
        destination_id: pendingDropDraft.targetId,
      });
      setPendingDropDraft(null);
      return;
    }

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
      pendingDropDraft.commandType === "create_debug_tool_preset" &&
      pendingDropDraft.presetId &&
      pendingDropDraft.destinationKind
    ) {
      // Presets carry different draft fields (slurry tubes → mass/temperature, the
      // calibration vial → level, the prepared extract vial → its preparation
      // quality), so only forward the fields the draft actually holds.
      const hasField = (fieldId: string) =>
        pendingDropDraft.fields.some((field) => field.id === fieldId);
      const payload: CreateDebugToolPresetPayload = {
        preset_id: pendingDropDraft.presetId,
        destination_kind: pendingDropDraft.destinationKind,
        destination_id: pendingDropDraft.targetId,
      };
      if (hasField("produce_mass_g")) {
        payload.produce_mass_g = getNumericFieldValue("produce_mass_g");
      }
      if (hasField("temperature_c")) {
        payload.temperature_c = getNumericFieldValue("temperature_c");
      }
      if (hasField("level_ng_per_ml")) {
        payload.level_ng_per_ml = getNumericFieldValue("level_ng_per_ml");
      }
      if (hasField("extract_volume_ml")) {
        payload.extract_volume_ml = getNumericFieldValue("extract_volume_ml");
      }
      if (hasField("extraction_recovery_percent")) {
        payload.extraction_recovery_percent = getNumericFieldValue(
          "extraction_recovery_percent",
        );
      }
      if (hasField("sampling_accuracy_percent")) {
        payload.sampling_accuracy_percent = getNumericFieldValue("sampling_accuracy_percent");
      }
      if (hasField("istd_volume_ml")) {
        payload.istd_volume_ml = getNumericFieldValue("istd_volume_ml");
      }
      void experimentApi.createDebugToolPreset(payload);
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
