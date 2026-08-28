import type { SVGProps } from "react";
import { translateNow } from "@/lib/i18n";

type AppleIllustrationProps = SVGProps<SVGSVGElement> & {
  smokeIntensity?: "none" | "light" | "medium" | "heavy";
  testId?: string;
  variant?: "whole" | "cut" | "ground";
};

type AppleClusterProps = {
  smokeIntensity?: "none" | "light" | "medium" | "heavy";
  shadowOpacity?: number;
  variant?: "whole" | "cut" | "ground";
};

function PowderSmoke({ smokeIntensity }: { smokeIntensity: "none" | "light" | "medium" | "heavy" }) {
  if (smokeIntensity === "none") {
    return null;
  }

  const opacity =
    smokeIntensity === "heavy"
      ? 0.95
      : smokeIntensity === "medium"
        ? 0.74
        : 0.52;
  const scale = smokeIntensity === "heavy" ? 1.08 : smokeIntensity === "medium" ? 1 : 0.92;

  return (
    <g opacity={opacity} transform={`translate(${48 - (48 * scale)} ${50 - (50 * scale)}) scale(${scale})`}>
      <path
        d="M29 54C24 48 26 41 33 39C33 33 38 30 43 32C46 27 53 27 56 32C62 31 66 35 66 41C71 43 72 48 69 53"
        fill="url(#apple-powder-smoke)"
      />
      <path
        d="M36 47C33 43 34 38 39 37C40 32 45 31 48 34C52 30 58 32 59 37C64 38 65 43 62 47"
        fill="url(#apple-powder-smoke-core)"
      />
      <path
        d="M44 39C43 36 45 34 48 34C50 31 54 31 56 34C59 34 61 37 60 40"
        fill="none"
        opacity="0.6"
        stroke="#ffffff"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <circle cx="33" cy="50" fill="#ffffff" opacity="0.32" r="2.6" />
      <circle cx="61" cy="50" fill="#e0f2fe" opacity="0.38" r="2.2" />
    </g>
  );
}

export function AppleLotGlyph({
  shadowOpacity = 0.08,
  smokeIntensity = "none",
  variant = "whole",
}: AppleClusterProps) {
  if (variant === "ground") {
    return (
      <>
        <PowderSmoke smokeIntensity={smokeIntensity} />
        <ellipse cx="48" cy="80.5" fill="#0f172a" fillOpacity={shadowOpacity} rx="25" ry="5.2" />
        <path
          d="M23 78L28 71L34 64L41 58L47 53L53 58L59 64L65 71L71 78L62 80H32L23 78Z"
          fill="url(#apple-powder-mound)"
          stroke="#92400e"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3.2"
        />
        <path
          d="M33 68L39 62L47 58L55 63L60 69"
          opacity="0.35"
          stroke="#fef3c7"
          strokeLinecap="round"
          strokeWidth="2.4"
        />
        <path
          d="M31 74C36 72 41 71 47 71C54 71 59 72 65 75"
          opacity="0.4"
          stroke="#fef3c7"
          strokeLinecap="round"
          strokeWidth="2.1"
        />
        <circle cx="35" cy="64" fill="#dc2626" opacity="0.9" r="1.8" />
        <circle cx="42" cy="58" fill="#ef4444" opacity="0.88" r="1.5" />
        <circle cx="49" cy="55" fill="#f87171" opacity="0.82" r="1.3" />
        <circle cx="57" cy="61" fill="#dc2626" opacity="0.82" r="1.7" />
        <circle cx="64" cy="70" fill="#ef4444" opacity="0.75" r="1.4" />
        <circle cx="28" cy="76" fill="#f59e0b" opacity="0.45" r="1.1" />
        <circle cx="38" cy="77" fill="#fde68a" opacity="0.5" r="0.9" />
        <circle cx="56" cy="76" fill="#fde68a" opacity="0.45" r="0.9" />
      </>
    );
  }

  if (variant === "cut") {
    return (
      <>
        <ellipse cx="47" cy="83" fill="#0f172a" fillOpacity={shadowOpacity} rx="26" ry="6" />
        <g opacity="0.82" transform="translate(-8 12) scale(0.72)">
          <path d="M49 31C51 28 54 27 57 28" stroke="#166534" strokeLinecap="round" strokeWidth="3.1" />
          <path
            d="M33 32C22 32 14 42 14 54C14 69 26 80 40 80C46 80 50 77 54 77C58 77 62 80 68 80C82 80 90 68 90 54C90 42 82 32 71 32C62 32 58 37 52 37C46 37 42 32 33 32Z"
            fill="url(#apple-lot-body-left)"
            stroke="#7f1d1d"
            strokeLinejoin="round"
            strokeWidth="5"
          />
        </g>
        <g opacity="0.72" transform="translate(22 8) scale(0.68)">
          <path d="M49 31C51 28 54 27 57 28" stroke="#166534" strokeLinecap="round" strokeWidth="3.1" />
          <path
            d="M33 32C22 32 14 42 14 54C14 69 26 80 40 80C46 80 50 77 54 77C58 77 62 80 68 80C82 80 90 68 90 54C90 42 82 32 71 32C62 32 58 37 52 37C46 37 42 32 33 32Z"
            fill="url(#apple-lot-body-right)"
            stroke="#7f1d1d"
            strokeLinejoin="round"
            strokeWidth="5"
          />
        </g>
        <g transform="translate(6 8)">
          <path d="M42 30C44 24 48 22 51 24" stroke="#166534" strokeLinecap="round" strokeWidth="3" />
          <path
            d="M24 29C15 29 9 37 9 48C9 61 18 71 31 71C36 71 40 68 43 68C46 68 49 71 55 71C67 71 76 61 76 48C76 37 69 29 60 29C52 29 48 34 43 34C38 34 33 29 24 29Z"
            fill="url(#apple-cut-body)"
            stroke="#7f1d1d"
            strokeLinejoin="round"
            strokeWidth="4.2"
          />
          <path d="M43 34V71" stroke="#7f1d1d" strokeWidth="3.6" />
          <path
            d="M43 34C40 31 36 29 31 29C22 29 14 37 14 48C14 60 22 69 33 69C37 69 40 67 43 66V34Z"
            fill="#fff7d6"
            opacity="0.95"
          />
          <path
            d="M43 34C46 31 50 29 55 29C64 29 71 37 71 48C71 60 63 69 52 69C48 69 45 67 43 66V34Z"
            fill="#fef3c7"
            opacity="0.98"
          />
          <path d="M32 45C34 42 38 42 39 45" stroke="#92400e" strokeLinecap="round" strokeWidth="1.7" />
          <circle cx="35" cy="53" fill="#92400e" r="1.7" />
          <path d="M49 45C50 42 54 42 55 45" stroke="#92400e" strokeLinecap="round" strokeWidth="1.7" />
          <circle cx="53" cy="53" fill="#92400e" r="1.7" />
          <path d="M34 44C37 41 40 40 43 39" stroke="#fca5a5" strokeLinecap="round" strokeWidth="2" opacity="0.55" />
          <path d="M43 45C46 42 49 41 52 40" stroke="#fca5a5" strokeLinecap="round" strokeWidth="2" opacity="0.65" />
        </g>
        <g transform="translate(16 58) rotate(-18 12 12)">
          <path
            d="M4 6C4 3.8 5.8 2 8 2H13L20 12L13 22H8C5.8 22 4 20.2 4 18V6Z"
            fill="#fde68a"
            stroke="#92400e"
            strokeLinejoin="round"
            strokeWidth="2.2"
          />
          <path d="M13 2L20 12L13 22" stroke="#92400e" strokeWidth="2.2" />
          <path d="M8 7C10 6 12 6 14 7" stroke="#b45309" strokeLinecap="round" strokeWidth="1.3" opacity="0.7" />
        </g>
      </>
    );
  }

  return (
    <>
      <ellipse cx="49" cy="87" fill="#0f172a" fillOpacity={shadowOpacity} rx="25" ry="6.5" />

      <g transform="translate(-12 8)">
        <path
          d="M49 31C50 29 53 28 55 29"
          stroke="#166534"
          strokeLinecap="round"
          strokeWidth="2.8"
        />
        <path
          d="M33 32C22 32 14 42 14 54C14 69 26 80 40 80C46 80 50 77 54 77C58 77 62 80 68 80C82 80 90 68 90 54C90 42 82 32 71 32C62 32 58 37 52 37C46 37 42 32 33 32Z"
          fill="url(#apple-lot-body-left)"
          stroke="#7f1d1d"
          strokeLinejoin="round"
          strokeWidth="5"
        />
        <path
          d="M48 27C51 23 56 20 61 19"
          stroke="#65a30d"
          strokeLinecap="round"
          strokeWidth="4"
        />
        <ellipse cx="37" cy="47" fill="#FCA5A5" opacity="0.5" rx="9" ry="6" />
      </g>

      <g transform="translate(8 0) scale(0.94)">
        <path
          d="M49 31C50 29 53 28 55 29"
          stroke="#166534"
          strokeLinecap="round"
          strokeWidth="2.8"
        />
        <path
          d="M33 32C22 32 14 42 14 54C14 69 26 80 40 80C46 80 50 77 54 77C58 77 62 80 68 80C82 80 90 68 90 54C90 42 82 32 71 32C62 32 58 37 52 37C46 37 42 32 33 32Z"
          fill="url(#apple-lot-body-right)"
          stroke="#7f1d1d"
          strokeLinejoin="round"
          strokeWidth="5"
        />
        <path
          d="M48 27C51 23 56 20 61 19"
          stroke="#65a30d"
          strokeLinecap="round"
          strokeWidth="4"
        />
        <ellipse cx="37" cy="47" fill="#FCA5A5" opacity="0.5" rx="9" ry="6" />
      </g>

      <g transform="translate(4 18) scale(0.84)">
        <path
          d="M49 31C50 29 53 28 55 29"
          stroke="#166534"
          strokeLinecap="round"
          strokeWidth="2.8"
        />
        <path
          d="M33 32C22 32 14 42 14 54C14 69 26 80 40 80C46 80 50 77 54 77C58 77 62 80 68 80C82 80 90 68 90 54C90 42 82 32 71 32C62 32 58 37 52 37C46 37 42 32 33 32Z"
          fill="url(#apple-lot-body-front)"
          stroke="#7f1d1d"
          strokeLinejoin="round"
          strokeWidth="5"
        />
        <path
          d="M48 27C51 23 56 20 61 19"
          stroke="#65a30d"
          strokeLinecap="round"
          strokeWidth="4"
        />
        <ellipse cx="37" cy="47" fill="#FCA5A5" opacity="0.5" rx="9" ry="6" />
      </g>
    </>
  );
}

export function AppleIllustration({
  className,
  smokeIntensity = "none",
  testId = "apple-illustration",
  variant = "whole",
  ...props
}: AppleIllustrationProps) {
  return (
    <svg
      aria-label={translateNow("illustration.appleLot")}
      className={className}
      data-apple-count="3"
      data-smoke-intensity={smokeIntensity}
      data-variant={variant}
      data-testid={testId}
      fill="none"
      viewBox="0 0 96 96"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <AppleLotGlyph smokeIntensity={smokeIntensity} variant={variant} />
      <defs>
        <linearGradient id="apple-lot-body-left" x1="52" x2="52" y1="32" y2="80">
          <stop stopColor="#fb7185" />
          <stop offset="1" stopColor="#dc2626" />
        </linearGradient>
        <linearGradient id="apple-lot-body-right" x1="52" x2="52" y1="32" y2="80">
          <stop stopColor="#f87171" />
          <stop offset="1" stopColor="#b91c1c" />
        </linearGradient>
        <linearGradient id="apple-lot-body-front" x1="52" x2="52" y1="32" y2="80">
          <stop stopColor="#fb7185" />
          <stop offset="1" stopColor="#dc2626" />
        </linearGradient>
        <linearGradient id="apple-cut-body" x1="43" x2="43" y1="29" y2="71">
          <stop stopColor="#fb7185" />
          <stop offset="1" stopColor="#dc2626" />
        </linearGradient>
        <linearGradient id="apple-powder-mound" x1="46" x2="46" y1="54" y2="80">
          <stop stopColor="#fca5a5" />
          <stop offset="0.48" stopColor="#ef4444" />
          <stop offset="1" stopColor="#b91c1c" />
        </linearGradient>
        <radialGradient id="apple-powder-smoke" cx="0" cy="0" gradientTransform="translate(47 43) rotate(90) scale(14 24)" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.52" stopColor="#e0f2fe" stopOpacity="0.55" />
          <stop offset="1" stopColor="#e2e8f0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="apple-powder-smoke-core" cx="0" cy="0" gradientTransform="translate(48 41) rotate(90) scale(10 17)" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.88" />
          <stop offset="0.6" stopColor="#f8fafc" stopOpacity="0.4" />
          <stop offset="1" stopColor="#e2e8f0" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}
