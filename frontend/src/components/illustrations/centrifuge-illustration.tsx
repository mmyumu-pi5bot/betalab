type CentrifugeIllustrationProps = {
  className?: string;
  hasTube: boolean;
  isRunning: boolean;
  separationProgress: number;
};

export function CentrifugeIllustration({
  className,
  hasTube,
  isRunning,
  separationProgress,
}: CentrifugeIllustrationProps) {
  const progress = Math.max(0, Math.min(separationProgress, 1));
  const supernatantHeight = 42 - progress * 8;
  const pelletHeight = progress * 10;

  return (
    <svg
      aria-label="Benchtop centrifuge"
      className={className}
      data-testid="centrifuge-illustration"
      role="img"
      viewBox="0 0 360 220"
    >
      <defs>
        <linearGradient id="centrifuge-body" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#e7eef3" />
          <stop offset="1" stopColor="#9fb2c0" />
        </linearGradient>
      </defs>
      <rect fill="url(#centrifuge-body)" height="128" rx="24" stroke="#647989" strokeWidth="3" width="294" x="33" y="72" />
      <ellipse cx="180" cy="79" fill="#dbe7ed" rx="124" ry="61" stroke="#647989" strokeWidth="4" />
      <ellipse
        className={isRunning ? "origin-center animate-spin" : undefined}
        cx="180"
        cy="81"
        fill="#415563"
        rx="88"
        ry="39"
        stroke="#263844"
        strokeWidth="3"
        style={{ animationDuration: "0.45s" }}
      />
      {[0, 90, 180, 270].map((angle) => (
        <g key={angle} transform={`rotate(${angle} 180 81)`}>
          <rect fill="#172833" height="26" rx="8" width="18" x="171" y="48" />
        </g>
      ))}
      {hasTube ? (
        <g data-testid="centrifuge-visible-phases">
          <path d="M171 39h18l-2 47c-.5 10-13.5 10-14 0z" fill="#f8fafc" opacity=".9" stroke="#0f6f86" strokeWidth="2" />
          <rect
            fill="#f7c65b"
            height={supernatantHeight}
            opacity=".72"
            width="12"
            x="174"
            y={82 - supernatantHeight}
          />
          <path
            d={`M174 ${82 - pelletHeight}h12l-1 7c-2 5-8 5-10 0z`}
            fill="#8b5e34"
            opacity={progress}
          />
        </g>
      ) : null}
      <rect fill="#1f343f" height="48" rx="8" width="116" x="122" y="132" />
      <text fill="#bfffd7" fontFamily="monospace" fontSize="15" textAnchor="middle" x="180" y="154">
        {isRunning ? "4000 RPM" : "READY"}
      </text>
      <text fill="#8ee6ff" fontFamily="monospace" fontSize="10" textAnchor="middle" x="180" y="170">
        {Math.round(progress * 100)}% SEPARATED
      </text>
    </svg>
  );
}
