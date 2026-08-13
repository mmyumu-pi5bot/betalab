import { expect, test } from "@playwright/test";

import { dragAndDrop } from "./support/drag-and-drop";

test.describe("Guided tutorial", () => {
  test("creates a dedicated session and follows the first durable objective", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "New tutorial" }).click();

    await expect(page).toHaveURL(/\/experiments\/experiment_[^?]+\?tutorial=calibration-sample-v1$/);
    await expect(page.getByRole("complementary", { name: "Guided tutorial" })).toContainText(
      "Weigh the received sample bag",
    );
    await expect(page.getByRole("button", { name: /Workspace equipment/i })).toHaveAttribute(
      "aria-expanded",
      "true",
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
      "Weigh the received sample bag",
    );

    await page.getByRole("button", { name: "Pause tutorial" }).click();
    await expect(page.getByRole("button", { name: "Resume tutorial" })).toBeVisible();
  });
});
