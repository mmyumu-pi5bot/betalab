export { interpolate, type MessageParams, type MessageValue } from "./format";
export { translateJournalEntry, type JournalMessage } from "./journal";
export {
  getCurrentLocale,
  getPluralTranslator,
  getTranslator,
  I18nProvider,
  useI18n,
  useLocale,
  useT,
  translateNow,
  translateNowPlural,
  useTn,
  type I18nContextValue,
  type Translate,
  type TranslatePlural,
} from "./i18n-context";
export {
  defaultLocale,
  isLocale,
  localeNames,
  locales,
  localeStorageKey,
  resolveInitialLocale,
  type Locale,
} from "./locale";
export { type MessageKey, type PluralKey } from "./messages/en";
export {
  translateCatalogCategoryDescription,
  translateCatalogCategoryLabel,
  translateCatalogDescription,
  translateCatalogName,
  translateCatalogSubtitle,
  translateExperimentStatus,
  translateLimsStatus,
  translateLiquidDefinitionName,
  translateProduceLotLabel,
  translateRackSlotLabel,
  translateToolLabel,
  translateToolSubtitle,
  translateWidgetLabel,
  translateWorkbenchSlotLabel,
} from "./domain-labels";
