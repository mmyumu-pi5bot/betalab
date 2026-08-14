import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ExperimentsHome } from "@/components/experiments-home";

const pushMock = vi.fn();
const createExperimentMock = vi.fn();
const deleteExperimentMock = vi.fn();
const listExperimentsMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("@/lib/api", () => ({
  createExperiment: (...args: unknown[]) => createExperimentMock(...args),
  deleteExperiment: (...args: unknown[]) => deleteExperimentMock(...args),
  listExperiments: (...args: unknown[]) => listExperimentsMock(...args),
}));

describe("ExperimentsHome", () => {
  beforeEach(() => {
    window.localStorage.clear();
    pushMock.mockReset();
    createExperimentMock.mockReset();
    deleteExperimentMock.mockReset();
    listExperimentsMock.mockReset();
  });

  it("lists saved experiments and opens one on click", async () => {
    listExperimentsMock.mockResolvedValue([
      {
        id: "experiment_2",
        status: "preparing",
        last_simulation_at: "2026-04-01T10:00:00Z",
        snapshot_version: 4,
        updated_at: "2026-04-01T10:03:00Z",
        last_audit_entry: "Wide-neck HDPE jar sealed on Station 1.",
      },
    ]);

    render(<ExperimentsHome />);

    expect(await screen.findByText("experiment_2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open experiment" }));

    expect(pushMock).toHaveBeenCalledWith("/experiments/experiment_2");
  });

  it("creates a new experiment and redirects to it", async () => {
    listExperimentsMock.mockResolvedValue([]);
    createExperimentMock.mockResolvedValue({
      id: "experiment_new",
    });

    render(<ExperimentsHome />);

    await waitFor(() => {
      expect(screen.getByText("No saved experiments yet.")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "New experiment" }));

    await waitFor(() => {
      expect(createExperimentMock).toHaveBeenCalled();
      expect(pushMock).toHaveBeenCalledWith("/experiments/experiment_new");
    });
  });

  it("starts a dedicated tutorial experiment", async () => {
    listExperimentsMock.mockResolvedValue([]);
    createExperimentMock.mockResolvedValue({ id: "experiment_tutorial" });

    render(<ExperimentsHome />);

    fireEvent.click(await screen.findByRole("button", { name: "New tutorial" }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(
        "/experiments/experiment_tutorial?tutorial=calibration-sample-v1",
      );
    });
    expect(window.localStorage.getItem("betalab:tutorial-sessions:v1")).toContain(
      "experiment_tutorial",
    );
  });

  it("keeps New tutorial available and creates another tutorial experiment", async () => {
    window.localStorage.setItem(
      "betalab:tutorial-sessions:v1",
      JSON.stringify({
        "calibration-sample-v1": {
          tutorialId: "calibration-sample-v1",
          experimentId: "experiment_tutorial",
          status: "paused",
          version: 1,
        },
      }),
    );
    listExperimentsMock.mockResolvedValue([
      {
        id: "experiment_tutorial",
        status: "preparing",
        last_simulation_at: "2026-08-10T08:00:00Z",
        snapshot_version: 3,
        updated_at: "2026-08-10T08:10:00Z",
        last_audit_entry: "Experiment created",
      },
    ]);
    createExperimentMock.mockResolvedValue({ id: "experiment_tutorial_2" });

    render(<ExperimentsHome />);

    expect(await screen.findByText("experiment_tutorial")).toBeInTheDocument();
    expect(screen.getByText("Tutorial")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "1 calibration point + 1 sample" }),
    ).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "New tutorial" }));

    await waitFor(() => {
      expect(createExperimentMock).toHaveBeenCalledTimes(1);
      expect(pushMock).toHaveBeenCalledWith(
        "/experiments/experiment_tutorial_2?tutorial=calibration-sample-v1",
      );
    });
    expect(window.localStorage.getItem("betalab:tutorial-sessions:v1")).toContain(
      "experiment_tutorial",
    );
    expect(window.localStorage.getItem("betalab:tutorial-sessions:v1")).toContain(
      "experiment_tutorial_2",
    );
  });

  it("opens a tutorial from its regular saved experiment card", async () => {
    window.localStorage.setItem(
      "betalab:tutorial-sessions:v1",
      JSON.stringify({
        "calibration-sample-v1": {
          tutorialId: "calibration-sample-v1",
          experimentId: "experiment_tutorial",
          status: "paused",
          completedStepIds: ["weigh-received-sample"],
          version: 1,
        },
      }),
    );
    listExperimentsMock.mockResolvedValue([
      {
        id: "experiment_tutorial",
        status: "preparing",
        last_simulation_at: "2026-08-10T08:00:00Z",
        snapshot_version: 3,
        updated_at: "2026-08-10T08:10:00Z",
        last_audit_entry: "Experiment created",
      },
    ]);

    render(<ExperimentsHome />);

    fireEvent.click(await screen.findByRole("button", { name: "Open tutorial experiment" }));

    expect(pushMock).toHaveBeenCalledWith(
      "/experiments/experiment_tutorial?tutorial=calibration-sample-v1",
    );
  });

  it("treats an abandoned tutorial as a normal experiment on the home page", async () => {
    window.localStorage.setItem(
      "betalab:tutorial-sessions:v1",
      JSON.stringify({
        "calibration-sample-v1::experiment_abandoned": {
          tutorialId: "calibration-sample-v1",
          experimentId: "experiment_abandoned",
          status: "abandoned",
          completedStepIds: ["weigh-received-sample"],
          version: 1,
        },
      }),
    );
    listExperimentsMock.mockResolvedValue([
      {
        id: "experiment_abandoned",
        status: "preparing",
        last_simulation_at: "2026-08-10T08:00:00Z",
        snapshot_version: 4,
        updated_at: "2026-08-10T08:15:00Z",
        last_audit_entry: "Tutorial left after contamination.",
      },
    ]);

    render(<ExperimentsHome />);

    expect(await screen.findByText("experiment_abandoned")).toBeInTheDocument();
    expect(screen.queryByText("Tutorial")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open experiment" }));

    expect(pushMock).toHaveBeenCalledWith("/experiments/experiment_abandoned");
  });

  it("deletes a saved experiment from the list", async () => {
    listExperimentsMock.mockResolvedValue([
      {
        id: "experiment_2",
        status: "preparing",
        last_simulation_at: "2026-04-01T10:00:00Z",
        snapshot_version: 4,
        updated_at: "2026-04-01T10:03:00Z",
        last_audit_entry: "Wide-neck HDPE jar sealed on Station 1.",
      },
    ]);
    deleteExperimentMock.mockResolvedValue(undefined);

    render(<ExperimentsHome />);

    expect(await screen.findByText("experiment_2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(deleteExperimentMock).toHaveBeenCalledWith("experiment_2");
      expect(screen.queryByText("experiment_2")).not.toBeInTheDocument();
    });
  });
});
