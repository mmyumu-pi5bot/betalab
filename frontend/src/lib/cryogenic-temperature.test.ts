import { describe, expect, it } from "vitest";

import {
  cryogenicTemperatureC,
  getCryogenicStatus,
} from "@/lib/cryogenic-temperature";

describe("getCryogenicStatus", () => {
  it("reports hot produce above the handling limit", () => {
    expect(getCryogenicStatus(60)).toEqual({ label: "Hot", tone: "hot" });
  });

  it("reports warm produce between ambient and the handling limit", () => {
    expect(getCryogenicStatus(35)).toEqual({ label: "Warm", tone: "warm" });
  });

  it("reports near ambient produce", () => {
    expect(getCryogenicStatus(20)).toEqual({ label: "Near ambient", tone: "ambient" });
  });

  it("reports produce that is cooling down", () => {
    expect(getCryogenicStatus(-20)).toEqual({ label: "Cooling fast", tone: "cooling" });
  });

  it("reports cryogenic produce", () => {
    expect(getCryogenicStatus(-70)).toEqual({ label: "Cryogenic", tone: "cryogenic" });
  });

  it("pins the cryogenic floor to the dry ice sublimation point", () => {
    expect(cryogenicTemperatureC).toBe(-78.5);
  });
});
