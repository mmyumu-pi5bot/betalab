import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { dragAndDrop } from "./support/drag-and-drop";

async function expandToolbarCategory(page: Page, name: string) {
  const toggle = page.getByRole("button", { name: new RegExp(name, "i") });
  if ((await toggle.getAttribute("aria-expanded")) === "true") {
    return;
  }
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
}

function benchSlot(page: Page, slotId: string) {
  return page.getByTestId(`bench-slot-${slotId}`);
}

function benchToolCard(slot: Locator) {
  return slot.locator('[data-testid^="bench-tool-card-"]').first();
}

function benchToolIllustration(slot: Locator) {
  return slot.locator('[data-testid^="bench-tool-illustration-"]').first();
}

function storageJarIcon(slot: Locator) {
  return slot.locator("[data-kind='storage_jar']").first();
}

async function ensureWorkbenchToolIsOpen(page: Page, label: string) {
  const openButton = page.getByRole("button", { name: `Open ${label}` });
  if (await openButton.count()) {
    await openButton.click();
  }
}

test.describe("Debug powder fraction state", () => {
  test.setTimeout(240_000);

  test("keeps the source jar as ground after powder from the same lot becomes slurry in a tube", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "New experiment" }).click();

    const station1 = benchSlot(page, "station_1");
    const station2 = benchSlot(page, "station_2");
    await expect(station1).toBeVisible();
    await expect(station2).toBeVisible();
    await expect(page.getByTestId("widget-debug-inventory")).toBeVisible();

    await expandToolbarCategory(page, "Containers");
    await expandToolbarCategory(page, "Liquids");

    await dragAndDrop(page.getByTestId("toolbar-item-hdpe_storage_jar_2l"), station1);
    await dragAndDrop(page.getByTestId("toolbar-item-centrifuge_tube_50ml"), station2);

    await expect(station1).toContainText("Wide-neck HDPE jar");
    await expect(station2).toContainText("50 mL centrifuge tube");

    await ensureWorkbenchToolIsOpen(page, "Wide-neck HDPE jar");

    await dragAndDrop(page.getByTestId("debug-palette-preset-apple_powder_residual_co2"), station1);
    await expect(page.getByLabel("Debug powder mass")).toHaveValue("2450");
    await page.getByRole("button", { name: "Spawn" }).click();

    await expect(station1).toContainText("Apple powder lot");
    await expect(storageJarIcon(station1)).toHaveAttribute("data-primary-produce-cut-state", "ground");

    await page.getByRole("button", { name: "Powder spatula" }).click();
    await benchToolIllustration(station1).click();
    await expect(page.getByText(/Spatula loaded from Wide-neck HDPE jar\./i)).toBeVisible({
      timeout: 10_000,
    });

    await benchToolCard(station2).click({
      position: { x: 24, y: 32 },
    });
    await expect(page.getByText(/Powder transferred into 50 mL centrifuge tube\./i)).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole("button", { name: "Powder spatula" }).click();
    await dragAndDrop(page.getByTestId("toolbar-item-acetonitrile_extraction"), station2);
    await expect(page.getByLabel("Acetonitrile draft volume")).toHaveValue("10");
    await station2.getByRole("button", { name: "Add" }).click();

    await expect(page.getByText(/Acetonitrile added to 50 mL centrifuge tube/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(storageJarIcon(station1)).toHaveAttribute("data-primary-produce-cut-state", "ground");
  });
});
