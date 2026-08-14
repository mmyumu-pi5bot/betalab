"use client";

import { buildEquipmentIllustrationSurface } from "@/components/illustrations/equipment-illustration-surface";

type CryogenicGrinderIllustrationProps = {
  className?: string;
  onPowerClick?: () => void;
  powerButtonDisabled?: boolean;
  powerButtonLabel?: string;
  powerButtonTestId?: string;
  status?: "idle" | "ready" | "running";
  testId?: string;
};

export function CryogenicGrinderIllustration({
  className,
  onPowerClick,
  powerButtonDisabled = false,
  powerButtonLabel = "Start grinder",
  powerButtonTestId,
  status = "idle",
  testId,
}: CryogenicGrinderIllustrationProps) {
  const isRunning = status === "running";
  const isReady = status === "ready";
  const { defs: surfaceDefs, surface } = buildEquipmentIllustrationSurface({
    height: 340,
    idPrefix: testId ?? "cryogenic-grinder-illustration",
    radius: 30,
    width: 520,
  });
  const accentFill = isRunning ? "#22c55e" : isReady ? "#f59e0b" : "#94a3b8";
  const panelGlow = isRunning
    ? "drop-shadow-[0_0_18px_rgba(34,197,94,0.45)]"
    : isReady
      ? "drop-shadow-[0_0_14px_rgba(245,158,11,0.34)]"
      : "";
  const powerButtonToneClassName = isRunning
    ? "border-red-600 bg-red-600 text-white"
    : isReady
      ? "border-red-300 bg-red-100 text-red-700 shadow-[0_10px_24px_rgba(239,68,68,0.2)] hover:border-red-400 hover:bg-red-200 hover:text-red-800"
      : "border-red-200 bg-red-100 text-red-400";

  return (
    <div
      aria-label="Cryogenic grinder illustration"
      className={`relative ${className ?? ""}`}
      data-status={status}
      data-testid={testId}
    >
      <button
        aria-label={powerButtonLabel}
        aria-pressed={isRunning}
        className={`absolute right-[5.85rem] top-[4.78rem] z-10 flex h-[2.6rem] w-[2.6rem] items-center justify-center rounded-[0.82rem] border transition ${
          powerButtonDisabled ? "cursor-not-allowed opacity-70" : "active:scale-[0.97]"
        } ${powerButtonToneClassName}`}
        data-testid={powerButtonTestId}
        data-tutorial-anchor="grinder-power-button"
        disabled={powerButtonDisabled}
        onClick={onPowerClick}
        type="button"
      >
        <svg
          aria-hidden="true"
          className={`h-6 w-6 ${isRunning ? "animate-pulse" : ""}`}
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
        viewBox="0 0 520 340"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {surfaceDefs}
          <linearGradient id="grinder-body" x1="120" x2="404" y1="84" y2="278" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f4f7fa" offset="0" />
            <stop stopColor={isRunning ? "#9aa8b4" : "#b5c1ca"} offset="1" />
          </linearGradient>
          <linearGradient id="grinder-lid" x1="0" x2="0" y1="78" y2="152" gradientUnits="userSpaceOnUse">
            <stop stopColor="#748390" offset="0" />
            <stop stopColor="#4a5b67" offset="1" />
          </linearGradient>
          <linearGradient id="grinder-screen" x1="0" x2="0" y1="182" y2="262" gradientUnits="userSpaceOnUse">
            <stop stopColor={isRunning ? "#d9fff0" : "#daf7ff"} offset="0" />
            <stop stopColor={isRunning ? "#8df0c2" : "#8cdcf7"} offset="1" />
          </linearGradient>
        </defs>

        {surface}

        <g className="drop-shadow-[0_18px_34px_rgba(15,23,42,0.18)]">
          <rect
            x="120"
            y="92"
            width="282"
            height="214"
            rx="18"
            fill="url(#grinder-body)"
            stroke="#617584"
            strokeWidth="3"
          />
          <path
            d="M158 82H362C375 82 386 93 386 106V128H134V106C134 93 145 82 158 82Z"
            fill="url(#grinder-lid)"
          />
          <rect x="150" y="70" width="220" height="34" rx="12" fill="#647480" stroke="#465660" strokeWidth="2.5" />
          <path
            d="M236 48H284L274 82H246Z"
            fill="#90a0ab"
            stroke="#60717d"
            strokeWidth="2.5"
          />
          <ellipse cx="260" cy="46" rx="26" ry="6" fill="#5a6872" />
          <ellipse cx="260" cy="46" rx="17" ry="3.5" fill="#36434c" />

          <rect
            x="133"
            y="108"
            width="256"
            height="188"
            rx="12"
            fill="#eef3f7"
            stroke="#c7d1d8"
            strokeWidth="2"
          />

          <ellipse cx="236" cy="170" rx="62" ry="18" fill="#e8eef3" stroke="#758796" strokeWidth="3" />
          <rect x="174" y="170" width="124" height="82" fill="#d6dfe6" stroke="#758796" strokeWidth="3" />
          <ellipse cx="236" cy="252" rx="62" ry="18" fill="#9aaab6" stroke="#758796" strokeWidth="3" />
          <ellipse
            cx="236"
            cy="170"
            rx="44"
            ry="10"
            fill={isRunning ? "#6ee7b7" : "#7ad8f6"}
            opacity={isRunning ? "0.35" : "0.25"}
          />

          {isRunning ? (
            <>
              <path d="M203 182C216 169 236 165 253 172" stroke="#0f172a" strokeLinecap="round" strokeWidth="4" />
              <path d="M201 208C217 195 238 192 262 204" stroke="#0ea5e9" strokeLinecap="round" strokeWidth="5" />
              <path d="M196 228C216 217 241 216 268 226" stroke="#22c55e" strokeLinecap="round" strokeWidth="4.5" />
            </>
          ) : (
            <path
              d="M205 198H265"
              stroke={isReady ? "#f59e0b" : "#38bdf8"}
              strokeLinecap="round"
              strokeWidth="6"
            />
          )}

          <rect
            x="302"
            y="184"
            width="120"
            height="90"
            rx="12"
            fill="#dde5eb"
            stroke="#8fa1ae"
            strokeWidth="3"
          />
          <rect x="314" y="196" width="96" height="56" rx="8" fill="url(#grinder-screen)" stroke="#6f8d9e" strokeWidth="2" />
          <path
            d="M324 232C338 216 353 227 366 211C380 196 390 236 402 220"
            fill="none"
            stroke="#2f738d"
            strokeLinecap="round"
            strokeWidth="3"
          />

          <g className={panelGlow}>
            <circle cx="334" cy="263" fill={accentFill} r="5.5" />
            <circle cx="354" cy="263" fill={isRunning ? "#ffd15a" : "#cbd5e1"} r="5.5" />
            <circle cx="374" cy="263" fill="#e88686" r="5.5" />
          </g>

          <rect x="150" y="280" width="164" height="30" rx="8" fill="#dbe3e9" stroke="#9baeba" strokeWidth="2.5" />
          <rect x="158" y="286" width="132" height="18" rx="6" fill="#fbfdff" />
          <rect x="295" y="289" width="14" height="10" rx="3" fill="#94a8b5" />
          <rect x="166" y="312" width="38" height="12" rx="5" fill="#556671" />
          <rect x="320" y="312" width="38" height="12" rx="5" fill="#556671" />
        </g>
      </svg>
    </div>
  );
}
