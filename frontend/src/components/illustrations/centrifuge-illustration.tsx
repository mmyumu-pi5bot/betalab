"use client";

import { buildEquipmentIllustrationSurface } from "@/components/illustrations/equipment-illustration-surface";

type CentrifugeIllustrationProps = {
  className?: string;
  hasTube: boolean;
  isRunning: boolean;
  onStartClick?: () => void;
  separationProgress: number;
  startDisabled?: boolean;
  startLabel?: string;
  startTestId?: string;
};

// Rotor slots laid out around the perspective bowl. The front slot (90°) holds
// the visible sample tube; the others are empty holders on the rotor face.
const ROTOR_CENTER = { x: 260, y: 157 };
const ROTOR_RADIUS = { x: 96, y: 27 };
const EMPTY_SLOT_ANGLES = [30, 90, 150, 210, 270, 330];

function slotGeometry(angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  const depth = (Math.sin(rad) + 1) / 2; // 0 at back, 1 at front
  const scale = 0.8 + depth * 0.45;
  return {
    x: ROTOR_CENTER.x + Math.cos(rad) * ROTOR_RADIUS.x,
    y: ROTOR_CENTER.y + Math.sin(rad) * ROTOR_RADIUS.y,
    rx: 13 * scale,
    ry: 6 * scale,
  };
}

export function CentrifugeIllustration({
  className,
  hasTube,
  isRunning,
  onStartClick,
  separationProgress,
  startDisabled = false,
  startLabel = "Start the centrifuge",
  startTestId,
}: CentrifugeIllustrationProps) {
  const progress = Math.max(0, Math.min(separationProgress, 1));
  const canStart = !startDisabled;
  const startButtonClassName = isRunning
    ? "border-red-600 bg-red-600 text-white"
    : canStart
      ? "border-red-300 bg-red-100 text-red-700 shadow-[0_10px_24px_rgba(239,68,68,0.2)] hover:border-red-400 hover:bg-red-200 hover:text-red-800"
      : "border-red-200 bg-red-100 text-red-400";

  const { defs: surfaceDefs, surface } = buildEquipmentIllustrationSurface({
    height: 272,
    idPrefix: "centrifuge-illustration",
    radius: 30,
    width: 520,
  });

  // Sample-tube phase columns (only meaningful once a tube is loaded).
  const liquidBottom = 180;
  const liquidTop = 126;
  const pelletHeight = progress * 16;
  const supernatantTop = liquidTop + progress * 6; // liquid clears/settles slightly

  return (
    <div
      aria-label="Benchtop centrifuge"
      className={`relative ${className ?? ""}`}
      data-testid="centrifuge-illustration"
      role="group"
    >
      <svg className="h-full w-full" fill="none" viewBox="0 0 520 272" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {surfaceDefs}

          {/* Drum outer shell */}
          <linearGradient id="centrifuge-body" x1="90" x2="430" y1="140" y2="300" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#f4f7fa" />
            <stop offset="1" stopColor="#b7c6d2" />
          </linearGradient>

          {/* Chamber interior (bowl depth) */}
          <radialGradient id="centrifuge-chamber" cx="50%" cy="42%" r="62%" gradientUnits="objectBoundingBox">
            <stop offset="0" stopColor="#4a5b68" />
            <stop offset="1" stopColor="#25333d" />
          </radialGradient>

          {/* Spinning rotor disc */}
          <radialGradient id="centrifuge-rotor" cx="50%" cy="38%" r="65%" gradientUnits="objectBoundingBox">
            <stop offset="0" stopColor="#5b6f7d" />
            <stop offset="0.7" stopColor="#354754" />
            <stop offset="1" stopColor="#1c2932" />
          </radialGradient>

          {/* Sample tube glass */}
          <linearGradient id="centrifuge-tube" x1="249" x2="271" y1="110" y2="188" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#eef6fb" />
            <stop offset="1" stopColor="#c9dced" />
          </linearGradient>

          {/* Mounted front control fascia */}
          <linearGradient id="centrifuge-fascia" x1="260" x2="260" y1="196" y2="266" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#f0f5f9" />
            <stop offset="1" stopColor="#c1d0db" />
          </linearGradient>
        </defs>

        {surface}

        <g transform="translate(0 -66)">
        {/* ── Drum body (cylinder wall + base) ─────────────── */}
        <g className="drop-shadow-[0_14px_30px_rgba(15,23,42,0.2)]">
          <path
            d="M90 150 L90 250 A170 46 0 0 0 430 250 L430 150 Z"
            fill="url(#centrifuge-body)"
            stroke="#7a909e"
            strokeWidth="3"
          />
          {/* Rim / top face */}
          <ellipse cx="260" cy="150" fill="url(#centrifuge-body)" rx="170" ry="46" stroke="#7a909e" strokeWidth="3" />
          {/* Chamber opening — the perspective bowl where the tube sits */}
          <ellipse cx="260" cy="152" fill="url(#centrifuge-chamber)" rx="140" ry="38" stroke="#5a6f7d" strokeWidth="2.5" />
          <ellipse cx="260" cy="156" fill="#1e2b34" opacity="0.55" rx="116" ry="31" />
        </g>

        {/* ── Rotor disc ───────────────────────────────────── */}
        <g>
          <ellipse
            cx={ROTOR_CENTER.x}
            cy={ROTOR_CENTER.y}
            fill="url(#centrifuge-rotor)"
            rx={ROTOR_RADIUS.x + 6}
            ry={ROTOR_RADIUS.y + 4}
            stroke="#101c24"
            strokeWidth="2.5"
          />
          {/* Central hub */}
          <ellipse cx={ROTOR_CENTER.x} cy={ROTOR_CENTER.y} fill="#0f1a22" rx="12" ry="6" />
          <ellipse cx={ROTOR_CENTER.x} cy={ROTOR_CENTER.y - 1} fill="#4a5b68" rx="5" ry="2.5" />

          {/* Empty tube holders around the rotor */}
          {EMPTY_SLOT_ANGLES.map((angle) => {
            const slot = slotGeometry(angle);
            return (
              <ellipse
                key={angle}
                cx={slot.x}
                cy={slot.y}
                fill="#101c24"
                opacity={isRunning ? 0.35 : 0.85}
                rx={slot.rx}
                ry={slot.ry}
                stroke="#3a4c58"
                strokeWidth="1.5"
              />
            );
          })}
        </g>

        {/* ── Motion streaks while spinning ────────────────── */}
        {isRunning ? (
          <g
            className="animate-spin"
            style={{ animationDuration: "0.5s", transformBox: "fill-box", transformOrigin: "center" }}
          >
            <path
              d="M164 157 A96 27 0 0 1 356 157"
              opacity="0.5"
              stroke="#93c5fd"
              strokeLinecap="round"
              strokeWidth="3"
            />
            <path
              d="M356 157 A96 27 0 0 1 164 157"
              opacity="0.28"
              stroke="#bfdbfe"
              strokeLinecap="round"
              strokeWidth="2"
            />
          </g>
        ) : null}

        {/* ── Sample tube in the front slot, showing phases ── */}
        {hasTube ? (
          <g data-testid="centrifuge-visible-phases" className="drop-shadow-[0_3px_8px_rgba(15,23,42,0.22)]">
            {/* Glass body */}
            <path
              d="M249 116 h22 v52 c0 14 -22 14 -22 0 z"
              fill="url(#centrifuge-tube)"
              stroke="#0f6f86"
              strokeWidth="2"
            />
            {/* Homogenate (murky, fades as separation completes) */}
            <path
              d={`M250 ${supernatantTop} h20 v${liquidBottom - supernatantTop - 6} c0 12 -20 12 -20 0 z`}
              fill="#c7b56a"
              opacity={0.25 + (1 - progress) * 0.5}
            />
            {/* Clarified supernatant */}
            <rect
              fill="#f7e08a"
              height={Math.max(0, liquidBottom - pelletHeight - supernatantTop - 6)}
              opacity={0.35 + progress * 0.5}
              width="20"
              x="250"
              y={supernatantTop}
            />
            {/* Pellet at the bottom of the tube */}
            <path
              d={`M250 ${liquidBottom - pelletHeight - 6} h20 v${pelletHeight} c0 10 -20 10 -20 0 z`}
              fill="#8b5e34"
              opacity={progress}
            />
            {/* Cap + highlight */}
            <rect fill="#0ea5e9" height="12" rx="4" stroke="#0369a1" strokeWidth="1.5" width="24" x="248" y="106" />
            <rect fill="#ffffff" height="30" opacity="0.4" rx="2.5" width="4" x="253" y="122" />
          </g>
        ) : null}

        {/* ── Mounted front control fascia (flat plate on the round body) ── */}
        <g className="drop-shadow-[0_6px_14px_rgba(15,23,42,0.28)]">
          <rect fill="url(#centrifuge-fascia)" height="70" rx="18" stroke="#8298a6" strokeWidth="2" width="256" x="132" y="196" />
          {/* Top bevel highlight so the plate reads as raised */}
          <rect fill="#ffffff" height="3" opacity="0.55" rx="1.5" width="228" x="146" y="201" />
        </g>

        {/* ── Recessed LCD display ─────────────────────────── */}
        <g>
          <rect fill="#0c161c" height="44" rx="9" width="150" x="148" y="209" />
          <rect fill="#16242d" height="40" rx="7" stroke="#33454f" strokeWidth="1.5" width="142" x="152" y="211" />
          <text fill="#bfffd7" fontFamily="monospace" fontSize="16" fontWeight="700" textAnchor="middle" x="223" y="231">
            {isRunning ? "4000 RPM" : "READY"}
          </text>
          <text fill="#8ee6ff" fontFamily="monospace" fontSize="10" textAnchor="middle" x="223" y="246">
            {Math.round(progress * 100)}% SEPARATED
          </text>
        </g>

        {/* ── Power button, recessed into the fascia ───────── */}
        <g>
          <rect fill="#5c6f7c" height="50" rx="13" width="50" x="316" y="206" />
          <rect fill="#3f4f5a" height="42" rx="10" width="42" x="320" y="210" />
          <foreignObject height="36" width="36" x="323" y="213">
            <button
              aria-label={startLabel}
              aria-pressed={isRunning}
              className={`flex h-full w-full items-center justify-center rounded-[0.7rem] border transition ${
                startDisabled && !isRunning ? "cursor-not-allowed opacity-70" : ""
              } ${startButtonClassName}`}
              data-testid={startTestId}
              disabled={startDisabled && !isRunning}
              onClick={onStartClick}
              type="button"
            >
              <svg
                aria-hidden="true"
                className={`h-5 w-5 ${isRunning ? "animate-pulse" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 3.75V11.25" stroke="currentColor" strokeLinecap="round" strokeWidth="2.1" />
                <path
                  d="M7.58 6.56C5.77 7.98 4.62 10.18 4.62 12.65C4.62 16.93 8.05 20.4 12.29 20.4C16.53 20.4 19.96 16.93 19.96 12.65C19.96 10.18 18.81 7.98 17 6.56"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="2.1"
                />
              </svg>
            </button>
          </foreignObject>
        </g>

        {/* ── Rubber feet ──────────────────────────────────── */}
        <rect fill="#2d3f4a" height="12" rx="5" width="30" x="150" y="286" />
        <rect fill="#2d3f4a" height="12" rx="5" width="30" x="340" y="286" />
        </g>
      </svg>
    </div>
  );
}
