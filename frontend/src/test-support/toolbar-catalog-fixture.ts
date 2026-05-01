import { labWorkflowCategories } from "@/lib/lab-workflow-catalog";
import {
  getLiquidDropTargets,
  getSampleLabelDropTargets,
  getToolDropTargets,
} from "@/lib/tool-drop-targets";
import type { ToolbarCategory, ToolbarItem } from "@/types/workbench";

function withAllowedDropTargets(item: ToolbarItem): ToolbarItem {
  if (item.itemType === "tool") {
    return { ...item, allowedDropTargets: getToolDropTargets(item.toolType) };
  }
  if (item.itemType === "liquid") {
    return { ...item, allowedDropTargets: getLiquidDropTargets(item.liquidType) };
  }
  if (item.itemType === "sample_label") {
    return { ...item, allowedDropTargets: getSampleLabelDropTargets() };
  }
  return { ...item, allowedDropTargets: ["workspace_canvas"] };
}

export const toolbarCatalogFixture: ToolbarCategory[] = labWorkflowCategories.map((category) => ({
  ...category,
  items: category.items.map((item) => withAllowedDropTargets(item)),
}));
