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

  it("lets the technician type a decimal m/z one character at a time", () => {
    const userMethod = { ...acquisitionMethodFixture, id: "mine", isBuiltIn: false };
    renderEditor({ method: userMethod });

    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
    const field = within(screen.getAllByTestId("editor-transition-row")[0]).getByLabelText(
      "Q1 (m/z)",
    ) as HTMLInputElement;

    // Real typing goes through an intermediate "343." that parses to 343. If the
    // field is re-rendered from the parsed number, the decimal point is eaten
    // and the value can never be given a fractional part.
    fireEvent.change(field, { target: { value: "343." } });
    expect(field.value).toBe("343.");

    fireEvent.change(field, { target: { value: "343.7" } });
    expect(field.value).toBe("343.7");
  });

  it("lets the technician clear a numeric field before retyping it", () => {
    const userMethod = { ...acquisitionMethodFixture, id: "mine", isBuiltIn: false };
    renderEditor({ method: userMethod });

    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
    const field = within(screen.getAllByTestId("editor-transition-row")[0]).getByLabelText(
      "Q1 (m/z)",
    ) as HTMLInputElement;

    // An emptied field must stay empty, not snap to 0 and strand the cursor.
    fireEvent.change(field, { target: { value: "" } });
    expect(field.value).toBe("");
  });

  it("sends the typed decimal when saving", async () => {
    const userMethod = { ...acquisitionMethodFixture, id: "mine", isBuiltIn: false };
    renderEditor({ method: userMethod });

    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
    const field = within(screen.getAllByTestId("editor-transition-row")[0]).getByLabelText(
      "Q1 (m/z)",
    );
    fireEvent.change(field, { target: { value: "343." } });
    fireEvent.change(field, { target: { value: "343.7" } });
    fireEvent.click(screen.getByRole("button", { name: "Save as new version" }));

    await waitFor(() => expect(saveAcquisitionMethod).toHaveBeenCalled());
    const [, payload] = vi.mocked(saveAcquisitionMethod).mock.calls[0];
    expect(payload.transitions[0].q1Mz).toBe(343.7);
  });

  it("keeps advanced edits when another compound is added in simple mode", async () => {
    const userMethod = { ...acquisitionMethodFixture, id: "mine", isBuiltIn: false };
    renderEditor({ method: userMethod });

    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
    const field = within(screen.getAllByTestId("editor-transition-row")[0]).getByLabelText(
      "Q1 (m/z)",
    ) as HTMLInputElement;
    fireEvent.change(field, { target: { value: "213.1" } });

    vi.mocked(proposeMrmTransitions).mockResolvedValue([
      {
        ...acquisitionMethodFixture.transitions[0],
        id: "acetamiprid__quantifier",
        compoundId: "acetamiprid",
        compoundLabel: "Acetamiprid",
        q1Mz: 223.1,
        q3Mz: 126,
      },
    ]);

    // Picking a compound must add its channels, not rebuild every other one from
    // the catalog and silently throw the tuning away.
    fireEvent.click(screen.getByRole("button", { name: "Simple" }));
    await waitFor(() => expect(getMrmReferenceCatalog).toHaveBeenCalled());
    const compounds = await screen.findByTestId("simple-mode-compounds");
    fireEvent.click(within(compounds).getByRole("checkbox", { name: /Acetamiprid/ }));
    await waitFor(() => expect(proposeMrmTransitions).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
    const reopened = within(
      screen.getAllByTestId("editor-transition-row")[0],
    ).getByLabelText("Q1 (m/z)") as HTMLInputElement;
    expect(reopened.value).toBe("213.1");
  });

  it("only drops the deselected compound's channels", async () => {
    const userMethod = { ...acquisitionMethodFixture, id: "mine", isBuiltIn: false };
    renderEditor({ method: userMethod });

    await waitFor(() => expect(getMrmReferenceCatalog).toHaveBeenCalled());
    const compounds = await screen.findByTestId("simple-mode-compounds");
    fireEvent.click(within(compounds).getByRole("checkbox", { name: /Boscalid/ }));

    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
    const rows = screen.getAllByTestId("editor-transition-row");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("Triphenyl phosphate-d15");
    // Removing needs no catalog round trip at all.
    expect(proposeMrmTransitions).not.toHaveBeenCalled();
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

describe("LcMsMsMethodEditor calibration ladder", () => {
  beforeEach(() => {
    resetApiMocks();
  });

  function renderUserMethod(levels: number[] = []) {
    const userMethod = {
      ...acquisitionMethodFixture,
      id: "mine",
      isBuiltIn: false,
      calibrationLevelsNgPerMl: levels,
    };
    return renderEditor({ method: userMethod });
  }

  it("sends the declared levels in the order they were typed", async () => {
    renderUserMethod();

    fireEvent.change(screen.getByLabelText("Calibration levels (ng/mL)"), {
      target: { value: "10, 1, 5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save as new version" }));

    await waitFor(() => expect(saveAcquisitionMethod).toHaveBeenCalled());
    const [, payload] = vi.mocked(saveAcquisitionMethod).mock.calls[0];
    expect(payload.calibrationLevelsNgPerMl).toEqual([10, 1, 5]);
  });

  it("treats an empty field as a method that declares no ladder", async () => {
    renderUserMethod([1, 2, 5]);

    fireEvent.change(screen.getByLabelText("Calibration levels (ng/mL)"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save as new version" }));

    await waitFor(() => expect(saveAcquisitionMethod).toHaveBeenCalled());
    const [, payload] = vi.mocked(saveAcquisitionMethod).mock.calls[0];
    expect(payload.calibrationLevelsNgPerMl).toEqual([]);
  });

  it("shows the ladder already declared by the method", () => {
    renderUserMethod([1, 2, 5]);

    expect(screen.getByLabelText("Calibration levels (ng/mL)")).toHaveValue("1, 2, 5");
  });

  it("refuses to save a ladder that is not a list of positive numbers", async () => {
    renderUserMethod();

    fireEvent.change(screen.getByLabelText("Calibration levels (ng/mL)"), {
      target: { value: "1, oops, 5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save as new version" }));

    expect(
      await screen.findByText(/Calibration levels must be a list of positive numbers/i),
    ).toBeInTheDocument();
    expect(saveAcquisitionMethod).not.toHaveBeenCalled();
  });

  it("confirms the save, and drops the confirmation as soon as editing resumes", async () => {
    renderUserMethod();

    fireEvent.change(screen.getByLabelText("Calibration levels (ng/mL)"), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save as new version" }));

    // Without this the learner clicks Save and sees nothing change at all.
    expect(await screen.findByTestId("method-saved-confirmation")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Calibration levels (ng/mL)"), {
      target: { value: "10, 20" },
    });

    expect(screen.queryByTestId("method-saved-confirmation")).not.toBeInTheDocument();
  });

  it("keeps the confirmation when the saved method flows back in as a prop", async () => {
    // Saving hands the stored method back up, and the parent passes it down
    // again. Reloading the fields on that round trip would wipe the very
    // confirmation the save just produced — the learner sees a flash and
    // nothing else.
    const userMethod = {
      ...acquisitionMethodFixture,
      id: "mine",
      isBuiltIn: false,
      calibrationLevelsNgPerMl: [],
    };
    const view = render(
      <LcMsMsMethodEditor method={userMethod} onMethodSaved={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText("Calibration levels (ng/mL)"), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save as new version" }));
    expect(await screen.findByTestId("method-saved-confirmation")).toBeInTheDocument();

    view.rerender(
      <LcMsMsMethodEditor
        method={{ ...userMethod, version: "0.2.0", calibrationLevelsNgPerMl: [10] }}
        onMethodSaved={vi.fn()}
      />,
    );

    expect(screen.getByTestId("method-saved-confirmation")).toBeInTheDocument();
    expect(screen.getByLabelText("Calibration levels (ng/mL)")).toHaveValue("10");
  });

  it("still reloads its fields when a different method is selected", () => {
    const view = render(
      <LcMsMsMethodEditor
        method={{
          ...acquisitionMethodFixture,
          id: "mine",
          isBuiltIn: false,
          calibrationLevelsNgPerMl: [10],
        }}
        onMethodSaved={vi.fn()}
      />,
    );

    view.rerender(
      <LcMsMsMethodEditor
        method={{
          ...acquisitionMethodFixture,
          id: "other",
          name: "Other",
          isBuiltIn: false,
          calibrationLevelsNgPerMl: [1, 2],
        }}
        onMethodSaved={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Calibration levels (ng/mL)")).toHaveValue("1, 2");
    expect(screen.getByLabelText("Method name")).toHaveValue("Other");
  });

  it("refuses a zero or negative level", async () => {
    renderUserMethod();

    fireEvent.change(screen.getByLabelText("Calibration levels (ng/mL)"), {
      target: { value: "1, 0, 5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save as new version" }));

    expect(
      await screen.findByText(/Calibration levels must be a list of positive numbers/i),
    ).toBeInTheDocument();
    expect(saveAcquisitionMethod).not.toHaveBeenCalled();
  });
});
