import type { Translate } from "@/lib/i18n";
import type { ExperimentProduceLot } from "@/types/workbench";

export function getProduceLotDisplayName(t: Translate, produceLot: ExperimentProduceLot) {
  if (produceLot.materialState !== "ground") {
    return produceLot.label;
  }

  // Ground material is named "<lot> powder" unless the label already says so —
  // and the word to look for is the one the active locale uses.
  const powderWord = t("produce.powderWord");
  const alreadyNamed = new RegExp(`\\b${powderWord}\\b`, "i").test(produceLot.label);
  return alreadyNamed ? produceLot.label : t("produce.powderSuffix", { label: produceLot.label });
}

export function isProduceLotDegassing(produceLot: ExperimentProduceLot) {
  return (produceLot.residualCo2MassG ?? 0) > 0;
}

export function getProduceLotDegassingIntensity(produceLot: ExperimentProduceLot) {
  const residualCo2MassG = produceLot.residualCo2MassG ?? 0;
  if (residualCo2MassG <= 0) {
    return "none";
  }

  const degassingRatio = residualCo2MassG / Math.max(produceLot.totalMassG, 1);
  if (degassingRatio >= 0.12) {
    return "heavy";
  }
  if (degassingRatio >= 0.03) {
    return "medium";
  }

  return "light";
}
