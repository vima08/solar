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

test("flies to a planet and displays its educational fact", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Земля", exact: true }).last().click();
  await expect(page.locator("#planet-name")).toHaveText("Земля");
  await expect(page.locator("#selected")).toHaveText("Земля");
  await expect(page.locator("#planet-description strong")).toContainText(
    "Океаны",
  );
});

test("controls simulation time, tour and home mode", async ({ page }) => {
  await page.locator("#fastBtn").click();
  await expect(page.locator("#timeScale")).toHaveText("10×");
  await page.locator("#pauseBtn").click();
  await expect(page.locator("#pauseBtn")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator("#tourBtn").click();
  await expect(page.locator("body")).toHaveClass(/tour-active/);
  await page.locator("#resetBtn").click();
  await expect(page.locator("#planet-name")).toHaveText("Солнечная система");
  await expect(page.locator("body")).not.toHaveClass(/tour-active/);
});

test("saves exploration progress and opens the quiz", async ({ page }) => {
  await page.getByRole("button", { name: "Земля", exact: true }).last().click();
  await expect(page.locator("#mission-count")).toHaveText("1 из 8");
  await expect(page.locator('[data-planet="earth"]')).toHaveClass(/visited/);

  await page.locator("#quizBtn").click();
  await expect(page.locator("#quiz")).toBeVisible();
  await page.getByRole("button", { name: "Земля", exact: true }).last().click();
  await expect(page.locator("#quiz output")).toContainText("Верно");
});

test("keeps secondary controls out of the flight toolbar", async ({ page }) => {
  for (const id of ["tourDuration", "voiceBtn", "contrastBtn", "motionBtn"]) {
    await expect(page.locator(`#${id}`)).toHaveCount(0);
  }
});

test("starts a saved expedition with cockpit instruments", async ({ page }) => {
  await page.locator("#flightBtn").click();
  await expect(page.locator("body")).toHaveClass(/flight-mode/);
  await expect(page.locator("#flight-hud")).toBeVisible();
  await page.locator("#cockpitBtn").click();
  await expect(page.locator("body")).toHaveClass(/cockpit-mode/);
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(300);
  await page.keyboard.up("KeyW");
  await expect(page.locator("#ship-fuel")).not.toHaveText("100%");
  await page.locator("#missionAction").click();
  await expect(page.locator("#active-mission")).toContainText("Юпитера");
});
