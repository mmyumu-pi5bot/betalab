"use client";

import { useEffect, useMemo, useState } from "react";

import {
  duplicateAcquisitionMethod,
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
  onMethodSelected: (methodId: string) => void;
};

type EditorMode = "simple" | "advanced";

function numberField(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function LcMsMsMethodEditor({ method, onMethodSaved, onMethodSelected }: Props) {
  const [mode, setMode] = useState<EditorMode>("simple");
  const [name, setName] = useState(method.name);
  const [version, setVersion] = useState(method.version);
  const [transitions, setTransitions] = useState<MrmTransition[]>(method.transitions);
  const [referenceCatalog, setReferenceCatalog] = useState<ReferenceCompound[]>([]);
  const [warnings, setWarnings] = useState<MethodWarning[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    setName(method.name);
    setVersion(method.version);
    setTransitions(method.transitions);
    setWarnings([]);
    setFailure(null);
  }, [method]);

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

  async function handleDuplicate() {
    setIsBusy(true);
    setFailure(null);
    try {
      const saved = await duplicateAcquisitionMethod({
        sourceMethodId: method.id,
        newMethodId: `${method.id}_copy`,
        name: `${method.name} (copy)`,
        version: "0.1.0",
      });
      onMethodSelected(saved.method.id);
      onMethodSaved(saved.method);
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "Failed to duplicate the method.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleToggleCompound(compoundId: string, isSelected: boolean) {
    const nextCompoundIds = isSelected
      ? selectedCompoundIds.filter((id) => id !== compoundId)
      : [...selectedCompoundIds, compoundId];
    setFailure(null);
    try {
      setTransitions(
        nextCompoundIds.length === 0 ? [] : await proposeMrmTransitions(nextCompoundIds),
      );
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "Failed to propose transitions.");
    }
  }

  async function handleSave() {
    if (errors.length > 0) return;
    setIsBusy(true);
    setFailure(null);
    try {
      const saved = await saveAcquisitionMethod(method.id, {
        name,
        version,
        runtimeS: method.runtimeS,
        transitions,
      });
      setWarnings(saved.warnings);
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
      >
        <p className="text-[11px] leading-relaxed text-slate-300">
          <span className="font-semibold text-slate-100">{method.name}</span> is a built-in
          method and cannot be edited. Duplicate it to obtain an editable copy, change the
          copy, then save it as a new version.
        </p>
        {failure !== null ? (
          <p className="mt-2 text-[10px] text-rose-300">{failure}</p>
        ) : null}
        <button
          className="mt-2 rounded-full bg-cyan-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-cyan-500 disabled:opacity-40"
          disabled={isBusy}
          onClick={handleDuplicate}
          type="button"
        >
          Duplicate method
        </button>
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
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </label>
        <label className="text-[10px] text-slate-400">
          Version
          <input
            aria-label="Version"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
            onChange={(event) => setVersion(event.target.value)}
            value={version}
          />
        </label>
      </div>

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
                  <label className="text-[9px] text-slate-400" key={field}>
                    {label}
                    <input
                      aria-label={label}
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-1.5 py-1 font-mono text-[10px] text-white"
                      onChange={(event) =>
                        setTransitions(
                          updateTransition(transitions, index, {
                            [field]: numberField(event.target.value, transition[field]),
                          }),
                        )
                      }
                      step="any"
                      type="number"
                      value={transition[field]}
                    />
                  </label>
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

      <button
        className="mt-3 rounded-full bg-cyan-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={errors.length > 0 || isBusy}
        onClick={handleSave}
        type="button"
      >
        Save as new version
      </button>
    </section>
  );
}
