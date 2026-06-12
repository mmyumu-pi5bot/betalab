import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BenchToolCard } from "@/components/bench-tool-card";
import type { BenchToolInstance } from "@/types/workbench";

function makeTool(): BenchToolInstance {
  return {
    id: "tube_1",
    toolId: "centrifuge_tube_50ml",
    label: "50 mL centrifuge tube",
    subtitle: "QuEChERS extraction",
    accent: "amber",
    toolType: "centrifuge_tube",
    capacity_ml: 50,
    canReceiveContents: true,
    canReceiveLiquids: true,
    canReceiveProduce: false,
    canSeal: true,
    isDraggable: true,
    allowedDropTargets: ["workbench_slot", "vortex_widget", "trash_bin"],
    liquids: [],
    quechersState: {
      saltsAdded: true,
      phase: "cemented",
      temperatureC: 64.5,
      cementationProgress: 1,
      thermalDegradationProgress: 0.42,
      reactionElapsedSeconds: 15,
      fault: "cemented",
      isUsable: false,
    },
  };
}

describe("BenchToolCard QuEChERS state", () => {
  it("shows temperature and both chemistry gauges", () => {
    render(<BenchToolCard onRemoveLiquid={vi.fn()} tool={makeTool()} />);

    expect(screen.getByText("Cemented")).toBeInTheDocument();
    expect(screen.getByText("64.5°C")).toBeInTheDocument();
    expect(screen.getByTestId("quechers-cementation-tube_1")).toHaveTextContent("100%");
    expect(screen.getByTestId("quechers-degradation-tube_1")).toHaveTextContent("42%");
  });
});
