export function PipetteIcon({ active = false, fillRatio, className = "" }: {
  active?: boolean;
  className?: string;
  fillRatio: number;
}) {
  const boundedFillRatio = Math.max(0, Math.min(1, fillRatio));
  const liquidHeight = 8.4 * boundedFillRatio;
  const liquidTop = 14.2 - liquidHeight;

  return (
    <svg
      aria-hidden="true"
      className={`${active ? "text-sky-700" : "text-slate-700"} ${className}`.trim()}
      fill="none"
      viewBox="0 0 24 24"
    >
      {/* Slender by design: a pipette is a thin drawn tube, so the barrel is
          outlined over a faint wash rather than filled as a solid slab. Only the
          grip is solid, which is how the knife and spatula are built too. */}
      <g transform="rotate(38 12 12)">
        <rect x="11.4" y="1.1" width="1.2" height="2.2" rx="0.6" fill="currentColor" opacity="0.85" />
        <rect x="10" y="2.9" width="4" height="1.8" rx="0.8" fill="currentColor" opacity="0.85" />

        <rect x="9.5" y="4.8" width="5" height="9.9" rx="1.6" fill="currentColor" opacity="0.14" />
        {/* The liquid is contents, not chrome: its colour says what is in the
            pipette, never whether the tool is selected — the same split the
            spatula overlay uses for its powder heap. */}
        {boundedFillRatio > 0 ? (
          <rect
            x="10.3"
            y={Math.max(5.3, liquidTop)}
            width="3.4"
            height={liquidHeight}
            rx="1"
            fill="#38bdf8"
            opacity="0.92"
          />
        ) : null}
        <rect x="9.5" y="4.8" width="5" height="9.9" rx="1.6" fill="none" stroke="currentColor" strokeWidth="0.9" />

        <path d="M9.9 14.7H14.1L12.3 21.6H11.7L9.9 14.7Z" fill="currentColor" opacity="0.14" />
        <path
          d="M9.9 14.7H14.1L12.3 21.6H11.7L9.9 14.7Z"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="0.9"
        />
      </g>
    </svg>
  );
}
