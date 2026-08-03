"use client";

import { useMemo } from "react";

import type {
  AcquisitionSequenceLinePayload,
  RunSequencePayload,
} from "@/types/api-payloads";
import type { BenchToolInstance, RackSlot } from "@/types/workbench";

const METHOD_ID = "apple_pesticides_mrm_v1" as const;

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
      const isCalibration = slot.tool.calibrationContext !== null && slot.tool.calibrationContext !== undefined;
      return {
        rack_slot_id: slot.id,
        sample_name: name,
        sample_type: isCalibration ? "calibration" : "sample",
        calibration_level_ng_per_ml: isCalibration
          ? slot.tool.calibrationContext?.levelNgPerMl ?? null
          : null,
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

export function validateLines(lines: AcquisitionSequenceLinePayload[]): string | null {
  const calibrationCount = lines.filter((line) => line.sample_type === "calibration").length;
  const sampleCount = lines.filter((line) => line.sample_type === "sample").length;
  if (lines.length !== 2 || calibrationCount !== 1 || sampleCount !== 1) {
    return "Step one requires exactly one calibration and one sample.";
  }
  if (lines.some((line) => !line.sample_name.trim())) {
    return "Every line needs a sample name.";
  }
  if (
    lines.some(
      (line) =>
        line.sample_type === "calibration" &&
        (line.calibration_level_ng_per_ml === null || line.calibration_level_ng_per_ml <= 0),
    )
  ) {
    return "The calibration line needs a positive level.";
  }
  if (lines.some((line) => line.injection_volume_ul <= 0 || line.injection_volume_ul > 100)) {
    return "Injection volume must be between 0 and 100 µL.";
  }
  if (lines.some((line) => line.repetitions < 1 || line.repetitions > 10)) {
    return "Repetitions must be between 1 and 10.";
  }
  if (lines.some((line) => !line.output_filename.trim().toLowerCase().endsWith(".mzml"))) {
    return "Every output filename must end with .mzML.";
  }
  const filenames = lines.flatMap((line) =>
    Array.from({ length: line.repetitions }, (_, index) =>
      replicateFilename(line.output_filename.trim(), index + 1, line.repetitions).toLowerCase(),
    ),
  );
  if (new Set(filenames).size !== filenames.length) {
    return "Output filenames must be unique.";
  }
  return null;
}

export function LcMsMsAcquisitionConsole({
  isCommandPending,
  onRun,
  onSequenceChange,
  sequence,
}: Props) {
  const lines = sequence.injections;
  const validationMessage = useMemo(() => validateLines(lines), [lines]);

  function updateLine(index: number, patch: Partial<AcquisitionSequenceLinePayload>) {
    onSequenceChange({
      ...sequence,
      injections: lines.map((line, lineIndex) =>
        lineIndex === index
          ? {
              ...line,
              ...patch,
              calibration_level_ng_per_ml:
                patch.sample_type === "sample"
                  ? null
                  : patch.calibration_level_ng_per_ml ?? line.calibration_level_ng_per_ml,
            }
          : line,
      ),
    });
  }

  return (
    <div
      aria-label="LC-MS/MS acquisition console"
      className="mt-4 rounded-2xl border border-slate-700 bg-slate-950 p-4 text-slate-100 shadow-2xl"
      role="dialog"
    >
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
          Acquisition console
        </p>
        <h3 className="mt-1 text-sm font-semibold">Sequence setup</h3>
      </div>

      <label className="mt-4 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        Acquisition method
        <input
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-xs text-cyan-200 disabled:opacity-100"
          disabled
          value={METHOD_ID}
        />
      </label>

      <div className="mt-4 space-y-3">
        {lines.map((line, index) => (
          <div
            className="rounded-xl border border-slate-800 bg-slate-900/80 p-3"
            data-testid="acquisition-sequence-row"
            key={line.rack_slot_id}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-cyan-200">
                Position {rackPosition({ id: line.rack_slot_id } as RackSlot)}
              </span>
              <span className="font-mono text-[10px] text-slate-500">{line.rack_slot_id}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-[10px] text-slate-400">
                Sample name
                <input
                  aria-label="Sample name"
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                  onChange={(event) => updateLine(index, { sample_name: event.target.value })}
                  value={line.sample_name}
                />
              </label>
              <label className="text-[10px] text-slate-400">
                Type
                <select
                  aria-label="Type"
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                  onChange={(event) =>
                    updateLine(index, {
                      sample_type: event.target.value as AcquisitionSequenceLinePayload["sample_type"],
                    })
                  }
                  value={line.sample_type}
                >
                  <option value="calibration">Calibration</option>
                  <option value="sample">Sample</option>
                </select>
              </label>
              <label className="text-[10px] text-slate-400">
                Calibration level (ng/mL)
                <input
                  aria-label="Calibration level (ng/mL)"
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white disabled:text-slate-600"
                  disabled={line.sample_type !== "calibration"}
                  min="0.001"
                  onChange={(event) =>
                    updateLine(index, {
                      calibration_level_ng_per_ml:
                        event.target.value === "" ? null : Number(event.target.value),
                    })
                  }
                  step="any"
                  type="number"
                  value={line.calibration_level_ng_per_ml ?? ""}
                />
              </label>
              <label className="text-[10px] text-slate-400">
                Injection volume (µL)
                <input
                  aria-label="Injection volume (µL)"
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                  min="0.1"
                  onChange={(event) => updateLine(index, { injection_volume_ul: Number(event.target.value) })}
                  step="0.1"
                  type="number"
                  value={line.injection_volume_ul}
                />
              </label>
              <label className="text-[10px] text-slate-400">
                Repetitions
                <input
                  aria-label="Repetitions"
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                  max="10"
                  min="1"
                  onChange={(event) => updateLine(index, { repetitions: Number(event.target.value) })}
                  type="number"
                  value={line.repetitions}
                />
              </label>
              <label className="text-[10px] text-slate-400">
                Output filename
                <input
                  aria-label="Output filename"
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
          {validationMessage ?? "Sequence ready: one calibration and one sample."}
        </p>
        <button
          className="shrink-0 rounded-full bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={validationMessage !== null || isCommandPending}
          onClick={onRun}
          type="button"
        >
          Launch acquisition
        </button>
      </div>
    </div>
  );
}
