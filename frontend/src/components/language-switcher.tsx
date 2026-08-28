"use client";

import { useEffect, useId, useRef, useState, type ReactElement } from "react";

import { localeNames, locales, useI18n, type Locale } from "@/lib/i18n";

type LanguageSwitcherProps = {
  className?: string;
};

// Drawn rather than written with emoji: the regional-indicator flag characters
// are not rendered by Chrome on Windows, where they fall back to the bare
// letter pair — which is exactly what the flags are here to replace.
function FrenchFlag() {
  return (
    <svg aria-hidden="true" className="h-full w-full" viewBox="0 0 60 40">
      <rect fill="#0055a4" height="40" width="20" />
      <rect fill="#ffffff" height="40" width="20" x="20" />
      <rect fill="#ef4135" height="40" width="20" x="40" />
    </svg>
  );
}

function BritishFlag() {
  // The saltire's red diagonals are offset, so each quadrant is clipped to its
  // own half — without that the flag reads as a plain X and stops being the
  // Union Jack.
  const clipId = useId();
  return (
    <svg aria-hidden="true" className="h-full w-full" viewBox="0 0 60 40">
      <clipPath id={clipId}>
        <path d="M30,20 h30 v20 z v20 h-30 z h-30 v-20 z v-20 h30 z" />
      </clipPath>
      <rect fill="#012169" height="40" width="60" />
      <path d="M0,0 L60,40 M60,0 L0,40" stroke="#ffffff" strokeWidth="8" />
      <path
        clipPath={`url(#${clipId})`}
        d="M0,0 L60,40 M60,0 L0,40"
        stroke="#c8102e"
        strokeWidth="5"
      />
      <path d="M30,0 v40 M0,20 h60" stroke="#ffffff" strokeWidth="13" />
      <path d="M30,0 v40 M0,20 h60" stroke="#c8102e" strokeWidth="8" />
    </svg>
  );
}

const flags: Record<Locale, () => ReactElement> = {
  en: BritishFlag,
  fr: FrenchFlag,
};

function Flag({ locale }: { locale: Locale }) {
  const Shape = flags[locale];
  return (
    <span className="h-3.5 w-5 shrink-0 overflow-hidden rounded-[2px] shadow-[0_0_0_1px_rgba(15,23,42,0.12)]">
      <Shape />
    </span>
  );
}

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`h-3 w-3 shrink-0 text-stone-400 transition-transform ${
        isOpen ? "rotate-180" : ""
      }`}
      fill="none"
      viewBox="0 0 12 12"
    >
      <path
        d="m3 4.5 3 3 3-3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 14 14">
      <path
        d="m2.5 7.5 3 3 6-7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

/**
 * Language picker: the current flag and language name, opening a short list of
 * the rest. The choice is remembered by the browser for every later session.
 *
 * The options are plain buttons rather than a listbox taxonomy: a native
 * `<select>` cannot draw a flag, and borrowing option/listbox roles without the
 * focus management they imply reads worse to a screen reader than the buttons
 * actually rendered.
 */
export function LanguageSwitcher({ className = "" }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && containerRef.current?.contains(event.target)) {
        return;
      }
      setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  const close = (returnFocus: boolean) => {
    setIsOpen(false);
    if (returnFocus) {
      triggerRef.current?.focus();
    }
  };

  const moveFocus = (from: number, delta: number) => {
    const options = optionRefs.current.filter((option) => option !== null);
    if (options.length === 0) {
      return;
    }
    const next = (from + delta + options.length) % options.length;
    options[next]?.focus();
  };

  return (
    <div
      className={`relative ${className}`.trim()}
      onKeyDown={(event) => {
        if (isOpen && event.key === "Escape") {
          event.preventDefault();
          close(true);
        }
      }}
      ref={containerRef}
    >
      <button
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="inline-flex h-9 items-center gap-2 rounded-full border border-stone-200 bg-white pl-2.5 pr-2 text-xs font-semibold text-stone-700 shadow-sm transition hover:border-stone-300 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-300"
        data-testid="language-switcher-trigger"
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !isOpen) {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
        ref={triggerRef}
        type="button"
      >
        <Flag locale={locale} />
        <span>{localeNames[locale]}</span>
        <ChevronIcon isOpen={isOpen} />
      </button>

      {isOpen ? (
        <div
          aria-label={t("language.label")}
          className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-2xl border border-stone-200 bg-white p-1 shadow-[0_16px_40px_rgba(28,25,23,0.16)]"
          role="group"
        >
          {locales.map((candidate, index) => {
            const isActive = candidate === locale;
            return (
              <button
                aria-pressed={isActive}
                className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition ${
                  isActive ? "bg-stone-100 font-semibold text-stone-900" : "text-stone-700 hover:bg-stone-50"
                }`}
                key={candidate}
                onClick={() => {
                  setLocale(candidate);
                  close(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    moveFocus(index, 1);
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    moveFocus(index, -1);
                  }
                }}
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                type="button"
              >
                <Flag locale={candidate} />
                <span className="flex-1">{localeNames[candidate]}</span>
                {isActive ? <CheckIcon /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
