"use client";

import { VerticalProgressIndicator } from "@/components/vertical-progress-indicator";

type CementationIndicatorProps = {
  progress: number;
  testId: string;
};

export function CementationIndicator({
  progress,
  testId,
}: CementationIndicatorProps) {
  const percent = Math.round(Math.min(Math.max(progress, 0), 1) * 100);

  return (
    <div
      className="flex items-center justify-between gap-2"
      data-testid={testId}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
        Cementation
      </span>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-semibold tabular-nums text-amber-700">
          {percent}%
        </span>
        <VerticalProgressIndicator
          ariaLabel={`Cementation ${percent}%`}
          fillClassName={
            percent >= 100
              ? "bg-[linear-gradient(180deg,#fda4af_0%,#f43f5e_55%,#be123c_100%)]"
              : "bg-[linear-gradient(180deg,#fde68a_0%,#f59e0b_55%,#b45309_100%)]"
          }
          progress={progress}
          testId={`${testId}-indicator`}
          tooltip={`Cementation ${percent}%`}
        />
      </div>
    </div>
  );
}
