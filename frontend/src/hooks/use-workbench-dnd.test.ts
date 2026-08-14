import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useWorkbenchDnd } from "@/hooks/use-workbench-dnd";
import type { ProduceDragPayload } from "@/types/workbench";

const payload: ProduceDragPayload = {
  allowedDropTargets: ["workbench_slot"],
  entityKind: "produce",
  produceLotId: "apples_1",
  produceType: "apple",
  sourceId: "bag_1",
  sourceKind: "workbench",
  sourceSlotId: "station_1",
};

describe("useWorkbenchDnd tutorial interception", () => {
  it("defers the backend command until a protected drop explicitly proceeds", () => {
    const moveObject = vi.fn();
    const onBeforeProduceDrop = vi.fn(() => false);
    const clearDropTargets = vi.fn();
    const { result } = renderHook(() =>
      useWorkbenchDnd({
        buildDebugProduceDraftFields: () => [],
        dndDisabledByAction: false,
        dragState: {
          clearDropTargets,
          setActiveDragItem: vi.fn(),
          showDropTargets: vi.fn(),
        },
        experimentApi: { cutWorkbenchProduceLot: vi.fn(), moveObject },
        isKnifeMode: false,
        onBeforeProduceDrop,
        setPendingDropDraft: vi.fn(),
      }),
    );

    result.current.handleProduceDrop("station_2", payload);

    expect(moveObject).not.toHaveBeenCalled();
    expect(clearDropTargets).toHaveBeenCalled();
    const attempt = onBeforeProduceDrop.mock.calls[0][0];
    attempt.proceed();
    attempt.proceed();
    expect(moveObject).toHaveBeenCalledTimes(1);
  });
});
