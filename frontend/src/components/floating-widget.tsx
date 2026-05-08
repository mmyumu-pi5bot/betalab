"use client";

import { useCallback, useEffect, useRef } from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";

type FloatingWidgetProps = {
  children: ReactNode;
  id: string;
  isActive?: boolean;
  label: string;
  onDragStart: (widgetId: string, event: ReactMouseEvent<HTMLDivElement>) => void;
  onHeightChange?: (widgetId: string, height: number) => void;
  onNodeChange?: (widgetId: string, node: HTMLDivElement | null) => void;
  position: {
    width: number;
    x: number;
    y: number;
  };
  zIndex: number;
};

export function FloatingWidget({
  children,
  id,
  isActive = false,
  onDragStart,
  onHeightChange,
  onNodeChange,
  position,
  zIndex,
}: FloatingWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const setContainerNode = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      onNodeChange?.(id, node);
    },
    [id, onNodeChange],
  );

  const handleMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('[data-widget-drag-handle="true"]')) {
      return;
    }
    if (
      target.closest(
        'button, input, textarea, select, option, a, label, [role="button"], [contenteditable="true"], [data-no-widget-drag="true"]',
      )
    ) {
      return;
    }

    onDragStart(id, event);
  };

  useEffect(() => {
    const node = containerRef.current;
    if (!node || !onHeightChange) {
      return;
    }

    const reportHeight = () => {
      onHeightChange(id, node.getBoundingClientRect().height);
    };

    reportHeight();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      reportHeight();
    });
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [id, onHeightChange]);

  return (
    <div
      className="absolute"
      data-workspace-drop-exclude="true"
      data-testid={`widget-${id}`}
      onMouseDown={handleMouseDown}
      ref={setContainerNode}
      style={{
        left: position.x,
        top: position.y,
        width: position.width,
        zIndex,
      }}
    >
      <div
        className={`relative select-none ${
          isActive ? "drop-shadow-[0_26px_44px_rgba(15,23,42,0.18)]" : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
}
