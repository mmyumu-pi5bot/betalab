"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  createExperiment,
  deleteExperiment,
  duplicateExperiment,
  listExperiments,
  renameExperiment,
} from "@/lib/api";
import { CALIBRATION_SAMPLE_TUTORIAL_ID } from "@/lib/tutorial-engine";
import {
  clearTutorialSession,
  getTutorialSessions,
  saveTutorialSession,
  type TutorialSession,
} from "@/lib/tutorial-session-store";
import type { ExperimentListEntry } from "@/types/experiment";

type IconProps = { className?: string };

function PencilIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="m4 20 4.2-1 10.6-10.6a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="m14.5 6.5 3 3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CopyIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <rect height="12" rx="2" stroke="currentColor" strokeWidth="1.8" width="12" x="8" y="8" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function TrashIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M5 7h14M9 7V5h6v2m2 0-.7 12H7.7L7 7m3.5 3v6m3-6v6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function MoreIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 24 24">
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="19" cy="12" r="1.7" />
    </svg>
  );
}

function ArrowIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M5 12h14m-5-5 5 5-5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function formatSessionDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function ExperimentsHome() {
  const router = useRouter();
  const [experiments, setExperiments] = useState<ExperimentListEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, startCreateTransition] = useTransition();
  const [deletingExperimentId, setDeletingExperimentId] = useState<string | null>(null);
  const [duplicatingExperimentId, setDuplicatingExperimentId] = useState<string | null>(null);
  const [editingExperimentId, setEditingExperimentId] = useState<string | null>(null);
  const [managingExperimentId, setManagingExperimentId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [renamingExperimentId, setRenamingExperimentId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tutorialSessionsByExperiment, setTutorialSessionsByExperiment] = useState<
    Record<string, TutorialSession>
  >({});
  const managementMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (managingExperimentId === null) {
      return;
    }

    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        managementMenuRef.current?.contains(event.target)
      ) {
        return;
      }
      setManagingExperimentId(null);
    };

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", handleOutsidePointerDown);
  }, [managingExperimentId]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const savedExperiments = await listExperiments();
        if (!isMounted) {
          return;
        }
        setExperiments(savedExperiments);
        const savedExperimentIds = new Set(savedExperiments.map((experiment) => experiment.id));
        const savedTutorials = getTutorialSessions(CALIBRATION_SAMPLE_TUTORIAL_ID);
        const validTutorials = savedTutorials.filter(
          (session) =>
            session.status !== "abandoned" && savedExperimentIds.has(session.experimentId),
        );
        for (const session of savedTutorials) {
          if (!savedExperimentIds.has(session.experimentId)) {
            clearTutorialSession(session.tutorialId, session.experimentId);
          }
        }
        setTutorialSessionsByExperiment(
          Object.fromEntries(validTutorials.map((session) => [session.experimentId, session])),
        );
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to load saved experiments",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCreateExperiment = () => {
    startCreateTransition(async () => {
      setErrorMessage(null);
      try {
        const experiment = await createExperiment();
        router.push(`/experiments/${experiment.id}`);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to create experiment",
        );
      }
    });
  };

  const handleOpenTutorial = () => {
    startCreateTransition(async () => {
      setErrorMessage(null);
      try {
        const experiment = await createExperiment();
        const session = saveTutorialSession({
          tutorialId: CALIBRATION_SAMPLE_TUTORIAL_ID,
          experimentId: experiment.id,
          status: "active",
        });
        setTutorialSessionsByExperiment((current) => ({
          ...current,
          [session.experimentId]: session,
        }));
        router.push(
          `/experiments/${experiment.id}?tutorial=${CALIBRATION_SAMPLE_TUTORIAL_ID}`,
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to create tutorial experiment",
        );
      }
    });
  };

  const handleDeleteExperiment = async (experimentId: string) => {
    setDeletingExperimentId(experimentId);
    setErrorMessage(null);

    try {
      await deleteExperiment(experimentId);
      setManagingExperimentId(null);
      setExperiments((current) => current.filter((entry) => entry.id !== experimentId));
      clearTutorialSession(CALIBRATION_SAMPLE_TUTORIAL_ID, experimentId);
      if (tutorialSessionsByExperiment[experimentId]) {
        setTutorialSessionsByExperiment((current) => {
          const next = { ...current };
          delete next[experimentId];
          return next;
        });
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to delete experiment",
      );
    } finally {
      setDeletingExperimentId(null);
    }
  };

  const handleRenameExperiment = async (experimentId: string) => {
    setRenamingExperimentId(experimentId);
    setErrorMessage(null);
    try {
      const renamed = await renameExperiment(experimentId, nameDraft);
      setExperiments((current) =>
        current.map((entry) =>
          entry.id === experimentId ? { ...entry, name: renamed.name } : entry,
        ),
      );
      setEditingExperimentId(null);
      setNameDraft("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to rename experiment");
    } finally {
      setRenamingExperimentId(null);
    }
  };

  const handleDuplicateExperiment = async (experimentId: string) => {
    setDuplicatingExperimentId(experimentId);
    setErrorMessage(null);
    try {
      await duplicateExperiment(experimentId);
      setExperiments(await listExperiments());
      setManagingExperimentId(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to duplicate experiment");
    } finally {
      setDuplicatingExperimentId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#f7efe1,_#efe4cd_48%,_#e5d7bb)] px-6 py-10 text-stone-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <section className="rounded-[32px] border border-stone-900/10 bg-[#fff8ea]/85 p-8 shadow-[0_30px_80px_rgba(84,53,20,0.12)] backdrop-blur">
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-stone-500">
            Betalab
          </p>
          <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <h1 className="font-serif text-4xl leading-tight text-stone-950 md:text-5xl">
                Experiment sessions
              </h1>
              <p className="mt-3 text-sm leading-6 text-stone-600 md:text-base">
                Resume a saved lab run or open a fresh experiment without rebuilding the
                whole setup by hand.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleCreateExperiment}
                disabled={isCreating}
                className="rounded-full bg-stone-950 px-5 py-3 text-sm font-medium text-stone-50 transition hover:bg-stone-800 disabled:cursor-wait disabled:opacity-70"
              >
                {isCreating ? "Creating..." : "New experiment"}
              </button>
              <button
                aria-label="New tutorial"
                className="rounded-full border border-sky-300 bg-sky-50 px-5 py-3 text-sm font-semibold text-sky-800 transition hover:border-sky-400 hover:bg-sky-100 disabled:cursor-wait disabled:opacity-70"
                disabled={isCreating}
                onClick={handleOpenTutorial}
                type="button"
              >
                {isCreating ? "Creating..." : "New tutorial"}
              </button>
            </div>
          </div>
          {errorMessage ? (
            <p className="mt-4 rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-800">
              {errorMessage}
            </p>
          ) : null}
        </section>

        <section className="rounded-[32px] border border-stone-900/10 bg-white/70 p-6 shadow-[0_24px_60px_rgba(84,53,20,0.08)] backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-serif text-2xl text-stone-950">Saved experiments</h2>
            <p className="text-sm text-stone-500">
              {isLoading ? "Loading..." : `${experiments.length} session${experiments.length === 1 ? "" : "s"}`}
            </p>
          </div>

          {isLoading ? (
            <div className="mt-6 rounded-3xl border border-dashed border-stone-300 bg-stone-50/80 px-6 py-10 text-sm text-stone-500">
              Loading saved experiments...
            </div>
          ) : experiments.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-stone-300 bg-stone-50/80 px-6 py-10 text-sm text-stone-500">
              No saved experiments yet.
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {experiments.map((experiment) => {
                const isTutorialExperiment =
                  Boolean(tutorialSessionsByExperiment[experiment.id]);
                const displayName = experiment.name || experiment.id;
                const summary = experiment.summary ?? {
                  workbenchToolCount: 0,
                  rackToolCount: 0,
                  materialCount: 0,
                  runCount: 0,
                };
                return (
                  <article
                    key={experiment.id}
                    className={`group rounded-[28px] border p-5 text-left shadow-[0_16px_40px_rgba(84,53,20,0.08)] transition hover:shadow-[0_18px_44px_rgba(84,53,20,0.11)] ${
                      isTutorialExperiment
                        ? "border-sky-200 bg-sky-50/80 hover:border-sky-300"
                        : "border-stone-900/10 bg-[#fffdf7] hover:border-stone-900/20"
                    }`}
                  >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-stone-400">
                        {experiment.status}
                      </p>
                      {editingExperimentId === experiment.id ? (
                        <form
                          className="mt-2 flex flex-col gap-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void handleRenameExperiment(experiment.id);
                          }}
                        >
                          <label className="sr-only" htmlFor={`experiment-name-${experiment.id}`}>
                            Experiment name
                          </label>
                          <input
                            id={`experiment-name-${experiment.id}`}
                            autoFocus
                            maxLength={80}
                            value={nameDraft}
                            onChange={(event) => setNameDraft(event.target.value)}
                            className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-semibold outline-none ring-amber-200 focus:ring-2"
                          />
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              aria-label="Save name"
                              disabled={renamingExperimentId === experiment.id || !nameDraft.trim()}
                              className="rounded-full bg-stone-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingExperimentId(null)}
                              className="px-2 py-1 text-xs text-stone-500"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <div className="mt-2 flex items-center gap-1.5">
                            <h3 className="text-lg font-semibold text-stone-950">
                              {displayName}
                            </h3>
                            <button
                              type="button"
                              aria-label={`Rename ${displayName}`}
                              onClick={() => {
                                setEditingExperimentId(experiment.id);
                                setNameDraft(displayName);
                              }}
                              className="rounded-full p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                            >
                              <PencilIcon />
                            </button>
                          </div>
                          {displayName !== experiment.id ? (
                            <p className="mt-1 break-all font-mono text-[10px] text-stone-400">
                              {experiment.id}
                            </p>
                          ) : null}
                        </>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {isTutorialExperiment ? (
                        <span className="rounded-full bg-sky-700 px-3 py-1 text-xs font-semibold text-white">
                          Tutorial
                        </span>
                      ) : null}
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">
                        v{experiment.snapshot_version}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-stone-700">
                    <span className="rounded-full bg-stone-100 px-3 py-1.5">
                      {summary.workbenchToolCount} bench tool{summary.workbenchToolCount === 1 ? "" : "s"}
                    </span>
                    <span className="rounded-full bg-sky-100 px-3 py-1.5 text-sky-900">
                      {summary.rackToolCount} rack vial{summary.rackToolCount === 1 ? "" : "s"}
                    </span>
                    <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-900">
                      {summary.materialCount} material{summary.materialCount === 1 ? "" : "s"}
                    </span>
                    <span className="rounded-full bg-violet-100 px-3 py-1.5 text-violet-900">
                      {summary.runCount} run{summary.runCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <dl className="mt-5 flex flex-col gap-2 text-sm text-stone-600">
                    <div className="flex items-center justify-between gap-3">
                      <dt>Updated</dt>
                      <dd className="text-right text-stone-950">
                        {formatSessionDate(experiment.updated_at)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt>Simulated</dt>
                      <dd className="text-right text-stone-950">
                        {formatSessionDate(experiment.last_simulation_at)}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-5 line-clamp-3 min-h-[3.75rem] text-sm leading-6 text-stone-500">
                    {experiment.last_audit_entry ?? "No audit log yet."}
                  </p>
                  <div className="relative mt-4 flex items-center gap-2">
                    <button
                      aria-label={
                        isTutorialExperiment
                          ? "Open tutorial experiment"
                          : "Open experiment"
                      }
                      type="button"
                      onClick={() => {
                        if (isTutorialExperiment) {
                          const activeSession = saveTutorialSession({
                            tutorialId: CALIBRATION_SAMPLE_TUTORIAL_ID,
                            experimentId: experiment.id,
                            status: "active",
                          });
                          setTutorialSessionsByExperiment((current) => ({
                            ...current,
                            [experiment.id]: activeSession,
                          }));
                          router.push(
                            `/experiments/${experiment.id}?tutorial=${CALIBRATION_SAMPLE_TUTORIAL_ID}`,
                          );
                          return;
                        }
                        router.push(`/experiments/${experiment.id}`);
                      }}
                      className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition ${
                        isTutorialExperiment
                          ? "bg-sky-700 text-white hover:bg-sky-800"
                          : "bg-stone-900 text-white hover:bg-stone-800"
                      }`}
                    >
                      {isTutorialExperiment ? "Open tutorial" : "Open experiment"}
                      <ArrowIcon />
                    </button>
                    <button
                      type="button"
                      aria-label={`Manage ${displayName}`}
                      aria-expanded={managingExperimentId === experiment.id}
                      aria-haspopup="menu"
                      onClick={() =>
                        setManagingExperimentId((current) =>
                          current === experiment.id ? null : experiment.id,
                        )
                      }
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-800"
                    >
                      <MoreIcon />
                    </button>
                    {managingExperimentId === experiment.id ? (
                      <div
                        ref={managementMenuRef}
                        className="absolute bottom-12 right-0 z-10 w-48 overflow-hidden rounded-2xl border border-stone-200 bg-white p-1.5 shadow-[0_16px_40px_rgba(28,25,23,0.16)]"
                      >
                        <button
                          type="button"
                          aria-label={`Duplicate ${displayName}`}
                          onClick={() => void handleDuplicateExperiment(experiment.id)}
                          disabled={duplicatingExperimentId === experiment.id}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-stone-700 transition hover:bg-stone-100 disabled:cursor-wait disabled:opacity-60"
                        >
                          <CopyIcon />
                          {duplicatingExperimentId === experiment.id ? "Duplicating..." : "Duplicate"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteExperiment(experiment.id)}
                          disabled={deletingExperimentId === experiment.id}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-stone-700 transition hover:bg-stone-100 disabled:cursor-wait disabled:opacity-60"
                        >
                          <TrashIcon />
                          {deletingExperimentId === experiment.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
