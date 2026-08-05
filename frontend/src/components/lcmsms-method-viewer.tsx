"use client";

import type { AcquisitionMethod, MrmTransition } from "@/types/workbench";

type Props = {
  error: string | null;
  isLoading: boolean;
  method: AcquisitionMethod | null;
};

const GLOSSARY: { term: string; explanation: string }[] = [
  {
    term: "Q1",
    explanation:
      "First quadrupole. It filters the precursor ion — the intact molecule as it leaves the source — and lets through only the selected m/z.",
  },
  {
    term: "Q3",
    explanation:
      "Third quadrupole. It filters one product ion, a fragment produced in the collision cell. The Q1 → Q3 pair is what makes a transition specific.",
  },
  {
    term: "Collision energy",
    explanation:
      "Voltage accelerating the precursor into the collision gas. Too low and the molecule does not fragment; too high and the chosen fragment is destroyed in turn.",
  },
  {
    term: "Dwell time",
    explanation:
      "Time spent measuring one transition per cycle. Longer dwell means a better signal-to-noise ratio, but fewer points across each chromatographic peak.",
  },
  {
    term: "Quantifier",
    explanation:
      "The most intense transition of a compound. Its area is the one used to compute the concentration.",
  },
  {
    term: "Qualifier",
    explanation:
      "A second transition of the same compound. It is not used to quantify: its ratio to the quantifier confirms the identity and exposes interferences.",
  },
];

function formatDuration(seconds: number): string {
  const wholeMinutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds - wholeMinutes * 60);
  return `${wholeMinutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

function ParameterRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="text-right font-mono text-[10px] text-slate-200">{value}</span>
    </div>
  );
}

function StatTile({
  label,
  testId,
  value,
}: {
  label: string;
  testId: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 font-mono text-sm text-cyan-200" data-testid={testId}>
        {value}
      </p>
    </div>
  );
}

function TransitionRow({ transition }: { transition: MrmTransition }) {
  const isQuantifier = transition.role === "quantifier";
  return (
    <tr className="border-b border-slate-800/70 last:border-0" data-testid="method-transition-row">
      <td className="py-1 pl-2 pr-1 text-slate-200">
        {transition.compoundLabel}
        {transition.compoundKind === "internal_standard" ? (
          <span className="ml-1 rounded bg-violet-500/20 px-1 text-[9px] text-violet-300">
            ISTD
          </span>
        ) : null}
      </td>
      <td className="px-1 py-1">
        <span
          className={`rounded px-1 text-[9px] ${
            isQuantifier ? "bg-cyan-500/20 text-cyan-300" : "bg-slate-700/60 text-slate-300"
          }`}
        >
          {isQuantifier ? "Quantifier" : "Qualifier"}
        </span>
      </td>
      <td className="px-1 py-1 text-right font-mono text-slate-300">
        {formatNumber(transition.q1Mz)}
      </td>
      <td className="px-1 py-1 text-right font-mono text-slate-300">
        {formatNumber(transition.q3Mz)}
      </td>
      <td className="px-1 py-1 text-center font-mono text-slate-400">
        {transition.polarity === "positive" ? "+" : "−"}
      </td>
      <td className="px-1 py-1 text-right font-mono text-slate-300">
        {formatNumber(transition.collisionEnergyV)}
      </td>
      <td className="px-1 py-1 text-right font-mono text-slate-300">
        {formatNumber(transition.dwellTimeMs)}
      </td>
      <td className="py-1 pl-1 pr-2 text-right font-mono text-slate-300">
        {formatDuration(transition.expectedRetentionTimeS)}
      </td>
    </tr>
  );
}

export function LcMsMsMethodViewer({ error, isLoading, method }: Props) {
  if (error !== null) {
    return (
      <div className="mt-3 rounded-xl border border-rose-900 bg-rose-950/40 p-3 text-xs text-rose-300">
        {error}
      </div>
    );
  }

  if (isLoading || method === null) {
    return (
      <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-400">
        Loading the method…
      </div>
    );
  }

  const compoundCount = new Set(method.transitions.map((t) => t.compoundId)).size;

  return (
    <section
      aria-label="Acquisition method details"
      className="mt-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-xs font-semibold text-slate-100">{method.name}</h4>
        <span className="font-mono text-[10px] text-cyan-300">v{method.version}</span>
        {method.isEducational ? (
          <span
            className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-300"
            data-testid="method-educational-badge"
          >
            Educational
          </span>
        ) : null}
        {method.isBuiltIn ? (
          <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[9px] uppercase tracking-wide text-slate-400">
            Built-in · read-only
          </span>
        ) : null}
      </div>

      <p className="mt-1.5 text-[10px] leading-relaxed text-amber-200/80" data-testid="method-provenance">
        {method.provenanceNote}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <StatTile
          label="Run duration"
          testId="method-runtime"
          value={formatDuration(method.runtimeS)}
        />
        <StatTile
          label="Compounds"
          testId="method-compound-count"
          value={String(compoundCount)}
        />
        <StatTile
          label="Transitions"
          testId="method-transition-count"
          value={String(method.transitions.length)}
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div
          className="rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-[10px]"
          data-testid="method-lc-parameters"
        >
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
            Liquid chromatography
          </p>
          <ParameterRow label="Column" value={method.liquidChromatography.columnLabel} />
          <ParameterRow
            label="Oven"
            value={`${formatNumber(method.liquidChromatography.columnTemperatureC)} °C`}
          />
          <ParameterRow
            label="Flow"
            value={`${formatNumber(method.liquidChromatography.flowMlPerMin)} mL/min`}
          />
          <ParameterRow label="Phase A" value={method.liquidChromatography.mobilePhaseA} />
          <ParameterRow label="Phase B" value={method.liquidChromatography.mobilePhaseB} />
          <ParameterRow
            label="Gradient"
            value={method.liquidChromatography.gradient
              .map((step) => `${formatDuration(step.timeS)} → ${step.mobilePhaseBPercent}% B`)
              .join(" · ")}
          />
        </div>

        <div
          className="rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-[10px]"
          data-testid="method-source-parameters"
        >
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
            Ion source
          </p>
          <ParameterRow label="Source" value={method.ionSource.sourceType} />
          <ParameterRow
            label="Spray voltage"
            value={`${formatNumber(method.ionSource.ionSprayVoltageV)} V`}
          />
          <ParameterRow
            label="Temperature"
            value={`${formatNumber(method.ionSource.sourceTemperatureC)} °C`}
          />
          <ParameterRow
            label="Nebulizer gas"
            value={`${formatNumber(method.ionSource.nebulizerGasPsi)} psi`}
          />
          <ParameterRow
            label="Heater gas"
            value={`${formatNumber(method.ionSource.heaterGasPsi)} psi`}
          />
          <ParameterRow
            label="Curtain gas"
            value={`${formatNumber(method.ionSource.curtainGasPsi)} psi`}
          />
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full min-w-[34rem] text-[10px]">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/60 text-[9px] uppercase tracking-wide text-slate-500">
              <th className="py-1 pl-2 pr-1 text-left font-medium">Compound</th>
              <th className="px-1 py-1 text-left font-medium">Role</th>
              <th className="px-1 py-1 text-right font-medium">Q1</th>
              <th className="px-1 py-1 text-right font-medium">Q3</th>
              <th className="px-1 py-1 text-center font-medium">Pol.</th>
              <th className="px-1 py-1 text-right font-medium">CE (V)</th>
              <th className="px-1 py-1 text-right font-medium">Dwell (ms)</th>
              <th className="py-1 pl-1 pr-2 text-right font-medium">RT</th>
            </tr>
          </thead>
          <tbody>
            {method.transitions.map((transition) => (
              <TransitionRow key={transition.id} transition={transition} />
            ))}
          </tbody>
        </table>
      </div>

      <div
        className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-2"
        data-testid="method-glossary"
      >
        <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
          Reading this method
        </p>
        <dl className="space-y-1.5">
          {GLOSSARY.map(({ term, explanation }) => (
            <div key={term}>
              <dt className="text-[10px] font-semibold text-cyan-300">{term}</dt>
              <dd className="text-[10px] leading-relaxed text-slate-400">{explanation}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
