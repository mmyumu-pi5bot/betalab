import { expect, test } from "@playwright/test";

import { dragAndDrop } from "./support/drag-and-drop";
import { mockWorkbenchApi } from "./support/workbench-api";

async function expandToolbarCategory(page: Parameters<typeof test.beforeEach>[0]["page"], name: string) {
  const toggle = page.getByRole("button", { name: new RegExp(name, "i") });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
}

const savedExperiment = {
  id: "experiment_pesticides",
  last_audit_entry: "Autosampler vial placed in Position 1.",
  last_simulation_at: "2026-04-08T14:15:00Z",
  snapshot_version: 7,
  status: "preparing" as const,
  updated_at: "2026-04-08T14:18:00Z",
};

test.describe("Experiments home", () => {
  test("lists saved experiments from the mocked backend", async ({ page }) => {
    await mockWorkbenchApi(page, { savedExperiments: [savedExperiment] });

    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Saved experiments" })).toBeVisible();
    await expect(page.getByText(savedExperiment.id)).toBeVisible();
    await expect(page.getByText(savedExperiment.last_audit_entry)).toBeVisible();
    await expect(page.getByText("1 session")).toBeVisible();
  });

  test("opens an existing experiment from the home page", async ({ page }) => {
    await mockWorkbenchApi(page, { savedExperiments: [savedExperiment] });

    await page.goto("/");
    await page.getByRole("button", { name: "Open experiment" }).click();

    await expect(page).toHaveURL(/\/experiments\/experiment_pesticides$/);
    await expect(page.getByTestId("bench-slot-station_1")).toBeVisible();
  });

  test("deletes a saved experiment from the home page", async ({ page }) => {
    await mockWorkbenchApi(page, { savedExperiments: [savedExperiment] });

    await page.goto("/");
    await page.getByRole("button", { name: "Delete" }).click();

    await expect(page.getByText("0 sessions")).toBeVisible();
    await expect(page.getByText("No saved experiments yet.")).toBeVisible();
    await expect(page.getByText(savedExperiment.id)).toHaveCount(0);
  });
});

test.describe("Pesticide workbench", () => {
  let api: Awaited<ReturnType<typeof mockWorkbenchApi>>;

  test.beforeEach(async ({ page }) => {
    api = await mockWorkbenchApi(page);
    await page.goto("/");
    await page.getByRole("button", { name: "New experiment" }).click();
    await expect(page.getByTestId("bench-slot-station_1")).toBeVisible();
  });

  test("loads the initial lab workspace from the mocked backend", async ({ page }) => {
    await expect(page.getByText("Empty station")).toHaveCount(2);

    await expandToolbarCategory(page, "Workspace equipment");
    await expandToolbarCategory(page, "MISC");

    await expect(page.getByTestId("toolbar-item-autosampler_rack_widget")).toBeVisible();
    await expect(page.getByTestId("toolbar-item-lc_msms_instrument_widget")).toBeVisible();
    await expect(page.getByTestId("toolbar-item-sealed_sampling_bag")).toBeVisible();
    await expect(page.getByTestId("widget-basket")).toBeVisible();
    await expect(page.getByTestId("widget-rack")).toHaveCount(0);
    await expect(page.getByTestId("widget-instrument")).toHaveCount(0);
  });

  test("adds rack and instrument widgets from the palette onto the workspace", async ({ page }) => {
    await expandToolbarCategory(page, "Workspace equipment");

    await dragAndDrop(
      page.getByTestId("toolbar-item-autosampler_rack_widget"),
      page.getByTestId("widget-workspace"),
    );
    await dragAndDrop(
      page.getByTestId("toolbar-item-lc_msms_instrument_widget"),
      page.getByTestId("widget-workspace"),
    );

    await expect(page.getByTestId("widget-rack")).toBeVisible();
    await expect(page.getByTestId("widget-instrument")).toBeVisible();
    expect(api.commands).toMatchObject([
      {
        payload: expect.objectContaining({ widget_id: "rack" }),
        type: "add_workspace_widget",
      },
      {
        payload: expect.objectContaining({ widget_id: "instrument" }),
        type: "add_workspace_widget",
      },
    ]);
  });

  test("adds and removes a workbench station through the real browser UI", async ({ page }) => {
    await expect(page.getByTestId("bench-slot-station_3")).toHaveCount(0);

    await page.getByTestId("add-workbench-slot-button").click();
    await expect(page.getByTestId("bench-slot-station_3")).toBeVisible();

    await page.getByTestId("remove-workbench-slot-button-station_3").click();
    await expect(page.getByTestId("bench-slot-station_3")).toHaveCount(0);
  });

  test("stages an autosampler vial from the palette onto the bench and into the rack", async ({
    page,
  }) => {
    await expandToolbarCategory(page, "Workspace equipment");
    await expandToolbarCategory(page, "Containers");

    await dragAndDrop(
      page.getByTestId("toolbar-item-autosampler_rack_widget"),
      page.getByTestId("widget-workspace"),
    );

    await expect(page.getByTestId("widget-rack")).toBeVisible();
    await expect(page.getByTestId("rack-summary")).toContainText("No vial staged yet.");

    await dragAndDrop(
      page.getByTestId("toolbar-item-sample_vial_lcms"),
      page.getByTestId("bench-slot-station_1"),
    );

    await expect(page.getByTestId("bench-slot-station_1")).toContainText("Autosampler vial");

    await dragAndDrop(
      page.getByTestId("bench-tool-card-bench_tool_sample_vial_lcms"),
      page.getByTestId("rack-illustration-slot-1"),
    );

    await expect(page.getByTestId("rack-slot-summary-1")).toContainText("Autosampler vial");
    await expect(page.getByTestId("bench-slot-station_1")).toContainText("Empty station");
    expect(api.commands).toMatchObject([
      {
        payload: expect.objectContaining({ widget_id: "rack" }),
        type: "add_workspace_widget",
      },
      {
        payload: {
          destination: { id: "station_1", kind: "workbench_slot" },
          entity: { id: "sample_vial_lcms", kind: "tool" },
          source: { id: "sample_vial_lcms", kind: "palette" },
        },
        type: "move_object",
      },
      {
        payload: {
          destination: { id: "rack_slot_1", kind: "rack_slot" },
          entity: { id: "bench_tool_sample_vial_lcms", kind: "tool" },
          source: { id: "station_1", kind: "workbench" },
        },
        type: "move_object",
      },
    ]);
  });

  test("moves a discarded tool into trash and restores it back to the bench", async ({ page }) => {
    await expandToolbarCategory(page, "MISC");

    await dragAndDrop(
      page.getByTestId("toolbar-item-sealed_sampling_bag"),
      page.getByTestId("bench-slot-station_1"),
    );
    await expect(page.getByTestId("bench-slot-station_1")).toContainText("Sealed sampling bag");

    await dragAndDrop(
      page.getByTestId("bench-tool-card-bench_tool_sealed_sampling_bag"),
      page.getByTestId("trash-dropzone"),
    );
    await expect(page.getByTestId("bench-slot-station_1")).toContainText("Empty station");

    await page.getByTestId("trash-dropzone").click();
    await expect(page.getByTestId("trash-tool-trash_tool_1")).toBeVisible();

    await dragAndDrop(
      page.getByTestId("trash-tool-trash_tool_1"),
      page.getByTestId("bench-slot-station_1"),
    );

    await expect(page.getByTestId("bench-slot-station_1")).toContainText("Sealed sampling bag");
    await expect(page.getByTestId("trash-tool-trash_tool_1")).toHaveCount(0);
    expect(api.commands).toEqual([
      {
        payload: {
          destination: { id: "station_1", kind: "workbench_slot" },
          entity: { id: "sealed_sampling_bag", kind: "tool" },
          source: { id: "sealed_sampling_bag", kind: "palette" },
        },
        type: "move_object",
      },
      {
        payload: {
          destination: { id: "trash_bin", kind: "trash_bin" },
          entity: { id: "bench_tool_sealed_sampling_bag", kind: "tool" },
          source: { id: "station_1", kind: "workbench" },
        },
        type: "move_object",
      },
      {
        payload: {
          destination: { id: "station_1", kind: "workbench_slot" },
          entity: { id: "trash_tool_1", kind: "tool" },
          source: { id: "trash_tool_1", kind: "trash" },
        },
        type: "move_object",
      },
    ]);
  });
});
