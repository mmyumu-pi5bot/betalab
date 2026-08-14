"use client";

import { buildEquipmentIllustrationSurface } from "@/components/illustrations/equipment-illustration-surface";

type VortexMixerIllustrationProps = {
  className?: string;
  dropHighlighted?: boolean;
  hasTool?: boolean;
  isRunning?: boolean;
  onStartClick?: () => void;
  startDisabled?: boolean;
  startLabel?: string;
  startTestId?: string;
  testId?: string;
};

const DIAL_CENTER = { x: 152, y: 206 };

export function VortexMixerIllustration({
  className,
  dropHighlighted = false,
  hasTool = false,
  isRunning = false,
  onStartClick,
  startDisabled = false,
  startLabel = "Start vortex",
  startTestId,
  testId,
}: VortexMixerIllustrationProps) {
  const idPrefix = testId ?? "vortex-mixer-illustration";
  const { defs: surfaceDefs, surface } = buildEquipmentIllustrationSurface({
    height: 320,
    idPrefix,
    radius: 30,
    width: 382,
  });
  const bodyGradientId = `${idPrefix}-body`;
  const panelGradientId = `${idPrefix}-panel`;
  const cupTopGradientId = `${idPrefix}-cup-top`;
  const cupRimGradientId = `${idPrefix}-cup-rim`;
  const tubeGradientId = `${idPrefix}-tube`;
  const dialGradientId = `${idPrefix}-dial`;

  const cupHighlight = dropHighlighted
    ? "#a78bfa"
    : isRunning
      ? "#7c3aed"
      : hasTool
        ? "#6d28d9"
        : "#94a3b8";

  const cupGlow = dropHighlighted
    ? "drop-shadow-[0_0_18px_rgba(167,139,250,0.55)]"
    : isRunning
      ? "drop-shadow-[0_0_16px_rgba(124,58,237,0.45)]"
      : "";

  const canStart = !startDisabled;
  const startButtonClassName = isRunning
    ? "border-red-600 bg-red-600 text-white"
    : canStart
      ? "border-red-300 bg-red-100 text-red-700 shadow-[0_10px_24px_rgba(239,68,68,0.2)] hover:border-red-400 hover:bg-red-200 hover:text-red-800"
      : "border-red-200 bg-red-100 text-red-400";

  return (
    <div
      aria-label="Vortex mixer illustration"
      className={`relative ${className ?? ""}`}
      data-drop-highlighted={dropHighlighted}
      data-has-tool={hasTool}
      data-running={isRunning}
      data-testid={testId}
    >
      <svg
        className="h-full w-full"
        fill="none"
        viewBox="0 0 382 320"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {surfaceDefs}

          {/* Body gradient */}
          <linearGradient id={bodyGradientId} x1="90" x2="330" y1="142" y2="288" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f4f7fa" offset="0" />
            <stop stopColor="#c8d4de" offset="1" />
          </linearGradient>

          {/* Panel gradient */}
          <linearGradient id={panelGradientId} x1="104" x2="316" y1="160" y2="272" gradientUnits="userSpaceOnUse">
            <stop stopColor="#e9f0f5" offset="0" />
            <stop stopColor="#d0dce6" offset="1" />
          </linearGradient>

          {/* Cup top face */}
          <radialGradient id={cupTopGradientId} cx="50%" cy="40%" r="55%" gradientUnits="objectBoundingBox">
            <stop stopColor={dropHighlighted ? "#ede9fe" : isRunning ? "#ddd6fe" : "#e2e8f0"} offset="0" />
            <stop stopColor={dropHighlighted ? "#c4b5fd" : isRunning ? "#a78bfa" : "#94a3b8"} offset="1" />
          </radialGradient>

          {/* Cup rim */}
          <linearGradient id={cupRimGradientId} x1="134" x2="286" y1="80" y2="122" gradientUnits="userSpaceOnUse">
            <stop stopColor={isRunning ? "#7c3aed" : "#5a6872"} offset="0" />
            <stop stopColor={isRunning ? "#4c1d95" : "#374957"} offset="1" />
          </linearGradient>

          {/* Tube body */}
          <linearGradient id={tubeGradientId} x1="196" x2="224" y1="22" y2="94" gradientUnits="userSpaceOnUse">
            <stop stopColor="#e0f2fe" offset="0" />
            <stop stopColor="#bae6fd" offset="1" />
          </linearGradient>

          {/* Dial */}
          <radialGradient id={dialGradientId} cx="50%" cy="35%" r="65%" gradientUnits="objectBoundingBox">
            <stop stopColor="#dde5eb" offset="0" />
            <stop stopColor="#8fa1ae" offset="1" />
          </radialGradient>
        </defs>

        {surface}

        <g transform="translate(-19 0)">
        {/* ── Rubber feet ─────────────────────────────────── */}
        <rect fill="#2d3f4a" height="13" rx="5" width="28" x="120" y="282" />
        <rect fill="#2d3f4a" height="13" rx="5" width="28" x="272" y="282" />

        {/* ── Main body ───────────────────────────────────── */}
        <g className="drop-shadow-[0_12px_28px_rgba(15,23,42,0.18)]">
          <rect fill={`url(#${bodyGradientId})`} height="146" rx="16" stroke="#7a909e" strokeWidth="2.5" width="240" x="90" y="142" />
          <rect fill={`url(#${panelGradientId})`} height="112" rx="10" stroke="#96aab7" strokeWidth="1.8" width="212" x="104" y="160" />

          {/* Speed dial */}
          <circle cx={DIAL_CENTER.x} cy={DIAL_CENTER.y} fill={`url(#${dialGradientId})`} r="28" stroke="#5a7080" strokeWidth="2.2" />
          <circle cx={DIAL_CENTER.x} cy={DIAL_CENTER.y} fill="#e8eff4" r="19.5" stroke="#7a909e" strokeWidth="1.8" />
          {[...Array(8)].map((_, index) => {
            const angle = (index / 8) * Math.PI * 2 - Math.PI / 2;
            return (
              <line
                key={index}
                stroke="#7a909e"
                strokeWidth="1.4"
                x1={DIAL_CENTER.x + Math.cos(angle) * 13}
                x2={DIAL_CENTER.x + Math.cos(angle) * 18.5}
                y1={DIAL_CENTER.y + Math.sin(angle) * 13}
                y2={DIAL_CENTER.y + Math.sin(angle) * 18.5}
              />
            );
          })}
          <line
            stroke="#374957"
            strokeLinecap="round"
            strokeWidth="2.4"
            x1={DIAL_CENTER.x}
            x2={DIAL_CENTER.x + (isRunning ? 10 : -10)}
            y1={DIAL_CENTER.y}
            y2={DIAL_CENTER.y - 10}
          />
          <circle cx={DIAL_CENTER.x} cy={DIAL_CENTER.y} fill="#374957" r="3.5" />
          <text
            fill="#607080"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontSize="9"
            fontWeight="700"
            letterSpacing="0.16em"
            textAnchor="middle"
            x={DIAL_CENTER.x}
            y="250"
          >
            SPEED
          </text>

          {/* Run lamp */}
          <circle cx="210" cy="200" fill="#cbd5e1" r="9" stroke="#7a909e" strokeWidth="1.6" />
          <circle
            cx="210"
            cy="200"
            fill={isRunning ? "#ef4444" : "#94a3b8"}
            opacity={isRunning ? "0.95" : "0.45"}
            r="5.5"
          />
          <text
            fill="#607080"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontSize="8"
            fontWeight="700"
            letterSpacing="0.16em"
            textAnchor="middle"
            x="210"
            y="224"
          >
            RUN
          </text>

          {/* Side vents — body right face, outside panel */}
          {[0, 1, 2, 3, 4].map((index) => (
            <rect key={index} fill="#6a8090" height="3" opacity="0.4" rx="1.5" width="9" x="318" y={182 + index * 10} />
          ))}
        </g>

        {/* ── Start button, recessed into the fascia ──────── */}
        <g>
          <rect fill="#5c6f7c" height="60" rx="15" width="60" x="240" y="180" />
          <rect fill="#3f4f5a" height="52" rx="12" width="52" x="244" y="184" />
          <foreignObject height="46" width="46" x="247" y="187">
            <button
              aria-label={startLabel}
              aria-pressed={isRunning}
              className={`flex h-full w-full items-center justify-center rounded-[0.75rem] border transition ${
                startDisabled && !isRunning ? "cursor-not-allowed opacity-70" : "active:scale-[0.97]"
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

        {/* ── Post / motor housing ─────────────────────────── */}
        <g className="drop-shadow-[0_4px_12px_rgba(15,23,42,0.16)]">
          <rect fill="#94a3b4" height="52" rx="11" stroke="#5a6872" strokeWidth="2.2" width="60" x="180" y="98" />
          <rect fill="#b0bec8" height="24" rx="6" width="38" x="191" y="110" />
        </g>

        {/* ── Cup rubber head ──────────────────────────────── */}
        <g className={cupGlow}>
          {/* Cup side walls */}
          <path d="M134 96 Q134 125 210 125 Q286 125 286 96" fill={`url(#${cupRimGradientId})`} />

          {/* Cup top face (the drop target) */}
          <ellipse
            cx="210"
            cy="96"
            fill={`url(#${cupTopGradientId})`}
            rx="76"
            ry="19"
            stroke={cupHighlight}
            strokeWidth="2.5"
          />

          {/* Cup inner depression */}
          <ellipse
            cx="210"
            cy="94"
            fill={dropHighlighted ? "#ede9fe" : isRunning ? "#c4b5fd" : "#dde4ea"}
            opacity={dropHighlighted ? "0.9" : "0.75"}
            rx="48"
            ry="12"
            stroke={dropHighlighted ? "#a78bfa" : isRunning ? "#7c3aed" : "#8096a4"}
            strokeWidth="1.6"
          />

          {/* Tube slot (innermost) */}
          <ellipse
            cx="210"
            cy="92"
            fill={hasTool ? `url(#${tubeGradientId})` : dropHighlighted ? "#ddd6fe" : "#c8d4de"}
            rx="31"
            ry="8"
            stroke={hasTool ? "#0ea5e9" : dropHighlighted ? "#a78bfa" : "#7a909e"}
            strokeWidth={hasTool ? "2" : "1.6"}
          />

          {/* Running vibration arcs */}
          {isRunning && (
            <>
              <path d="M138 84 Q154 73 168 80" fill="none" opacity="0.55" stroke="#a78bfa" strokeLinecap="round" strokeWidth="2.6" />
              <path d="M252 80 Q266 73 282 84" fill="none" opacity="0.55" stroke="#a78bfa" strokeLinecap="round" strokeWidth="2.6" />
              <path d="M126 98 Q142 84 158 91" fill="none" opacity="0.35" stroke="#7c3aed" strokeLinecap="round" strokeWidth="2.2" />
              <path d="M262 91 Q278 84 294 98" fill="none" opacity="0.35" stroke="#7c3aed" strokeLinecap="round" strokeWidth="2.2" />
            </>
          )}
        </g>

        {/* ── Tube sitting in the cup ──────────────────────── */}
        {hasTool && (
          <g className="drop-shadow-[0_2px_8px_rgba(15,23,42,0.18)]">
            {/* Tube body */}
            <rect fill={`url(#${tubeGradientId})`} height="80" rx="7" stroke="#0ea5e9" strokeWidth="2" width="26" x="197" y="14" />
            {/* Tube cap */}
            <rect fill="#0284c7" height="14" rx="4" stroke="#0369a1" strokeWidth="1.5" width="26" x="197" y="12" />
            {/* Tube highlight */}
            <rect fill="white" height="48" opacity="0.35" rx="3" width="6" x="201" y="24" />
            {/* Tube graduation marks */}
            <line opacity="0.5" stroke="#0ea5e9" strokeWidth="1.2" x1="217" x2="222" y1="40" y2="40" />
            <line opacity="0.5" stroke="#0ea5e9" strokeWidth="1.2" x1="217" x2="220" y1="50" y2="50" />
            <line opacity="0.5" stroke="#0ea5e9" strokeWidth="1.2" x1="217" x2="222" y1="60" y2="60" />
            {isRunning && <ellipse cx="210" cy="38" fill="#38bdf8" opacity="0.22" rx="16" ry="16" />}
          </g>
        )}

        {/* ── Drop hint when empty and highlighted ─────────── */}
        {dropHighlighted && !hasTool && (
          <rect
            fill="none"
            height="78"
            opacity="0.7"
            rx="7"
            stroke="#a78bfa"
            strokeDasharray="4 3"
            strokeWidth="2"
            width="26"
            x="197"
            y="14"
          />
        )}
        </g>
      </svg>
    </div>
  );
}
