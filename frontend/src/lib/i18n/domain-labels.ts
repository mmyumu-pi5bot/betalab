import type { Translate } from "./i18n-context";
import { enMessages, type MessageKey } from "./messages/en";

// The API keeps sending the English label it has always sent. These helpers take
// the stable id next to it — catalogue id, widget type, slot id — and prefer the
// catalogue entry when one exists, so an id the backend adds later degrades to
// its English label instead of rendering a raw key.
function translateOrFallback(t: Translate, key: string, fallback: string): string {
  return Object.hasOwn(enMessages, key) ? t(key as MessageKey) : fallback;
}

// A handful of labels the backend writes itself rather than copying from the
// catalogue — the received bag and its subtitle. They arrive as plain English
// text with no id beside them, so the reverse map is built from the English
// catalogue and can never drift from what the backend sends.
const freeLabelKeys: MessageKey[] = ["label.receivedSamplingBag", "label.fieldReception"];

const freeLabelKeyByEnglish = new Map<string, MessageKey>(
  freeLabelKeys.map((key) => [enMessages[key], key]),
);

// The catalogue name is only substituted when the backend sent that very name:
// a container someone relabelled keeps the label it was given.
function translateDefaultOrFree(t: Translate, key: string, provided: string): string {
  if (Object.hasOwn(enMessages, key) && enMessages[key as MessageKey] === provided) {
    return t(key as MessageKey);
  }
  const freeKey = freeLabelKeyByEnglish.get(provided);
  return freeKey ? t(freeKey) : provided;
}

export function translateCatalogName(t: Translate, itemId: string, fallback: string): string {
  for (const family of ["tool", "liquid", "widget", "label"]) {
    const key = `catalog.${family}.${itemId}.name`;
    if (Object.hasOwn(enMessages, key)) {
      return translateDefaultOrFree(t, key, fallback);
    }
  }
  return fallback;
}

export function translateCatalogSubtitle(t: Translate, itemId: string, fallback: string): string {
  for (const family of ["tool", "liquid", "widget", "label"]) {
    const key = `catalog.${family}.${itemId}.subtitle`;
    if (Object.hasOwn(enMessages, key)) {
      return translateDefaultOrFree(t, key, fallback);
    }
  }
  return fallback;
}

export function translateCatalogDescription(
  t: Translate,
  itemId: string,
  fallback: string,
): string {
  for (const family of ["tool", "liquid", "widget", "label"]) {
    const key = `catalog.${family}.${itemId}.description`;
    if (Object.hasOwn(enMessages, key)) {
      return translateDefaultOrFree(t, key, fallback);
    }
  }
  return fallback;
}

export function translateCatalogCategoryLabel(
  t: Translate,
  categoryId: string,
  fallback: string,
): string {
  return translateOrFallback(t, `catalog.category.${categoryId}.label`, fallback);
}

export function translateCatalogCategoryDescription(
  t: Translate,
  categoryId: string,
  fallback: string,
): string {
  return translateOrFallback(t, `catalog.category.${categoryId}.description`, fallback);
}

// A placed tool carries the catalogue id it was built from, so its bench card
// reads in the learner's language even though the instance label is persisted.
export function translateToolLabel(
  t: Translate,
  tool: { toolId?: string; label: string },
): string {
  return tool.toolId ? translateCatalogName(t, tool.toolId, tool.label) : tool.label;
}

export function translateToolSubtitle(
  t: Translate,
  tool: { toolId?: string; subtitle: string },
): string {
  return tool.toolId ? translateCatalogSubtitle(t, tool.toolId, tool.subtitle) : tool.subtitle;
}

export function translateWidgetLabel(
  t: Translate,
  widget: { widgetType?: string; label: string },
): string {
  return widget.widgetType
    ? translateDefaultOrFree(t, `widget.${widget.widgetType}`, widget.label)
    : widget.label;
}

const benchSlotPattern = /^station_(\d+)$/;
const rackSlotPattern = /^rack_slot_(\d+)$/;

export function translateWorkbenchSlotLabel(
  t: Translate,
  slot: { id: string; label: string },
): string {
  const index = benchSlotPattern.exec(slot.id)?.[1];
  return index ? t("slot.bench", { index }) : slot.label;
}

export function translateRackSlotLabel(t: Translate, slot: { id: string; label: string }): string {
  const index = rackSlotPattern.exec(slot.id)?.[1];
  return index ? t("slot.rack", { index }) : slot.label;
}

// Produce lots are named by the backend from a structured code so a French
// session shows "Lot de pommes 2" rather than the persisted English label.
export function translateProduceLotLabel(
  t: Translate,
  produceLot: { label: string; labelCode?: string | null; labelIndex?: number | null },
): string {
  switch (produceLot.labelCode) {
    case "apple_lot":
      return t("produce.appleLot", { index: produceLot.labelIndex ?? 1 });
    case "orchard_apple_lot":
      return t("produce.orchardAppleLot");
    case "apple":
      return t("produce.apple");
    case "apple_powder_lot":
      return t("produce.applePowderLot");
    default:
      return produceLot.label;
  }
}

// Draft dialogs name the liquid being dosed; the catalogue entry carries the id
// the translation is keyed by, and an unknown liquid falls back to a generic noun.
export function translateLiquidDefinitionName(
  t: Translate,
  definition: { id: string; name: string } | undefined,
): string {
  return definition ? translateCatalogName(t, definition.id, definition.name) : t("draft.liquidFallback");
}

export function translateLimsStatus(t: Translate, status: string): string {
  return translateOrFallback(t, `lims.status.${status}`, status.replaceAll("_", " "));
}

export function translateExperimentStatus(t: Translate, status: string): string {
  return translateOrFallback(t, `status.${status}`, status);
}
