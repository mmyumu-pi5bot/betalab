export const ambientTemperatureC = 20;
// Dry ice sublimates at -78.5 C, so it is the coldest a cryo-cooled lot can get.
export const cryogenicTemperatureC = -78.5;
// Mirrors PhysicalSimulationService.pesticide_degradation_threshold_c: above this
// the thermolabile residues are actively breaking down, so the indicator reads
// hot exactly when the player is losing something.
export const residueDegradationTemperatureC = 30;

export type CryogenicTone = "ambient" | "cooling" | "cryogenic" | "hot" | "warm";

export type CryogenicStatus = {
  label: string;
  tone: CryogenicTone;
};

export function getCryogenicStatus(temperatureC: number): CryogenicStatus {
  if (temperatureC >= residueDegradationTemperatureC) {
    return { label: "Hot", tone: "hot" };
  }

  if (temperatureC >= 25) {
    return { label: "Warm", tone: "warm" };
  }

  if (temperatureC <= -45) {
    return { label: "Cryogenic", tone: "cryogenic" };
  }

  if (temperatureC <= -5) {
    return { label: "Cooling fast", tone: "cooling" };
  }

  return { label: "Near ambient", tone: "ambient" };
}
