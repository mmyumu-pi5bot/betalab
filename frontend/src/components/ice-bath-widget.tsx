"use client";

import type { DragEvent, ReactNode } from "react";

import { IceBathIllustration } from "@/components/illustrations/ice-bath-illustration";
import { WorkspaceEquipmentWidget } from "@/components/workspace-equipment-widget";

type IceBathWidgetProps = {
  headerAction?: ReactNode;
  isDropHighlighted: boolean;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  stagedContent?: ReactNode;
};

export function IceBathWidget(props: IceBathWidgetProps) {
  const hasTube = props.stagedContent !== undefined;
  return (
    <WorkspaceEquipmentWidget
      bodyClassName="px-3 py-3"
      dataDropHighlighted={props.isDropHighlighted ? "true" : "false"}
      dropZoneTestId="ice-bath-dropzone"
      eyebrow="Ice bath"
      headerAction={props.headerAction}
      onDragOver={props.onDragOver}
      onDrop={props.onDrop}
    >
      <IceBathIllustration className="w-full" hasTube={hasTube} />
      <p className="mt-2 text-[11px] leading-4 text-slate-500" data-testid="ice-bath-hint">
        {hasTube
          ? "Chilling. The salts release the same heat whatever the tube starts at, so a cold start lands the exotherm lower."
          : "Stand a tube here to chill it before the salts go in, or to pull a reacting tube back down."}
      </p>
      {hasTube ? <div className="mt-2 rounded-xl border border-sky-200 bg-sky-50 p-2">{props.stagedContent}</div> : null}
    </WorkspaceEquipmentWidget>
  );
}
