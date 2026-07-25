"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, RefObject } from "react";

import type { WidgetAnchor } from "@/types/workbench";

type WidgetLayout = {
  anchor?: WidgetAnchor;
  fallbackHeight: number;
  offsetX?: number;
  offsetY?: number;
  width: number;
  x: number;
  y: number;
};

type AnchoredWidgetLayout = {
  anchor: WidgetAnchor;
  offsetX: number;
  offsetY: number;
};

type WorkspaceWidgetSync<WidgetId extends string> = {
  anchor?: WidgetAnchor;
  id: WidgetId;
  offsetX?: number;
  offsetY?: number;
  x?: number;
  y?: number;
};

type UseWorkspaceLayoutOptions<WidgetId extends string> = {
  fixedWidgetIds: WidgetId[];
  getIsWidgetStorable: (widgetId: WidgetId) => boolean;
  inventoryDropRef?: RefObject<HTMLElement | null>;
  initialLayout: Record<WidgetId, WidgetLayout>;
  initialOrder: WidgetId[];
  onStoreWidget: (widgetId: WidgetId) => void;
  onMoveWidget: (widgetId: WidgetId, nextLayout: AnchoredWidgetLayout) => void;
  onWidgetDragStateChange?: (widgetId: WidgetId | null, activeDropTarget: "inventory_panel" | null) => void;
  presentWidgetIds: WidgetId[];
  syncKey: string | null;
  widgets: Array<WorkspaceWidgetSync<WidgetId>>;
  workspaceRef: RefObject<HTMLDivElement | null>;
};

type WorkspaceSize = {
  height: number;
  width: number;
};

// A widget whose width has not been measured yet resolves to a NaN coordinate.
// Falling back to the first finite candidate keeps positions out of the DOM as
// `left: NaN` and, combined with the Object.is guard below, lets the anchoring
// effect converge instead of re-rendering forever.
function firstFinite(...values: Array<number | undefined>) {
  for (const value of values) {
    if (value !== undefined && Number.isFinite(value)) {
      return value;
    }
  }
  return 0;
}

function areWidgetLayoutsEqual(left: WidgetLayout, right: WidgetLayout) {
  // Object.is (not ===) so two matching NaN coordinates compare equal; with ===
  // the guard would never converge and the effect would loop indefinitely.
  return (
    left.anchor === right.anchor &&
    Object.is(left.fallbackHeight, right.fallbackHeight) &&
    Object.is(left.offsetX, right.offsetX) &&
    Object.is(left.offsetY, right.offsetY) &&
    Object.is(left.width, right.width) &&
    Object.is(left.x, right.x) &&
    Object.is(left.y, right.y)
  );
}

function resolveAnchoredPosition(
  layout: AnchoredWidgetLayout,
  widgetSize: { height: number; width: number },
  workspaceSize: WorkspaceSize | null,
  fallbackPosition: { x: number; y: number },
) {
  if (!workspaceSize || workspaceSize.width <= 0 || workspaceSize.height <= 0) {
    return fallbackPosition;
  }

  if (layout.anchor === "top-left") {
    return {
      x: firstFinite(layout.offsetX, fallbackPosition.x),
      y: firstFinite(layout.offsetY, fallbackPosition.y),
    };
  }

  if (layout.anchor === "top-right") {
    return {
      x: firstFinite(Math.max(workspaceSize.width - widgetSize.width - layout.offsetX, 0), fallbackPosition.x),
      y: firstFinite(layout.offsetY, fallbackPosition.y),
    };
  }

  if (layout.anchor === "bottom-left") {
    return {
      x: firstFinite(layout.offsetX, fallbackPosition.x),
      y: firstFinite(Math.max(workspaceSize.height - widgetSize.height - layout.offsetY, 0), fallbackPosition.y),
    };
  }

  return {
    x: firstFinite(Math.max(workspaceSize.width - widgetSize.width - layout.offsetX, 0), fallbackPosition.x),
    y: firstFinite(Math.max(workspaceSize.height - widgetSize.height - layout.offsetY, 0), fallbackPosition.y),
  };
}

function inferAnchoredLayout(
  position: { x: number; y: number },
  widgetSize: { height: number; width: number },
  workspaceSize: WorkspaceSize | null,
): AnchoredWidgetLayout {
  // Guard every offset: a non-finite position (e.g. a widget dropped before its
  // width was measured) must never be persisted as `offset_x: NaN`, which would
  // round-trip through the backend and re-trigger the render loop on reload.
  if (!workspaceSize || workspaceSize.width <= 0 || workspaceSize.height <= 0) {
    return {
      anchor: "top-left",
      offsetX: Math.round(firstFinite(position.x)),
      offsetY: Math.round(firstFinite(position.y)),
    };
  }

  const leftDistance = position.x;
  const rightDistance = workspaceSize.width - (position.x + widgetSize.width);
  const topDistance = position.y;
  const horizontalAnchor: "left" | "right" = leftDistance <= rightDistance ? "left" : "right";
  // The workspace height grows with the lowest widget, so anchoring moved widgets
  // to the bottom makes them drift as the canvas expands.
  const anchor = `top-${horizontalAnchor}` as WidgetAnchor;

  if (anchor === "top-left") {
    return {
      anchor,
      offsetX: Math.round(firstFinite(leftDistance)),
      offsetY: Math.round(firstFinite(topDistance)),
    };
  }

  if (anchor === "top-right") {
    return {
      anchor,
      offsetX: Math.round(firstFinite(Math.max(rightDistance, 0))),
      offsetY: Math.round(firstFinite(topDistance)),
    };
  }

  return {
    anchor,
    offsetX: Math.round(firstFinite(Math.max(rightDistance, 0))),
    offsetY: Math.round(firstFinite(topDistance)),
  };
}

function isPointInsideElement(
  element: HTMLElement | null,
  clientX: number,
  clientY: number,
) {
  if (!element) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}

export function useWorkspaceLayout<WidgetId extends string>({
  fixedWidgetIds,
  getIsWidgetStorable,
  inventoryDropRef,
  initialLayout,
  initialOrder,
  onStoreWidget,
  onMoveWidget,
  onWidgetDragStateChange,
  presentWidgetIds,
  syncKey,
  widgets,
  workspaceRef,
}: UseWorkspaceLayoutOptions<WidgetId>) {
  const [activeWidgetId, setActiveWidgetId] = useState<WidgetId | null>(null);
  const [widgetLayout, setWidgetLayout] =
    useState<Record<WidgetId, WidgetLayout>>(initialLayout);
  const [widgetOrder, setWidgetOrder] = useState<WidgetId[]>([...initialOrder]);
  const [widgetHeights, setWidgetHeights] = useState<Record<WidgetId, number>>(
    Object.fromEntries(
      (Object.entries(initialLayout) as Array<[WidgetId, WidgetLayout]>).map(([widgetId, layout]) => [
        widgetId,
        layout.fallbackHeight,
      ]),
    ) as Record<WidgetId, number>,
  );
  const widgetLayoutRef = useRef(widgetLayout);
  const widgetHeightsRef = useRef(widgetHeights);
  const widgetNodesRef = useRef<Partial<Record<WidgetId, HTMLDivElement>>>({});
  const widgetsRef = useRef(widgets);
  const [workspaceSize, setWorkspaceSize] = useState<WorkspaceSize | null>(null);
  const dragStateRef = useRef<{
    pointerOffsetX: number;
    pointerOffsetY: number;
    widgetId: WidgetId;
  } | null>(null);
  const dragAnimationFrameRef = useRef<number | null>(null);
  const pendingDragPositionRef = useRef<{
    widgetId: WidgetId;
    x: number;
    y: number;
  } | null>(null);
  const latestDragPositionRef = useRef<{
    widgetId: WidgetId;
    x: number;
    y: number;
  } | null>(null);
  const pendingAnchorSyncRef = useRef<
    Partial<Record<WidgetId, AnchoredWidgetLayout>>
  >({});
  const dragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    widgetLayoutRef.current = widgetLayout;
  }, [widgetLayout]);

  useEffect(() => {
    widgetHeightsRef.current = widgetHeights;
  }, [widgetHeights]);

  useEffect(() => {
    widgetsRef.current = widgets;
  }, [widgets]);

  const registerWidgetNode = useCallback((widgetId: string, node: HTMLDivElement | null) => {
    if (!(widgetId in initialLayout)) {
      return;
    }

    const typedWidgetId = widgetId as WidgetId;
    if (node) {
      widgetNodesRef.current[typedWidgetId] = node;
      return;
    }

    delete widgetNodesRef.current[typedWidgetId];
  }, [initialLayout]);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
      if (dragAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(dragAnimationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const workspaceNode = workspaceRef.current;
    if (!workspaceNode) {
      return;
    }

    const updateWorkspaceSize = () => {
      const rect = workspaceNode.getBoundingClientRect();
      setWorkspaceSize((current) => {
        if (current?.height === rect.height && current.width === rect.width) {
          return current;
        }

        return { height: rect.height, width: rect.width };
      });
    };

    updateWorkspaceSize();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateWorkspaceSize();
    });
    observer.observe(workspaceNode);

    return () => {
      observer.disconnect();
    };
  }, [workspaceRef, syncKey]);

  useEffect(() => {
    if (!workspaceSize) {
      return;
    }

    setWidgetLayout((current) => {
      const nextLayout = { ...current };
      const draggedWidgetId = dragStateRef.current?.widgetId ?? null;
      let hasChanged = false;

      (Object.keys(nextLayout) as WidgetId[]).forEach((widgetId) => {
        if (widgetId === draggedWidgetId) {
          return;
        }

        const currentLayout = nextLayout[widgetId];
        if (
          !currentLayout.anchor ||
          currentLayout.offsetX === undefined ||
          currentLayout.offsetY === undefined
        ) {
          return;
        }

        const widgetHeight =
          widgetHeightsRef.current[widgetId] ?? currentLayout.fallbackHeight;
        const resolvedPosition = resolveAnchoredPosition(
          {
            anchor: currentLayout.anchor,
            offsetX: currentLayout.offsetX,
            offsetY: currentLayout.offsetY,
          },
          { height: widgetHeight, width: currentLayout.width },
          workspaceSize,
          { x: currentLayout.x, y: currentLayout.y },
        );

        const resolvedLayout = {
          ...currentLayout,
          x: resolvedPosition.x,
          y: resolvedPosition.y,
        };

        if (!areWidgetLayoutsEqual(currentLayout, resolvedLayout)) {
          nextLayout[widgetId] = resolvedLayout;
          hasChanged = true;
        }
      });

      return hasChanged ? nextLayout : current;
    });
  }, [workspaceSize]);

  useEffect(() => {
    if (!syncKey) {
      return;
    }

    setWidgetLayout((current) => {
      const nextLayout = { ...current };
      let hasChanged = false;
      const draggedWidgetId = dragStateRef.current?.widgetId ?? null;

      (Object.keys(initialLayout) as WidgetId[]).forEach((widgetId) => {
        if (!(widgetId in nextLayout)) {
          nextLayout[widgetId] = initialLayout[widgetId];
          hasChanged = true;
        }
      });

      widgetsRef.current.forEach((widget) => {
        const currentLayout = nextLayout[widget.id];
        const pendingAnchorSync = pendingAnchorSyncRef.current[widget.id];
        const widgetMatchesPendingAnchor =
          pendingAnchorSync &&
          widget.anchor === pendingAnchorSync.anchor &&
          widget.offsetX === pendingAnchorSync.offsetX &&
          widget.offsetY === pendingAnchorSync.offsetY;

        if (widget.id === draggedWidgetId) {
          return;
        }

        if (pendingAnchorSync && !widgetMatchesPendingAnchor) {
          return;
        }

        if (widgetMatchesPendingAnchor) {
          delete pendingAnchorSyncRef.current[widget.id];
        }

        const widgetHeight = widgetHeightsRef.current[widget.id] ?? currentLayout.fallbackHeight;
        const resolvedPosition =
          widget.anchor && widget.offsetX !== undefined && widget.offsetY !== undefined
            ? resolveAnchoredPosition(
                {
                  anchor: widget.anchor,
                  offsetX: widget.offsetX,
                  offsetY: widget.offsetY,
                },
                { height: widgetHeight, width: currentLayout.width },
                workspaceSize,
                { x: currentLayout.x, y: currentLayout.y },
              )
            : { x: currentLayout.x, y: currentLayout.y };

        const resolvedLayout = {
          ...currentLayout,
          anchor: widget.anchor ?? currentLayout.anchor,
          offsetX: widget.offsetX ?? currentLayout.offsetX,
          offsetY: widget.offsetY ?? currentLayout.offsetY,
          x: resolvedPosition.x,
          y: resolvedPosition.y,
        };

        if (!areWidgetLayoutsEqual(currentLayout, resolvedLayout)) {
          nextLayout[widget.id] = resolvedLayout;
          hasChanged = true;
        }
      });

      return hasChanged ? nextLayout : current;
    });
    setWidgetOrder((current) =>
      current.length === initialOrder.length ? current : [...initialOrder],
    );
  }, [initialLayout, initialOrder, syncKey, workspaceSize]);

  const handleWidgetHeightChange = useCallback((widgetId: string, height: number) => {
    if (!(widgetId in initialLayout) || height <= 0) {
      return;
    }

    const typedWidgetId = widgetId as WidgetId;
    setWidgetHeights((current) => {
      if (current[typedWidgetId] === height) {
        return current;
      }

      return {
        ...current,
        [typedWidgetId]: height,
      };
    });
  }, [initialLayout]);

  const handleWidgetDragStart = (
    widgetId: string,
    event: ReactMouseEvent<HTMLDivElement>,
  ) => {
    if (!(widgetId in initialLayout)) {
      return;
    }
    if (typeof event.button === "number" && event.button > 0) {
      return;
    }

    const typedWidgetId = widgetId as WidgetId;
    event.preventDefault();

    dragCleanupRef.current?.();
    if (dragAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(dragAnimationFrameRef.current);
      dragAnimationFrameRef.current = null;
    }
    pendingDragPositionRef.current = null;
    latestDragPositionRef.current = null;

    const workspaceRect = workspaceRef.current?.getBoundingClientRect();
    const workspaceLeft = workspaceRect?.left ?? 0;
    const workspaceTop = workspaceRect?.top ?? 0;
    const currentPosition = widgetLayoutRef.current[typedWidgetId];
    const draggedWidgetNode = widgetNodesRef.current[typedWidgetId];

    if (draggedWidgetNode) {
      draggedWidgetNode.style.willChange = "transform";
    }

    dragStateRef.current = {
      widgetId: typedWidgetId,
      pointerOffsetX: event.clientX - workspaceLeft - currentPosition.x,
      pointerOffsetY: event.clientY - workspaceTop - currentPosition.y,
    };
    latestDragPositionRef.current = {
      widgetId: typedWidgetId,
      x: currentPosition.x,
      y: currentPosition.y,
    };
    setActiveWidgetId(typedWidgetId);
    setWidgetOrder((current) => [
      ...current.filter((id) => id !== typedWidgetId),
      typedWidgetId,
    ]);
    onWidgetDragStateChange?.(typedWidgetId, null);

    const flushPendingDragPosition = () => {
      const pendingPosition = pendingDragPositionRef.current;
      if (!pendingPosition) {
        return;
      }

      pendingDragPositionRef.current = null;
      dragAnimationFrameRef.current = null;

      latestDragPositionRef.current = pendingPosition;

      const currentDraggedLayout = widgetLayoutRef.current[pendingPosition.widgetId];
      const draggedNode = widgetNodesRef.current[pendingPosition.widgetId];
      if (draggedNode) {
        const offsetX = pendingPosition.x - currentDraggedLayout.x;
        const offsetY = pendingPosition.y - currentDraggedLayout.y;
        draggedNode.style.transform =
          offsetX === 0 && offsetY === 0 ? "" : `translate3d(${offsetX}px, ${offsetY}px, 0)`;
        return;
      }

      setWidgetLayout((current) => {
        const currentDraggedLayout = current[pendingPosition.widgetId];
        if (
          currentDraggedLayout.x === pendingPosition.x &&
          currentDraggedLayout.y === pendingPosition.y
        ) {
          return current;
        }

        return {
          ...current,
          [pendingPosition.widgetId]: {
            ...currentDraggedLayout,
            x: pendingPosition.x,
            y: pendingPosition.y,
          },
        };
      });
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dragState = dragStateRef.current;
      const workspaceNode = workspaceRef.current;
      if (!dragState || !workspaceNode) {
        return;
      }
      if (!Number.isFinite(moveEvent.clientX) || !Number.isFinite(moveEvent.clientY)) {
        return;
      }

      const nextWorkspaceRect = workspaceNode.getBoundingClientRect();
      const nextLayout = widgetLayoutRef.current[dragState.widgetId];
      const widgetHeight =
        widgetHeightsRef.current[dragState.widgetId] ?? nextLayout.fallbackHeight;

      const unclampedX = moveEvent.clientX - nextWorkspaceRect.left - dragState.pointerOffsetX;
      const unclampedY = moveEvent.clientY - nextWorkspaceRect.top - dragState.pointerOffsetY;

      const maxX =
        nextWorkspaceRect.width > 0
          ? Math.max(nextWorkspaceRect.width - nextLayout.width, 0)
          : Number.POSITIVE_INFINITY;
      const maxY =
        nextWorkspaceRect.height > 0
          ? Math.max(nextWorkspaceRect.height - widgetHeight, 0)
          : Number.POSITIVE_INFINITY;
      const nextX = Math.min(Math.max(unclampedX, 0), maxX);
      const nextY = Math.min(Math.max(unclampedY, 0), maxY);
      const currentPendingPosition = pendingDragPositionRef.current;
      const isOverInventoryDropZone =
        getIsWidgetStorable(dragState.widgetId) &&
        isPointInsideElement(
          inventoryDropRef?.current ?? null,
          moveEvent.clientX,
          moveEvent.clientY,
        );

      onWidgetDragStateChange?.(
        dragState.widgetId,
        isOverInventoryDropZone ? "inventory_panel" : null,
      );

      if (
        latestDragPositionRef.current?.widgetId === dragState.widgetId &&
        latestDragPositionRef.current.x === nextX &&
        latestDragPositionRef.current.y === nextY &&
        currentPendingPosition === null
      ) {
        return;
      }

      pendingDragPositionRef.current = {
        widgetId: dragState.widgetId,
        x: nextX,
        y: nextY,
      };

      if (dragAnimationFrameRef.current === null) {
        dragAnimationFrameRef.current = window.requestAnimationFrame(flushPendingDragPosition);
      }
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      const finalPendingDragPosition = pendingDragPositionRef.current;
      const finalLatestDragPosition = latestDragPositionRef.current;

      if (dragAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(dragAnimationFrameRef.current);
        dragAnimationFrameRef.current = null;
      }
      flushPendingDragPosition();

      const dragState = dragStateRef.current;
      const draggedWidgetId = dragState?.widgetId;
      const shouldStoreWidget =
        draggedWidgetId &&
        getIsWidgetStorable(draggedWidgetId) &&
        isPointInsideElement(
          inventoryDropRef?.current ?? null,
          upEvent.clientX,
          upEvent.clientY,
        );

      dragStateRef.current = null;
      pendingDragPositionRef.current = null;
      latestDragPositionRef.current = null;
      setActiveWidgetId(null);
      onWidgetDragStateChange?.(null, null);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      dragCleanupRef.current = null;

      if (draggedWidgetId) {
        const currentDraggedLayout = widgetLayoutRef.current[draggedWidgetId];
        const draggedNode = widgetNodesRef.current[draggedWidgetId];
        const finalPosition =
          finalPendingDragPosition?.widgetId === draggedWidgetId
            ? {
                x: finalPendingDragPosition.x,
                y: finalPendingDragPosition.y,
              }
            : finalLatestDragPosition?.widgetId === draggedWidgetId
              ? {
                  x: finalLatestDragPosition.x,
                  y: finalLatestDragPosition.y,
                }
              : {
                  x: currentDraggedLayout.x,
                  y: currentDraggedLayout.y,
                };
        const nextLayout =
          finalPosition.x === currentDraggedLayout.x && finalPosition.y === currentDraggedLayout.y
            ? currentDraggedLayout
            : {
                ...currentDraggedLayout,
                x: finalPosition.x,
                y: finalPosition.y,
              };

        if (shouldStoreWidget) {
          if (draggedNode) {
            draggedNode.style.transform = "";
            draggedNode.style.willChange = "";
          }
          onStoreWidget(draggedWidgetId);
          return;
        }

        const widgetHeight =
          widgetHeightsRef.current[draggedWidgetId] ?? nextLayout.fallbackHeight;

        const anchoredLayout = inferAnchoredLayout(
          {
            x: finalPosition.x,
            y: finalPosition.y,
          },
          { height: widgetHeight, width: nextLayout.width },
          workspaceSize,
        );

        setWidgetLayout((current) => {
          const currentDraggedLayout = current[draggedWidgetId];
          if (
            currentDraggedLayout.x === finalPosition.x &&
            currentDraggedLayout.y === finalPosition.y &&
            currentDraggedLayout.anchor === anchoredLayout.anchor &&
            currentDraggedLayout.offsetX === anchoredLayout.offsetX &&
            currentDraggedLayout.offsetY === anchoredLayout.offsetY
          ) {
            return current;
          }

          return {
            ...current,
            [draggedWidgetId]: {
              ...currentDraggedLayout,
              x: finalPosition.x,
              y: finalPosition.y,
              anchor: anchoredLayout.anchor,
              offsetX: anchoredLayout.offsetX,
              offsetY: anchoredLayout.offsetY,
            },
          };
        });

        if (draggedNode) {
          draggedNode.style.transform = "";
          draggedNode.style.willChange = "";
        }

        if (fixedWidgetIds.includes(draggedWidgetId)) {
          return;
        }

        pendingAnchorSyncRef.current[draggedWidgetId] = anchoredLayout;
        onMoveWidget(draggedWidgetId, anchoredLayout);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    dragCleanupRef.current = () => {
      const draggedWidgetId = dragStateRef.current?.widgetId;
      if (draggedWidgetId) {
        const draggedNode = widgetNodesRef.current[draggedWidgetId];
        if (draggedNode) {
          draggedNode.style.transform = "";
          draggedNode.style.willChange = "";
        }
      }
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  };

  const workspaceHeight = Math.max(
    ...presentWidgetIds.map((widgetId) => {
      const layout = widgetLayout[widgetId];
      const measuredHeight = widgetHeights[widgetId] ?? layout.fallbackHeight;
      return layout.y + measuredHeight + 48;
    }),
    1100,
  );

  return {
    activeWidgetId,
    handleWidgetDragStart,
    handleWidgetHeightChange,
    registerWidgetNode,
    widgetHeights,
    widgetLayout,
    widgetOrder,
    workspaceHeight,
  };
}

export type { WidgetLayout };
export { areWidgetLayoutsEqual, inferAnchoredLayout, resolveAnchoredPosition };
