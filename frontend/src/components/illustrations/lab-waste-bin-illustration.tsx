import type { SVGProps } from "react";

type LabWasteBinIllustrationProps = SVGProps<SVGSVGElement> & {
  hasItems?: boolean;
  isOpen?: boolean;
  testId?: string;
};

const BIN_BODY =
  "M27 48H93L85 128C84 136.5 77 143 68.5 143H51.5C43 143 36 136.5 35 128L27 48Z";

export function LabWasteBinIllustration({
  className,
  hasItems = false,
  isOpen = false,
  testId = "lab-waste-bin-illustration",
  ...props
}: LabWasteBinIllustrationProps) {
  return (
    <svg
      aria-label="Laboratory waste bin"
      className={className}
      data-has-items={hasItems}
      data-open={isOpen}
      data-testid={testId}
      fill="none"
      viewBox="0 0 120 156"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <defs>
        <linearGradient id="waste-bin-body" x1="27" x2="93" y1="48" y2="143" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f4f7fa" offset="0" />
          <stop stopColor="#b9c6d2" offset="1" />
        </linearGradient>
        <linearGradient id="waste-bin-lid" x1="20" x2="100" y1="18" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#dbe4ec" offset="0" />
          <stop stopColor="#93a5b4" offset="1" />
        </linearGradient>
        <linearGradient id="waste-bin-liner" x1="60" x2="60" y1="40" y2="70" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fbcfe8" offset="0" />
          <stop stopColor="#f0abcf" offset="1" />
        </linearGradient>
        <clipPath id="waste-bin-clip">
          <path d={BIN_BODY} />
        </clipPath>
      </defs>

      <ellipse cx="60" cy="145" fill="#0f172a" fillOpacity="0.09" rx="40" ry="7" />

      {/* Bin body */}
      <path d={BIN_BODY} fill="url(#waste-bin-body)" stroke="#6f8494" strokeWidth="2" />
      <g clipPath="url(#waste-bin-clip)">
        {[38, 52, 66, 80].map((x) => (
          <rect fill="#8fa3b3" height="110" key={x} opacity="0.16" rx="2" width="4" x={x} y="48" />
        ))}
        <rect fill="#ffffff" height="110" opacity="0.4" rx="3" width="7" x="33" y="48" />
        {/* Waste band */}
        <rect fill="#e8a9c1" height="13" opacity="0.6" width="80" x="20" y="84" />
        <rect fill="#0f172a" height="1.2" opacity="0.1" width="80" x="20" y="84" />
        <rect fill="#0f172a" height="1.2" opacity="0.1" width="80" x="20" y="96" />
      </g>

      {/* Waste label plate */}
      <rect fill="#ffffff" height="18" opacity="0.92" rx="4" stroke="#93a5b4" strokeWidth="1.2" width="42" x="39" y="103" />
      <path d="M47 110H73" stroke="#94a3b8" strokeLinecap="round" strokeWidth="2.4" />
      <path d="M47 116H65" stroke="#c3ced9" strokeLinecap="round" strokeWidth="2.4" />

      {/* Bin mouth + liner, revealed when the lid tips open */}
      <ellipse cx="60" cy="46" fill="#334155" rx="33" ry="8" />
      <ellipse cx="60" cy="46" fill={hasItems ? "url(#waste-bin-liner)" : "#1e293b"} rx="27" ry="6" />

      {/* Lid */}
      <g
        style={{
          transform: isOpen ? "rotate(-17deg)" : "none",
          transformBox: "fill-box",
          transformOrigin: "6% 80%",
          transition: "transform 180ms ease-out",
        }}
      >
        <path
          d="M25 40C25 27 40 20 60 20C80 20 95 27 95 40Z"
          fill="url(#waste-bin-lid)"
          stroke="#5d7181"
          strokeWidth="2"
        />
        <rect fill="#cbd8e2" height="12" rx="6" stroke="#5d7181" strokeWidth="2" width="80" x="20" y="34" />
        <rect fill="#8fa3b3" height="7" rx="3.5" stroke="#5d7181" strokeWidth="1.6" width="26" x="47" y="12" />
      </g>
    </svg>
  );
}
