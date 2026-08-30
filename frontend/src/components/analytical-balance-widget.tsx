"use client";

import type { DragEvent, ReactNode } from "react";

import { WorkspaceEquipmentWidget } from "@/components/workspace-equipment-widget";
import { useT } from "@/lib/i18n";

type AnalyticalBalanceWidgetProps = {
  headerAction?: ReactNode;
  isDropHighlighted: boolean;
  measuredMassG: number | null;
  netMassG: number | null;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onTare: () => void;
  stagedContent?: ReactNode;
  tareMassG: number | null;
};

const analyticalBalanceMaxG = 220;
const targetMaxG = 10.2;

export function AnalyticalBalanceWidget({
  headerAction,
  isDropHighlighted,
  measuredMassG,
  netMassG,
  onDragOver,
  onDrop,
  onTare,
  stagedContent,
  tareMassG,
}: AnalyticalBalanceWidgetProps) {
  const t = useT();
  const isOverload = measuredMassG !== null && measuredMassG > analyticalBalanceMaxG;
  const isTargetExceeded = netMassG !== null && netMassG > targetMaxG;
  const displayText = isOverload
    ? "L-O-A-D"
    : measuredMassG === null
      ? "0.000"
      : measuredMassG.toFixed(3);
  const netText =
    isOverload || tareMassG === null || netMassG === null
      ? "---"
      : netMassG.toFixed(3);

  return (
    <WorkspaceEquipmentWidget
      bodyClassName="px-4 py-4"
      dataDropHighlighted={isDropHighlighted ? "true" : "false"}
      dropZoneTestId="analytical-balance-dropzone"
      eyebrow={t("widget.analytical_balance")}
      headerAction={headerAction}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="space-y-3">
        <div className="rounded-[1.25rem] border border-slate-200 bg-slate-950 px-4 py-4 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
            {t("analyticalBalance.mass")}
          </p>
          <p
            className={`mt-2 font-mono text-3xl ${
              isOverload
                ? "animate-pulse text-rose-300"
                : isTargetExceeded
                  ? "text-amber-300"
                  : "text-emerald-300"
            }`}
          >
            {displayText}
            {isOverload ? "" : " g"}
          </p>
          <div className="mt-4">
            <button
              className="w-full rounded-full border border-slate-600 bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-100 transition hover:border-slate-400"
              onClick={onTare}
              data-tutorial-anchor="analytical-balance-tare"
              type="button"
            >
              {t("analyticalBalance.tare")}
            </button>
          </div>
          <div className="mt-4 border-t border-emerald-500/20 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200/80">
              {t("analyticalBalance.net")}
            </p>
            <p className={`mt-1 font-mono text-2xl ${isTargetExceeded ? "text-amber-300" : "text-emerald-100"}`}>
              {netText}
              {netText === "---" ? "" : " g"}
            </p>
          </div>
        </div>
        <div className="min-h-24 rounded-[1rem] border border-dashed border-slate-300 bg-white/80 px-2 py-2">
          {stagedContent ?? (
            <div className="flex h-full min-h-20 items-center justify-center rounded-[0.85rem] bg-slate-50 text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
              {t("analyticalBalance.dropTube")}
            </div>
          )}
        </div>
      </div>
    </WorkspaceEquipmentWidget>
  );
}
