"use client";

import type { DragEvent, ReactNode } from "react";

import { VortexMixerIllustration } from "@/components/illustrations/vortex-mixer-illustration";
import { WorkspaceEquipmentWidget } from "@/components/workspace-equipment-widget";

type VortexWidgetProps = {
  headerAction?: ReactNode;
  isCommandPending: boolean;
  isDropHighlighted: boolean;
  isRunning: boolean;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onStart: () => void;
  progressPercent: number;
  stagedContent?: ReactNode;
};

export function VortexWidget({
  headerAction,
  isCommandPending,
  isDropHighlighted,
  isRunning,
  onDragOver,
  onDrop,
  onStart,
  progressPercent,
  stagedContent,
}: VortexWidgetProps) {
  const hasTool = stagedContent !== undefined;
  const canStart = hasTool && !isRunning && !isCommandPending;

  return (
    <WorkspaceEquipmentWidget
      bodyClassName="px-3 py-3"
      dataDropHighlighted={isDropHighlighted ? "true" : "false"}
      dropZoneTestId="vortex-dropzone"
      eyebrow="Vortex mixer"
      headerAction={headerAction}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="space-y-2">
        {/* Illustration — cup is the drop target, start button is overlaid on the device */}
        <VortexMixerIllustration
          className="h-[180px] w-full"
          dropHighlighted={isDropHighlighted}
          hasTool={hasTool}
          isRunning={isRunning}
          onStartClick={onStart}
          startDisabled={!canStart}
          startLabel={isRunning ? "Vortex running" : "Start vortex"}
          startTestId="vortex-start-button"
        />

        {/* LCD status panel */}
        <div
          className="rounded-[1rem] border border-slate-300 bg-[linear-gradient(180deg,#dce7c7,#b8c89b)] px-4 py-3 text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
          data-testid="vortex-lcd-panel"
        >
          <p
            className={`font-mono text-xs font-bold uppercase tracking-[0.28em] ${
              isRunning ? "text-emerald-800" : "text-slate-800"
            }`}
          >
            {isRunning ? "Mixing" : hasTool ? "Ready" : "Idle"}
          </p>
          <div className="mt-3 min-h-[2rem]">
            {isRunning ? (
              <div className="h-3 overflow-hidden rounded-full border border-slate-500/30 bg-slate-900/10">
                <div
                  className="h-full rounded-full bg-emerald-700 transition-[width]"
                  data-testid="vortex-progress-bar"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            ) : (
              <p className="font-mono text-sm font-semibold uppercase tracking-[0.2em] text-slate-800">
                {hasTool ? "System ready" : "Awaiting tube"}
              </p>
            )}
          </div>
        </div>

        {/* Tool card slot */}
        {hasTool && (
          <div className="rounded-[0.85rem] border border-violet-200 bg-violet-50/60 px-2 py-1.5">
            {stagedContent}
          </div>
        )}
      </div>
    </WorkspaceEquipmentWidget>
  );
}
