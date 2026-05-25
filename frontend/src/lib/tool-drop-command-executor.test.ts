import { describe, expect, it, vi } from "vitest";

import { executeToolDropCommand } from "@/lib/tool-drop-command-executor";

describe("tool-drop-command-executor", () => {
  it("dispatches tool drops through the generic move-object API", () => {
    const api = {
      moveObject: vi.fn(),
    };

    expect(executeToolDropCommand({
      kind: "move_object",
      payload: {
        entity: { kind: "tool", id: "rack_a1" },
        source: { kind: "rack", id: "rack_a1" },
        destination: { kind: "workbench_slot", id: "station_1" },
      },
    }, api)).toBe(true);

    expect(api.moveObject).toHaveBeenCalledWith({
      entity: { kind: "tool", id: "rack_a1" },
      source: { kind: "rack", id: "rack_a1" },
      destination: { kind: "workbench_slot", id: "station_1" },
    });
  });

  it("ignores unresolved drops", () => {
    const api = {
      moveObject: vi.fn(),
    };

    expect(executeToolDropCommand(null, api)).toBe(false);
    expect(api.moveObject).not.toHaveBeenCalled();
  });
});
