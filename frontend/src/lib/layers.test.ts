import { describe, expect, it } from "vitest";

import { LAYER } from "@/lib/layers";

describe("stacking bands", () => {
  it("keeps every tutorial coach layer above every dialog", () => {
    const dialogs = [LAYER.dialog, LAYER.dialogAbove, LAYER.dialogTop];
    const coach = [LAYER.coachDropHalo, LAYER.coachSpotlight, LAYER.coachPanel];

    expect(Math.min(...coach)).toBeGreaterThan(Math.max(...dialogs));
  });

  it("paints the coach panel above its own spotlight", () => {
    expect(LAYER.coachPanel).toBeGreaterThan(LAYER.coachSpotlight);
    expect(LAYER.coachSpotlight).toBeGreaterThan(LAYER.coachDropHalo);
  });
});
