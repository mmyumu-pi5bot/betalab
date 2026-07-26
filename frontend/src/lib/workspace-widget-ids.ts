const workspaceEquipmentWidgetIds = [
  "lims",
  "rack",
  "instrument",
  "basket",
  "grinder",
  "gross_balance",
  "analytical_balance",
  "vortex",
  "centrifuge",
] as const;

export type WorkspaceEquipmentWidgetId = (typeof workspaceEquipmentWidgetIds)[number];

const workspaceEquipmentItemToWidgetId = {
  autosampler_rack_widget: "rack",
  lc_msms_instrument_widget: "instrument",
  cryogenic_grinder_widget: "grinder",
  produce_basket_widget: "basket",
  lims_terminal_widget: "lims",
  gross_balance_widget: "gross_balance",
  analytical_balance_widget: "analytical_balance",
  vortex_mixer_widget: "vortex",
  centrifuge_widget: "centrifuge",
} as const satisfies Record<string, WorkspaceEquipmentWidgetId>;

export function isWorkspaceEquipmentWidgetId(value: string): value is WorkspaceEquipmentWidgetId {
  return workspaceEquipmentWidgetIds.includes(value as WorkspaceEquipmentWidgetId);
}

export function getWorkspaceEquipmentWidgetId(itemId: string): WorkspaceEquipmentWidgetId | null {
  return (
    workspaceEquipmentItemToWidgetId[itemId as keyof typeof workspaceEquipmentItemToWidgetId] ?? null
  );
}
