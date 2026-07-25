import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDebugInspector } from "@/hooks/use-debug-inspector";

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useDebugInspector", () => {
  it("fetches private state only when Ctrl+Alt+click targets a remote debug entity", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        volume_ml: 0.5,
        true_volume_ml: 0.49,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useDebugInspector("experiment_1"));
    const button = document.createElement("button");
    button.dataset.debugKind = "pipette";
    button.dataset.debugId = "pipette";
    button.dataset.debugLabel = "Micropipette";
    document.body.appendChild(button);

    act(() => {
      button.dispatchEvent(new MouseEvent("click", {
        altKey: true,
        bubbles: true,
        ctrlKey: true,
      }));
    });

    await waitFor(() => expect(result.current.inspection).not.toBeNull());
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/experiments/experiment_1/debug/inspect/pipette/pipette",
    );
    expect(result.current.inspection?.data).toEqual({
      volume_ml: 0.5,
      true_volume_ml: 0.49,
    });
  });
});
