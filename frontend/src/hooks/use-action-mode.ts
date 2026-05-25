"use client";

import { useEffect, useState } from "react";

import { useSpatulaInteraction } from "@/hooks/use-spatula-interaction";
import { knifeCursor, spatulaCursor } from "@/lib/lab-scene-config";
import type { SpatulaState } from "@/types/workbench";

export type ActionModeExperimentApi = {
  discardSpatula: () => void;
  loadSpatulaFromWorkbenchTool: (payload: { slot_id: string }) => void;
  loadSpatulaFromAnalyticalBalanceTool: () => void;
  pourSpatulaIntoWorkbenchTool: (payload: { delta_mass_g: number; slot_id: string }) => void;
  pourSpatulaIntoAnalyticalBalanceTool: (payload: { delta_mass_g: number }) => void;
};

type UseActionModeOptions = {
  clearDropTargets: () => void;
  experimentApi: ActionModeExperimentApi;
  spatula: SpatulaState;
};

export function useActionMode({ clearDropTargets, experimentApi, spatula }: UseActionModeOptions) {
  const [activeActionId, setActiveActionId] = useState<string | null>(null);

  const isKnifeMode = activeActionId === "knife";
  const isSpatulaMode = activeActionId === "spatula";
  const dndDisabledByAction = isKnifeMode || isSpatulaMode;
  const workspaceCursor = isKnifeMode ? knifeCursor : isSpatulaMode ? spatulaCursor : undefined;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.closest("input, textarea, select, [contenteditable='true']") ||
          target.getAttribute("role") === "textbox")
      ) {
        return;
      }
      const actionKey = event.key.toLowerCase();
      if (actionKey !== "k" && actionKey !== "s") {
        return;
      }
      event.preventDefault();
      clearDropTargets();
      setActiveActionId((current) =>
        current === (actionKey === "k" ? "knife" : "spatula")
          ? null
          : actionKey === "k"
            ? "knife"
            : "spatula",
      );
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearDropTargets]);

  const spatulaInteraction = useSpatulaInteraction({
    isSpatulaMode,
    onDiscardSpatula: () => { void experimentApi.discardSpatula(); },
    onLoadFromTool: (payload) => { void experimentApi.loadSpatulaFromWorkbenchTool(payload); },
    onLoadFromAnalyticalBalance: () => { void experimentApi.loadSpatulaFromAnalyticalBalanceTool(); },
    onPourIntoTool: (payload) => { void experimentApi.pourSpatulaIntoWorkbenchTool(payload); },
    onPourIntoAnalyticalBalanceTool: (payload) => { void experimentApi.pourSpatulaIntoAnalyticalBalanceTool(payload); },
    spatula,
  });

  return {
    activeActionId,
    setActiveActionId,
    dndDisabledByAction,
    isKnifeMode,
    isSpatulaMode,
    workspaceCursor,
    ...spatulaInteraction,
  };
}
