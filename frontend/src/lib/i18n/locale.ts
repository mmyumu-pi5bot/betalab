// Supported interface languages. English is the source catalogue: every other
// locale is type-checked against it, so a missing translation is a build error
// rather than a silent English string in the middle of a French screen.
export const locales = ["en", "fr"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

// Bumped into its own constant because both the provider and the pre-hydration
// inline script in the root layout have to agree on it.
export const localeStorageKey = "betalab.locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

export const localeNames: Record<Locale, string> = {
  en: "English",
  fr: "Français",
};

export function readStoredLocale(): Locale | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const stored = window.localStorage.getItem(localeStorageKey);
    return isLocale(stored) ? stored : null;
  } catch {
    // Private browsing and storage-blocking settings throw on access rather
    // than returning null; an unreadable preference is simply no preference.
    return null;
  }
}

export function writeStoredLocale(locale: Locale): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(localeStorageKey, locale);
  } catch {
    // A locale we cannot persist still applies to the current session.
  }
}

// Only consulted when the learner has never chosen a language on this browser.
export function detectBrowserLocale(): Locale | null {
  if (typeof navigator === "undefined") {
    return null;
  }
  const candidates = navigator.languages ?? [navigator.language];
  for (const candidate of candidates) {
    const base = candidate?.split("-")[0]?.toLowerCase();
    if (isLocale(base)) {
      return base;
    }
  }
  return null;
}

export function resolveInitialLocale(): Locale {
  return readStoredLocale() ?? detectBrowserLocale() ?? defaultLocale;
}
