"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";

import { interpolate, type MessageParams } from "./format";
import { defaultLocale, resolveInitialLocale, writeStoredLocale, type Locale } from "./locale";
import { enMessages, type MessageKey, type PluralKey } from "./messages/en";
import { frMessages } from "./messages/fr";

const catalogs: Record<Locale, Record<MessageKey, string>> = {
  en: enMessages,
  fr: frMessages,
};

// The chosen locale lives outside React rather than in a context: pure modules
// that build user-facing text (drop-draft builders, the tutorial engine) need to
// read it too, and every component subscribes to the same store, so there is no
// provider to forget. Reading localStorage during the first render instead would
// make the server and client markup disagree, hence the store snapshot pair.
type LocaleStore = {
  get: () => Locale;
  set: (locale: Locale) => void;
  subscribe: (listener: () => void) => () => void;
};

function createLocaleStore(): LocaleStore {
  let current: Locale | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => {
      current ??= resolveInitialLocale();
      return current;
    },
    set: (locale: Locale) => {
      if (current === locale) {
        return;
      }
      current = locale;
      writeStoredLocale(locale);
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const localeStore = createLocaleStore();

export type Translate = (key: MessageKey, params?: MessageParams) => string;

// English treats zero as plural ("0 sessions"), French as singular ("0 session"),
// so the count-to-form mapping has to be per locale rather than a shared `n === 1`.
export type TranslatePlural = (
  key: PluralKey,
  count: number,
  params?: MessageParams,
) => string;

function pluralForm(locale: Locale, count: number): "one" | "other" {
  const magnitude = Math.abs(count);
  if (locale === "fr") {
    return magnitude < 2 ? "one" : "other";
  }
  return magnitude === 1 ? "one" : "other";
}

function translateWith(locale: Locale): Translate {
  const catalog = catalogs[locale];
  const fallback = catalogs[defaultLocale];
  return (key, params) => interpolate(catalog[key] ?? fallback[key] ?? key, params);
}

function pluralTranslateWith(locale: Locale): TranslatePlural {
  const translate = translateWith(locale);
  return (key, count, params) =>
    translate(`${key}.${pluralForm(locale, count)}` as MessageKey, { count, ...params });
}

export type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
  tn: TranslatePlural;
};

export function useI18n(): I18nContextValue {
  const locale = useSyncExternalStore(
    localeStore.subscribe,
    localeStore.get,
    () => defaultLocale,
  );
  const setLocale = useCallback((next: Locale) => {
    localeStore.set(next);
  }, []);
  return useMemo(
    () => ({
      locale,
      setLocale,
      t: translateWith(locale),
      tn: pluralTranslateWith(locale),
    }),
    [locale, setLocale],
  );
}

export function useT(): Translate {
  return useI18n().t;
}

export function useTn(): TranslatePlural {
  return useI18n().tn;
}

export function useLocale(): Locale {
  return useI18n().locale;
}

/** Keeps the document language in step with the learner's choice. */
export function I18nProvider({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  // The document is served with the default `lang`; the stored preference only
  // becomes readable once hydration has run.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return <>{children}</>;
}

export function getTranslator(locale: Locale): Translate {
  return translateWith(locale);
}

export function getPluralTranslator(locale: Locale): TranslatePlural {
  return pluralTranslateWith(locale);
}

export function getCurrentLocale(): Locale {
  return localeStore.get();
}

// Escape hatch for pure modules that build user-facing text outside the React
// tree — drop-draft builders, the tutorial engine. Anything rendered from it must
// be produced inside a component that subscribes through `useT`, or a language
// switch will not reach the screen.
export function translateNow(key: MessageKey, params?: MessageParams): string {
  return translateWith(localeStore.get())(key, params);
}

export function translateNowPlural(
  key: PluralKey,
  count: number,
  params?: MessageParams,
): string {
  return pluralTranslateWith(localeStore.get())(key, count, params);
}
