"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createExperiment, deleteExperiment, listExperiments } from "@/lib/api";
import { CALIBRATION_SAMPLE_TUTORIAL_ID } from "@/lib/tutorial-engine";
import {
  clearTutorialSession,
  getTutorialSession,
  saveTutorialSession,
  type TutorialSession,
} from "@/lib/tutorial-session-store";
import type { ExperimentListEntry } from "@/types/experiment";

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tutorialSession, setTutorialSession] = useState<TutorialSession | null>(null);

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
        const savedTutorial = getTutorialSession(CALIBRATION_SAMPLE_TUTORIAL_ID);
        if (
          savedTutorial &&
          savedExperiments.some((experiment) => experiment.id === savedTutorial.experimentId)
        ) {
          setTutorialSession(savedTutorial);
        } else {
          clearTutorialSession(CALIBRATION_SAMPLE_TUTORIAL_ID);
          setTutorialSession(null);
        }
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
    if (tutorialSession) {
      const activeSession = saveTutorialSession({
        tutorialId: CALIBRATION_SAMPLE_TUTORIAL_ID,
        experimentId: tutorialSession.experimentId,
        status: "active",
      });
      setTutorialSession(activeSession);
      router.push(
        `/experiments/${activeSession.experimentId}?tutorial=${CALIBRATION_SAMPLE_TUTORIAL_ID}`,
      );
      return;
    }

    startCreateTransition(async () => {
      setErrorMessage(null);
      try {
        const experiment = await createExperiment();
        const session = saveTutorialSession({
          tutorialId: CALIBRATION_SAMPLE_TUTORIAL_ID,
          experimentId: experiment.id,
          status: "active",
        });
        setTutorialSession(session);
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
      setExperiments((current) => current.filter((entry) => entry.id !== experimentId));
      if (tutorialSession?.experimentId === experimentId) {
        clearTutorialSession(CALIBRATION_SAMPLE_TUTORIAL_ID);
        setTutorialSession(null);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to delete experiment",
      );
    } finally {
      setDeletingExperimentId(null);
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
                aria-label={
                  tutorialSession ? "Continue guided tutorial" : "New tutorial"
                }
                className="rounded-full border border-sky-300 bg-sky-50 px-5 py-3 text-sm font-semibold text-sky-800 transition hover:border-sky-400 hover:bg-sky-100 disabled:cursor-wait disabled:opacity-70"
                disabled={isCreating}
                onClick={handleOpenTutorial}
                type="button"
              >
                {isCreating
                  ? "Creating..."
                  : tutorialSession
                    ? "Continue tutorial"
                    : "New tutorial"}
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
                  tutorialSession?.experimentId === experiment.id;
                return (
                  <article
                    key={experiment.id}
                    className={`group rounded-[28px] border p-5 text-left shadow-[0_16px_40px_rgba(84,53,20,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(84,53,20,0.14)] ${
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
                      <h3 className="mt-2 break-all text-sm font-semibold text-stone-950">
                        {experiment.id}
                      </h3>
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
                  <div className="mt-4 flex items-center justify-between gap-3">
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
                          setTutorialSession(activeSession);
                          router.push(
                            `/experiments/${experiment.id}?tutorial=${CALIBRATION_SAMPLE_TUTORIAL_ID}`,
                          );
                          return;
                        }
                        router.push(`/experiments/${experiment.id}`);
                      }}
                      className={`text-sm font-medium transition ${
                        isTutorialExperiment
                          ? "text-sky-800 group-hover:text-sky-950"
                          : "text-stone-950 group-hover:text-amber-900"
                      }`}
                    >
                      {isTutorialExperiment ? "Open tutorial" : "Open experiment"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteExperiment(experiment.id)}
                      disabled={deletingExperimentId === experiment.id}
                      className="rounded-full border border-rose-200 px-3 py-1 text-xs font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-wait disabled:opacity-60"
                    >
                      {deletingExperimentId === experiment.id ? "Deleting..." : "Delete"}
                    </button>
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
