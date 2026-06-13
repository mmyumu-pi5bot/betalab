"use client";

import { VerticalProgressIndicator } from "@/components/vertical-progress-indicator";

type DegassingIndicatorProps = {
  progress: number;
};

export function DegassingIndicator({ progress }: DegassingIndicatorProps) {
  return (
    <VerticalProgressIndicator
      ariaLabel="Degassing indicator"
      fillClassName="bg-[linear-gradient(180deg,#e5e7eb_0%,#9ca3af_55%,#6b7280_100%)]"
      progress={progress}
      testId="degassing-indicator"
      tooltip="Degassing"
    />
  );
}
