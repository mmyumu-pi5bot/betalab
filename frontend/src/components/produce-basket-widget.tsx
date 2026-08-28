"use client";

import { DraggableInventoryItem } from "@/components/draggable-inventory-item";
import { AppleIllustration } from "@/components/illustrations/apple-illustration";
import { LabAssetIcon } from "@/components/icons/lab-asset-icon";
import { ProduceBasketIllustration } from "@/components/illustrations/produce-basket-illustration";
import { InventoryWidget } from "@/components/inventory-widget";
import { useI18n } from "@/lib/i18n";
import { getProduceLotDisplayName } from "@/lib/produce-lot-display";
import type { BenchToolInstance, ExperimentProduceLot } from "@/types/workbench";

type ProduceBasketWidgetProps = {
  basketTools?: BenchToolInstance[];
  dndDisabled?: boolean;
  formatProduceLotMetadata: (produceLot: ExperimentProduceLot) => string;
  isOpen: boolean;
  onCreateAppleLot: () => void;
  onBagDragStart?: (tool: BenchToolInstance, dataTransfer: DataTransfer) => void;
  onItemDragEnd?: () => void;
  onProduceDragStart?: (produceLot: ExperimentProduceLot, dataTransfer: DataTransfer) => void;
  onToggle: () => void;
  produceLots: ExperimentProduceLot[];
};

export function ProduceBasketWidget({
  basketTools = [],
  dndDisabled = false,
  formatProduceLotMetadata,
  isOpen,
  onCreateAppleLot,
  onBagDragStart,
  onItemDragEnd,
  onProduceDragStart,
  onToggle,
  produceLots,
}: ProduceBasketWidgetProps) {
  const { t, tn } = useI18n();
  const basketItemCount = produceLots.length + basketTools.length;

  return (
    <InventoryWidget
      ariaLabel={tn("basket.open", basketItemCount)}
      buttonTestId="basket-open-button"
      count={basketItemCount}
      countBadgeClassName="absolute right-[22px] top-1"
      countTestId="basket-count-badge"
      frameClassName="rounded-[1.05rem] px-3 py-3.5"
      icon={<ProduceBasketIllustration className="block w-[10.9rem]" itemCount={6} />}
      isOpen={isOpen}
      onToggle={onToggle}
      overlayTestId="basket-dialog-overlay"
      overlayWidthClassName="w-[24rem] max-w-[min(24rem,calc(100vw-2rem))]"
      title={t("basket.title")}
    >
      <div className="space-y-4">
        <button
          className="w-full rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-left transition hover:border-emerald-300 hover:bg-emerald-100/80"
          data-testid="basket-create-apple-lot-button"
          onClick={onCreateAppleLot}
          type="button"
        >
          <span className="flex items-center gap-3">
            <AppleIllustration className="h-12 w-12 shrink-0" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900">
                {t("basket.createBag")}
              </span>
              <span className="mt-1 block text-sm text-slate-500">
                {t("basket.createBagHint")}
              </span>
            </span>
          </span>
        </button>
        <div className="rounded-[1rem] border border-slate-200 bg-slate-50 px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            {t("basket.contents")}
          </p>
          <div className="mt-3 space-y-2">
            {basketTools.map((basketTool) => (
              <DraggableInventoryItem
                className="rounded-[0.9rem] bg-white"
                contentClassName="flex-1"
                dataTestId="basket-received-bag"
                key={basketTool.id}
                leading={
                  <LabAssetIcon
                    accent="emerald"
                    className="h-11 w-9 shrink-0"
                    kind="sample_bag"
                    produceLots={basketTool.produceLots}
                    sampleLabelText={
                      basketTool.labels?.find((label) => label.labelKind === "lims")?.text ??
                      basketTool.labels?.[0]?.text ??
                      null
                    }
                    tone="neutral"
                  />
                }
                onDragEnd={dndDisabled ? undefined : onItemDragEnd}
                onDragStart={
                  dndDisabled || !onBagDragStart
                    ? undefined
                    : (dataTransfer) => onBagDragStart(basketTool, dataTransfer)
                }
                subtitle={
                  <span className="block truncate text-xs text-slate-500">
                    {basketTool.fieldLabelText ?? t("basket.fieldLabelAttached")}
                  </span>
                }
                title={
                  <span className="block truncate text-sm font-semibold text-slate-900">
                    {t("basket.receivedBag")}
                  </span>
                }
              />
            ))}
            {produceLots.length > 0 ? (
              produceLots.map((lot) => (
                <DraggableInventoryItem
                  className="rounded-[0.9rem] bg-white"
                  contentClassName="flex-1"
                  dataTestId={`basket-produce-${lot.id}`}
                  key={lot.id}
                  leading={
                    <AppleIllustration
                      className="h-10 w-10 shrink-0"
                      testId={`basket-produce-illustration-${lot.id}`}
                    />
                  }
                  onDragEnd={dndDisabled ? undefined : onItemDragEnd}
                  onDragStart={
                    dndDisabled || !onProduceDragStart
                      ? undefined
                      : (dataTransfer) => onProduceDragStart(lot, dataTransfer)
                  }
                  subtitle={
                    <span className="block truncate text-xs text-slate-500">
                      {formatProduceLotMetadata(lot)}
                    </span>
                  }
                  title={
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {getProduceLotDisplayName(t, lot)}
                    </span>
                  }
                />
              ))
            ) : basketTools.length === 0 ? (
              <p className="text-sm text-slate-500">{t("basket.empty")}</p>
            ) : null}
          </div>
        </div>
      </div>
    </InventoryWidget>
  );
}
