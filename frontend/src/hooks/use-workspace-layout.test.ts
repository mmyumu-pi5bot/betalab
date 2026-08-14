import { act, renderHook } from "@testing-library/react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  areWidgetLayoutsEqual,
  inferAnchoredLayout,
  resolveAnchoredPosition,
  useWorkspaceLayout,
  type WidgetLayout,
} from "@/hooks/use-workspace-layout";

describe("inferAnchoredLayout", () => {
  it("keeps widgets vertically anchored from the top near the bottom edge", () => {
    expect(
      inferAnchoredLayout(
        { x: 180, y: 920 },
        { width: 320, height: 220 },
        { width: 1600, height: 1200 },
      ),
    ).toEqual({
      anchor: "top-left",
      offsetX: 180,
      offsetY: 920,
    });
  });

  it("still chooses the right horizontal anchor when closer to the right edge", () => {
    expect(
      inferAnchoredLayout(
        { x: 1220, y: 920 },
        { width: 320, height: 220 },
        { width: 1600, height: 1200 },
      ),
    ).toEqual({
      anchor: "top-right",
      offsetX: 60,
      offsetY: 920,
    });
  });

  it("never infers a non-finite offset from a non-finite position", () => {
    const result = inferAnchoredLayout(
      { x: Number.NaN, y: 120 },
      { width: 320, height: 220 },
      { width: 1600, height: 1200 },
    );

    expect(Number.isFinite(result.offsetX)).toBe(true);
    expect(Number.isFinite(result.offsetY)).toBe(true);
  });
});

describe("areWidgetLayoutsEqual", () => {
  it("treats matching non-finite coordinates as equal so the layout guard converges", () => {
    const layout: WidgetLayout = {
      anchor: "top-right",
      fallbackHeight: 200,
      offsetX: 24,
      offsetY: 16,
      width: Number.NaN,
      x: Number.NaN,
      y: 40,
    };

    // NaN === NaN is false, which would make the anchoring effect re-run forever
    // ("Maximum update depth exceeded"). The guard must converge instead.
    expect(areWidgetLayoutsEqual(layout, { ...layout })).toBe(true);
  });
});

describe("resolveAnchoredPosition", () => {
  it("falls back to a finite coordinate when the widget width is not yet measured", () => {
    const result = resolveAnchoredPosition(
      { anchor: "top-right", offsetX: 24, offsetY: 16 },
      { width: Number.NaN, height: 200 },
      { width: 1600, height: 1200 },
      { x: 120, y: 48 },
    );

    // A non-finite x would surface as `NaN is an invalid value for the left css
    // style property` and feed the infinite render loop.
    expect(Number.isFinite(result.x)).toBe(true);
    expect(Number.isFinite(result.y)).toBe(true);
  });
});

describe("useWorkspaceLayout", () => {
  it("extends the canvas while a widget is dragged beyond its current bottom edge", () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const widgetNode = document.createElement("div");
    const workspaceRef = {
      current: {
        getBoundingClientRect: () => ({
          left: 0,
          top: 0,
          width: 1600,
          height: 1100,
        }),
      } as HTMLDivElement,
    };
    const initialLayout: Record<"lims", WidgetLayout> = {
      lims: {
        anchor: "top-left",
        fallbackHeight: 320,
        offsetX: 24,
        offsetY: 700,
        width: 500,
        x: 24,
        y: 700,
      },
    };

    const { result } = renderHook(() =>
      useWorkspaceLayout({
        fixedWidgetIds: [],
        getIsWidgetStorable: () => false,
        initialLayout,
        initialOrder: ["lims"],
        onMoveWidget: vi.fn(),
        onStoreWidget: vi.fn(),
        presentWidgetIds: ["lims"],
        syncKey: null,
        widgets: [],
        workspaceRef,
      }),
    );

    act(() => {
      result.current.registerWidgetNode("lims", widgetNode);
      result.current.handleWidgetDragStart("lims", {
        button: 0,
        clientX: 80,
        clientY: 740,
        preventDefault: vi.fn(),
      } as unknown as ReactMouseEvent<HTMLDivElement>);
    });

    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: 80, clientY: 1340 }));
    });

    expect(widgetNode.style.transform).toBe("translate3d(0px, 600px, 0)");
    expect(result.current.workspaceHeight).toBe(1920);

    act(() => {
      window.dispatchEvent(new MouseEvent("mouseup", { clientX: 80, clientY: 1340 }));
    });

    expect(result.current.widgetLayout.lims.y).toBe(1300);
    expect(result.current.workspaceHeight).toBe(1860);
    vi.unstubAllGlobals();
  });

  it("does not snap a dragged widget back to its anchor while the workspace grows", () => {
    let workspaceRect = {
      left: 0,
      top: 0,
      width: 1600,
      height: 1100,
    };

    class ResizeObserverMock {
      static callback: ResizeObserverCallback | null = null;

      constructor(callback: ResizeObserverCallback) {
        ResizeObserverMock.callback = callback;
      }

      disconnect() {}

      observe() {}
    }

    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const workspaceRef = {
      current: {
        getBoundingClientRect: () => workspaceRect,
      } as HTMLDivElement,
    };

    const initialLayout: Record<"rack" | "trash", WidgetLayout> = {
      rack: {
        anchor: "top-left",
        fallbackHeight: 392,
        offsetX: 234,
        offsetY: 886,
        width: 548,
        x: 234,
        y: 886,
      },
      trash: {
        anchor: "top-right",
        fallbackHeight: 214,
        offsetX: 0,
        offsetY: 126,
        width: 164,
        x: 1436,
        y: 126,
      },
    };

    const { result } = renderHook(() =>
      useWorkspaceLayout({
        fixedWidgetIds: [],
        getIsWidgetStorable: () => false,
        initialLayout,
        initialOrder: ["rack", "trash"],
        onStoreWidget: vi.fn(),
        onMoveWidget: vi.fn(),
        presentWidgetIds: ["rack", "trash"],
        syncKey: null,
        widgets: [],
        workspaceRef,
      }),
    );

    act(() => {
      result.current.handleWidgetDragStart("rack", {
        button: 0,
        clientX: 300,
        clientY: 930,
        preventDefault: vi.fn(),
      } as unknown as ReactMouseEvent<HTMLDivElement>);
    });

    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: 300, clientY: 980 }));
    });

    expect(result.current.widgetLayout.rack.y).toBe(936);

    workspaceRect = {
      ...workspaceRect,
      height: 1376,
    };

    act(() => {
      ResizeObserverMock.callback?.([], {} as ResizeObserver);
    });

    expect(result.current.widgetLayout.rack.y).toBe(936);

    act(() => {
      window.dispatchEvent(new MouseEvent("mouseup", { clientX: 300, clientY: 980 }));
    });

    vi.unstubAllGlobals();
  });

  it("ignores stale external widget sync after a local drop until the backend confirms the new anchor", () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const onMoveWidget = vi.fn();
    const workspaceRef = {
      current: {
        getBoundingClientRect: () => ({
          left: 0,
          top: 0,
          width: 1600,
          height: 1100,
        }),
      } as HTMLDivElement,
    };

    const initialLayout: Record<"rack" | "trash", WidgetLayout> = {
      rack: {
        anchor: "top-left",
        fallbackHeight: 392,
        offsetX: 234,
        offsetY: 886,
        width: 548,
        x: 234,
        y: 886,
      },
      trash: {
        anchor: "top-right",
        fallbackHeight: 214,
        offsetX: 0,
        offsetY: 126,
        width: 164,
        x: 1436,
        y: 126,
      },
    };

    const { result, rerender } = renderHook(
      ({
        syncKey,
        widgets,
      }: {
        syncKey: string | null;
        widgets: Array<{
          anchor?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
          id: "rack" | "trash";
          offsetX?: number;
          offsetY?: number;
          x?: number;
          y?: number;
        }>;
      }) =>
        useWorkspaceLayout({
          fixedWidgetIds: [],
          getIsWidgetStorable: () => false,
          initialLayout,
          initialOrder: ["rack", "trash"],
          onStoreWidget: vi.fn(),
          onMoveWidget,
          presentWidgetIds: ["rack", "trash"],
          syncKey,
          widgets,
          workspaceRef,
        }),
      {
        initialProps: {
          syncKey: "initial",
          widgets: [
            { id: "rack", anchor: "top-left", offsetX: 234, offsetY: 886 },
            { id: "trash", anchor: "top-right", offsetX: 0, offsetY: 126 },
          ],
        },
      },
    );

    act(() => {
      result.current.handleWidgetDragStart("rack", {
        button: 0,
        clientX: 300,
        clientY: 930,
        preventDefault: vi.fn(),
      } as unknown as ReactMouseEvent<HTMLDivElement>);
    });

    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: 300, clientY: 980 }));
    });

    expect(result.current.widgetLayout.rack.y).toBe(936);

    act(() => {
      window.dispatchEvent(new MouseEvent("mouseup", { clientX: 300, clientY: 980 }));
    });

    expect(onMoveWidget).toHaveBeenCalledWith("rack", {
      anchor: "top-left",
      offsetX: 234,
      offsetY: 936,
    });

    act(() => {
      rerender({
        syncKey: "stale-server-position",
        widgets: [
          { id: "rack", anchor: "top-left", offsetX: 234, offsetY: 886 },
          { id: "trash", anchor: "top-right", offsetX: 0, offsetY: 126 },
        ],
      });
    });

    expect(result.current.widgetLayout.rack.y).toBe(936);

    act(() => {
      rerender({
        syncKey: "confirmed-server-position",
        widgets: [
          { id: "rack", anchor: "top-left", offsetX: 234, offsetY: 936 },
          { id: "trash", anchor: "top-right", offsetX: 0, offsetY: 126 },
        ],
      });
    });

    expect(result.current.widgetLayout.rack.y).toBe(936);
    vi.unstubAllGlobals();
  });

  it("stores a storable widget when the drag ends over the inventory dropzone", () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const onMoveWidget = vi.fn();
    const onStoreWidget = vi.fn();
    const workspaceRef = {
      current: {
        getBoundingClientRect: () => ({
          left: 0,
          top: 0,
          width: 1600,
          height: 1100,
        }),
      } as HTMLDivElement,
    };
    const inventoryDropRef = {
      current: {
        getBoundingClientRect: () => ({
          left: 0,
          top: 100,
          right: 220,
          bottom: 460,
          width: 220,
          height: 360,
        }),
      } as HTMLElement,
    };

    const initialLayout: Record<"rack" | "trash", WidgetLayout> = {
      rack: {
        anchor: "top-left",
        fallbackHeight: 392,
        offsetX: 234,
        offsetY: 886,
        width: 548,
        x: 234,
        y: 886,
      },
      trash: {
        anchor: "top-right",
        fallbackHeight: 214,
        offsetX: 0,
        offsetY: 126,
        width: 164,
        x: 1436,
        y: 126,
      },
    };

    const { result } = renderHook(() =>
      useWorkspaceLayout({
        fixedWidgetIds: [],
        getIsWidgetStorable: (widgetId) => widgetId === "rack",
        inventoryDropRef,
        initialLayout,
        initialOrder: ["rack", "trash"],
        onMoveWidget,
        onStoreWidget,
        presentWidgetIds: ["rack", "trash"],
        syncKey: null,
        widgets: [],
        workspaceRef,
      }),
    );

    act(() => {
      result.current.handleWidgetDragStart("rack", {
        button: 0,
        clientX: 300,
        clientY: 930,
        preventDefault: vi.fn(),
      } as unknown as ReactMouseEvent<HTMLDivElement>);
    });

    act(() => {
      window.dispatchEvent(new MouseEvent("mouseup", { clientX: 100, clientY: 220 }));
    });

    expect(onStoreWidget).toHaveBeenCalledWith("rack");
    expect(onMoveWidget).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("moves a registered widget with an imperative transform until the drag is committed", () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const onMoveWidget = vi.fn();
    const widgetNode = document.createElement("div");
    const workspaceRef = {
      current: {
        getBoundingClientRect: () => ({
          left: 0,
          top: 0,
          width: 1600,
          height: 1100,
        }),
      } as HTMLDivElement,
    };

    const initialLayout: Record<"rack" | "trash", WidgetLayout> = {
      rack: {
        anchor: "top-left",
        fallbackHeight: 392,
        offsetX: 234,
        offsetY: 886,
        width: 548,
        x: 234,
        y: 886,
      },
      trash: {
        anchor: "top-right",
        fallbackHeight: 214,
        offsetX: 0,
        offsetY: 126,
        width: 164,
        x: 1436,
        y: 126,
      },
    };

    const { result } = renderHook(() =>
      useWorkspaceLayout({
        fixedWidgetIds: [],
        getIsWidgetStorable: () => false,
        initialLayout,
        initialOrder: ["rack", "trash"],
        onMoveWidget,
        onStoreWidget: vi.fn(),
        presentWidgetIds: ["rack", "trash"],
        syncKey: null,
        widgets: [],
        workspaceRef,
      }),
    );

    act(() => {
      result.current.registerWidgetNode("rack", widgetNode);
      result.current.handleWidgetDragStart("rack", {
        button: 0,
        clientX: 300,
        clientY: 930,
        preventDefault: vi.fn(),
      } as unknown as ReactMouseEvent<HTMLDivElement>);
    });

    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: 300, clientY: 980 }));
    });

    expect(widgetNode.style.transform).toBe("translate3d(0px, 50px, 0)");
    expect(result.current.widgetLayout.rack.y).toBe(886);

    act(() => {
      window.dispatchEvent(new MouseEvent("mouseup", { clientX: 300, clientY: 980 }));
    });

    expect(widgetNode.style.transform).toBe("");
    expect(widgetNode.style.willChange).toBe("");
    expect(result.current.widgetLayout.rack.y).toBe(936);
    expect(onMoveWidget).toHaveBeenCalledWith("rack", {
      anchor: "top-left",
      offsetX: 234,
      offsetY: 936,
    });
    vi.unstubAllGlobals();
  });
});
