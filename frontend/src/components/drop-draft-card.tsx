"use client";

import { InlineQuantityInput } from "@/components/inline-quantity-input";
import { TemperatureIndicator } from "@/components/temperature-indicator";

export type DropDraftField = {
  ariaLabel: string;
  id: string;
  inputStep?: number;
  label: string;
  minValue?: number;
  presets?: number[];
  stepAmount: number;
  unitLabel: string;
  value: number;
  visual?: "temperature";
  wheelStep?: number;
};

type DropDraftCardProps = {
  confirmLabel?: string;
  fields: DropDraftField[];
  onCancel: () => void;
  onChangeField: (fieldId: string, value: number) => void;
  onConfirm: () => void;
  title: string;
};

export function DropDraftCard({
  confirmLabel = "Add",
  fields,
  onCancel,
  onChangeField,
  onConfirm,
  title,
}: DropDraftCardProps) {
  return (
    <div className="rounded-[1rem] border border-sky-200 bg-sky-50/80 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
        </div>
        <button
          className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>
      <div className="mt-3 space-y-3">
        {fields.map((field) => (
          <div key={field.id} className="space-y-1.5">
            {field.presets && field.presets.length > 0 ? (
              <div className="flex flex-wrap justify-end gap-0.5">
                {field.presets.map((preset) => (
                  <button
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold transition ${
                      field.value === preset
                        ? "border-slate-700 bg-slate-700 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                    }`}
                    key={preset}
                    onClick={() => onChangeField(field.id, preset)}
                    type="button"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                  {field.label}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {field.visual === "temperature" ? (
                  <TemperatureIndicator temperatureC={field.value} />
                ) : null}
                <InlineQuantityInput
                  ariaLabel={field.ariaLabel}
                  inputStep={field.inputStep ?? 0.1}
                  onChange={(nextValue) => {
                    onChangeField(field.id, Math.max(nextValue, field.minValue ?? 0));
                  }}
                  unitLabel={field.unitLabel}
                  value={field.value}
                  wheelStep={field.wheelStep ?? field.stepAmount}
                />
              </div>
            </div>
          </div>
        ))}
        <div className="flex justify-end">
          <button
            className="rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
