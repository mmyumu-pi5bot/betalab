"use client";

import type { DragEvent, ReactNode } from "react";

import { DegassingIndicator } from "@/components/degassing-indicator";
import { AppleIllustration } from "@/components/illustrations/apple-illustration";
import { PesticideResiduesIndicator } from "@/components/pesticide-residues-indicator";
import { TemperatureIndicator } from "@/components/temperature-indicator";
import { dragAffordanceClassName } from "@/lib/drag-affordance";
import {
  getProduceLotDegassingIntensity,
  getProduceLotDisplayName,
  isProduceLotDegassing,
} from "@/lib/produce-lot-display";
import type { ExperimentProduceLot } from "@/types/workbench";

type ProduceLotCardProps = {
  className?: string;
  dataTestId: string;
  draggable?: boolean;
  footerBadge?: ReactNode;
  metadata: string;
  onClick?: () => void;
  onDragEnd?: (event: DragEvent<HTMLDivElement>) => void;
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
  produceLot: ExperimentProduceLot;
  variant: "compact" | "expanded";
};

const ambientTemperatureC = 20;

function getProduceIllustrationVariant(produceLot: ExperimentProduceLot) {
  if (produceLot.materialState === "ground") {
    return "ground";
  }

  return produceLot.materialState === "whole" ? "whole" : "cut";
}

export function ProduceLotCard({
  className = "",
  dataTestId,
  draggable = false,
  footerBadge,
  metadata,
  onClick,
  onDragEnd,
  onDragStart,
  produceLot,
  variant,
}: ProduceLotCardProps) {
  const displayName = getProduceLotDisplayName(produceLot);
  const isDegassing = isProduceLotDegassing(produceLot);
  const smokeIntensity = getProduceLotDegassingIntensity(produceLot);
  const degassingProgress = Math.min((produceLot.residualCo2MassG ?? 0) / Math.max(produceLot.totalMassG * 0.12, 1), 1);
  const cardClassName =
    variant === "compact"
      ? "rounded-[1rem] border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
      : "flex items-center justify-between gap-3 rounded-[1rem] border border-slate-200 bg-slate-50 px-3 py-2";

  return (
    <div
      className={`${draggable ? dragAffordanceClassName : ""} ${cardClassName} ${className}`.trim()}
      data-debug-model={JSON.stringify(produceLot)}
      data-debug-label={getProduceLotDisplayName(produceLot)}
      data-degassing={isDegassing ? "true" : "false"}
      data-testid={dataTestId}
      draggable={draggable}
      onClick={onClick}
      onDragEnd={onDragEnd}
      onDragStart={onDragStart}
    >
      {variant === "compact" ? (
        <div className="space-y-1">
          <p className="text-sm font-semibold leading-4 text-slate-900" title={displayName}>
            {displayName}
          </p>
          <div className="flex items-start gap-2">
            <AppleIllustration
              className="h-10 w-10 shrink-0"
              smokeIntensity={smokeIntensity}
              variant={getProduceIllustrationVariant(produceLot)}
            />
            <div className="min-w-0 flex-1">
              {produceLot.materialState === "waste" ? (
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-700">
                  Jammed
                </p>
              ) : null}
              <p className="text-xs leading-[1.05rem] text-slate-500" title={metadata}>
                {metadata}
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-1">
              {isDegassing ? <DegassingIndicator progress={degassingProgress} /> : null}
              {produceLot.pesticideResidues && Object.keys(produceLot.pesticideResidues).length > 0 ? (
                <PesticideResiduesIndicator
                  degradationFactors={produceLot.pesticideDegradationFactors ?? {}}
                  residues={produceLot.pesticideResidues}
                />
              ) : null}
              <TemperatureIndicator
                temperatureC={produceLot.temperatureC ?? ambientTemperatureC}
              />
            </div>
          </div>
          {footerBadge ?? null}
        </div>
      ) : (
        <>
          <div className="min-w-0 flex flex-1 items-center gap-3">
            <div className="h-10 w-10 shrink-0">
              <AppleIllustration
                className="h-10 w-10"
                smokeIntensity={smokeIntensity}
                variant={getProduceIllustrationVariant(produceLot)}
              />
            </div>
            <div className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-900" title={displayName}>
                {displayName}
              </span>
              <span className="mt-1 block truncate text-xs text-slate-500" title={metadata}>
                {metadata}
              </span>
            </div>
          </div>
          <div className="self-stretch flex items-center gap-1">
            {isDegassing ? <DegassingIndicator progress={degassingProgress} /> : null}
            {produceLot.pesticideResidues && Object.keys(produceLot.pesticideResidues).length > 0 ? (
              <PesticideResiduesIndicator
                degradationFactors={produceLot.pesticideDegradationFactors ?? {}}
                residues={produceLot.pesticideResidues}
              />
            ) : null}
            <TemperatureIndicator
              temperatureC={produceLot.temperatureC ?? ambientTemperatureC}
            />
          </div>
        </>
      )}
    </div>
  );
}
