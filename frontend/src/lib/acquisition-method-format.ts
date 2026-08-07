/** Formatting shared by every view that renders an acquisition method. */

/** Render a duration in seconds as `m:ss`, the way an instrument console does. */
export function formatDuration(seconds: number): string {
  const wholeMinutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds - wholeMinutes * 60);
  return `${wholeMinutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

/** Render an instrument setting without dragging a float tail behind it. */
export function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

/** Turn a method name into a stable identifier candidate. */
export function slugifyMethodName(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return slug || "method";
}

/**
 * Derive an identifier no method in `takenIds` already owns.
 *
 * Duplicating twice from the same source is a normal thing to do, so the
 * second copy must not collide with the first one on the backend.
 */
export function uniqueMethodId(candidate: string, takenIds: Iterable<string>): string {
  const taken = new Set(takenIds);
  if (!taken.has(candidate)) return candidate;
  let suffix = 2;
  while (taken.has(`${candidate}_${suffix}`)) suffix += 1;
  return `${candidate}_${suffix}`;
}
