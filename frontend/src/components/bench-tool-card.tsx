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
  onPourExtract?: () => void;
  onToolIllustrationClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  tool: BenchToolInstance;
};

function formatLotMetadata(unitCount: number | null) {
  return unitCount === null ? "" : `${unitCount} unit${unitCount === 1 ? "" : "s"}`;
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
  onRemoveLiquid,
  onSampleLabelTextChange,
  onToggleSeal,
  onSampleLabelDragEnd,
  onSampleLabelDragStart,
  onStore,
  onPourExtract,
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

        {tool.calibrationContext ? (
          <div className="mt-1 flex items-center justify-between rounded-[0.85rem] border border-rose-200 bg-rose-50 px-3 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-500">
              CAL
            </span>
            <span className="text-xs font-semibold text-rose-700">
              {tool.calibrationContext.levelNgPerMl} ng/mL
            </span>
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

        {onPourExtract &&
        tool.toolType === "centrifuge_tube" &&
        quechers.phase === "cemented" &&
        !quechers.faults.includes("dry_salts_wetted") ? (
          <div className="mt-1">
            <button
              className="w-full rounded-[0.85rem] border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 active:scale-[0.98]"
              draggable={false}
              onClick={(e) => {
                e.stopPropagation();
                onPourExtract();
              }}
              type="button"
            >
              Pipetter l&apos;extrait → vial
            </button>
          </div>
        ) : null}

        <div className="space-y-0.5">
          {pendingContent ? (
            pendingContent
          ) : isSampleBag ? (
            produceLots.length > 0 ? (
              produceLots.map((produceLot) => (
                <ProduceLotCard
                  className={canDragContainedProduce ? "bg-slate-50" : "cursor-not-allowed bg-slate-100/90 opacity-75"}
                  dataTestId={`bench-produce-lot-${produceLot.id}`}
                  draggable={canDragContainedProduce && Boolean(onProduceLotDragStart)}
                  footerBadge={<ProduceLotStatusBadge produceLot={produceLot} />}
                  key={produceLot.id}
                  metadata={formatLotMetadata(produceLot.unitCount)}
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
              ))
            ) : null
          ) : isProduceSurface ? (
            produceLots.length > 0 ? (
              produceLots.map((produceLot) => (
                <ProduceLotCard
                  className={canDragContainedProduce ? undefined : "cursor-not-allowed opacity-75"}
                  dataTestId={`bench-produce-lot-${produceLot.id}`}
                  draggable={canDragContainedProduce && Boolean(onProduceLotDragStart)}
                  footerBadge={<ProduceLotStatusBadge produceLot={produceLot} />}
                  key={produceLot.id}
                  metadata={formatLotMetadata(produceLot.unitCount)}
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
              ))
            ) : null
          ) : tool.liquids.length > 0 && !containsSlurry ? (
            tool.liquids.map((liquid) => (
              <div
                key={liquid.id}
                className={`rounded-[0.9rem] border px-2.5 py-1 text-xs font-medium ${
                  isSealed
                    ? "cursor-not-allowed border-slate-200 bg-slate-100/90 text-slate-500 opacity-75"
                    : "border-slate-200 bg-slate-50 text-slate-700"
                }`}
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: getLiquidAccentPalette(liquid.accent).liquid }}
                    />
                    <span className="truncate">{liquid.name}</span>
                  </div>

                  <button
                    aria-label={`Remove ${liquid.name}`}
                    className="row-span-2 inline-flex h-8 w-8 items-center justify-center self-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                    disabled={isSealed}
                    draggable={false}
                    onClick={() => {
                      if (isSealed) {
                        return;
                      }
                      onRemoveLiquid(liquid.id);
                    }}
                    type="button"
                  >
                    <svg
                      aria-hidden="true"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 16 16"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M3.5 4.5H12.5"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeWidth="1.4"
                      />
                      <path
                        d="M6 2.75H10"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeWidth="1.4"
                      />
                      <path
                        d="M5 4.5V11C5 12 5.5 12.5 6.5 12.5H9.5C10.5 12.5 11 12 11 11V4.5"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.4"
                      />
                      <path
                        d="M6.75 6.5V10"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeWidth="1.4"
                      />
                      <path
                        d="M9.25 6.5V10"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeWidth="1.4"
                      />
                    </svg>
                  </button>

                </div>
              </div>
            ))
          ) : null}
        </div>
      </div>
    </article>
  );
}
