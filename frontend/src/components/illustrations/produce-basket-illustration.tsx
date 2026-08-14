import type { SVGProps } from "react";

type ProduceBasketIllustrationProps = SVGProps<SVGSVGElement> & {
  itemCount?: number;
  testId?: string;
};

// Same silhouette as the apple lot glyph so both illustrations read as one family.
const APPLE_BODY =
  "M33 32C22 32 14 42 14 54C14 69 26 80 40 80C46 80 50 77 54 77C58 77 62 80 68 80C82 80 90 68 90 54C90 42 82 32 71 32C62 32 58 37 52 37C46 37 42 32 33 32Z";

const BASKET_BODY =
  "M76 100H244L228 176C226 188 216 196 204 196H116C104 196 94 188 92 176L76 100Z";

type BasketAppleProps = {
  gradientId: string;
  scale: number;
  x: number;
  y: number;
};

/** One apple, centred on (x, y) at the requested scale. */
function BasketApple({ gradientId, scale, x, y }: BasketAppleProps) {
  return (
    <g transform={`translate(${x - 52 * scale} ${y - 56 * scale}) scale(${scale})`}>
      <path d="M49 31C50 29 53 28 55 29" stroke="#166534" strokeLinecap="round" strokeWidth="3" />
      <path d={APPLE_BODY} fill={`url(#${gradientId})`} stroke="#7f1d1d" strokeLinejoin="round" strokeWidth="3.4" />
      <path d="M48 27C51 23 56 20 61 19" stroke="#65a30d" strokeLinecap="round" strokeWidth="4" />
      <ellipse cx="37" cy="47" fill="#fca5a5" opacity="0.5" rx="9" ry="6" />
    </g>
  );
}

export function ProduceBasketIllustration({
  className,
  itemCount = 6,
  testId = "produce-basket-illustration",
  ...props
}: ProduceBasketIllustrationProps) {
  return (
    <svg
      className={className}
      data-item-count={itemCount}
      data-testid={testId}
      fill="none"
      viewBox="0 0 320 220"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <defs>
        <linearGradient id="produce-basket-body" x1="160" x2="160" y1="100" y2="196" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d9a05f" offset="0" />
          <stop stopColor="#a86a2c" offset="1" />
        </linearGradient>
        <linearGradient id="produce-basket-rim" x1="160" x2="160" y1="88" y2="108" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e3b276" offset="0" />
          <stop stopColor="#b97c37" offset="1" />
        </linearGradient>
        <linearGradient id="produce-basket-apple-left" x1="52" x2="52" y1="32" y2="80" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fb7185" />
          <stop offset="1" stopColor="#dc2626" />
        </linearGradient>
        <linearGradient id="produce-basket-apple-mid" x1="52" x2="52" y1="32" y2="80" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f87171" />
          <stop offset="1" stopColor="#b91c1c" />
        </linearGradient>
        <linearGradient id="produce-basket-apple-right" x1="52" x2="52" y1="32" y2="80" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fda4af" />
          <stop offset="1" stopColor="#e11d48" />
        </linearGradient>
        <clipPath id="produce-basket-weave">
          <path d={BASKET_BODY} />
        </clipPath>
      </defs>

      <ellipse cx="160" cy="198" fill="#0f172a" fillOpacity="0.09" rx="88" ry="12" />

      {/* Carrying handle, behind the fruit */}
      <path
        d="M112 96C112 54 133 26 160 26C187 26 208 54 208 96"
        fill="none"
        stroke="#a86a2c"
        strokeLinecap="round"
        strokeWidth="9"
      />
      <path
        d="M118 92C118 60 136 34 160 34"
        fill="none"
        opacity="0.55"
        stroke="#e3b276"
        strokeLinecap="round"
        strokeWidth="3"
      />

      {/* Fruit resting in the basket */}
      <BasketApple gradientId="produce-basket-apple-left" scale={0.78} x={122} y={84} />
      <BasketApple gradientId="produce-basket-apple-right" scale={0.74} x={202} y={88} />
      <BasketApple gradientId="produce-basket-apple-mid" scale={0.84} x={162} y={74} />

      {/* Basket body */}
      <path d={BASKET_BODY} fill="url(#produce-basket-body)" stroke="#7c4a16" strokeLinejoin="round" strokeWidth="3" />

      {/* Wicker weave */}
      <g clipPath="url(#produce-basket-weave)">
        {[112, 138, 164].map((y) => (
          <rect fill="#7c4a16" height="11" key={y} opacity="0.22" width="200" x="60" y={y} />
        ))}
        {[88, 114, 140, 166, 192, 218].map((x) => (
          <rect fill="#7c4a16" height="110" key={x} opacity="0.16" width="7" x={x} y="100" />
        ))}
        {[100, 126, 152, 178].map((y) => (
          <rect fill="#f0c48d" height="3" key={y} opacity="0.35" width="200" x="60" y={y} />
        ))}
        <rect fill="#ffffff" height="100" opacity="0.16" width="18" x="86" y="100" />
      </g>

      {/* Rim */}
      <rect
        fill="url(#produce-basket-rim)"
        height="20"
        rx="10"
        stroke="#7c4a16"
        strokeWidth="3"
        width="180"
        x="70"
        y="88"
      />
      <path d="M84 94H236" opacity="0.4" stroke="#f7dcb8" strokeLinecap="round" strokeWidth="3" />

      {/* Handle roots, clamped onto the rim */}
      <rect fill="#8a5a20" height="14" rx="4" width="12" x="106" y="90" />
      <rect fill="#8a5a20" height="14" rx="4" width="12" x="202" y="90" />
    </svg>
  );
}
