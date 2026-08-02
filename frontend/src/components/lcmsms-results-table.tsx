"use client";

import type { InjectionMeasurement, SequenceRun } from "@/types/workbench";

const COMPOUND_LABELS: Record<string, string> = {
  boscalid: "Boscalide",
  fluxapyroxad: "Fluxapyroxad",
  captan: "Captane",
  dithianon: "Dithianon",
  acetamiprid: "Acétamipride",
  imidacloprid: "Imidaclopride",
  thiacloprid: "Thiaclopride",
  lambda_cyhalothrin: "Lambda-cyhalothrine",
  deltamethrin: "Deltaméthrine",
  chlorpyrifos_methyl: "Chlorpyrifos-méthyl",
  pyrimicarb: "Pyrimycarbe",
  spirotetramat: "Spirotétramate",
};

const ISTD_PHASE_LABELS: Record<string, string> = {
  pre_solvent: "avant acétonitrile ✓",
  pre_salts: "avant sels ✓",
  post_salts: "après sels ✗",
};

function relativeError(calculated: number | null, truth: number): number | null {
  if (calculated === null || truth === 0) return null;
  return ((calculated - truth) / truth) * 100;
}

type Props = {
  runs: SequenceRun[];
};

export function LcMsMsResultsTable({ runs }: Props) {
  if (runs.length === 0) {
    return (
      <p className="py-3 text-center text-xs text-slate-400">
        Aucune séquence lancée — placez des vials dans le rack et cliquez sur Run.
      </p>
    );
  }

  const latestRun = runs[runs.length - 1];

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        Séquence {latestRun.id} · {latestRun.injections.length} injection(s) · {latestRun.methodId}
      </p>
      {latestRun.injections.map((inj) => (
        <InjectionBlock key={inj.vialId} injection={inj} />
      ))}
    </div>
  );
}

function InjectionBlock({ injection }: { injection: InjectionMeasurement }) {
  const displayName = injection.sampleName || injection.vialLabel;
  if (injection.status === "no_extract_context") {
    return (
      <div className="rounded-[0.9rem] border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <span className="font-semibold">{displayName}</span> — pas d&apos;extrait (slot{" "}
        {injection.rackSlotId}) · {injection.outputFilename}
      </div>
    );
  }

  if (injection.status === "calibration") {
    return <CalibrationBlock injection={injection} />;
  }

  const firstCompound = injection.compounds[0] ?? null;
  const istdPhase = firstCompound?.istdPhase ?? null;
  const istdApplied = firstCompound?.istdCorrectionApplied ?? false;

  return (
    <div className="overflow-hidden rounded-[0.9rem] border border-slate-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-1.5">
        <span className="text-xs font-semibold text-slate-700">{displayName}</span>
        <span className="text-[10px] text-slate-400">slot {injection.rackSlotId}</span>
        <IstdBadge applied={istdApplied} phase={istdPhase} />
      </div>
      <p className="border-b border-slate-100 px-3 py-1 font-mono text-[10px] text-slate-400">
        {injection.outputFilename} · {injection.injectionVolumeUl} µL · rep {injection.replicateIndex}
      </p>

      {/* Compounds */}
      {injection.compounds.length === 0 ? (
        <p className="px-3 py-2 text-xs text-slate-400">Aucun composé détecté.</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 text-[10px] text-slate-400">
              <th className="py-1 pl-3 pr-1 text-left font-medium">Composé</th>
              <th className="px-1 py-1 text-right font-medium">Mesuré (µg/kg)</th>
              <th className="px-1 py-1 text-right font-medium">Vrai (µg/kg)</th>
              <th className="py-1 pl-1 pr-3 text-right font-medium">Δ%</th>
            </tr>
          </thead>
          <tbody>
            {injection.compounds.map((c) => {
              const err = relativeError(c.calculatedConcUgPerKg, c.trueEffectiveUgPerKg);
              const errAbs = err !== null ? Math.abs(err) : null;
              const errClass =
                errAbs === null
                  ? "text-slate-300"
                  : errAbs <= 5
                    ? "text-emerald-600 font-semibold"
                    : errAbs <= 15
                      ? "text-amber-600 font-semibold"
                      : "text-rose-600 font-semibold";

              return (
                <tr key={c.compoundId} className="border-b border-slate-50 last:border-0">
                  <td className="py-1.5 pl-3 pr-1 font-medium text-slate-700">
                    {COMPOUND_LABELS[c.compoundId] ?? c.compoundId}
                  </td>
                  <td className="px-1 py-1.5 text-right text-slate-800">
                    {c.calculatedConcUgPerKg !== null
                      ? c.calculatedConcUgPerKg.toFixed(1)
                      : "—"}
                  </td>
                  <td className="px-1 py-1.5 text-right text-slate-400">
                    {c.trueEffectiveUgPerKg.toFixed(1)}
                  </td>
                  <td className={`py-1.5 pl-1 pr-3 text-right ${errClass}`}>
                    {err !== null ? `${err > 0 ? "+" : ""}${err.toFixed(1)}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function CalibrationBlock({ injection }: { injection: InjectionMeasurement }) {
  const level = injection.compounds[0]?.nominalConcNgPerMl ?? null;
  return (
    <div className="overflow-hidden rounded-[0.9rem] border border-rose-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-rose-100 bg-rose-50 px-3 py-1.5">
        <span className="text-xs font-semibold text-rose-700">
          {injection.sampleName || injection.vialLabel}
        </span>
        <span className="text-[10px] text-slate-400">slot {injection.rackSlotId}</span>
        <span className="rounded-full border border-rose-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-rose-700">
          CAL {level !== null ? `${level} ng/mL` : ""}
        </span>
      </div>
      <p className="border-b border-rose-100 px-3 py-1 font-mono text-[10px] text-slate-400">
        {injection.outputFilename} · {injection.injectionVolumeUl} µL · rep {injection.replicateIndex}
      </p>
      {injection.compounds.length === 0 ? (
        <p className="px-3 py-2 text-xs text-slate-400">Aucun composé.</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 text-[10px] text-slate-400">
              <th className="py-1 pl-3 pr-1 text-left font-medium">Composé</th>
              <th className="py-1 pl-1 pr-3 text-right font-medium">Signal (u.a.)</th>
            </tr>
          </thead>
          <tbody>
            {injection.compounds.map((c) => (
              <tr key={c.compoundId} className="border-b border-slate-50 last:border-0">
                <td className="py-1.5 pl-3 pr-1 font-medium text-slate-700">
                  {COMPOUND_LABELS[c.compoundId] ?? c.compoundId}
                </td>
                <td className="py-1.5 pl-1 pr-3 text-right text-rose-700">
                  {c.pesticideSignal.toFixed(4)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function IstdBadge({
  applied,
  phase,
}: {
  applied: boolean;
  phase: "pre_solvent" | "pre_salts" | "post_salts" | null;
}) {
  if (!applied) {
    return (
      <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
        Sans ISTD
      </span>
    );
  }
  const label = phase ? ISTD_PHASE_LABELS[phase] ?? phase : "ISTD";
  const toneClass =
    phase === "post_salts"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${toneClass}`}>
      ISTD {label}
    </span>
  );
}
