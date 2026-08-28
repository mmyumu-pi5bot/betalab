import type { Experiment } from "@/types/experiment";
import type {
  BenchLiquidPortion,
  BenchToolInstance,
  ExperimentProduceLot,
  ExperimentWorkspaceWidget,
  ToolbarCategory,
  ToolbarItem,
} from "@/types/workbench";

import {
  translateCatalogCategoryDescription,
  translateCatalogCategoryLabel,
  translateCatalogDescription,
  translateCatalogName,
  translateCatalogSubtitle,
  translateProduceLotLabel,
  translateRackSlotLabel,
  translateToolLabel,
  translateToolSubtitle,
  translateWidgetLabel,
  translateWorkbenchSlotLabel,
} from "./domain-labels";
import type { Translate } from "./i18n-context";
import { enMessages, type MessageKey } from "./messages/en";

// The API answers in English for entities it names itself. Rather than teaching
// forty components to translate a label, the snapshot is translated once where
// it enters the scene: every id the catalogue knows is swapped for its localised
// wording, and everything else is passed through untouched.

// Locations reach the UI as plain labels ("Station 1", "Vortex mixer") with no id
// beside them — on trash entries and discard provenance. The reverse map is built
// from the English catalogue itself, so it can never drift from the labels the
// backend actually sends.
const locationKeys: MessageKey[] = [
  "widget.workbench",
  "widget.trash",
  "widget.autosampler_rack",
  "widget.lc_msms_instrument",
  "widget.cryogenic_grinder",
  "widget.produce_basket",
  "widget.lims_terminal",
  "widget.gross_balance",
  "widget.analytical_balance",
  "widget.vortex_mixer",
  "widget.centrifuge",
  "widget.ice_bath",
];

const locationKeyByEnglishLabel = new Map<string, MessageKey>(
  locationKeys.map((key) => [enMessages[key], key]),
);

const englishBenchSlotPattern = /^Station (\d+)$/;
const englishRackSlotPattern = /^Position (\d+)$/;

export function translateLocationLabel(t: Translate, label: string): string {
  const key = locationKeyByEnglishLabel.get(label);
  if (key) {
    return t(key);
  }
  const benchIndex = englishBenchSlotPattern.exec(label)?.[1];
  if (benchIndex) {
    return t("slot.bench", { index: benchIndex });
  }
  const rackIndex = englishRackSlotPattern.exec(label)?.[1];
  if (rackIndex) {
    return t("slot.rack", { index: rackIndex });
  }
  return label;
}

function localizeLiquid(t: Translate, liquid: BenchLiquidPortion): BenchLiquidPortion {
  const name = translateCatalogName(t, liquid.liquidId, liquid.name);
  return name === liquid.name ? liquid : { ...liquid, name };
}

function localizeProduceLot(t: Translate, lot: ExperimentProduceLot): ExperimentProduceLot {
  const label = translateProduceLotLabel(t, lot);
  return label === lot.label ? lot : { ...lot, label };
}

function localizeProduceLots(
  t: Translate,
  lots: ExperimentProduceLot[] | undefined,
): ExperimentProduceLot[] | undefined {
  return lots?.map((lot) => localizeProduceLot(t, lot));
}

function localizeTool(t: Translate, tool: BenchToolInstance): BenchToolInstance;
function localizeTool(t: Translate, tool: BenchToolInstance | null): BenchToolInstance | null;
function localizeTool(t: Translate, tool: BenchToolInstance | null): BenchToolInstance | null {
  if (!tool) {
    return tool;
  }
  return {
    ...tool,
    label: translateToolLabel(t, tool),
    subtitle: translateToolSubtitle(t, tool),
    liquids: tool.liquids.map((liquid) => localizeLiquid(t, liquid)),
    produceLots: localizeProduceLots(t, tool.produceLots),
  };
}

function localizeWidget(
  t: Translate,
  widget: ExperimentWorkspaceWidget,
): ExperimentWorkspaceWidget {
  return {
    ...widget,
    label: translateWidgetLabel(t, widget),
    tool: widget.tool ? localizeTool(t, widget.tool) : widget.tool,
    produceLots: localizeProduceLots(t, widget.produceLots),
    liquids: widget.liquids?.map((liquid) => localizeLiquid(t, liquid)),
  };
}

export function localizeExperiment(t: Translate, experiment: Experiment): Experiment {
  return {
    ...experiment,
    workbench: {
      ...experiment.workbench,
      slots: experiment.workbench.slots.map((slot) => ({
        ...slot,
        label: translateWorkbenchSlotLabel(t, slot),
        tool: localizeTool(t, slot.tool),
        surfaceProduceLots: localizeProduceLots(t, slot.surfaceProduceLots),
      })),
    },
    rack: {
      ...experiment.rack,
      slots: experiment.rack.slots.map((slot) => ({
        ...slot,
        label: translateRackSlotLabel(t, slot),
        tool: localizeTool(t, slot.tool),
      })),
    },
    trash: {
      ...experiment.trash,
      children: experiment.trash.children.map((tool) => localizeTool(t, tool)),
      discardedFrom: Object.fromEntries(
        Object.entries(experiment.trash.discardedFrom).map(([id, label]) => [
          id,
          translateLocationLabel(t, label),
        ]),
      ),
      produceLots: experiment.trash.produceLots.map((entry) => ({
        ...entry,
        originLabel: translateLocationLabel(t, entry.originLabel),
        produceLot: localizeProduceLot(t, entry.produceLot),
      })),
      sampleLabels: experiment.trash.sampleLabels.map((entry) => ({
        ...entry,
        originLabel: translateLocationLabel(t, entry.originLabel),
      })),
    },
    workspace: {
      ...experiment.workspace,
      produceBasketLots: experiment.workspace.produceBasketLots.map((lot) =>
        localizeProduceLot(t, lot),
      ),
      widgets: experiment.workspace.widgets.map((widget) => localizeWidget(t, widget)),
    },
    basketTools: experiment.basketTools.map((tool) => localizeTool(t, tool)),
  };
}

function localizeToolbarItem(t: Translate, item: ToolbarItem): ToolbarItem {
  return {
    ...item,
    name: translateCatalogName(t, item.id, item.name),
    subtitle: translateCatalogSubtitle(t, item.id, item.subtitle),
    description: translateCatalogDescription(t, item.id, item.description),
  };
}

export function localizeToolbarCatalog(
  t: Translate,
  categories: ToolbarCategory[],
): ToolbarCategory[] {
  return categories.map((category) => ({
    ...category,
    label: translateCatalogCategoryLabel(t, category.id, category.label),
    description: translateCatalogCategoryDescription(t, category.id, category.description),
    items: category.items.map((item) => localizeToolbarItem(t, item)),
  }));
}
