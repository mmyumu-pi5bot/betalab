import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  useWorkspaceActions,
  type WorkspaceActionsExperimentApi,
} from "@/hooks/use-workspace-actions";

function experimentApi(): WorkspaceActionsExperimentApi {
  return {
    closeAnalyticalBalanceTool: vi.fn(),
    closeGrossBalanceTool: vi.fn(),
    createLimsReception: vi.fn(),
    createProduceLot: vi.fn(),
    openAnalyticalBalanceTool: vi.fn(),
    openGrossBalanceTool: vi.fn(),
    printLimsLabel: vi.fn(),
    setGrossBalanceContainerOffset: vi.fn(),
    tareAnalyticalBalance: vi.fn(),
  };
}

describe("useWorkspaceActions", () => {
  it("records the physical gross reading in LIMS instead of the offset net display", () => {
    const api = experimentApi();
    const { result } = renderHook(() =>
      useWorkspaceActions({
        analyticalBalanceTool: null,
        experimentApi: api,
        grossBalanceTool: null,
        measuredGrossMassG: 2536,
      }),
    );

    act(() => {
      result.current.handleSaveLimsReception({
        harvest_date: "2026-08-13",
        indicative_mass_g: 2500,
        measured_sample_mass_g: null,
        orchard_name: "Tutorial Orchard",
      });
    });

    expect(api.createLimsReception).toHaveBeenCalledWith({
      orchard_name: "Tutorial Orchard",
      harvest_date: "2026-08-13",
      indicative_mass_g: 2500,
      measured_gross_mass_g: 2536,
      measured_sample_mass_g: null,
    });
  });
});
