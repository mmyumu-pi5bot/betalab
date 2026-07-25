"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getDebugInspection,
  type DebugInspectionKind,
} from "@/lib/api";

export type DebugInspectorState = {
  label: string;
  data: unknown;
  x: number;
  y: number;
} | null;

export function useDebugInspector(experimentId?: string) {
  const [inspection, setInspection] = useState<DebugInspectorState>(null);

  const clear = useCallback(() => setInspection(null), []);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!event.ctrlKey || !event.altKey) return;
      event.preventDefault();
      event.stopPropagation();

      const target = event.target as Element | null;
      const carrier = target?.closest(
        "[data-debug-kind], [data-debug-model]",
      ) as HTMLElement | null;
      if (!carrier) return;

      const label = carrier.dataset.debugLabel ?? "Object";
      const position = { x: event.clientX, y: event.clientY };
      const entityKind = carrier.dataset.debugKind as DebugInspectionKind | undefined;
      const entityId = carrier.dataset.debugId;
      if (experimentId && entityKind && entityId) {
        void getDebugInspection(experimentId, entityKind, entityId)
          .then((data) => {
            setInspection({ label, data, ...position });
          })
          .catch(() => {
            // Debug inspection is intentionally unavailable outside development.
          });
        return;
      }

      const raw = carrier.dataset.debugModel;
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as unknown;
        setInspection({ label, data: parsed, ...position });
      } catch {
        // malformed JSON — ignore
      }
    }

    document.addEventListener("click", handleClick, { capture: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, [experimentId]);

  return { inspection, clear };
}
