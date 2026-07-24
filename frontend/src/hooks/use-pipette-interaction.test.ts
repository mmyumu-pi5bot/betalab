import { act, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePipetteInteraction } from "@/hooks/use-pipette-interaction";
import type { BenchToolInstance, PipetteState } from "@/types/workbench";

const tool = (toolType: BenchToolInstance["toolType"], overrides: Partial<BenchToolInstance> = {}): BenchToolInstance => ({
  id: `${toolType}_1`, toolId: toolType, label: toolType, subtitle: "", accent: "sky",
  toolType, capacity_ml: 10, canReceiveLiquids: true, sampleLabelText: null, produceLots: [],
  produceFractions: [{
    id: "fraction_1", produceLotId: "lot_1", produceMaterialStateId: "state_1", massG: 10,
    locationKind: "workbench_tool", locationId: `${toolType}_1`, containerId: `${toolType}_1`,
  }],
  liquids: [{ id: "liquid_1", liquidId: "solvent", name: "Solvent", volume_ml: 10, accent: "sky" }],
  quechersState: {
    saltsAdded: true, phase: "cemented", temperatureC: 20, cementationProgress: 1,
    thermalDegradationProgress: 0, reactionElapsedSeconds: 10, faults: [], isUsable: true,
  },
  quechersExtractionResult: { extractionManipFactor: 1, istdManipFactor: null, istdPhase: null },
  ...overrides,
});

const pointer = () => ({ button: 0, preventDefault: vi.fn(), stopPropagation: vi.fn() }) as unknown as React.PointerEvent<HTMLElement>;

function setup(pipette: PipetteState) {
  const onAspirate = vi.fn();
  const onDispense = vi.fn();
  const hook = renderHook(() => usePipetteInteraction({ isPipetteMode: true, onAspirate, onDispense, pipette }));
  return { ...hook, onAspirate, onDispense };
}

describe("usePipetteInteraction", () => {
  afterEach(() => vi.useRealTimers());

  it("does not restart its effects when command callbacks change identity", () => {
    const { result, rerender } = renderHook(
      ({ version }) => usePipetteInteraction({
        isPipetteMode: true,
        onAspirate: vi.fn(() => { void version; }),
        onDispense: vi.fn(() => { void version; }),
        pipette: { capacityMl: 1, volumeMl: 0, sourceToolId: null },
      }),
      { initialProps: { version: 0 } },
    );

    for (let version = 1; version <= 100; version += 1) rerender({ version });

    expect(result.current.pipetteHintMessage).toContain("Pipette vide");
  });

  it("sends one aspiration command when a tube click is released", () => {
    const { result, onAspirate, onDispense } = setup({ capacityMl: 1, volumeMl: 0, sourceToolId: null });
    act(() => result.current.handlePipetteToolPointerDown("station_1", tool("centrifuge_tube"), pointer()));
    expect(result.current.displayPipette.volumeMl).toBe(0.05);
    expect(onAspirate).not.toHaveBeenCalled();
    act(() => fireEvent.pointerUp(window));
    expect(onAspirate).toHaveBeenCalledWith({ tool_id: "centrifuge_tube_1", delta_volume_ml: 0.05 });
    expect(onDispense).not.toHaveBeenCalled();
  });

  it("aspirates a slurry-only tube", () => {
    const { result, onAspirate } = setup({ capacityMl: 1, volumeMl: 0, sourceToolId: null });
    const slurryTube = tool("centrifuge_tube", {
      liquids: [],
      containsSlurry: true,
      produceFractions: [{
        id: "slurry_1",
        produceLotId: "apple_1",
        produceMaterialStateId: "slurry_state_1",
        materialState: "slurry",
        massG: 10,
      }],
    });

    act(() => result.current.handlePipetteToolPointerDown("station_1", slurryTube, pointer()));
    act(() => fireEvent.pointerUp(window));

    expect(onAspirate).toHaveBeenCalledWith({
      tool_id: "centrifuge_tube_1",
      delta_volume_ml: 0.05,
    });
  });

  it("keeps aspirating while a tube is held", () => {
    vi.useFakeTimers();
    const { result, onAspirate, onDispense } = setup({ capacityMl: 1, volumeMl: 0, sourceToolId: null });
    act(() => result.current.handlePipetteToolPointerDown("station_1", tool("centrifuge_tube"), pointer()));
    act(() => vi.advanceTimersByTime(470));
    expect(result.current.displayPipette.volumeMl).toBe(0.15);
    expect(onAspirate).not.toHaveBeenCalled();
    act(() => fireEvent.pointerUp(window));
    expect(onAspirate).toHaveBeenCalledTimes(1);
    expect(onAspirate).toHaveBeenCalledWith({ tool_id: "centrifuge_tube_1", delta_volume_ml: 0.15 });
    expect(onDispense).not.toHaveBeenCalled();
  });

  it("holds on a vial to dispense while the pipette is loaded", () => {
    vi.useFakeTimers();
    const { result, onAspirate, onDispense } = setup({ capacityMl: 1, volumeMl: 0.4, sourceToolId: "tube_1" });
    act(() => result.current.handlePipetteToolPointerDown("station_2", tool("sample_vial"), pointer()));
    act(() => fireEvent.pointerUp(window));
    expect(onDispense).toHaveBeenCalledWith({ tool_id: "sample_vial_1", delta_volume_ml: 0.05 });
    expect(onAspirate).not.toHaveBeenCalled();
  });

  it("keeps the selected volume visible until the API command finishes", async () => {
    let finishCommand: (() => void) | undefined;
    const onAspirate = vi.fn(() => new Promise<void>((resolve) => {
      finishCommand = resolve;
    }));
    const onDispense = vi.fn();
    const { result } = renderHook(() => usePipetteInteraction({
      isPipetteMode: true,
      onAspirate,
      onDispense,
      pipette: { capacityMl: 1, volumeMl: 0, sourceToolId: null },
    }));

    act(() => result.current.handlePipetteToolPointerDown("station_1", tool("centrifuge_tube"), pointer()));
    act(() => fireEvent.pointerUp(window));
    expect(result.current.displayPipette.volumeMl).toBe(0.05);

    await act(async () => finishCommand?.());
    expect(result.current.displayPipette.volumeMl).toBe(0);
  });

  it("dispenses a loaded pipette into another centrifuge tube", () => {
    const { result, onDispense } = setup({ capacityMl: 1, volumeMl: 0.4, sourceToolId: "tube_1" });
    act(() => result.current.handlePipetteToolPointerDown("station_2", tool("centrifuge_tube"), pointer()));
    act(() => fireEvent.pointerUp(window));
    expect(onDispense).toHaveBeenCalledWith({ tool_id: "centrifuge_tube_1", delta_volume_ml: 0.05 });
  });

  it("refuses to dispense into a container that cannot receive liquids", () => {
    const { result, onDispense } = setup({ capacityMl: 1, volumeMl: 0.4, sourceToolId: "tube_1" });
    act(() => result.current.handlePipetteToolPointerDown("station_2", tool("sample_bag", { canReceiveLiquids: false }), pointer()));
    act(() => fireEvent.pointerUp(window));
    expect(onDispense).not.toHaveBeenCalled();
    expect(result.current.pipetteHintMessage).toContain("récipient ouvert");
  });

  it("refuses to dispense into a sealed container", () => {
    const { result, onDispense } = setup({ capacityMl: 1, volumeMl: 0.4, sourceToolId: "tube_1" });
    act(() => result.current.handlePipetteToolPointerDown("station_2", tool("centrifuge_tube", { isSealed: true }), pointer()));
    act(() => fireEvent.pointerUp(window));
    expect(onDispense).not.toHaveBeenCalled();
  });

  it("refuses to aspirate from a sealed container", () => {
    const { result, onAspirate } = setup({ capacityMl: 1, volumeMl: 0, sourceToolId: null });
    act(() => result.current.handlePipetteToolPointerDown("station_1", tool("centrifuge_tube", { isSealed: true }), pointer()));
    act(() => fireEvent.pointerUp(window));
    expect(onAspirate).not.toHaveBeenCalled();
  });

});
