import { expect, test } from "@playwright/test";

import { dragAndDrop } from "./support/drag-and-drop";

async function expandToolbarCategory(
  page: Parameters<typeof test>[0]["page"],
  name: string,
) {
  const toggle = page.getByRole("button", { name: new RegExp(name, "i") });
  if ((await toggle.getAttribute("aria-expanded")) === "true") {
    return;
  }
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
}

async function setupAnalyticalBalanceTube(page: Parameters<typeof test>[0]["page"]) {
  await page.goto("/");
  await page.getByRole("button", { name: "New experiment" }).click();
  await expect(page.getByTestId("bench-slot-station_1")).toBeVisible();

  await expandToolbarCategory(page, "Workspace equipment");
  await expandToolbarCategory(page, "Containers");
  await expandToolbarCategory(page, "MISC");

  await dragAndDrop(
    page.getByTestId("toolbar-item-analytical_balance_widget"),
    page.getByTestId("widget-workspace"),
  );

  await expect(page.getByTestId("analytical-balance-dropzone")).toBeVisible();

  await dragAndDrop(
    page.getByTestId("toolbar-item-centrifuge_tube_50ml"),
    page.getByTestId("analytical-balance-dropzone"),
  );

  const stagedCard = page
    .getByTestId("analytical-balance-staged-item")
    .locator('[data-testid^="bench-tool-card-"]')
    .first();
  await expect(stagedCard).toContainText("50 mL centrifuge tube");

  return stagedCard;
}

test.describe("Analytical balance sample labels", () => {
  test.setTimeout(180_000);

  test("applies a sample label when dragged from the palette onto the staged tube card", async ({
    page,
  }) => {
    const stagedCard = await setupAnalyticalBalanceTube(page);

    await page.getByTestId("toolbar-item-sampling_bag_label").dragTo(stagedCard);

    await expect(
      page
        .getByTestId("analytical-balance-staged-item")
        .getByLabel("Sample label text"),
    ).toBeVisible();
  });

  test("applies a sample label when dragged from the visible label icon onto the visible tube illustration", async ({
    page,
  }) => {
    await setupAnalyticalBalanceTube(page);

    const labelIcon = page
      .getByTestId("toolbar-item-sampling_bag_label")
      .locator("[data-kind='sample_label']");
    const tubeIllustration = page
      .getByTestId("analytical-balance-staged-item")
      .locator('[data-testid^="bench-tool-illustration-"]')
      .first();

    await labelIcon.dragTo(tubeIllustration);

    await expect(
      page
        .getByTestId("analytical-balance-staged-item")
        .getByLabel("Sample label text"),
    ).toBeVisible();
  });

  test("applies a printed LIMS ticket when dragged onto the staged tube illustration", async ({
    page,
  }) => {
    const stagedCard = await setupAnalyticalBalanceTube(page);

    await page.getByLabel("Orchard / producer").fill("Verger Saint-Martin");
    await page.getByLabel("Harvest date").fill("2026-03-29");
    await page.getByLabel("Indicative field mass (g)").fill("2500");
    await page.getByLabel("Sample mass (g)").fill("10");
    await page.getByRole("button", { name: "Create LIMS record" }).click();
    await page.getByRole("button", { name: "Print label" }).click();

    await dragAndDrop(
      page.getByTestId("lims-printed-ticket"),
      stagedCard.locator('[data-testid^="bench-tool-illustration-"]').first(),
    );

    await expect(
      page
        .getByTestId("analytical-balance-staged-item")
        .getByText("APP-2026-", { exact: false }),
    ).toBeVisible();
  });
});
