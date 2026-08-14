"use client";

import type { DragEvent, ReactNode } from "react";

import { EquipmentCardHeader } from "@/components/equipment-card-header";
import { dragAffordanceClassName } from "@/lib/drag-affordance";

type WorkspaceEquipmentWidgetProps = {
  badge?: string;
  bodyClassName?: string;
  children: ReactNode;
  dataDropHighlighted?: "true" | "false";
  description?: string;
  dropZoneTestId?: string;
  eyebrow: string;
  footer?: string;
  headerAction?: ReactNode;
  onDragOver?: (event: DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: DragEvent<HTMLDivElement>) => void;
  title?: string;
};

export function WorkspaceEquipmentWidget({
  badge,
  bodyClassName,
  children,
  dataDropHighlighted = "false",
  description,
  dropZoneTestId,
  eyebrow,
  footer,
  headerAction,
  onDragOver,
  onDrop,
  title,
}: WorkspaceEquipmentWidgetProps) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(241,245,249,0.95))] shadow-[0_18px_40px_rgba(15,23,42,0.1)]">
      <div
        className={`${dragAffordanceClassName} border-b border-slate-200/80 bg-white/85 px-3.5 py-1.5 backdrop-blur xl:px-4 xl:py-1.5`}
        data-widget-drag-handle="true"
      >
        <EquipmentCardHeader
          action={headerAction}
          badge={
            badge ? (
              <span className="rounded-full border border-slate-200 bg-slate-950 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
                {badge}
              </span>
            ) : undefined
          }
          description={description}
          eyebrow={eyebrow}
          title={title}
        />
      </div>

      <div className={bodyClassName ?? "px-4 py-4 xl:px-5 xl:py-5"}>
        <div
          className={`rounded-[1.8rem] border bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.9),rgba(241,245,249,0.95))] p-3 shadow-inner transition-colors ${
            dataDropHighlighted === "true"
              ? "border-sky-300 ring-2 ring-sky-200/80"
              : "border-slate-200/80"
          }`}
          data-drop-highlighted={dataDropHighlighted}
          data-testid={dropZoneTestId}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          {children}
        </div>
        {footer ? <p className="mt-3 text-sm text-slate-600">{footer}</p> : null}
      </div>
    </section>
  );
}
