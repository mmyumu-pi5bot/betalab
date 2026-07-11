"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { useSpatulaInteraction } from "@/hooks/use-spatula-interaction";
import { usePipetteInteraction } from "@/hooks/use-pipette-interaction";
import { knifeCursor, spatulaCursor } from "@/lib/lab-scene-config";
import type { BenchToolInstance, PipetteState, SpatulaState } from "@/types/workbench";

export type ActionModeExperimentApi = {
  discardSpatula: () => void;
  loadSpatulaFromWorkbenchTool: (payload: { slot_id: string }) => void;
  loadSpatulaFromAnalyticalBalanceTool: () => void;
  pourSpatulaIntoWorkbenchTool: (payload: { delta_mass_g: number; slot_id: string }) => void;
  pourSpatulaIntoAnalyticalBalanceTool: (payload: { delta_mass_g: number }) => void;
  aspiratePipette: (payload: { tool_id: string; delta_volume_ml: number }) => void;
  dispensePipette: (payload: { tool_id: string; delta_volume_ml: number }) => void;
};

type UseActionModeOptions = {
  clearDropTargets: () => void;
  experimentApi: ActionModeExperimentApi;
  spatula: SpatulaState;
  pipette: PipetteState;
};

export function useActionMode({ clearDropTargets, experimentApi, pipette, spatula }: UseActionModeOptions) {
  const [activeActionId, setActiveActionId] = useState<string | null>(null);

  const isKnifeMode = activeActionId === "knife";
  const isSpatulaMode = activeActionId === "spatula";
  const isPipetteMode = activeActionId === "pipette";
  const dndDisabledByAction = isKnifeMode || isSpatulaMode || isPipetteMode;
  const workspaceCursor = isKnifeMode ? knifeCursor : isSpatulaMode ? spatulaCursor : isPipetteMode ? "crosshair" : undefined;

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
  const onAspiratePipette = useCallback((payload: { tool_id: string; delta_volume_ml: number }) => {
    void experimentApiRef.current.aspiratePipette(payload);
  }, []);
  const onDispensePipette = useCallback((payload: { tool_id: string; delta_volume_ml: number }) => {
    void experimentApiRef.current.dispensePipette(payload);
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
      if (actionKey !== "k" && actionKey !== "s" && actionKey !== "p") {
        return;
      }
      event.preventDefault();
      clearDropTargets();
      setActiveActionId((current) =>
        current === (actionKey === "k" ? "knife" : actionKey === "s" ? "spatula" : "pipette")
          ? null
          : actionKey === "k"
            ? "knife"
            : actionKey === "s"
              ? "spatula"
              : "pipette",
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
  const pipetteInteraction = usePipetteInteraction({
    isPipetteMode,
    onAspirate: onAspiratePipette,
    onDispense: onDispensePipette,
    pipette,
  });

  const handleToolPointerDown = useCallback((slotId: string, tool: BenchToolInstance, event: ReactPointerEvent<HTMLElement>) => {
    if (isPipetteMode) pipetteInteraction.handlePipetteToolPointerDown(slotId, tool, event);
    else spatulaInteraction.handleSpatulaToolPointerDown(slotId, tool, event);
  }, [isPipetteMode, pipetteInteraction, spatulaInteraction]);

  return {
    activeActionId,
    setActiveActionId,
    dndDisabledByAction,
    isKnifeMode,
    isSpatulaMode,
    isPipetteMode,
    workspaceCursor,
    ...spatulaInteraction,
    ...pipetteInteraction,
    handleSpatulaToolPointerDown: handleToolPointerDown,
  };
}
