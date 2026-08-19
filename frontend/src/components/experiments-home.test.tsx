import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ExperimentsHome } from "@/components/experiments-home";

const pushMock = vi.fn();
const createExperimentMock = vi.fn();
const deleteExperimentMock = vi.fn();
const duplicateExperimentMock = vi.fn();
const listExperimentsMock = vi.fn();
const renameExperimentMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("@/lib/api", () => ({
  createExperiment: (...args: unknown[]) => createExperimentMock(...args),
  deleteExperiment: (...args: unknown[]) => deleteExperimentMock(...args),
  duplicateExperiment: (...args: unknown[]) => duplicateExperimentMock(...args),
  listExperiments: (...args: unknown[]) => listExperimentsMock(...args),
  renameExperiment: (...args: unknown[]) => renameExperimentMock(...args),
}));

describe("ExperimentsHome", () => {
  beforeEach(() => {
    window.localStorage.clear();
    pushMock.mockReset();
    createExperimentMock.mockReset();
    deleteExperimentMock.mockReset();
    duplicateExperimentMock.mockReset();
    listExperimentsMock.mockReset();
    renameExperimentMock.mockReset();
  });

  it("lists saved experiments and opens one on click", async () => {
    listExperimentsMock.mockResolvedValue([
      {
        id: "experiment_2",
        name: "Apple extraction",
        status: "preparing",
        last_simulation_at: "2026-04-01T10:00:00Z",
        snapshot_version: 4,
        updated_at: "2026-04-01T10:03:00Z",
        last_audit_entry: "Wide-neck HDPE jar sealed on Station 1.",
        summary: {
          workbenchToolCount: 2,
          rackToolCount: 3,
          materialCount: 1,
          runCount: 4,
        },
      },
    ]);

    render(<ExperimentsHome />);

    expect(await screen.findByText("Apple extraction")).toBeInTheDocument();
    expect(screen.getByText("2 bench tools")).toBeInTheDocument();
    expect(screen.getByText("3 rack vials")).toBeInTheDocument();
    expect(screen.getByText("1 material")).toBeInTheDocument();
    expect(screen.getByText("4 runs")).toBeInTheDocument();
    expect(screen.queryByText("v4")).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "Manage experiment_2" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(deleteExperimentMock).toHaveBeenCalledWith("experiment_2");
      expect(screen.queryByText("experiment_2")).not.toBeInTheDocument();
    });
  });

  it("renames an experiment inline", async () => {
    listExperimentsMock.mockResolvedValue([
      {
        id: "experiment_2",
        name: "Draft experiment",
        status: "preparing",
        last_simulation_at: "2026-04-01T10:00:00Z",
        snapshot_version: 4,
        updated_at: "2026-04-01T10:03:00Z",
        last_audit_entry: null,
        summary: { workbenchToolCount: 0, rackToolCount: 0, materialCount: 0, runCount: 0 },
      },
    ]);
    renameExperimentMock.mockResolvedValue({ name: "Validated extraction" });

    render(<ExperimentsHome />);
    fireEvent.click(await screen.findByRole("button", { name: "Rename Draft experiment" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Experiment name" }), {
      target: { value: "Validated extraction" },
    });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Experiment name" }), {
      key: "Enter",
    });

    await waitFor(() => {
      expect(renameExperimentMock).toHaveBeenCalledWith("experiment_2", "Validated extraction");
      expect(screen.getByText("Validated extraction")).toBeInTheDocument();
    });
  });

  it("saves an experiment name on blur and cancels with Escape", async () => {
    listExperimentsMock.mockResolvedValue([
      {
        id: "experiment_2",
        name: "Draft experiment",
        status: "preparing",
        last_simulation_at: "2026-04-01T10:00:00Z",
        snapshot_version: 4,
        updated_at: "2026-04-01T10:03:00Z",
        last_audit_entry: null,
        summary: { workbenchToolCount: 0, rackToolCount: 0, materialCount: 0, runCount: 0 },
      },
    ]);
    renameExperimentMock.mockResolvedValue({ name: "Blurred title" });

    render(<ExperimentsHome />);
    fireEvent.click(await screen.findByRole("button", { name: "Rename Draft experiment" }));
    let input = screen.getByRole("textbox", { name: "Experiment name" });
    fireEvent.change(input, { target: { value: "Blurred title" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(renameExperimentMock).toHaveBeenCalledWith("experiment_2", "Blurred title");
    });

    fireEvent.click(await screen.findByRole("button", { name: "Rename Blurred title" }));
    input = screen.getByRole("textbox", { name: "Experiment name" });
    fireEvent.change(input, { target: { value: "Discarded title" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(renameExperimentMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Blurred title")).toBeInTheDocument();
  });

  it("duplicates an experiment and adds the copy to the list", async () => {
    const source = {
      id: "experiment_2",
      name: "Ready state",
      status: "preparing",
      last_simulation_at: "2026-04-01T10:00:00Z",
      snapshot_version: 4,
      updated_at: "2026-04-01T10:03:00Z",
      last_audit_entry: null,
      summary: { workbenchToolCount: 1, rackToolCount: 2, materialCount: 1, runCount: 0 },
    };
    listExperimentsMock.mockResolvedValue([source]);
    duplicateExperimentMock.mockResolvedValue({ id: "experiment_copy" });
    listExperimentsMock.mockResolvedValueOnce([source]).mockResolvedValueOnce([
      { ...source, id: "experiment_copy", name: "Ready state (copy)" },
      source,
    ]);

    render(<ExperimentsHome />);
    fireEvent.click(await screen.findByRole("button", { name: "Manage Ready state" }));
    fireEvent.click(screen.getByRole("button", { name: "Duplicate Ready state" }));

    await waitFor(() => {
      expect(duplicateExperimentMock).toHaveBeenCalledWith("experiment_2");
      expect(screen.getByText("Ready state (copy)")).toBeInTheDocument();
    });
  });

  it("treats a completed tutorial as a free-mode experiment on the home page", async () => {
    window.localStorage.setItem(
      "betalab:tutorial-sessions:v1",
      JSON.stringify({
        "calibration-sample-v1::experiment_tutorial": {
          tutorialId: "calibration-sample-v1",
          experimentId: "experiment_tutorial",
          status: "completed",
          completedStepIds: [],
          version: 1,
        },
      }),
    );
    listExperimentsMock.mockResolvedValue([
      {
        id: "experiment_tutorial",
        name: "Finished tutorial",
        status: "preparing",
        last_simulation_at: "2026-08-10T08:00:00Z",
        snapshot_version: 3,
        updated_at: "2026-08-10T08:10:00Z",
        last_audit_entry: null,
        summary: { workbenchToolCount: 0, rackToolCount: 0, materialCount: 1, runCount: 0 },
      },
    ]);

    render(<ExperimentsHome />);

    expect(await screen.findByText("Finished tutorial")).toBeInTheDocument();
    expect(screen.queryByText("Tutorial")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open experiment" }));
    expect(pushMock).toHaveBeenCalledWith("/experiments/experiment_tutorial");
  });

  it("carries the tutorial progress over to a duplicated tutorial experiment", async () => {
    window.localStorage.setItem(
      "betalab:tutorial-sessions:v1",
      JSON.stringify({
        "calibration-sample-v1::experiment_tutorial": {
          tutorialId: "calibration-sample-v1",
          experimentId: "experiment_tutorial",
          status: "paused",
          completedStepIds: ["place-flask", "weigh-sample"],
          version: 1,
        },
      }),
    );
    const source = {
      id: "experiment_tutorial",
      name: "Calibration tutorial",
      status: "preparing",
      last_simulation_at: "2026-08-10T08:00:00Z",
      snapshot_version: 3,
      updated_at: "2026-08-10T08:10:00Z",
      last_audit_entry: null,
      summary: { workbenchToolCount: 0, rackToolCount: 0, materialCount: 1, runCount: 0 },
    };
    duplicateExperimentMock.mockResolvedValue({ id: "experiment_tutorial_copy" });
    listExperimentsMock.mockResolvedValueOnce([source]).mockResolvedValueOnce([
      { ...source, id: "experiment_tutorial_copy", name: "Calibration tutorial (copy)" },
      source,
    ]);

    render(<ExperimentsHome />);
    fireEvent.click(await screen.findByRole("button", { name: "Manage Calibration tutorial" }));
    fireEvent.click(screen.getByRole("button", { name: "Duplicate Calibration tutorial" }));

    expect(await screen.findByText("Calibration tutorial (copy)")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText("Tutorial")).toHaveLength(2));
    expect(
      JSON.parse(window.localStorage.getItem("betalab:tutorial-sessions:v1") ?? "{}"),
    ).toMatchObject({
      "calibration-sample-v1::experiment_tutorial_copy": {
        tutorialId: "calibration-sample-v1",
        experimentId: "experiment_tutorial_copy",
        status: "paused",
        completedStepIds: ["place-flask", "weigh-sample"],
        version: 1,
      },
    });
  });

  it("leaves a plain experiment copy free of tutorial state", async () => {
    const source = {
      id: "experiment_2",
      name: "Ready state",
      status: "preparing",
      last_simulation_at: "2026-04-01T10:00:00Z",
      snapshot_version: 4,
      updated_at: "2026-04-01T10:03:00Z",
      last_audit_entry: null,
      summary: { workbenchToolCount: 1, rackToolCount: 2, materialCount: 1, runCount: 0 },
    };
    duplicateExperimentMock.mockResolvedValue({ id: "experiment_copy" });
    listExperimentsMock.mockResolvedValueOnce([source]).mockResolvedValueOnce([
      { ...source, id: "experiment_copy", name: "Ready state (copy)" },
      source,
    ]);

    render(<ExperimentsHome />);
    fireEvent.click(await screen.findByRole("button", { name: "Manage Ready state" }));
    fireEvent.click(screen.getByRole("button", { name: "Duplicate Ready state" }));

    expect(await screen.findByText("Ready state (copy)")).toBeInTheDocument();
    expect(screen.queryByText("Tutorial")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("betalab:tutorial-sessions:v1")).toBeNull();
  });

  it("keeps card actions visually hierarchical", async () => {
    window.localStorage.setItem(
      "betalab:tutorial-sessions:v1",
      JSON.stringify({
        "calibration-sample-v1::experiment_tutorial": {
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
        name: "Calibration tutorial",
        status: "preparing",
        last_simulation_at: "2026-08-10T08:00:00Z",
        snapshot_version: 3,
        updated_at: "2026-08-10T08:10:00Z",
        last_audit_entry: null,
        summary: { workbenchToolCount: 0, rackToolCount: 0, materialCount: 1, runCount: 0 },
      },
    ]);

    render(<ExperimentsHome />);

    const openButton = await screen.findByRole("button", { name: "Open tutorial experiment" });
    expect(openButton).toHaveClass("bg-sky-700");
    expect(openButton.closest("article")).not.toHaveClass("hover:-translate-y-0.5");
    expect(screen.getByRole("button", { name: "Rename Calibration tutorial" })).toHaveTextContent("");
    expect(screen.getByRole("button", { name: "Manage Calibration tutorial" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("closes the management menu when clicking elsewhere", async () => {
    listExperimentsMock.mockResolvedValue([
      {
        id: "experiment_2",
        name: "Ready state",
        status: "preparing",
        last_simulation_at: "2026-04-01T10:00:00Z",
        snapshot_version: 4,
        updated_at: "2026-04-01T10:03:00Z",
        last_audit_entry: null,
        summary: { workbenchToolCount: 1, rackToolCount: 2, materialCount: 1, runCount: 0 },
      },
    ]);

    render(<ExperimentsHome />);
    fireEvent.click(await screen.findByRole("button", { name: "Manage Ready state" }));
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();

    fireEvent.pointerDown(document.body);

    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });
});
