"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

  // Keep a ref so stable callbacks always call the latest experimentApi without
  // being included in useCallback deps (which would recreate them every render).
  const experimentApiRef = useRef(experimentApi);
  experimentApiRef.current = experimentApi;

  const onDiscardSpatula = useCallback(() => {
    void experimentApiRef.current.discardSpatula();
  }, []);
  const onLoadFromTool = useCallback((payload: { slot_id: string }) => {
    void experimentApiRef.current.loadSpatulaFromWorkbenchTool(payload);
  }, []);
  const onLoadFromAnalyticalBalance = useCallback(() => {
    void experimentApiRef.current.loadSpatulaFromAnalyticalBalanceTool();
  }, []);
  const onPourIntoTool = useCallback((payload: { delta_mass_g: number; slot_id: string }) => {
    void experimentApiRef.current.pourSpatulaIntoWorkbenchTool(payload);
  }, []);
  const onPourIntoAnalyticalBalanceTool = useCallback((payload: { delta_mass_g: number }) => {
    void experimentApiRef.current.pourSpatulaIntoAnalyticalBalanceTool(payload);
  }, []);

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
    onDiscardSpatula,
    onLoadFromTool,
    onLoadFromAnalyticalBalance,
    onPourIntoTool,
    onPourIntoAnalyticalBalanceTool,
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
