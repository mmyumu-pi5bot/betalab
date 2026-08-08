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
      {/* The original silhouette, slimmed: the barrel is 6 wide instead of 8 and
          drawn as an outlined tube rather than a solid slab. Only the tip stays
          opaque — it is moulded plastic, and it keeps the icon anchored at small
          sizes. Same construction as the knife and spatula: solid grip, drawn
          working end. */}
      <g transform="rotate(38 12 12)">
        <rect x="9.75" y="2" width="4.5" height="4" rx="1.2" fill="currentColor" opacity="0.85" />
        <rect x="9" y="5" width="6" height="10" rx="1.8" fill="currentColor" opacity="0.16" />
        {/* The liquid is contents, not chrome: its colour says what is in the
            pipette, never whether the tool is selected — the same split the
            spatula overlay uses for its powder heap. */}
        {boundedFillRatio > 0 ? (
          <rect
            x="9.9"
            y={Math.max(5.4, liquidTop)}
            width="4.2"
            height={liquidHeight}
            rx="1"
            fill="#38bdf8"
            opacity="0.92"
          />
        ) : null}
        <rect x="9" y="5" width="6" height="10" rx="1.8" fill="none" stroke="currentColor" strokeWidth="0.9" />
        <path d="M10.5 15h3L12.8 21h-1.6l-.7-6Z" fill="currentColor" opacity="0.8" />
      </g>
    </svg>
  );
}
