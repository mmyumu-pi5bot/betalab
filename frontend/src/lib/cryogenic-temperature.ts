import type { MessageKey } from "@/lib/i18n";

export const ambientTemperatureC = 20;
// Dry ice sublimates at -78.5 C, so it is the coldest a cryo-cooled lot can get.
export const cryogenicTemperatureC = -78.5;
// Mirrors PhysicalSimulationService.pesticide_degradation_threshold_c: above this
// the thermolabile residues are actively breaking down, so the indicator reads
// hot exactly when the player is losing something.
export const residueDegradationTemperatureC = 30;

export type CryogenicTone = "ambient" | "cooling" | "cryogenic" | "hot" | "warm";

// The status names a catalogue key rather than a string: this module is pure and
// has no locale of its own, so the caller that renders it does the translating.
type CryogenicStatus = {
  labelKey: MessageKey;
  tone: CryogenicTone;
};

export function getCryogenicStatus(temperatureC: number): CryogenicStatus {
  if (temperatureC >= residueDegradationTemperatureC) {
    return { labelKey: "temperature.hot", tone: "hot" };
  }

  if (temperatureC >= 25) {
    return { labelKey: "temperature.warm", tone: "warm" };
  }

  if (temperatureC <= -45) {
    return { labelKey: "temperature.cryogenic", tone: "cryogenic" };
  }

  if (temperatureC <= -5) {
    return { labelKey: "temperature.coolingFast", tone: "cooling" };
  }

  return { labelKey: "temperature.nearAmbient", tone: "ambient" };
}
