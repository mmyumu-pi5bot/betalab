import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", async () => await import("@/test-support/api-mock"));

import { LcMsMsMethodManager } from "@/components/lcmsms-method-manager";
import {
  acquisitionMethodCatalogFixture,
  acquisitionMethodFixture,
} from "@/test-support/acquisition-method-fixture";
import {
  deleteAcquisitionMethod,
  duplicateAcquisitionMethod,
  getAcquisitionMethod,
  resetApiMocks,
  saveAcquisitionMethod,
} from "@/test-support/api-mock";
import type { AcquisitionMethodSummary } from "@/types/workbench";

const userMethodSummary: AcquisitionMethodSummary = {
  id: "my_method",
  name: "My method",
  version: "0.1.0",
  runtimeS: 720,
  isEducational: true,
  provenanceNote: "Educational method.",
  isBuiltIn: false,
  compoundCount: 1,
  transitionCount: 2,
};

const userMethod = {
  ...acquisitionMethodFixture,
  id: "my_method",
  name: "My method",
  version: "0.1.0",
  isBuiltIn: false,
};

function renderManager(overrides: Partial<Parameters<typeof LcMsMsMethodManager>[0]> = {}) {
  const props = {
    catalog: acquisitionMethodCatalogFixture,
    onClose: vi.fn(),
    onLibraryChanged: vi.fn(),
    onMethodSelected: vi.fn(),
    revision: 0,
    selectedMethodId: acquisitionMethodFixture.id,
    ...overrides,
  };
  return { ...render(<LcMsMsMethodManager {...props} />), props };
}

describe("LcMsMsMethodManager", () => {
  beforeEach(() => {
    resetApiMocks();
  });

  it("opens as a modal dialog listing the whole method library", async () => {
    renderManager({ catalog: [...acquisitionMethodCatalogFixture, userMethodSummary] });

    const dialog = await screen.findByRole("dialog", { name: "Acquisition method manager" });
    expect(dialog).toHaveAttribute("aria-modal", "true");

    const entries = within(dialog).getAllByTestId("method-library-entry");
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent("Apple pesticides — MRM");
    expect(entries[0]).toHaveTextContent("Built-in");
    expect(entries[1]).toHaveTextContent("My method");
  });

  it("marks the method the sequence currently uses", () => {
    renderManager({ catalog: [...acquisitionMethodCatalogFixture, userMethodSummary] });

    const entries = screen.getAllByTestId("method-library-entry");
    expect(entries[0]).toHaveTextContent("In use");
    expect(entries[1]).not.toHaveTextContent("In use");
  });

  it("renders the previewed method details read-only", async () => {
    renderManager();

    const viewer = await screen.findByRole("region", { name: "Acquisition method details" });
    expect(within(viewer).getByTestId("method-transition-count")).toHaveTextContent("3");
    expect(within(viewer).getByTestId("method-glossary")).toHaveTextContent(/precursor/i);
  });

  it("previews another method without touching the sequence", async () => {
    vi.mocked(getAcquisitionMethod).mockImplementation((methodId) =>
      Promise.resolve(methodId === "my_method" ? userMethod : acquisitionMethodFixture),
    );
    const { props } = renderManager({
      catalog: [...acquisitionMethodCatalogFixture, userMethodSummary],
    });

    // `pressed` narrows to the preview button; the delete button carries the
    // method name too.
    fireEvent.click(screen.getByRole("button", { name: /My method/, pressed: false }));

    await waitFor(() => expect(getAcquisitionMethod).toHaveBeenCalledWith("my_method"));
    expect(props.onMethodSelected).not.toHaveBeenCalled();
  });

  it("adopts the previewed method only when asked to", async () => {
    vi.mocked(getAcquisitionMethod).mockImplementation((methodId) =>
      Promise.resolve(methodId === "my_method" ? userMethod : acquisitionMethodFixture),
    );
    const { props } = renderManager({
      catalog: [...acquisitionMethodCatalogFixture, userMethodSummary],
    });

    // `pressed` narrows to the preview button; the delete button carries the
    // method name too.
    fireEvent.click(screen.getByRole("button", { name: /My method/, pressed: false }));
    await waitFor(() => expect(getAcquisitionMethod).toHaveBeenCalledWith("my_method"));
    fireEvent.click(screen.getByRole("button", { name: "Use for this sequence" }));

    expect(props.onMethodSelected).toHaveBeenCalledWith("my_method");
  });

  it("duplicates the previewed method under the name the user types", async () => {
    const { props } = renderManager();

    fireEvent.change(await screen.findByLabelText("Copy name"), {
      target: { value: "Apple screening 2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Duplicate method" }));

    await waitFor(() => expect(duplicateAcquisitionMethod).toHaveBeenCalled());
    expect(duplicateAcquisitionMethod).toHaveBeenCalledWith({
      sourceMethodId: acquisitionMethodFixture.id,
      newMethodId: "apple_screening_2026",
      name: "Apple screening 2026",
      version: "0.1.0",
    });
    await waitFor(() => expect(props.onLibraryChanged).toHaveBeenCalled());
  });

  it("never reuses an identifier when duplicating twice", async () => {
    renderManager();

    const nameField = await screen.findByLabelText("Copy name");
    const duplicateButton = screen.getByRole("button", { name: "Duplicate method" });

    fireEvent.change(nameField, { target: { value: "Draft" } });
    fireEvent.click(duplicateButton);
    await waitFor(() => expect(duplicateAcquisitionMethod).toHaveBeenCalledTimes(1));

    fireEvent.change(await screen.findByLabelText("Copy name"), { target: { value: "Draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Duplicate method" }));
    await waitFor(() => expect(duplicateAcquisitionMethod).toHaveBeenCalledTimes(2));

    const ids = vi.mocked(duplicateAcquisitionMethod).mock.calls.map(([call]) => call.newMethodId);
    expect(ids).toEqual(["draft", "draft_2"]);
  });

  it("edits the duplicated copy instead of the built-in method", async () => {
    renderManager();

    fireEvent.click(await screen.findByRole("button", { name: "Duplicate method" }));

    const editor = await screen.findByRole("region", { name: "Acquisition method editor" });
    await waitFor(() => expect(within(editor).getByLabelText("Method name")).toBeInTheDocument());
  });

  it("keeps an edited m/z through the whole duplicate-then-edit flow", async () => {
    renderManager();

    fireEvent.click(await screen.findByRole("button", { name: "Duplicate method" }));
    await screen.findByRole("region", { name: "Acquisition method editor" });
    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));

    const rows = await screen.findAllByTestId("editor-transition-row");
    const field = within(rows[0]).getByLabelText("Q1 (m/z)") as HTMLInputElement;
    for (const step of ["2", "21", "213", "213.", "213.1"]) {
      fireEvent.change(field, { target: { value: step } });
    }

    expect(field.value).toBe("213.1");

    fireEvent.click(screen.getByRole("button", { name: "Save as new version" }));
    await waitFor(() => expect(saveAcquisitionMethod).toHaveBeenCalled());
    expect(vi.mocked(saveAcquisitionMethod).mock.calls[0][1].transitions[0].q1Mz).toBe(213.1);
  });

  it("refuses to edit a built-in method and points at duplication", async () => {
    renderManager();

    fireEvent.click(await screen.findByRole("tab", { name: "Edit" }));

    const editor = await screen.findByRole("region", { name: "Acquisition method editor" });
    expect(editor).toHaveTextContent(/built-in method.*cannot be edited/i);
    expect(within(editor).queryByLabelText("Method name")).not.toBeInTheDocument();
  });

  it("deletes a user method behind a confirmation and never a built-in one", async () => {
    vi.mocked(getAcquisitionMethod).mockImplementation((methodId) =>
      Promise.resolve(methodId === "my_method" ? userMethod : acquisitionMethodFixture),
    );
    const { props } = renderManager({
      catalog: [...acquisitionMethodCatalogFixture, userMethodSummary],
    });

    expect(
      screen.queryByRole("button", { name: /Delete Apple pesticides/ }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete My method" }));
    expect(deleteAcquisitionMethod).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirm deleting My method" }));
    await waitFor(() => expect(deleteAcquisitionMethod).toHaveBeenCalledWith("my_method"));
    expect(props.onLibraryChanged).toHaveBeenCalled();
  });

  it("falls back to a built-in method when the sequence used the deleted one", async () => {
    const { props } = renderManager({
      catalog: [...acquisitionMethodCatalogFixture, userMethodSummary],
      selectedMethodId: "my_method",
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete My method" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm deleting My method" }));

    await waitFor(() =>
      expect(props.onMethodSelected).toHaveBeenCalledWith(acquisitionMethodFixture.id),
    );
  });

  it("closes on the close button, on the backdrop and on Escape", () => {
    const onClose = vi.fn();
    renderManager({ onClose });

    fireEvent.click(screen.getByRole("button", { name: "Close method manager" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("method-manager-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("surfaces a method that cannot be loaded", async () => {
    vi.mocked(getAcquisitionMethod).mockRejectedValue(new Error("Method service unavailable"));
    renderManager();

    expect(await screen.findByText("Method service unavailable")).toBeInTheDocument();
  });
});
