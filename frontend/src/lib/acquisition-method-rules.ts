import type { AcquisitionMethod, MrmTransition } from "@/types/workbench";

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
): string[] {
  const errors: string[] = [];

  if (!method.name.trim()) errors.push("A method needs a name.");
  if (!method.version.trim()) errors.push("A method needs a version.");
  if (method.runtimeS <= 0) errors.push("Run duration must be positive.");

  if (method.transitions.length === 0) {
    errors.push("A method needs at least one transition.");
    return errors;
  }

  const seen = new Set<string>();
  const duplicated = new Set<string>();
  for (const transition of method.transitions) {
    if (!transition.id.trim()) {
      errors.push("Every transition needs an identifier.");
    } else if (seen.has(transition.id)) {
      duplicated.add(transition.id);
    } else {
      seen.add(transition.id);
    }

    if (transition.q1Mz <= 0 || transition.q3Mz <= 0) {
      errors.push(`Transition '${transition.id}': m/z values must be positive.`);
    }
    if (transition.dwellTimeMs <= 0) {
      errors.push(`Transition '${transition.id}': dwell time must be positive.`);
    }
    if (transition.retentionWindowS <= 0) {
      errors.push(`Transition '${transition.id}': retention window must be positive.`);
    }
  }

  for (const transitionId of [...duplicated].sort()) {
    errors.push(`Duplicate transition identifier '${transitionId}'.`);
  }

  const withQuantifier = new Set(
    method.transitions
      .filter((transition) => transition.role === "quantifier")
      .map((transition) => transition.compoundId),
  );
  const compoundIds = [...new Set(method.transitions.map((t) => t.compoundId))];
  for (const compoundId of compoundIds) {
    if (!withQuantifier.has(compoundId)) {
      errors.push(`Compound '${compoundId}' has no quantifier transition.`);
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
