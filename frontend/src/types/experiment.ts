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
  TrashProduceLotEntry,
  TrashSampleLabelEntry,
} from "@/types/workbench";

export type ExperimentWorkbench = {
  slots: BenchSlot[];
};

export type ExperimentRack = {
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

export type Experiment = {
  id: string;
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
  analyticalBalance: AnalyticalBalanceState;
  audit_log: string[];
};

export type ExperimentListEntry = {
  id: string;
  status: string;
  last_simulation_at: string;
  snapshot_version: number;
  updated_at: string;
  last_audit_entry: string | null;
};
