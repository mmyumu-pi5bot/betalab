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
      faults: ["cemented"],
      isUsable: false,
    },
  };
}

describe("BenchToolCard QuEChERS state", () => {
  it("renders a calibration solution through the generic liquid row", () => {
    const tool = makeTool();
    tool.toolId = "sample_vial_lcms";
    tool.toolType = "sample_vial";
    tool.capacity_ml = 2;
    tool.liquids = [
      {
        id: "calibrant_1",
        liquidId: "calibration_solution",
        name: "Multi-residue stock solution",
        volume_ml: 1,
        accent: "rose",
      },
      {
        id: "istd_1",
        liquidId: "istd_solution",
        name: "ISTD solution",
        volume_ml: 0.05,
        accent: "emerald",
      },
    ];
    tool.calibrationContext = {
      levelNgPerMl: 10,
      compoundIds: ["chlorpyrifos"],
    };

    render(<BenchToolCard onRemoveLiquid={vi.fn()} tool={tool} />);

    expect(screen.getByText("Declared contents")).toBeInTheDocument();
    expect(screen.getByText("Multi-residue stock solution")).toBeInTheDocument();
    expect(screen.getByText("1.00 mL")).toBeInTheDocument();
    expect(screen.getByText("ISTD solution")).toBeInTheDocument();
    expect(screen.getByText("0.05 mL")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove/ })).not.toBeInTheDocument();
  });

  it("keeps nominal liquid contents visible after slurry forms", () => {
    const tool = makeTool();
    tool.containsSlurry = true;
    tool.liquids = [
      {
        id: "acetonitrile_1",
        liquidId: "acetonitrile_extraction",
        name: "Acetonitrile",
        volume_ml: 10,
        accent: "amber",
      },
    ];

    render(<BenchToolCard onRemoveLiquid={vi.fn()} tool={tool} />);

    expect(screen.getByText("Declared contents")).toBeInTheDocument();
    expect(screen.getByText("Acetonitrile")).toBeInTheDocument();
    expect(screen.getByText("10.00 mL")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove Acetonitrile" })).not.toBeInTheDocument();
  });

  it("shows only the temperature indicator", () => {
    render(<BenchToolCard onRemoveLiquid={vi.fn()} tool={makeTool()} />);

    expect(screen.queryByText("Cemented")).not.toBeInTheDocument();
    expect(screen.getByText("64.5°C")).toBeInTheDocument();
    expect(screen.getByTestId("temperature-indicator-fill")).toBeInTheDocument();
    expect(screen.queryByText("Cementation")).not.toBeInTheDocument();
    expect(screen.queryByText("Thermal degradation")).not.toBeInTheDocument();
    expect(screen.queryByTestId("quechers-state-tube_1")).not.toBeInTheDocument();
  });

  it("keeps the temperature indicator visible at ambient temperature", () => {
    const tool = makeTool();
    tool.quechersState = {
      ...tool.quechersState!,
      phase: "mixed",
      temperatureC: 20,
      cementationProgress: 0,
      thermalDegradationProgress: 0,
      faults: [],
      isUsable: true,
    };

    render(<BenchToolCard onRemoveLiquid={vi.fn()} tool={tool} />);

    expect(screen.queryByText("Mixed")).not.toBeInTheDocument();
    expect(screen.queryByText("Slurry mixed")).not.toBeInTheDocument();
    expect(screen.getByText("20.0°C")).toBeInTheDocument();
    expect(screen.getByTestId("temperature-indicator-fill")).toBeInTheDocument();
  });

  it("shows an ambient temperature indicator on any container", () => {
    const tool = makeTool();
    tool.toolId = "hdpe_storage_jar_2l";
    tool.toolType = "storage_jar";
    tool.label = "Wide-neck HDPE jar";
    tool.quechersState = undefined;

    render(<BenchToolCard onRemoveLiquid={vi.fn()} tool={tool} />);

    expect(screen.getByText("20.0°C")).toBeInTheDocument();
    expect(screen.queryByText("Cementation")).not.toBeInTheDocument();
    expect(screen.queryByText("Thermal degradation")).not.toBeInTheDocument();
  });
});
