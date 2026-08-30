"use client";

import { useEffect, useRef, useState } from "react";
import type { DragEvent, PointerEventHandler, ReactNode } from "react";

import { WorkspaceEquipmentWidget } from "@/components/workspace-equipment-widget";
import { useT } from "@/lib/i18n";

type GrossBalanceWidgetProps = {
  headerAction?: ReactNode;
  isDropHighlighted: boolean;
  measuredGrossMassG: number | null;
  netMassG: number | null;
  grossMassOffsetG: number;
  onCommitOffset: (nextOffsetG: number) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  stagedContent?: ReactNode;
};

const holdDelayMs = 300;
const repeatIntervalMs = 80;

export function GrossBalanceWidget({
  headerAction,
  isDropHighlighted,
  measuredGrossMassG,
  netMassG,
  grossMassOffsetG,
  onCommitOffset,
  onDragOver,
  onDrop,
  stagedContent,
}: GrossBalanceWidgetProps) {
  const t = useT();
  const holdTimeoutRef = useRef<number | null>(null);
  const holdIntervalRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const holdCommittedRef = useRef(false);
  const [displayOffsetG, setDisplayOffsetG] = useState(grossMassOffsetG);
  const displayOffsetRef = useRef(grossMassOffsetG);

  useEffect(() => {
    displayOffsetRef.current = grossMassOffsetG;
    setDisplayOffsetG(grossMassOffsetG);
  }, [grossMassOffsetG]);

  const clearHoldTimers = () => {
    if (holdTimeoutRef.current !== null) {
      window.clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }

    if (holdIntervalRef.current !== null) {
      window.clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  };

  useEffect(() => clearHoldTimers, []);

  const applyDelta = (delta: number) => {
    const nextOffset = Math.max(-100, Math.min(0, displayOffsetRef.current + delta));
    displayOffsetRef.current = nextOffset;
    setDisplayOffsetG(nextOffset);
  };

  const commitIfChanged = () => {
    if (displayOffsetRef.current !== grossMassOffsetG) {
      onCommitOffset(displayOffsetRef.current);
    }
  };

  const startHold = (delta: number, disabled: boolean): PointerEventHandler<HTMLButtonElement> => {
    return () => {
      if (disabled) {
        return;
      }

      suppressClickRef.current = false;
      holdCommittedRef.current = false;
      clearHoldTimers();
      holdTimeoutRef.current = window.setTimeout(() => {
        suppressClickRef.current = true;
        holdCommittedRef.current = true;
        applyDelta(delta);
        holdIntervalRef.current = window.setInterval(() => {
          applyDelta(delta);
        }, repeatIntervalMs);
      }, holdDelayMs);
    };
  };

  const stopHold: PointerEventHandler<HTMLButtonElement> = () => {
    clearHoldTimers();
    if (!holdCommittedRef.current) {
      return;
    }

    holdCommittedRef.current = false;
    commitIfChanged();
  };

  const handleClick = (delta: number) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    const currentOffset = displayOffsetRef.current;
    const nextOffset = Math.max(-100, Math.min(0, currentOffset + delta));
    if (nextOffset === currentOffset) {
      return;
    }

    displayOffsetRef.current = nextOffset;
    setDisplayOffsetG(nextOffset);
    onCommitOffset(nextOffset);
  };

  return (
    <WorkspaceEquipmentWidget
      bodyClassName="px-4 py-4"
      dataDropHighlighted={isDropHighlighted ? "true" : "false"}
      dropZoneTestId="gross-balance-dropzone"
      eyebrow={t("widget.gross_balance")}
      headerAction={headerAction}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="space-y-3">
        <div className="rounded-[1.25rem] border border-slate-200 bg-slate-950 px-4 py-4 text-center text-emerald-300">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em]">{t("grossBalance.gross")}</p>
          <p className="mt-2 font-mono text-3xl">
            {measuredGrossMassG === null ? "----.-" : measuredGrossMassG.toFixed(1)} g
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              aria-label={t("grossBalance.decreaseOffset")}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-lg font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={grossMassOffsetG <= -100}
              onClick={() => {
                handleClick(-1);
              }}
              onPointerCancel={stopHold}
              onPointerDown={startHold(-1, grossMassOffsetG <= -100)}
              onPointerLeave={stopHold}
              onPointerUp={stopHold}
              type="button"
            >
              -
            </button>
            <div className="min-w-24 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200/80">
                {t("grossBalance.offset")}
              </p>
              <p className="mt-1 font-mono text-lg">{displayOffsetG >= 0 ? `+${displayOffsetG}` : displayOffsetG} g</p>
            </div>
            <button
              aria-label={t("grossBalance.increaseOffset")}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-lg font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={grossMassOffsetG >= 0}
              onClick={() => {
                handleClick(1);
              }}
              onPointerCancel={stopHold}
              onPointerDown={startHold(1, grossMassOffsetG >= 0)}
              onPointerLeave={stopHold}
              onPointerUp={stopHold}
              type="button"
            >
              +
            </button>
          </div>
          <div className="mt-4 border-t border-emerald-500/20 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200/80">Net</p>
            <p className="mt-1 font-mono text-2xl text-emerald-100">
              {netMassG === null ? "----.-" : netMassG.toFixed(1)} g
            </p>
          </div>
        </div>
        <div className="min-h-24 rounded-[1rem] border border-dashed border-slate-300 bg-white/80 px-2 py-2">
          {stagedContent ?? (
            <div className="flex h-full min-h-20 items-center justify-center rounded-[0.85rem] bg-slate-50 text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
              {t("grossBalance.dropObject")}
            </div>
          )}
        </div>
      </div>
    </WorkspaceEquipmentWidget>
  );
}
