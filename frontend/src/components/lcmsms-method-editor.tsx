"use client";

import { useEffect, useMemo, useState } from "react";

import { NumericField } from "@/components/numeric-field";

import {
  getMrmReferenceCatalog,
  proposeMrmTransitions,
  saveAcquisitionMethod,
} from "@/lib/api";
import {
  updateTransition,
  validateAcquisitionMethod,
} from "@/lib/acquisition-method-rules";
import type {
  AcquisitionMethod,
  MethodWarning,
  MrmTransition,
  ReferenceCompound,
} from "@/types/workbench";

type Props = {
  method: AcquisitionMethod;
  onMethodSaved: (method: AcquisitionMethod) => void;
};

type EditorMode = "simple" | "advanced";

const CALIBRATION_LEVELS_ERROR =
  "Calibration levels must be a list of positive numbers, separated by commas.";

/**
 * Read the ladder the user typed, or say why it cannot be read.
 *
 * The number of levels is whatever was typed — the exported method file gets
 * exactly that many concentration columns, and none at all when the field is
 * left empty. There is no default ladder to fall back on: the method declares
 * one or it declares nothing.
 */
function parseCalibrationLevels(text: string): number[] | null {
  const parts = text.split(/[,;\s]+/).filter((part) => part.length > 0);
  const levels = parts.map((part) => Number(part));
  if (levels.some((level) => !Number.isFinite(level) || level <= 0)) return null;
  return levels;
}

function formatCalibrationLevels(levels: number[]): string {
  return levels.join(", ");
}

export function LcMsMsMethodEditor({ method, onMethodSaved }: Props) {
  const [mode, setMode] = useState<EditorMode>("simple");
  const [name, setName] = useState(method.name);
  const [version, setVersion] = useState(method.version);
  const [transitions, setTransitions] = useState<MrmTransition[]>(method.transitions);
  const [calibrationLevelsText, setCalibrationLevelsText] = useState(
    formatCalibrationLevels(method.calibrationLevelsNgPerMl),
  );
  const [referenceCatalog, setReferenceCatalog] = useState<ReferenceCompound[]>([]);
  const [warnings, setWarnings] = useState<MethodWarning[]>([]);
  // Saving is otherwise entirely silent: the editor keeps showing the same
  // values, so nothing tells the learner the version was written.
  const [savedVersion, setSavedVersion] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // Reload the fields when the learner selects a *different* method — keyed on
  // the identity, not on the object. Saving hands the stored method back up and
  // the parent passes it down again; reacting to that round trip would reload
  // the fields from what was just written and wipe the save confirmation with
  // them, which reads as a flash and nothing else.
  useEffect(() => {
    setName(method.name);
    setVersion(method.version);
    setTransitions(method.transitions);
    setCalibrationLevelsText(formatCalibrationLevels(method.calibrationLevelsNgPerMl));
    setSavedVersion(null);
    setWarnings([]);
    setFailure(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method.id]);

  useEffect(() => {
    if (method.isBuiltIn) return;
    let isCurrent = true;
    getMrmReferenceCatalog()
      .then((catalog) => {
        if (isCurrent) setReferenceCatalog(catalog);
      })
      .catch(() => {
        if (isCurrent) setReferenceCatalog([]);
      });
    return () => {
      isCurrent = false;
    };
  }, [method.isBuiltIn]);

  const errors = useMemo(
    () => validateAcquisitionMethod({ name, version, runtimeS: method.runtimeS, transitions }),
    [method.runtimeS, name, transitions, version],
  );

  const selectedCompoundIds = useMemo(
    () => [...new Set(transitions.map((transition) => transition.compoundId))],
    [transitions],
  );

  /**
   * Add or remove one compound's channels, leaving every other channel alone.
   *
   * Asking the catalog to rebuild the whole list would silently overwrite any
   * value tuned in advanced mode — picking a compound would undo the previous
   * edit. Simple and advanced mode edit the same list, so neither may clobber
   * the other.
   */
  async function handleToggleCompound(compoundId: string, isSelected: boolean) {
    setFailure(null);
    if (isSelected) {
      setTransitions(
        transitions.filter((transition) => transition.compoundId !== compoundId),
      );
      return;
    }
    try {
      const proposed = await proposeMrmTransitions([compoundId]);
      setTransitions([...transitions, ...proposed]);
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "Failed to propose transitions.");
    }
  }

  async function handleSave() {
    if (errors.length > 0) return;
    const calibrationLevelsNgPerMl = parseCalibrationLevels(calibrationLevelsText);
    if (calibrationLevelsNgPerMl === null) {
      setFailure(CALIBRATION_LEVELS_ERROR);
      return;
    }
    setIsBusy(true);
    setFailure(null);
    try {
      const saved = await saveAcquisitionMethod(method.id, {
        calibrationLevelsNgPerMl,
        name,
        version,
        runtimeS: method.runtimeS,
        transitions,
      });
      setWarnings(saved.warnings);
      setSavedVersion(saved.method.version);
      onMethodSaved(saved.method);
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "Failed to save the method.");
    } finally {
      setIsBusy(false);
    }
  }

  if (method.isBuiltIn) {
    return (
      <section
        aria-label="Acquisition method editor"
        className="mt-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3"
        data-tutorial-anchor="method-editor-builtin-notice"
      >
        <p className="text-[11px] leading-relaxed text-slate-300">
          <span className="font-semibold text-slate-100">{method.name}</span> is a built-in
          method and cannot be edited. Use <em>Duplicate method</em> in the library to obtain
          an editable copy, change the copy, then save it as a new version.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="Acquisition method editor"
      className="mt-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-xs font-semibold text-slate-100">Edit method</h4>
        <div className="ml-auto flex gap-1">
          {(
            [
              ["simple", "Simple"],
              ["advanced", "Advanced"],
            ] as const
          ).map(([candidate, label]) => (
            <button
              className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
                mode === candidate
                  ? "bg-cyan-600 text-white"
                  : "border border-slate-700 text-slate-300 hover:bg-slate-800"
              }`}
              key={candidate}
              onClick={() => setMode(candidate)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="text-[10px] text-slate-400">
          Method name
          <input
            aria-label="Method name"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
            onChange={(event) => {
            setSavedVersion(null);
            setName(event.target.value);
          }}
            value={name}
          />
        </label>
        <label className="text-[10px] text-slate-400">
          Version
          <input
            aria-label="Version"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
            onChange={(event) => {
            setSavedVersion(null);
            setVersion(event.target.value);
          }}
            value={version}
          />
        </label>
      </div>

      <label className="mt-2 block text-[10px] text-slate-400">
        Calibration levels (ng/mL)
        <input
          aria-label="Calibration levels (ng/mL)"
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
          data-tutorial-anchor="method-editor-calibration-levels"
          onChange={(event) => {
            setSavedVersion(null);
            setCalibrationLevelsText(event.target.value);
          }}
          placeholder="e.g. 1, 2, 5, 10, 20"
          value={calibrationLevelsText}
        />
        <span className="mt-1 block leading-relaxed text-slate-500">
          Optional. The exported method file gets one concentration column per level,
          in this order. Leave empty to export no concentration column and fill them in
          yourself. Nothing checks these against the standards actually in the rack.
        </span>
      </label>

      {mode === "simple" ? (
        <div className="mt-3" data-testid="simple-mode-compounds">
          <p className="text-[10px] text-slate-400">
            Pick the compounds to target. The catalog proposes their known transitions.
          </p>
          <div className="mt-1.5 grid gap-1 sm:grid-cols-2">
            {referenceCatalog.map((compound) => {
              const isSelected = selectedCompoundIds.includes(compound.compoundId);
              return (
                <label
                  className="flex items-center gap-1.5 text-[11px] text-slate-200"
                  key={compound.compoundId}
                >
                  <input
                    aria-label={compound.compoundLabel}
                    checked={isSelected}
                    onChange={() => handleToggleCompound(compound.compoundId, isSelected)}
                    type="checkbox"
                  />
                  {compound.compoundLabel}
                </label>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {transitions.map((transition, index) => (
            <div
              className="rounded-lg border border-slate-800 bg-slate-950/60 p-2"
              data-testid="editor-transition-row"
              key={`${transition.id}-${index}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-200">
                  {transition.compoundLabel}
                </span>
                <span className="text-[9px] uppercase tracking-wide text-slate-500">
                  {transition.role}
                </span>
                <button
                  className="rounded border border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-300 hover:bg-slate-800"
                  onClick={() =>
                    setTransitions(transitions.filter((_, i) => i !== index))
                  }
                  type="button"
                >
                  Remove transition
                </button>
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {(
                  [
                    ["Q1 (m/z)", "q1Mz"],
                    ["Q3 (m/z)", "q3Mz"],
                    ["CE (V)", "collisionEnergyV"],
                    ["Dwell (ms)", "dwellTimeMs"],
                    ["RT (s)", "expectedRetentionTimeS"],
                    ["Window (s)", "retentionWindowS"],
                  ] as const
                ).map(([label, field]) => (
                  <NumericField
                    className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-1.5 py-1 font-mono text-[10px] text-white"
                    key={field}
                    label={label}
                    labelClassName="text-[9px] text-slate-400"
                    onChange={(next) =>
                      setTransitions(
                        updateTransition(transitions, index, { [field]: next }),
                      )
                    }
                    value={transition[field]}
                  />
                ))}
                <label className="text-[9px] text-slate-400">
                  Polarity
                  <select
                    aria-label="Polarity"
                    className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-[10px] text-white"
                    onChange={(event) =>
                      setTransitions(
                        updateTransition(transitions, index, {
                          polarity: event.target.value as MrmTransition["polarity"],
                        }),
                      )
                    }
                    value={transition.polarity}
                  >
                    <option value="positive">positive</option>
                    <option value="negative">negative</option>
                  </select>
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      {errors.length > 0 ? (
        <ul
          className="mt-3 space-y-0.5 rounded-lg bg-rose-950/40 p-2 text-[10px] text-rose-300"
          data-testid="method-errors"
        >
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}

      {warnings.length > 0 ? (
        <ul
          className="mt-2 space-y-0.5 rounded-lg bg-amber-950/40 p-2 text-[10px] text-amber-300"
          data-testid="method-warnings"
        >
          {warnings.map((warning) => (
            <li key={`${warning.code}-${warning.transitionId}`}>
              {warning.message} Saving is still allowed — run it and look at the trace.
            </li>
          ))}
        </ul>
      ) : null}

      {failure !== null ? (
        <p className="mt-2 text-[10px] text-rose-300">{failure}</p>
      ) : null}

      {/* Sticky: a method with two dozen transitions is a long scroll, and the
          action that commits it must not be buried at the far end of it. */}
      <div className="sticky bottom-0 z-10 -mx-3 -mb-3 mt-3 rounded-b-xl border-t border-slate-800 bg-slate-900/95 px-3 py-2 backdrop-blur">
      <button
        className="w-full rounded-full bg-cyan-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
        data-tutorial-anchor="method-editor-save"
        disabled={errors.length > 0 || isBusy}
        onClick={handleSave}
        type="button"
      >
        Save as new version
      </button>

      {savedVersion !== null ? (
        <p
          className="mt-2 rounded-lg border border-emerald-700/60 bg-emerald-950/40 px-2 py-1.5 text-[11px] text-emerald-300"
          data-testid="method-saved-confirmation"
          data-tutorial-anchor="method-editor-saved"
        >
          Saved as v{savedVersion}. Select it as the acquisition method in the console.
        </p>
      ) : null}
      </div>
    </section>
  );
}
