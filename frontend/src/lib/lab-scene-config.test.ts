import { describe, expect, it } from "vitest";

import { labSceneWidgetFrameSpecs } from "@/lib/lab-scene-config";

describe("labSceneWidgetFrameSpecs", () => {
  it("keeps the workspace equipment frames compact", () => {
    expect(labSceneWidgetFrameSpecs).toMatchObject({
      analytical_balance: { width: 276 },
      centrifuge: { width: 292 },
      grinder: { width: 390 },
      gross_balance: { width: 276 },
      instrument: { width: 460 },
      lims: { width: 440, y: 584 },
      rack: { width: 440 },
      vortex: { width: 260 },
      workbench: { width: 980 },
    });
  });
});
