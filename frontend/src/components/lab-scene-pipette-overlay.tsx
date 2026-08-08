"use client";

import { useEffect, useRef } from "react";

import { PipetteIcon } from "@/components/pipette-icon";
import { getLastPointerPosition, trackPointerPosition } from "@/lib/pointer-position";
import type { PipetteState } from "@/types/workbench";

export function PipetteOverlay({ hint, isPipetteMode, pipette }: {
  hint: string | null;
  isPipetteMode: boolean;
  pipette: PipetteState;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    trackPointerPosition();
  }, []);

  useEffect(() => {
    if (!isPipetteMode) return;

    const place = (x: number, y: number) => {
      if (!overlayRef.current) return;
      overlayRef.current.style.opacity = "1";
      overlayRef.current.style.transform = `translate3d(${x + 8}px, ${y - 40}px, 0)`;
    };

    // Picked from the keyboard, no pointer event will arrive until the mouse
    // moves, so start from wherever the cursor already is.
    const seed = getLastPointerPosition();
    if (seed) place(seed.x, seed.y);

    let frameId: number | null = null;
    let nextX = 0;
    let nextY = 0;
    const move = (event: PointerEvent) => {
      nextX = event.clientX;
      nextY = event.clientY;
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        place(nextX, nextY);
      });
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, [isPipetteMode]);

  if (!isPipetteMode) return null;
  const fillRatio = pipette.capacityMl > 0 ? pipette.volumeMl / pipette.capacityMl : 0;
  return (
    <div
      aria-label={hint ?? (pipette.volumeMl > 0 ? "Pipette loaded" : "Pipette empty")}
      className="pointer-events-none fixed left-0 top-0 z-[100] w-20 opacity-0 will-change-transform"
      ref={overlayRef}
    >
      {/* Not `active`: the cursor pipette is the tool itself, drawn in the same
          neutral grey as the spatula overlay. Only the loaded liquid is blue. */}
      <PipetteIcon fillRatio={fillRatio} className="h-20 w-20 drop-shadow-[0_4px_4px_rgba(15,23,42,0.28)]" />
      <div className="mt-1 w-44 rounded-lg border border-slate-200 bg-white/95 px-2 py-1 shadow-lg backdrop-blur">
        <p className="text-[11px] font-semibold text-slate-700">{pipette.volumeMl.toFixed(2)} / {pipette.capacityMl.toFixed(2)} mL</p>
        {hint ? <p className="mt-0.5 text-[10px] leading-tight text-slate-500">{hint}</p> : null}
      </div>
    </div>
  );
}
