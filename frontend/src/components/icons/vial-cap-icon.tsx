type VialCapIconProps = {
  className?: string;
};

/**
 * A vial neck with its cap seated on it — the action that closes a vial.
 */
export function VialCappedIcon({ className }: VialCapIconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 20 20">
      <rect
        height="3.5"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
        width="9"
        x="5.5"
        y="4.25"
      />
      <path
        d="M7 7.75V13.5C7 14.6046 7.89543 15.5 9 15.5H11C12.1046 15.5 13 14.6046 13 13.5V7.75"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

/**
 * The same vial with its cap lifted clear of the neck — the action that opens it.
 */
export function VialUncappedIcon({ className }: VialCapIconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 20 20">
      <rect
        height="3"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
        width="9"
        x="5.5"
        y="1.75"
      />
      <path
        d="M7 6.5V13.5C7 14.6046 7.89543 15.5 9 15.5H11C12.1046 15.5 13 14.6046 13 13.5V6.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
      <path d="M6 6.5H14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}
