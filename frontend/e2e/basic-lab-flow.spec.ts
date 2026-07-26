import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

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

function firstBenchProduceLot(page: Page, slotId: string) {
  return page
    .getByTestId(`bench-slot-${slotId}`)
    .locator(
      '[data-testid^="bench-produce-lot-"], [data-testid^="bench-surface-produce-lot-"]',
    )
    .first();
}

function grossBalanceToolCard(page: Page) {
  return page
    .getByTestId("gross-balance-staged-item")
    .locator('[data-testid^="bench-tool-card-"]')
    .first();
}

async function waitForGrinderLotToReachStartTemperature(page: Page) {
  const grinderLot = page.locator('[data-testid^="grinder-produce-"]').first();
  await expect(grinderLot).toBeVisible();

  await expect
    .poll(
      async () => {
        const text = await grinderLot.textContent();
        const match = text?.match(/(-?\d+(?:\.\d+)?)°C/);
        if (!match) {
          return null;
        }
        return Number(match[1]);
      },
      {
        message: "expected grinder lot temperature to reach cryogenic start threshold",
        timeout: 45_000,
      },
    )
    .toBeLessThanOrEqual(-20);
}

async function ensureWorkbenchToolIsOpen(page: Page, label: string) {
  const openButton = page.getByRole("button", { name: `Open ${label}` });
  if (await openButton.count()) {
    await openButton.click();
  }
}

test.describe("Basic lab flow", () => {
  test.setTimeout(240_000);

  test("receives, registers, cuts, chills, grinds, and jars the incoming lot", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "New experiment" }).click();
    await expect(page.getByTestId("bench-slot-station_1")).toBeVisible();

    await expandToolbarCategory(page, "Workspace equipment");
    await expandToolbarCategory(page, "Reagents & materials");
    await expandToolbarCategory(page, "MISC");

    await dragAndDrop(
      page.getByTestId("toolbar-item-gross_balance_widget"),
      page.getByTestId("widget-workspace"),
    );
    await dragAndDrop(
      page.getByTestId("toolbar-item-cryogenic_grinder_widget"),
      page.getByTestId("widget-workspace"),
    );

    await expect(page.getByTestId("gross-balance-dropzone")).toBeVisible();
    await expect(page.getByTestId("grinder-dropzone")).toBeVisible();

    await page.getByTestId("basket-open-button").click();
    await expect(page.getByTestId("basket-received-bag")).toBeVisible();

    await dragAndDrop(
      page.getByTestId("basket-received-bag"),
      page.getByTestId("gross-balance-dropzone"),
    );

    await expect(page.getByTestId("gross-balance-staged-item")).toContainText("Sealed sampling bag");
    await expect(page.getByText(/\d+\.\d g/).first()).toBeVisible();

    const createLimsRecordButton = page.getByRole("button", { name: "Create LIMS record" });
    await page.getByLabel("Orchard / producer").fill("Verger Saint-Martin");
    await page.locator('input[type="date"]').fill("2026-03-29");
    await page.getByLabel("Indicative field mass (g)").fill("2500");
    await page.getByLabel("Sample mass (g)").fill("10");
    await expect(createLimsRecordButton).toBeEnabled();
    await createLimsRecordButton.evaluate((element) => {
      (element as HTMLButtonElement).click();
    });

    await expect(page.getByRole("button", { name: "Print label" })).toBeEnabled({
      timeout: 10_000,
    });
    await page.getByRole("button", { name: "Print label" }).evaluate((element) => {
      (element as HTMLButtonElement).click();
    });
    await expect(page.getByTestId("lims-printed-ticket")).toBeVisible();

    await dragAndDrop(
      page.getByTestId("lims-printed-ticket"),
      page.getByTestId("gross-balance-staged-item"),
    );

    await expect(page.getByTestId("lims-printed-ticket")).toHaveCount(0);
    await expect(page.getByTestId("gross-balance-staged-item")).toContainText(/APP-2026-/);

    await page.getByTestId("add-workbench-slot-button").click();
    await expect(page.getByTestId("bench-slot-station_3")).toBeVisible();

    await dragAndDrop(grossBalanceToolCard(page), page.getByTestId("bench-slot-station_1"));

    await expect(page.getByTestId("bench-slot-station_1")).toContainText("Sealed sampling bag");
    await expect(page.getByTestId("gross-balance-staged-item")).toHaveCount(0);
    await page.getByRole("button", { name: "Open Sealed sampling bag" }).click();
    await expect(firstBenchProduceLot(page, "station_1")).toHaveAttribute("draggable", "true");

    await dragAndDrop(firstBenchProduceLot(page, "station_1"), page.getByTestId("bench-slot-station_2"));
    await expect(firstBenchProduceLot(page, "station_1")).toHaveCount(0);
    await expect(firstBenchProduceLot(page, "station_2")).toBeVisible();

    await page.getByRole("button", { name: "Stainless steel knife" }).click();
    await firstBenchProduceLot(page, "station_2").click();
    await page.getByRole("button", { name: "Stainless steel knife" }).click();

    await dragAndDrop(firstBenchProduceLot(page, "station_2"), page.getByTestId("grinder-dropzone"));
    await expect(page.locator('[data-testid^="grinder-produce-"]').first()).toBeVisible();

    await expandToolbarCategory(page, "Reagents & materials");
    await dragAndDrop(
      page.getByTestId("toolbar-item-dry_ice_pellets"),
      page.getByTestId("grinder-dropzone"),
    );
    await page.getByLabel("Dry ice draft mass").fill("10000");
    await page.getByTestId("grinder-dropzone").getByRole("button", { name: "Add" }).click();
    await expect(page.locator('[data-testid^="grinder-liquid-"]').first()).toBeVisible();
    await waitForGrinderLotToReachStartTemperature(page);

    const grinderPowerButton = page.getByTestId("grinder-power-button");
    for (let attempt = 0; attempt < 15; attempt += 1) {
      await expect(grinderPowerButton).toBeEnabled();
      await grinderPowerButton.evaluate((element) => {
        (element as HTMLButtonElement).click();
      });
      try {
        await expect(page.getByTestId("grinder-lcd-status")).toHaveText("RUNNING", {
          timeout: 2_000,
        });
        break;
      } catch (error) {
        if (attempt === 14) {
          throw error;
        }
        await page.waitForTimeout(1_000);
      }
    }

    await expect(page.getByText(/grinding started in Cryogenic grinder/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("grinder-lcd-status")).toHaveText("COMPLETE", {
      timeout: 45_000,
    });
    await expect(page.getByText(/ground in Cryogenic grinder/i)).toBeVisible({
      timeout: 10_000,
    });

    await expandToolbarCategory(page, "Containers");
    await dragAndDrop(
      page.getByTestId("toolbar-item-hdpe_storage_jar_2l"),
      page.getByTestId("bench-slot-station_3"),
    );
    await expect(page.getByTestId("bench-slot-station_3")).toContainText("Wide-neck HDPE jar");
    await ensureWorkbenchToolIsOpen(page, "Wide-neck HDPE jar");

    await dragAndDrop(
      page.locator('[data-testid^="grinder-produce-"]').first(),
      page.getByTestId("bench-slot-station_3"),
    );

    await expect(page.locator('[data-testid^="grinder-produce-"]')).toHaveCount(0);
    await expect(page.getByText(/Cryogenic grinder to Wide-neck HDPE jar/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("bench-slot-station_3")).toContainText("Wide-neck HDPE jar");
  });
});
