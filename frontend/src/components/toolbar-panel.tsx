"use client";

import { useState } from "react";

import { InventoryEquipmentItem } from "@/components/inventory-equipment-item";
import { LabAssetIcon } from "@/components/icons/lab-asset-icon";
import { WorkspaceEquipmentIcon } from "@/components/icons/workspace-equipment-icon";
import { dragAffordanceClassName } from "@/lib/drag-affordance";
import { canToolBeSealed } from "@/lib/entity-rules";
import { createToolbarDragPayload, writeToolbarDragPayload } from "@/lib/workbench-dnd";
import type { DropTargetType, ToolbarAccent, ToolbarCategory, ToolbarItem } from "@/types/workbench";

type ToolbarPanelProps = {
  categories: ToolbarCategory[];
  dragDisabled?: boolean;
  onItemDragEnd?: () => void;
  onItemDragStart?: (item: ToolbarItem, allowedDropTargets: DropTargetType[]) => void;
};

const accentClasses: Record<ToolbarAccent, string> = {
  amber: "from-amber-500/20 via-amber-100 to-white text-amber-900 ring-amber-200",
  emerald:
    "from-emerald-500/20 via-emerald-100 to-white text-emerald-900 ring-emerald-200",
  rose: "from-rose-500/20 via-rose-100 to-white text-rose-900 ring-rose-200",
  sky: "from-sky-500/20 via-sky-100 to-white text-sky-900 ring-sky-200",
  violet: "from-violet-500/20 via-violet-100 to-white text-violet-900 ring-violet-200",
};

const neutralToolClasses =
  "from-slate-200/70 via-slate-50 to-white text-slate-800 ring-slate-200";

function SampleLabelIcon() {
  return (
    <div
      aria-label="Sampling label"
      className="flex h-8 w-10 shrink-0 items-center justify-center rounded-md border border-sky-200 bg-sky-50"
      data-kind="sample_label"
    >
      <div className="w-7 rounded-sm border border-dashed border-sky-300 bg-white px-1 py-0.5">
        <div className="h-1 rounded bg-sky-200" />
        <div className="mt-0.5 h-1 rounded bg-sky-100" />
      </div>
    </div>
  );
}

export function ToolbarPanel({
  categories,
  dragDisabled = false,
  onItemDragEnd,
  onItemDragStart,
}: ToolbarPanelProps) {
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(categories.map((category) => [category.id, true])),
  );

  return (
    <section className="rounded-[1.55rem] border border-slate-200 bg-white p-3 shadow-sm">
      <p
        className={`${dragAffordanceClassName} text-xs font-semibold uppercase tracking-[0.24em] text-slate-500`}
        data-widget-drag-handle="true"
      >
        Inventory
      </p>

      <div className="mt-2 space-y-3">
        {categories.map((category) => (
          <article
            key={category.id}
            className="rounded-[1.1rem] border border-slate-200 bg-slate-50/80 p-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <button
                aria-expanded={!collapsedCategories[category.id]}
                className="flex w-full items-center justify-between gap-3 rounded-[0.8rem] text-left"
                onClick={() => {
                  setCollapsedCategories((current) => ({
                    ...current,
                    [category.id]: !current[category.id],
                  }));
                }}
                type="button"
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 text-xs font-semibold leading-none text-slate-400">
                    {collapsedCategories[category.id] ? "+" : "-"}
                  </span>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-900">
                    {category.label}
                  </h3>
                </div>
              </button>
            </div>

            <div
              aria-hidden={collapsedCategories[category.id]}
              className={collapsedCategories[category.id] ? "hidden" : "mt-2.5 space-y-2"}
              data-testid={`toolbar-category-panel-${category.id}`}
            >
                {category.items.map((item) => (
                  item.itemType === "workspace_widget" ? (
                    <InventoryEquipmentItem
                      dataTestId={`toolbar-item-${item.id}`}
                      icon={(
                        <WorkspaceEquipmentIcon
                          className="h-8 w-10 shrink-0 overflow-hidden rounded-md"
                          widgetType={item.widgetType}
                        />
                      )}
                      key={item.id}
                      onDragEnd={
                        dragDisabled
                          ? undefined
                          : () => {
                              onItemDragEnd?.();
                            }
                      }
                      onDragStart={
                        dragDisabled
                          ? undefined
                          : (dataTransfer) => {
                              const payload = createToolbarDragPayload(item);
                              onItemDragStart?.(item, payload.allowedDropTargets);
                              writeToolbarDragPayload(dataTransfer, payload);
                            }
                      }
                      subtitle={item.subtitle}
                      title={item.name}
                    />
                  ) : (
                    <div
                      key={item.id}
                      className={`${dragDisabled ? "" : dragAffordanceClassName} rounded-[0.95rem] bg-gradient-to-br p-2 ring-1 transition-transform ${
                        dragDisabled ? "" : "hover:-translate-y-0.5"
                      } ${
                        item.itemType === "liquid" ? accentClasses[item.accent] : neutralToolClasses
                      }`}
                      data-testid={`toolbar-item-${item.id}`}
                      draggable={!dragDisabled}
                      onDragEnd={() => {
                        onItemDragEnd?.();
                      }}
                      onDragStart={(event) => {
                        if (dragDisabled) {
                          event.preventDefault();
                          return;
                        }
                        const payload = createToolbarDragPayload(item);
                        onItemDragStart?.(item, payload.allowedDropTargets);
                        writeToolbarDragPayload(event.dataTransfer, payload);
                      }}
                      title={item.subtitle}
                    >
                      <div className="flex items-center gap-2">
                        {item.itemType === "sample_label" ? (
                          <SampleLabelIcon />
                        ) : (
                          <LabAssetIcon
                            accent={item.accent}
                            className="h-8 w-7 shrink-0"
                            fillRatio={item.itemType === "tool" ? 0 : undefined}
                            isSealed={
                              item.itemType === "tool" ? canToolBeSealed(item.toolType) : false
                            }
                            kind={item.itemType === "tool" ? item.toolType : item.liquidType}
                            tone={item.itemType === "tool" ? "neutral" : "accent"}
                          />
                        )}
                        <p className="min-w-0 text-[13px] font-semibold leading-4">{item.name}</p>
                      </div>
                    </div>
                  )
                ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
