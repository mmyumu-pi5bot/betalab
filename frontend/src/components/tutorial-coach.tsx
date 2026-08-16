"use client";

import { useEffect, useRef, useState } from "react";

import {
  getLimsTutorialFieldPresentation,
  getLimsTutorialValues,
  getTutorialActionToolPresentation,
  getTutorialCountdown,
  getTutorialInventoryCategoryPresentation,
  getTutorialStepPresentation,
  isTutorialActionTool,
  type LimsTutorialField,
  type TutorialAction,
  type TutorialActionTool,
  type TutorialCountdown,
  type TutorialEvaluation,
  type TutorialStepPresentation,
} from "@/lib/tutorial-engine";
import type { TutorialIntervention } from "@/lib/tutorial-action-guard";
import type { Experiment } from "@/types/experiment";

type TutorialCoachProps = {
  active: boolean;
  evaluation: TutorialEvaluation;
  intervention?: TutorialIntervention | null;
  isDragging?: boolean;
  onContinueTutorial?: () => void;
  onFinish?: () => void;
  onLeaveTutorial?: () => void;
  onPause: () => void;
  onRestart: () => void | Promise<void>;
  onResume: () => void;
};

const spotlightPadding = 8;
const clippingOverflowValues = new Set(["auto", "clip", "hidden", "scroll"]);

function findDirectAnchor(anchor: string): HTMLElement | null {
  if (anchor.startsWith("cut-apples-")) {
    const lotId = anchor.slice("cut-apples-".length);
    const knife = document.querySelector<HTMLElement>('[data-tutorial-anchor="action-knife"]');
    return knife?.getAttribute("aria-pressed") === "true"
      ? document.querySelector<HTMLElement>(`[data-testid="bench-produce-lot-${lotId}"]`)
      : knife;
  }
  if (anchor === "pipette-aspirate") {
    const pipette = document.querySelector<HTMLElement>('[data-tutorial-anchor="action-pipette"]');
    return pipette?.getAttribute("aria-pressed") === "true"
      ? document.querySelector<HTMLElement>('[data-tutorial-anchor="tool-type-centrifuge_tube"]')
      : pipette;
  }
  if (anchor.startsWith("spatula-load-powder:")) {
    const powderAnchor = anchor.slice("spatula-load-powder:".length);
    const spatula = document.querySelector<HTMLElement>('[data-tutorial-anchor="action-spatula"]');
    return spatula?.getAttribute("aria-pressed") === "true"
      ? findDirectAnchor(powderAnchor)
      : spatula;
  }
  if (anchor === "instrument-console-next") {
    // The button that opens the console stays on screen once the console is open,
    // and comes first in document order, so the launch button has to be asked for
    // first rather than left to a comma selector.
    return (
      document.querySelector<HTMLElement>('[data-tutorial-anchor="instrument-launch"]')
      ?? document.querySelector<HTMLElement>('[data-tutorial-anchor="instrument-open-console"]')
    );
  }
  // A deliberate tutorial anchor wins over an element that merely shares the name
  // as a test id — a progress track and the bar filling it, for instance.
  return (
    document.querySelector<HTMLElement>(`[data-tutorial-anchor="${anchor}"]`)
    ?? document.querySelector<HTMLElement>(`[data-testid="${anchor}"]`)
  );
}

type AccessTarget = "basket" | "trash" | null;

type AnchorResolution = {
  accessTarget: AccessTarget;
  actionTool: TutorialActionTool | null;
  collapsedCategoryLabel: string | null;
  limsField: LimsTutorialField | null;
  target: HTMLElement | null;
};

// An inventory item sitting in a collapsed section cannot be dragged, and its
// hidden card has no visible box to spotlight. The section header is highlighted
// instead, so the learner opens it themselves before the real step resumes.
function findCollapsedCategoryToggle(
  target: HTMLElement,
): { label: string; toggle: HTMLElement } | null {
  const category = target.closest<HTMLElement>("[data-tutorial-category]");
  const toggle = category?.querySelector<HTMLElement>('button[aria-expanded="false"]');
  return category && toggle
    ? { label: category.dataset.tutorialCategoryLabel ?? "Inventory", toggle }
    : null;
}

// Anchors that already account for the selected tool: the step itself is the tool
// being used, so a pressed action button is expected there.
function isActionDrivenAnchor(anchor: string) {
  return (
    anchor === "pipette-aspirate" ||
    anchor.startsWith("action-") ||
    anchor.startsWith("cut-apples-") ||
    anchor.startsWith("spatula-load-powder:")
  );
}

function findSelectedActionTool(): { target: HTMLElement; tool: TutorialActionTool } | null {
  const pressed = document.querySelector<HTMLElement>(
    '[data-tutorial-anchor^="action-"][aria-pressed="true"]',
  );
  const tool = pressed?.dataset.tutorialAnchor?.slice("action-".length);
  return pressed && tool && isTutorialActionTool(tool) ? { target: pressed, tool } : null;
}

// A pipette holding liquid or a loaded spatula is mid-transfer: the tool is still
// doing the current step's work even when the anchor points elsewhere.
function isActionToolInUse(experiment: Experiment, tool: TutorialActionTool) {
  return (
    (tool === "pipette" && experiment.pipette.volumeMl > 0) ||
    (tool === "spatula" && experiment.spatula.isLoaded)
  );
}

function resolveAnchor(
  anchor: string,
  experiment: Experiment,
  guideActionTool: boolean,
): AnchorResolution {
  if (guideActionTool && !isActionDrivenAnchor(anchor)) {
    // A tool stays in hand until it is put away, and blocks drag and drop meanwhile.
    const selectedAction = findSelectedActionTool();
    if (selectedAction && !isActionToolInUse(experiment, selectedAction.tool)) {
      return {
        accessTarget: null,
        actionTool: selectedAction.tool,
        collapsedCategoryLabel: null,
        limsField: null,
        target: selectedAction.target,
      };
    }
  }
  if (anchor === "lims-form-next-field") {
    const values = getLimsTutorialValues(experiment);
    const massSummary = document.querySelector<HTMLButtonElement>(
      '[data-tutorial-anchor="lims-mass-summary"]',
    );
    if (!massSummary || massSummary.getAttribute("aria-pressed") !== "true") {
      return {
        accessTarget: null,
        actionTool: null,
        collapsedCategoryLabel: null,
        limsField: "mass-summary",
        target: massSummary,
      };
    }
    const fields: Array<{
      anchor: string;
      field: LimsTutorialField;
      matches: (value: string) => boolean;
    }> = [
      {
        anchor: "lims-orchard-name",
        field: "orchard",
        matches: (value) => value.trim() === values.orchardName,
      },
      {
        anchor: "lims-harvest-date",
        field: "harvest-date",
        matches: (value) => value === values.harvestDate,
      },
      {
        anchor: "lims-indicative-mass",
        field: "indicative-mass",
        matches: (value) => Number(value) === values.indicativeMassG,
      },
    ];
    for (const field of fields) {
      const input = document.querySelector<HTMLInputElement>(
        `[data-tutorial-anchor="${field.anchor}"]`,
      );
      if (!input || !field.matches(input.value)) {
        return {
          accessTarget: null,
          actionTool: null,
          collapsedCategoryLabel: null,
          limsField: field.field,
          target: input,
        };
      }
    }
    return {
      accessTarget: null,
      actionTool: null,
      collapsedCategoryLabel: null,
      limsField: "create-record",
      target: document.querySelector<HTMLElement>(
        '[data-tutorial-anchor="lims-create-record"]',
      ),
    };
  }
  const directTarget = findDirectAnchor(anchor);
  if (directTarget) {
    const collapsedCategory = findCollapsedCategoryToggle(directTarget);
    return collapsedCategory
      ? {
          accessTarget: null,
          actionTool: null,
          collapsedCategoryLabel: collapsedCategory.label,
          limsField: null,
          target: collapsedCategory.toggle,
        }
      : {
          accessTarget: null,
          actionTool: null,
          collapsedCategoryLabel: null,
          limsField: null,
          target: directTarget,
        };
  }
  if (anchor === "basket-received-bag" || anchor.startsWith("basket-produce-")) {
    return {
      accessTarget: "basket",
      actionTool: null,
      collapsedCategoryLabel: null,
      limsField: null,
      target: document.querySelector<HTMLElement>('[data-testid="basket-open-button"]'),
    };
  }
  if (anchor.startsWith("trash-tool-") || anchor.startsWith("trash-produce-lot-")) {
    return {
      accessTarget: "trash",
      actionTool: null,
      collapsedCategoryLabel: null,
      limsField: null,
      target: document.querySelector<HTMLElement>('[data-testid="trash-dropzone"]'),
    };
  }
  return {
    accessTarget: null,
    actionTool: null,
    collapsedCategoryLabel: null,
    limsField: null,
    target: null,
  };
}

type TutorialActionKind = TutorialAction["kind"];

const tutorialActionGlyphs: Record<Exclude<TutorialActionKind, "drag">, string> = {
  click: "●",
  inspect: "◎",
  keyboard: "⌨",
  type: "▣",
  wait: "◷",
};

// Dragging is the one gesture the learner performs with the mouse rather than on a
// single control, and a bare arrow glyph read as "open elsewhere". This draws the
// gesture instead: a pointer holding an item by its corner.
function TutorialActionIcon({
  className,
  kind,
}: {
  className: string;
  kind: TutorialActionKind;
}) {
  if (kind !== "drag") {
    return <>{tutorialActionGlyphs[kind]}</>;
  }

  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <rect
        height="9.6"
        rx="2.2"
        stroke="currentColor"
        strokeWidth="1.9"
        width="9.6"
        x="2.2"
        y="2.2"
      />
      <path
        d="M13.4 13.4 17.5 23.3 19 19 23.3 17.5Z"
        fill="currentColor"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function TutorialStopwatchIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="13.5" r="7.8" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M12 9.6v4.2l2.7 1.9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M9.6 2.6h4.8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

// The reaction is running whether or not anyone is looking, so the chrono is drawn in
// alarm colours and given the widest bar on the panel: it is the only thing on screen
// that is still counting down while the learner reads.
function TutorialCountdownPanel({ countdown }: { countdown: TutorialCountdown }) {
  const remainingRatio = Math.min(
    Math.max(countdown.remainingSeconds / countdown.totalSeconds, 0),
    1,
  );

  return (
    <div
      className="mt-3 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2.5"
      data-testid="tutorial-countdown"
      role="timer"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-rose-900">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white"
        >
          <TutorialStopwatchIcon className="h-[18px] w-[18px]" />
        </span>
        <span className="flex-1">{countdown.label}</span>
        <span className="font-mono text-base tabular-nums" data-testid="tutorial-countdown-seconds">
          {countdown.remainingSeconds.toFixed(1)}s
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-rose-200">
        <div
          className="h-full rounded-full bg-rose-600 transition-[width] duration-200"
          data-testid="tutorial-countdown-bar"
          style={{ width: `${remainingRatio * 100}%` }}
        />
      </div>
    </div>
  );
}

function isClippingElement(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  return [style.overflow, style.overflowX, style.overflowY].some((value) =>
    clippingOverflowValues.has(value),
  );
}

type ClipBounds = { bottom: number; left: number; right: number; top: number };

function clipBoundsFor(target: HTMLElement): ClipBounds {
  let left = 0;
  let top = 0;
  let right = window.innerWidth;
  let bottom = window.innerHeight;

  for (let parent = target.parentElement; parent; parent = parent.parentElement) {
    if (!isClippingElement(parent)) {
      continue;
    }
    const parentBounds = parent.getBoundingClientRect();
    left = Math.max(left, parentBounds.left);
    top = Math.max(top, parentBounds.top);
    right = Math.min(right, parentBounds.right);
    bottom = Math.min(bottom, parentBounds.bottom);
  }

  return { bottom, left, right, top };
}

// A highlighted element is regularly larger than the visible area — tall widgets
// overflow the bottom of the screen, and the workspace canvas is taller than the
// viewport while sitting inside clipping ancestors — so demanding full visibility
// would hide the halo exactly where it is needed most. The halo is drawn on the
// visible part instead, and only disappears when nothing of the target is left.
// The span is measured on the target itself, never on the padded halo: several
// controls are hugged by a clipping ancestor of their own size (a 10 px progress
// track, a start button inside a scaled-down <foreignObject>), and counting the
// trimmed padding as missing target hid the highlight on a perfectly visible
// control.
const minimumVisibleSpan = 8;

function visibleSpotlightBounds(target: HTMLElement, bounds: DOMRect) {
  const clip = clipBoundsFor(target);
  const left = Math.max(bounds.left, clip.left);
  const top = Math.max(bounds.top, clip.top);
  const right = Math.min(bounds.right, clip.right);
  const bottom = Math.min(bounds.bottom, clip.bottom);
  if (right - left < minimumVisibleSpan || bottom - top < minimumVisibleSpan) {
    return null;
  }

  // The margin may spill over an ancestor that hugs the target, but never past the
  // viewport, where the halo would be drawn where nobody can see it.
  const haloLeft = Math.max(left - spotlightPadding, 0);
  const haloTop = Math.max(top - spotlightPadding, 0);
  const haloRight = Math.min(right + spotlightPadding, window.innerWidth);
  const haloBottom = Math.min(bottom + spotlightPadding, window.innerHeight);

  return {
    height: haloBottom - haloTop,
    left: haloLeft,
    top: haloTop,
    width: haloRight - haloLeft,
  };
}

// 22px = badge size (28) − halo padding (8) + halo border (2): the offsets are
// measured from the halo's padding box, so this lands the badge exactly past the
// target's corner instead of over it. Small controls such as a machine power button
// were being masked by it.
const spotlightBadgeOffset = 22;
// Where the halo is cut by the visible area, the badge is flipped inside instead:
// hanging it outside a clamped edge would push it off screen.
const spotlightBadgeInset = 2;

function placeSpotlightBadge(
  badge: HTMLElement | null,
  visible: { left: number; top: number; width: number },
) {
  if (!badge) {
    return;
  }
  const overflowsTop = visible.top < spotlightBadgeOffset;
  const overflowsRight =
    visible.left + visible.width + spotlightBadgeOffset > window.innerWidth;
  badge.style.top = overflowsTop ? `${spotlightBadgeInset}px` : `-${spotlightBadgeOffset}px`;
  badge.style.right = overflowsRight ? `${spotlightBadgeInset}px` : `-${spotlightBadgeOffset}px`;
}

// While an item is being dragged, the destination the tutorial expects is marked
// on top of the regular drop-target affordance, so the learner can tell the one
// correct target apart from every target that would merely accept the item.
function TutorialDropSpotlight({ anchor }: { anchor: string }) {
  const spotlightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let observedTarget: HTMLElement | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const update = () => {
      const spotlight = spotlightRef.current;
      if (!spotlight) {
        return;
      }
      const target = findDirectAnchor(anchor);
      const bounds = target?.getBoundingClientRect();
      const visible = target && bounds ? visibleSpotlightBounds(target, bounds) : null;
      if (!target || !visible) {
        spotlight.style.display = "none";
        return;
      }

      spotlight.style.display = "block";
      spotlight.style.height = `${visible.height}px`;
      spotlight.style.left = `${visible.left}px`;
      spotlight.style.top = `${visible.top}px`;
      spotlight.style.width = `${visible.width}px`;

      if (observedTarget !== target && typeof ResizeObserver !== "undefined") {
        resizeObserver?.disconnect();
        observedTarget = target;
        resizeObserver = new ResizeObserver(() => update());
        resizeObserver.observe(target);
      }
    };

    update();

    const mutationObserver = new MutationObserver(() => update());
    mutationObserver.observe(document.body, { attributes: true, childList: true, subtree: true });
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      mutationObserver.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchor]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-[59] rounded-[1.4rem] border-[3px] border-dashed border-yellow-400 bg-yellow-300/25 shadow-[0_0_0_5px_rgba(250,204,21,0.32),0_0_38px_rgba(234,179,8,0.45)]"
      data-testid="tutorial-drop-spotlight"
      ref={spotlightRef}
      style={{ display: "none" }}
    />
  );
}

function getAccessTargetPresentation(accessTarget: Exclude<AccessTarget, null>) {
  return accessTarget === "basket"
    ? {
        action: { kind: "click" as const, label: "Click the highlighted basket" },
        hint: "The tutorial will highlight the required item as soon as the container is open.",
        instruction:
          "Click the highlighted Produce basket to open it. The sample bag or apples will then appear inside.",
        title: "Open the Produce basket",
      }
    : {
        action: { kind: "click" as const, label: "Click the highlighted trash" },
        hint: "The tutorial will highlight the required item as soon as the container is open.",
        instruction: "Click the highlighted Trash to open it. The item to recover will then appear inside.",
        title: "Open the Trash",
      };
}

// The step the learner is on is rarely the step they can act on right now: a tool
// may still be in hand, the section or container holding the item may be closed, or
// a form field may be waiting upstream. The sub-step that is actually reachable wins
// over the step's own wording, in the order the learner has to clear them.
function resolvePresentation({
  accessTarget,
  actionTool,
  collapsedCategoryLabel,
  currentStepPresentation,
  experiment,
  intervention,
  limsField,
}: {
  accessTarget: AccessTarget;
  actionTool: TutorialActionTool | null;
  collapsedCategoryLabel: string | null;
  currentStepPresentation: TutorialStepPresentation | null;
  experiment: Experiment;
  intervention: TutorialIntervention | null;
  limsField: LimsTutorialField | null;
}): TutorialStepPresentation | null {
  if (intervention) {
    return {
      action: { kind: "click", label: intervention.actionLabel },
      hint: intervention.hint,
      instruction: intervention.instruction,
      title: intervention.title,
    };
  }
  if (actionTool) {
    return getTutorialActionToolPresentation(actionTool);
  }
  if (collapsedCategoryLabel) {
    return getTutorialInventoryCategoryPresentation(collapsedCategoryLabel);
  }
  if (accessTarget) {
    return getAccessTargetPresentation(accessTarget);
  }
  if (limsField) {
    return getLimsTutorialFieldPresentation(experiment, limsField);
  }
  return currentStepPresentation;
}

export function TutorialCoach({
  active,
  evaluation,
  intervention = null,
  isDragging = false,
  onContinueTutorial,
  onFinish,
  onLeaveTutorial,
  onPause,
  onRestart,
  onResume,
}: TutorialCoachProps) {
  const badgeRef = useRef<HTMLSpanElement | null>(null);
  // Keyed on the resolved element, not on the anchor: a single step walks through
  // several targets (put the tool away, open the inventory section, then the item),
  // and each of them has to be brought on screen in turn.
  const revealedTargetRef = useRef<HTMLElement | null>(null);
  const spotlightRef = useRef<HTMLDivElement | null>(null);
  const [accessTarget, setAccessTarget] = useState<AccessTarget>(null);
  const [actionTool, setActionTool] = useState<TutorialActionTool | null>(null);
  const [collapsedCategoryLabel, setCollapsedCategoryLabel] = useState<string | null>(null);
  const [limsField, setLimsField] = useState<LimsTutorialField | null>(null);
  const anchor = intervention?.anchor
    ?? evaluation.currentStep?.anchor(evaluation.experiment)
    ?? null;
  const currentStepPresentation = evaluation.currentStep
    ? getTutorialStepPresentation(evaluation.currentStep, evaluation.experiment)
    : null;
  const guideActionTool = !intervention;
  const dropAnchor = intervention
    ? null
    : evaluation.currentStep?.dropAnchor?.(evaluation.experiment) ?? null;
  useEffect(() => {
    if (!active || !anchor) {
      revealedTargetRef.current = null;
      if (spotlightRef.current) {
        spotlightRef.current.style.display = "none";
      }
      return;
    }

    let observedTarget: HTMLElement | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let animationFrame = 0;

    const update = () => {
      const spotlight = spotlightRef.current;
      const resolution = resolveAnchor(anchor, evaluation.experiment, guideActionTool);
      const target = resolution.target;
      setAccessTarget((current) =>
        current === resolution.accessTarget ? current : resolution.accessTarget,
      );
      setActionTool((current) =>
        current === resolution.actionTool ? current : resolution.actionTool,
      );
      setCollapsedCategoryLabel((current) =>
        current === resolution.collapsedCategoryLabel ? current : resolution.collapsedCategoryLabel,
      );
      setLimsField((current) => current === resolution.limsField ? current : resolution.limsField);
      if (!spotlight || !target) {
        if (spotlight) {
          spotlight.style.display = "none";
        }
        return;
      }

      const bounds = target.getBoundingClientRect();
      const visible = visibleSpotlightBounds(target, bounds);
      if (!visible) {
        spotlight.style.display = "none";
        return;
      }

      spotlight.style.display = "block";
      spotlight.style.height = `${visible.height}px`;
      spotlight.style.left = `${visible.left}px`;
      spotlight.style.top = `${visible.top}px`;
      spotlight.style.width = `${visible.width}px`;
      placeSpotlightBadge(badgeRef.current, visible);

      if (observedTarget !== target && typeof ResizeObserver !== "undefined") {
        resizeObserver?.disconnect();
        observedTarget = target;
        resizeObserver = new ResizeObserver(() => update());
        resizeObserver.observe(target);
      }
    };

    const revealTargetOnce = () => {
      const target = resolveAnchor(anchor, evaluation.experiment, guideActionTool).target;
      if (!target || revealedTargetRef.current === target) {
        return;
      }

      revealedTargetRef.current = target;
      target?.scrollIntoView?.({ behavior: "smooth", block: "center", inline: "nearest" });
      update();
    };

    update();
    animationFrame = window.requestAnimationFrame(revealTargetOnce);

    const mutationObserver = new MutationObserver(() => {
      update();
      revealTargetOnce();
    });
    const handleViewportChange = () => update();
    const handleFormInput = () => update();
    mutationObserver.observe(document.body, { attributes: true, childList: true, subtree: true });
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    document.addEventListener("input", handleFormInput, true);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      mutationObserver.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
      document.removeEventListener("input", handleFormInput, true);
    };
  }, [active, anchor, evaluation.experiment, guideActionTool]);

  const displayedPresentation = resolvePresentation({
    accessTarget,
    actionTool,
    collapsedCategoryLabel,
    currentStepPresentation,
    experiment: evaluation.experiment,
    intervention,
    limsField,
  });

  // An intervention has already stopped the learner for a different reason, and the
  // chrono would compete with it for the same glance.
  const countdown = intervention ? null : getTutorialCountdown(evaluation.experiment);

  if (!active) {
    return (
      <button
        aria-label="Resume tutorial"
        className="fixed bottom-5 right-5 z-[70] rounded-full border-2 border-amber-400 bg-white px-5 py-3 text-sm font-semibold text-sky-800 shadow-[0_0_0_4px_rgba(251,191,36,0.16),0_18px_42px_rgba(15,23,42,0.2)] transition hover:border-amber-500 hover:bg-amber-50"
        onClick={onResume}
        type="button"
      >
        Resume tutorial
      </button>
    );
  }

  return (
    <>
      {isDragging && dropAnchor ? <TutorialDropSpotlight anchor={dropAnchor} /> : null}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed z-[60] rounded-[1.4rem] border-2 border-amber-400 bg-amber-200/10 shadow-[0_0_0_5px_rgba(251,191,36,0.28),0_0_38px_rgba(245,158,11,0.38)]"
        data-testid="tutorial-spotlight"
        ref={spotlightRef}
        style={{ display: "none" }}
      >
        {displayedPresentation?.action ? (
          <span
            className={`absolute flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-base font-bold text-white shadow-lg ${
              displayedPresentation.action.kind === "wait"
                ? "animate-pulse bg-amber-500"
                : "bg-amber-500"
            }`}
            data-action-kind={displayedPresentation.action.kind}
            data-testid="tutorial-spotlight-action-icon"
            ref={badgeRef}
            style={{ right: `-${spotlightBadgeOffset}px`, top: `-${spotlightBadgeOffset}px` }}
          >
            <TutorialActionIcon
              className="h-4 w-4"
              kind={displayedPresentation.action.kind}
            />
          </span>
        ) : null}
      </div>

      <aside
        aria-label="Guided tutorial"
        aria-live="polite"
        className="fixed inset-x-3 bottom-3 z-[70] max-h-[min(70vh,34rem)] overflow-y-auto rounded-[1.6rem] border-2 border-amber-400 bg-white/95 p-5 shadow-[0_0_0_4px_rgba(251,191,36,0.16),0_24px_80px_rgba(15,23,42,0.28)] backdrop-blur md:inset-x-auto md:bottom-5 md:right-5 md:w-[24rem]"
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
          {evaluation.isComplete ? null : (
            <button
              aria-label="Pause tutorial"
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              onClick={onPause}
              type="button"
            >
              Pause
            </button>
          )}
        </div>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-sky-500 transition-[width] duration-300"
            style={{ width: `${evaluation.progressPercent}%` }}
          />
        </div>

        {evaluation.currentStep && displayedPresentation ? (
          <div className="mt-5">
            <h2 className="text-lg font-semibold text-slate-950">
              {displayedPresentation.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {displayedPresentation.instruction}
            </p>
            {countdown ? (
              <TutorialCountdownPanel countdown={countdown} />
            ) : displayedPresentation.deadline ? (
              <div
                className="mt-3 flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-900"
                data-testid="tutorial-deadline"
              >
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white"
                >
                  <TutorialStopwatchIcon className="h-[18px] w-[18px]" />
                </span>
                <span>{displayedPresentation.deadline}</span>
              </div>
            ) : null}
            {displayedPresentation.action ? (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-950">
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-600 text-base text-white"
                  data-action-kind={displayedPresentation.action.kind}
                  data-testid="tutorial-action-icon"
                >
                  <TutorialActionIcon
                    className="h-[18px] w-[18px]"
                    kind={displayedPresentation.action.kind}
                  />
                </span>
                <span>{displayedPresentation.action.label}</span>
              </div>
            ) : null}
            <p className="mt-3 rounded-xl bg-sky-50 px-3 py-2.5 text-xs leading-5 text-sky-900">
              {displayedPresentation.hint}
            </p>
            {intervention ? (
              <div className="mt-4 grid gap-2">
                <button
                  className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
                  onClick={onContinueTutorial}
                  type="button"
                >
                  {intervention.continueLabel}
                </button>
                <button
                  className="rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                  onClick={onLeaveTutorial}
                  type="button"
                >
                  {intervention.leaveLabel}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-5">
            <h2 className="text-lg font-semibold text-emerald-800">Tutorial complete</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              The calibration point and sample have been acquired. Switch this experiment to
              free mode to keep working without the coach, or restart the tutorial.
            </p>
            <button
              className="mt-4 w-full rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
              onClick={onFinish}
              type="button"
            >
              Switch to free mode
            </button>
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
