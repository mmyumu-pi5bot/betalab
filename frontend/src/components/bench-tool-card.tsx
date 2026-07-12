import type { DragEvent, MouseEvent, PointerEvent, ReactNode } from "react";

import { LabAssetIcon } from "@/components/icons/lab-asset-icon";
import { StoreInInventoryIcon } from "@/components/icons/store-in-inventory-icon";
import { ProduceLotCard } from "@/components/produce-lot-card";
import { ProduceLotStatusBadge } from "@/components/produce-lot-status-badge";
import { SampleIdentityLabel } from "@/components/sample-identity-label";
import { TemperatureIndicator } from "@/components/temperature-indicator";
import { dragAffordanceClassName } from "@/lib/drag-affordance";
import {
  getContainerLiquidVisualState,
  getLiquidAccentPalette,
} from "@/lib/liquid-visuals";
import type { BenchLabel, BenchToolInstance, ExperimentProduceLot } from "@/types/workbench";

type BenchToolCardProps = {
  className?: string;
  dataDropHighlighted?: boolean;
  draggable?: boolean;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  onDragEnd?: (event: DragEvent<HTMLElement>) => void;
  onDragOver?: (event: DragEvent<HTMLElement>) => void;
  onDrop?: (event: DragEvent<HTMLElement>) => void;
  onPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp?: (event: PointerEvent<HTMLElement>) => void;
  onProduceLotClick?: (produceLot: ExperimentProduceLot) => void;
  onDragStart?: (event: DragEvent<HTMLElement>) => void;
  pendingContent?: ReactNode;
  onProduceLotDragEnd?: (event: DragEvent<HTMLElement>) => void;
  onProduceLotDragStart?: (produceLot: ExperimentProduceLot, event: DragEvent<HTMLElement>) => void;
  onRemoveLiquid: (liquidId: string) => void;
  onSampleLabelTextChange?: (labelId: string, sampleLabelText: string) => void;
  onToggleSeal?: () => void;
  onSampleLabelDragEnd?: (event: DragEvent<HTMLElement>) => void;
  onSampleLabelDragStart?: (label: BenchLabel, event: DragEvent<HTMLElement>) => void;
  onStore?: () => void;
  onToolIllustrationClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  tool: BenchToolInstance;
};

function formatLotMetadata(produceLot: ExperimentProduceLot) {
  if (produceLot.unitCount !== null) {
    return `${produceLot.unitCount} unit${produceLot.unitCount === 1 ? "" : "s"}`;
  }

  const mass = Number.isInteger(produceLot.totalMassG)
    ? produceLot.totalMassG.toFixed(0)
    : produceLot.totalMassG.toFixed(1);
  const state = produceLot.materialState
    ? `${produceLot.materialState[0].toUpperCase()}${produceLot.materialState.slice(1)}`
    : null;
  return state ? `${mass} g • ${state}` : `${mass} g`;
}

function getPrimaryToolLabelText(labels: BenchLabel[]) {
  return labels.find((label) => label.labelKind === "lims")?.text ?? labels[0]?.text ?? null;
}

export function BenchToolCard({
  className,
  dataDropHighlighted = false,
  draggable = false,
  onClick,
  onDragEnd,
  onDragOver,
  onDrop,
  onPointerDown,
  onPointerUp,
  onProduceLotClick,
  onDragStart,
  pendingContent,
  onProduceLotDragEnd,
  onProduceLotDragStart,
  onSampleLabelTextChange,
  onToggleSeal,
  onSampleLabelDragEnd,
  onSampleLabelDragStart,
  onStore,
  onToolIllustrationClick,
  tool,
}: BenchToolCardProps) {
  const produceLots = tool.produceLots ?? [];
  const totalVolumeMl = tool.liquids.reduce((total, liquid) => total + liquid.volume_ml, 0);
  const fillRatio = tool.capacity_ml > 0 ? Math.min(totalVolumeMl / tool.capacity_ml, 1) : 0;
  const powderMassG = tool.powderMassG ?? 0;
  const containsSlurry = tool.containsSlurry ?? false;
  const liquidVisualState = getContainerLiquidVisualState(tool.liquids, tool.accent);
  const liquidSegments = liquidVisualState.segments;
  const isSampleBag = tool.toolType === "sample_bag";
  const isPowderTool =
    tool.toolType === "storage_jar" ||
    tool.toolType === "sample_vial" ||
    tool.toolType === "centrifuge_tube";
  const isProduceSurface = tool.canReceiveProduce;
  const isSealable = tool.canSeal;
  const isSealed = tool.isSealed ?? false;
  const canDragContainedProduce = !isSealed;
  const labels = tool.labels ?? [];
  const hasLabels = labels.length > 0;
  const canStore = tool.canStore ?? false;
  const hasFieldLabel = isSampleBag && tool.fieldLabelText !== null && tool.fieldLabelText !== undefined;
  const displayLabelText = isSampleBag ? getPrimaryToolLabelText(labels) : null;
  const sealStateLabel =
    tool.closureFault === "pressure_pop" ? "Popped" : isSealed ? "Sealed" : "Open";
  const sealStateToneClass =
    tool.closureFault === "pressure_pop"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : isSealed
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-slate-200 bg-slate-100 text-slate-600";
  const quechers = tool.quechersState ?? {
    saltsAdded: false,
    phase: "idle",
    temperatureC: 20,
    cementationProgress: 0,
    thermalDegradationProgress: 0,
    reactionElapsedSeconds: 0,
    faults: [],
    isUsable: true,
  };
  const isContainer = tool.capacity_ml > 0;

  return (
    <article
      className={`rounded-[1.45rem] border bg-white p-2 shadow-sm ${
        dataDropHighlighted
          ? "border-sky-300 ring-2 ring-sky-200/80"
          : "border-slate-200"
      } ${className ?? ""}`.trim()}
      data-debug-model={JSON.stringify(tool)}
      data-debug-label={tool.label ?? tool.toolType}
      data-drop-highlighted={dataDropHighlighted ? "true" : "false"}
      onDragOverCapture={onDragOver}
      onDropCapture={onDrop}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="flex flex-col gap-2">
        <div
          className={draggable ? dragAffordanceClassName : ""}
          data-testid={`bench-tool-card-${tool.id}`}
          draggable={draggable}
          onClick={onClick}
          onDragEnd={onDragEnd}
          onDragOverCapture={onDragOver}
          onDragOver={onDragOver}
          onDragStart={onDragStart}
          onDropCapture={onDrop}
          onDrop={onDrop}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 flex-1 text-base font-semibold leading-5 text-slate-950">
              {tool.label}
            </h3>
            {onStore ? (
              <button
                aria-label={`Store ${tool.label} in inventory`}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-300"
                disabled={!canStore}
                draggable={false}
                onClick={(event) => {
                  event.stopPropagation();
                  onStore();
                }}
                title={canStore ? "Store in inventory" : "Empty this tool before storing it"}
                type="button"
              >
                <StoreInInventoryIcon className="h-4 w-4" />
              </button>
            ) : null}
            {isSealable ? (
              <div className="flex w-[7.75rem] shrink-0 items-center justify-end gap-2">
                <span
                  className={`inline-flex min-w-[3.5rem] justify-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${sealStateToneClass}`.trim()}
                >
                  {sealStateLabel}
                </span>
                <button
                  aria-label={`${isSealed ? "Open" : "Close"} ${tool.label}`}
                  className="inline-flex min-w-[3.75rem] justify-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                  draggable={false}
                  onClick={() => {
                    onToggleSeal?.();
                  }}
                  type="button"
                >
                  {isSealed ? "Open" : "Close"}
                </button>
              </div>
            ) : null}
          </div>
          <div className="mt-1.5 flex min-w-0 items-start gap-2.5">
            <button
              aria-label={`${tool.label} illustration`}
              className="shrink-0 rounded-xl"
              data-testid={`bench-tool-illustration-${tool.id}`}
              draggable={false}
              onDragOverCapture={onDragOver}
              onDropCapture={onDrop}
              onClick={onToolIllustrationClick}
              type="button"
            >
              <LabAssetIcon
                accent={tool.accent}
                className="h-22 w-16 shrink-0"
                closureFault={tool.closureFault}
                containsSlurry={containsSlurry}
                fillRatio={fillRatio}
                fillSegments={liquidSegments}
                isSealed={tool.isSealed}
                kind={tool.toolType}
                powderMassG={powderMassG}
                produceLots={produceLots}
                sampleLabelText={displayLabelText}
                tone="neutral"
              />
            </button>
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-xs text-slate-600">{tool.subtitle}</p>
                {isContainer ? (
                  <TemperatureIndicator temperatureC={quechers.temperatureC} />
                ) : null}
              </div>
              <p className="mt-1.5 text-[11px] font-medium text-slate-500">
                {isSampleBag
                  ? produceLots.length > 0
                    ? `${produceLots.length} produce lot${produceLots.length === 1 ? "" : "s"} loaded`
                    : "Ready for produce lot intake"
                  : isProduceSurface
                    ? produceLots.length > 0
                      ? `${produceLots.length} produce lot${produceLots.length === 1 ? "" : "s"} staged`
                      : powderMassG > 0
                        ? `${powderMassG.toFixed(0)} g powder residue`
                        : "Ready for produce staging"
                  : isPowderTool
                    ? tool.toolType === "storage_jar"
                      ? powderMassG > 0
                        ? "Powder reservoir loaded"
                        : "Ready for spatula loading"
                      : containsSlurry
                        ? "Slurry present"
                      : powderMassG > 0
                        ? "Powder deposit present"
                        : "Ready for powder dosing"
                  : tool.liquids.length > 0
                    ? `${tool.liquids.length} liquid loaded`
                    : "Ready for liquid additions"}
              </p>
            </div>
          </div>
        </div>

        {isSampleBag ? (
          hasFieldLabel ? (
            <div className="rounded-[0.95rem] border border-emerald-200 bg-emerald-50/70 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Field label
              </p>
              <p className="mt-1 text-xs font-medium text-slate-900">{tool.fieldLabelText}</p>
            </div>
          ) : null
        ) : isProduceSurface ? (
          null
        ) : null}

        {hasLabels ? (
          <div className="space-y-2">
            {labels.map((label) => (
              <div
                className={`rounded-[0.95rem] border px-2.5 py-2 ${
                  label.labelKind === "lims"
                    ? "border-sky-200 bg-sky-50/70"
                    : "border-slate-200 bg-slate-50/90"
                } ${onSampleLabelDragStart && (label.isDraggable ?? true) ? dragAffordanceClassName : ""}`.trim()}
                data-testid={
                  labels.length === 1
                    ? `sample-label-card-${tool.id}`
                    : `sample-label-card-${tool.id}-${label.id}`
                }
                draggable={Boolean(onSampleLabelDragStart) && (label.isDraggable ?? true)}
                key={label.id}
                onDragEnd={onSampleLabelDragEnd}
                onDragStart={(event) => {
                  onSampleLabelDragStart?.(label, event);
                }}
              >
                {label.labelKind === "lims" ? (
                  <SampleIdentityLabel
                    receivedDate={label.receivedDate ?? null}
                    sampleCode={label.sampleCode ?? label.text}
                  />
                ) : (
                  <input
                    aria-label="Sample label text"
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-400"
                    data-testid={
                      labels.length === 1
                        ? `sample-label-input-${tool.id}`
                        : `sample-label-input-${tool.id}-${label.id}`
                    }
                    defaultValue={label.text}
                    draggable={false}
                    onBlur={(event) => {
                      onSampleLabelTextChange?.(label.id, event.currentTarget.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.currentTarget.blur();
                      }
                    }}
                    placeholder="Write a note"
                    readOnly={label.labelKind !== "manual"}
                    type="text"
                  />
                )}
              </div>
            ))}
          </div>
        ) : null}

        {tool.injectionContext && !tool.calibrationContext ? (
          <div className="mt-1 flex items-center justify-between rounded-[0.85rem] border border-sky-200 bg-sky-50 px-3 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-500">
              Extrait
            </span>
            <span className="text-xs font-semibold text-sky-700">
              {tool.injectionContext.sampleMassG.toFixed(1)} g
            </span>
          </div>
        ) : null}

        {pendingContent ? (
          <div className="space-y-0.5">{pendingContent}</div>
        ) : produceLots.length > 0 || tool.liquids.length > 0 ? (
          <section className="space-y-1.5" aria-label="Declared contents">
            <p className="px-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Declared contents
            </p>
            <div className="space-y-0.5">
              {produceLots.map((produceLot) => (
                <ProduceLotCard
                  className={
                    canDragContainedProduce
                      ? isSampleBag
                        ? "bg-slate-50"
                        : undefined
                      : isSampleBag
                        ? "cursor-not-allowed bg-slate-100/90 opacity-75"
                        : "cursor-not-allowed opacity-75"
                  }
                  dataTestId={`bench-produce-lot-${produceLot.id}`}
                  draggable={canDragContainedProduce && Boolean(onProduceLotDragStart)}
                  footerBadge={<ProduceLotStatusBadge produceLot={produceLot} />}
                  key={produceLot.id}
                  metadata={formatLotMetadata(produceLot)}
                  onClick={() => {
                    onProduceLotClick?.(produceLot);
                  }}
                  onDragEnd={canDragContainedProduce ? onProduceLotDragEnd : undefined}
                  onDragStart={(event) => {
                    if (!canDragContainedProduce) {
                      return;
                    }
                    onProduceLotDragStart?.(produceLot, event);
                  }}
                  produceLot={produceLot}
                  variant="compact"
                />
              ))}
            </div>
            {tool.liquids.map((liquid) => (
              <div
                key={liquid.id}
                className="rounded-[0.9rem] border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700"
              >
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: getLiquidAccentPalette(liquid.accent).liquid }}
                    />
                    <span className="truncate">{liquid.name}</span>
                  </div>
                  <span className="shrink-0 tabular-nums text-slate-500">
                    {liquid.volume_ml.toFixed(2)} mL
                  </span>
                </div>
              </div>
            ))}
          </section>
        ) : null}
      </div>
    </article>
  );
}
