"use client";

import Link from "next/link";
import { useState } from "react";

import type { JournalEntry } from "@/types/experiment";

type ExperimentAppHeaderProps = {
  experimentName: string;
  isSyncing: boolean;
  journalEntries: JournalEntry[];
  statusMessage: string;
};

function JournalIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path d="M6 4.5h12v15H6z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
      <path d="M9 8h6M9 12h6M9 16h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path d="m7 7 10 10M17 7 7 17" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function formatJournalDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(date);
}

function categoryLabel(category: JournalEntry["category"]) {
  if (category === "simulation") return "Simulation";
  if (category === "manipulation") return "Manipulation";
  return "System";
}

function ExperimentJournalDrawer({
  entries,
  onClose,
}: {
  entries: JournalEntry[];
  onClose: () => void;
}) {
  return (
    <aside
      aria-label="Experiment journal"
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-[-24px_0_60px_rgba(15,23,42,0.16)]"
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">History</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Experiment journal</h2>
          <p className="mt-1 text-sm text-slate-500">Business actions, simulation events and warnings.</p>
        </div>
        <button
          aria-label="Close journal"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
          onClick={onClose}
          type="button"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
            <p className="font-medium text-slate-800">No journal entries yet</p>
            <p className="mt-1 text-sm text-slate-500">Meaningful experiment actions will appear here.</p>
          </div>
        ) : (
          <ol className="space-y-3">
            {entries.map((entry) => (
              <li
                className={`rounded-2xl border px-4 py-3 ${
                  entry.severity === "error"
                    ? "border-rose-200 bg-rose-50/70"
                    : entry.severity === "warning"
                      ? "border-amber-200 bg-amber-50/70"
                      : "border-slate-200 bg-slate-50/70"
                }`}
                data-testid="journal-entry"
                key={entry.id}
              >
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold uppercase tracking-[0.14em] text-slate-600">
                    {categoryLabel(entry.category)}
                  </span>
                  <time className="text-slate-500" dateTime={entry.occurredAt}>
                    {formatJournalDate(entry.occurredAt)}
                  </time>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-800">{entry.message}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </aside>
  );
}

export function ExperimentAppHeader({
  experimentName,
  isSyncing,
  journalEntries,
  statusMessage,
}: ExperimentAppHeaderProps) {
  const [isJournalOpen, setIsJournalOpen] = useState(false);
  const visibleEntries = [...(journalEntries ?? [])]
    .filter((entry) => entry.category !== "layout")
    .reverse();
  const hasSyncError = !isSyncing && statusMessage !== "Saved";
  const latestEntry = visibleEntries[0] ?? null;

  return (
    <>
      <header className="sticky top-4 z-30 rounded-[1.5rem] border border-slate-200/90 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-xl sm:px-5">
        <span aria-live="polite" className="sr-only">
          {latestEntry?.message ?? ""}
        </span>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Link
              aria-label="Experiments"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-lg text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
              href="/"
              title="Back to experiments"
            >
              <span aria-hidden="true">←</span>
            </Link>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Laboratory workspace</p>
              <h1 className="truncate text-lg font-semibold tracking-tight text-slate-950 sm:text-xl">
                {experimentName}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              className={`hidden max-w-64 items-center gap-2 rounded-full px-3 py-2 text-xs font-medium sm:flex ${
                hasSyncError
                  ? "bg-rose-50 text-rose-700"
                  : isSyncing
                    ? "bg-sky-50 text-sky-700"
                    : "bg-emerald-50 text-emerald-700"
              }`}
              role="status"
            >
              <span
                aria-hidden="true"
                className={`h-2 w-2 shrink-0 rounded-full ${
                  hasSyncError ? "bg-rose-500" : isSyncing ? "animate-pulse bg-sky-500" : "bg-emerald-500"
                }`}
              />
              <span className="truncate">{isSyncing ? "Syncing..." : statusMessage}</span>
            </div>
            <button
              aria-expanded={isJournalOpen}
              aria-label="Open experiment journal"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-slate-950 px-3.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
              onClick={() => setIsJournalOpen(true)}
              type="button"
            >
              <JournalIcon />
              <span className="hidden sm:inline">Journal</span>
              {visibleEntries.length > 0 ? (
                <span className="min-w-5 rounded-full bg-white/15 px-1.5 py-0.5 text-center text-[11px]">
                  {visibleEntries.length}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </header>

      {isJournalOpen ? (
        <ExperimentJournalDrawer entries={visibleEntries} onClose={() => setIsJournalOpen(false)} />
      ) : null}
    </>
  );
}
