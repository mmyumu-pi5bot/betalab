"use client";

import { useEffect, useState } from "react";

import type {
  InjectionMeasurement,
  SequenceRun,
  TransitionTrace,
} from "@/types/workbench";

const CHART_WIDTH = 320;
const CHART_HEIGHT = 64;

type Props = {
  runs: SequenceRun[];
};

function formatDuration(seconds: number): string {
  const wholeMinutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds - wholeMinutes * 60);
  return `${wholeMinutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatMz(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

function buildPolylinePoints(trace: TransitionTrace): string {
  const { intensities, timesS } = trace;
  if (intensities.length === 0) return "";
  const maxIntensity = Math.max(...intensities);
  const maxTime = timesS[timesS.length - 1] || 1;
  const scale = maxIntensity > 0 ? maxIntensity : 1;
  return intensities
    .map((intensity, index) => {
      const x = (timesS[index] / maxTime) * CHART_WIDTH;
      const y = CHART_HEIGHT - (intensity / scale) * CHART_HEIGHT;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function traceWarning(trace: TransitionTrace): string | null {
  if (!trace.acquisition.matchedReferenceTransition) {
    return "No compound responds at this Q1/Q3 pair — the channel records baseline only.";
  }
  if (!trace.acquisition.acquiredInRetentionWindow) {
    return "The declared retention window does not cover the moment this compound elutes.";
  }
  return null;
}

function TransitionChromatogram({ trace }: { trace: TransitionTrace }) {
  const { transition } = trace;
  const apex = trace.intensities.length > 0 ? Math.max(...trace.intensities) : 0;
  const warning = traceWarning(trace);
  const isQuantifier = transition.role === "quantifier";

  return (
    <div
      className="rounded-[0.9rem] border border-slate-200 bg-white p-2"
      data-testid="transition-chromatogram"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <span className="text-xs font-semibold text-slate-700">
          {transition.compoundLabel}
        </span>
        <span className="font-mono text-[10px] text-slate-400">
          {formatMz(transition.q1Mz)} → {formatMz(transition.q3Mz)}
        </span>
        <span
          className={`rounded px-1 text-[9px] ${
            isQuantifier ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-600"
          }`}
        >
          {isQuantifier ? "Quantifier" : "Qualifier"}
        </span>
      </div>

      <svg
        aria-label={`Chromatogram for ${transition.id}`}
        className="mt-1 w-full"
        preserveAspectRatio="none"
        role="img"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      >
        <polyline
          fill="none"
          points={buildPolylinePoints(trace)}
          stroke={isQuantifier ? "#0284c7" : "#94a3b8"}
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="mt-1 flex items-baseline justify-between text-[9px] text-slate-400">
        <span>0:00</span>
        <span>
          apex{" "}
          <span className="font-mono text-slate-600" data-testid="trace-apex">
            {Math.round(apex)}
          </span>{" "}
          counts · dwell {trace.acquisition.dwellTimeMs} ms
        </span>
        <span>{formatDuration(trace.acquisition.runDurationS)}</span>
      </div>

      {warning !== null ? (
        <p
          className="mt-1 rounded bg-amber-50 px-1.5 py-1 text-[9px] leading-relaxed text-amber-700"
          data-testid="trace-warning"
        >
          {warning}
        </p>
      ) : null}
    </div>
  );
}

function InjectionPanel({ injection }: { injection: InjectionMeasurement }) {
  const displayName = injection.sampleName || injection.vialLabel;

  return (
    <div data-testid="injection-panel">
      <p className="text-[10px] text-slate-500">
        <span className="font-semibold text-slate-700">{displayName}</span> · slot{" "}
        {injection.rackSlotId} · {injection.injectionVolumeUl} µL · rep{" "}
        {injection.replicateIndex} ·{" "}
        <span className="font-mono">{injection.outputFilename}</span>
      </p>

      {injection.status === "no_extract_context" ? (
        <p className="mt-2 rounded-[0.9rem] border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
          This vial held no injectable content — every channel recorded baseline.
        </p>
      ) : null}

      {injection.traces.length === 0 ? (
        <p className="mt-2 text-xs text-slate-400">No trace recorded for this injection.</p>
      ) : (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {injection.traces.map((trace) => (
            <TransitionChromatogram key={trace.transition.id} trace={trace} />
          ))}
        </div>
      )}
    </div>
  );
}

export function LcMsMsRunResults({ runs }: Props) {
  const latestRun = runs.length > 0 ? runs[runs.length - 1] : null;
  const [selectedInjectionId, setSelectedInjectionId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedInjectionId(null);
  }, [latestRun?.id]);

  if (latestRun === null) {
    return (
      <p className="py-3 text-center text-xs text-slate-400">
        No sequence has been run yet — load the rack and launch an acquisition.
      </p>
    );
  }

  const selected =
    latestRun.injections.find((injection) => injection.id === selectedInjectionId) ??
    latestRun.injections[0];

  return (
    <div className="space-y-2">
      <p
        className="text-[10px] font-semibold uppercase tracking-wide text-slate-400"
        data-testid="run-summary"
      >
        Sequence {latestRun.id} · {latestRun.injections.length} injection
        {latestRun.injections.length > 1 ? "s" : ""} · {latestRun.methodSnapshot.name} v
        {latestRun.methodSnapshot.version}
      </p>

      {latestRun.injections.length > 1 ? (
        <div className="flex flex-wrap gap-1" role="tablist">
          {latestRun.injections.map((injection) => {
            const isSelected = injection.id === selected?.id;
            return (
              <button
                aria-selected={isSelected}
                className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
                  isSelected
                    ? "bg-sky-600 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
                key={injection.id}
                onClick={() => setSelectedInjectionId(injection.id)}
                role="tab"
                type="button"
              >
                {injection.sampleName || injection.vialLabel}
              </button>
            );
          })}
        </div>
      ) : null}

      {selected !== undefined ? <InjectionPanel injection={selected} /> : null}
    </div>
  );
}
