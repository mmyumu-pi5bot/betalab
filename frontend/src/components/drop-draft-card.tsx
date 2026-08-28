"use client";

import { InlineQuantityInput } from "@/components/inline-quantity-input";
import { TemperatureIndicator } from "@/components/temperature-indicator";

//: The amount box of a dosing dialog. The tutorial coach retargets its spotlight
//: here whenever such a dialog is open, because by then the drag it was pointing
//: at has already happened and the only thing left to do is type and confirm.
export const dropDraftQuantityAnchor = "drop-draft-quantity";

//: The button that actually sends the dose. The coach spotlights it as a second
//: beat, once the amount in the box is the one the step asked for, so typing and
//: sending never read as a single move.
export const dropDraftConfirmAnchor = "drop-draft-confirm";

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

type DropDraftFormProps = Omit<DropDraftCardProps, "title"> & {
  showCancel?: boolean;
};

export function DropDraftForm({
  confirmLabel = "Add",
  fields,
  onCancel,
  onChangeField,
  onConfirm,
  showCancel = false,
}: DropDraftFormProps) {
  return (
    <div className="space-y-3">
      {fields.map((field, fieldIndex) => (
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
            <p className="min-w-0 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
              {field.label}
            </p>
            <div className="flex items-center gap-2">
              {field.visual === "temperature" ? (
                <TemperatureIndicator temperatureC={field.value} />
              ) : null}
              <InlineQuantityInput
                ariaLabel={field.ariaLabel}
                inputStep={field.inputStep ?? 0.1}
                // The coach spotlights the amount to type. Only the first field
                // claims the anchor: a card with several of them is walked from
                // the top, and two elements answering one anchor is ambiguous.
                tutorialAnchor={fieldIndex === 0 ? dropDraftQuantityAnchor : undefined}
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
      <div className="flex justify-end gap-2">
        {showCancel ? (
          <button className="text-[11px] font-semibold text-slate-500" onClick={onCancel} type="button">
            Cancel
          </button>
        ) : null}
        <button
          className="rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
          data-tutorial-anchor={dropDraftConfirmAnchor}
          onClick={onConfirm}
          type="button"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}

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
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <div className="mt-3">
        <DropDraftForm
          confirmLabel={confirmLabel}
          fields={fields}
          onCancel={onCancel}
          onChangeField={onChangeField}
          onConfirm={onConfirm}
          showCancel
        />
      </div>
    </div>
  );
}
