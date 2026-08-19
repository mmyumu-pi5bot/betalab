import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ExperimentAppHeader } from "@/components/experiment-app-header";
import type { JournalEntry } from "@/types/experiment";

const entries: JournalEntry[] = [
  {
    id: "journal_1",
    occurredAt: "2026-08-19T12:30:00Z",
    category: "manipulation",
    severity: "info",
    message: "Acetonitrile added to 50 mL centrifuge tube.",
  },
  {
    id: "journal_2",
    occurredAt: "2026-08-19T12:31:00Z",
    category: "layout",
    severity: "info",
    message: "Autosampler rack moved in workspace.",
  },
  {
    id: "journal_3",
    occurredAt: "2026-08-19T12:32:00Z",
    category: "simulation",
    severity: "warning",
    message: "Tube vented under pressure; powder was lost.",
  },
];

describe("ExperimentAppHeader", () => {
  it("shows global experiment controls and opens a useful journal drawer", () => {
    render(
      <ExperimentAppHeader
        experimentName="Apple preparation"
        isSyncing={false}
        journalEntries={entries}
        onRenameExperiment={vi.fn()}
        statusMessage="Saved"
      />,
    );

    expect(screen.getByRole("link", { name: "Experiments" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("heading", { name: "Apple preparation" })).toBeInTheDocument();
    expect(screen.getByText("Saved")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open experiment journal" }));

    const journal = screen.getByRole("complementary", { name: "Experiment journal" });
    const journalQueries = within(journal);
    expect(journalQueries.getByText("Tube vented under pressure; powder was lost.")).toBeInTheDocument();
    expect(journalQueries.getByText("Acetonitrile added to 50 mL centrifuge tube.")).toBeInTheDocument();
    expect(journalQueries.queryByText("Autosampler rack moved in workspace.")).not.toBeInTheDocument();
    expect(
      journalQueries.getAllByTestId("journal-entry").map((entry) => entry.textContent),
    ).toEqual([
      expect.stringContaining("Tube vented under pressure"),
      expect.stringContaining("Acetonitrile added"),
    ]);

    fireEvent.click(journalQueries.getByRole("button", { name: "Close journal" }));
    expect(screen.queryByRole("complementary", { name: "Experiment journal" })).not.toBeInTheDocument();
  });

  it("prioritizes synchronization and connection errors over the saved state", () => {
    const { rerender } = render(
      <ExperimentAppHeader
        experimentName="Apple preparation"
        isSyncing
        journalEntries={[]}
        onRenameExperiment={vi.fn()}
        statusMessage="Saved"
      />,
    );

    expect(screen.getByText("Syncing...")).toBeInTheDocument();

    rerender(
      <ExperimentAppHeader
        experimentName="Apple preparation"
        isSyncing={false}
        journalEntries={[]}
        onRenameExperiment={vi.fn()}
        statusMessage="Backend unavailable"
      />,
    );
    expect(screen.getByText("Backend unavailable")).toBeInTheDocument();
  });

  it("renames the experiment inline from its title", async () => {
    const onRenameExperiment = vi.fn().mockResolvedValue(true);
    render(
      <ExperimentAppHeader
        experimentName="Apple preparation"
        isSyncing={false}
        journalEntries={[]}
        onRenameExperiment={onRenameExperiment}
        statusMessage="Saved"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Rename experiment" }));
    const input = screen.getByRole("textbox", { name: "Experiment name" });
    fireEvent.change(input, { target: { value: "  Validated extraction  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onRenameExperiment).toHaveBeenCalledWith("Validated extraction");
    expect(await screen.findByRole("button", { name: "Rename experiment" })).toBeInTheDocument();
  });

  it("cancels an inline rename with Escape", () => {
    const onRenameExperiment = vi.fn();
    render(
      <ExperimentAppHeader
        experimentName="Apple preparation"
        isSyncing={false}
        journalEntries={[]}
        onRenameExperiment={onRenameExperiment}
        statusMessage="Saved"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Rename experiment" }));
    const input = screen.getByRole("textbox", { name: "Experiment name" });
    fireEvent.change(input, { target: { value: "Discarded draft" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onRenameExperiment).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Apple preparation" })).toBeInTheDocument();
  });

  it("hides while scrolling down and returns when scrolling up", () => {
    render(
      <ExperimentAppHeader
        experimentName="Apple preparation"
        isSyncing={false}
        journalEntries={[]}
        onRenameExperiment={vi.fn()}
        statusMessage="Saved"
      />,
    );

    const header = screen.getByRole("banner");
    expect(header).toHaveClass("translate-y-0");

    Object.defineProperty(window, "scrollY", { configurable: true, value: 120 });
    fireEvent.scroll(window);
    expect(header).toHaveClass("-translate-y-[calc(100%+1rem)]");

    Object.defineProperty(window, "scrollY", { configurable: true, value: 100 });
    fireEvent.scroll(window);
    expect(header).toHaveClass("translate-y-0");

    fireEvent.click(screen.getByRole("button", { name: "Open experiment journal" }));
    Object.defineProperty(window, "scrollY", { configurable: true, value: 180 });
    fireEvent.scroll(window);
    expect(header).toHaveClass("translate-y-0");

    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  });
});
