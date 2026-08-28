import type {
  AnalyticalBalanceState,
  BenchSlot,
  ExperimentProduceLot,
  ExperimentWorkspaceWidget,
  BenchToolInstance,
  RackSlot,
  LimsReception,
  ProduceMaterialState,
  SpatulaState,
  PipetteState,
  TrashProduceLotEntry,
  TrashSampleLabelEntry,
  DropTargetType,
} from "@/types/workbench";

export type ExperimentWorkbench = {
  slots: BenchSlot[];
};

export type ExperimentRack = {
  allowedDropTargets: DropTargetType[];
  isDraggable: boolean;
  state: "available" | "loaded" | "locked" | "completed";
  slots: RackSlot[];
};

export type ExperimentTrash = {
  children: BenchToolInstance[];
  discardedFrom: Record<string, string>;
  produceLots: TrashProduceLotEntry[];
  sampleLabels: TrashSampleLabelEntry[];
};

export type ExperimentWorkspace = {
  produceBasketLots: ExperimentProduceLot[];
  widgets: ExperimentWorkspaceWidget[];
};

/** An entity named inside a journal message, with the id its label is keyed by. */
export type JournalRef = {
  kind: "tool" | "widget" | "slot" | "liquid" | "produce" | "text";
  id: string;
  text: string;
  index?: number | null;
};

export type JournalParam = string | number | JournalRef;

export type JournalEntry = {
  id: string;
  occurredAt: string;
  category: "system" | "manipulation" | "simulation" | "layout";
  severity: "info" | "warning" | "error";
  /** English wording, rendered by the backend. */
  message: string;
  /** What happened. Absent on entries recorded before the journal was structured. */
  code: string | null;
  params: Record<string, JournalParam>;
};

export type Experiment = {
  id: string;
  name: string;
  status: string;
  last_simulation_at: string;
  snapshot_version: number;
  workbench: ExperimentWorkbench;
  rack: ExperimentRack;
  trash: ExperimentTrash;
  workspace: ExperimentWorkspace;
  limsReception: LimsReception;
  limsEntries: LimsReception[];
  basketTools: BenchToolInstance[];
  produceMaterialStates?: ProduceMaterialState[];
  spatula: SpatulaState;
  pipette: PipetteState;
  analyticalBalance: AnalyticalBalanceState;
  journalEntries: JournalEntry[];
  audit_log: string[];
};

export type ExperimentListEntry = {
  id: string;
  name: string;
  status: string;
  last_simulation_at: string;
  snapshot_version: number;
  updated_at: string;
  /** The most recent journal line, structured so it can be shown in any language. */
  lastJournalEvent: {
    message: string;
    code: string | null;
    params: Record<string, JournalParam>;
  } | null;
  summary: {
    workbenchToolCount: number;
    rackToolCount: number;
    materialCount: number;
    runCount: number;
  };
};
