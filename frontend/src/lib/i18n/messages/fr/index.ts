import type { MessageCatalog } from "../en";
import { frCommon } from "./common";
import { frDomain } from "./domain";
import { frHome } from "./home";
import { frJournal } from "./journal";
import { frLab } from "./lab";
import { frLcms } from "./lcms";
import { frTutorial } from "./tutorial";

export const frMessages: MessageCatalog = {
  ...frCommon,
  ...frHome,
  ...frLab,
  ...frLcms,
  ...frDomain,
  ...frJournal,
  ...frTutorial,
};
