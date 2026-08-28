import {
  getContainerLiquidVisualState,
  neutralLiquidPalette,
} from "@/lib/liquid-visuals";
import type { BenchLiquidPortion } from "@/types/workbench";

import { buildEquipmentIllustrationSurface } from "@/components/illustrations/equipment-illustration-surface";
import { translateNow } from "@/lib/i18n";

type AutosamplerRackIllustrationProps = {
  className?: string;
  occupiedSlotLiquids?: Partial<Record<number, BenchLiquidPortion[]>>;
  occupiedSlots?: number[];
  /** Occupied positions whose vial is uncapped. Drawn as an open mouth. */
  openSlots?: number[];
  slotCount?: number;
  testId?: string;
  tone?: "neutral" | "active";
};

const rackPalette = {
  active: {
    frame: "#0f172a",
    panel: "#e2e8f0",
    tray: "#f8fafc",
    slot: "#94a3b8",
    liquid: "#38bdf8",
    accent: "#0ea5e9",
    label: "#334155",
  },
  neutral: {
    frame: "#334155",
    panel: "#e2e8f0",
    tray: "#ffffff",
    slot: "#cbd5e1",
    liquid: "#94a3b8",
    accent: "#64748b",
    label: "#475569",
  },
} as const;

export function AutosamplerRackIllustration({
  className,
  occupiedSlotLiquids,
  occupiedSlots = [],
  openSlots = [],
  slotCount = 12,
  testId,
  tone = "neutral",
}: AutosamplerRackIllustrationProps) {
  const palette = rackPalette[tone];
  const { defs: surfaceDefs, surface } = buildEquipmentIllustrationSurface({
    height: 290,
    idPrefix: testId ?? "autosampler-rack-illustration",
    radius: 36,
    width: 480,
    x: 40,
    y: 20,
  });
  const occupiedSet = new Set(
    occupiedSlots.filter((slotNumber) => Number.isInteger(slotNumber) && slotNumber >= 1),
  );
  const openSet = new Set(openSlots);
  const slots = Array.from({ length: slotCount }, (_, index) => index + 1);
  const columns = Math.min(4, Math.max(slotCount, 1));
  const baseX = 182;
  const baseY = 111;
  const slotGapX = 61;
  const slotGapY = 49;

  return (
    <div
      aria-label={translateNow("illustration.rack")}
      className={className}
      data-occupied-count={occupiedSet.size}
      data-slot-count={slotCount}
      data-testid={testId}
      data-tone={tone}
    >
      <svg
        className="h-full w-full"
        fill="none"
        viewBox="40 20 480 290"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {surfaceDefs}
          <linearGradient id="rack-plate" x1="120" x2="440" y1="70" y2="300" gradientUnits="userSpaceOnUse">
            <stop stopColor="#eef3f7" offset="0" />
            <stop stopColor="#c5d0d8" offset="1" />
          </linearGradient>
          <linearGradient id="rack-well" x1="0" x2="0" y1="86" y2="254" gradientUnits="userSpaceOnUse">
            <stop stopColor="#dfe7ed" offset="0" />
            <stop stopColor="#b7c3cc" offset="1" />
          </linearGradient>
          <linearGradient id="rack-cap" x1="0" x2="0" y1="90" y2="250" gradientUnits="userSpaceOnUse">
            <stop stopColor="#616f79" offset="0" />
            <stop stopColor="#45525b" offset="1" />
          </linearGradient>
          <linearGradient id="rack-glass" x1="0" x2="0" y1="102" y2="240" gradientUnits="userSpaceOnUse">
            <stop stopColor="#eefcff" offset="0" />
            <stop stopColor="#bfe8f0" offset="1" />
          </linearGradient>
        </defs>

        {surface}
        <rect
          fill="url(#rack-plate)"
          height="188"
          rx="24"
          stroke={palette.frame}
          strokeWidth="5"
          width="328"
          x="116"
          y="68"
        />
        <rect
          fill={palette.panel}
          height="140"
          rx="18"
          stroke="#93a4ae"
          strokeWidth="3"
          width="270"
          x="145"
          y="90"
        />
        <rect
          fill={palette.panel}
          height="62"
          rx="10"
          stroke="#8798a3"
          strokeWidth="3"
          width="18"
          x="99"
          y="131"
        />
        <rect
          fill={palette.panel}
          height="62"
          rx="10"
          stroke="#8798a3"
          strokeWidth="3"
          width="18"
          x="443"
          y="131"
        />
        <rect fill="#c5d0d8" height="124" opacity="0.9" rx="8" width="14" x="391" y="98" />

        {slots.map((slotNumber, index) => {
          const column = index % columns;
          const row = Math.floor(index / columns);
          const cx = baseX + column * slotGapX;
          const cy = baseY + row * slotGapY;
          const occupied = occupiedSet.has(slotNumber);
          const slotLiquids = occupiedSlotLiquids?.[slotNumber] ?? [];
          const liquidVisualState = getContainerLiquidVisualState(slotLiquids, "sky");
          const vialPalette = occupied ? liquidVisualState.palette : neutralLiquidPalette;
          const liquidSegments = liquidVisualState.segments;
          const gradientId = `${testId ?? "autosampler-rack"}-slot-gradient-${slotNumber}`;
          const slotLiquid =
            occupied && liquidSegments.length > 1
              ? `url(#${gradientId})`
              : occupied && liquidSegments.length === 1
                ? liquidSegments[0].color
                : occupied
                  ? vialPalette.liquid
                  : palette.slot;
          const vialStroke = occupied ? vialPalette.stroke : palette.frame;
          const isOpen = openSet.has(slotNumber);

          return (
            <g
              data-seal-state={occupied ? (isOpen ? "open" : "sealed") : undefined}
              data-testid={testId ? `${testId}-slot-${slotNumber}` : undefined}
              key={slotNumber}
            >
              {occupied && liquidSegments.length > 1 ? (
                <defs>
                  <linearGradient
                    data-testid={testId ? `${testId}-slot-gradient-${slotNumber}` : undefined}
                    id={gradientId}
                    x1="50%"
                    x2="50%"
                    y1="100%"
                    y2="0%"
                  >
                    {liquidSegments.flatMap((segment, segmentIndex) => {
                      const start =
                        liquidSegments
                          .slice(0, segmentIndex)
                          .reduce((sum, previousSegment) => sum + previousSegment.ratio, 0) * 100;
                      const end = start + segment.ratio * 100;

                      return [
                        <stop
                          key={`${segment.color}-${segmentIndex}-start`}
                          offset={`${start}%`}
                          stopColor={segment.color}
                        />,
                        <stop
                          key={`${segment.color}-${segmentIndex}-end`}
                          offset={`${end}%`}
                          stopColor={segment.color}
                        />,
                      ];
                    })}
                  </linearGradient>
                </defs>
              ) : null}
              <circle
                cx={cx}
                cy={cy}
                fill="url(#rack-well)"
                r="16"
                stroke={palette.slot}
                strokeWidth="2.5"
              />
              {/* Capped and uncapped are opposites, not variants: a cap really hides
                  what is in the vial, so a closed position is a solid black disc and
                  the contents survive only as a thin rim of their own colour. Open the
                  vial and the cap is gone — the product itself fills the mouth. */}
              {occupied && !isOpen ? (
                <>
                  <circle
                    cx={cx}
                    cy={cy}
                    data-testid={testId ? `${testId}-slot-liquid-${slotNumber}` : undefined}
                    fill={slotLiquid}
                    r="13.5"
                  />
                  <circle
                    cx={cx}
                    cy={cy}
                    data-testid={testId ? `${testId}-slot-cap-${slotNumber}` : undefined}
                    fill="#0b1220"
                    r="11"
                    stroke="#020617"
                    strokeWidth="1.5"
                  />
                  {/* A sliver of light on the crimp, so the cap reads as a solid
                      object rather than a hole punched in the rack. */}
                  <path
                    d={`M ${cx - 5.6} ${cy - 5.2} A 7.6 7.6 0 0 1 ${cx + 3.4} ${cy - 6.6}`}
                    fill="none"
                    opacity="0.5"
                    stroke="#94a3b8"
                    strokeLinecap="round"
                    strokeWidth="1.6"
                  />
                </>
              ) : null}
              {occupied && isOpen ? (
                <>
                  <circle
                    cx={cx}
                    cy={cy}
                    fill="#f8fafc"
                    r="13.5"
                    stroke={palette.slot}
                    strokeWidth="1.5"
                  />
                  <circle
                    cx={cx}
                    cy={cy}
                    data-testid={testId ? `${testId}-slot-liquid-${slotNumber}` : undefined}
                    fill={slotLiquid}
                    r="10"
                    stroke={vialStroke}
                    strokeWidth="1.5"
                  />
                  {/* Meniscus: the product is seen through the bare mouth, from above. */}
                  <path
                    d={`M ${cx - 6.2} ${cy - 3.6} A 8.2 8.2 0 0 1 ${cx + 1.8} ${cy - 7.4}`}
                    fill="none"
                    opacity="0.55"
                    stroke="#ffffff"
                    strokeLinecap="round"
                    strokeWidth="1.8"
                  />
                  <circle
                    cx={cx}
                    cy={cy}
                    data-testid={testId ? `${testId}-slot-open-${slotNumber}` : undefined}
                    fill="none"
                    r="14.6"
                    stroke="#f59e0b"
                    strokeDasharray="4.2 3.4"
                    strokeLinecap="round"
                    strokeWidth="2.4"
                  />
                </>
              ) : null}
              {occupied ? null : (
                <>
                  <circle
                    cx={cx}
                    cy={cy}
                    fill="#cbd5e1"
                    opacity="0.55"
                    r="12"
                    stroke="#94a3b8"
                    strokeWidth="2.5"
                  />
                  <circle
                    cx={cx}
                    cy={cy}
                    fill="#eef3f7"
                    opacity="0.75"
                    r="7.5"
                    stroke="#a8b7c1"
                    strokeWidth="2"
                  />
                  <circle
                    cx={cx}
                    cy={cy}
                    data-testid={testId ? `${testId}-slot-liquid-${slotNumber}` : undefined}
                    fill={palette.slot}
                    opacity="0.6"
                    r="3.5"
                  />
                </>
              )}
              <text
                fill={palette.label}
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                fontSize="11"
                fontWeight="700"
                textAnchor="end"
                x={cx - 20}
                y={cy + 4}
              >
                {slotNumber}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
