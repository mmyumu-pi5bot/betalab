import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", async () => await import("@/test-support/api-mock"));

import { LcMsMsMethodEditor } from "@/components/lcmsms-method-editor";
import { acquisitionMethodFixture } from "@/test-support/acquisition-method-fixture";
import {
  getMrmReferenceCatalog,
  proposeMrmTransitions,
  resetApiMocks,
  saveAcquisitionMethod,
} from "@/test-support/api-mock";

function renderEditor(overrides: Partial<Parameters<typeof LcMsMsMethodEditor>[0]> = {}) {
  return render(
    <LcMsMsMethodEditor
      method={acquisitionMethodFixture}
      onMethodSaved={vi.fn()}
      {...overrides}
    />,
  );
}

describe("LcMsMsMethodEditor", () => {
  beforeEach(() => {
    resetApiMocks();
  });

  it("refuses to edit a built-in method and points at duplication", () => {
    renderEditor();

    // Duplication is a library-level action, owned by the method manager.
    expect(screen.getByText(/built-in method.*cannot be edited/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Q1 (m/z)")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Method name")).not.toBeInTheDocument();
  });

  it("edits a user method in simple mode by picking target compounds", async () => {
    const userMethod = { ...acquisitionMethodFixture, id: "mine", isBuiltIn: false };
    renderEditor({ method: userMethod });

    await waitFor(() => expect(getMrmReferenceCatalog).toHaveBeenCalled());
    const compounds = await screen.findByTestId("simple-mode-compounds");
    fireEvent.click(within(compounds).getByRole("checkbox", { name: /Acetamiprid/ }));

    await waitFor(() => expect(proposeMrmTransitions).toHaveBeenCalled());
    expect(proposeMrmTransitions).toHaveBeenCalledWith(
      expect.arrayContaining(["acetamiprid"]),
    );
  });

  it("edits Q1, Q3, CE, dwell, RT and window in advanced mode", async () => {
    const userMethod = { ...acquisitionMethodFixture, id: "mine", isBuiltIn: false };
    renderEditor({ method: userMethod });

    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));

    const rows = screen.getAllByTestId("editor-transition-row");
    const first = within(rows[0]);
    fireEvent.change(first.getByLabelText("Q1 (m/z)"), { target: { value: "911.4" } });
    fireEvent.change(first.getByLabelText("Q3 (m/z)"), { target: { value: "455.2" } });
    fireEvent.change(first.getByLabelText("CE (V)"), { target: { value: "30" } });
    fireEvent.change(first.getByLabelText("Dwell (ms)"), { target: { value: "40" } });
    fireEvent.change(first.getByLabelText("RT (s)"), { target: { value: "300" } });
    fireEvent.change(first.getByLabelText("Window (s)"), { target: { value: "30" } });

    fireEvent.click(screen.getByRole("button", { name: "Save as new version" }));

    await waitFor(() => expect(saveAcquisitionMethod).toHaveBeenCalled());
    const [methodId, payload] = vi.mocked(saveAcquisitionMethod).mock.calls[0];
    expect(methodId).toBe("mine");
    expect(payload.transitions[0]).toMatchObject({
      q1Mz: 911.4,
      q3Mz: 455.2,
      collisionEnergyV: 30,
      dwellTimeMs: 40,
      expectedRetentionTimeS: 300,
      retentionWindowS: 30,
    });
  });

  it("warns about an off-catalog transition without blocking the save", async () => {
    const userMethod = { ...acquisitionMethodFixture, id: "mine", isBuiltIn: false };
    vi.mocked(saveAcquisitionMethod).mockResolvedValue({
      method: userMethod,
      warnings: [
        {
          code: "unmatched_transition",
          transitionId: "boscalid__quantifier",
          message: "No known compound responds at 911.4 → 455.2.",
        },
      ],
    });
    renderEditor({ method: userMethod });

    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
    const rows = screen.getAllByTestId("editor-transition-row");
    fireEvent.change(within(rows[0]).getByLabelText("Q1 (m/z)"), {
      target: { value: "911.4" },
    });

    const saveButton = screen.getByRole("button", { name: "Save as new version" });
    expect(saveButton).toBeEnabled();
    fireEvent.click(saveButton);

    expect(await screen.findByTestId("method-warnings")).toHaveTextContent(
      /No known compound responds/,
    );
  });

  it("blocks a save that would be structurally inconsistent", () => {
    const userMethod = { ...acquisitionMethodFixture, id: "mine", isBuiltIn: false };
    renderEditor({ method: userMethod });

    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
    const rows = screen.getAllByTestId("editor-transition-row");
    fireEvent.change(within(rows[0]).getByLabelText("Dwell (ms)"), {
      target: { value: "0" },
    });

    expect(screen.getByTestId("method-errors")).toHaveTextContent(/dwell time must be positive/i);
    expect(screen.getByRole("button", { name: "Save as new version" })).toBeDisabled();
    expect(saveAcquisitionMethod).not.toHaveBeenCalled();
  });

  it("blocks a save on a negative m/z", () => {
    const userMethod = { ...acquisitionMethodFixture, id: "mine", isBuiltIn: false };
    renderEditor({ method: userMethod });

    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
    const rows = screen.getAllByTestId("editor-transition-row");
    fireEvent.change(within(rows[0]).getByLabelText("Q1 (m/z)"), {
      target: { value: "-343" },
    });

    expect(screen.getByTestId("method-errors")).toHaveTextContent(/m\/z values must be positive/i);
    expect(screen.getByRole("button", { name: "Save as new version" })).toBeDisabled();
  });

  it("blocks a save on an empty method", () => {
    const userMethod = { ...acquisitionMethodFixture, id: "mine", isBuiltIn: false };
    renderEditor({ method: userMethod });

    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
    // Removing re-renders the list, so always act on the current first row.
    let remaining = screen.queryAllByTestId("editor-transition-row");
    while (remaining.length > 0) {
      fireEvent.click(
        within(remaining[0]).getByRole("button", { name: "Remove transition" }),
      );
      remaining = screen.queryAllByTestId("editor-transition-row");
    }

    expect(screen.getByTestId("method-errors")).toHaveTextContent(
      /at least one transition/i,
    );
    expect(screen.getByRole("button", { name: "Save as new version" })).toBeDisabled();
  });

  it("blocks a save when a compound has no quantifier", () => {
    const userMethod = {
      ...acquisitionMethodFixture,
      id: "mine",
      isBuiltIn: false,
      transitions: [acquisitionMethodFixture.transitions[1]],
    };
    renderEditor({ method: userMethod });

    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));

    expect(screen.getByTestId("method-errors")).toHaveTextContent(/no quantifier transition/i);
    expect(screen.getByRole("button", { name: "Save as new version" })).toBeDisabled();
  });

  it("blocks a save on duplicate transition identifiers", () => {
    const [quantifier] = acquisitionMethodFixture.transitions;
    const userMethod = {
      ...acquisitionMethodFixture,
      id: "mine",
      isBuiltIn: false,
      transitions: [quantifier, { ...quantifier }],
    };
    renderEditor({ method: userMethod });

    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));

    expect(screen.getByTestId("method-errors")).toHaveTextContent(
      /duplicate transition identifier/i,
    );
    expect(screen.getByRole("button", { name: "Save as new version" })).toBeDisabled();
  });
});
