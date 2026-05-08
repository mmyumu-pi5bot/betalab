import { labWorkflowCategories } from "@/lib/lab-workflow-catalog";
import {
  canToolAcceptLiquids,
  canToolAcceptProduce,
  canToolBeSealed,
} from "@/test-support/tool-capabilities";
import {
  getLiquidDropTargets,
  getSampleLabelDropTargets,
  getToolDropTargets,
} from "@/test-support/drop-targets";
import type { ToolbarCategory, ToolbarItem } from "@/types/workbench";

function withAllowedDropTargets(item: ToolbarItem): ToolbarItem {
  if (item.itemType === "tool") {
    return {
      ...item,
      allowedDropTargets: getToolDropTargets(item.toolType),
      canReceiveLiquids: canToolAcceptLiquids(item.toolType),
      canReceiveProduce: canToolAcceptProduce(item.toolType),
      canSeal: canToolBeSealed(item.toolType),
    };
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
