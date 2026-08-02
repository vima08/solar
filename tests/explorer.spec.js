import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#loading")).toBeHidden({ timeout: 15_000 });
});

test("shows the complete interactive planet navigator", async ({ page }) => {
  await expect(page).toHaveTitle(/КосмоДром/);
  await expect(page.locator("#planet-list button")).toHaveCount(8);
  await expect(page.locator(".space-label")).toHaveCount(9);
  await expect(page.locator("canvas")).toBeVisible();
});

test("flies to a planet and displays its educational fact", async ({ page }) => {
  await page.getByRole("button", { name: "Земля", exact: true }).last().click();
  await expect(page.locator("#planet-name")).toHaveText("Земля");
  await expect(page.locator("#selected")).toHaveText("Земля");
  await expect(page.locator("#planet-description strong")).toContainText("Океаны");
});

test("controls simulation time, tour and home mode", async ({ page }) => {
  await page.locator("#fastBtn").click();
  await expect(page.locator("#timeScale")).toHaveText("10×");
  await page.locator("#pauseBtn").click();
  await expect(page.locator("#pauseBtn")).toHaveAttribute("aria-pressed", "true");
  await page.locator("#tourBtn").click();
  await expect(page.locator("body")).toHaveClass(/tour-active/);
  await page.locator("#resetBtn").click();
  await expect(page.locator("#planet-name")).toHaveText("Солнечная система");
  await expect(page.locator("body")).not.toHaveClass(/tour-active/);
});
