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
      <div className="rounded-xl border border-slate-300 bg-slate-900 px-3 py-2 text-sky-100">
        <div className="flex items-center justify-between font-mono text-xs">
          <span>{props.isRunning ? "SEPARATING" : hasTube ? "READY" : "AWAITING TUBE"}</span>
          <span>{props.progressPercent}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-sky-400 transition-[width]"
            data-testid="centrifuge-progress-bar"
            style={{ width: `${props.progressPercent}%` }}
          />
        </div>
        {!props.isRunning && props.startBlockReason ? (
          <p className="mt-2 text-[11px] leading-4 text-amber-200">{props.startBlockReason}</p>
        ) : null}
      </div>
      {hasTube ? <div className="mt-2 rounded-xl border border-sky-200 bg-sky-50 p-2">{props.stagedContent}</div> : null}
    </WorkspaceEquipmentWidget>
  );
}
