import type { ActionModeExperimentApi } from "@/hooks/use-action-mode";
import type { AnalyticalBalanceDndExperimentApi } from "@/hooks/use-analytical-balance-dnd";
import type { DropDraftExperimentApi } from "@/hooks/use-drop-draft";
import type { GrinderDndExperimentApi } from "@/hooks/use-grinder-dnd";
import type { GrossBalanceDndExperimentApi } from "@/hooks/use-gross-balance-dnd";
import type { RackDndExperimentApi } from "@/hooks/use-rack-dnd";
import type { TrashDndExperimentApi } from "@/hooks/use-trash-dnd";
import type { VortexDndExperimentApi } from "@/hooks/use-vortex-dnd";
import type { WorkbenchDndExperimentApi } from "@/hooks/use-workbench-dnd";
import type { WorkbenchHandlersExperimentApi } from "@/hooks/use-workbench-handlers";
import type { WorkspaceActionsExperimentApi } from "@/hooks/use-workspace-actions";
import type { WorkspaceDropExperimentApi } from "@/hooks/use-workspace-drop";

// Union of all mutation subsets required by consumer hooks.
// When adding a new consumer hook with its own *ExperimentApi type,
// add it here so lab-scene.tsx flatApi stays structurally checked.
export type FlatExperimentApi = ActionModeExperimentApi &
  AnalyticalBalanceDndExperimentApi &
  DropDraftExperimentApi &
  GrinderDndExperimentApi &
  GrossBalanceDndExperimentApi &
  RackDndExperimentApi &
  TrashDndExperimentApi &
  VortexDndExperimentApi &
  WorkbenchDndExperimentApi &
  WorkbenchHandlersExperimentApi &
  WorkspaceActionsExperimentApi &
  WorkspaceDropExperimentApi;
