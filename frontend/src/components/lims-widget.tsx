"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { SampleIdentityLabel } from "@/components/sample-identity-label";
import { WorkspaceEquipmentWidget } from "@/components/workspace-equipment-widget";
import type { LimsReception, PrintedLabelTicket } from "@/types/workbench";

type LimsWidgetProps = {
  entries: LimsReception[];
  headerAction?: ReactNode;
  onSaveReception: (payload: {
    entry_id?: string;
    harvest_date: string;
    indicative_mass_g: number;
    measured_sample_mass_g: number | null;
    orchard_name: string;
  }) => void;
  onPrintLabel: (entryId?: string) => void;
  onTicketDragEnd?: () => void;
  onTicketDragStart?: (ticket: PrintedLabelTicket, dataTransfer: DataTransfer) => void;
  reception: LimsReception;
};

export function LimsWidget({
  entries,
  headerAction,
  onSaveReception,
  onPrintLabel,
  onTicketDragEnd,
  onTicketDragStart,
  reception,
}: LimsWidgetProps) {
  const [selectedEntryId, setSelectedEntryId] = useState<string>(reception.id ?? "new");
  const [orchardName, setOrchardName] = useState("");
  const [harvestDate, setHarvestDate] = useState("");
  const [indicativeMassText, setIndicativeMassText] = useState("");
  const [measuredSampleMassText, setMeasuredSampleMassText] = useState("");
  const previousReceptionIdRef = useRef<string | null>(reception.id);
  const selectedEntryIdRef = useRef<string>(reception.id ?? "new");

  const selectedEntry =
    selectedEntryId === "new"
      ? null
      : entries.find((entry) => entry.id === selectedEntryId) ?? null;
  const selectedEntryView =
    selectedEntry && selectedEntry.id === reception.id
      ? { ...selectedEntry, ...reception }
      : selectedEntry;
  const selectedEntryOrchardName = selectedEntryView?.orchardName ?? null;
  const selectedEntryHarvestDate = selectedEntryView?.harvestDate ?? null;
  const selectedEntryIndicativeMassG = selectedEntryView?.indicativeMassG ?? null;
  const selectedEntryMeasuredSampleMassG = selectedEntryView?.measuredSampleMassG ?? null;
  const hasSelectedEntryView = selectedEntryView !== null;
  const loadFormFromEntry = useCallback((entry: LimsReception | null) => {
    if (entry === null) {
      setOrchardName("");
      setHarvestDate("");
      setIndicativeMassText("");
      setMeasuredSampleMassText("");
      return;
    }

    setOrchardName(entry.orchardName ?? "");
    setHarvestDate(entry.harvestDate ?? "");
    setIndicativeMassText(
      entry.indicativeMassG !== null && entry.indicativeMassG > 0
        ? entry.indicativeMassG.toFixed(1)
        : "",
    );
    setMeasuredSampleMassText(
      entry.measuredSampleMassG !== null ? entry.measuredSampleMassG.toFixed(3) : "",
    );
  }, []);

  useEffect(() => {
    if (reception.id !== previousReceptionIdRef.current) {
      previousReceptionIdRef.current = reception.id;
      if (reception.id && entries.some((entry) => entry.id === reception.id)) {
        selectedEntryIdRef.current = reception.id;
        setSelectedEntryId(reception.id);
        return;
      }
    }
  }, [entries, reception.id]);

  useEffect(() => {
    if (selectedEntryId !== "new" && !entries.some((entry) => entry.id === selectedEntryId)) {
      selectedEntryIdRef.current = "new";
      setSelectedEntryId("new");
      return;
    }

    if (entries.length === 0 && reception.id === null && selectedEntryId !== "new") {
      selectedEntryIdRef.current = "new";
      setSelectedEntryId("new");
    }
  }, [entries, reception.id, selectedEntryId]);

  useEffect(() => {
    if (hasSelectedEntryView) {
      setOrchardName(selectedEntryOrchardName ?? "");
      setHarvestDate(selectedEntryHarvestDate ?? "");
      setIndicativeMassText(
        selectedEntryIndicativeMassG !== null && selectedEntryIndicativeMassG > 0
          ? selectedEntryIndicativeMassG.toFixed(1)
          : "",
      );
      setMeasuredSampleMassText(
        selectedEntryMeasuredSampleMassG !== null
          ? selectedEntryMeasuredSampleMassG.toFixed(3)
          : "",
      );
      return;
    }

    if (selectedEntryId === "new") {
      setOrchardName("");
      setHarvestDate("");
      setIndicativeMassText("");
      setMeasuredSampleMassText("");
    }
  }, [
    hasSelectedEntryView,
    selectedEntryHarvestDate,
    selectedEntryId,
    selectedEntryIndicativeMassG,
    selectedEntryMeasuredSampleMassG,
    selectedEntryOrchardName,
  ]);

  const indicativeMassValue = Number.parseFloat(indicativeMassText);
  const measuredSampleMassValue = Number.parseFloat(measuredSampleMassText);
  const hasIndicativeMass =
    Number.isFinite(indicativeMassValue) && indicativeMassValue > 0;
  const hasMeasuredSampleMass =
    Number.isFinite(measuredSampleMassValue) && measuredSampleMassValue > 0;
  const formatIndicativeMass = (massG: number) =>
    Number.isInteger(massG) ? `${massG.toFixed(0)} g` : `${massG.toFixed(1)} g`;
  const formatMeasuredSampleMass = (massG: number) => `${massG.toFixed(3)} g`;
  const canCreateReception =
    orchardName.trim().length > 0 &&
    harvestDate.trim().length > 0 &&
    hasIndicativeMass;
  const canPrintLabel =
    selectedEntryView?.labSampleCode !== null &&
    selectedEntryView !== null &&
    reception.printedLabelTicket === null;
  const isEmptyState =
    selectedEntryView === null;
  const displayedEntry = selectedEntryView ?? reception;
  const displayedTicket = selectedEntryView?.printedLabelTicket ?? reception.printedLabelTicket;
  const saveButtonLabel = selectedEntryView === null ? "Create LIMS record" : "Update LIMS record";

  return (
    <WorkspaceEquipmentWidget
      bodyClassName="px-3 py-4"
      eyebrow="LIMS"
      headerAction={headerAction}
    >
      <div className="space-y-2.5">
        <div className="overflow-hidden rounded-[1.4rem] border border-slate-300 bg-[linear-gradient(180deg,#d8dee5,#c2ccd6)] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
          <div className="rounded-t-[1.4rem] border-b border-slate-300 bg-[linear-gradient(180deg,#f8fafc,#e2e8f0)] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                LIMS terminal
              </p>
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
              </div>
            </div>
          </div>
          <div className="bg-[linear-gradient(180deg,#0f172a,#16233a)] px-3 py-3">
            <svg
              aria-label="LIMS terminal screen"
              className="h-[14.25rem] w-full rounded-[1rem] border border-sky-400/25 bg-[#07111f] shadow-[inset_0_0_0_1px_rgba(125,211,252,0.06)]"
              viewBox="0 0 360 228"
            >
              <rect x="0" y="0" width="360" height="228" rx="18" fill="#07111f" />
              <rect x="18" y="18" width="324" height="28" rx="8" fill="#0d1b2d" />
              <circle cx="34" cy="32" r="4" fill="#22c55e" />
              <text x="52" y="36" fill="#7dd3fc" fontSize="13" fontFamily="monospace">
                sample_login.exe
              </text>
              {isEmptyState ? (
                <>
                  <text x="28" y="78" fill="#e2e8f0" fontSize="15" fontFamily="monospace">
                    Awaiting accession
                  </text>
                  <text x="28" y="104" fill="#7dd3fc" fontSize="12" fontFamily="monospace">
                    Enter sample details and the precise sample mass.
                  </text>
                  <text x="28" y="136" fill="#94a3b8" fontSize="12" fontFamily="monospace">
                    Orchard: --
                  </text>
                  <text x="28" y="156" fill="#94a3b8" fontSize="12" fontFamily="monospace">
                    Harvest date: --
                  </text>
                  <text x="28" y="176" fill="#94a3b8" fontSize="12" fontFamily="monospace">
                    Indicative mass: --
                  </text>
                  <text x="28" y="196" fill="#94a3b8" fontSize="12" fontFamily="monospace">
                    Sample mass: --
                  </text>
                  <text x="28" y="212" fill="#38bdf8" fontSize="12" fontFamily="monospace">
                    Status: waiting for user entry
                  </text>
                </>
              ) : (
                <>
                  <text x="28" y="78" fill="#e2e8f0" fontSize="15" fontFamily="monospace">
                    Reception record
                  </text>
                  <text x="28" y="106" fill="#7dd3fc" fontSize="12" fontFamily="monospace">
                    Orchard: {displayedEntry.orchardName || orchardName || "--"}
                  </text>
                  <text x="28" y="126" fill="#7dd3fc" fontSize="12" fontFamily="monospace">
                    Harvest date: {displayedEntry.harvestDate || harvestDate || "--"}
                  </text>
                  <text x="28" y="146" fill="#7dd3fc" fontSize="12" fontFamily="monospace">
                    Indicative mass: {displayedEntry.indicativeMassG > 0 ? formatIndicativeMass(displayedEntry.indicativeMassG) : hasIndicativeMass ? formatIndicativeMass(indicativeMassValue) : "--"}
                  </text>
                  <text x="28" y="166" fill="#7dd3fc" fontSize="12" fontFamily="monospace">
                    Sample mass: {displayedEntry.measuredSampleMassG !== null
                      ? formatMeasuredSampleMass(displayedEntry.measuredSampleMassG)
                      : hasMeasuredSampleMass
                        ? formatMeasuredSampleMass(measuredSampleMassValue)
                        : "--"}
                  </text>
                  <text x="28" y="186" fill="#7dd3fc" fontSize="12" fontFamily="monospace">
                    Sample code: {displayedEntry.labSampleCode ?? "--"}
                  </text>
                  <text x="28" y="206" fill="#22c55e" fontSize="11" fontFamily="monospace">
                    Status: {displayedEntry.status}
                  </text>
                </>
              )}
            </svg>
          </div>
          <div className="border-t border-slate-300 bg-[linear-gradient(180deg,#c9d2dc,#b6c2cd)] px-4 py-3">
            <div className="flex items-end justify-between gap-4">
              <div className="h-5 w-20 rounded-t-[0.7rem] border border-slate-400/80 border-b-0 bg-[linear-gradient(180deg,#e2e8f0,#cbd5e1)] px-2 pt-1">
                {displayedTicket ? (
                  <div
                    className="h-6 w-14 rounded-[0.35rem] border border-slate-300 bg-white shadow-[0_2px_4px_rgba(15,23,42,0.12)]"
                    data-testid="lims-printer-ticket"
                  />
                ) : null}
              </div>
              <div className="h-3.5 w-28 rounded-full border border-slate-400/80 bg-[linear-gradient(180deg,#94a3b8,#64748b)]" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="col-span-2 grid gap-1">
            <span className="text-xs font-medium text-slate-600">Record</span>
            <select
              className="rounded-[0.8rem] border border-slate-300 bg-white px-3 py-1.5 text-[13px] text-slate-900 outline-none ring-0 focus:border-sky-400"
              onChange={(event) => {
                const nextEntryId = event.target.value;
                const nextEntry =
                  nextEntryId === "new"
                    ? null
                    : entries.find((entry) => entry.id === nextEntryId) ?? null;
                selectedEntryIdRef.current = nextEntryId;
                setSelectedEntryId(nextEntryId);
                loadFormFromEntry(nextEntry);
              }}
              value={selectedEntryId}
            >
              <option value="new">New entry</option>
              {entries.map((entry) => (
                <option key={entry.id ?? entry.labSampleCode} value={entry.id ?? ""}>
                  {entry.labSampleCode ?? "Unnumbered entry"}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 rounded-[0.9rem] border border-slate-200 bg-white/85 px-2.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            <span className="text-xs font-medium text-slate-600">Orchard / producer</span>
            <input
              className="rounded-[0.8rem] border border-slate-300 bg-white px-3 py-1.5 text-[13px] text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-sky-400"
              onChange={(event) => setOrchardName(event.target.value)}
              placeholder="Enter orchard or producer"
              type="text"
              value={orchardName}
            />
          </label>
          <label className="grid gap-1 rounded-[0.9rem] border border-slate-200 bg-white/85 px-2.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            <span className="text-xs font-medium text-slate-600">Harvest date</span>
            <input
              className="rounded-[0.8rem] border border-slate-300 bg-white px-3 py-1.5 text-[13px] text-slate-900 outline-none ring-0 focus:border-sky-400"
              onChange={(event) => setHarvestDate(event.target.value)}
              type="date"
              value={harvestDate}
            />
          </label>
          <label className="grid gap-1 rounded-[0.9rem] border border-slate-200 bg-white/85 px-2.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            <span className="text-xs font-medium text-slate-600">Indicative field mass (g)</span>
            <input
              className="rounded-[0.8rem] border border-slate-300 bg-white px-3 py-1.5 text-[13px] text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-sky-400"
              inputMode="decimal"
              min="0"
              onChange={(event) => setIndicativeMassText(event.target.value)}
              placeholder="2500"
              step="0.1"
              type="number"
              value={indicativeMassText}
            />
          </label>
          <label className="grid gap-1 rounded-[0.9rem] border border-slate-200 bg-white/85 px-2.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            <span className="text-xs font-medium text-slate-600">Sample mass (g)</span>
            <input
              className="rounded-[0.8rem] border border-slate-300 bg-white px-3 py-1.5 text-[13px] text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-sky-400"
              inputMode="decimal"
              min="0"
              onChange={(event) => setMeasuredSampleMassText(event.target.value)}
              placeholder="10.000"
              step="0.001"
              type="number"
              value={measuredSampleMassText}
            />
          </label>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-full bg-slate-950 px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-40"
            disabled={!canCreateReception}
            onClick={() =>
              onSaveReception({
                ...(selectedEntry ? { entry_id: selectedEntry.id ?? undefined } : {}),
                harvest_date: harvestDate,
                indicative_mass_g: indicativeMassValue,
                measured_sample_mass_g: hasMeasuredSampleMass ? measuredSampleMassValue : null,
                orchard_name: orchardName,
              })
            }
            type="button"
          >
            {saveButtonLabel}
          </button>
          <button
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-800 disabled:opacity-40"
            disabled={!canPrintLabel}
            onClick={() =>
              onPrintLabel(
                selectedEntryIdRef.current !== "new" ? selectedEntryIdRef.current : undefined,
              )
            }
            type="button"
          >
            Print label
          </button>
        </div>
        {displayedTicket ? (
          <div
            className={`${displayedTicket.isDraggable ?? true ? "cursor-grab" : "cursor-default opacity-70"} rounded-[0.9rem] border border-dashed border-sky-300 bg-sky-50 px-3 py-1.5`.trim()}
            data-testid="lims-printed-ticket"
            draggable={displayedTicket.isDraggable ?? true}
            onDragEnd={onTicketDragEnd}
            onDragStart={(event) => {
              onTicketDragStart?.(displayedTicket, event.dataTransfer);
            }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Printed ticket
            </p>
            <div className="mt-1">
              <SampleIdentityLabel
                receivedDate={displayedTicket.receivedDate}
                sampleCode={displayedTicket.sampleCode}
                variant="ticket"
              />
            </div>
          </div>
        ) : null}
      </div>
    </WorkspaceEquipmentWidget>
  );
}
