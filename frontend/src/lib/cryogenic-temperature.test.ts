import { describe, expect, it } from "vitest";

import {
  cryogenicTemperatureC,
  getCryogenicStatus,
  residueDegradationTemperatureC,
} from "@/lib/cryogenic-temperature";

describe("getCryogenicStatus", () => {
  it("reports hot contents once thermolabile residues start breaking down", () => {
    expect(getCryogenicStatus(35)).toEqual({ labelKey: "temperature.hot", tone: "hot" });
    expect(getCryogenicStatus(residueDegradationTemperatureC)).toEqual({
      labelKey: "temperature.hot",
      tone: "hot",
    });
  });

  it("reports warm contents climbing towards that threshold", () => {
    expect(getCryogenicStatus(27)).toEqual({ labelKey: "temperature.warm", tone: "warm" });
  });

  it("pins the hot band to the temperature the backend degrades residues at", () => {
    expect(residueDegradationTemperatureC).toBe(30);
  });

  it("reports near ambient produce", () => {
    expect(getCryogenicStatus(20)).toEqual({ labelKey: "temperature.nearAmbient", tone: "ambient" });
  });

  it("reports produce that is cooling down", () => {
    expect(getCryogenicStatus(-20)).toEqual({ labelKey: "temperature.coolingFast", tone: "cooling" });
  });

  it("reports cryogenic produce", () => {
    expect(getCryogenicStatus(-70)).toEqual({ labelKey: "temperature.cryogenic", tone: "cryogenic" });
  });

  it("pins the cryogenic floor to the dry ice sublimation point", () => {
    expect(cryogenicTemperatureC).toBe(-78.5);
  });
});
