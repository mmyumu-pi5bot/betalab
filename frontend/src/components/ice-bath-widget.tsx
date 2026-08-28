"use client";

import type { DragEvent, ReactNode } from "react";

import { IceBathIllustration } from "@/components/illustrations/ice-bath-illustration";
import { WorkspaceEquipmentWidget } from "@/components/workspace-equipment-widget";
import { useT } from "@/lib/i18n";

type IceBathWidgetProps = {
  headerAction?: ReactNode;
  isDropHighlighted: boolean;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  stagedContent?: ReactNode;
};

export function IceBathWidget(props: IceBathWidgetProps) {
  const t = useT();
  const hasTube = props.stagedContent !== undefined;
  return (
    <WorkspaceEquipmentWidget
      bodyClassName="px-3 py-3"
      dataDropHighlighted={props.isDropHighlighted ? "true" : "false"}
      dropZoneTestId="ice-bath-dropzone"
      eyebrow={t("widget.ice_bath")}
      headerAction={props.headerAction}
      onDragOver={props.onDragOver}
      onDrop={props.onDrop}
    >
      <IceBathIllustration className="w-full" hasTube={hasTube} />
      <p className="mt-2 text-[11px] leading-4 text-slate-500" data-testid="ice-bath-hint">
        {hasTube
          ? t("iceBath.chilling")
          : t("iceBath.idle")}
      </p>
      {hasTube ? <div className="mt-2 rounded-xl border border-sky-200 bg-sky-50 p-2">{props.stagedContent}</div> : null}
    </WorkspaceEquipmentWidget>
  );
}
