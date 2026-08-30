"use client";

import { useT } from "@/lib/i18n";

type SampleIdentityLabelProps = {
  matrix?: string;
  receivedDate?: string | null;
  sampleCode: string;
  variant?: "compact" | "ticket";
};

function buildBarcodePattern(sampleCode: string) {
  return sampleCode.split("").map((character, index) => {
    const seed = character.charCodeAt(0) + index * 7;
    return {
      key: `${character}-${index}`,
      width: 2 + (seed % 4),
    };
  });
}

export function SampleIdentityLabel({
  matrix = "APPLE",
  receivedDate = null,
  sampleCode,
  variant = "compact",
}: SampleIdentityLabelProps) {
  const t = useT();
  const barcodePattern = buildBarcodePattern(sampleCode);
  const isTicket = variant === "ticket";

  return (
    <div
      className={`rounded-[0.95rem] border border-sky-200 bg-white ${
        isTicket ? "px-3 py-2.5 shadow-sm" : "px-2.5 py-2"
      }`}
    >
      <div className="rounded-[0.55rem] border border-slate-200 bg-slate-50 px-2 py-1">
        <div className="flex h-8 items-end gap-[2px]">
          {barcodePattern.map((bar, index) => (
            <span
              className="bg-slate-950"
              key={bar.key}
              style={{
                width: `${bar.width}px`,
                height: `${16 + ((index * 11 + bar.width) % 12)}px`,
              }}
            />
          ))}
        </div>
      </div>
      <div className="mt-2 space-y-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {t("sampleLabel.sampleId")}
        </p>
        <p className="text-sm font-semibold text-slate-950">{sampleCode}</p>
        <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
          <span>{matrix}</span>
          <span>{receivedDate ? `REC ${receivedDate}` : "REC --"}</span>
        </div>
      </div>
    </div>
  );
}
