"use client";

/**
 * Remember where the pointer was last seen, page-wide.
 *
 * Tool overlays follow the cursor by listening for `pointermove`, which works
 * when a tool is picked with the mouse — the next move places it. Picking one
 * with a keyboard shortcut sends no pointer event at all, so the overlay had
 * nothing to position itself with and stayed invisible until the mouse moved.
 *
 * Keeping the last position outside the overlays lets one start from where the
 * cursor already is, the moment it appears.
 */

let lastPointerPosition: { x: number; y: number } | null = null;
let isTracking = false;

function record(event: PointerEvent): void {
  lastPointerPosition = { x: event.clientX, y: event.clientY };
}

/** Begin tracking. Idempotent, so every consumer may call it on mount. */
export function trackPointerPosition(): void {
  if (isTracking || typeof window === "undefined") return;
  isTracking = true;
  window.addEventListener("pointermove", record, { passive: true });
}

/** Where the pointer was last seen, or null if it has not moved yet. */
export function getLastPointerPosition(): { x: number; y: number } | null {
  return lastPointerPosition;
}

/** Test seam: forget the position and the listener. */
export function resetPointerPositionTracking(): void {
  if (typeof window !== "undefined") {
    window.removeEventListener("pointermove", record);
  }
  lastPointerPosition = null;
  isTracking = false;
}
