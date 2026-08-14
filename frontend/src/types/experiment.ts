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
  audit_log: string[];
};

export type ExperimentListEntry = {
  id: string;
  name: string;
  status: string;
  last_simulation_at: string;
  snapshot_version: number;
  updated_at: string;
  last_audit_entry: string | null;
  summary: {
    workbenchToolCount: number;
    rackToolCount: number;
    materialCount: number;
    runCount: number;
  };
};
