import type { PipetteState } from "@/types/workbench";

export function PipetteOverlay({ cursorPosition, hint, isPipetteMode, pipette }: {
  cursorPosition: { x: number; y: number } | null;
  hint: string | null;
  isPipetteMode: boolean;
  pipette: PipetteState;
}) {
  if (!isPipetteMode || !cursorPosition) return null;
  const fill = Math.min(100, (pipette.volumeMl / pipette.capacityMl) * 100);
  return (
    <div className="pointer-events-none fixed z-[100] w-44 -translate-y-1/2 translate-x-4 rounded-xl border border-sky-200 bg-white/95 p-2 shadow-lg backdrop-blur" style={{ left: cursorPosition.x, top: cursorPosition.y }}>
      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
        <span>{pipette.volumeMl > 0 ? "Distribuer" : "Aspirer"}</span>
        <span>{pipette.volumeMl.toFixed(2)} mL</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-sky-500 transition-[width]" style={{ width: `${fill}%` }} />
      </div>
      {hint ? <p className="mt-1.5 text-[10px] leading-tight text-slate-500">{hint}</p> : null}
    </div>
  );
}
