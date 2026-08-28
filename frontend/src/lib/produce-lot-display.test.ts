import { describe, expect, it } from "vitest";

import { getTranslator } from "@/lib/i18n";
import {
  getProduceLotDegassingIntensity,
  getProduceLotDisplayName,
  isProduceLotDegassing,
} from "@/lib/produce-lot-display";

const t = getTranslator("en");

describe("getProduceLotDisplayName", () => {
  it("keeps the base label for whole produce lots", () => {
    expect(
      getProduceLotDisplayName(t, {
        id: "produce_1",
        label: "Apple lot 1",
        produceType: "apple",
        totalMassG: 1200,
        unitCount: 6,
      }),
    ).toBe("Apple lot 1");
  });

  it("adds the powder suffix for ground produce lots", () => {
    expect(
      getProduceLotDisplayName(t, {
        id: "produce_1",
        materialState: "ground",
        label: "Apple lot 1",
        produceType: "apple",
        totalMassG: 1200,
        unitCount: 6,
      }),
    ).toBe("Apple lot 1 powder");
  });
});

describe("degassing helpers", () => {
  it("marks produce lots with residual CO2 as degassing", () => {
    expect(
      isProduceLotDegassing({
        id: "produce_1",
        label: "Apple lot 1",
        produceType: "apple",
        residualCo2MassG: 5,
        totalMassG: 1200,
        unitCount: 6,
      }),
    ).toBe(true);
  });

  it("derives a heavy degassing plume from large residual CO2", () => {
    expect(
      getProduceLotDegassingIntensity({
        id: "produce_1",
        label: "Apple lot 1",
        produceType: "apple",
        residualCo2MassG: 180,
        totalMassG: 1200,
        unitCount: 6,
      }),
    ).toBe("heavy");
  });
});
