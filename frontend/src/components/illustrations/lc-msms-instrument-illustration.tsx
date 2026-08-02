import { buildEquipmentIllustrationSurface } from "@/components/illustrations/equipment-illustration-surface";

type LcMsMsInstrumentIllustrationProps = {
  activeStage?: "lc" | "transfer" | "msms" | null;
  className?: string;
  status?: "idle" | "ready" | "running" | "completed";
  testId?: string;
};

const instrumentPalette = {
  idle: {
    accent: "#94a3b8",
    glow: "#f8fafc",
    frame: "#334155",
    panel: "#e2e8f0",
    pulse: "#cbd5e1",
  },
  ready: {
    accent: "#0ea5e9",
    glow: "#f0f9ff",
    frame: "#0f172a",
    panel: "#e0f2fe",
    pulse: "#7dd3fc",
  },
  running: {
    accent: "#f59e0b",
    glow: "#fffbeb",
    frame: "#0f172a",
    panel: "#fef3c7",
    pulse: "#fbbf24",
  },
  completed: {
    accent: "#10b981",
    glow: "#ecfdf5",
    frame: "#0f172a",
    panel: "#d1fae5",
    pulse: "#34d399",
  },
} as const;

const autosamplerVials = [82, 120, 158, 196, 234];
const activeVialIndex = 2;
const spectrumPeaks = [
  { height: 30, x: 420 },
  { height: 16, x: 438 },
  { height: 38, x: 456 },
  { height: 12, x: 474 },
  { height: 24, x: 492 },
  { height: 34, x: 510 },
  { height: 18, x: 528 },
];
const spectrumBaseline = 228;

export function LcMsMsInstrumentIllustration({
  activeStage = null,
  className,
  status = "idle",
  testId,
}: LcMsMsInstrumentIllustrationProps) {
  const palette = instrumentPalette[status];
  const { defs: surfaceDefs, surface } = buildEquipmentIllustrationSurface({
    height: 320,
    idPrefix: testId ?? "lc-msms-instrument-illustration",
    radius: 36,
    width: 720,
  });
  const lcActive = activeStage === "lc";
  const transferActive = activeStage === "transfer";
  const msmsActive = activeStage === "msms";

  const flowActive = transferActive || status === "running";
  const lcPulse = lcActive || status === "running";
  const msPulse = msmsActive || status === "running";
  const lcPanelFill = lcActive ? palette.panel : "#f8fafc";
  const msPanelFill = msmsActive ? palette.panel : "#f8fafc";
  const spectrumColor = msPulse || status === "completed" ? palette.accent : "#334155";
  const beamColor = flowActive ? palette.accent : "#94a3b8";

  return (
    <div
      aria-label="LC-MS/MS instrument illustration"
      className={className}
      data-active-stage={activeStage ?? "none"}
      data-status={status}
      data-testid={testId}
    >
      <svg
        className="h-full w-full"
        fill="none"
        viewBox="0 0 720 320"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>{surfaceDefs}</defs>
        {surface}
        <ellipse cx="360" cy="288" fill="#cbd5e1" opacity="0.5" rx="270" ry="22" />

        {/* Solvent reservoirs resting on top of the LC cabinet */}
        <rect fill="#f1f5f9" height="32" rx="6" stroke={palette.frame} strokeWidth="2.5" width="26" x="86" y="44" />
        <rect fill={lcPulse ? palette.pulse : "#7dd3fc"} height="16" rx="4" width="20" x="89" y="60" />
        <rect fill="#e2e8f0" height="9" rx="3" stroke={palette.frame} strokeWidth="2" width="14" x="92" y="36" />
        <rect fill="#f1f5f9" height="32" rx="6" stroke={palette.frame} strokeWidth="2.5" width="26" x="120" y="44" />
        <rect fill="#cbd5e1" height="16" rx="4" width="20" x="123" y="60" />
        <rect fill="#e2e8f0" height="9" rx="3" stroke={palette.frame} strokeWidth="2" width="14" x="126" y="36" />

        {/* Cabinets */}
        <rect
          fill={lcPanelFill}
          height="168"
          rx="26"
          stroke={palette.frame}
          strokeWidth="6"
          width="244"
          x="54"
          y="76"
        />
        <rect
          fill={msPanelFill}
          height="180"
          rx="28"
          stroke={palette.frame}
          strokeWidth="6"
          width="280"
          x="386"
          y="70"
        />

        {/* LC — control display */}
        <rect fill="#0f172a" height="42" rx="8" width="96" x="70" y="90" />
        <rect fill={lcPulse ? palette.pulse : "#334155"} height="6" rx="3" width="72" x="80" y="102" />
        <rect fill="#475569" height="5" rx="2.5" width="48" x="80" y="116" />

        {/* LC — solvent delivery pump */}
        <rect fill="#e2e8f0" height="42" rx="8" stroke={palette.frame} strokeWidth="3" width="104" x="176" y="90" />
        <circle cx="200" cy="111" fill="#cbd5e1" r="11" stroke={palette.frame} strokeWidth="2.5" />
        <circle cx="240" cy="111" fill="#cbd5e1" r="11" stroke={palette.frame} strokeWidth="2.5" />
        <circle cx="268" cy="98" fill={lcPulse ? palette.pulse : "#cbd5e1"} r="5" />

        {/* LC — autosampler tray */}
        <rect fill="#0f172a" height="60" rx="12" width="210" x="70" y="146" />
        {autosamplerVials.map((vialX, index) => (
          <g key={`vial-${vialX}`}>
            <rect fill="#e2e8f0" height="36" rx="4" width="18" x={vialX} y="154" />
            <rect
              fill={index === activeVialIndex && lcPulse ? palette.pulse : "#94a3b8"}
              height="18"
              rx="3"
              width="12"
              x={vialX + 3}
              y="172"
            />
          </g>
        ))}

        <text
          fill={palette.frame}
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontSize="18"
          fontWeight="800"
          x="76"
          y="232"
        >
          LC
        </text>

        {/* Transfer capillary between LC column and MS source */}
        <path
          d="M298 150H386"
          stroke={beamColor}
          strokeDasharray="10 10"
          strokeLinecap="round"
          strokeWidth="6"
        />
        <circle cx="342" cy="150" fill={flowActive ? palette.accent : "#cbd5e1"} r="7" />

        {/* MS/MS — electrospray ion source */}
        <rect fill="#e2e8f0" height="60" rx="10" stroke={palette.frame} strokeWidth="3" width="40" x="398" y="112" />
        <path d="M438 142H452" stroke={palette.frame} strokeLinecap="round" strokeWidth="3" />
        <circle cx="458" cy="142" fill={msPulse ? palette.pulse : "#94a3b8"} r="2.6" />
        <circle cx="464" cy="136" fill={msPulse ? palette.pulse : "#94a3b8"} r="2.2" />
        <circle cx="464" cy="148" fill={msPulse ? palette.pulse : "#94a3b8"} r="2.2" />
        <circle cx="470" cy="142" fill={msPulse ? palette.pulse : "#94a3b8"} r="2" />

        {/* MS/MS — ion beam through the analyzer */}
        <path d="M452 142H614" stroke={beamColor} strokeDasharray="7 7" strokeLinecap="round" strokeWidth="4" />

        {/* MS/MS — triple quadrupole rods + collision cell */}
        <rect fill="#cbd5e1" height="7" rx="3.5" width="40" x="466" y="128" />
        <rect fill="#cbd5e1" height="7" rx="3.5" width="40" x="466" y="150" />
        <rect fill="#f1f5f9" height="46" rx="8" stroke={palette.frame} strokeWidth="2.5" width="52" x="512" y="120" />
        <rect fill="#cbd5e1" height="6" rx="3" width="40" x="518" y="130" />
        <rect fill="#cbd5e1" height="6" rx="3" width="40" x="518" y="149" />
        <rect fill="#cbd5e1" height="7" rx="3.5" width="40" x="568" y="128" />
        <rect fill="#cbd5e1" height="7" rx="3.5" width="40" x="568" y="150" />

        {/* MS/MS — detector */}
        <circle cx="632" cy="142" fill="#0f172a" r="20" />
        <circle cx="632" cy="142" fill={msPulse || status === "completed" ? palette.pulse : "#1e293b"} r="9" />

        {/* MS/MS — mass spectrum readout */}
        <rect fill="#0f172a" height="48" rx="8" width="150" x="404" y="188" />
        {spectrumPeaks.map((peak) => (
          <rect
            key={`peak-${peak.x}`}
            fill={spectrumColor}
            height={peak.height}
            rx="2"
            width="6"
            x={peak.x}
            y={spectrumBaseline - peak.height}
          />
        ))}

        <text
          fill={palette.frame}
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontSize="18"
          fontWeight="800"
          x="568"
          y="228"
        >
          MS/MS
        </text>
      </svg>
    </div>
  );
}
