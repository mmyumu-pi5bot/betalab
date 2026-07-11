import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePipetteInteraction } from "@/hooks/use-pipette-interaction";
import type { BenchToolInstance, PipetteState } from "@/types/workbench";

const tool = (toolType: BenchToolInstance["toolType"]): BenchToolInstance => ({
  id: `${toolType}_1`, toolId: toolType, label: toolType, subtitle: "", accent: "sky",
  toolType, capacity_ml: 10, sampleLabelText: null, produceLots: [], produceFractions: [], liquids: [],
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

  it("holds on a tube to aspirate while the pipette is empty", () => {
    vi.useFakeTimers();
    const { result, onAspirate, onDispense } = setup({ capacityMl: 1, volumeMl: 0, sourceToolId: null });
    act(() => result.current.handlePipetteToolPointerDown("station_1", tool("centrifuge_tube"), pointer()));
    act(() => vi.advanceTimersByTime(190));
    expect(onAspirate).toHaveBeenCalledWith({ tool_id: "centrifuge_tube_1", delta_volume_ml: 0.05 });
    expect(onDispense).not.toHaveBeenCalled();
  });

  it("holds on a vial to dispense while the pipette is loaded", () => {
    vi.useFakeTimers();
    const { result, onAspirate, onDispense } = setup({ capacityMl: 1, volumeMl: 0.4, sourceToolId: "tube_1" });
    act(() => result.current.handlePipetteToolPointerDown("station_2", tool("sample_vial"), pointer()));
    act(() => vi.advanceTimersByTime(190));
    expect(onDispense).toHaveBeenCalledWith({ tool_id: "sample_vial_1", delta_volume_ml: 0.05 });
    expect(onAspirate).not.toHaveBeenCalled();
  });
});
