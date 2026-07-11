"use client";

import { dragAffordanceClassName } from "@/lib/drag-affordance";
import type { PipetteState } from "@/types/workbench";

type ActionDefinition = {
  id: string;
  label: string;
};

type ActionBarPanelProps = {
  activeActionId: string | null;
  pipette: PipetteState;
  onToggleAction: (actionId: string) => void;
};

const actions: ActionDefinition[] = [
  {
    id: "knife",
    label: "Stainless steel knife",
  },
  {
    id: "spatula",
    label: "Powder spatula",
  },
  {
    id: "pipette",
    label: "Micropipette",
  },
];

function KnifeIcon({ active }: { active: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={active ? "text-sky-700" : "text-slate-700"}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="rotate(-142 12 12)">
        <rect
          fill="currentColor"
          height="4.2"
          opacity="0.9"
          rx="1.2"
          width="8.6"
          x="4.1"
          y="9.9"
        />
        <rect
          height="4.2"
          rx="1.2"
          stroke="currentColor"
          strokeWidth="1.15"
          width="8.6"
          x="4.1"
          y="9.9"
        />
        <path
          d="M12.7 9.9H15.9L19.8 12L15.9 14.1H12.7V9.9Z"
          fill="currentColor"
          opacity="0.18"
        />
        <path
          d="M12.7 9.9H15.9L19.8 12L15.9 14.1H12.7V9.9Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.15"
        />
        <path d="M6 10.9V13.1" stroke={active ? "#e0f2fe" : "#f8fafc"} strokeLinecap="round" strokeWidth="0.8" />
        <path d="M8.1 10.9V13.1" stroke={active ? "#e0f2fe" : "#f8fafc"} strokeLinecap="round" strokeWidth="0.8" />
      </g>
    </svg>
  );
}

function SpatulaIcon({ active }: { active: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={active ? "text-sky-700" : "text-slate-700"}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="rotate(-20 12 12)">
        {/* Handle (right side) */}
        <rect fill="currentColor" height="3" opacity="0.9" rx="1.5" width="9.5" x="11.5" y="10.5" />
        <rect height="3" rx="1.5" stroke="currentColor" strokeWidth="1.1" width="9.5" x="11.5" y="10.5" />
        {/* Grip notches */}
        <path d="M17 11V13" stroke={active ? "#e0f2fe" : "#f8fafc"} strokeLinecap="round" strokeWidth="0.7" />
        <path d="M19.5 11V13" stroke={active ? "#e0f2fe" : "#f8fafc"} strokeLinecap="round" strokeWidth="0.7" />
        {/* Bowl fill */}
        <ellipse cx="6.5" cy="12" fill="currentColor" opacity="0.18" rx="5.5" ry="4" />
        {/* Bowl outline */}
        <ellipse cx="6.5" cy="12" rx="5.5" ry="4" stroke="currentColor" strokeWidth="1.15" />
        {/* Bowl rim glint */}
        <ellipse cx="5" cy="10.2" fill="none" opacity="0.5" rx="2.5" ry="1.2" stroke="currentColor" strokeWidth="0.6" />
      </g>
    </svg>
  );
}

function PipetteIcon({ active, fillRatio }: { active: boolean; fillRatio: number }) {
  const liquidHeight = 7.4 * fillRatio;
  const liquidTop = 12.1 - liquidHeight;
  return (
    <svg aria-hidden="true" className={active ? "text-sky-700" : "text-slate-700"} fill="none" viewBox="0 0 24 24">
      <g transform="rotate(38 12 12)">
        <rect x="9" y="2" width="6" height="4" rx="1.2" fill="currentColor" opacity="0.25" />
        <rect x="8" y="5" width="8" height="10" rx="2" stroke="currentColor" strokeWidth="1.3" />
        <rect
          x="9"
          y={Math.max(5.4, liquidTop)}
          width="6"
          height={Math.max(0.6, liquidHeight)}
          rx="1.2"
          fill={fillRatio > 0 ? (active ? "#38bdf8" : "#7dd3fc") : "#e2e8f0"}
          opacity={fillRatio > 0 ? 0.92 : 0.2}
        />
        <rect x="9.7" y="7" width="4.6" height="5.5" rx="1" fill={active ? "#bae6fd" : "#f8fafc"} />
        <path d="M10.5 15h3L12.8 21h-1.6l-.7-6Z" fill="currentColor" opacity="0.8" />
      </g>
    </svg>
  );
}

export function ActionBarPanel({
  activeActionId,
  pipette,
  onToggleAction,
}: ActionBarPanelProps) {
  const pipetteFillRatio = Math.max(0, Math.min(1, pipette.volumeMl / pipette.capacityMl));
  return (
    <section className="rounded-[1.2rem] border border-slate-200 bg-white p-2 shadow-sm">
      <p
        className={`${dragAffordanceClassName} text-xs font-semibold uppercase tracking-[0.24em] text-slate-500`}
        data-widget-drag-handle="true"
      >
        Actions
      </p>

      <div className="mt-2 flex flex-col gap-2">
        {actions.map((action) => {
          const isActive = action.id === activeActionId;

          return (
            <button
              aria-pressed={isActive}
              className={`group relative flex h-12 w-12 items-center justify-center rounded-xl border transition ${
                isActive
                  ? "border-sky-300 bg-sky-50 ring-2 ring-sky-200/70"
                  : "border-slate-200 bg-slate-50/80 hover:border-slate-300 hover:bg-white"
              }`}
              key={action.id}
              onClick={() => onToggleAction(action.id)}
              title={
                action.id === "pipette"
                  ? `${action.label} · ${pipette.volumeMl.toFixed(2)} / ${pipette.capacityMl.toFixed(2)} mL`
                  : action.label
              }
              type="button"
            >
              <span className="sr-only">{action.label}</span>
              <div
                className={`absolute inset-0 rounded-xl ${
                  isActive ? "shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]" : ""
                }`}
              />
              <div className="h-[2.65rem] w-[2.65rem]">
                {action.id === "knife" ? (
                  <KnifeIcon active={isActive} />
                ) : action.id === "spatula" ? (
                  <SpatulaIcon active={isActive} />
                ) : (
                  <PipetteIcon active={isActive} fillRatio={pipetteFillRatio} />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
