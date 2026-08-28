"use client";

import { useCallback, useMemo, useState } from "react";

import { LcMsMsMethodManager } from "@/components/lcmsms-method-manager";
import { NumericField } from "@/components/numeric-field";
import {
  useAcquisitionMethodCatalog,
  useAcquisitionMethodDetail,
} from "@/hooks/use-acquisition-method";
import { formatDuration } from "@/lib/acquisition-method-format";
import type {
  AcquisitionSequenceLinePayload,
  RunSequencePayload,
} from "@/types/api-payloads";
import type { BenchToolInstance, RackSlot } from "@/types/workbench";
import { useI18n, type MessageKey } from "@/lib/i18n";

const METHOD_ID = "apple_pesticides_mrm_v1";

type Props = {
  isCommandPending: boolean;
  onRun: () => void;
  onSequenceChange: (payload: RunSequencePayload) => void;
  sequence: RunSequencePayload;
};

function rackPosition(slot: RackSlot): number {
  const match = slot.id.match(/(\d+)$/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function sampleName(tool: BenchToolInstance): string {
  return tool.fieldLabelText?.trim() || tool.labels?.find((label) => label.text.trim())?.text || tool.label;
}

function safeFilenamePart(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return normalized || "injection";
}

function buildInitialLines(rackSlots: RackSlot[]): AcquisitionSequenceLinePayload[] {
  return rackSlots
    .filter((slot): slot is RackSlot & { tool: BenchToolInstance } => slot.tool !== null)
    .sort((left, right) => rackPosition(left) - rackPosition(right))
    .map((slot) => {
      const name = sampleName(slot.tool);
      return {
        rack_slot_id: slot.id,
        sample_name: name,
        injection_volume_ul: 5,
        repetitions: 1,
        output_filename: `${String(rackPosition(slot)).padStart(2, "0")}_${safeFilenamePart(name)}.mzML`,
      };
    });
}

export function buildDefaultRunSequencePayload(rackSlots: RackSlot[]): RunSequencePayload {
  return { method_id: METHOD_ID, injections: buildInitialLines(rackSlots) };
}

function replicateFilename(filename: string, replicateIndex: number, repetitions: number): string {
  if (repetitions === 1) return filename;
  return `${filename.slice(0, -5)}_r${replicateIndex}.mzML`;
}

// Returns the catalogue key of the first rule the sequence breaks, so callers
// render the complaint in the language the learner is working in.
export function validateLines(lines: AcquisitionSequenceLinePayload[]): MessageKey | null {
  if (lines.length === 0) {
    return "console.validation.noVial";
  }
  const slotIds = lines.map((line) => line.rack_slot_id);
  if (new Set(slotIds).size !== slotIds.length) {
    return "console.validation.duplicatePosition";
  }
  if (lines.some((line) => !line.sample_name.trim())) {
    return "console.validation.missingSampleName";
  }
  if (lines.some((line) => line.injection_volume_ul <= 0 || line.injection_volume_ul > 100)) {
    return "console.validation.injectionVolume";
  }
  if (lines.some((line) => line.repetitions < 1 || line.repetitions > 10)) {
    return "console.validation.repetitions";
  }
  if (lines.some((line) => !line.output_filename.trim().toLowerCase().endsWith(".mzml"))) {
    return "console.validation.filenameExtension";
  }
  const filenames = lines.flatMap((line) =>
    Array.from({ length: line.repetitions }, (_, index) =>
      replicateFilename(line.output_filename.trim(), index + 1, line.repetitions).toLowerCase(),
    ),
  );
  if (new Set(filenames).size !== filenames.length) {
    return "console.validation.filenameUnique";
  }
  return null;
}

export function LcMsMsAcquisitionConsole({
  isCommandPending,
  onRun,
  onSequenceChange,
  sequence,
}: Props) {
  const { t, tn } = useI18n();
  const lines = sequence.injections;
  const validationMessage = useMemo(() => validateLines(lines), [lines]);
  const [isMethodManagerOpen, setIsMethodManagerOpen] = useState(false);
  // Shared cache-busting counter: writes in the manager must reach the console.
  const [methodRevision, setMethodRevision] = useState(0);
  const bumpMethodRevision = useCallback(
    () => setMethodRevision((revision) => revision + 1),
    [],
  );
  // The method belongs to the sequence, never to the vials sitting in the rack.
  const catalog = useAcquisitionMethodCatalog(methodRevision);
  const {
    error: methodError,
    isLoading: isMethodLoading,
    method,
  } = useAcquisitionMethodDetail(sequence.method_id, methodRevision);
  const compoundCount = useMemo(
    () =>
      method === null
        ? 0
        : new Set(method.transitions.map((transition) => transition.compoundId)).size,
    [method],
  );

  function updateLine(index: number, patch: Partial<AcquisitionSequenceLinePayload>) {
    onSequenceChange({
      ...sequence,
      injections: lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    });
  }

  return (
    <div
      aria-label={t("console.title")}
      className="mt-4 rounded-2xl border border-slate-700 bg-slate-950 p-4 text-slate-100 shadow-2xl"
      role="dialog"
    >
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
          {t("console.eyebrow")}
        </p>
        <h3 className="mt-1 text-sm font-semibold">{t("console.sequenceSetup")}</h3>
      </div>

      <label className="mt-4 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {t("console.acquisitionMethod")}
        <select
          aria-label={t("console.acquisitionMethod")}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-xs text-cyan-200"
          data-tutorial-anchor="console-method-select"
          data-tutorial-declared-levels={method?.calibrationLevelsNgPerMl.length ?? 0}
          // The count alone cannot say whether the ladder describes the vials in
          // the rack, and the tutorial has to know before it lets a run start.
          data-tutorial-declared-level-values={
            method?.calibrationLevelsNgPerMl.join(", ") ?? ""
          }
          onChange={(event) =>
            onSequenceChange({ ...sequence, method_id: event.target.value })
          }
          value={sequence.method_id}
        >
          {catalog.length === 0 ? (
            <option value={sequence.method_id}>{sequence.method_id}</option>
          ) : (
            catalog.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name} — v{entry.version}
              </option>
            ))
          )}
        </select>
      </label>

      <div
        className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-2.5"
        data-testid="method-summary"
      >
        <div className="min-w-0">
          {methodError !== null ? (
            <p className="text-[11px] text-rose-300">{methodError}</p>
          ) : method === null ? (
            <p className="text-[11px] text-slate-400">
              {isMethodLoading ? t("method.loading") : t("console.noMethodLoaded")}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-100">{method.name}</span>
                <span className="font-mono text-[10px] text-cyan-300">v{method.version}</span>
                {method.isEducational ? (
                  <span
                    className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-300"
                    data-testid="method-educational-badge"
                  >
                    {t("method.educational")}
                  </span>
                ) : null}
                {method.isBuiltIn ? (
                  <span className="rounded-full border border-slate-700 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-slate-400">
                    {t("console.builtIn")}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 font-mono text-[10px] text-slate-500">
                {t("console.methodSummary", {
                  compounds: compoundCount,
                  transitions: method.transitions.length,
                  runtime: formatDuration(method.runtimeS),
                })}
              </p>
            </>
          )}
        </div>
        <button
          className="shrink-0 rounded-full border border-slate-700 px-3 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-slate-800"
          data-tutorial-anchor="instrument-manage-methods"
          onClick={() => setIsMethodManagerOpen(true)}
          type="button"
        >
          {t("console.manageMethods")}
        </button>
      </div>

      {isMethodManagerOpen ? (
        <LcMsMsMethodManager
          catalog={catalog}
          onClose={() => setIsMethodManagerOpen(false)}
          onLibraryChanged={bumpMethodRevision}
          onMethodSelected={(methodId) =>
            onSequenceChange({ ...sequence, method_id: methodId })
          }
          revision={methodRevision}
          selectedMethodId={sequence.method_id}
        />
      ) : null}

      <div className="mt-4 space-y-3">
        {lines.map((line, index) => (
          <div
            className="rounded-xl border border-slate-800 bg-slate-900/80 p-3"
            data-testid="acquisition-sequence-row"
            key={line.rack_slot_id}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-cyan-200">
                {t("console.position", {
                  position: rackPosition({ id: line.rack_slot_id } as RackSlot),
                })}
              </span>
              <span className="font-mono text-[10px] text-slate-500">{line.rack_slot_id}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-[10px] text-slate-400">
                {t("console.sampleName")}
                <input
                  aria-label={t("console.sampleName")}
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                  onChange={(event) => updateLine(index, { sample_name: event.target.value })}
                  value={line.sample_name}
                />
              </label>
              <NumericField
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                label={t("console.injectionVolume")}
                labelClassName="text-[10px] text-slate-400"
                onChange={(next) => updateLine(index, { injection_volume_ul: next })}
                value={line.injection_volume_ul}
              />
              <NumericField
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                label={t("console.repetitions")}
                labelClassName="text-[10px] text-slate-400"
                onChange={(next) => updateLine(index, { repetitions: next })}
                value={line.repetitions}
              />
              <label className="text-[10px] text-slate-400">
                {t("console.outputFilename")}
                <input
                  aria-label={t("console.outputFilename")}
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs text-white"
                  onChange={(event) => updateLine(index, { output_filename: event.target.value })}
                  value={line.output_filename}
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <p className={`text-xs ${validationMessage ? "text-amber-300" : "text-emerald-300"}`}>
          {validationMessage ? t(validationMessage) : tn("console.ready", lines.length)}
        </p>
        <button
          className="shrink-0 rounded-full bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={validationMessage !== null || isCommandPending}
          data-tutorial-anchor="instrument-launch"
          onClick={onRun}
          type="button"
        >
          {t("console.launch")}
        </button>
      </div>
    </div>
  );
}
