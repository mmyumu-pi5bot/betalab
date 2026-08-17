"use client";

import { buildEquipmentIllustrationSurface } from "@/components/illustrations/equipment-illustration-surface";

type IceBathIllustrationProps = {
  className?: string;
  hasTube: boolean;
};

// Ice cubes floating in the tray. Fixed positions rather than random ones so the
// illustration does not reshuffle itself on every render.
const ICE_CUBES = [
  { x: 96, y: 150, size: 34, tilt: -12 },
  { x: 150, y: 168, size: 27, tilt: 8 },
  { x: 196, y: 146, size: 31, tilt: 18 },
  { x: 302, y: 152, size: 29, tilt: -6 },
  { x: 350, y: 170, size: 34, tilt: 14 },
  { x: 250, y: 176, size: 24, tilt: -20 },
];

export function IceBathIllustration({ className, hasTube }: IceBathIllustrationProps) {
  const { defs: surfaceDefs, surface } = buildEquipmentIllustrationSurface({
    height: 272,
    idPrefix: "ice-bath-illustration",
    radius: 30,
    width: 495,
  });

  return (
    <div
      aria-label="Ice bath"
      className={`relative ${className ?? ""}`}
      data-testid="ice-bath-illustration"
      role="group"
    >
      <svg className="h-full w-full" fill="none" viewBox="0 0 495 272" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {surfaceDefs}

          <linearGradient id="ice-bath-water" x1="80" x2="415" y1="120" y2="228" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#bae6fd" />
            <stop offset="1" stopColor="#38bdf8" />
          </linearGradient>
          <linearGradient id="ice-bath-tray" x1="70" x2="425" y1="104" y2="240" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#f8fafc" />
            <stop offset="1" stopColor="#cbd5e1" />
          </linearGradient>
          <linearGradient id="ice-bath-cube" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="1" stopColor="#e0f2fe" stopOpacity="0.7" />
          </linearGradient>
        </defs>

        {surface}

        {/* Stainless tray */}
        <rect fill="url(#ice-bath-tray)" height={140} rx={22} stroke="#94a3b8" strokeWidth={3} width={360} x={68} y={100} />

        {/* Water line */}
        <rect fill="url(#ice-bath-water)" height={104} rx={14} width={330} x={83} y={124} />
        <ellipse cx={248} cy={128} fill="#e0f2fe" opacity={0.55} rx={162} ry={10} />

        {ICE_CUBES.map((cube) => (
          <rect
            key={`${cube.x}-${cube.y}`}
            fill="url(#ice-bath-cube)"
            height={cube.size}
            rx={6}
            stroke="#ffffff"
            strokeOpacity={0.8}
            strokeWidth={2}
            transform={`rotate(${cube.tilt} ${cube.x + cube.size / 2} ${cube.y + cube.size / 2})`}
            width={cube.size}
            x={cube.x}
            y={cube.y}
          />
        ))}

        {hasTube ? (
          <g data-testid="ice-bath-illustration-tube">
            {/* A tube stood in the ice, submerged to just under the cap */}
            <rect fill="#f1f5f9" height={122} rx={12} stroke="#64748b" strokeWidth={3} width={44} x={226} y={74} />
            <rect fill="#cbd5e1" height={16} rx={6} width={52} x={222} y={66} />
            <rect fill="#e2e8f0" height={58} rx={8} opacity={0.85} width={34} x={231} y={132} />
          </g>
        ) : null}

        <text
          fill="#0c4a6e"
          fontSize={17}
          fontWeight={600}
          letterSpacing={1.4}
          textAnchor="middle"
          x={248}
          y={258}
        >
          0 °C
        </text>
      </svg>
    </div>
  );
}
