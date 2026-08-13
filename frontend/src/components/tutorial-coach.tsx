"use client";

import { useEffect, useRef } from "react";

import type { TutorialEvaluation } from "@/lib/tutorial-engine";

type TutorialCoachProps = {
  active: boolean;
  evaluation: TutorialEvaluation;
  onPause: () => void;
  onRestart: () => void | Promise<void>;
  onResume: () => void;
};

const spotlightPadding = 8;
const clippingOverflowValues = new Set(["auto", "clip", "hidden", "scroll"]);

function findAnchor(anchor: string) {
  return document.querySelector<HTMLElement>(`[data-tutorial-anchor="${anchor}"]`);
}

function isClippingElement(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  return [style.overflow, style.overflowX, style.overflowY].some((value) =>
    clippingOverflowValues.has(value),
  );
}

function isFullyVisible(target: HTMLElement, bounds: DOMRect) {
  let clipLeft = 0;
  let clipTop = 0;
  let clipRight = window.innerWidth;
  let clipBottom = window.innerHeight;

  for (let parent = target.parentElement; parent; parent = parent.parentElement) {
    if (!isClippingElement(parent)) {
      continue;
    }
    const parentBounds = parent.getBoundingClientRect();
    clipLeft = Math.max(clipLeft, parentBounds.left);
    clipTop = Math.max(clipTop, parentBounds.top);
    clipRight = Math.min(clipRight, parentBounds.right);
    clipBottom = Math.min(clipBottom, parentBounds.bottom);
  }

  return (
    bounds.width > 0 &&
    bounds.height > 0 &&
    bounds.left - spotlightPadding >= clipLeft &&
    bounds.top - spotlightPadding >= clipTop &&
    bounds.right + spotlightPadding <= clipRight &&
    bounds.bottom + spotlightPadding <= clipBottom
  );
}

export function TutorialCoach({
  active,
  evaluation,
  onPause,
  onRestart,
  onResume,
}: TutorialCoachProps) {
  const categoryRevealAnchorRef = useRef<string | null>(null);
  const revealedAnchorRef = useRef<string | null>(null);
  const spotlightRef = useRef<HTMLDivElement | null>(null);
  const anchor = evaluation.currentStep?.anchor(evaluation.experiment) ?? null;
  useEffect(() => {
    if (!active || !anchor) {
      categoryRevealAnchorRef.current = null;
      revealedAnchorRef.current = null;
      if (spotlightRef.current) {
        spotlightRef.current.style.display = "none";
      }
      return;
    }

    let observedTarget: HTMLElement | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let animationFrame = 0;

    const update = (allowReveal = false) => {
      const spotlight = spotlightRef.current;
      const target = findAnchor(anchor);
      if (!spotlight || !target) {
        if (spotlight) {
          spotlight.style.display = "none";
        }
        return;
      }

      if (allowReveal && categoryRevealAnchorRef.current !== anchor) {
        const category = target.closest<HTMLElement>("[data-tutorial-category]");
        const toggle = category?.querySelector<HTMLButtonElement>(
          'button[aria-expanded="false"]',
        );
        if (toggle) {
          categoryRevealAnchorRef.current = anchor;
          toggle.click();
        }
      }

      const bounds = target.getBoundingClientRect();
      if (!isFullyVisible(target, bounds)) {
        spotlight.style.display = "none";
        return;
      }

      spotlight.style.display = "block";
      spotlight.style.height = `${bounds.height + spotlightPadding * 2}px`;
      spotlight.style.left = `${bounds.left - spotlightPadding}px`;
      spotlight.style.top = `${bounds.top - spotlightPadding}px`;
      spotlight.style.width = `${bounds.width + spotlightPadding * 2}px`;

      if (observedTarget !== target && typeof ResizeObserver !== "undefined") {
        resizeObserver?.disconnect();
        observedTarget = target;
        resizeObserver = new ResizeObserver(() => update());
        resizeObserver.observe(target);
      }
    };

    const revealTargetOnce = () => {
      if (revealedAnchorRef.current === anchor) {
        return;
      }

      const target = findAnchor(anchor);
      if (!target) {
        return;
      }

      revealedAnchorRef.current = anchor;
      target?.scrollIntoView?.({ behavior: "smooth", block: "center", inline: "nearest" });
      update();
    };

    update(revealedAnchorRef.current !== anchor);
    animationFrame = window.requestAnimationFrame(revealTargetOnce);

    const mutationObserver = new MutationObserver(() => {
      update(revealedAnchorRef.current !== anchor);
      revealTargetOnce();
    });
    const handleViewportChange = () => update();
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      mutationObserver.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [active, anchor, evaluation.experiment.snapshot_version]);

  if (!active) {
    return (
      <button
        aria-label="Resume tutorial"
        className="fixed bottom-5 right-5 z-[70] rounded-full border border-sky-200 bg-white px-5 py-3 text-sm font-semibold text-sky-800 shadow-xl transition hover:border-sky-300 hover:bg-sky-50"
        onClick={onResume}
        type="button"
      >
        Resume tutorial
      </button>
    );
  }

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed z-[60] rounded-[1.4rem] border-2 border-sky-400 bg-sky-200/10 shadow-[0_0_0_5px_rgba(125,211,252,0.28),0_0_38px_rgba(14,165,233,0.38)]"
        data-testid="tutorial-spotlight"
        ref={spotlightRef}
        style={{ display: "none" }}
      />

      <aside
        aria-label="Guided tutorial"
        aria-live="polite"
        className="fixed inset-x-3 bottom-3 z-[70] max-h-[min(70vh,34rem)] overflow-y-auto rounded-[1.6rem] border border-sky-200 bg-white/95 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.28)] backdrop-blur md:inset-x-auto md:bottom-5 md:right-5 md:w-[24rem]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700">
              Guided tutorial
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {evaluation.currentChapter.title} · {evaluation.progressPercent}%
            </p>
          </div>
          <button
            aria-label="Pause tutorial"
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            onClick={onPause}
            type="button"
          >
            Pause
          </button>
        </div>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-sky-500 transition-[width] duration-300"
            style={{ width: `${evaluation.progressPercent}%` }}
          />
        </div>

        {evaluation.currentStep ? (
          <div className="mt-5">
            <h2 className="text-lg font-semibold text-slate-950">
              {evaluation.currentStep.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {evaluation.currentStep.instruction}
            </p>
            <p className="mt-3 rounded-xl bg-sky-50 px-3 py-2.5 text-xs leading-5 text-sky-900">
              {evaluation.currentStep.hint}
            </p>
          </div>
        ) : (
          <div className="mt-5">
            <h2 className="text-lg font-semibold text-emerald-800">Tutorial complete</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              The calibration point and sample have been acquired. You can now explore the
              results freely or restart the tutorial.
            </p>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <span className="text-xs text-slate-500">
            {evaluation.completedStepIds.length}/{evaluation.totalStepCount} objectives
          </span>
          <button
            className="text-xs font-semibold text-rose-700 transition hover:text-rose-900"
            onClick={() => void onRestart()}
            type="button"
          >
            Restart
          </button>
        </div>
      </aside>
    </>
  );
}
