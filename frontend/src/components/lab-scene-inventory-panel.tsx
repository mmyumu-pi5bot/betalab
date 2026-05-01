"use client";

import type { RefObject } from "react";

import { DebugProducePalette, type DebugProducePreset } from "@/components/debug-produce-palette";
import { ToolbarPanel } from "@/components/toolbar-panel";
import type { WorkbenchDndApi } from "@/hooks/use-workbench-dnd";
import { createToolbarDragPayload, toDragDescriptor } from "@/lib/workbench-dnd";
import type { DragDescriptor, DropTargetType, ToolbarCategory } from "@/types/workbench";

type LabSceneInventoryPanelProps = {
  debug: {
    debugInventoryEnabled: boolean;
    debugProducePresets: DebugProducePreset[];
  };
  dnd: {
    clearDropTargets: () => void;
    dndDisabledByAction: boolean;
    inventoryDropRef: RefObject<HTMLDivElement | null>;
    isInventoryDropHighlighted: boolean;
    setActiveDragItem: (item: DragDescriptor | null) => void;
    showDropTargets: (targets: readonly DropTargetType[]) => void;
    workbench: Pick<WorkbenchDndApi, "handleDebugProducePresetDragStart">;
  };
  toolbarCategories: ToolbarCategory[];
};

export function LabSceneInventoryPanel({ debug, dnd, toolbarCategories }: LabSceneInventoryPanelProps) {
  return (
    <div className="space-y-4 xl:sticky xl:top-6 xl:self-start" data-testid="widget-inventory">
      <div
        className={`rounded-[1.5rem] transition-shadow ${
          dnd.isInventoryDropHighlighted ? "ring-2 ring-sky-200/90 ring-offset-2 ring-offset-transparent" : ""
        }`.trim()}
        data-drop-highlighted={dnd.isInventoryDropHighlighted ? "true" : "false"}
        data-testid="inventory-dropzone"
        ref={dnd.inventoryDropRef}
      >
        <div>
          <ToolbarPanel
            categories={toolbarCategories}
            dragDisabled={dnd.dndDisabledByAction}
            onItemDragEnd={dnd.clearDropTargets}
            onItemDragStart={(item, allowedDropTargets) => {
              if (dnd.dndDisabledByAction) return;
              const payload = createToolbarDragPayload(item);
              dnd.showDropTargets(allowedDropTargets);
              dnd.setActiveDragItem(toDragDescriptor(payload));
            }}
          />
        </div>
      </div>
      {debug.debugInventoryEnabled ? (
        <div data-testid="widget-debug-inventory">
          <DebugProducePalette
            onItemDragEnd={dnd.clearDropTargets}
            onPresetDragStart={dnd.workbench.handleDebugProducePresetDragStart}
            presets={debug.debugProducePresets}
          />
        </div>
      ) : null}
    </div>
  );
}
