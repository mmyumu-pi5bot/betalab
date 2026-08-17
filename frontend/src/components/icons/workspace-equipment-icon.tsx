import { AutosamplerRackIllustration } from "@/components/illustrations/autosampler-rack-illustration";
import { CentrifugeIllustration } from "@/components/illustrations/centrifuge-illustration";
import { IceBathIllustration } from "@/components/illustrations/ice-bath-illustration";
import { CryogenicGrinderIllustration } from "@/components/illustrations/cryogenic-grinder-illustration";
import { LcMsMsInstrumentIllustration } from "@/components/illustrations/lc-msms-instrument-illustration";
import { ProduceBasketIllustration } from "@/components/illustrations/produce-basket-illustration";
import { VortexMixerIllustration } from "@/components/illustrations/vortex-mixer-illustration";
import type { WorkspaceWidgetType } from "@/types/workbench";

type WorkspaceEquipmentIconProps = {
  className?: string;
  widgetType: WorkspaceWidgetType;
};

export function WorkspaceEquipmentIcon({
  className,
  widgetType,
}: WorkspaceEquipmentIconProps) {
  if (widgetType === "autosampler_rack") {
    return (
      <div className={className} data-widget-type={widgetType}>
        <AutosamplerRackIllustration slotCount={4} tone="neutral" />
      </div>
    );
  }

  if (widgetType === "produce_basket") {
    return (
      <div className={className} data-widget-type={widgetType}>
        <ProduceBasketIllustration itemCount={5} />
      </div>
    );
  }

  if (widgetType === "cryogenic_grinder") {
    return (
      <div className={className} data-widget-type={widgetType}>
        <CryogenicGrinderIllustration />
      </div>
    );
  }

  if (widgetType === "vortex_mixer") {
    return (
      <div className={className} data-widget-type={widgetType}>
        <VortexMixerIllustration />
      </div>
    );
  }

  if (widgetType === "centrifuge") {
    return (
      <div className={className} data-widget-type={widgetType}>
        <CentrifugeIllustration hasTube={false} isRunning={false} separationProgress={0} startDisabled />
      </div>
    );
  }

  if (widgetType === "ice_bath") {
    return (
      <div className={className} data-widget-type={widgetType}>
        <IceBathIllustration hasTube={false} />
      </div>
    );
  }

  if (widgetType === "lims_terminal") {
    return (
      <div className={className} data-widget-type={widgetType}>
        <svg aria-label={widgetType} className="h-full w-full" viewBox="0 0 120 120">
          {/* Monitor */}
          <rect x="12" y="20" width="96" height="66" rx="8" fill="#e2e8f0" stroke="#64748b" strokeWidth="4" />
          <rect x="22" y="30" width="76" height="46" rx="4" fill="#0f172a" />
          {/* Barcode on screen */}
          <g fill="#e2e8f0">
            <rect x="30" y="38" width="4" height="30" />
            <rect x="38" y="38" width="2" height="30" />
            <rect x="44" y="38" width="5" height="30" />
            <rect x="53" y="38" width="2" height="30" />
            <rect x="59" y="38" width="4" height="30" />
            <rect x="67" y="38" width="3" height="30" />
            <rect x="74" y="38" width="5" height="30" />
            <rect x="83" y="38" width="2" height="30" />
            <rect x="89" y="38" width="4" height="30" />
          </g>
          {/* Stand + base */}
          <rect x="52" y="86" width="16" height="12" fill="#cbd5e1" />
          <rect x="38" y="98" width="44" height="8" rx="4" fill="#94a3b8" />
        </svg>
      </div>
    );
  }

  if (widgetType === "gross_balance" || widgetType === "analytical_balance") {
    return (
      <div className={className} data-widget-type={widgetType}>
        <svg aria-label={widgetType} className="h-full w-full" viewBox="0 0 120 120">
          <rect x="12" y="18" width="96" height="84" rx="20" fill="#e2e8f0" />
          <rect x="22" y="30" width="76" height="30" rx="10" fill="#0f172a" />
          <rect x="30" y="70" width="60" height="18" rx="9" fill="#cbd5e1" stroke="#64748b" strokeWidth="4" />
          <circle cx="98" cy="82" r="6" fill={widgetType === "analytical_balance" ? "#10b981" : "#f97316"} />
        </svg>
      </div>
    );
  }

  return (
    <div className={className} data-widget-type={widgetType}>
      <LcMsMsInstrumentIllustration status="idle" />
    </div>
  );
}
