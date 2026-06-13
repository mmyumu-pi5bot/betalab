"use client";

import { useCallback, useEffect, useState } from "react";

export type DebugInspectorState = {
  label: string;
  data: unknown;
  x: number;
  y: number;
} | null;

export function useDebugInspector() {
  const [inspection, setInspection] = useState<DebugInspectorState>(null);

  const clear = useCallback(() => setInspection(null), []);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!event.ctrlKey || !event.altKey) return;
      event.preventDefault();
      event.stopPropagation();

      const target = event.target as Element | null;
      const carrier = target?.closest("[data-debug-model]") as HTMLElement | null;
      if (!carrier) return;

      const raw = carrier.dataset.debugModel;
      if (!raw) return;

      try {
        const parsed = JSON.parse(raw) as unknown;
        const label = carrier.dataset.debugLabel ?? "Object";
        setInspection({ label, data: parsed, x: event.clientX, y: event.clientY });
      } catch {
        // malformed JSON — ignore
      }
    }

    document.addEventListener("click", handleClick, { capture: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, []);

  return { inspection, clear };
}
