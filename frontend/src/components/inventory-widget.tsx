"use client";

import type { DragEventHandler, ReactNode } from "react";

import { dragAffordanceClassName } from "@/lib/drag-affordance";

import { ItemCountBadge } from "@/components/item-count-badge";

type InventoryWidgetProps = {
  ariaLabel?: string;
  buttonTestId: string;
  children?: ReactNode;
  count: number;
  countBadgeClassName?: string;
  countTestId: string;
  dataDropHighlighted?: "true" | "false";
  frameClassName?: string;
  icon: ReactNode;
  iconClassName?: string;
  isDropHighlighted?: boolean;
  isOpen: boolean;
  onDrop?: DragEventHandler<HTMLButtonElement>;
  onDragOver?: DragEventHandler<HTMLButtonElement>;
  onToggle: () => void;
  overlayTestId: string;
  overlayWidthClassName: string;
  title: string;
};

export function InventoryWidget({
  ariaLabel,
  buttonTestId,
  children,
  count,
  countBadgeClassName = "",
  countTestId,
  dataDropHighlighted,
  frameClassName = "",
  icon,
  iconClassName = "",
  isDropHighlighted = false,
  isOpen,
  onDrop,
  onDragOver,
  onToggle,
  overlayTestId,
  overlayWidthClassName,
  title,
}: InventoryWidgetProps) {
  return (
    <section className="relative overflow-visible">
      <div className="overflow-hidden rounded-[1.7rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(241,245,249,0.95))] shadow-[0_18px_40px_rgba(15,23,42,0.1)]">
        <div
          className={`${dragAffordanceClassName} border-b border-slate-200/80 bg-white/85 px-4 py-2 backdrop-blur`}
          data-widget-drag-handle="true"
        >
          <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-sky-700">
            {title}
          </p>
        </div>
        <div className="px-4 py-4">
          <button
            aria-label={ariaLabel}
            aria-expanded={isOpen}
            aria-haspopup="dialog"
            className={`flex min-h-32 w-full cursor-pointer items-center justify-center rounded-[1.2rem] border border-dashed bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),rgba(226,232,240,0.92))] px-3 py-4 text-center transition-colors ${
              isDropHighlighted
                ? "border-rose-300 bg-rose-50/70 ring-2 ring-rose-200/80"
                : "border-slate-300"
            } ${frameClassName}`.trim()}
            data-drop-highlighted={dataDropHighlighted}
            data-testid={buttonTestId}
            onClick={onToggle}
            onDragOver={onDragOver}
            onDrop={onDrop}
            type="button"
          >
            <div className={`relative inline-flex items-center justify-center ${iconClassName}`.trim()}>
              <ItemCountBadge
                className={countBadgeClassName}
                count={count}
                testId={countTestId}
              />
              {icon}
            </div>
          </button>
        </div>
      </div>
      {isOpen ? (
        <div
          className={`absolute left-0 top-full z-[220] mt-3 ${overlayWidthClassName}`.trim()}
          data-testid={overlayTestId}
        >
          <div
            className="w-full rounded-[1.4rem] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.18)]"
            role="dialog"
          >
            <div className="max-h-[28rem] overflow-y-auto p-3">
              {children}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
