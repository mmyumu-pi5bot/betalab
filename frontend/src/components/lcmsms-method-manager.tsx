"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { LcMsMsMethodEditor } from "@/components/lcmsms-method-editor";
import { LcMsMsMethodViewer } from "@/components/lcmsms-method-viewer";
import { useAcquisitionMethodDetail } from "@/hooks/use-acquisition-method";
import {
  slugifyMethodName,
  uniqueMethodId,
} from "@/lib/acquisition-method-format";
import { deleteAcquisitionMethod, duplicateAcquisitionMethod } from "@/lib/api";
import type { AcquisitionMethod, AcquisitionMethodSummary } from "@/types/workbench";
import { LAYER } from "@/lib/layers";

type Props = {
  catalog: AcquisitionMethodSummary[];
  onClose: () => void;
  /** Bump the shared revision so the catalog and every detail view refetch. */
  onLibraryChanged: () => void;
  onMethodSelected: (methodId: string) => void;
  revision: number;
  selectedMethodId: string;
};

type ManagerTab = "details" | "edit";

const TABS: { id: ManagerTab; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "edit", label: "Edit" },
];

export function LcMsMsMethodManager({
  catalog,
  onClose,
  onLibraryChanged,
  onMethodSelected,
  revision,
  selectedMethodId,
}: Props) {
  const [previewMethodId, setPreviewMethodId] = useState(selectedMethodId);
  const [tab, setTab] = useState<ManagerTab>("details");
  const [copyName, setCopyName] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  // A method the manager itself just wrote. It is authoritative over the
  // fetched copy until the preview moves elsewhere, so an edit stays on screen
  // without waiting for a round trip.
  const [writtenMethod, setWrittenMethod] = useState<AcquisitionMethod | null>(null);
  // Identifiers this session already claimed, in case the catalog has not
  // caught up yet when the user duplicates twice in a row.
  const [claimedIds, setClaimedIds] = useState<string[]>([]);

  const detail = useAcquisitionMethodDetail(previewMethodId, revision);
  const method =
    writtenMethod !== null && writtenMethod.id === previewMethodId
      ? writtenMethod
      : detail.method;
  const isLoading = method === null && detail.isLoading;
  const error = method !== null ? null : detail.error;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function previewMethod(methodId: string) {
    setPreviewMethodId(methodId);
    setCopyName("");
    setFailure(null);
    setPendingDeleteId(null);
    setTab("details");
  }

  async function handleDuplicate() {
    if (method === null) return;
    const name = (copyName.trim() || `${method.name} (copy)`).trim();
    const newMethodId = uniqueMethodId(slugifyMethodName(name), [
      ...catalog.map((entry) => entry.id),
      ...claimedIds,
    ]);
    setIsBusy(true);
    setFailure(null);
    try {
      const saved = await duplicateAcquisitionMethod({
        sourceMethodId: method.id,
        newMethodId,
        name,
        version: "0.1.0",
      });
      setClaimedIds((ids) => [...ids, saved.method.id]);
      setWrittenMethod(saved.method);
      setPreviewMethodId(saved.method.id);
      setCopyName("");
      setTab("edit");
      // Duplicating is authoring, not browsing: the copy exists to be used, and
      // leaving the sequence on the source method means editing one method and
      // running another.
      onMethodSelected(saved.method.id);
      onLibraryChanged();
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "Failed to duplicate the method.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDelete(methodId: string) {
    setIsBusy(true);
    setFailure(null);
    try {
      await deleteAcquisitionMethod(methodId);
      setPendingDeleteId(null);
      setClaimedIds((ids) => ids.filter((id) => id !== methodId));
      const fallbackId =
        catalog.find((entry) => entry.isBuiltIn && entry.id !== methodId)?.id ??
        catalog.find((entry) => entry.id !== methodId)?.id ??
        null;
      if (fallbackId !== null) {
        if (previewMethodId === methodId) previewMethod(fallbackId);
        if (selectedMethodId === methodId) onMethodSelected(fallbackId);
      }
      onLibraryChanged();
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "Failed to delete the method.");
    } finally {
      setIsBusy(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: LAYER.dialogAbove }}
    >
      <div
        className="absolute inset-0 bg-slate-950/70"
        data-testid="method-manager-backdrop"
        onClick={onClose}
      />
      <div
        aria-label="Acquisition method manager"
        aria-modal="true"
        className="relative flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 text-slate-100 shadow-2xl"
        role="dialog"
      >
        <header className="flex items-center justify-between gap-4 border-b border-slate-800 px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
              LC-MS/MS
            </p>
            <h3 className="mt-0.5 text-sm font-semibold">Method manager</h3>
          </div>
          <button
            aria-label="Close method manager"
            data-tutorial-anchor="method-manager-close"
            className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </header>

        <div className="grid min-h-0 flex-1 gap-0 md:grid-cols-[15rem_1fr]">
          <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto border-b border-slate-800 p-3 md:border-b-0 md:border-r">
            <div>
              <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                Method library
              </p>
              <ul className="space-y-1">
                {catalog.map((entry) => (
                  <li
                    className="flex items-stretch gap-1"
                    data-testid="method-library-entry"
                    key={entry.id}
                  >
                    <button
                      aria-pressed={entry.id === previewMethodId}
                      className={`flex-1 rounded-lg border px-2 py-1.5 text-left ${
                        entry.id === previewMethodId
                          ? "border-cyan-600 bg-cyan-500/10"
                          : "border-slate-800 hover:bg-slate-900"
                      }`}
                      onClick={() => previewMethod(entry.id)}
                      type="button"
                    >
                      <span className="block text-[11px] font-semibold text-slate-100">
                        {entry.name}
                      </span>
                      <span className="mt-0.5 block font-mono text-[9px] text-cyan-300">
                        v{entry.version}
                      </span>
                      <span className="mt-0.5 block text-[9px] text-slate-500">
                        {entry.isBuiltIn ? "Built-in" : "User"} · {entry.transitionCount}{" "}
                        transitions
                      </span>
                      {entry.id === selectedMethodId ? (
                        <span className="mt-1 inline-block rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">
                          In use
                        </span>
                      ) : null}
                    </button>
                    {entry.isBuiltIn ? null : pendingDeleteId === entry.id ? (
                      <button
                        aria-label={`Confirm deleting ${entry.name}`}
                        className="shrink-0 rounded-lg border border-rose-700 bg-rose-950/60 px-2 text-[10px] font-semibold text-rose-200 hover:bg-rose-900/60 disabled:opacity-40"
                        disabled={isBusy}
                        onClick={() => handleDelete(entry.id)}
                        type="button"
                      >
                        ✓
                      </button>
                    ) : (
                      <button
                        aria-label={`Delete ${entry.name}`}
                        className="shrink-0 rounded-lg border border-slate-800 px-2 text-[10px] text-slate-400 hover:bg-slate-900 hover:text-rose-300"
                        onClick={() => setPendingDeleteId(entry.id)}
                        type="button"
                      >
                        🗑
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                New method
              </p>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
                Methods are created by duplicating an existing one, then editing the copy.
              </p>
              <label className="mt-2 block text-[9px] text-slate-400">
                Copy name
                <input
                  aria-label="Copy name"
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-white"
                  onChange={(event) => setCopyName(event.target.value)}
                  placeholder={method !== null ? `${method.name} (copy)` : "Method name"}
                  value={copyName}
                />
              </label>
              <button
                className="mt-2 w-full rounded-full bg-cyan-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
                data-tutorial-anchor="method-manager-duplicate"
                disabled={isBusy || method === null}
                onClick={handleDuplicate}
                type="button"
              >
                Duplicate method
              </button>
            </div>

            {failure !== null ? (
              <p className="text-[10px] text-rose-300">{failure}</p>
            ) : null}
          </aside>

          <section className="flex min-h-0 flex-col">
            <div
              aria-label="Method view"
              className="flex gap-1 border-b border-slate-800 px-3 py-2"
              role="tablist"
            >
              {TABS.map(({ id, label }) => (
                <button
                  aria-selected={tab === id}
                  className={`rounded-full px-3 py-1 text-[11px] font-medium ${
                    tab === id
                      ? "bg-cyan-600 text-white"
                      : "border border-slate-700 text-slate-300 hover:bg-slate-800"
                  }`}
                  data-tutorial-anchor={id === "edit" ? "method-manager-edit-tab" : undefined}
                  key={id}
                  onClick={() => setTab(id)}
                  role="tab"
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
              {tab === "details" ? (
                <LcMsMsMethodViewer error={error} isLoading={isLoading} method={method} />
              ) : method !== null ? (
                <LcMsMsMethodEditor
                  method={method}
                  onMethodSaved={(saved) => {
                    setWrittenMethod(saved);
                    onLibraryChanged();
                  }}
                />
              ) : (
                <p className="mt-3 text-xs text-slate-400">Loading the method…</p>
              )}
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-slate-800 px-3 py-2.5">
              <p className="text-[10px] text-slate-500">
                {previewMethodId === selectedMethodId
                  ? "This method is the one the sequence will run."
                  : "Previewing a method does not change the sequence."}
              </p>
              <button
                className="shrink-0 rounded-full bg-cyan-500 px-4 py-1.5 text-[11px] font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={previewMethodId === selectedMethodId || method === null}
                onClick={() => onMethodSelected(previewMethodId)}
                type="button"
              >
                Use for this sequence
              </button>
            </footer>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}
