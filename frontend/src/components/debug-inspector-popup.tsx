"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import type { DebugInspectorState } from "@/hooks/use-debug-inspector";
import { LAYER } from "@/lib/layers";

type Props = {
  inspection: NonNullable<DebugInspectorState>;
  onClose: () => void;
};

export function DebugInspectorPopup({ inspection, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(JSON.stringify(inspection.data, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const popupX = Math.min(inspection.x, window.innerWidth - 500);
  const popupY = Math.min(inspection.y + 12, window.innerHeight - 80);

  return createPortal(
    <div
      className="fixed inset-0"
      style={{ zIndex: LAYER.dialogTop }}
      onClick={onClose}
    >
      <div
        className="absolute max-h-[70vh] w-[480px] overflow-auto rounded-xl border border-slate-200 bg-white shadow-2xl"
        style={{ left: popupX, top: popupY }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
          <span className="font-mono text-xs font-semibold text-slate-500">
            🔬 {inspection.label}
          </span>
          <div className="flex items-center gap-1">
            <button
              className="rounded px-2 py-1 font-mono text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              onClick={handleCopy}
            >
              {copied ? "✓ copied" : "copy"}
            </button>
            <button
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>
        <pre className="overflow-x-auto p-4 font-mono text-xs text-slate-700">
          {JSON.stringify(inspection.data, null, 2)}
        </pre>
      </div>
    </div>,
    document.body,
  );
}
