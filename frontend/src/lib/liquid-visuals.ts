import type { ToolbarAccent } from "@/types/workbench";

type LiquidVisualSource = {
  accent: ToolbarAccent;
  volume_ml: number;
};

type LiquidVisualPalette = {
  glow: string;
  liquid: string;
  stroke: string;
};

type LiquidVisualSegment = {
  accent: ToolbarAccent;
  color: string;
  ratio: number;
};

type ContainerLiquidVisualState = {
  hasVisibleLiquid: boolean;
  palette: LiquidVisualPalette;
  segments: LiquidVisualSegment[];
};

const liquidAccentPalette: Record<ToolbarAccent, LiquidVisualPalette> = {
  amber: {
    liquid: "#f59e0b",
    glow: "#fef3c7",
    stroke: "#92400e",
  },
  emerald: {
    liquid: "#10b981",
    glow: "#d1fae5",
    stroke: "#065f46",
  },
  rose: {
    liquid: "#fb7185",
    glow: "#ffe4e6",
    stroke: "#9f1239",
  },
  sky: {
    liquid: "#38bdf8",
    glow: "#e0f2fe",
    stroke: "#0c4a6e",
  },
  violet: {
    liquid: "#a78bfa",
    glow: "#ede9fe",
    stroke: "#4c1d95",
  },
};

export const neutralLiquidPalette: LiquidVisualPalette = {
  liquid: "#cbd5e1",
  glow: "#f8fafc",
  stroke: "#64748b",
};

export function getLiquidAccentPalette(accent: ToolbarAccent) {
  return liquidAccentPalette[accent];
}

export function getLiquidVisualSegments(liquids: LiquidVisualSource[]): LiquidVisualSegment[] {
  const validLiquids = liquids.filter((liquid) => Number.isFinite(liquid.volume_ml) && liquid.volume_ml > 0);
  const totalVolume = validLiquids.reduce((sum, liquid) => sum + liquid.volume_ml, 0);

  if (totalVolume <= 0) {
    return [];
  }

  return validLiquids.map((liquid) => ({
    accent: liquid.accent,
    color: liquidAccentPalette[liquid.accent].liquid,
    ratio: liquid.volume_ml / totalVolume,
  }));
}

function getDominantLiquidAccent(
  liquids: LiquidVisualSource[],
  fallbackAccent: ToolbarAccent,
) {
  const dominantLiquid = liquids.reduce<LiquidVisualSource | null>((current, liquid) => {
    if (liquid.volume_ml <= 0) {
      return current;
    }
    if (!current || liquid.volume_ml > current.volume_ml) {
      return liquid;
    }
    return current;
  }, null);

  return dominantLiquid?.accent ?? fallbackAccent;
}

export function getContainerLiquidVisualState(
  liquids: LiquidVisualSource[],
  fallbackAccent: ToolbarAccent,
): ContainerLiquidVisualState {
  const segments = getLiquidVisualSegments(liquids);

  if (segments.length === 0) {
    return {
      hasVisibleLiquid: false,
      palette: neutralLiquidPalette,
      segments,
    };
  }

  return {
    hasVisibleLiquid: true,
    palette: getLiquidAccentPalette(getDominantLiquidAccent(liquids, fallbackAccent)),
    segments,
  };
}

