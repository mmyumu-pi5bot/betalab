import { useId } from "react";
import type { ReactNode } from "react";

import { AppleLotGlyph } from "@/components/illustrations/apple-illustration";
import {
  getLiquidAccentPalette,
  getLiquidVisualSegments,
  neutralLiquidPalette,
} from "@/lib/liquid-visuals";
import type {
  ExperimentProduceLot,
  LiquidType,
  ToolType,
  ToolbarAccent,
} from "@/types/workbench";

type LabAssetIconProps = {
  accent: ToolbarAccent;
  className?: string;
  closureFault?: string | null;
  containsSlurry?: boolean;
  fillRatio?: number;
  fillSegments?: Array<{ accent: ToolbarAccent; ratio: number }>;
  isSealed?: boolean;
  kind: ToolType | LiquidType;
  powderMassG?: number;
  produceLots?: ExperimentProduceLot[];
  sampleLabelText?: string | null;
  tone?: "accent" | "neutral";
};

type SealVisualState = "open" | "sealed" | "popped";

const clampRatio = (value: number | undefined) => {
  if (value === undefined) {
    return 0.42;
  }

  return Math.min(Math.max(value, 0), 1);
};

function VesselFrame({
  children,
  defs,
  glow,
  label,
  stroke,
}: {
  children: ReactNode;
  defs?: ReactNode;
  glow: string;
  label: string;
  stroke: string;
}) {
  return (
    <svg
      aria-label={label}
      className="h-full w-full"
      fill="none"
      viewBox="0 0 88 120"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>{defs}</defs>
      <rect fill={glow} height="120" rx="28" width="88" />
      <g stroke={stroke} strokeLinecap="round" strokeLinejoin="round" strokeWidth="4">
        {children}
      </g>
    </svg>
  );
}

function PowderLayer({
  bodyPath,
  ridgePath,
  fill,
}: {
  bodyPath: string;
  ridgePath: string;
  fill: string;
}) {
  return (
    <>
      <path
        d={bodyPath}
        data-powder-layer="true"
        fill={fill}
        opacity="0.92"
        stroke="none"
      />
      <path d={ridgePath} opacity="0.5" />
    </>
  );
}

function VolumetricFlaskIcon({
  fillRatio,
  glow,
  label,
  liquidDefs,
  liquidFill,
  stroke,
}: {
  fillRatio: number;
  glow: string;
  label: string;
  liquidDefs?: ReactNode;
  liquidFill: string;
  stroke: string;
}) {
  const liquidTop = 90 - fillRatio * 26;

  return (
    <VesselFrame defs={liquidDefs} glow={glow} label={label} stroke={stroke}>
      <path d="M38 18H50" />
      <path d="M40 18V36L22 92C20 98 24 104 30 104H58C64 104 68 98 66 92L48 36V18" />
      <path d="M31 50H57" opacity="0.45" />
      <path
        d={`M28 ${liquidTop}H60V94C60 98 57 100 54 100H34C31 100 28 98 28 94V${liquidTop}Z`}
        fill={liquidFill}
        stroke="none"
      />
      <path d={`M28 ${liquidTop}C35 ${liquidTop - 2} 53 ${liquidTop + 2} 60 ${liquidTop}`} opacity="0.65" />
    </VesselFrame>
  );
}

function CentrifugeTubeIcon({
  closureFault,
  containsSlurry = false,
  fillRatio,
  glow,
  isSealed = false,
  label,
  liquidDefs,
  liquidFill,
  powderMassG = 0,
  stroke,
}: {
  closureFault?: string | null;
  containsSlurry?: boolean;
  fillRatio: number;
  glow: string;
  isSealed?: boolean;
  label: string;
  liquidDefs?: ReactNode;
  liquidFill: string;
  powderMassG?: number;
  stroke: string;
}) {
  const liquidTop = 86 - fillRatio * 38;
  const powderHeight = Math.min(Math.max(powderMassG * 0.9, 0), 16);
  const sealVisualState: SealVisualState =
    closureFault === "pressure_pop" ? "popped" : isSealed ? "sealed" : "open";

  return (
    <VesselFrame defs={liquidDefs} glow={glow} label={label} stroke={stroke}>
      {sealVisualState === "open" ? (
        <rect fill="#fff" height="12" rx="5" stroke={stroke} transform="rotate(-18 44 22)" width="34" x="27" y="16" />
      ) : sealVisualState === "popped" ? (
        <>
          <rect fill="#fff" height="12" rx="5" stroke="#e11d48" transform="rotate(14 47 20)" width="34" x="30" y="14" />
          <path d="M59 18L67 14" stroke="#e11d48" />
        </>
      ) : (
        <rect fill="#fff" height="12" rx="5" stroke={stroke} width="34" x="27" y="16" />
      )}
      <path d="M29 28H59V80C59 85 57 90 53 94L47 102C45 104 43 104 41 102L35 94C31 90 29 85 29 80V28Z" />
      <path
        d={`M33 ${liquidTop}H55V80C55 83 54 86 52 89L46 97C45 98 43 98 42 97L36 89C34 86 33 83 33 80V${liquidTop}Z`}
        fill={liquidFill}
        stroke="none"
      />
      <path d={`M33 ${liquidTop}C39 ${liquidTop - 2} 49 ${liquidTop + 2} 55 ${liquidTop}`} opacity="0.65" />
      {!containsSlurry && powderHeight > 0 ? (
        fillRatio > 0 ? (
          <PowderLayer
            bodyPath={`M34 ${liquidTop - powderHeight}C38 ${liquidTop - powderHeight - 3} 50 ${liquidTop - powderHeight - 3} 54 ${liquidTop - powderHeight}L54 ${liquidTop + 2}L34 ${liquidTop + 2}Z`}
            fill="#d6c6a8"
            ridgePath={`M34 ${liquidTop - powderHeight}C40 ${liquidTop - powderHeight - 1} 48 ${liquidTop - powderHeight - 1} 54 ${liquidTop - powderHeight}`}
          />
        ) : (
          <PowderLayer
            bodyPath={`M34 ${95 - powderHeight}C38 ${92 - powderHeight} 49 ${93 - powderHeight} 54 ${95 - powderHeight}V80C54 83 53 86 51 89L46 96C45 97 43 97 42 96L37 89C35 86 34 83 34 80V${95 - powderHeight}Z`}
            fill="#d6c6a8"
            ridgePath={`M34 ${95 - powderHeight}C40 ${92 - powderHeight} 48 ${93 - powderHeight} 54 ${95 - powderHeight}`}
          />
        )
      ) : null}
    </VesselFrame>
  );
}

function CleanupTubeIcon({
  closureFault,
  containsSlurry = false,
  fillRatio,
  glow,
  isSealed = false,
  label,
  liquidDefs,
  liquidFill,
  powderMassG = 0,
  stroke,
}: {
  closureFault?: string | null;
  containsSlurry?: boolean;
  fillRatio: number;
  glow: string;
  isSealed?: boolean;
  label: string;
  liquidDefs?: ReactNode;
  liquidFill: string;
  powderMassG?: number;
  stroke: string;
}) {
  const liquidTop = 84 - fillRatio * 34;
  const powderHeight = Math.min(Math.max(powderMassG * 0.9, 0), 14);
  const sealVisualState: SealVisualState =
    closureFault === "pressure_pop" ? "popped" : isSealed ? "sealed" : "open";

  return (
    <VesselFrame defs={liquidDefs} glow={glow} label={label} stroke={stroke}>
      {sealVisualState === "open" ? (
        <rect fill="#fff" height="11" rx="4" stroke={stroke} transform="rotate(-16 44 23.5)" width="30" x="29" y="18" />
      ) : sealVisualState === "popped" ? (
        <>
          <rect fill="#fff" height="11" rx="4" stroke="#e11d48" transform="rotate(12 47 22)" width="30" x="32" y="16" />
          <path d="M57 21L64 17" stroke="#e11d48" />
        </>
      ) : (
        <rect fill="#fff" height="11" rx="4" stroke={stroke} width="30" x="29" y="18" />
      )}
      <path d="M31 29H57V84C57 93 51 100 44 104C37 100 31 93 31 84V29Z" />
      <path
        d={`M35 ${liquidTop}H53V82C53 87 50 92 44 96C38 92 35 87 35 82V${liquidTop}Z`}
        fill={liquidFill}
        stroke="none"
      />
      <path d={`M35 ${liquidTop}C40 ${liquidTop - 1} 48 ${liquidTop + 2} 53 ${liquidTop}`} opacity="0.65" />
      {!containsSlurry && powderHeight > 0 ? (
        fillRatio > 0 ? (
          <PowderLayer
            bodyPath={`M36 ${liquidTop - powderHeight}C40 ${liquidTop - powderHeight - 3} 48 ${liquidTop - powderHeight - 3} 52 ${liquidTop - powderHeight}L52 ${liquidTop + 2}L36 ${liquidTop + 2}Z`}
            fill="#d6c6a8"
            ridgePath={`M36 ${liquidTop - powderHeight}C40 ${liquidTop - powderHeight - 1} 48 ${liquidTop - powderHeight - 1} 52 ${liquidTop - powderHeight}`}
          />
        ) : (
          <PowderLayer
            bodyPath={`M36 ${95 - powderHeight}C40 ${91 - powderHeight} 48 ${92 - powderHeight} 52 ${95 - powderHeight}V82C52 86 49 90 44 94C39 90 36 86 36 82V${95 - powderHeight}Z`}
            fill="#d6c6a8"
            ridgePath={`M36 ${95 - powderHeight}C40 ${92 - powderHeight} 48 ${93 - powderHeight} 52 ${95 - powderHeight}`}
          />
        )
      ) : null}
    </VesselFrame>
  );
}

function SampleVialIcon({
  closureFault,
  containsSlurry = false,
  fillRatio,
  glow,
  isSealed = false,
  label,
  liquidDefs,
  liquidFill,
  powderMassG = 0,
  stroke,
}: {
  closureFault?: string | null;
  containsSlurry?: boolean;
  fillRatio: number;
  glow: string;
  isSealed?: boolean;
  label: string;
  liquidDefs?: ReactNode;
  liquidFill: string;
  powderMassG?: number;
  stroke: string;
}) {
  const liquidTop = 86 - fillRatio * 30;
  const powderHeight = Math.min(Math.max(powderMassG * 3.2, 0), 14);
  const sealVisualState: SealVisualState =
    closureFault === "pressure_pop" ? "popped" : isSealed ? "sealed" : "open";

  return (
    <VesselFrame defs={liquidDefs} glow={glow} label={label} stroke={stroke}>
      {sealVisualState === "open" ? (
        <rect fill="#1e293b" height="18" rx="4" stroke="none" transform="rotate(-16 44 25)" width="34" x="27" y="16" />
      ) : sealVisualState === "popped" ? (
        <>
          <rect fill="#1e293b" height="18" rx="4" stroke="none" transform="rotate(14 49 22)" width="34" x="32" y="13" />
          <path d="M59 20L67 15" stroke="#e11d48" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
        </>
      ) : (
        <rect fill="#1e293b" height="18" rx="4" stroke="none" width="34" x="27" y="16" />
      )}
      <path d="M30 34H58V92C58 99 52 104 44 104C36 104 30 99 30 92V34Z" />
      <path
        d={`M34 ${liquidTop}H54V90C54 95 50 99 44 99C38 99 34 95 34 90V${liquidTop}Z`}
        fill={liquidFill}
        stroke="none"
      />
      <path d={`M34 ${liquidTop}C40 ${liquidTop - 2} 48 ${liquidTop + 2} 54 ${liquidTop}`} opacity="0.65" />
      {!containsSlurry && powderHeight > 0 ? (
        fillRatio > 0 ? (
          <PowderLayer
            bodyPath={`M35 ${liquidTop - powderHeight}C39 ${liquidTop - powderHeight - 3} 49 ${liquidTop - powderHeight - 3} 53 ${liquidTop - powderHeight}L53 ${liquidTop + 2}L35 ${liquidTop + 2}Z`}
            fill="#d6c6a8"
            ridgePath={`M35 ${liquidTop - powderHeight}C40 ${liquidTop - powderHeight - 1} 48 ${liquidTop - powderHeight - 1} 53 ${liquidTop - powderHeight}`}
          />
        ) : (
          <PowderLayer
            bodyPath={`M35 ${98 - powderHeight}C39 ${94 - powderHeight} 49 ${95 - powderHeight} 53 ${98 - powderHeight}V91C53 95 49 98 44 98C39 98 35 95 35 91V${98 - powderHeight}Z`}
            fill="#d6c6a8"
            ridgePath={`M35 ${98 - powderHeight}C40 ${95 - powderHeight} 48 ${96 - powderHeight} 53 ${98 - powderHeight}`}
          />
        )
      ) : null}
    </VesselFrame>
  );
}

function BeakerIcon({
  fillRatio,
  glow,
  label,
  liquidDefs,
  liquidFill,
  stroke,
}: {
  fillRatio: number;
  glow: string;
  label: string;
  liquidDefs?: ReactNode;
  liquidFill: string;
  stroke: string;
}) {
  const liquidTop = 90 - fillRatio * 34;

  return (
    <VesselFrame defs={liquidDefs} glow={glow} label={label} stroke={stroke}>
      <path d="M22 26H28" />
      <path d="M28 26H60L56 100H32L28 26Z" />
      <path d={`M33 ${liquidTop}H55L53 96H35L33 ${liquidTop}Z`} fill={liquidFill} stroke="none" />
      <path d={`M33 ${liquidTop}C39 ${liquidTop - 2} 49 ${liquidTop + 1} 55 ${liquidTop}`} opacity="0.65" />
      <path d="M54 42H58" opacity="0.45" />
      <path d="M52 52H57" opacity="0.45" />
    </VesselFrame>
  );
}

function DryIcePelletsIcon({
  glow,
  label,
  stroke,
}: {
  glow: string;
  label: string;
  stroke: string;
}) {
  return (
    <svg
      aria-label={label}
      className="h-full w-full"
      fill="none"
      viewBox="0 0 88 120"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill={glow} height="120" rx="28" width="88" />
      <g stroke={stroke} strokeLinecap="round" strokeLinejoin="round">
        <path d="M24 44H64L58 96H30L24 44Z" strokeWidth="4" />
        <path d="M28 44C34 40 54 40 60 44" opacity="0.45" strokeWidth="3" />
      </g>
      <g>
        <rect fill="#e0f2fe" height="12" rx="3" width="12" x="28" y="54" />
        <rect fill="#bae6fd" height="12" rx="3" width="12" x="43" y="52" />
        <rect fill="#dbeafe" height="12" rx="3" width="12" x="37" y="66" />
        <rect fill="#e0f2fe" height="10" rx="2.5" width="10" x="50" y="67" />
        <rect fill="#f8fafc" fillOpacity="0.7" height="4" rx="1.5" width="4" x="31" y="57" />
        <rect fill="#f8fafc" fillOpacity="0.7" height="4" rx="1.5" width="4" x="46" y="55" />
      </g>
    </svg>
  );
}

function QuechersSaltsPacketIcon({
  glow,
  label,
  stroke,
}: {
  glow: string;
  label: string;
  stroke: string;
}) {
  return (
    <svg
      aria-label={label}
      className="h-full w-full"
      fill="none"
      viewBox="0 0 88 120"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill={glow} height="120" rx="28" width="88" />
      <path
        d="M25 31H63L59 94C58.6 99.8 53.8 104 48 104H40C34.2 104 29.4 99.8 29 94L25 31Z"
        fill="#f8fafc"
        stroke={stroke}
        strokeLinejoin="round"
        strokeWidth="3"
      />
      <path d="M27 39H61" opacity="0.45" stroke={stroke} strokeWidth="2" />
      <rect fill="#ede9fe" height="28" rx="5" width="26" x="31" y="51" />
      <text
        fill="#6d28d9"
        fontFamily="sans-serif"
        fontSize="8"
        fontWeight="700"
        textAnchor="middle"
        x="44"
        y="63"
      >
        QuE
      </text>
      <text
        fill="#6d28d9"
        fontFamily="sans-serif"
        fontSize="7"
        fontWeight="700"
        textAnchor="middle"
        x="44"
        y="72"
      >
        SALTS
      </text>
    </svg>
  );
}

function CuttingBoardIcon({
  glow,
  label,
  stroke,
}: {
  glow: string;
  label: string;
  stroke: string;
}) {
  return (
    <VesselFrame glow={glow} label={label} stroke={stroke}>
      <rect fill="#f8fafc" height="54" rx="8" stroke={stroke} width="44" x="22" y="34" />
      <circle cx="56" cy="46" fill="none" r="4" stroke={stroke} />
      <path d="M30 54H50" opacity="0.35" />
      <path d="M30 64H58" opacity="0.35" />
      <path d="M30 74H52" opacity="0.35" />
    </VesselFrame>
  );
}

function AmberBottleIcon({
  fillRatio,
  glow,
  label,
  liquidDefs,
  liquidFill,
  stroke,
}: {
  fillRatio: number;
  glow: string;
  label: string;
  liquidDefs?: ReactNode;
  liquidFill: string;
  stroke: string;
}) {
  const liquidTop = 82 - fillRatio * 28;

  return (
    <VesselFrame defs={liquidDefs} glow={glow} label={label} stroke={stroke}>
      <rect fill="#1e293b" height="12" rx="3" stroke="none" width="20" x="34" y="16" />
      <path d="M36 28H52V38H58V92C58 99 52 104 44 104C36 104 30 99 30 92V38H36V28Z" />
      <path
        d={`M34 ${liquidTop}H54V90C54 95 50 100 44 100C38 100 34 95 34 90V${liquidTop}Z`}
        fill={liquidFill}
        opacity="0.9"
        stroke="none"
      />
      <path d={`M34 ${liquidTop}C40 ${liquidTop - 2} 48 ${liquidTop + 1} 54 ${liquidTop}`} opacity="0.65" />
    </VesselFrame>
  );
}

function ReagentBottleIcon({
  fillRatio,
  glow,
  label,
  liquidDefs,
  liquidFill,
  stroke,
}: {
  fillRatio: number;
  glow: string;
  label: string;
  liquidDefs?: ReactNode;
  liquidFill: string;
  stroke: string;
}) {
  const liquidTop = 84 - fillRatio * 32;

  return (
    <VesselFrame defs={liquidDefs} glow={glow} label={label} stroke={stroke}>
      <rect fill="#1e293b" height="12" rx="3" stroke="none" width="18" x="35" y="16" />
      <path d="M32 28H56V38L60 44V92C60 99 53 104 44 104C35 104 28 99 28 92V44L32 38V28Z" />
      <path
        d={`M32 ${liquidTop}H56V90C56 95 51 100 44 100C37 100 32 95 32 90V${liquidTop}Z`}
        fill={liquidFill}
        stroke="none"
      />
      <path d={`M32 ${liquidTop}C38 ${liquidTop - 2} 50 ${liquidTop + 2} 56 ${liquidTop}`} opacity="0.65" />
    </VesselFrame>
  );
}

function SampleBagIcon({
  closureFault,
  glow,
  isSealed = false,
  label,
  produceLots,
  sampleLabelText,
  stroke,
}: {
  closureFault?: string | null;
  glow: string;
  isSealed?: boolean;
  label: string;
  produceLots: ExperimentProduceLot[];
  sampleLabelText?: string | null;
  stroke: string;
}) {
  const isLoaded = produceLots.length > 0;
  const sealVisualState: SealVisualState =
    closureFault === "pressure_pop" ? "popped" : isSealed ? "sealed" : "open";
  const visibleProduceLots = produceLots.slice(0, 2);
  const normalizedLabelText = sampleLabelText?.trim() ?? "";
  const displayLabelText =
    normalizedLabelText.length > 12
      ? `${normalizedLabelText.slice(0, 12).trimEnd()}...`
      : normalizedLabelText;

  return (
    <VesselFrame glow={glow} label={label} stroke={stroke}>
      {sealVisualState === "open" ? (
        <g>
          <path d={isLoaded ? "M20 24H58" : "M28 24H54"} />
          <path d={isLoaded ? "M60 20L69 26" : "M56 20L64 26"} opacity="0.7" />
        </g>
      ) : sealVisualState === "popped" ? (
        <g>
          <path d={isLoaded ? "M20 22H66" : "M28 22H58"} />
          <path d={isLoaded ? "M61 16L70 20" : "M55 16L63 20"} stroke="#e11d48" />
          <path d={isLoaded ? "M63 24L70 18" : "M57 24L63 18"} stroke="#e11d48" />
        </g>
      ) : (
        <path d={isLoaded ? "M20 22H68" : "M28 22H60"} />
      )}
      <path
        d={
          isLoaded
            ? "M24 22L18 38V88C18 98 28 104 39 104H49C60 104 70 98 70 88V38L64 22"
            : "M30 22L26 38V90C26 98 32 104 40 104H48C56 104 62 98 62 90V38L58 22"
        }
      />
      <path d={isLoaded ? "M24 40H64" : "M32 40H56"} opacity="0.4" />
      <path
        d={isLoaded ? "M26 32H62V42H26V32Z" : "M34 32H54V42H34V32Z"}
        fill="#dcfce7"
        stroke="none"
      />
      <path
        d={
          isLoaded
            ? "M22 50C28 44 37 42 44 45C51 48 59 48 66 44V80C66 90 57 97 44 99C31 97 22 90 22 80V50Z"
            : "M32 48C36 46 40 46 44 48C48 50 52 50 56 48V82C56 89 51 94 44 96C37 94 32 89 32 82V48Z"
        }
        fill="#bbf7d0"
        stroke="none"
        opacity="0.85"
      />
      {visibleProduceLots.map((produceLot, index) => {
        if (produceLot.produceType !== "apple") {
          return null;
        }

        return (
          <g
            key={produceLot.id}
            opacity={index === 0 ? 0.9 : 0.76}
            transform={index === 0 ? "translate(23 36) scale(0.42)" : "translate(38 42) scale(0.34)"}
          >
            <AppleLotGlyph
              shadowOpacity={0.04}
              variant={
                produceLot.materialState === "ground"
                  ? "ground"
                  : produceLot.materialState === "whole"
                    ? "whole"
                    : "cut"
              }
            />
          </g>
        );
      })}
      <path d={isLoaded ? "M30 56H58" : "M38 56H50"} opacity="0.55" />
      <path d={isLoaded ? "M28 64H60" : "M36 64H52"} opacity="0.55" />
      <path d={isLoaded ? "M28 72H60" : "M36 72H52"} opacity="0.55" />
      {displayLabelText ? (
        <g data-sample-label-text={normalizedLabelText}>
          <rect
            fill="#f8fafc"
            height={isLoaded ? "16" : "14"}
            rx="3"
            stroke="#7dd3fc"
            strokeWidth="1.5"
            width={isLoaded ? "32" : "28"}
            x={isLoaded ? "28" : "30"}
            y={isLoaded ? "76" : "74"}
          />
          <text
            fill="#0f172a"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fontSize={isLoaded ? "5.2" : "4.8"}
            fontWeight="700"
            letterSpacing="0.35"
            textAnchor="middle"
            x={isLoaded ? "44" : "44"}
            y={isLoaded ? "86.2" : "83.5"}
          >
            {displayLabelText}
          </text>
        </g>
      ) : null}
      <path
        d={isLoaded ? "M24 28H64" : "M30 28H58"}
        stroke={sealVisualState === "popped" ? "#e11d48" : undefined}
      />
    </VesselFrame>
  );
}

function StorageJarIcon({
  closureFault,
  glow,
  isSealed = false,
  label,
  powderMassG = 0,
  produceLots,
  stroke,
}: {
  closureFault?: string | null;
  glow: string;
  isSealed?: boolean;
  label: string;
  powderMassG?: number;
  produceLots: ExperimentProduceLot[];
  stroke: string;
}) {
  const isLoaded = produceLots.length > 0;
  const powderHeight = Math.min(Math.max(powderMassG / 6, 0), 28);
  const sealVisualState: SealVisualState =
    closureFault === "pressure_pop" ? "popped" : isSealed ? "sealed" : "open";
  const visibleProduceLots = produceLots.slice(0, 2);

  return (
    <VesselFrame glow={glow} label={label} stroke={stroke}>
      {sealVisualState === "open" ? (
        <>
          <rect fill="#334155" height="16" rx="5" stroke="none" transform="rotate(-16 46 22)" width="40" x="26" y="12" />
          <rect fill="#475569" height="8" rx="3" stroke="none" transform="rotate(-16 44 26)" width="46" x="23" y="18" />
        </>
      ) : sealVisualState === "popped" ? (
        <>
          <rect fill="#334155" height="16" rx="5" stroke="none" transform="rotate(12 46 20)" width="40" x="28" y="10" />
          <rect fill="#475569" height="8" rx="3" stroke="none" transform="rotate(12 44 24)" width="46" x="25" y="16" />
          <path d="M66 24L72 18" stroke="#e11d48" />
          <path d="M64 14L72 16" stroke="#e11d48" />
        </>
      ) : (
        <>
          <rect fill="#334155" height="16" rx="5" stroke="none" width="40" x="24" y="16" />
          <rect fill="#475569" height="8" rx="3" stroke="none" width="46" x="21" y="22" />
        </>
      )}
      <path d="M22 30H66V88C66 97 59 104 50 104H38C29 104 22 97 22 88V30Z" />
      <path d="M30 42H58" opacity="0.35" />
      <path d="M30 52H58" opacity="0.28" />
      {isLoaded ? (
        <>
          <path d="M26 58C31 52 38 49 44 50C50 51 57 51 62 48V83C62 91 54 97 44 99C34 97 26 91 26 83V58Z" fill="#e2e8f0" opacity="0.82" stroke="none" />
          {visibleProduceLots.map((produceLot, index) => (
            <g
              key={produceLot.id}
              opacity={index === 0 ? 0.72 : 0.58}
              transform={index === 0 ? "translate(22 46) scale(0.42)" : "translate(39 53) scale(0.29)"}
            >
              <AppleLotGlyph
                shadowOpacity={0.03}
                variant={
                  produceLot.materialState === "ground"
                    ? "ground"
                    : produceLot.materialState === "whole"
                      ? "whole"
                      : "cut"
                }
              />
            </g>
          ))}
        </>
      ) : (
        <path d="M28 58H60V86C60 92 55 96 50 96H38C33 96 28 92 28 86V58Z" fill="#f8fafc" opacity="0.6" stroke="none" />
      )}
      {powderHeight > 0 ? (
        <PowderLayer
          bodyPath={`M27 ${92 - powderHeight}C33 ${85 - powderHeight} 54 ${86 - powderHeight} 61 ${90 - powderHeight}V84C61 91 54 96 44 98C34 96 27 91 27 84V${92 - powderHeight}Z`}
          fill="#d7c9af"
          ridgePath={`M27 ${92 - powderHeight}C34 ${87 - powderHeight} 54 ${88 - powderHeight} 61 ${90 - powderHeight}`}
        />
      ) : null}
      <path d="M26 34H62" opacity="0.45" />
      <path d="M24 30H64" stroke={sealVisualState === "popped" ? "#e11d48" : undefined} />
    </VesselFrame>
  );
}

export function LabAssetIcon({
  accent,
  className,
  closureFault,
  containsSlurry = false,
  fillRatio,
  fillSegments,
  isSealed = false,
  kind,
  powderMassG = 0,
  produceLots = [],
  sampleLabelText,
  tone = "accent",
}: LabAssetIconProps) {
  const palette = tone === "neutral" ? neutralLiquidPalette : getLiquidAccentPalette(accent);
  const normalizedFill = clampRatio(fillRatio);
  const label = kind.replace(/_/g, " ");
  const gradientId = useId().replace(/:/g, "");
  const normalizedSegments = getLiquidVisualSegments(
    fillSegments?.map((segment) => ({
      accent: segment.accent,
      volume_ml: segment.ratio,
    })) ?? [],
  );
  const displaySegments =
    normalizedSegments.length > 0 ? normalizedSegments : [{ color: palette.liquid, ratio: 1 }];
  const baseLiquidFill =
    displaySegments.length === 1 ? displaySegments[0].color : `url(#${gradientId})`;
  const baseLiquidDefs =
    displaySegments.length > 1 ? (
      <linearGradient id={gradientId} x1="0%" x2="0%" y1="100%" y2="0%">
        {displaySegments.flatMap((segment, index) => {
          const start =
            displaySegments
              .slice(0, index)
              .reduce((sum, previousSegment) => sum + previousSegment.ratio, 0) * 100;
          const end = start + segment.ratio * 100;

          return [
            <stop
              key={`${segment.color}-${index}-start`}
              offset={`${start}%`}
              stopColor={segment.color}
            />,
            <stop
              key={`${segment.color}-${index}-end`}
              offset={`${end}%`}
              stopColor={segment.color}
            />,
          ];
        })}
      </linearGradient>
    ) : null;

  const slurryPatternId = `${gradientId}sp`;
  const slurryLiquidColor = displaySegments[0].color;
  const slurryDefs = containsSlurry ? (
    <pattern
      height="10"
      id={slurryPatternId}
      patternTransform="rotate(45)"
      patternUnits="userSpaceOnUse"
      width="10"
    >
      <rect fill={slurryLiquidColor} height="10" width="5" />
      <rect fill="#d6c6a8" height="10" width="5" x="5" />
    </pattern>
  ) : null;

  const liquidFill = containsSlurry ? `url(#${slurryPatternId})` : baseLiquidFill;
  const liquidDefs = containsSlurry ? slurryDefs : baseLiquidDefs;

  const sharedProps = {
    fillRatio: normalizedFill,
    glow: palette.glow,
    label,
    liquidDefs,
    liquidFill,
    stroke: palette.stroke,
  };

  let icon: ReactNode;

  switch (kind) {
    case "volumetric_flask":
      icon = <VolumetricFlaskIcon {...sharedProps} />;
      break;
    case "centrifuge_tube":
      icon = (
        <CentrifugeTubeIcon
          {...sharedProps}
          closureFault={closureFault}
          containsSlurry={containsSlurry}
          isSealed={isSealed}
          powderMassG={powderMassG}
        />
      );
      break;
    case "cleanup_tube":
      icon = (
        <CleanupTubeIcon
          {...sharedProps}
          closureFault={closureFault}
          containsSlurry={containsSlurry}
          isSealed={isSealed}
          powderMassG={powderMassG}
        />
      );
      break;
    case "sample_vial":
      icon = <SampleVialIcon {...sharedProps} closureFault={closureFault} containsSlurry={containsSlurry} isSealed={isSealed} powderMassG={powderMassG} />;
      break;
    case "beaker":
      icon = <BeakerIcon {...sharedProps} />;
      break;
    case "cutting_board":
      icon = <CuttingBoardIcon glow={palette.glow} label={label} stroke={palette.stroke} />;
      break;
    case "sample_bag":
      icon = (
        <SampleBagIcon
          closureFault={closureFault}
          glow={palette.glow}
          isSealed={isSealed}
          label={label}
          produceLots={produceLots}
          sampleLabelText={sampleLabelText}
          stroke={palette.stroke}
        />
      );
      break;
    case "storage_jar":
      icon = (
        <StorageJarIcon
          closureFault={closureFault}
          glow={palette.glow}
          isSealed={isSealed}
          label={label}
          powderMassG={powderMassG}
          produceLots={produceLots}
          stroke={palette.stroke}
        />
      );
      break;
    case "amber_bottle":
      icon = <AmberBottleIcon {...sharedProps} />;
      break;
    case "ultrapure_water":
    case "acetonitrile":
    case "methanol":
    case "formic_acid":
    case "matrix_blank":
    case "apple_extract":
      icon = <ReagentBottleIcon {...sharedProps} />;
      break;
    case "dry_ice_pellets":
      icon = <DryIcePelletsIcon glow={palette.glow} label={label} stroke={palette.stroke} />;
      break;
    case "quechers_salts":
      icon = <QuechersSaltsPacketIcon glow={palette.glow} label={label} stroke={palette.stroke} />;
      break;
    default:
      icon = <ReagentBottleIcon {...sharedProps} />;
  }

  return (
    <div
      className={className}
      data-fill-segments={displaySegments.length}
      data-kind={kind}
      data-closure-fault={closureFault ?? ""}
      data-powder-mass-g={powderMassG}
      data-primary-produce-cut-state={produceLots[0]?.materialState ?? ""}
      data-produce-lot-count={produceLots.length}
      data-sample-label-text={sampleLabelText ?? ""}
      data-seal-state={closureFault === "pressure_pop" ? "popped" : isSealed ? "sealed" : "open"}
      data-tone={tone}
    >
      {icon}
    </div>
  );
}
