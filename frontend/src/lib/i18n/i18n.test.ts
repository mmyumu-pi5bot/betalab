import { beforeEach, describe, expect, it } from "vitest";

import { translateLocationLabel } from "@/lib/i18n/localize-experiment";
import {
  getPluralTranslator,
  getTranslator,
  interpolate,
  isLocale,
  localeStorageKey,
  locales,
  resolveInitialLocale,
  translateCatalogName,
  translateJournalEntry,
  translateProduceLotLabel,
  translateWorkbenchSlotLabel,
} from "@/lib/i18n";
import { enMessages } from "@/lib/i18n/messages/en";
import { frMessages } from "@/lib/i18n/messages/fr";

describe("message catalogues", () => {
  it("translates every English key", () => {
    const untranslated = Object.keys(enMessages).filter(
      (key) => !Object.hasOwn(frMessages, key),
    );
    expect(untranslated).toEqual([]);
  });

  // A French value identical to the English one is almost always a forgotten
  // translation rather than a word the two languages happen to share.
  it("leaves only deliberate look-alikes untranslated", () => {
    const shared = Object.keys(enMessages).filter(
      (key) =>
        enMessages[key as keyof typeof enMessages] ===
        frMessages[key as keyof typeof frMessages],
    );
    const deliberate = new Set([
      "home.brand",
      "lab.brand",
      "journal.short",
      "journal.category.manipulation",
      "journal.category.simulation",
      "catalog.widget.lc_msms_instrument_widget.name",
      "widget.lc_msms_instrument",
      "lims.eyebrow",
      "method.transitions",
      "method.polarityShort",
      "method.dwellShort",
      "method.gradient",
      "method.source",
      "method.phaseA",
      "method.phaseB",
      "editor.simple",
      "editor.version",
      "editor.q1",
      "editor.q3",
      "editor.collisionEnergy",
      "editor.retentionTime",
      "method.collisionEnergyShort",
      "method.retentionShort",
      "editor.dwell",
      "editor.polarityPositive",
      "glossary.q1.term",
      "glossary.q3.term",
      "draft.volume",
      "analyticalBalance.tare",
      "analyticalBalance.net",
      "console.repetitions",
      "coach.pauseShort",
      "tutorial.item.tube",
      "tutorial.tool.pipette",
      "tool.pipette",
      "actionBar.actions",
      "console.position",
      "manager.entrySummary",
      "produce.unitCount.one",
      "slot.rack",
      "home.sessionCount.one",
      "home.sessionCount.other",
    ]);
    expect(shared.filter((key) => !deliberate.has(key))).toEqual([]);
  });
});

describe("interpolate", () => {
  it("substitutes named placeholders", () => {
    expect(interpolate("{count} vials in {slot}", { count: 2, slot: "A1" })).toBe(
      "2 vials in A1",
    );
  });

  it("leaves a placeholder alone when no value is supplied", () => {
    expect(interpolate("{missing} here", { other: 1 })).toBe("{missing} here");
  });
});

describe("plural selection", () => {
  it("treats zero as plural in English and singular in French", () => {
    expect(getPluralTranslator("en")("home.sessionCount", 0)).toBe("0 sessions");
    expect(getPluralTranslator("fr")("home.sessionCount", 0)).toBe("0 session");
  });

  it("agrees on counts above one", () => {
    expect(getPluralTranslator("en")("home.sessionCount", 4)).toBe("4 sessions");
    expect(getPluralTranslator("fr")("home.sessionCount", 4)).toBe("4 sessions");
  });
});

describe("locale resolution", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("accepts only supported locales", () => {
    expect(locales.every(isLocale)).toBe(true);
    expect(isLocale("de")).toBe(false);
  });

  it("prefers the locale stored by a previous session", () => {
    window.localStorage.setItem(localeStorageKey, "fr");
    expect(resolveInitialLocale()).toBe("fr");
  });

  it("ignores a stored value that is not a supported locale", () => {
    window.localStorage.setItem(localeStorageKey, "klingon");
    expect(["en", "fr"]).toContain(resolveInitialLocale());
  });
});

describe("domain labels", () => {
  const fr = getTranslator("fr");

  it("translates a catalogue entry the backend named itself", () => {
    expect(translateCatalogName(fr, "centrifuge_tube_50ml", "50 mL centrifuge tube")).toBe(
      "Tube à centrifuger 50 mL",
    );
  });

  it("keeps a label the backend did not take from the catalogue", () => {
    expect(translateCatalogName(fr, "centrifuge_tube_50ml", "Filled tube")).toBe("Filled tube");
  });

  it("keeps an unknown catalogue id readable", () => {
    expect(translateCatalogName(fr, "unheard_of_tool", "Mystery tool")).toBe("Mystery tool");
  });

  it("renders a produce lot from its structured label", () => {
    expect(
      translateProduceLotLabel(fr, { label: "Apple lot 2", labelCode: "apple_lot", labelIndex: 2 }),
    ).toBe("Lot de pommes 2");
  });

  it("falls back to the sent label when no code accompanies it", () => {
    expect(translateProduceLotLabel(fr, { label: "Some lot" })).toBe("Some lot");
  });

  it("translates bench slots from their id", () => {
    expect(translateWorkbenchSlotLabel(fr, { id: "station_2", label: "Station 2" })).toBe(
      "Poste 2",
    );
  });

  it("translates a location that reaches the UI as bare text", () => {
    expect(translateLocationLabel(fr, "Vortex mixer")).toBe("Agitateur vortex");
    expect(translateLocationLabel(fr, "Position 3")).toBe("Position 3");
    expect(translateLocationLabel(fr, "Somewhere else")).toBe("Somewhere else");
  });
});

describe("journal entries", () => {
  const fr = getTranslator("fr");
  const en = getTranslator("en");

  const toolPlaced = {
    code: "tool_placed",
    message: "50 mL centrifuge tube placed on Station 2.",
    params: {
      tool: { kind: "tool" as const, id: "centrifuge_tube_50ml", text: "50 mL centrifuge tube" },
      target: { kind: "slot" as const, id: "station_2", text: "Station 2" },
    },
  };

  it("rebuilds the sentence from the code, translating the entities it names", () => {
    expect(translateJournalEntry(fr, "fr", toolPlaced)).toBe(
      "Tube à centrifuger 50 mL posé sur Poste 2.",
    );
  });

  // The backend already rendered the English; a second copy here could only drift.
  it("reads English straight off the entry", () => {
    expect(translateJournalEntry(en, "en", toolPlaced)).toBe(toolPlaced.message);
  });

  it("keeps numbers and free text as sent", () => {
    expect(
      translateJournalEntry(fr, "fr", {
        code: "analytical_balance_tared",
        message: "Analytical balance tared at 12.500 g.",
        params: { mass: "12.500" },
      }),
    ).toBe("Balance analytique tarée à 12.500 g.");
  });

  it("names a produce lot from its structured label", () => {
    expect(
      translateJournalEntry(fr, "fr", {
        code: "produce_lot_created_in_basket",
        message: "Apple lot 2 created in Produce basket.",
        params: { produce: { kind: "produce" as const, id: "apple_lot", text: "Apple lot 2", index: 2 } },
      }),
    ).toBe("Lot de pommes 2 créé dans le panier de fruits.");
  });

  it("falls back to the English message for an entry recorded without a code", () => {
    expect(
      translateJournalEntry(fr, "fr", { code: null, message: "Something older.", params: {} }),
    ).toBe("Something older.");
  });

  it("falls back to the English message for a code it does not know yet", () => {
    expect(
      translateJournalEntry(fr, "fr", {
        code: "invented_on_the_backend",
        message: "Something newer.",
        params: {},
      }),
    ).toBe("Something newer.");
  });
});
