"use client";

import type { DragEvent, MouseEvent, PointerEvent, ReactNode } from "react";

import { BenchToolCard } from "@/components/bench-tool-card";
import { ProduceLotCard } from "@/components/produce-lot-card";
import { ProduceLotStatusBadge } from "@/components/produce-lot-status-badge";
import { dragAffordanceClassName } from "@/lib/drag-affordance";
import { executeWorkbenchLabelDropCommand } from "@/lib/label-drop-command-executor";
import { resolveLabelDropCommand } from "@/lib/label-drop-command-resolver";
import { readLabelDragPayload } from "@/lib/label-drop-resolver";
import { canResolveWorkbenchSlotDrop } from "@/lib/workbench-slot-drop-resolver";
import {
  hasCompatibleDropTarget,
  readDragDescriptor,
  readEquipmentToolDragPayload,
  readProduceDragPayload,
  readToolbarDragPayload,
} from "@/lib/workbench-dnd";
import type { EquipmentToolDragPayload } from "@/lib/workbench-dnd";
import type {
  BenchLabel,
  BenchSlot,
  BenchToolInstance,
  ExperimentProduceLot,
  LimsLabelTicketDragPayload,
  ProduceDragPayload,
  SampleLabelDragPayload,
  ToolbarDragPayload,
} from "@/types/workbench";

type ToolDropPayload = EquipmentToolDragPayload;

function formatProduceLotMetadata(produceLot: ExperimentProduceLot) {
  return produceLot.unitCount === null
    ? ""
    : `${produceLot.unitCount} unit${produceLot.unitCount === 1 ? "" : "s"}`;
}

type WorkbenchPanelProps = {
  dndDisabled?: boolean;
  onAddWorkbenchSlot?: () => void;
  canDragBenchTool?: (slotId: string, tool: BenchToolInstance) => boolean;
  onBenchToolDragStart?: (
    slotId: string,
    tool: BenchToolInstance,
    dataTransfer: DataTransfer,
  ) => void;
  onBenchToolDragEnd?: () => void;
  onBenchToolClick?: (
    slotId: string,
    tool: BenchToolInstance,
    event: MouseEvent<HTMLElement>,
  ) => void;
  onBenchToolPointerDown?: (
    slotId: string,
    tool: BenchToolInstance,
    event: PointerEvent<HTMLElement>,
  ) => void;
  onBenchToolPointerUp?: (
    slotId: string,
    tool: BenchToolInstance,
    event: PointerEvent<HTMLElement>,
  ) => void;
  onBenchToolIllustrationClick?: (
    slotId: string,
    tool: BenchToolInstance,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
  onProduceLotDragStart?: (
    slotId: string,
    produceLot: ExperimentProduceLot,
    dataTransfer: DataTransfer,
  ) => void;
  onBenchToolDrop?: (targetSlotId: string, payload: ToolDropPayload) => void;
  onProduceLotClick?: (slotId: string, produceLot: ExperimentProduceLot) => void;
  onProduceDrop?: (targetSlotId: string, payload: ProduceDragPayload) => void;
  isBenchSlotHighlighted?: (slot: BenchSlot) => boolean;
  onApplySampleLabel?: (slotId: string) => void;
  onMoveSampleLabel?: (targetSlotId: string, payload: SampleLabelDragPayload) => void;
  onApplyLimsLabelTicket?: (targetSlotId: string, payload: LimsLabelTicketDragPayload) => void;
  onRemoveLiquid: (slotId: string, liquidId: string) => void;
  onRemoveWorkbenchSlot?: (slotId: string) => void;
  onRestoreTrashedSampleLabel?: (targetSlotId: string, payload: SampleLabelDragPayload) => void;
  onSampleLabelDragEnd?: () => void;
  onSampleLabelDragStart?: (
    slotId: string,
    label: BenchLabel,
    dataTransfer: DataTransfer,
  ) => void;
  onSampleLabelTextChange?: (slotId: string, labelId: string, sampleLabelText: string) => void;
  onToggleToolSeal?: (slotId: string, tool: BenchToolInstance) => void;
  renderPendingContent?: (slot: BenchSlot, tool: BenchToolInstance | null) => ReactNode;
  slots: BenchSlot[];
  onToolbarItemDrop: (slotId: string, payload: ToolbarDragPayload) => void;
};

export function WorkbenchPanel({
  dndDisabled = false,
  onAddWorkbenchSlot,
  canDragBenchTool,
  isBenchSlotHighlighted,
  onBenchToolDragEnd,
  onBenchToolClick,
  onBenchToolPointerDown,
  onBenchToolPointerUp,
  onBenchToolIllustrationClick,
  onBenchToolDragStart,
  onBenchToolDrop,
  onProduceLotClick,
  onProduceLotDragStart,
  onProduceDrop,
  onApplySampleLabel,
  onMoveSampleLabel,
  onApplyLimsLabelTicket,
  onRemoveLiquid,
  onRemoveWorkbenchSlot,
  onRestoreTrashedSampleLabel,
  onSampleLabelDragEnd,
  onSampleLabelDragStart,
  onSampleLabelTextChange,
  onToggleToolSeal,
  renderPendingContent,
  slots,
  onToolbarItemDrop,
}: WorkbenchPanelProps) {
  const canAcceptWorkbenchDrop = (event: DragEvent<HTMLElement>, slot: BenchSlot) => {
    if (dndDisabled) {
      return false;
    }

    const descriptor = readDragDescriptor(event.dataTransfer);
    if (!descriptor) {
      return false;
    }

    if (
      descriptor.entityKind === "tool" ||
      descriptor.entityKind === "liquid" ||
      descriptor.entityKind === "produce" ||
      descriptor.entityKind === "sample_label" ||
      descriptor.entityKind === "lims_label_ticket"
    ) {
      return canResolveWorkbenchSlotDrop(event.dataTransfer, slot);
    }

    if (
      !(slot.dropTargetTypes ?? []).some((targetType) =>
        hasCompatibleDropTarget(event.dataTransfer, targetType),
      )
    ) {
      return false;
    }

    return false;
  };

  const handleDrop = (event: DragEvent<HTMLElement>, slot: BenchSlot) => {
    if (dndDisabled) {
      return;
    }
    if (!canAcceptWorkbenchDrop(event, slot)) {
      return;
    }

    event.preventDefault();

    const equipmentToolPayload = readEquipmentToolDragPayload(event.dataTransfer);
    if (equipmentToolPayload) {
      onBenchToolDrop?.(slot.id, equipmentToolPayload);
      return;
    }

    const producePayload = readProduceDragPayload(event.dataTransfer);
    if (producePayload) {
      onProduceDrop?.(slot.id, producePayload);
      return;
    }

    const labelDragPayload = readLabelDragPayload(event.dataTransfer);
    if (labelDragPayload) {
      const command = resolveLabelDropCommand(labelDragPayload, {
        kind: "workbench_slot",
        slotId: slot.id,
      });
      if (!command) {
        return;
      }
      executeWorkbenchLabelDropCommand(command, {
        applyPrintedLimsLabel: (payload) => {
          onApplyLimsLabelTicket?.(payload.slot_id, labelDragPayload.payload as LimsLabelTicketDragPayload);
        },
        applySampleLabelToWorkbenchTool: (payload) => {
          onApplySampleLabel?.(payload.slot_id);
        },
        moveSampleLabelBetweenWorkbenchTools: (payload) => {
          onMoveSampleLabel?.(payload.target_slot_id, labelDragPayload.payload as SampleLabelDragPayload);
        },
        restoreTrashedSampleLabelToWorkbenchTool: (payload) => {
          onRestoreTrashedSampleLabel?.(
            payload.target_slot_id,
            labelDragPayload.payload as SampleLabelDragPayload,
          );
        },
      });
      return;
    }

    const payload = readToolbarDragPayload(event.dataTransfer);
    if (!payload) {
      return;
    }

    onToolbarItemDrop(slot.id, payload);
  };

  return (
    <section className="overflow-hidden rounded-[2rem] border border-amber-200/80 bg-[linear-gradient(180deg,#fffdf8_0%,#fff4dc_100%)] shadow-sm">
      <div
        className={`${dragAffordanceClassName} border-b border-amber-200/80 bg-white/70 px-5 py-5 backdrop-blur xl:px-6 xl:py-6`}
        data-widget-drag-handle="true"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
              Workbench
            </p>
          </div>

          <button
            aria-label="Add workbench station"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-white/85 text-lg font-semibold text-amber-700 transition hover:border-amber-300 hover:bg-white"
            data-testid="add-workbench-slot-button"
            onClick={() => {
              onAddWorkbenchSlot?.();
            }}
            type="button"
          >
            +
          </button>
        </div>
      </div>

      <div className="relative p-5 xl:p-6">
        <div className="absolute inset-x-5 bottom-5 top-16 rounded-[2rem] bg-[linear-gradient(180deg,rgba(120,53,15,0)_0%,rgba(146,64,14,0.08)_30%,rgba(120,53,15,0.16)_100%)]" />
        <div className="absolute inset-x-8 bottom-7 h-4 rounded-full bg-amber-900/10 blur-md" />

        <div className="relative grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {slots.map((slot) => {
            const tool = slot.tool;
            const pendingContent = renderPendingContent?.(slot, tool) ?? null;
            const surfaceProduceLots = slot.surfaceProduceLots ?? [];
            const highlightsWorkbenchDrop = isBenchSlotHighlighted?.(slot) ?? false;
            const canAcceptWorkbenchDragOver = (event: DragEvent<HTMLElement>) => {
              if (isBenchSlotHighlighted) {
                return highlightsWorkbenchDrop;
              }

              return canAcceptWorkbenchDrop(event, slot);
            };

            return (
              <article
                key={slot.id}
                className="rounded-[1.8rem] border border-white/70 bg-white/70 p-4 shadow-[0_18px_40px_rgba(148,95,33,0.08)] xl:p-5"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{slot.label}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {tool
                        ? "Ready for bench operations."
                        : surfaceProduceLots.length > 0
                          ? "Produce is resting directly on the station."
                          : "Waiting for a first tool."}
                    </p>
                  </div>
                  <button
                    aria-label={`Remove ${slot.label}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:border-slate-300 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                    data-testid={`remove-workbench-slot-button-${slot.id}`}
                    disabled={tool !== null || surfaceProduceLots.length > 0}
                    onClick={() => {
                      if (tool !== null || surfaceProduceLots.length > 0) {
                        return;
                      }
                      onRemoveWorkbenchSlot?.(slot.id);
                    }}
                    type="button"
                  >
                    <svg
                      aria-hidden="true"
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 16 16"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M4 8H12"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeWidth="1.6"
                      />
                    </svg>
                  </button>
                </div>

                <div
                  className={`rounded-[1.6rem] border border-dashed bg-white/90 p-3 transition-colors ${
                    highlightsWorkbenchDrop
                      ? "border-sky-300 bg-sky-50/70 ring-2 ring-sky-200/80"
                      : "border-slate-300"
                  }`}
                  data-drop-highlighted={highlightsWorkbenchDrop ? "true" : "false"}
                  data-testid={`bench-slot-${slot.id}`}
                  onDragOver={(event) => {
                    if (!canAcceptWorkbenchDragOver(event)) {
                      return;
                    }
                    event.preventDefault();
                  }}
                  onDrop={(event) => handleDrop(event, slot)}
                >
                  {tool ? (
                    <BenchToolCard
                      draggable={
                        !dndDisabled && (canDragBenchTool ? canDragBenchTool(slot.id, tool) : false)
                      }
                      onClick={(event) => {
                        onBenchToolClick?.(slot.id, tool, event);
                      }}
                      onDragStart={(event) => {
                        if (!onBenchToolDragStart) {
                          return;
                        }
                        onBenchToolDragStart(slot.id, tool, event.dataTransfer);
                      }}
                      onProduceLotDragEnd={() => {
                        onBenchToolDragEnd?.();
                      }}
                      onProduceLotDragStart={
                        dndDisabled
                          ? undefined
                          : (produceLot, event) => {
                              onProduceLotDragStart?.(slot.id, produceLot, event.dataTransfer);
                            }
                      }
                      onProduceLotClick={
                        tool.toolType === "cutting_board"
                          ? (produceLot) => {
                              onProduceLotClick?.(slot.id, produceLot);
                            }
                          : undefined
                      }
                      onDragEnd={() => {
                        onBenchToolDragEnd?.();
                      }}
                      onPointerDown={(event) => {
                        onBenchToolPointerDown?.(slot.id, tool, event);
                      }}
                      onPointerUp={(event) => {
                        onBenchToolPointerUp?.(slot.id, tool, event);
                      }}
                      onToolIllustrationClick={(event) => {
                        onBenchToolIllustrationClick?.(slot.id, tool, event);
                      }}
                      onRemoveLiquid={(liquidId) => {
                        onRemoveLiquid(slot.id, liquidId);
                      }}
                      onSampleLabelTextChange={(labelId, sampleLabelText) => {
                        onSampleLabelTextChange?.(slot.id, labelId, sampleLabelText);
                      }}
                      onToggleSeal={() => {
                        onToggleToolSeal?.(slot.id, tool);
                      }}
                      onSampleLabelDragEnd={onSampleLabelDragEnd}
                      onSampleLabelDragStart={
                        dndDisabled
                          ? undefined
                          : (label, event) => {
                              onSampleLabelDragStart?.(slot.id, label, event.dataTransfer);
                            }
                      }
                      pendingContent={pendingContent}
                      tool={tool}
                    />
                  ) : pendingContent ? (
                    <div className="flex min-h-56 flex-col justify-center p-1">{pendingContent}</div>
                  ) : surfaceProduceLots.length > 0 ? (
                    <div className="flex min-h-56 flex-col justify-between p-1">
                      <div>
                        <p className="text-base font-semibold text-slate-950">Station surface</p>
                        <p className="mt-1 text-xs text-slate-600">
                          Direct produce contact contaminates the lot.
                        </p>
                      </div>
                      <div className="mt-3 space-y-2">
                        {surfaceProduceLots.map((produceLot) => (
                          <ProduceLotCard
                            className="shadow-sm"
                            dataTestId={`bench-surface-produce-lot-${produceLot.id}`}
                            draggable={!dndDisabled && Boolean(onProduceLotDragStart)}
                            footerBadge={<ProduceLotStatusBadge produceLot={produceLot} />}
                            key={produceLot.id}
                            metadata={formatProduceLotMetadata(produceLot)}
                            onClick={() => {
                              onProduceLotClick?.(slot.id, produceLot);
                            }}
                            onDragEnd={() => {
                              onBenchToolDragEnd?.();
                            }}
                            onDragStart={(event) => {
                              if (dndDisabled) {
                                return;
                              }
                              onProduceLotDragStart?.(slot.id, produceLot, event.dataTransfer);
                            }}
                            produceLot={produceLot}
                            variant="compact"
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-h-56 flex-col items-center justify-center rounded-[1.4rem] border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center 2xl:min-h-[20rem]">
                      <p className="text-sm font-semibold text-slate-900">Empty station</p>
                      <p className="mt-2 max-w-xs text-sm text-slate-600">
                        Drop a workflow tool here to start building the bench.
                      </p>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
