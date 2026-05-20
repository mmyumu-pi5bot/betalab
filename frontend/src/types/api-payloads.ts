// Typed payloads for every mutation in api.ts.
// Use these at call sites to get compile-time field validation instead of Record<string, unknown>.

// ── Workbench slots / tools ──────────────────────────────────────────────────

export type AddLiquidToWorkbenchToolPayload = {
  slot_id: string;
  liquid_id: string;
  volume_ml: number;
};

export type AddLiquidToAnalyticalBalanceToolPayload = {
  liquid_id: string;
  volume_ml: number;
};

export type AddProduceLotToWorkbenchToolPayload = {
  slot_id: string;
  produce_lot_id: string;
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

export type DiscardProduceLotFromWorkbenchToolPayload = {
  produce_lot_id: string;
  slot_id: string;
};

export type DiscardSampleLabelFromWorkbenchToolPayload = {
  slot_id: string;
  label_id?: string;
};

export type DiscardToolFromPalettePayload = { tool_id: string };

export type DiscardWorkbenchToolPayload = { slot_id: string };

export type StoreWorkbenchToolPayload = { slot_id: string };

export type LoadSpatulaFromWorkbenchToolPayload = { slot_id: string };

export type MoveSampleLabelBetweenWorkbenchToolsPayload = {
  source_slot_id: string;
  label_id: string;
  target_slot_id: string;
};

export type MoveProduceLotBetweenWorkbenchToolsPayload = {
  produce_lot_id: string;
  source_slot_id: string;
  target_slot_id: string;
};

export type MoveToolBetweenWorkbenchSlotsPayload = {
  source_slot_id: string;
  target_slot_id: string;
};

export type MoveToolPayload = {
  source_kind: string;
  source_id: string;
  destination_kind: string;
  destination_id: string;
};

export type PlaceToolFromPalettePayload = {
  tool_id: string;
  destination_kind: string;
  destination_id: string;
};

export type MoveWidgetProduceLotToWorkbenchToolPayload = {
  widget_id: string;
  produce_lot_id: string;
  target_slot_id: string;
};

export type OpenWorkbenchToolPayload = { slot_id: string };

export type PlaceReceivedBagOnWorkbenchPayload = { target_slot_id: string; tool_id: string };
export type BasketToolReferencePayload = { tool_id: string };

export type PlaceToolOnWorkbenchPayload = { slot_id: string; tool_id: string };

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

export type RestoreTrashedProduceLotToWorkbenchToolPayload = {
  trash_produce_lot_id: string;
  target_slot_id: string;
};

export type RestoreTrashedSampleLabelToWorkbenchToolPayload = {
  trash_sample_label_id: string;
  target_slot_id: string;
};

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

export type AddWorkspaceProduceLotToWidgetPayload = {
  widget_id: string;
  produce_lot_id: string;
};

export type AddWorkspaceWidgetPayload = {
  widget_id: string;
  anchor: string;
  offset_x: number;
  offset_y: number;
};

export type CompleteGrinderCyclePayload = { widget_id: string };

export type DiscardWidgetProduceLotPayload = {
  widget_id: string;
  produce_lot_id: string;
};

export type DiscardWorkspaceProduceLotPayload = { produce_lot_id: string };

export type StoreWorkspaceWidgetPayload = { widget_id: string };

export type MoveGrossBalanceProduceLotToWidgetPayload = {
  produce_lot_id: string;
};

export type MoveWidgetProduceLotToGrossBalancePayload = {
  produce_lot_id: string;
};

export type MoveWorkbenchProduceLotToWidgetPayload = {
  widget_id: string;
  source_slot_id: string;
  produce_lot_id: string;
};

export type MoveWorkspaceProduceLotToGrossBalancePayload = {
  produce_lot_id: string;
};

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

export type RestoreTrashedProduceLotToWidgetPayload = {
  trash_produce_lot_id: string;
  widget_id: string;
};

export type StartGrinderCyclePayload = { widget_id: string };

// ── Produce ──────────────────────────────────────────────────────────────────

export type CreateProduceLotPayload = { produce_type: string };

// ── Gross balance ────────────────────────────────────────────────────────────

export type DiscardGrossBalanceProduceLotPayload = { produce_lot_id: string };

export type MoveGrossBalanceProduceLotToWorkbenchPayload = {
  target_slot_id: string;
  produce_lot_id: string;
};

export type MoveGrossBalanceToolToRackPayload = { rack_slot_id: string };

export type MoveGrossBalanceToolToWorkbenchPayload = {
  target_slot_id: string;
};

export type MoveWorkbenchSampleLabelToGrossBalancePayload = {
  source_slot_id: string;
  label_id: string;
};

export type MoveRackToolToGrossBalancePayload = { rack_slot_id: string };

export type MoveWorkbenchProduceLotToGrossBalancePayload = {
  source_slot_id: string;
  produce_lot_id: string;
};

export type MoveWorkbenchToolToGrossBalancePayload = {
  source_slot_id: string;
};

export type PlaceToolOnGrossBalancePayload = { tool_id: string };

export type RecordGrossWeightPayload = { measured_gross_mass_g?: number };

export type RestoreTrashedProduceLotToGrossBalancePayload = {
  trash_produce_lot_id: string;
};

export type RestoreTrashedSampleLabelToGrossBalancePayload = {
  trash_sample_label_id: string;
};

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

export type MoveWorkbenchSampleLabelToAnalyticalBalancePayload = {
  source_slot_id: string;
  label_id: string;
};

export type RestoreTrashedSampleLabelToAnalyticalBalancePayload = {
  trash_sample_label_id: string;
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
