"use client";

import type { ReactNode } from "react";

type EquipmentCardHeaderProps = {
  action?: ReactNode;
  badge?: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  leading?: ReactNode;
  title?: ReactNode;
  variant?: "compact" | "widget";
};

export function EquipmentCardHeader({
  action,
  badge,
  description,
  eyebrow,
  leading,
  title,
  variant = "widget",
}: EquipmentCardHeaderProps) {
  if (variant === "compact") {
    return (
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {leading ? <div className="shrink-0">{leading}</div> : null}
          <div className="min-w-0">
            {eyebrow ? (
              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">
                {eyebrow}
              </p>
            ) : null}
            {title ? <div className="truncate text-sm font-semibold text-slate-950">{title}</div> : null}
            {description ? (
              <div className="mt-1 truncate text-xs text-slate-500">{description}</div>
            ) : null}
          </div>
        </div>
        {action ?? badge ?? null}
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-2.5">
      <div>
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700">
            {eyebrow}
          </p>
        ) : null}
        {title ? <div className="mt-0.5 text-base font-semibold text-slate-950 xl:text-lg">{title}</div> : null}
        {description ? (
          <div className="mt-1 max-w-lg text-xs text-slate-600">{description}</div>
        ) : null}
      </div>
      {action ?? badge ?? null}
    </div>
  );
}
