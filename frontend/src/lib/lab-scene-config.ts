import type { CSSProperties } from "react";

import type { DebugProducePreset } from "@/components/debug-produce-palette";
import type { DropDraftField } from "@/components/drop-draft-card";
import type { WidgetLayout } from "@/hooks/use-workspace-layout";
import type {
  BenchToolInstance,
  DebugToolPresetId,
  DropTargetType,
  ExperimentProduceLot,
  ExperimentWorkspaceWidgetId,
  ToolbarAccent,
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
  "centrifuge",
  "ice_bath",
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
  centrifuge: true,
  ice_bath: true,
};

export const labSceneWidgetFrameSpecs: Record<LabSceneWidgetId, WidgetLayout> = {
  lims: { x: 24, y: 584, width: 440, fallbackHeight: 300 },
  workbench: { x: 24, y: 24, width: 980, fallbackHeight: 800 },
  trash: { x: 1276, y: 24, width: 164, fallbackHeight: 214 },
  rack: { x: 234, y: 886, width: 440, fallbackHeight: 360 },
  instrument: { x: 812, y: 886, width: 460, fallbackHeight: 360 },
  basket: { x: 1276, y: 262, width: 198, fallbackHeight: 236 },
  grinder: { x: 980, y: 886, width: 390, fallbackHeight: 315 },
  gross_balance: { x: 364, y: 886, width: 276, fallbackHeight: 260 },
  analytical_balance: { x: 688, y: 886, width: 276, fallbackHeight: 285 },
  vortex: { x: 1444, y: 886, width: 260, fallbackHeight: 260 },
  centrifuge: { x: 1740, y: 886, width: 292, fallbackHeight: 315 },
  ice_bath: { x: 2064, y: 886, width: 292, fallbackHeight: 300 },
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

export const debugVortexedSlurryTubePreset: ToolCatalogItem = {
  id: "vortexed_slurry_centrifuge_tube",
  name: "Vortexed slurry tube",
  subtitle: "50 mL centrifuge tube · ready to spin",
  description:
    "Debug tube with apple slurry already salted, sealed and vortexed — drop it straight into the centrifuge.",
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

export const debugSeparatedSlurryTubePreset: ToolCatalogItem = {
  id: "separated_slurry_centrifuge_tube",
  name: "Centrifuged slurry tube",
  subtitle: "50 mL centrifuge tube · ready to pipette",
  description:
    "Debug tube taken through the full QuEChERS prep and centrifuged — open, with a pipettable supernatant ready to transfer into a rack vial.",
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

export const debugCalibrationVialPreset: ToolCatalogItem = {
  id: "calibration_standard_vial",
  name: "Calibration point vial",
  subtitle: "Autosampler vial · 100 ng/mL standard",
  description:
    "Debug autosampler vial prepared as a multi-residue calibration standard — drop it straight into the rack.",
  accent: "rose",
  itemType: "tool",
  toolType: "sample_vial",
  capacity_ml: 2,
  allowedDropTargets: [
    "workbench_slot",
    "rack_slot",
    "trash_bin",
    "gross_balance_widget",
    "analytical_balance_widget",
  ],
};

export const debugCalibrationTubePreset: ToolCatalogItem = {
  id: "calibration_standard_tube",
  name: "Calibration stock tube",
  subtitle: "50 mL tube · 100 ng/mL standard",
  description:
    "Debug centrifuge tube filled with a multi-residue calibration standard — pipette it into a rack vial yourself; the pipette carries the calibration identity across.",
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

export const debugPreparedExtractVialPreset: ToolCatalogItem = {
  id: "apple_extract_vial",
  name: "Prepared apple vial",
  subtitle: "Autosampler vial · apple extract",
  description:
    "Debug autosampler vial holding a finished apple extract — the whole grind, extraction and pipetting chain skipped. Drop it straight into the rack and inject.",
  accent: "rose",
  itemType: "tool",
  toolType: "sample_vial",
  capacity_ml: 2,
  allowedDropTargets: [
    "workbench_slot",
    "rack_slot",
    "trash_bin",
    "gross_balance_widget",
    "analytical_balance_widget",
  ],
};

export const debugToolPresets: ToolCatalogItem[] = [
  debugSlurryTubePreset,
  debugVortexedSlurryTubePreset,
  debugSeparatedSlurryTubePreset,
  debugPreparedExtractVialPreset,
  debugCalibrationVialPreset,
  debugCalibrationTubePreset,
];

export const debugToolPresetsById: Record<string, ToolCatalogItem> = Object.fromEntries(
  debugToolPresets.map((preset) => [preset.id, preset]),
);

const debugSlurryPreviewLot: ExperimentProduceLot = {
  id: "debug_slurry_preview",
  label: "Apple slurry",
  produceType: "apple",
  totalMassG: 10,
  unitCount: null,
  materialState: "slurry",
  isDraggable: true,
  allowedDropTargets: [],
};

export type DebugToolPresetPreview = {
  accent: ToolbarAccent;
  containsSlurry: boolean;
  detailLabel: string;
  fillRatio: number;
  iconKind: ToolType;
  produceLots: ExperimentProduceLot[];
};

const debugCalibrationPresetIds = new Set<DebugToolPresetId>([
  "calibration_standard_vial",
  "calibration_standard_tube",
]);

// The debug palette renders each tool preset with a small preview of what it spawns.
// Slurry tubes show an apple-slurry fill; the calibration and prepared-extract presets
// show a clear liquid instead of produce, since both hold a solution only.
export function getDebugToolPresetPreview(preset: ToolCatalogItem): DebugToolPresetPreview {
  if (preset.id === debugPreparedExtractVialPreset.id) {
    return {
      accent: preset.accent,
      containsSlurry: false,
      detailLabel: "1 mL apple extract",
      fillRatio: 0.55,
      iconKind: preset.toolType,
      produceLots: [],
    };
  }
  if (debugCalibrationPresetIds.has(preset.id as DebugToolPresetId)) {
    return {
      accent: preset.accent,
      containsSlurry: false,
      detailLabel: "100 ng/mL calibration",
      fillRatio: 0.55,
      iconKind: preset.toolType,
      produceLots: [],
    };
  }
  return {
    accent: preset.accent,
    containsSlurry: true,
    detailLabel: "10 g apple slurry",
    fillRatio: 0.4,
    iconKind: preset.toolType,
    produceLots: [debugSlurryPreviewLot],
  };
}

export const knifeCursor =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 24 24' fill='none'%3E%3Cg transform='rotate(-142 12 12)'%3E%3Crect x='4.1' y='9.9' width='8.6' height='4.2' rx='1.2' fill='%230f172a'/%3E%3Crect x='4.1' y='9.9' width='8.6' height='4.2' rx='1.2' stroke='%230f172a' stroke-width='1.15'/%3E%3Cpath d='M12.7 9.9H15.9L19.8 12L15.9 14.1H12.7V9.9Z' fill='%23e2e8f0' stroke='%230f172a' stroke-width='1.15' stroke-linejoin='round'/%3E%3C/g%3E%3C/svg%3E\") 22 8, auto";
export const spatulaCursor = "crosshair";

const rackIllustrationViewBox = { height: 290, width: 480 };
const rackIllustrationBase = { x: 142, y: 91 };
const rackIllustrationGap = { x: 61, y: 49 };
const rackIllustrationColumns = Math.min(4, Math.max(rackSlotCount, 1));
const rackIllustrationRows = Math.ceil(rackSlotCount / rackIllustrationColumns);
/** The rack plate drawn by the illustration, in view-box units offset to the box origin. */
const rackIllustrationPlate = { height: 188, width: 328, x: 76, y: 48 };
/**
 * Half a slot drop zone (36 px in RackWidget) plus a gap. The bands used to grab the
 * rack stop this far short of the slots, so grabbing the rack never competes with the
 * vials dropped into it.
 */
const rackIllustrationSlotClearancePx = 22;

function rackIllustrationWidthPercent(viewBoxX: number) {
  return (viewBoxX / rackIllustrationViewBox.width) * 100;
}

function rackIllustrationHeightPercent(viewBoxY: number) {
  return (viewBoxY / rackIllustrationViewBox.height) * 100;
}

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
    left: `${rackIllustrationWidthPercent(rackIllustrationBase.x + column * rackIllustrationGap.x)}%`,
    top: `${rackIllustrationHeightPercent(rackIllustrationBase.y + row * rackIllustrationGap.y)}%`,
  };
}

export type RackIllustrationGrabEdge = {
  id: "top" | "bottom" | "left" | "right";
  style: CSSProperties;
};

/**
 * The four bands hugging the rack contours, by which the whole rack is dragged.
 * They run along the edges of the illustration and stop before the slot grid, so
 * every band is free of the slot drop zones at any widget width.
 */
export function getRackIllustrationGrabEdges(): RackIllustrationGrabEdge[] {
  const clearance = `${rackIllustrationSlotClearancePx}px`;
  const firstColumn = rackIllustrationWidthPercent(rackIllustrationBase.x);
  const lastColumn = rackIllustrationWidthPercent(
    rackIllustrationBase.x + (rackIllustrationColumns - 1) * rackIllustrationGap.x,
  );
  const firstRow = rackIllustrationHeightPercent(rackIllustrationBase.y);
  const lastRow = rackIllustrationHeightPercent(
    rackIllustrationBase.y + (rackIllustrationRows - 1) * rackIllustrationGap.y,
  );

  return [
    { id: "top", style: { height: `calc(${firstRow}% - ${clearance})`, left: 0, right: 0, top: 0 } },
    { id: "bottom", style: { bottom: 0, left: 0, right: 0, top: `calc(${lastRow}% + ${clearance})` } },
    { id: "left", style: { bottom: 0, left: 0, top: 0, width: `calc(${firstColumn}% - ${clearance})` } },
    { id: "right", style: { bottom: 0, left: `calc(${lastColumn}% + ${clearance})`, right: 0, top: 0 } },
  ];
}

/** The rack plate itself, used to outline what the grab bands are about to pick up. */
export function getRackIllustrationPlateOutline(): CSSProperties {
  return {
    height: `${rackIllustrationHeightPercent(rackIllustrationPlate.height)}%`,
    left: `${rackIllustrationWidthPercent(rackIllustrationPlate.x)}%`,
    top: `${rackIllustrationHeightPercent(rackIllustrationPlate.y)}%`,
    width: `${rackIllustrationWidthPercent(rackIllustrationPlate.width)}%`,
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

export function buildDebugCalibrationVialDraftFields(): DropDraftField[] {
  return [
    {
      ariaLabel: "Debug calibration level",
      id: "level_ng_per_ml",
      inputStep: 1,
      label: "Level",
      minValue: 1,
      stepAmount: 10,
      unitLabel: "ng/mL",
      value: 100,
      wheelStep: 10,
    },
  ];
}

// The prepared vial skips the bench, so the draft carries the preparation it pretends
// to come from: how much apple went into how much solvent, and how well the prep went.
// Recovery and sampling accuracy are the two factors a real prep draws at random —
// pinning them here is what makes a debug vial reproducible.
export function buildDebugPreparedExtractVialDraftFields(): DropDraftField[] {
  return [
    {
      ariaLabel: "Debug extract apple mass",
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
      ariaLabel: "Debug extract solvent volume",
      id: "extract_volume_ml",
      inputStep: 0.1,
      label: "Extract volume",
      minValue: 0.1,
      stepAmount: 1,
      unitLabel: "mL",
      value: 10,
      wheelStep: 1,
    },
    {
      ariaLabel: "Debug extraction recovery",
      id: "extraction_recovery_percent",
      inputStep: 1,
      label: "Recovery",
      minValue: 1,
      presets: [60, 80, 92, 100],
      stepAmount: 5,
      unitLabel: "%",
      value: 92,
      wheelStep: 5,
    },
    {
      ariaLabel: "Debug sampling accuracy",
      id: "sampling_accuracy_percent",
      inputStep: 1,
      label: "Sampling accuracy",
      minValue: 1,
      presets: [70, 85, 100],
      stepAmount: 5,
      unitLabel: "%",
      value: 100,
      wheelStep: 5,
    },
    {
      ariaLabel: "Debug extract ISTD volume",
      id: "istd_volume_ml",
      inputStep: 0.01,
      label: "ISTD volume",
      stepAmount: 0.05,
      unitLabel: "mL",
      value: 0.1,
      wheelStep: 0.05,
    },
  ];
}

export function buildDebugToolPresetDraftFields(presetId: DebugToolPresetId): DropDraftField[] {
  if (presetId === debugPreparedExtractVialPreset.id) {
    return buildDebugPreparedExtractVialDraftFields();
  }
  if (debugCalibrationPresetIds.has(presetId)) {
    return buildDebugCalibrationVialDraftFields();
  }
  return buildDebugSlurryTubeDraftFields();
}
