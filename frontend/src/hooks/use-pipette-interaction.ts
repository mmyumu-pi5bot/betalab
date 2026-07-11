"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import type { BenchToolInstance, PipetteState } from "@/types/workbench";

const HOLD_THRESHOLD_MS = 180;
const HOLD_INTERVAL_MS = 140;
const STEP_VOLUME_ML = 0.05;

type PipetteOperation = "aspirate" | "dispense";

type HoldState = {
  operation: PipetteOperation;
  toolId: string;
  isHolding: boolean;
};

type UsePipetteInteractionOptions = {
  isPipetteMode: boolean;
  onAspirate: (payload: { tool_id: string; delta_volume_ml: number }) => void;
  onDispense: (payload: { tool_id: string; delta_volume_ml: number }) => void;
  pipette: PipetteState;
};

export function usePipetteInteraction({
  isPipetteMode,
  onAspirate,
  onDispense,
  pipette,
}: UsePipetteInteractionOptions) {
  const [pipetteCursorPosition, setPipetteCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const [pipetteHintMessage, setPipetteHintMessage] = useState<string | null>(null);
  const holdStateRef = useRef<HoldState | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  const runStep = useCallback((state: HoldState) => {
    const payload = { tool_id: state.toolId, delta_volume_ml: STEP_VOLUME_ML };
    if (state.operation === "aspirate") onAspirate(payload);
    else onDispense(payload);
  }, [onAspirate, onDispense]);

  const stopPipetteHold = useCallback((commitClick = false) => {
    const state = holdStateRef.current;
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    timeoutRef.current = null;
    intervalRef.current = null;
    holdStateRef.current = null;
    if (commitClick && state && !state.isHolding) runStep(state);
  }, [runStep]);

  useEffect(() => {
    if (!isPipetteMode) {
      setPipetteHintMessage(null);
      setPipetteCursorPosition(null);
      stopPipetteHold();
      return;
    }
    setPipetteHintMessage(
      pipette.volumeMl > 0
        ? `Pipette chargée ${pipette.volumeMl.toFixed(2)} / ${pipette.capacityMl.toFixed(2)} mL · Maintiens sur une vial pour distribuer.`
        : "Pipette vide · Maintiens sur l’extrait dans le tube pour aspirer.",
    );
  }, [isPipetteMode, pipette.capacityMl, pipette.volumeMl, stopPipetteHold]);

  useEffect(() => {
    if (!isPipetteMode) return;
    const move = (event: PointerEvent) => setPipetteCursorPosition({ x: event.clientX, y: event.clientY });
    const up = () => stopPipetteHold(true);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      stopPipetteHold();
    };
  }, [isPipetteMode, stopPipetteHold]);

  const handlePipetteToolPointerDown = useCallback((
    _slotId: string,
    tool: BenchToolInstance,
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    if (!isPipetteMode || event.button !== 0) return;
    const operation: PipetteOperation | null = pipette.volumeMl > 0
      ? tool.toolType === "sample_vial" ? "dispense" : null
      : tool.toolType === "centrifuge_tube" ? "aspirate" : null;
    if (!operation) {
      setPipetteHintMessage(
        pipette.volumeMl > 0
          ? "La pipette est chargée : choisis une vial ouverte pour distribuer."
          : "La pipette est vide : choisis un tube centrifuge contenant l’extrait.",
      );
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    stopPipetteHold();
    holdStateRef.current = { operation, toolId: tool.id, isHolding: false };
    setPipetteHintMessage(operation === "aspirate" ? "Aspiration… relâche au volume voulu." : "Distribution… relâche au volume voulu.");
    timeoutRef.current = window.setTimeout(() => {
      const state = holdStateRef.current;
      if (!state) return;
      state.isHolding = true;
      runStep(state);
      intervalRef.current = window.setInterval(() => {
        if (holdStateRef.current) runStep(holdStateRef.current);
      }, HOLD_INTERVAL_MS);
    }, HOLD_THRESHOLD_MS);
  }, [isPipetteMode, pipette.volumeMl, runStep, stopPipetteHold]);

  return {
    handlePipetteToolPointerDown,
    pipetteCursorPosition,
    pipetteHintMessage,
    stopPipetteHold,
  };
}
