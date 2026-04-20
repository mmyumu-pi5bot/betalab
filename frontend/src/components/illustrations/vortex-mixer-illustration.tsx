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
  const { defs: surfaceDefs, surface } = buildEquipmentIllustrationSurface({
    height: 320,
    idPrefix: testId ?? "vortex-mixer-illustration",
    radius: 30,
    width: 520,
  });

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
      {/* Start button — sits on the physical button housing painted in the SVG */}
      <button
        aria-label={startLabel}
        aria-pressed={isRunning}
        className={`absolute right-[4.8rem] top-[5.8rem] z-10 flex h-[30px] w-[30px] items-center justify-center rounded-[0.65rem] border transition ${
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

      <svg
        className="h-full w-full"
        fill="none"
        viewBox="0 0 520 320"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {surfaceDefs}

          {/* Body gradient */}
          <linearGradient id="vortex-body" x1="165" x2="355" y1="150" y2="290" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f4f7fa" offset="0" />
            <stop stopColor="#c8d4de" offset="1" />
          </linearGradient>

          {/* Panel gradient */}
          <linearGradient id="vortex-panel" x1="175" x2="345" y1="168" y2="278" gradientUnits="userSpaceOnUse">
            <stop stopColor="#e9f0f5" offset="0" />
            <stop stopColor="#d0dce6" offset="1" />
          </linearGradient>

          {/* Cup top face */}
          <radialGradient id="vortex-cup-top" cx="50%" cy="40%" r="55%" gradientUnits="objectBoundingBox">
            <stop stopColor={dropHighlighted ? "#ede9fe" : isRunning ? "#ddd6fe" : "#e2e8f0"} offset="0" />
            <stop stopColor={dropHighlighted ? "#c4b5fd" : isRunning ? "#a78bfa" : "#94a3b8"} offset="1" />
          </radialGradient>

          {/* Cup rim */}
          <linearGradient id="vortex-cup-rim" x1="188" x2="332" y1="90" y2="128" gradientUnits="userSpaceOnUse">
            <stop stopColor={isRunning ? "#7c3aed" : "#5a6872"} offset="0" />
            <stop stopColor={isRunning ? "#4c1d95" : "#374957"} offset="1" />
          </linearGradient>

          {/* Tube body */}
          <linearGradient id="vortex-tube" x1="245" x2="276" y1="50" y2="108" gradientUnits="userSpaceOnUse">
            <stop stopColor="#e0f2fe" offset="0" />
            <stop stopColor="#bae6fd" offset="1" />
          </linearGradient>

          {/* Dial */}
          <radialGradient id="vortex-dial" cx="50%" cy="35%" r="65%" gradientUnits="objectBoundingBox">
            <stop stopColor="#dde5eb" offset="0" />
            <stop stopColor="#8fa1ae" offset="1" />
          </radialGradient>

        </defs>

        {surface}

        {/* ── Rubber feet ─────────────────────────────────── */}
        <rect fill="#2d3f4a" height="12" rx="5" width="22" x="184" y="278" />
        <rect fill="#2d3f4a" height="12" rx="5" width="22" x="314" y="278" />

        {/* ── Main body ───────────────────────────────────── */}
        <g className="drop-shadow-[0_12px_28px_rgba(15,23,42,0.18)]">
          <rect fill="url(#vortex-body)" height="130" rx="15" stroke="#7a909e" strokeWidth="3" width="192" x="164" y="150" />
          <rect fill="url(#vortex-panel)" height="104" rx="10" stroke="#96aab7" strokeWidth="2" width="168" x="176" y="166" />

          {/* Speed label */}
          <text
            fill="#607080"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontSize="8.5"
            fontWeight="700"
            letterSpacing="0.16em"
            textAnchor="middle"
            x="222"
            y="248"
          >
            SPEED
          </text>

          {/* Speed dial */}
          <circle cx="222" cy="220" fill="url(#vortex-dial)" r="26" stroke="#5a7080" strokeWidth="2.5" />
          <circle cx="222" cy="220" fill="#e8eff4" r="18" stroke="#7a909e" strokeWidth="2" />
          {[...Array(8)].map((_, i) => {
            const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
            const x1 = 222 + Math.cos(angle) * 12;
            const y1 = 220 + Math.sin(angle) * 12;
            const x2 = 222 + Math.cos(angle) * 17;
            const y2 = 220 + Math.sin(angle) * 17;
            return <line key={i} stroke="#7a909e" strokeWidth="1.5" x1={x1} x2={x2} y1={y1} y2={y2} />;
          })}
          <line stroke="#374957" strokeLinecap="round" strokeWidth="2.5" x1="222" x2="222" y1="220" y2="207" />
          <circle cx="222" cy="220" fill="#374957" r="3.5" />

          {/* Status LED */}
          <circle
            cx="330"
            cy="255"
            fill={isRunning ? "#ef4444" : "#94a3b8"}
            opacity={isRunning ? "0.9" : "0.45"}
            r="4"
          />

          {/* Side vents — body right face, outside panel */}
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} fill="#6a8090" height="3" opacity="0.4" rx="1.5" width="10" x="349" y={190 + i * 9} />
          ))}
        </g>

        {/* ── Post / motor housing ─────────────────────────── */}
        <g className="drop-shadow-[0_4px_12px_rgba(15,23,42,0.16)]">
          <rect fill="#94a3b4" height="62" rx="10" stroke="#5a6872" strokeWidth="2.5" width="54" x="233" y="96" />
          <rect fill="#b0bec8" height="28" rx="6" stroke="none" width="34" x="243" y="110" />
        </g>

        {/* ── Cup rubber head ──────────────────────────────── */}
        <g className={cupGlow}>
          {/* Cup side walls */}
          <path
            d="M188 108 Q188 134 260 134 Q332 134 332 108"
            fill="url(#vortex-cup-rim)"
            stroke="none"
          />

          {/* Cup top face (the drop target) */}
          <ellipse
            cx="260"
            cy="108"
            fill="url(#vortex-cup-top)"
            rx="72"
            ry="18"
            stroke={cupHighlight}
            strokeWidth="2.5"
          />

          {/* Cup inner depression */}
          <ellipse
            cx="260"
            cy="106"
            fill={dropHighlighted ? "#ede9fe" : isRunning ? "#c4b5fd" : "#dde4ea"}
            opacity={dropHighlighted ? "0.9" : "0.75"}
            rx="44"
            ry="11"
            stroke={dropHighlighted ? "#a78bfa" : isRunning ? "#7c3aed" : "#8096a4"}
            strokeWidth="1.5"
          />

          {/* Tube slot (innermost) */}
          <ellipse
            cx="260"
            cy="104"
            fill={
              hasTool
                ? "url(#vortex-tube)"
                : dropHighlighted
                  ? "#ddd6fe"
                  : "#c8d4de"
            }
            rx="26"
            ry="6.5"
            stroke={
              hasTool ? "#0ea5e9" : dropHighlighted ? "#a78bfa" : "#7a909e"
            }
            strokeWidth={hasTool ? "2" : "1.5"}
          />

          {/* Running vibration arcs */}
          {isRunning && (
            <>
              <path
                d="M192 98 Q208 88 220 94"
                fill="none"
                opacity="0.55"
                stroke="#a78bfa"
                strokeLinecap="round"
                strokeWidth="2.5"
              />
              <path
                d="M300 94 Q312 88 328 98"
                fill="none"
                opacity="0.55"
                stroke="#a78bfa"
                strokeLinecap="round"
                strokeWidth="2.5"
              />
              <path
                d="M182 110 Q196 98 210 104"
                fill="none"
                opacity="0.35"
                stroke="#7c3aed"
                strokeLinecap="round"
                strokeWidth="2"
              />
              <path
                d="M310 104 Q324 98 338 110"
                fill="none"
                opacity="0.35"
                stroke="#7c3aed"
                strokeLinecap="round"
                strokeWidth="2"
              />
            </>
          )}
        </g>

        {/* ── Tube sitting in the cup ──────────────────────── */}
        {hasTool && (
          <g className="drop-shadow-[0_2px_8px_rgba(15,23,42,0.18)]">
            {/* Tube body */}
            <rect fill="url(#vortex-tube)" height="68" rx="6" stroke="#0ea5e9" strokeWidth="2" width="20" x="250" y="38" />
            {/* Tube cap */}
            <rect fill="#0284c7" height="12" rx="4" stroke="#0369a1" strokeWidth="1.5" width="20" x="250" y="36" />
            {/* Tube highlight */}
            <rect fill="white" height="40" opacity="0.35" rx="3" width="5" x="253" y="44" />
            {/* Tube graduation marks */}
            <line opacity="0.5" stroke="#0ea5e9" strokeWidth="1" x1="268" x2="272" y1="58" y2="58" />
            <line opacity="0.5" stroke="#0ea5e9" strokeWidth="1" x1="268" x2="270" y1="66" y2="66" />
            <line opacity="0.5" stroke="#0ea5e9" strokeWidth="1" x1="268" x2="272" y1="74" y2="74" />
            {isRunning && (
              <ellipse cx="260" cy="56" fill="#38bdf8" opacity="0.22" rx="14" ry="14" />
            )}
          </g>
        )}

        {/* ── Drop hint when empty and highlighted ─────────── */}
        {dropHighlighted && !hasTool && (
          <g opacity="0.7">
            <rect fill="none" height="66" rx="6" stroke="#a78bfa" strokeDasharray="4 3" strokeWidth="2" width="20" x="250" y="36" />
          </g>
        )}
      </svg>
    </div>
  );
}
