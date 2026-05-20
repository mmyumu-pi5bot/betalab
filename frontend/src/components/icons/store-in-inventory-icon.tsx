type StoreInInventoryIconProps = {
  className?: string;
};

export function StoreInInventoryIcon({ className }: StoreInInventoryIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 20 20"
    >
      <path
        d="M5.75 4.75H12.5C12.9142 4.75 13.25 5.08579 13.25 5.5V14.5C13.25 14.9142 12.9142 15.25 12.5 15.25H5.75C5.33579 15.25 5 14.9142 5 14.5V5.5C5 5.08579 5.33579 4.75 5.75 4.75Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M10.25 7L7.25 10L10.25 13"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M15.5 10H7.75"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}
