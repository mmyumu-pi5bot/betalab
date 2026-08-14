"use client";

type LimsLabelPrinterIllustrationProps = {
  className?: string;
  hasTicket: boolean;
  ticketTestId?: string;
};

const TICKET = { x: 46, y: 24, width: 150, bodyBottom: 58, toothDepth: 6, toothWidth: 7.5 };

// Bars of a fake Code-128 strip: [offset, width] pairs inside the ticket.
const BARCODE_BARS: Array<[number, number]> = [
  [0, 2],
  [4, 1],
  [7, 3],
  [12, 1],
  [15, 2],
  [19, 1],
  [22, 3],
  [27, 2],
  [31, 1],
  [34, 2],
  [38, 3],
  [43, 1],
  [46, 2],
  [50, 1],
  [53, 3],
  [58, 2],
  [62, 1],
  [65, 2],
];

/** Bottom edge of the ticket, torn off along the printer's serrated blade. */
function buildTicketPath(): string {
  const { x, y, width, bodyBottom, toothDepth, toothWidth } = TICKET;
  const right = x + width;
  const teeth: string[] = [];
  for (let cursor = right; cursor > x; cursor -= toothWidth) {
    const tip = Math.max(x, cursor - toothWidth / 2);
    const nextRoot = Math.max(x, cursor - toothWidth);
    teeth.push(`L${tip} ${bodyBottom + toothDepth}`, `L${nextRoot} ${bodyBottom}`);
  }
  return `M${x} ${y} H${right} V${bodyBottom} ${teeth.join(" ")} Z`;
}

export function LimsLabelPrinterIllustration({
  className,
  hasTicket,
  ticketTestId,
}: LimsLabelPrinterIllustrationProps) {
  return (
    <svg
      aria-label="LIMS label printer"
      className={className}
      fill="none"
      viewBox="0 0 360 76"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="lims-printer-deck" x1="0" x2="0" y1="6" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="#eef2f7" offset="0" />
          <stop stopColor="#c7d2dd" offset="1" />
        </linearGradient>
        <linearGradient id="lims-printer-paper" x1="46" x2="196" y1="24" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" offset="0" />
          <stop stopColor="#eef2f6" offset="1" />
        </linearGradient>
      </defs>

      {/* Printer deck the paper slot is cut into */}
      <rect fill="url(#lims-printer-deck)" height="26" rx="9" stroke="#93a3b3" strokeWidth="1.2" width="212" x="16" y="4" />

      <text
        fill="#5b6c7c"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontSize="7"
        fontWeight="700"
        letterSpacing="0.18em"
        x="28"
        y="17"
      >
        LABEL PRINTER
      </text>

      {/* Paper slot */}
      <rect fill="#3b4a57" height="7" rx="3.5" width="184" x="30" y="21" />
      <rect fill="#1e2a34" height="3.5" rx="1.75" width="180" x="32" y="22.5" />

      {/* Output tray the label drops onto */}
      <rect fill="#9dabb9" height="11" opacity="0.45" rx="5.5" width="180" x="32" y="56" />

      {/* Printed ticket emerging from the slot */}
      {hasTicket ? (
        <g className="drop-shadow-[0_4px_8px_rgba(15,23,42,0.22)]" data-testid={ticketTestId}>
          <path d={buildTicketPath()} fill="url(#lims-printer-paper)" stroke="#b8c4d0" strokeWidth="1" />
          {BARCODE_BARS.map(([offset, width]) => (
            <rect fill="#334155" height="15" key={offset} width={width} x={58 + offset} y={31} />
          ))}
          <rect fill="#94a3b8" height="3" rx="1.5" width="94" x="58" y="50" />
          <rect fill="#cbd5e1" height="2.5" rx="1.25" width="58" x="58" y="56" />
        </g>
      ) : null}

      {/* Slot lip, drawn over the paper so the ticket reads as coming out */}
      <rect fill="#5c6c7a" height="3" rx="1.5" opacity="0.9" width="184" x="30" y="26" />

      {/* Feed key + status lamp */}
      <rect fill="#b3c0cc" height="20" rx="7" stroke="#7d8d9c" strokeWidth="1.2" width="46" x="248" y="10" />
      <text
        fill="#465563"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontSize="7"
        fontWeight="700"
        letterSpacing="0.14em"
        textAnchor="middle"
        x="271"
        y="24"
      >
        FEED
      </text>
      <circle cx="316" cy="20" fill={hasTicket ? "#22c55e" : "#94a3b8"} opacity={hasTicket ? "0.95" : "0.5"} r="5" />
      {[0, 1, 2].map((index) => (
        <rect fill="#8b9aa8" height="2.5" key={index} opacity="0.55" rx="1.25" width="18" x="326" y={12 + index * 6} />
      ))}
    </svg>
  );
}
