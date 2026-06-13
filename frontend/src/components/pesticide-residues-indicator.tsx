"use client";

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

type PesticideResiduesIndicatorProps = {
  residues: Record<string, number>;
  degradationFactors: Record<string, number>;
};

export function PesticideResiduesIndicator({ residues, degradationFactors }: PesticideResiduesIndicatorProps) {
  const entries = Object.entries(residues);
  if (entries.length === 0) return null;

  const lines = entries.map(([id, initial]) => {
    const factor = degradationFactors[id] ?? 1.0;
    const current = initial * Math.max(0, Math.min(1, factor));
    const label = COMPOUND_LABELS[id] ?? id;
    return `${label}: ${current.toFixed(1)} µg/kg`;
  });

  const tooltipText = lines.join("\n");

  return (
    <div
      aria-label={`${entries.length} résidu(s) pesticide — ${tooltipText}`}
      className="group relative inline-flex items-center gap-1 rounded-[0.75rem] border border-emerald-200 bg-emerald-50/80 px-1.5 py-1 text-[10px] font-semibold text-emerald-700"
      tabIndex={0}
    >
      <svg
        aria-hidden="true"
        className="h-3 w-3 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{entries.length}</span>
      <span
        className="pointer-events-none absolute bottom-[calc(100%+0.45rem)] left-1/2 z-10 -translate-x-1/2 rounded-md bg-slate-950 px-2 py-1.5 text-[10px] font-medium whitespace-pre text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
        role="tooltip"
      >
        {tooltipText}
      </span>
    </div>
  );
}
