import { enCommon } from "./common";
import { enDomain } from "./domain";
import { enHome } from "./home";
import { enJournal } from "./journal";
import { enLab } from "./lab";
import { enLcms } from "./lcms";
import { enTutorial } from "./tutorial";

export const enMessages = {
  ...enCommon,
  ...enHome,
  ...enLab,
  ...enLcms,
  ...enDomain,
  ...enJournal,
  ...enTutorial,
} as const;

export type MessageKey = keyof typeof enMessages;

// A key is pluralisable when the catalogue carries both `<base>.one` and
// `<base>.other`; `tn` then picks the form the active locale needs.
type StripPluralSuffix<K> = K extends `${infer Base}.other` ? Base : never;

export type PluralKey = StripPluralSuffix<MessageKey>;

// Every locale is checked against the English catalogue, so adding a key in
// English without translating it fails the type check instead of leaking through.
export type MessageCatalog = Record<MessageKey, string>;
