"use client";

import { buildEquipmentIllustrationSurface } from "@/components/illustrations/equipment-illustration-surface";
import { getCryogenicStatus, type CryogenicTone } from "@/lib/cryogenic-temperature";

type CryogenicGrinderIllustrationProps = {
  className?: string;
  onPowerClick?: () => void;
  powerButtonDisabled?: boolean;
  powerButtonLabel?: string;
  powerButtonTestId?: string;
  status?: "idle" | "ready" | "running";
  /** Temperature of the lot sitting in the chamber; omitted when the chamber is empty. */
  temperatureC?: number;
  testId?: string;
};

const DIAL_CENTER = { x: 182, y: 242 };

// Readout hues, picked to stay legible on the dark fascia inlay.
const READOUT_TONE_FILLS: Record<CryogenicTone, string> = {
  ambient: "#a8c0cd",
  cooling: "#67e8f9",
  cryogenic: "#8ee6ff",
  hot: "#fda4af",
  warm: "#fbbf24",
};
const READOUT_EMPTY_FILL = "#5b7683";

export function CryogenicGrinderIllustration({
  className,
  onPowerClick,
  powerButtonDisabled = false,
  powerButtonLabel = "Start grinder",
  powerButtonTestId,
  status = "idle",
  temperatureC,
  testId,
}: CryogenicGrinderIllustrationProps) {
  const isRunning = status === "running";
  const isReady = status === "ready";
  const isLoaded = isReady || isRunning;
  const idPrefix = testId ?? "cryogenic-grinder-illustration";
  const { defs: surfaceDefs, surface } = buildEquipmentIllustrationSurface({
    height: 340,
    idPrefix,
    radius: 30,
    width: 472,
  });
  const bodyGradientId = `${idPrefix}-body`;
  const panelGradientId = `${idPrefix}-panel`;
  const bowlGradientId = `${idPrefix}-bowl`;
  const lidGradientId = `${idPrefix}-lid`;
  const dialGradientId = `${idPrefix}-dial`;

  const accentFill = isRunning ? "#22c55e" : isReady ? "#f59e0b" : "#94a3b8";
  const panelGlow = isRunning
    ? "drop-shadow-[0_0_14px_rgba(34,197,94,0.4)]"
    : isReady
      ? "drop-shadow-[0_0_12px_rgba(245,158,11,0.32)]"
      : "";
  const powerButtonToneClassName = isRunning
    ? "border-red-600 bg-red-600 text-white"
    : powerButtonDisabled
      ? "border-red-200 bg-red-100 text-red-400"
      : "border-red-300 bg-red-100 text-red-700 shadow-[0_10px_24px_rgba(239,68,68,0.2)] hover:border-red-400 hover:bg-red-200 hover:text-red-800";
  // Needle sweeps clockwise as the mill goes idle → loaded → grinding.
  const dialAngle = isRunning ? 58 : isReady ? 0 : -58;

  // The readout mirrors the simulated lot temperature, not the machine status:
  // a lot loaded but still too warm to grind must be readable while it cools.
  const hasTemperatureReading = temperatureC !== undefined;
  const readoutTone = hasTemperatureReading ? getCryogenicStatus(temperatureC).tone : null;
  const readoutFill = readoutTone ? READOUT_TONE_FILLS[readoutTone] : READOUT_EMPTY_FILL;
  const readoutLabel = hasTemperatureReading ? `${Math.round(temperatureC)}°C` : "--°C";

  return (
    <div
      aria-label="Cryogenic grinder illustration"
      className={`relative ${className ?? ""}`}
      data-status={status}
      data-testid={testId}
    >
      <svg
        className="h-full w-full"
        fill="none"
        viewBox="0 0 472 340"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {surfaceDefs}

          {/* Base chassis */}
          <linearGradient id={bodyGradientId} x1="120" x2="400" y1="190" y2="302" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f4f7fa" offset="0" />
            <stop stopColor="#c8d4de" offset="1" />
          </linearGradient>

          {/* Recessed fascia */}
          <linearGradient id={panelGradientId} x1="134" x2="386" y1="204" y2="288" gradientUnits="userSpaceOnUse">
            <stop stopColor="#e9f0f5" offset="0" />
            <stop stopColor="#d0dce6" offset="1" />
          </linearGradient>

          {/* Grinding jar glass */}
          <linearGradient id={bowlGradientId} x1="202" x2="318" y1="112" y2="178" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f4fafd" offset="0" />
            <stop stopColor="#d3e2ed" offset="1" />
          </linearGradient>

          {/* Machined lid */}
          <linearGradient id={lidGradientId} x1="196" x2="324" y1="88" y2="118" gradientUnits="userSpaceOnUse">
            <stop stopColor="#cbd7e1" offset="0" />
            <stop stopColor="#8496a4" offset="1" />
          </linearGradient>

          {/* Speed dial */}
          <radialGradient id={dialGradientId} cx="50%" cy="35%" r="65%" gradientUnits="objectBoundingBox">
            <stop stopColor="#dde5eb" offset="0" />
            <stop stopColor="#8fa1ae" offset="1" />
          </radialGradient>
        </defs>

        {surface}

        <g transform="translate(-24 0)">
        {/* ── Rubber feet ─────────────────────────────────── */}
        <rect fill="#2d3f4a" height="12" rx="5" width="36" x="156" y="300" />
        <rect fill="#2d3f4a" height="12" rx="5" width="36" x="328" y="300" />

        {/* ── Base chassis + fascia ───────────────────────── */}
        <g className="drop-shadow-[0_12px_28px_rgba(15,23,42,0.18)]">
          <rect fill={`url(#${bodyGradientId})`} height="112" rx="18" stroke="#7a909e" strokeWidth="2" width="280" x="120" y="190" />
          <rect fill={`url(#${panelGradientId})`} height="84" rx="11" stroke="#96aab7" strokeWidth="1.5" width="252" x="134" y="204" />

          {/* Speed dial */}
          <circle cx={DIAL_CENTER.x} cy={DIAL_CENTER.y} fill={`url(#${dialGradientId})`} r="25" stroke="#5a7080" strokeWidth="2" />
          <circle cx={DIAL_CENTER.x} cy={DIAL_CENTER.y} fill="#e8eff4" r="17" stroke="#7a909e" strokeWidth="1.5" />
          {[...Array(8)].map((_, index) => {
            const angle = (index / 8) * Math.PI * 2 - Math.PI / 2;
            return (
              <line
                key={index}
                stroke="#7a909e"
                strokeWidth="1.2"
                x1={DIAL_CENTER.x + Math.cos(angle) * 11.5}
                x2={DIAL_CENTER.x + Math.cos(angle) * 16}
                y1={DIAL_CENTER.y + Math.sin(angle) * 11.5}
                y2={DIAL_CENTER.y + Math.sin(angle) * 16}
              />
            );
          })}
          <line
            stroke="#374957"
            strokeLinecap="round"
            strokeWidth="2.2"
            x1={DIAL_CENTER.x}
            x2={DIAL_CENTER.x + Math.sin((dialAngle * Math.PI) / 180) * 12}
            y1={DIAL_CENTER.y}
            y2={DIAL_CENTER.y - Math.cos((dialAngle * Math.PI) / 180) * 12}
          />
          <circle cx={DIAL_CENTER.x} cy={DIAL_CENTER.y} fill="#374957" r="3" />
          <text
            fill="#607080"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontSize="8.5"
            fontWeight="700"
            letterSpacing="0.16em"
            textAnchor="middle"
            x={DIAL_CENTER.x}
            y="279"
          >
            SPEED
          </text>

          {/* Cryogenic temperature readout */}
          <rect fill="#16242d" height="30" rx="8" stroke="#33454f" strokeWidth="1.5" width="72" x="218" y="224" />
          <text
            data-testid={testId ? "grinder-temperature-readout" : undefined}
            data-tone={readoutTone ?? "none"}
            fill={readoutFill}
            fontFamily="monospace"
            fontSize="14"
            fontWeight="700"
            textAnchor="middle"
            x="254"
            y="244"
          >
            {readoutLabel}
          </text>

          {/* Status lamps */}
          <g className={panelGlow}>
            <circle cx="240" cy="268" fill={accentFill} r="4.5" />
            <circle cx="258" cy="268" fill={isRunning ? "#ffd15a" : "#cbd5e1"} r="4.5" />
          </g>

          {/* Side vents */}
          {[0, 1, 2, 3].map((index) => (
            <rect key={index} fill="#6a8090" height="2.5" opacity="0.35" rx="1.25" width="9" x="388" y={214 + index * 9} />
          ))}
        </g>

        {/* ── Power button, recessed into the fascia ──────── */}
        <g>
          <rect fill="#5c6f7c" height="56" rx="14" width="56" x="300" y="214" />
          <rect fill="#3f4f5a" height="48" rx="11" width="48" x="304" y="218" />
          <foreignObject height="42" width="42" x="307" y="221">
            <button
              aria-label={powerButtonLabel}
              aria-pressed={isRunning}
              className={`flex h-full w-full items-center justify-center rounded-[0.72rem] border transition ${
                powerButtonDisabled ? "cursor-not-allowed opacity-70" : "active:scale-[0.97]"
              } ${powerButtonToneClassName}`}
              data-testid={powerButtonTestId}
              data-tutorial-anchor={powerButtonTestId ? "grinder-power-button" : undefined}
              disabled={powerButtonDisabled}
              onClick={onPowerClick}
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

        {/* ── Grinding jar ────────────────────────────────── */}
        <g className="drop-shadow-[0_10px_20px_rgba(15,23,42,0.14)]">
          {/* Jar floor seated in the deck recess */}
          <ellipse cx="260" cy="178" fill="#a9b8c4" rx="58" ry="15" stroke="#7a909e" strokeWidth="2" />

          {/* Glass wall — open path so no seam is drawn across the rim */}
          <path
            d="M202 112 L202 178 A58 15 0 0 0 318 178 L318 112"
            fill={`url(#${bowlGradientId})`}
            opacity="0.8"
          />

          {/* Frozen charge resting on the floor */}
          {isLoaded ? (
            <>
              <ellipse cx="260" cy="168" fill="#e3d7bd" rx="51" ry="12" />
              <ellipse cx="260" cy="165" fill="#f3ecdc" opacity="0.8" rx="34" ry="7" />
            </>
          ) : null}

          {/* Drive shaft + cutting blade */}
          <rect fill="#7c8b98" height="30" width="6" x="257" y="150" />
          <g opacity={isRunning ? "0.35" : "1"}>
            <path d="M255 148 L218 142 L216 150 L255 154 Z" fill="#dbe3ea" stroke="#475569" strokeWidth="1.2" />
            <path d="M265 152 L302 158 L304 150 L265 146 Z" fill="#aebcc8" stroke="#475569" strokeWidth="1.2" />
            <ellipse cx="260" cy="150" fill="#475569" rx="6.5" ry="3.5" />
          </g>

          {/* Blade sweep while grinding — the blade blurs into a disc */}
          {isRunning ? (
            <g className="animate-pulse">
              <ellipse cx="260" cy="150" fill="#86efac" opacity="0.16" rx="46" ry="10" />
              <ellipse cx="260" cy="150" fill="none" opacity="0.6" rx="46" ry="10" stroke="#86efac" strokeWidth="2.5" />
              <ellipse cx="260" cy="150" fill="none" opacity="0.3" rx="34" ry="7" stroke="#bbf7d0" strokeWidth="1.8" />
            </g>
          ) : null}

          {/* Cryogenic frost clinging to the lower wall */}
          {isLoaded ? <ellipse cx="260" cy="174" fill="#e0f2fe" opacity="0.42" rx="54" ry="11" /> : null}

          {/* Glass sheen + wall outline, drawn over the contents */}
          <path d="M214 124 L214 172" opacity="0.5" stroke="#ffffff" strokeLinecap="round" strokeWidth="4" />
          <path
            d="M202 112 L202 178 A58 15 0 0 0 318 178 L318 112"
            fill="none"
            stroke="#8fa1ae"
            strokeWidth="2"
          />

          {/* Jar rim */}
          <ellipse cx="260" cy="112" fill="#eef4f8" rx="58" ry="15" stroke="#7a909e" strokeWidth="2" />
        </g>

        {/* ── Cryogenic vapour escaping the lid port ──────── */}
        {isLoaded ? (
          <g opacity="0.6" stroke="#bae6fd" strokeLinecap="round" strokeWidth="2.2">
            <path d="M214 78 Q220 70 215 62" />
            <path d="M226 72 Q232 63 227 54" />
            <path d="M238 80 Q243 72 239 64" />
          </g>
        ) : null}

        {/* ── Lid ─────────────────────────────────────────── */}
        <g className="drop-shadow-[0_6px_12px_rgba(15,23,42,0.16)]">
          <path
            d="M196 102 L196 110 A64 16 0 0 0 324 110 L324 102"
            fill={`url(#${lidGradientId})`}
            stroke="#4a5b67"
            strokeWidth="1.6"
          />
          <ellipse cx="260" cy="102" fill={`url(#${lidGradientId})`} rx="64" ry="16" stroke="#4a5b67" strokeWidth="1.8" />
          <ellipse cx="260" cy="102" fill="none" opacity="0.55" rx="46" ry="11" stroke="#eef4f8" strokeWidth="1.2" />
          <rect fill="#647480" height="24" rx="7" stroke="#465660" strokeWidth="1.5" width="20" x="250" y="80" />
          <ellipse cx="260" cy="80" fill="#8b9aa5" rx="13" ry="4.5" stroke="#465660" strokeWidth="1.5" />

          {/* Cryogenic feed port */}
          <rect fill="#aebecb" height="14" rx="4" stroke="#4a5b67" strokeWidth="1.4" width="14" x="215" y="88" />
          <ellipse cx="222" cy="88" fill={isLoaded ? "#7dd3fc" : "#cbd5e1"} rx="9" ry="3.4" stroke="#4a5b67" strokeWidth="1.4" />
        </g>
        </g>
      </svg>
    </div>
  );
}
