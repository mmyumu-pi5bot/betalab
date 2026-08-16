import { expect, test, type Page } from "@playwright/test";

import { dragAndDrop } from "./support/drag-and-drop";

// The inventory sections start collapsed and the coach never opens them itself: it
// asks the learner to, so every objective reaching into the inventory starts here.
async function openWorkspaceEquipment(page: Page) {
  const toggle = page.getByRole("button", { name: /Workspace equipment/i });
  await expect(page.getByRole("complementary", { name: "Guided tutorial" })).toContainText(
    "Open the Workspace equipment section",
  );
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
}

test.describe("Guided tutorial", () => {
  test("creates a dedicated session and follows the first durable objective", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "New tutorial" }).click();

    await expect(page).toHaveURL(/\/experiments\/experiment_[^?]+\?tutorial=calibration-sample-v1$/);
    await openWorkspaceEquipment(page);
    await expect(page.getByRole("complementary", { name: "Guided tutorial" })).toContainText(
      "Deploy the Gross balance",
    );

    const grossBalance = page.locator(
      '[data-tutorial-anchor="palette-item-gross_balance_widget"]',
    );
    await expect(grossBalance).toBeVisible();
    await dragAndDrop(
      page.getByTestId("toolbar-item-gross_balance_widget"),
      page.getByTestId("widget-workspace"),
    );

    await expect(page.getByTestId("widget-gross_balance")).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Guided tutorial" })).toContainText(
      "Open the Produce basket",
    );
    await page.getByTestId("basket-open-button").click();
    await expect(page.getByRole("complementary", { name: "Guided tutorial" })).toContainText(
      "Place the sample bag on the Gross balance",
    );

    await page.getByRole("button", { name: "Pause tutorial" }).click();
    await expect(page.getByRole("button", { name: "Resume tutorial" })).toBeVisible();
  });

  test("keeps the action badge clear of the highlighted control", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "New tutorial" }).click();
    await openWorkspaceEquipment(page);
    await expect(page.getByTestId("tutorial-spotlight-action-icon")).toBeVisible();
    // The coach smooth-scrolls the spotlight into view, so let the layout settle.
    await page.waitForTimeout(600);

    const geometry = await page.evaluate(() => {
      const rect = (selector: string) =>
        document.querySelector(selector)!.getBoundingClientRect();
      const badge = rect('[data-testid="tutorial-spotlight-action-icon"]');
      const target = rect('[data-tutorial-anchor="palette-item-gross_balance_widget"]');
      return {
        badge: { bottom: badge.bottom, height: badge.height, left: badge.left, width: badge.width },
        target: { right: target.right, top: target.top },
      };
    });

    // A small control must stay readable under the coach: the badge lives in the
    // halo margin, past the target's top-right corner, never on top of it.
    expect(geometry.badge.width).toBeLessThanOrEqual(30);
    expect(geometry.badge.height).toBeLessThanOrEqual(30);
    expect(geometry.badge.left).toBeGreaterThanOrEqual(geometry.target.right - 1);
    expect(geometry.badge.bottom).toBeLessThanOrEqual(geometry.target.top + 1);
  });

  test("marks the expected drop destination in yellow while an item is dragged", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "New tutorial" }).click();
    await openWorkspaceEquipment(page);
    await expect(page.getByRole("complementary", { name: "Guided tutorial" })).toContainText(
      "Deploy the Gross balance",
    );

    const dropSpotlight = page.getByTestId("tutorial-drop-spotlight");
    await expect(dropSpotlight).toHaveCount(0);

    const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
    await page
      .getByTestId("toolbar-item-gross_balance_widget")
      .dispatchEvent("dragstart", { dataTransfer });

    await expect(dropSpotlight).toBeVisible();
    await expect(dropSpotlight).toHaveCSS("border-style", "dashed");

    // Both rects are read in one frame: the coach smooth-scrolls the source into
    // view, so measuring them in separate calls would compare moving targets.
    const geometry = await page.evaluate(() => {
      const halo = document
        .querySelector('[data-testid="tutorial-drop-spotlight"]')!
        .getBoundingClientRect();
      const canvas = document
        .querySelector('[data-testid="widget-workspace"]')!
        .getBoundingClientRect();
      return {
        canvas: { bottom: canvas.bottom, left: canvas.left, right: canvas.right, top: canvas.top },
        halo: { bottom: halo.bottom, left: halo.left, right: halo.right, top: halo.top },
        viewport: { height: window.innerHeight, width: window.innerWidth },
      };
    });

    const overlapWidth =
      Math.min(geometry.halo.right, geometry.canvas.right) -
      Math.max(geometry.halo.left, geometry.canvas.left);
    const overlapHeight =
      Math.min(geometry.halo.bottom, geometry.canvas.bottom) -
      Math.max(geometry.halo.top, geometry.canvas.top);

    // The halo covers the visible part of the workspace canvas, clamped to the viewport.
    expect(overlapWidth).toBeGreaterThan(200);
    expect(overlapHeight).toBeGreaterThan(100);
    expect(geometry.halo.left).toBeGreaterThanOrEqual(0);
    expect(geometry.halo.top).toBeGreaterThanOrEqual(0);
    expect(geometry.halo.right).toBeLessThanOrEqual(geometry.viewport.width);
    expect(geometry.halo.bottom).toBeLessThanOrEqual(geometry.viewport.height);

    await page.getByTestId("toolbar-item-gross_balance_widget").dispatchEvent("dragend");
    await expect(dropSpotlight).toHaveCount(0);
  });
});
