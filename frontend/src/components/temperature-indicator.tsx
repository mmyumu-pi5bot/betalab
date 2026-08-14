"use client";

type TemperatureIndicatorProps = {
  temperatureC: number;
  tutorialAnchor?: string;
};

const ambientTemperatureC = 20;
const cryogenicTemperatureC = -78.5;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getCryogenicStatus(temperatureC: number) {
  if (temperatureC >= 55) {
    return { label: "Hot", toneClassName: "text-rose-700" };
  }

  if (temperatureC >= 30) {
    return { label: "Warm", toneClassName: "text-amber-700" };
  }

  if (temperatureC <= -45) {
    return { label: "Cryogenic", toneClassName: "text-sky-700" };
  }

  if (temperatureC <= -5) {
    return { label: "Cooling fast", toneClassName: "text-cyan-700" };
  }

  return { label: "Near ambient", toneClassName: "text-slate-600" };
}

export function TemperatureIndicator({ temperatureC, tutorialAnchor }: TemperatureIndicatorProps) {
  const normalizedFill = clamp(
    (temperatureC - cryogenicTemperatureC) / (ambientTemperatureC - cryogenicTemperatureC),
    0,
    1,
  );
  const { label, toneClassName } = getCryogenicStatus(temperatureC);
  const formattedTemperature = `${temperatureC.toFixed(1)}°C`;
  const tooltipLabel = `${label} • ${temperatureC.toFixed(1)} C`;

  return (
    <div
      aria-label={tooltipLabel}
      className="group relative inline-flex items-center gap-0 rounded-[0.75rem] border border-sky-100 bg-sky-50/80 px-1 py-1"
      tabIndex={0}
      data-tutorial-anchor={tutorialAnchor}
    >
      <div className="relative flex h-8 w-3 items-end rounded-full border border-slate-300 bg-white p-[2px]">
        <div
          className="w-full rounded-full bg-[linear-gradient(180deg,#f59e0b_0%,#22d3ee_45%,#0284c7_100%)] transition-[height] duration-700"
          data-testid="temperature-indicator-fill"
          style={{ height: `${Math.max(normalizedFill * 100, 10)}%` }}
        />
        <span className="absolute -bottom-1 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border border-slate-300 bg-sky-500" />
      </div>
      <p className={`-ml-2.5 w-[2.9rem] text-[10px] font-semibold tabular-nums text-right ${toneClassName}`}>
        {formattedTemperature}
      </p>
      <span
        className="pointer-events-none absolute bottom-[calc(100%+0.45rem)] left-1/2 z-10 -translate-x-1/2 rounded-md bg-slate-950 px-2 py-1 text-[10px] font-medium whitespace-nowrap text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
        role="tooltip"
      >
        {tooltipLabel}
      </span>
    </div>
  );
}
