// Typed payloads for every mutation in api.ts.
// Use these at call sites to get compile-time field validation instead of Record<string, unknown>.

// ── Workbench slots / tools ──────────────────────────────────────────────────

export type AddLiquidToWorkbenchToolPayload = {
  slot_id: string;
  liquid_id: string;
  volume_ml: number;
};

export type AddLiquidToToolPayload = {
  tool_id: string;
  liquid_id: string;
  volume_ml: number;
};

export type AddLiquidToAnalyticalBalanceToolPayload = {
  liquid_id: string;
  volume_ml: number;
};

export type ApplyPrintedLimsLabelPayload = { slot_id: string };
export type ApplyPrintedLimsLabelToAnalyticalBalanceToolPayload = Record<string, never>;
export type ApplySampleLabelToGrossBalanceToolPayload = Record<string, never>;

export type ApplySampleLabelToWorkbenchToolPayload = { slot_id: string };
export type ApplySampleLabelToAnalyticalBalanceToolPayload = Record<string, never>;

export type CloseWorkbenchToolPayload = { slot_id: string };

export type CutWorkbenchProduceLotPayload = {
  produce_lot_id: string;
  slot_id: string;
};

export type DiscardWorkbenchToolPayload = { slot_id: string };

export type StoreWorkbenchToolPayload = { slot_id: string };

export type LoadSpatulaFromWorkbenchToolPayload = { slot_id: string };

export type MoveObjectPayload = {
  entity: {
    kind: "tool" | "produce_lot" | "sample_label";
    id: string;
  };
  source: {
    kind:
      | "analytical_balance"
      | "basket"
      | "centrifuge"
      | "grinder"
      | "gross_balance"
      | "ice_bath"
      | "palette"
      | "rack"
      | "trash"
      | "vortex"
      | "workbench";
    id: string;
  };
  destination: {
    kind:
      | "analytical_balance"
      | "centrifuge"
      | "gross_balance"
      | "ice_bath"
      | "rack_slot"
      | "trash_bin"
      | "vortex"
      | "workbench_slot"
      | "workbench_tool"
      | "workspace_widget";
    id: string;
  };
};

/** Take a ready-to-use calibration point off the standards shelf, straight onto a target. */
export type PlaceCalibrationStandardVialPayload = {
  level_ng_per_ml: number;
  destination_kind: MoveObjectPayload["destination"]["kind"];
  destination_id: string;
};

export type OpenWorkbenchToolPayload = { slot_id: string };

export type PlaceReceivedBagOnWorkbenchPayload = { target_slot_id: string; tool_id: string };
export type BasketToolReferencePayload = { tool_id: string };

export type PourSpatulaIntoWorkbenchToolPayload = {
  slot_id: string;
  delta_mass_g: number;
};

export type PourSpatulaIntoAnalyticalBalanceToolPayload = {
  delta_mass_g: number;
};

export type RemoveLiquidFromWorkbenchToolPayload = {
  slot_id: string;
  liquid_entry_id: string;
};

export type RemoveWorkbenchSlotPayload = { slot_id: string };

export type RestoreTrashedToolToWorkbenchSlotPayload = {
  trash_tool_id: string;
  target_slot_id: string;
};

export type UpdateWorkbenchToolSampleLabelTextPayload = {
  slot_id: string;
  label_id?: string;
  sample_label_text: string;
};

// ── Workspace widgets ────────────────────────────────────────────────────────

export type AddLiquidToWorkspaceWidgetPayload = {
  widget_id: string;
  liquid_id: string;
  volume_ml: number;
};

export type AddWorkspaceWidgetPayload = {
  widget_id: string;
  anchor: string;
  offset_x: number;
  offset_y: number;
};

export type CompleteGrinderCyclePayload = { widget_id: string };

export type StoreWorkspaceWidgetPayload = { widget_id: string };

export type MoveWorkspaceWidgetPayload = {
  widget_id: string;
  anchor: string;
  offset_x: number;
  offset_y: number;
};

export type RemoveLiquidFromWorkspaceWidgetPayload = {
  widget_id: string;
  liquid_entry_id: string;
};

export type StartGrinderCyclePayload = { widget_id: string };

// ── Produce ──────────────────────────────────────────────────────────────────

export type CreateProduceLotPayload = { produce_type: string };

// ── Gross balance ────────────────────────────────────────────────────────────

export type MoveGrossBalanceToolToRackPayload = { rack_slot_id: string };

export type MoveGrossBalanceToolToWorkbenchPayload = {
  target_slot_id: string;
};

export type MoveRackToolToGrossBalancePayload = { rack_slot_id: string };

export type MoveWorkbenchToolToGrossBalancePayload = {
  source_slot_id: string;
};

export type PlaceToolOnGrossBalancePayload = { tool_id: string };

export type RecordGrossWeightPayload = { measured_gross_mass_g?: number };

export type RestoreTrashedToolToGrossBalancePayload = { trash_tool_id: string };

export type SetGrossBalanceContainerOffsetPayload = {
  gross_mass_offset_g: number;
};

// ── Analytical balance ───────────────────────────────────────────────────────

export type MoveAnalyticalBalanceToolToRackPayload = { rack_slot_id: string };

export type MoveAnalyticalBalanceToolToWorkbenchPayload = {
  target_slot_id: string;
};

export type MoveRackToolToAnalyticalBalancePayload = { rack_slot_id: string };

export type MoveWorkbenchToolToAnalyticalBalancePayload = {
  source_slot_id: string;
};

export type PlaceToolOnAnalyticalBalancePayload = { tool_id: string };

export type RestoreTrashedToolToAnalyticalBalancePayload = {
  trash_tool_id: string;
};

export type UpdateAnalyticalBalanceToolSampleLabelTextPayload = {
  label_id: string;
  sample_label_text: string;
};

// ── Rack ─────────────────────────────────────────────────────────────────────

export type DiscardRackToolPayload = { rack_slot_id: string };

export type MoveRackToolBetweenSlotsPayload = {
  source_rack_slot_id: string;
  target_rack_slot_id: string;
};

export type PlaceToolInRackSlotPayload = {
  rack_slot_id: string;
  tool_id: string;
};

export type PlaceWorkbenchToolInRackSlotPayload = {
  rack_slot_id: string;
  source_slot_id: string;
};

export type RemoveRackToolToWorkbenchSlotPayload = {
  rack_slot_id: string;
  target_slot_id: string;
};

export type RestoreTrashedToolToRackSlotPayload = {
  trash_tool_id: string;
  rack_slot_id: string;
};

// ── LC-MS/MS acquisition ────────────────────────────────────────────────────

export type AcquisitionSequenceLinePayload = {
  rack_slot_id: string;
  sample_name: string;
  injection_volume_ul: number;
  repetitions: number;
  output_filename: string;
};

export type RunSequencePayload = {
  /** Id of a method from the acquisition method catalog. */
  method_id: string;
  injections: AcquisitionSequenceLinePayload[];
};

// ── LIMS ─────────────────────────────────────────────────────────────────────

export type CreateLimsReceptionPayload = {
  entry_id?: string | null;
  orchard_name: string;
  harvest_date: string;
  indicative_mass_g: number;
  measured_gross_mass_g?: number | null;
  measured_sample_mass_g?: number | null;
};

export type PrintLimsLabelPayload = { entry_id?: string | null };

// ── Debug ────────────────────────────────────────────────────────────────────

export type CreateDebugProduceLotOnWorkbenchPayload = {
  preset_id: string;
  target_slot_id: string;
  total_mass_g?: number;
  temperature_c?: number;
  residual_co2_mass_g?: number;
};

export type CreateDebugProduceLotToWidgetPayload = {
  preset_id: string;
  widget_id: string;
  total_mass_g?: number;
  temperature_c?: number;
  residual_co2_mass_g?: number;
};

export type CreateDebugToolPresetPayload = {
  preset_id: string;
  destination_kind:
    | "analytical_balance"
    | "gross_balance"
    | "rack_slot"
    | "trash_bin"
    | "vortex"
    | "workbench_slot"
    | "workbench_tool";
  destination_id: string;
  produce_mass_g?: number;
  temperature_c?: number;
  level_ng_per_ml?: number;
  extract_volume_ml?: number;
  extraction_recovery_percent?: number;
  sampling_accuracy_percent?: number;
  istd_volume_ml?: number;
};

export type PlaceToolOnVortexPayload = {
  tool_id: string;
};

export type MoveWorkbenchToolToVortexPayload = {
  source_slot_id: string;
};

export type MoveRackToolToVortexPayload = {
  rack_slot_id: string;
};

export type RestoreTrashedToolToVortexPayload = {
  trash_tool_id: string;
};

export type MoveVortexToolToWorkbenchPayload = {
  target_slot_id: string;
};
