import type { BenchToolInstance } from "@/types/workbench";

type WorkspaceActionsExperimentApi = {
  closeAnalyticalBalanceTool: () => void;
  closeGrossBalanceTool: () => void;
  createLimsReception: (payload: {
    entry_id?: string;
    harvest_date: string;
    indicative_mass_g: number;
    measured_gross_mass_g: number | null;
    measured_sample_mass_g: number | null;
    orchard_name: string;
  }) => void;
  createProduceLot: (payload: { produce_type: string }) => void;
  openAnalyticalBalanceTool: () => void;
  openGrossBalanceTool: () => void;
  printLimsLabel: (payload?: { entry_id: string }) => void;
  setGrossBalanceContainerOffset: (payload: { gross_mass_offset_g: number }) => void;
  tareAnalyticalBalance: () => void;
};

type UseWorkspaceActionsOptions = {
  analyticalBalanceTool: BenchToolInstance | null;
  experimentApi: WorkspaceActionsExperimentApi;
  grossBalanceTool: BenchToolInstance | null;
  grossBalanceNetMassG: number | null;
  measuredSampleMassG: number | null;
};

type WorkspaceActions = {
  handleAnalyticalBalanceToolSealToggle: () => void;
  handleBalanceToolSealToggle: () => void;
  handleCreateAppleLot: () => void;
  handleSaveLimsReception: (payload: {
    entry_id?: string;
    harvest_date: string;
    indicative_mass_g: number;
    measured_sample_mass_g: number | null;
    orchard_name: string;
  }) => void;
  onCommitGrossBalanceOffset: (nextOffsetG: number) => void;
  onPrintLimsLabel: (entryId?: string) => void;
  onTareAnalyticalBalance: () => void;
};

export function useWorkspaceActions({
  analyticalBalanceTool,
  experimentApi,
  grossBalanceTool,
  grossBalanceNetMassG,
}: UseWorkspaceActionsOptions): WorkspaceActions {
  const handleBalanceToolSealToggle = () => {
    if (!grossBalanceTool) {
      return;
    }
    if (grossBalanceTool.isSealed) {
      void experimentApi.openGrossBalanceTool();
      return;
    }
    void experimentApi.closeGrossBalanceTool();
  };

  const handleAnalyticalBalanceToolSealToggle = () => {
    if (!analyticalBalanceTool) {
      return;
    }
    if (analyticalBalanceTool.isSealed) {
      void experimentApi.openAnalyticalBalanceTool();
      return;
    }
    void experimentApi.closeAnalyticalBalanceTool();
  };

  const handleSaveLimsReception = (payload: {
    entry_id?: string;
    harvest_date: string;
    indicative_mass_g: number;
    measured_sample_mass_g: number | null;
    orchard_name: string;
  }) => {
    void experimentApi.createLimsReception({
      ...(payload.entry_id ? { entry_id: payload.entry_id } : {}),
      orchard_name: payload.orchard_name,
      harvest_date: payload.harvest_date,
      indicative_mass_g: payload.indicative_mass_g,
      measured_gross_mass_g: grossBalanceNetMassG,
      measured_sample_mass_g: payload.measured_sample_mass_g,
    });
  };

  const handleCreateAppleLot = () => {
    void experimentApi.createProduceLot({ produce_type: "apple" });
  };

  const onCommitGrossBalanceOffset = (nextOffsetG: number) => {
    void experimentApi.setGrossBalanceContainerOffset({ gross_mass_offset_g: nextOffsetG });
  };

  const onPrintLimsLabel = (entryId?: string) => {
    void experimentApi.printLimsLabel(entryId ? { entry_id: entryId } : undefined);
  };

  const onTareAnalyticalBalance = () => {
    void experimentApi.tareAnalyticalBalance();
  };

  return {
    handleAnalyticalBalanceToolSealToggle,
    handleBalanceToolSealToggle,
    handleCreateAppleLot,
    handleSaveLimsReception,
    onCommitGrossBalanceOffset,
    onPrintLimsLabel,
    onTareAnalyticalBalance,
  };
}
