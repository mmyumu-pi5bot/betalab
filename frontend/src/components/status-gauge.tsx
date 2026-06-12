type StatusGaugeProps = {
  label: string;
  percent: number;
  tone: "amber" | "rose" | "violet";
  testId: string;
};

const fillClasses = {
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
} as const;

export function StatusGauge({ label, percent, tone, testId }: StatusGaugeProps) {
  const clampedPercent = Math.min(Math.max(percent, 0), 100);

  return (
    <div data-testid={testId}>
      <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
        <span>{label}</span>
        <span className="tabular-nums">{Math.round(clampedPercent)}%</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${fillClasses[tone]}`}
          style={{ width: `${clampedPercent}%` }}
        />
      </div>
    </div>
  );
}
