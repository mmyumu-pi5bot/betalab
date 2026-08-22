/**
 * Stacking bands for anything that floats above the lab scene.
 *
 * The numbers used to live as Tailwind arbitrary values spread across the
 * components, which is how the tutorial coach ended up two orders of magnitude
 * below the dialogs it is supposed to point into: a spotlight is useless when
 * the modal it highlights is painted over it.
 *
 * The bands are ordered, and the order is the contract:
 * scene overlays < dialogs < tutorial coach. The coach comes last on purpose —
 * guidance that a dialog can hide is guidance that fails exactly when the
 * learner is deepest in the interface and needs it most.
 */
export const LAYER = {
  /** Full-screen dialogs: run results, method manager, debug inspector. */
  dialog: 9997,
  dialogAbove: 9998,
  dialogTop: 9999,
  /** The tutorial coach, always above every dialog. */
  coachDropHalo: 10_000,
  coachSpotlight: 10_001,
  coachPanel: 10_002,
} as const;
