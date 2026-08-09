import { buildEquipmentIllustrationSurface } from "@/components/illustrations/equipment-illustration-surface";

type LcMsMsInstrumentIllustrationProps = {
  activeStage?: "lc" | "transfer" | "msms" | null;
  /** 1-based rack position currently being injected, if any. */
  activeRackPosition?: number | null;
  className?: string;
  /**
   * 1-based positions holding a vial in the rack loaded into the autosampler,
   * or null when no rack is loaded. The tray then shows its empty wells.
   */
  loadedRackPositions?: number[] | null;
  rackSlotCount?: number;
  isRunning?: boolean;
  onStartClick?: () => void;
  startDisabled?: boolean;
  startLabel?: string;
  startTestId?: string;
  status?: "idle" | "ready" | "running" | "completed";
  testId?: string;
};

const instrumentPalette = {
  idle: {
    accent: "#94a3b8",
    frame: "#7a909e",
    pulse: "#cbd5e1",
    readout: "#8ee6ff",
  },
  ready: {
    accent: "#0ea5e9",
    frame: "#7a909e",
    pulse: "#7dd3fc",
    readout: "#8ee6ff",
  },
  running: {
    accent: "#f59e0b",
    frame: "#7a909e",
    pulse: "#fbbf24",
    readout: "#ffd98a",
  },
  completed: {
    accent: "#10b981",
    frame: "#7a909e",
    pulse: "#34d399",
    readout: "#9dffce",
  },
} as const;

const TRAY_INNER_WIDTH = 198;
const TRAY_PADDING = 6;
const VIAL_WIDTH = 11;
const spectrumPeaks = [
  { height: 28, x: 420 },
  { height: 15, x: 438 },
  { height: 36, x: 456 },
  { height: 11, x: 474 },
  { height: 23, x: 492 },
  { height: 32, x: 510 },
  { height: 17, x: 528 },
];
const spectrumBaseline = 226;

export function LcMsMsInstrumentIllustration({
  activeStage = null,
  activeRackPosition = null,
  className,
  loadedRackPositions = null,
  rackSlotCount = 12,
  isRunning = false,
  onStartClick,
  startDisabled = false,
  startLabel = "Start the acquisition run",
  startTestId,
  status = "idle",
  testId,
}: LcMsMsInstrumentIllustrationProps) {
  const palette = instrumentPalette[status];
  const slotCount = Math.max(1, rackSlotCount);
  const slotPitch = TRAY_INNER_WIDTH / slotCount;
  const occupiedPositions = new Set(loadedRackPositions ?? []);
  const idp = testId ?? "lc-msms-instrument-illustration";
  const { defs: surfaceDefs, surface } = buildEquipmentIllustrationSurface({
    height: 320,
    idPrefix: idp,
    radius: 36,
    width: 720,
  });
  const lcActive = activeStage === "lc";
  const transferActive = activeStage === "transfer";
  const msmsActive = activeStage === "msms";

  const flowActive = transferActive || status === "running";
  const lcPulse = lcActive || status === "running";
  const msPulse = msmsActive || status === "running";
  const spectrumColor = msPulse || status === "completed" ? palette.accent : "#3b4a57";
  const beamColor = flowActive ? palette.accent : "#94a3b8";
  const lcReadout =
    status === "running" ? "RUN" : status === "completed" ? "DONE" : status === "ready" ? "READY" : "IDLE";

  const cabinetFill = `url(#${idp}-cabinet)`;
  const panelFill = `url(#${idp}-panel)`;
  const glassFill = `url(#${idp}-glass)`;
  const metalFill = `url(#${idp}-metal)`;

  const canStart = !startDisabled;
  const startButtonClassName = isRunning
    ? "border-red-600 bg-red-600 text-white"
    : canStart
      ? "border-red-300 bg-red-100 text-red-700 shadow-[0_10px_24px_rgba(239,68,68,0.2)] hover:border-red-400 hover:bg-red-200 hover:text-red-800"
      : "border-red-200 bg-red-100 text-red-400";

  return (
    <div
      aria-label="LC-MS/MS instrument illustration"
      className={className}
      data-active-stage={activeStage ?? "none"}
      data-status={status}
      data-testid={testId}
    >
      <div className="relative">
      <svg
        className="h-full w-full"
        fill="none"
        viewBox="0 0 720 320"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {surfaceDefs}
          <linearGradient id={`${idp}-cabinet`} gradientUnits="userSpaceOnUse" x1="80" x2="620" y1="90" y2="250">
            <stop offset="0" stopColor="#f4f7fa" />
            <stop offset="1" stopColor="#b7c6d2" />
          </linearGradient>
          <linearGradient id={`${idp}-panel`} gradientUnits="userSpaceOnUse" x1="80" x2="560" y1="100" y2="200">
            <stop offset="0" stopColor="#eef3f7" />
            <stop offset="1" stopColor="#cfdae3" />
          </linearGradient>
          <linearGradient id={`${idp}-glass`} gradientUnits="userSpaceOnUse" x1="86" x2="146" y1="44" y2="76">
            <stop offset="0" stopColor="#eef6fb" />
            <stop offset="1" stopColor="#c9dced" />
          </linearGradient>
          <linearGradient id={`${idp}-metal`} gradientUnits="userSpaceOnUse" x1="176" x2="280" y1="90" y2="172">
            <stop offset="0" stopColor="#e8eff4" />
            <stop offset="1" stopColor="#b9c8d4" />
          </linearGradient>
        </defs>

        {surface}

        {/* ── Solvent reservoirs resting on top of the LC cabinet ── */}
        <rect fill={metalFill} height="9" rx="3" stroke={palette.frame} strokeWidth="1.1" width="14" x="92" y="35" />
        <rect fill={glassFill} height="34" rx="6" stroke="#0f6f86" strokeWidth="1.3" width="26" x="86" y="44" />
        <rect fill={lcPulse ? palette.pulse : "#7dd3fc"} height="16" rx="4" width="20" x="89" y="60" />
        <rect fill="#ffffff" height="22" opacity="0.4" rx="1.5" width="3" x="90" y="48" />
        <rect fill={metalFill} height="9" rx="3" stroke={palette.frame} strokeWidth="1.1" width="14" x="126" y="35" />
        <rect fill={glassFill} height="34" rx="6" stroke="#0f6f86" strokeWidth="1.3" width="26" x="120" y="44" />
        <rect fill="#a9b7c4" height="16" rx="4" width="20" x="123" y="60" />
        <rect fill="#ffffff" height="22" opacity="0.4" rx="1.5" width="3" x="124" y="48" />

        {/* ── LC cabinet ────────────────────────────────────────── */}
        <rect fill={cabinetFill} height="168" rx="26" stroke={palette.frame} strokeWidth="2" width="244" x="54" y="76" />
        {lcActive ? (
          <rect fill={palette.accent} height="168" opacity="0.12" rx="26" width="244" x="54" y="76" />
        ) : null}
        <rect fill="#ffffff" height="3.5" opacity="0.55" rx="1.75" width="216" x="68" y="84" />

        {/* Control LCD */}
        <rect fill="#0c161c" height="40" rx="9" width="96" x="70" y="92" />
        <rect fill="#16242d" height="32" rx="6" stroke="#33454f" strokeWidth="1" width="88" x="74" y="96" />
        <text
          fill={palette.readout}
          fontFamily="monospace"
          fontSize="15"
          fontWeight="700"
          textAnchor="middle"
          x="118"
          y="117"
        >
          {lcReadout}
        </text>

        {/* Binary solvent pump */}
        <rect fill={metalFill} height="40" rx="8" stroke={palette.frame} strokeWidth="1.4" width="104" x="176" y="92" />
        <rect fill="#ffffff" height="2.5" opacity="0.5" rx="1.25" width="88" x="184" y="97" />
        <circle cx="200" cy="112" fill={metalFill} r="11" stroke="#5a7080" strokeWidth="1.2" />
        <circle cx="240" cy="112" fill={metalFill} r="11" stroke="#5a7080" strokeWidth="1.2" />
        <circle cx="268" cy="99" fill={lcPulse ? palette.pulse : "#cbd5e1"} r="5" />

        {/* Autosampler tray — the real rack once one is loaded */}
        <rect fill="#16242d" height="60" rx="12" stroke="#33454f" strokeWidth="1.2" width="210" x="70" y="146" />
        {Array.from({ length: slotCount }, (_, index) => {
          const position = index + 1;
          const wellX = 70 + TRAY_PADDING + index * slotPitch;
          const vialX = wellX + (slotPitch - VIAL_WIDTH) / 2 - TRAY_PADDING / slotCount;
          const isOccupied = occupiedPositions.has(position);
          const isInjecting = isOccupied && position === activeRackPosition;
          return (
            <g key={`rack-slot-${position}`}>
              <rect
                fill="#0d181e"
                height="40"
                rx="3"
                stroke="#2a3b45"
                strokeWidth="0.8"
                width={VIAL_WIDTH}
                x={vialX}
                y="152"
              />
              {isOccupied ? (
                <g data-testid="autosampler-vial">
                  <rect
                    fill={glassFill}
                    height="36"
                    rx="3"
                    stroke={isInjecting ? palette.pulse : "#0f6f86"}
                    strokeWidth={isInjecting ? 1.6 : 1}
                    width={VIAL_WIDTH}
                    x={vialX}
                    y="154"
                  />
                  <rect
                    fill={isInjecting && lcPulse ? palette.pulse : "#9db2c0"}
                    height="16"
                    rx="2"
                    width={VIAL_WIDTH - 4}
                    x={vialX + 2}
                    y="174"
                  />
                  <rect
                    fill="#ffffff"
                    height="22"
                    opacity="0.35"
                    rx="1"
                    width="1.8"
                    x={vialX + 2}
                    y="158"
                  />
                </g>
              ) : null}
            </g>
          );
        })}

        <text fill="#64748b" fontFamily="ui-sans-serif, system-ui, sans-serif" fontSize="15" fontWeight="800" x="76" y="230">
          LC
        </text>

        {/* LC rubber feet */}
        <rect fill="#2d3f4a" height="10" rx="4" width="30" x="84" y="242" />
        <rect fill="#2d3f4a" height="10" rx="4" width="30" x="234" y="242" />

        {/* ── Transfer capillary between LC column and MS source ── */}
        <path d="M298 150H386" stroke={beamColor} strokeDasharray="9 9" strokeLinecap="round" strokeWidth="3.5" />
        <circle cx="342" cy="150" fill={flowActive ? palette.accent : "#cbd5e1"} r="5.5" />

        {/* ── MS/MS cabinet ─────────────────────────────────────── */}
        <rect fill={cabinetFill} height="180" rx="28" stroke={palette.frame} strokeWidth="2" width="280" x="386" y="70" />
        {msmsActive ? (
          <rect fill={palette.accent} height="180" opacity="0.12" rx="28" width="280" x="386" y="70" />
        ) : null}
        <rect fill="#ffffff" height="3.5" opacity="0.55" rx="1.75" width="248" x="402" y="78" />

        {/* Electrospray ion source */}
        <rect fill={metalFill} height="60" rx="10" stroke={palette.frame} strokeWidth="1.4" width="40" x="398" y="112" />
        <rect fill="#ffffff" height="2.5" opacity="0.5" rx="1.25" width="26" x="405" y="117" />
        <path d="M438 142H452" stroke="#5a7080" strokeLinecap="round" strokeWidth="2" />
        <circle cx="458" cy="142" fill={msPulse ? palette.pulse : "#94a3b8"} r="2.4" />
        <circle cx="464" cy="136" fill={msPulse ? palette.pulse : "#94a3b8"} r="2" />
        <circle cx="464" cy="148" fill={msPulse ? palette.pulse : "#94a3b8"} r="2" />
        <circle cx="470" cy="142" fill={msPulse ? palette.pulse : "#94a3b8"} r="1.8" />

        {/* Ion beam through the analyzer */}
        <path d="M452 142H614" stroke={beamColor} strokeDasharray="7 7" strokeLinecap="round" strokeWidth="3" />

        {/* Triple quadrupole rods + collision cell */}
        <rect fill={metalFill} height="6" rx="3" width="40" x="466" y="129" />
        <rect fill={metalFill} height="6" rx="3" width="40" x="466" y="151" />
        <rect fill={panelFill} height="46" rx="8" stroke="#96aab7" strokeWidth="1.3" width="52" x="512" y="120" />
        <rect fill={metalFill} height="5" rx="2.5" width="40" x="518" y="131" />
        <rect fill={metalFill} height="5" rx="2.5" width="40" x="518" y="150" />
        <rect fill={metalFill} height="6" rx="3" width="40" x="568" y="129" />
        <rect fill={metalFill} height="6" rx="3" width="40" x="568" y="151" />

        {/* Detector */}
        <circle cx="632" cy="142" fill="#0c161c" r="17" stroke="#33454f" strokeWidth="1.2" />
        <circle cx="632" cy="142" fill={msPulse || status === "completed" ? palette.pulse : "#1e293b"} r="8" />

        {/* Mass-spectrum readout */}
        <rect fill="#0c161c" height="48" rx="8" width="150" x="404" y="186" />
        <rect fill="#16242d" height="40" rx="6" stroke="#33454f" strokeWidth="1" width="142" x="408" y="190" />
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

        {/* MS rubber feet */}
        <rect fill="#2d3f4a" height="10" rx="4" width="30" x="420" y="248" />
        <rect fill="#2d3f4a" height="10" rx="4" width="30" x="600" y="248" />

      </svg>

      {/* ── Power / run control, mounted on the MS/MS cabinet ── */}
      {onStartClick ? (
        <button
          aria-label={startLabel}
          aria-pressed={isRunning}
          className={`absolute z-10 flex aspect-square w-[10%] items-center justify-center rounded-[0.65rem] border transition ${
            startDisabled && !isRunning ? "cursor-not-allowed" : ""
          } ${startButtonClassName}`}
          data-testid={startTestId}
          disabled={startDisabled && !isRunning}
          onClick={onStartClick}
          style={{ left: "84%", top: "63%", transform: "translate(-50%, -50%)" }}
          type="button"
        >
          <svg
            aria-hidden="true"
            className={`h-1/2 w-1/2 ${isRunning ? "animate-pulse" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 3.75V11.25" stroke="currentColor" strokeLinecap="round" strokeWidth="2.1" />
            <path
              d="M7.58 6.56C5.77 7.98 4.62 10.18 4.62 12.65C4.62 16.93 8.05 20.4 12.29 20.4C16.53 20.4 19.96 16.93 19.96 12.65C19.96 10.18 18.81 7.98 17 6.56"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2.1"
            />
          </svg>
        </button>
      ) : null}
      </div>
    </div>
  );
}
