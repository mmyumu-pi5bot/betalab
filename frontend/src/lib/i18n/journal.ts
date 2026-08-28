import type { JournalParam, JournalRef } from "@/types/experiment";

import {
  translateCatalogName,
  translateProduceLotLabel,
} from "./domain-labels";
import { interpolate, type MessageParams } from "./format";
import type { Translate } from "./i18n-context";
import { defaultLocale, type Locale } from "./locale";
import { translateLocationLabel } from "./localize-experiment";
import { enMessages, type MessageKey } from "./messages/en";

/** The part of a journal entry that carries its wording. */
export type JournalMessage = {
  message: string;
  code: string | null;
  params: Record<string, JournalParam>;
};

const benchSlotPattern = /^station_(\d+)$/;
const rackSlotPattern = /^rack_slot_(\d+)$/;

function isRef(value: JournalParam): value is JournalRef {
  return typeof value === "object" && value !== null && "kind" in value;
}

// The backend names the entities in a message by id, so the sentence can be
// rebuilt in another language instead of having its labels parsed back out.
function translateRef(t: Translate, ref: JournalRef): string {
  switch (ref.kind) {
    case "tool":
    case "liquid":
      return translateCatalogName(t, ref.id, ref.text);
    case "widget":
      return Object.hasOwn(enMessages, `widget.${ref.id}`)
        ? t(`widget.${ref.id}` as MessageKey)
        : ref.text;
    case "slot": {
      const benchIndex = benchSlotPattern.exec(ref.id)?.[1];
      if (benchIndex) {
        return t("slot.bench", { index: benchIndex });
      }
      const rackIndex = rackSlotPattern.exec(ref.id)?.[1];
      return rackIndex ? t("slot.rack", { index: rackIndex }) : ref.text;
    }
    case "produce":
      return translateProduceLotLabel(t, {
        label: ref.text,
        labelCode: ref.id,
        labelIndex: ref.index ?? null,
      });
    default:
      // A location the backend only knows as text: the reverse map catches the
      // ones it recognises and leaves the rest as sent.
      return translateLocationLabel(t, ref.text);
  }
}

/**
 * The journal sentence in the reader's language.
 *
 * English is read straight off the entry: the backend already rendered it, and
 * duplicating that wording here would only give the two copies a chance to
 * drift. Anything the catalogue does not know — an entry from before the
 * journal was structured, or a code added on the backend and not yet
 * translated — falls back to the same English text rather than to a raw key.
 */
export function translateJournalEntry(
  t: Translate,
  locale: Locale,
  entry: JournalMessage,
): string {
  if (locale === defaultLocale || !entry.code) {
    return entry.message;
  }
  const key = `journal.${entry.code}`;
  if (!Object.hasOwn(enMessages, key)) {
    return entry.message;
  }
  const params: MessageParams = {};
  for (const [name, value] of Object.entries(entry.params)) {
    params[name] = isRef(value) ? translateRef(t, value) : value;
  }
  return interpolate(t(key as MessageKey), params);
}
