"use client";

import type { DragEvent } from "react";

import { DraggableInventoryItem } from "@/components/draggable-inventory-item";
import { LabWasteBinIllustration } from "@/components/illustrations/lab-waste-bin-illustration";
import { InventoryWidget } from "@/components/inventory-widget";
import { useT } from "@/lib/i18n";
import { getProduceLotDisplayName } from "@/lib/produce-lot-display";
import type {
  BenchToolInstance,
  ExperimentWorkspaceWidget,
  TrashProduceLotEntry,
  TrashSampleLabelEntry,
} from "@/types/workbench";

type TrashWidgetProps = {
  dndDisabled?: boolean;
  discardedFrom: Record<string, string>;
  formatProduceLotMetadata: (trashProduceLot: TrashProduceLotEntry["produceLot"]) => string;
  isDropHighlighted: boolean;
  isEmpty: boolean;
  isOpen: boolean;
  onDragOver: (event: DragEvent<HTMLButtonElement>) => void;
  onDrop: (event: DragEvent<HTMLButtonElement>) => void;
  onToolDragStart: (tool: BenchToolInstance, dataTransfer: DataTransfer) => void;
  onToggle: () => void;
  onTrashedWidgetDragStart: (
    widget: ExperimentWorkspaceWidget,
    dataTransfer: DataTransfer,
  ) => void;
  onTrashProduceLotDragStart: (
    trashProduceLot: TrashProduceLotEntry,
    dataTransfer: DataTransfer,
  ) => void;
  onItemDragEnd: () => void;
  onSpatulaDiscard?: () => void;
  onTrashSampleLabelDragStart: (
    trashSampleLabel: TrashSampleLabelEntry,
    dataTransfer: DataTransfer,
  ) => void;
  trashedProduceLots: TrashProduceLotEntry[];
  trashedSampleLabels: TrashSampleLabelEntry[];
  trashedTools: BenchToolInstance[];
  trashedWidgets: ExperimentWorkspaceWidget[];
};

export function TrashWidget({
  dndDisabled = false,
  discardedFrom,
  formatProduceLotMetadata,
  isDropHighlighted,
  isEmpty,
  isOpen,
  onDragOver,
  onDrop,
  onToolDragStart,
  onToggle,
  onTrashedWidgetDragStart,
  onTrashProduceLotDragStart,
  onItemDragEnd,
  onSpatulaDiscard,
  onTrashSampleLabelDragStart,
  trashedProduceLots,
  trashedSampleLabels,
  trashedTools,
  trashedWidgets,
}: TrashWidgetProps) {
  const t = useT();
  const trashItemCount =
    trashedTools.length + trashedProduceLots.length + trashedSampleLabels.length + trashedWidgets.length;

  const handleToggle = () => {
    onToggle();
    onSpatulaDiscard?.();
  };

  return (
    <InventoryWidget
      buttonTestId="trash-dropzone"
      count={trashItemCount}
      countBadgeClassName="-right-2 -top-2 absolute"
      countTestId="trash-count-badge"
      dataDropHighlighted={isDropHighlighted ? "true" : "false"}
      icon={<LabWasteBinIllustration className="block h-[5.4rem] w-auto" hasItems={trashItemCount > 0} isOpen={isOpen} />}
      isDropHighlighted={isDropHighlighted}
      isOpen={isOpen}
      onDragOver={dndDisabled ? undefined : onDragOver}
      onDrop={dndDisabled ? undefined : onDrop}
      onToggle={handleToggle}
      overlayTestId="trash-dialog-overlay"
      overlayWidthClassName="w-[26rem] max-w-[min(26rem,calc(100vw-2rem))]"
      title={t("trash.title")}
    >
      <div className="space-y-2">
        {trashedTools.map((tool) => {
          const totalVolume = tool.liquids.reduce(
            (sum, liquid) => sum + liquid.volume_ml,
            0,
          );
          const originLabel = discardedFrom[tool.id] ?? "";

          return (
            <DraggableInventoryItem
              dataTestId={`trash-tool-${tool.id}`}
              key={tool.id}
              onDragEnd={dndDisabled ? undefined : onItemDragEnd}
              onDragStart={
                dndDisabled ? undefined : (dataTransfer) => onToolDragStart(tool, dataTransfer)
              }
              subtitle={
                <p className="truncate text-xs text-slate-500">
                  {originLabel}
                  {totalVolume > 0 ? ` • ${totalVolume} mL` : ""}
                </p>
              }
              title={
                <p className="truncate text-sm font-semibold text-slate-900">
                  {tool.label}
                </p>
              }
            />
          );
        })}
        {trashedProduceLots.map((trashProduceLot) => (
          <DraggableInventoryItem
            dataTestId={`trash-produce-lot-${trashProduceLot.id}`}
            key={trashProduceLot.id}
            onDragEnd={dndDisabled ? undefined : onItemDragEnd}
            onDragStart={
              dndDisabled
                ? undefined
                : (dataTransfer) => onTrashProduceLotDragStart(trashProduceLot, dataTransfer)
            }
            subtitle={
              <p className="truncate text-xs text-slate-500">
                {formatProduceLotMetadata(trashProduceLot.produceLot)
                  ? `${trashProduceLot.originLabel} • ${formatProduceLotMetadata(trashProduceLot.produceLot)}`
                  : trashProduceLot.originLabel}
              </p>
            }
            title={
              <p className="truncate text-sm font-semibold text-slate-900">
                {getProduceLotDisplayName(t, trashProduceLot.produceLot)}
              </p>
            }
          />
        ))}
        {trashedWidgets.map((widget) => (
          <DraggableInventoryItem
            dataTestId={`trash-widget-${widget.id}`}
            key={widget.id}
            onDragEnd={dndDisabled ? undefined : onItemDragEnd}
            onDragStart={
              dndDisabled ? undefined : (dataTransfer) => onTrashedWidgetDragStart(widget, dataTransfer)
            }
            subtitle={<p className="truncate text-xs text-slate-500">{t("trash.workspaceWidget")}</p>}
            title={
              <p className="truncate text-sm font-semibold text-slate-900">
                {widget.label}
              </p>
            }
          />
        ))}
        {trashedSampleLabels.map((trashSampleLabel) => (
          <DraggableInventoryItem
            dataTestId={`trash-sample-label-${trashSampleLabel.id}`}
            key={trashSampleLabel.id}
            onDragEnd={dndDisabled ? undefined : onItemDragEnd}
            onDragStart={
              dndDisabled || trashSampleLabel.label?.isDraggable === false
                ? undefined
                : (dataTransfer) => onTrashSampleLabelDragStart(trashSampleLabel, dataTransfer)
            }
            subtitle={
              <p className="truncate text-xs text-slate-500">
                {trashSampleLabel.originLabel}
              </p>
            }
            title={
              <p className="truncate text-sm font-semibold text-slate-900">
                {trashSampleLabel.label?.text || t("trash.untitledLabel")}
              </p>
            }
          />
        ))}
        {isEmpty ? (
          <div className="rounded-[1rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            {t("trash.empty")}
          </div>
        ) : null}
      </div>
    </InventoryWidget>
  );
}
