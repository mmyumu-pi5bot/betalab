import { CryogenicGrinderIllustration } from "@/components/illustrations/cryogenic-grinder-illustration";
import { DraggableInventoryItem } from "@/components/draggable-inventory-item";
import { DropDraftCard } from "@/components/drop-draft-card";
import { ProduceLotCard } from "@/components/produce-lot-card";
import type { GrinderDndApi } from "@/hooks/use-grinder-dnd";
import type { ExperimentProduceLot } from "@/types/workbench";

type GrinderWidgetContentProps = {
  formatProduceLotMetadata: (lot: ExperimentProduceLot) => string | null;
  grinder: GrinderDndApi;
  isCommandPending: boolean;
  onCancelDropDraft: () => void;
  onChangeDropDraftField: (fieldId: string, value: number) => void;
  onConfirmDropDraft: () => void;
  onDragEnd: () => void;
};

export function GrinderWidgetContent({
  formatProduceLotMetadata,
  grinder,
  isCommandPending,
  onCancelDropDraft,
  onChangeDropDraftField,
  onConfirmDropDraft,
  onDragEnd,
}: GrinderWidgetContentProps) {
  const {
    grinderCanAttempt,
    grinderDisplayLabel,
    grinderDisplayMode,
    grinderDndDisabled,
    grinderInfoLine1,
    grinderInfoLine1Right,
    grinderInfoLine2,
    grinderInfoLine2Right,
    grinderLiquids,
    grinderLoadedLotTemperatureC,
    grinderLotIsWaste,
    grinderProgressPercent,
    grinderProduceLots,
    grinderStatus,
    handleGrinderLiquidDragStart,
    handleGrinderProduceDragStart,
    handleStartGrinder,
    isGrinderRunning,
    pendingGrinderDropDraft,
  } = grinder;

  return (
    <div className="space-y-4">
      <CryogenicGrinderIllustration
        className="mx-auto max-w-[24rem]"
        onPowerClick={handleStartGrinder}
        powerButtonDisabled={!grinderCanAttempt || isGrinderRunning || isCommandPending}
        powerButtonLabel={isGrinderRunning ? "Grinder running" : "Start grinder"}
        powerButtonTestId="grinder-power-button"
        status={grinderStatus}
        temperatureC={grinderLoadedLotTemperatureC}
        testId="cryogenic-grinder-illustration"
      />
      <div
        className="rounded-[1rem] border border-slate-300 bg-[linear-gradient(180deg,#dce7c7,#b8c89b)] px-4 py-3 text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
        data-testid="grinder-lcd-panel"
        data-tutorial-anchor={isGrinderRunning ? "grinder-progress" : undefined}
      >
        <div className="flex items-center justify-start gap-3">
          <p
            className={`font-mono text-xs font-bold uppercase tracking-[0.28em] ${
              grinderDisplayMode === "overload" || grinderDisplayMode === "jammed"
                ? "text-red-800"
                : grinderDisplayMode === "warning"
                  ? "text-amber-800"
                  : grinderDisplayMode === "running"
                    ? "text-emerald-800"
                    : "text-slate-800"
            }`}
            data-testid="grinder-lcd-status"
          >
            {grinderDisplayLabel}
          </p>
        </div>
        <div className="mt-3 min-h-[4.8rem]">
          <div className="grid min-h-[4.8rem] grid-rows-[auto_auto_auto] gap-1">
            {grinderDisplayMode === "running" || grinderDisplayMode === "warning" ? (
              <div className="h-3 overflow-hidden rounded-full border border-slate-500/30 bg-slate-900/10">
                <div
                  className={`h-full rounded-full transition-[width] ${
                    grinderDisplayMode === "warning" ? "bg-amber-700" : "bg-emerald-700"
                  }`}
                  data-testid="grinder-lcd-progress-bar"
                  style={{ width: `${grinderProgressPercent}%` }}
                />
              </div>
            ) : (
              <p
                className="font-mono text-sm font-semibold uppercase tracking-[0.2em] text-slate-800"
                data-testid="grinder-lcd-message"
              >
                {grinderDisplayMode === "overload"
                  ? "Whole fruit detected"
                  : grinderDisplayMode === "jammed"
                    ? grinderLotIsWaste
                      ? "Discard jammed waste"
                      : "Product not cold enough"
                    : grinderDisplayMode === "warning"
                      ? "High torque detected"
                      : grinderDisplayMode === "complete"
                        ? "Unload ground product"
                        : grinderDisplayMode === "ready"
                          ? "System ready"
                          : "Awaiting load"}
              </p>
            )}
            <div className="flex items-center justify-between gap-4 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-700">
              <p>{grinderInfoLine1}</p>
              <p data-testid="grinder-lcd-rpm">{grinderInfoLine1Right}</p>
            </div>
            <div className="flex items-center justify-between gap-4 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-700">
              <p>{grinderInfoLine2}</p>
              <p data-testid="grinder-lcd-load">{grinderInfoLine2Right}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {grinderProduceLots.map((lot) => (
          <ProduceLotCard
            className="rounded-[0.9rem] bg-white"
            dataTestId={`grinder-produce-${lot.id}`}
            draggable={!grinderDndDisabled}
            key={lot.id}
            metadata={
              lot.materialState === "ground"
                ? formatProduceLotMetadata(lot)
                  ? `Ground product • ${formatProduceLotMetadata(lot)}`
                  : "Ground product"
                : lot.materialState === "waste"
                  ? formatProduceLotMetadata(lot)
                    ? `Jammed waste • ${formatProduceLotMetadata(lot)}`
                    : "Jammed waste"
                  : (formatProduceLotMetadata(lot) ?? "")
            }
            onDragEnd={grinderDndDisabled ? undefined : onDragEnd}
            onDragStart={
              grinderDndDisabled
                ? undefined
                : (event) => handleGrinderProduceDragStart(lot, event.dataTransfer)
            }
            produceLot={lot}
            variant="expanded"
          />
        ))}
        {grinderLiquids.map((liquid) => (
          <DraggableInventoryItem
            className="rounded-[0.9rem] bg-white"
            contentClassName="flex-1"
            dataTestId={`grinder-liquid-${liquid.id}`}
            key={liquid.id}
            onDragEnd={grinderDndDisabled ? undefined : onDragEnd}
            onDragStart={
              grinderDndDisabled
                ? undefined
                : (dataTransfer) => handleGrinderLiquidDragStart(liquid, dataTransfer)
            }
            subtitle={
              <div className="mt-1 flex items-center justify-between gap-3">
                <span className="block truncate text-xs text-slate-500">Cooling medium</span>
                <span className="text-[11px] font-semibold text-slate-600">{liquid.volume_ml} g</span>
              </div>
            }
            title={
              <span className="block truncate text-sm font-semibold text-slate-900">
                {liquid.name}
              </span>
            }
          />
        ))}
        {pendingGrinderDropDraft ? (
          <DropDraftCard
            confirmLabel={pendingGrinderDropDraft.confirmLabel}
            fields={pendingGrinderDropDraft.fields}
            onCancel={onCancelDropDraft}
            onChangeField={onChangeDropDraftField}
            onConfirm={onConfirmDropDraft}
            title={pendingGrinderDropDraft.title}
          />
        ) : null}
      </div>
    </div>
  );
}
