"use client";

import type { FocusEvent, ChangeEvent } from "react";

const wheelListenerRegistry = new WeakMap<HTMLInputElement, EventListener>();

type InlineQuantityInputProps = {
  ariaLabel: string;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
  onChange: (value: number) => void;
  onFocus?: (event: FocusEvent<HTMLInputElement>) => void;
  inputStep?: number;
  tutorialAnchor?: string;
  unitLabel: string;
  value: number;
  wheelStep?: number;
};

function attachWheelListener(
  input: HTMLInputElement,
  onChange: (value: number) => void,
  wheelStep: number,
) {
  const existingListener = wheelListenerRegistry.get(input);
  if (existingListener) {
    input.removeEventListener("wheel", existingListener);
  }

  const listener: EventListener = (event) => {
    if (!(event instanceof WheelEvent)) {
      return;
    }

    event.preventDefault();

    const direction = Math.sign(event.deltaY);
    if (direction === 0) {
      return;
    }

    const currentValue = Number.parseFloat(input.value);
    const safeCurrentValue = Number.isFinite(currentValue) ? currentValue : 0;
    const delta = direction < 0 ? wheelStep : -wheelStep;
    const nextValue = Number(Math.max(safeCurrentValue + delta, 0).toFixed(3));

    onChange(nextValue);
  };

  input.addEventListener("wheel", listener, { passive: false });
  wheelListenerRegistry.set(input, listener);
}

function detachWheelListener(input: HTMLInputElement) {
  const listener = wheelListenerRegistry.get(input);
  if (!listener) {
    return;
  }

  input.removeEventListener("wheel", listener);
  wheelListenerRegistry.delete(input);
}

export function InlineQuantityInput({
  ariaLabel,
  onBlur,
  onChange,
  onFocus,
  inputStep = 0.1,
  tutorialAnchor,
  unitLabel,
  value,
  wheelStep = 0.1,
}: InlineQuantityInputProps) {
  return (
    <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
      <span className="sr-only">{ariaLabel}</span>
      <input
        aria-label={ariaLabel}
        className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-0 text-right text-[11px] font-semibold text-slate-900 outline-none transition focus:border-slate-400"
        data-tutorial-anchor={tutorialAnchor}
        // Published alongside the anchor so the coach can tell the dialog it is
        // guiding from one the learner opened for something else: an amount in
        // grams has no business being typed into a box measured in mL.
        data-tutorial-unit={tutorialAnchor ? unitLabel : undefined}
        draggable={false}
        min={0}
        onBlur={(event) => {
          detachWheelListener(event.currentTarget);
          onBlur?.(event);
        }}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const parsed = Number.parseFloat(event.target.value);
          onChange(Number.isFinite(parsed) ? parsed : 0);
        }}
        onFocus={(event) => {
          attachWheelListener(event.currentTarget, onChange, wheelStep);
          onFocus?.(event);
        }}
        step={inputStep}
        type="number"
        value={value}
      />
      <span>{unitLabel}</span>
    </label>
  );
}
