import type { MessageKey, MessageParams } from "@/lib/i18n";
import type { AcquisitionMethod, MrmTransition } from "@/types/workbench";

/** A rule the method breaks, named by catalogue key so the editor can render it
 *  in the learner's language rather than in the language the rule was written in. */
export type MethodValidationError = {
  key: MessageKey;
  params?: MessageParams;
};

/**
 * Structural errors that make a method unusable. Mirrors
 * `backend/app/domain/acquisition_method_rules.py` so the editor can refuse a
 * save before the round trip; the backend stays the authority.
 *
 * Analytical problems — a channel watching masses nothing responds to, a
 * retention window that misses the peak — are deliberately *not* errors. Saving
 * such a method and observing a flat trace is the point of the exercise.
 */
export function validateAcquisitionMethod(
  method: Pick<AcquisitionMethod, "name" | "runtimeS" | "transitions" | "version">,
): MethodValidationError[] {
  const errors: MethodValidationError[] = [];

  if (!method.name.trim()) errors.push({ key: "methodError.missingName" });
  if (!method.version.trim()) errors.push({ key: "methodError.missingVersion" });
  if (method.runtimeS <= 0) errors.push({ key: "methodError.runtimePositive" });

  if (method.transitions.length === 0) {
    errors.push({ key: "methodError.noTransition" });
    return errors;
  }

  const seen = new Set<string>();
  const duplicated = new Set<string>();
  for (const transition of method.transitions) {
    if (!transition.id.trim()) {
      errors.push({ key: "methodError.transitionIdentifier" });
    } else if (seen.has(transition.id)) {
      duplicated.add(transition.id);
    } else {
      seen.add(transition.id);
    }

    if (transition.q1Mz <= 0 || transition.q3Mz <= 0) {
      errors.push({ key: "methodError.mzPositive", params: { id: transition.id } });
    }
    if (transition.dwellTimeMs <= 0) {
      errors.push({ key: "methodError.dwellPositive", params: { id: transition.id } });
    }
    if (transition.retentionWindowS <= 0) {
      errors.push({ key: "methodError.windowPositive", params: { id: transition.id } });
    }
  }

  for (const transitionId of [...duplicated].sort()) {
    errors.push({ key: "methodError.duplicateIdentifier", params: { id: transitionId } });
  }

  const withQuantifier = new Set(
    method.transitions
      .filter((transition) => transition.role === "quantifier")
      .map((transition) => transition.compoundId),
  );
  const compoundIds = [...new Set(method.transitions.map((t) => t.compoundId))];
  for (const compoundId of compoundIds) {
    if (!withQuantifier.has(compoundId)) {
      errors.push({ key: "methodError.noQuantifier", params: { compound: compoundId } });
    }
  }

  return errors;
}

export function updateTransition(
  transitions: MrmTransition[],
  index: number,
  patch: Partial<MrmTransition>,
): MrmTransition[] {
  return transitions.map((transition, transitionIndex) =>
    transitionIndex === index ? { ...transition, ...patch } : transition,
  );
}
