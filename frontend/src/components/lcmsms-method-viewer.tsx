"use client";

import { formatDuration, formatNumber } from "@/lib/acquisition-method-format";
import { useT, type MessageKey } from "@/lib/i18n";
import type { AcquisitionMethod, MrmTransition } from "@/types/workbench";

type Props = {
  error: string | null;
  isLoading: boolean;
  method: AcquisitionMethod | null;
};

const GLOSSARY: { termKey: MessageKey; explanationKey: MessageKey }[] = [
  { termKey: "glossary.q1.term", explanationKey: "glossary.q1.explanation" },
  { termKey: "glossary.q3.term", explanationKey: "glossary.q3.explanation" },
  {
    termKey: "glossary.collisionEnergy.term",
    explanationKey: "glossary.collisionEnergy.explanation",
  },
  { termKey: "glossary.dwellTime.term", explanationKey: "glossary.dwellTime.explanation" },
  { termKey: "glossary.quantifier.term", explanationKey: "glossary.quantifier.explanation" },
  { termKey: "glossary.qualifier.term", explanationKey: "glossary.qualifier.explanation" },
];

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
  const t = useT();
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
          {isQuantifier ? t("method.quantifier") : t("method.qualifier")}
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
  const t = useT();
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
        {t("method.loading")}
      </div>
    );
  }

  const compoundCount = new Set(method.transitions.map((t) => t.compoundId)).size;

  return (
    <section
      aria-label={t("method.details")}
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
            {t("method.educational")}
          </span>
        ) : null}
        {method.isBuiltIn ? (
          <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[9px] uppercase tracking-wide text-slate-400">
            {t("method.builtInReadOnly")}
          </span>
        ) : null}
      </div>

      <p className="mt-1.5 text-[10px] leading-relaxed text-amber-200/80" data-testid="method-provenance">
        {method.provenanceNote}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <StatTile
          label={t("method.runDuration")}
          testId="method-runtime"
          value={formatDuration(method.runtimeS)}
        />
        <StatTile
          label={t("method.compounds")}
          testId="method-compound-count"
          value={String(compoundCount)}
        />
        <StatTile
          label={t("method.transitions")}
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
            {t("method.liquidChromatography")}
          </p>
          <ParameterRow label={t("method.column")} value={method.liquidChromatography.columnLabel} />
          <ParameterRow
            label={t("method.oven")}
            value={`${formatNumber(method.liquidChromatography.columnTemperatureC)} °C`}
          />
          <ParameterRow
            label={t("method.flow")}
            value={`${formatNumber(method.liquidChromatography.flowMlPerMin)} mL/min`}
          />
          <ParameterRow label={t("method.phaseA")} value={method.liquidChromatography.mobilePhaseA} />
          <ParameterRow label={t("method.phaseB")} value={method.liquidChromatography.mobilePhaseB} />
          <ParameterRow
            label={t("method.gradient")}
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
            {t("method.ionSource")}
          </p>
          <ParameterRow label={t("method.source")} value={method.ionSource.sourceType} />
          <ParameterRow
            label={t("method.sprayVoltage")}
            value={`${formatNumber(method.ionSource.ionSprayVoltageV)} V`}
          />
          <ParameterRow
            label={t("method.temperature")}
            value={`${formatNumber(method.ionSource.sourceTemperatureC)} °C`}
          />
          <ParameterRow
            label={t("method.nebulizerGas")}
            value={`${formatNumber(method.ionSource.nebulizerGasPsi)} psi`}
          />
          <ParameterRow
            label={t("method.heaterGas")}
            value={`${formatNumber(method.ionSource.heaterGasPsi)} psi`}
          />
          <ParameterRow
            label={t("method.curtainGas")}
            value={`${formatNumber(method.ionSource.curtainGasPsi)} psi`}
          />
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full min-w-[34rem] text-[10px]">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/60 text-[9px] uppercase tracking-wide text-slate-500">
              <th className="py-1 pl-2 pr-1 text-left font-medium">{t("method.compound")}</th>
              <th className="px-1 py-1 text-left font-medium">{t("method.role")}</th>
              <th className="px-1 py-1 text-right font-medium">Q1</th>
              <th className="px-1 py-1 text-right font-medium">Q3</th>
              <th className="px-1 py-1 text-center font-medium">{t("method.polarityShort")}</th>
              <th className="px-1 py-1 text-right font-medium">{t("method.collisionEnergyShort")}</th>
              <th className="px-1 py-1 text-right font-medium">{t("method.dwellShort")}</th>
              <th className="py-1 pl-1 pr-2 text-right font-medium">{t("method.retentionShort")}</th>
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
          {t("method.readingThisMethod")}
        </p>
        <dl className="space-y-1.5">
          {GLOSSARY.map(({ termKey, explanationKey }) => (
            <div key={termKey}>
              <dt className="text-[10px] font-semibold text-cyan-300">{t(termKey)}</dt>
              <dd className="text-[10px] leading-relaxed text-slate-400">{t(explanationKey)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
