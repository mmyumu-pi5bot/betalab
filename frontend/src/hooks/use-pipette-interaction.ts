"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import type { BenchToolInstance, PipetteState } from "@/types/workbench";

const HOLD_THRESHOLD_MS = 180;
const HOLD_INTERVAL_MS = 140;
const STEP_VOLUME_ML = 0.05;

type PipetteOperation = "aspirate" | "dispense";

type HoldState = {
  deltaVolumeMl: number;
  operation: PipetteOperation;
  toolId: string;
};

type UsePipetteInteractionOptions = {
  isPipetteMode: boolean;
  onAspirate: (payload: { tool_id: string; delta_volume_ml: number }) => void | Promise<void>;
  onDispense: (payload: { tool_id: string; delta_volume_ml: number }) => void | Promise<void>;
  pipette: PipetteState;
};

export function usePipetteInteraction({
  isPipetteMode,
  onAspirate,
  onDispense,
  pipette,
}: UsePipetteInteractionOptions) {
  const [pipetteHintMessage, setPipetteHintMessage] = useState<string | null>(null);
  const [previewVolumeMl, setPreviewVolumeMl] = useState<number | null>(null);
  const holdStateRef = useRef<HoldState | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const callbacksRef = useRef({ onAspirate, onDispense });
  callbacksRef.current = { onAspirate, onDispense };

  const commitHold = useCallback(async (state: HoldState) => {
    const payload = { tool_id: state.toolId, delta_volume_ml: state.deltaVolumeMl };
    try {
      if (state.operation === "aspirate") await callbacksRef.current.onAspirate(payload);
      else await callbacksRef.current.onDispense(payload);
    } finally {
      setPreviewVolumeMl(null);
    }
  }, []);

  const stopPipetteHold = useCallback((commit = false) => {
    const state = holdStateRef.current;
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    timeoutRef.current = null;
    intervalRef.current = null;
    holdStateRef.current = null;
    if (commit && state) void commitHold(state);
    else setPreviewVolumeMl(null);
  }, [commitHold]);

  useEffect(() => {
    if (!isPipetteMode) {
      setPipetteHintMessage(null);
      stopPipetteHold();
      return;
    }
    setPipetteHintMessage(
      pipette.volumeMl > 0
        ? `Pipette loaded ${pipette.volumeMl.toFixed(2)} / ${pipette.capacityMl.toFixed(2)} mL · Hold over a container to dispense.`
        : "Pipette empty · Hold over a liquid to aspirate.",
    );
  }, [isPipetteMode, pipette.capacityMl, pipette.volumeMl, stopPipetteHold]);

  useEffect(() => {
    if (!isPipetteMode) return;
    const up = () => stopPipetteHold(true);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointerup", up);
      stopPipetteHold();
    };
  }, [isPipetteMode, stopPipetteHold]);

  const handlePipetteToolPointerDown = useCallback((
    _slotId: string,
    tool: BenchToolInstance,
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    // React/JSDOM and a few browser/drag combinations may expose an absent or
    // negative button for the primary pointer. Only reject explicit secondary
    // buttons; otherwise the interaction silently never starts.
    if (!isPipetteMode || event.button > 0) return;
    const toolIsOpen = !tool.isSealed;
    const toolContainsPipettableContent =
      tool.liquids.reduce((total, liquid) => total + liquid.volume_ml, 0) > 0
      || (tool.produceFractions ?? []).some((fraction) => fraction.massG > 0);
    const toolAcceptsLiquid = tool.canReceiveLiquids && tool.capacity_ml > 0;
    const operation: PipetteOperation | null = pipette.volumeMl > 0
      ? toolAcceptsLiquid && toolIsOpen ? "dispense" : null
      : toolContainsPipettableContent && toolIsOpen ? "aspirate" : null;
    if (!operation) {
      setPipetteHintMessage(
        pipette.volumeMl > 0
          ? "The pipette is loaded: choose an open container that can receive liquid."
          : "The pipette is empty: choose an open container containing liquid.",
      );
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    stopPipetteHold();
    holdStateRef.current = { deltaVolumeMl: STEP_VOLUME_ML, operation, toolId: tool.id };
    setPreviewVolumeMl(
      operation === "aspirate"
        ? Math.min(pipette.capacityMl, pipette.volumeMl + STEP_VOLUME_ML)
        : Math.max(0, pipette.volumeMl - STEP_VOLUME_ML),
    );
    setPipetteHintMessage(
      operation === "aspirate"
        ? "Aspirating… release at the desired volume."
        : "Dispensing… release at the desired volume.",
    );
    timeoutRef.current = window.setTimeout(() => {
      const state = holdStateRef.current;
      if (!state) return;
      intervalRef.current = window.setInterval(() => {
        const current = holdStateRef.current;
        if (!current) return;
        const maxDelta = current.operation === "aspirate"
          ? pipette.capacityMl - pipette.volumeMl
          : pipette.volumeMl;
        current.deltaVolumeMl = Math.min(
          maxDelta,
          Math.round((current.deltaVolumeMl + STEP_VOLUME_ML) * 1000) / 1000,
        );
        setPreviewVolumeMl(
          current.operation === "aspirate"
            ? pipette.volumeMl + current.deltaVolumeMl
            : pipette.volumeMl - current.deltaVolumeMl,
        );
      }, HOLD_INTERVAL_MS);
    }, HOLD_THRESHOLD_MS);
  }, [isPipetteMode, pipette.capacityMl, pipette.volumeMl, stopPipetteHold]);

  return {
    handlePipetteToolPointerDown,
    displayPipette: previewVolumeMl === null ? pipette : { ...pipette, volumeMl: previewVolumeMl },
    pipetteHintMessage,
    stopPipetteHold,
  };
}
