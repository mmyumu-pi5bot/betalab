"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

import type { BenchToolInstance, SpatulaState } from "@/types/workbench";

const HOLD_THRESHOLD_MS = 200;
const CLICK_INCREMENT_MU_G = 0.05;
const CLICK_INCREMENT_SIGMA_G = 0.007;

function randomNormalIncrement(muG: number, sigmaG: number): number {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const value = muG + sigmaG * z;
  return Math.round(Math.max(0.01, Math.min(0.15, value)) * 1000) / 1000;
}

type PourState = {
  currentRateG: number;
  isHolding: boolean;
  slotId: string;
  startY: number;
};

type UseSpatulaInteractionOptions = {
  isSpatulaMode: boolean;
  onDiscardSpatula: () => void;
  onLoadFromTool: (payload: { slot_id: string }) => void;
  onLoadFromAnalyticalBalance: () => void;
  onPourIntoTool: (payload: { delta_mass_g: number; slot_id: string }) => void;
  onPourIntoAnalyticalBalanceTool: (payload: { delta_mass_g: number }) => void;
  spatula: SpatulaState;
};

export function useSpatulaInteraction({
  isSpatulaMode,
  onDiscardSpatula,
  onLoadFromTool,
  onLoadFromAnalyticalBalance,
  onPourIntoTool,
  onPourIntoAnalyticalBalanceTool,
  spatula,
}: UseSpatulaInteractionOptions) {
  const [spatulaCursorPosition, setSpatulaCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const [spatulaHintMessage, setSpatulaHintMessage] = useState<string | null>(null);
  const spatulaPourIntervalRef = useRef<number | null>(null);
  const spatulaPourHoldTimeoutRef = useRef<number | null>(null);
  const spatulaPourStateRef = useRef<PourState | null>(null);
  // Prevents the synthetic click generated right after a pour from reloading the spatula.
  const justPouredRef = useRef(false);
  const justPouredResetTimeoutRef = useRef<number | null>(null);
  const allowedLoadSourceToolTypes = useMemo(
    () =>
      spatula.allowedLoadSourceToolTypes ?? [
        "storage_jar",
        "centrifuge_tube",
        "beaker",
        "sample_bag",
      ],
    [spatula.allowedLoadSourceToolTypes],
  );
  const allowedPourTargetToolTypes = useMemo(
    () => spatula.allowedPourTargetToolTypes ?? ["sample_vial", "centrifuge_tube"],
    [spatula.allowedPourTargetToolTypes],
  );
  const clickIncrementMuG = spatula.clickIncrementMuG ?? CLICK_INCREMENT_MU_G;
  const clickIncrementSigmaG = spatula.clickIncrementSigmaG ?? CLICK_INCREMENT_SIGMA_G;
  const holdThresholdMs = spatula.holdThresholdMs ?? HOLD_THRESHOLD_MS;
  const holdIntervalMs = spatula.holdIntervalMs ?? 100;
  const holdInitialRateG = spatula.holdInitialRateG ?? 0.08;
  const holdMaxRateG = spatula.holdMaxRateG ?? 0.28;
  const holdLiftRateGPerPx = spatula.holdLiftRateGPerPx ?? 0.0022;
  const canDiscardSpatula = spatula.canDiscard ?? spatula.isLoaded;
  const canLoadFromTool = useCallback(
    (tool: BenchToolInstance) => allowedLoadSourceToolTypes.includes(tool.toolType),
    [allowedLoadSourceToolTypes],
  );
  const canPourIntoTool = useCallback(
    (tool: BenchToolInstance) => allowedPourTargetToolTypes.includes(tool.toolType),
    [allowedPourTargetToolTypes],
  );

  const stopSpatulaPour = useCallback(() => {
    if (spatulaPourHoldTimeoutRef.current !== null) {
      window.clearTimeout(spatulaPourHoldTimeoutRef.current);
      spatulaPourHoldTimeoutRef.current = null;
    }
    if (spatulaPourIntervalRef.current !== null) {
      window.clearInterval(spatulaPourIntervalRef.current);
      spatulaPourIntervalRef.current = null;
    }
    spatulaPourStateRef.current = null;
  }, []);

  const armJustPouredGuard = useCallback(() => {
    justPouredRef.current = true;
    if (justPouredResetTimeoutRef.current !== null) {
      window.clearTimeout(justPouredResetTimeoutRef.current);
    }
    justPouredResetTimeoutRef.current = window.setTimeout(() => {
      justPouredRef.current = false;
      justPouredResetTimeoutRef.current = null;
    }, 0);
  }, []);

  useEffect(() => {
    if (!isSpatulaMode) {
      setSpatulaHintMessage(null);
      return;
    }

    setSpatulaHintMessage(
      spatula.isLoaded
        ? "Clique pour verser un peu · Maintiens et lève pour verser vite."
        : "Clique sur un container ouvert avec de la poudre pour charger la spatule.",
    );
  }, [isSpatulaMode, spatula.isLoaded]);

  // Use refs so the pointermove listener always reads the latest rate constants
  // without those values appearing in the effect dep array (which would cause
  // the listener to be torn down and re-added on every render that updates spatula).
  const holdLiftRateGPerPxRef = useRef(holdLiftRateGPerPx);
  holdLiftRateGPerPxRef.current = holdLiftRateGPerPx;
  const holdMaxRateGRef = useRef(holdMaxRateG);
  holdMaxRateGRef.current = holdMaxRateG;

  useEffect(() => {
    if (!isSpatulaMode) {
      setSpatulaCursorPosition(null);
      stopSpatulaPour();
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      setSpatulaCursorPosition({ x: event.clientX, y: event.clientY });
      const pourState = spatulaPourStateRef.current;
      if (!pourState) {
        return;
      }

      const liftPx = Math.max(pourState.startY - event.clientY, 0);
      pourState.currentRateG = Math.min(holdMaxRateGRef.current, 0.06 + liftPx * holdLiftRateGPerPxRef.current);
    };

    const handlePointerUp = () => {
      stopSpatulaPour();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      if (justPouredResetTimeoutRef.current !== null) {
        window.clearTimeout(justPouredResetTimeoutRef.current);
        justPouredResetTimeoutRef.current = null;
      }
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      stopSpatulaPour();
    };
  }, [isSpatulaMode, stopSpatulaPour]);

  const handleSpatulaToolPointerDown = useCallback(
    (slotId: string, tool: BenchToolInstance, event: ReactPointerEvent<HTMLElement>) => {
      if (!isSpatulaMode || event.button !== 0) {
        return;
      }

      if (!canPourIntoTool(tool)) {
        return;
      }

      if (!spatula.isLoaded) {
        setSpatulaHintMessage("La spatule est vide. Charge-la d'abord sur un container ouvert.");
        return;
      }

      event.preventDefault();
      stopSpatulaPour();
      setSpatulaHintMessage("Versement en cours...");
      spatulaPourStateRef.current = {
        currentRateG: holdInitialRateG,
        isHolding: false,
        slotId,
        startY: event.clientY,
      };
      spatulaPourHoldTimeoutRef.current = window.setTimeout(() => {
        if (spatulaPourStateRef.current) {
          spatulaPourStateRef.current.isHolding = true;
        }
        spatulaPourHoldTimeoutRef.current = null;
      }, holdThresholdMs);
      spatulaPourIntervalRef.current = window.setInterval(() => {
        const pourState = spatulaPourStateRef.current;
        if (!pourState || !pourState.isHolding) {
          return;
        }

        onPourIntoTool({
          slot_id: pourState.slotId,
          delta_mass_g: Number(pourState.currentRateG.toFixed(3)),
        });
      }, holdIntervalMs);
    },
    [
      canPourIntoTool,
      holdInitialRateG,
      holdIntervalMs,
      holdThresholdMs,
      isSpatulaMode,
      onPourIntoTool,
      spatula.isLoaded,
      stopSpatulaPour,
    ],
  );

  const handleSpatulaToolPointerUp = useCallback(() => {
    const pourState = spatulaPourStateRef.current;
    if (pourState) {
      armJustPouredGuard();
      if (!pourState.isHolding) {
        const delta = randomNormalIncrement(clickIncrementMuG, clickIncrementSigmaG);
        if (pourState.slotId === "analytical_balance") {
          onPourIntoAnalyticalBalanceTool({ delta_mass_g: delta });
        } else {
          onPourIntoTool({ slot_id: pourState.slotId, delta_mass_g: delta });
        }
      }
    }
    stopSpatulaPour();
  }, [
    armJustPouredGuard,
    clickIncrementMuG,
    clickIncrementSigmaG,
    onPourIntoAnalyticalBalanceTool,
    onPourIntoTool,
    stopSpatulaPour,
  ]);

  const loadSpatulaFromTool = useCallback(
    (slotId: string) => {
      stopSpatulaPour();
      setSpatulaHintMessage("Chargement de la spatule...");
      onLoadFromTool({ slot_id: slotId });
    },
    [onLoadFromTool, stopSpatulaPour],
  );

  const handleSpatulaToolIllustrationClick = useCallback(
    (slotId: string, tool: BenchToolInstance, event: ReactMouseEvent<HTMLButtonElement>) => {
      if (!isSpatulaMode || !canLoadFromTool(tool)) {
        return;
      }
      if (justPouredRef.current) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      loadSpatulaFromTool(slotId);
    },
    [canLoadFromTool, isSpatulaMode, loadSpatulaFromTool],
  );

  const handleSpatulaAnalyticalBalancePointerDown = useCallback(
    (tool: BenchToolInstance, event: ReactPointerEvent<HTMLElement>) => {
      if (!isSpatulaMode || event.button !== 0) {
        return;
      }

      if (!canPourIntoTool(tool)) {
        return;
      }

      const toolHasPowder = (tool.powderMassG ?? 0) > 0;

      if (!spatula.isLoaded) {
        if (toolHasPowder) {
          event.preventDefault();
          // No justPouredRef guard here: on the balance there is no onClick path
          // that could trigger a spurious reload, so every intentional click should load.
          onLoadFromAnalyticalBalance();
          setSpatulaHintMessage("Chargement de la spatule...");
        } else {
          setSpatulaHintMessage("La spatule est vide. Charge-la d'abord sur un container ouvert.");
        }
        return;
      }

      event.preventDefault();
      stopSpatulaPour();
      setSpatulaHintMessage("Versement en cours...");
      spatulaPourStateRef.current = {
        currentRateG: holdInitialRateG,
        isHolding: false,
        slotId: "analytical_balance",
        startY: event.clientY,
      };
      spatulaPourHoldTimeoutRef.current = window.setTimeout(() => {
        if (spatulaPourStateRef.current) {
          spatulaPourStateRef.current.isHolding = true;
        }
        spatulaPourHoldTimeoutRef.current = null;
      }, holdThresholdMs);
      spatulaPourIntervalRef.current = window.setInterval(() => {
        const pourState = spatulaPourStateRef.current;
        if (!pourState || !pourState.isHolding) {
          return;
        }

        onPourIntoAnalyticalBalanceTool({
          delta_mass_g: Number(pourState.currentRateG.toFixed(3)),
        });
      }, holdIntervalMs);
    },
    [
      canPourIntoTool,
      holdInitialRateG,
      holdIntervalMs,
      holdThresholdMs,
      isSpatulaMode,
      onLoadFromAnalyticalBalance,
      onPourIntoAnalyticalBalanceTool,
      spatula.isLoaded,
      stopSpatulaPour,
    ],
  );

  const handleSpatulaToolCardClick = useCallback(
    (slotId: string, tool: BenchToolInstance, event: ReactMouseEvent<HTMLElement>) => {
      if (!isSpatulaMode) {
        return;
      }

      const target = event.target;
      if (target instanceof HTMLElement && target.closest("button, input, textarea, select")) {
        return;
      }

      if (canLoadFromTool(tool) && !spatula.isLoaded) {
        if (justPouredRef.current) {
          event.preventDefault();
          return;
        }
        event.preventDefault();
        loadSpatulaFromTool(slotId);
        return;
      }
      justPouredRef.current = false;

      if (canPourIntoTool(tool) && !spatula.isLoaded) {
        setSpatulaHintMessage("La spatule est vide. Charge-la d'abord sur un container ouvert.");
      }
    },
    [canLoadFromTool, canPourIntoTool, isSpatulaMode, loadSpatulaFromTool, spatula.isLoaded],
  );

  const handleSpatulaTrashClick = useCallback(() => {
    if (!isSpatulaMode || !canDiscardSpatula) {
      return;
    }
    onDiscardSpatula();
  }, [canDiscardSpatula, isSpatulaMode, onDiscardSpatula]);

  return {
    handleSpatulaAnalyticalBalancePointerDown,
    handleSpatulaToolCardClick,
    handleSpatulaToolIllustrationClick,
    handleSpatulaToolPointerDown,
    handleSpatulaToolPointerUp,
    handleSpatulaTrashClick,
    spatulaCursorPosition,
    spatulaHintMessage,
    stopSpatulaPour,
  };
}
