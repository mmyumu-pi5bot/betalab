"use client";

import { useEffect, useState } from "react";

type Props = {
  className?: string;
  label: string;
  labelClassName?: string;
  onChange: (value: number) => void;
  value: number;
};

/**
 * A numeric field that survives being typed into.
 *
 * `<input type="number">` reports an empty string for any intermediate state the
 * HTML spec considers invalid — "343." on the way to "343.7" is one, and so is a
 * momentarily cleared field. Parsing the event value directly therefore collapses
 * the field to 0, which makes a fractional value impossible to enter and trips
 * every "must be positive" rule on the way.
 *
 * Holding the raw text here keeps the keystrokes; the parsed number is pushed up
 * only when there is one.
 */
export function NumericField({
  className,
  label,
  labelClassName,
  onChange,
  value,
}: Props) {
  const [text, setText] = useState(() => String(value));

  useEffect(() => {
    // Adopt a change that came from outside, but never fight the user mid-word:
    // "343." parses to the value already held, so it must survive the round trip.
    if (text.trim() === "") return;
    if (Number(text) !== value) setText(String(value));
  }, [text, value]);

  return (
    <label className={labelClassName}>
      {label}
      <input
        aria-label={label}
        className={className}
        inputMode="decimal"
        onChange={(event) => {
          const raw = event.target.value;
          setText(raw);
          const parsed = Number(raw);
          if (raw.trim() !== "" && Number.isFinite(parsed)) onChange(parsed);
        }}
        type="text"
        value={text}
      />
    </label>
  );
}
