"use client";

type VerticalProgressIndicatorProps = {
  ariaLabel: string;
  fillClassName: string;
  progress: number;
  testId: string;
  tooltip: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function VerticalProgressIndicator({
  ariaLabel,
  fillClassName,
  progress,
  testId,
  tooltip,
}: VerticalProgressIndicatorProps) {
  const normalizedProgress = clamp(progress, 0, 1);
  const fillHeight = Math.max(
    normalizedProgress * 100,
    normalizedProgress > 0 ? 10 : 0,
  );

  return (
    <div
      aria-label={ariaLabel}
      className="group relative inline-flex items-center rounded-[0.75rem] border border-slate-200 bg-slate-100/85 px-1 py-1"
      data-testid={testId}
      tabIndex={0}
    >
      <div className="relative flex h-8 w-3 items-end rounded-full border border-slate-300 bg-white p-[2px]">
        <div
          className={`w-full rounded-full transition-[height] duration-700 ${fillClassName}`}
          data-testid={`${testId}-fill`}
          style={{ height: `${fillHeight}%` }}
        />
      </div>
      <span
        className="pointer-events-none absolute bottom-[calc(100%+0.45rem)] left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-950 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
        role="tooltip"
      >
        {tooltip}
      </span>
    </div>
  );
}
