import type { DebugProducePreset } from "@/components/debug-produce-palette";
import type { DropDraftField } from "@/components/drop-draft-card";
import type { WidgetLayout } from "@/hooks/use-workspace-layout";
import type {
  BenchToolInstance,
  DropTargetType,
  ExperimentProduceLot,
  ExperimentWorkspaceWidgetId,
  ToolCatalogItem,
  ToolType,
} from "@/types/workbench";

export const labSceneWidgetIds = [
  "lims",
  "workbench",
  "trash",
  "rack",
  "instrument",
  "basket",
  "grinder",
  "gross_balance",
  "analytical_balance",
  "vortex",
] as const satisfies readonly ExperimentWorkspaceWidgetId[];

export type LabSceneWidgetId = (typeof labSceneWidgetIds)[number];

export const labSceneWidgetStorability: Record<LabSceneWidgetId, boolean> = {
  lims: true,
  workbench: false,
  trash: false,
  rack: true,
  instrument: true,
  grinder: true,
  basket: false,
  gross_balance: true,
  analytical_balance: true,
  vortex: true,
};

export const labSceneWidgetFrameSpecs: Record<LabSceneWidgetId, WidgetLayout> = {
  lims: { x: 24, y: 886, width: 500, fallbackHeight: 320 },
  workbench: { x: 24, y: 24, width: 1105, fallbackHeight: 860 },
  trash: { x: 1276, y: 24, width: 164, fallbackHeight: 214 },
  rack: { x: 234, y: 886, width: 500, fallbackHeight: 392 },
  instrument: { x: 812, y: 886, width: 650, fallbackHeight: 392 },
  basket: { x: 1276, y: 262, width: 198, fallbackHeight: 236 },
  grinder: { x: 980, y: 886, width: 430, fallbackHeight: 340 },
  gross_balance: { x: 364, y: 886, width: 300, fallbackHeight: 280 },
  analytical_balance: { x: 688, y: 886, width: 300, fallbackHeight: 308 },
  vortex: { x: 1444, y: 886, width: 280, fallbackHeight: 280 },
};

export const rackSlotCount = 12;

const debugProduceAllowedDropTargets: DropTargetType[] = [
  "workbench_slot",
  "grinder_widget",
  "trash_bin",
  "gross_balance_widget",
];

export const debugProducePresets: DebugProducePreset[] = [
  {
    id: "apple_powder_residual_co2",
    produceLot: {
      id: "debug_preview_apple_powder_residual_co2",
      label: "Apple powder lot",
      produceType: "apple",
      totalMassG: 2450,
      unitCount: null,
      materialState: "ground",
      residualCo2MassG: 18,
      temperatureC: -62,
      grindQualityLabel: "powder_fine",
      homogeneityScore: 0.96,
      isDraggable: true,
      allowedDropTargets: debugProduceAllowedDropTargets,
    },
  },
];

export const debugSlurryTubePreset: ToolCatalogItem = {
  id: "apple_slurry_centrifuge_tube",
  name: "Apple slurry tube",
  subtitle: "50 mL centrifuge tube",
  description: "Debug tube prefilled with apple slurry.",
  accent: "rose",
  itemType: "tool",
  toolType: "centrifuge_tube",
  capacity_ml: 50,
  allowedDropTargets: [
    "workbench_slot",
    "trash_bin",
    "gross_balance_widget",
    "analytical_balance_widget",
    "vortex_widget",
  ],
};

export const knifeCursor =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 24 24' fill='none'%3E%3Cg transform='rotate(-142 12 12)'%3E%3Crect x='4.1' y='9.9' width='8.6' height='4.2' rx='1.2' fill='%230f172a'/%3E%3Crect x='4.1' y='9.9' width='8.6' height='4.2' rx='1.2' stroke='%230f172a' stroke-width='1.15'/%3E%3Cpath d='M12.7 9.9H15.9L19.8 12L15.9 14.1H12.7V9.9Z' fill='%23e2e8f0' stroke='%230f172a' stroke-width='1.15' stroke-linejoin='round'/%3E%3C/g%3E%3C/svg%3E\") 22 8, auto";
export const spatulaCursor = "crosshair";

const rackIllustrationViewBox = { height: 290, width: 480 };
const rackIllustrationBase = { x: 142, y: 91 };
const rackIllustrationGap = { x: 61, y: 49 };
const rackIllustrationColumns = Math.min(4, Math.max(rackSlotCount, 1));

const toolTareMassByType: Record<ToolType, number> = {
  volumetric_flask: 140,
  amber_bottle: 95,
  sample_vial: 1.5,
  beaker: 68,
  centrifuge_tube: 12,
  cutting_board: 320,
  sample_bag: 36,
  storage_jar: 180,
};

export function roundMass(massG: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(massG * factor) / factor;
}

export function getRackIllustrationSlotPosition(slotIndex: number) {
  const column = slotIndex % rackIllustrationColumns;
  const row = Math.floor(slotIndex / rackIllustrationColumns);

  return {
    left: `${(rackIllustrationBase.x + column * rackIllustrationGap.x) / rackIllustrationViewBox.width * 100}%`,
    top: `${(rackIllustrationBase.y + row * rackIllustrationGap.y) / rackIllustrationViewBox.height * 100}%`,
  };
}

export function formatProduceLotMetadata(produceLot: ExperimentProduceLot) {
  return produceLot.unitCount === null
    ? ""
    : `${produceLot.unitCount} unit${produceLot.unitCount === 1 ? "" : "s"}`;
}

export function getApproximateToolMassG(tool: BenchToolInstance, decimals = 1) {
  const tareMassG = toolTareMassByType[tool.toolType] ?? 0;
  const canonicalMassG = (tool.produceFractions ?? []).reduce((sum, fraction) => sum + fraction.massG, 0);
  const produceMassG =
    canonicalMassG > 0 ? canonicalMassG : (tool.produceLots ?? []).reduce((sum, lot) => sum + lot.totalMassG, 0);
  const liquidMassG = tool.liquids.reduce((sum, liquid) => sum + liquid.volume_ml, 0);
  return roundMass(Math.max(tareMassG + produceMassG + liquidMassG, 0), decimals);
}

export function buildDebugProduceDraftFields(): DropDraftField[] {
  return [
    {
      ariaLabel: "Debug powder mass",
      id: "total_mass_g",
      inputStep: 10,
      label: "Mass",
      minValue: 1,
      stepAmount: 50,
      unitLabel: "g",
      value: 2450,
      wheelStep: 50,
    },
    {
      ariaLabel: "Debug powder temperature",
      id: "temperature_c",
      inputStep: 1,
      label: "Temperature",
      minValue: -120,
      stepAmount: 5,
      unitLabel: "C",
      value: -62,
      visual: "temperature",
      wheelStep: 5,
    },
    {
      ariaLabel: "Debug powder residual CO2",
      id: "residual_co2_mass_g",
      inputStep: 0.1,
      label: "Residual CO2",
      stepAmount: 1,
      unitLabel: "g",
      value: 18,
      wheelStep: 1,
    },
  ];
}

export function buildDebugSlurryTubeDraftFields(): DropDraftField[] {
  return [
    {
      ariaLabel: "Debug slurry apple mass",
      id: "produce_mass_g",
      inputStep: 0.1,
      label: "Apple mass",
      minValue: 0.1,
      stepAmount: 1,
      unitLabel: "g",
      value: 10,
      wheelStep: 1,
    },
    {
      ariaLabel: "Debug slurry liquid volume",
      id: "liquid_volume_ml",
      inputStep: 0.1,
      label: "Liquid volume",
      minValue: 0,
      stepAmount: 1,
      unitLabel: "mL",
      value: 10,
      wheelStep: 1,
    },
    {
      ariaLabel: "Debug slurry temperature",
      id: "temperature_c",
      inputStep: 1,
      label: "Temperature",
      minValue: -120,
      stepAmount: 5,
      unitLabel: "C",
      value: 20,
      visual: "temperature",
      wheelStep: 5,
    },
  ];
}
