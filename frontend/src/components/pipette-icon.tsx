export function PipetteIcon({ active = false, fillRatio, className = "" }: {
  active?: boolean;
  className?: string;
  fillRatio: number;
}) {
  const boundedFillRatio = Math.max(0, Math.min(1, fillRatio));
  const liquidHeight = 7.4 * boundedFillRatio;
  const liquidTop = 12.1 - liquidHeight;

  return (
    <svg
      aria-hidden="true"
      className={`${active ? "text-sky-700" : "text-slate-700"} ${className}`.trim()}
      fill="none"
      viewBox="0 0 24 24"
    >
      <g transform="rotate(38 12 12)">
        <rect x="9" y="2" width="6" height="4" rx="1.2" fill="currentColor" opacity="0.25" />
        <rect x="8" y="5" width="8" height="10" rx="2" fill="white" stroke="currentColor" strokeWidth="1.3" />
        {boundedFillRatio > 0 ? (
          <rect
            x="9"
            y={Math.max(5.4, liquidTop)}
            width="6"
            height={liquidHeight}
            rx="1.2"
            fill={active ? "#38bdf8" : "#7dd3fc"}
            opacity="0.92"
          />
        ) : null}
        <rect x="9.7" y="7" width="4.6" height="5.5" rx="1" fill="white" opacity="0.28" />
        <path d="M10.5 15h3L12.8 21h-1.6l-.7-6Z" fill="currentColor" opacity="0.8" />
      </g>
    </svg>
  );
}
