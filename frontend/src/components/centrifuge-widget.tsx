"use client";

import type { DragEvent, ReactNode } from "react";

import { CentrifugeIllustration } from "@/components/illustrations/centrifuge-illustration";
import { WorkspaceEquipmentWidget } from "@/components/workspace-equipment-widget";

type CentrifugeWidgetProps = {
  canStart: boolean;
  headerAction?: ReactNode;
  isCommandPending: boolean;
  isDropHighlighted: boolean;
  isRunning: boolean;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onStart: () => void;
  progressPercent: number;
  separationProgress: number;
  stagedContent?: ReactNode;
  startBlockReason?: string | null;
};

export function CentrifugeWidget(props: CentrifugeWidgetProps) {
  const hasTube = props.stagedContent !== undefined;
  return (
    <WorkspaceEquipmentWidget
      bodyClassName="px-3 py-3"
      dataDropHighlighted={props.isDropHighlighted ? "true" : "false"}
      dropZoneTestId="centrifuge-dropzone"
      eyebrow="Centrifuge"
      headerAction={props.headerAction}
      onDragOver={props.onDragOver}
      onDrop={props.onDrop}
    >
      <CentrifugeIllustration
        className="h-[190px] w-full"
        hasTube={hasTube}
        isRunning={props.isRunning}
        onStartClick={props.onStart}
        separationProgress={props.separationProgress}
        startDisabled={!props.canStart || props.isRunning || props.isCommandPending}
        startLabel={props.isRunning ? "Centrifuging…" : "Start the centrifuge"}
        startTestId="centrifuge-start-button"
      />
      <div
        className="rounded-[1rem] border border-slate-300 bg-[linear-gradient(180deg,#dce7c7,#b8c89b)] px-4 py-3 text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
        data-testid="centrifuge-lcd-panel"
      >
        <div className="flex items-center justify-between gap-3">
          <p
            className={`font-mono text-xs font-bold uppercase tracking-[0.28em] ${
              props.isRunning ? "text-emerald-800" : "text-slate-800"
            }`}
          >
            {props.isRunning ? "Separating" : hasTube ? "Ready" : "Idle"}
          </p>
          <p className="font-mono text-xs font-bold text-slate-800">{props.progressPercent}%</p>
        </div>
        <div className="mt-3 min-h-[2rem]">
          <div className="h-3 overflow-hidden rounded-full border border-slate-500/30 bg-slate-900/10">
            <div
              className="h-full rounded-full bg-emerald-700 transition-[width]"
              data-testid="centrifuge-progress-bar"
              style={{ width: `${props.progressPercent}%` }}
            />
          </div>
          {!props.isRunning && props.startBlockReason ? (
            <p className="mt-2 font-mono text-[11px] leading-4 text-amber-800">{props.startBlockReason}</p>
          ) : null}
        </div>
      </div>
      {hasTube ? <div className="mt-2 rounded-xl border border-sky-200 bg-sky-50 p-2">{props.stagedContent}</div> : null}
    </WorkspaceEquipmentWidget>
  );
}
