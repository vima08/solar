import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#loading")).toBeHidden({ timeout: 15_000 });
});

test("starts explorer progress empty and records planets and moons separately", async ({ page }) => {
  await expect(page.locator("#mission-count")).toHaveText("0 из 8");
  await expect(page.locator("#moon-mission-count")).toHaveText("0 из 5");
  await expect(page.locator("#planet-list button.visited")).toHaveCount(0);

  await page.getByRole("button", { name: "Марс", exact: true }).last().click();
  await expect(page.locator("#mission-count")).toHaveText("1 из 8");
  await expect(page.locator("#moon-mission-count")).toHaveText("0 из 5");
  await expect(page.locator('[data-planet="mars"]')).toHaveClass(/visited/);
  await expect(page.locator("#planet-list button.visited")).toHaveCount(1);

  await page.locator('#planet-list [data-object="earth-moon-1"]').click();
  await expect(page.locator("#mission-count")).toHaveText("1 из 8");
  await expect(page.locator("#moon-mission-count")).toHaveText("1 из 5");
  await expect(page.locator('[data-moon="earth-moon-1"]')).toHaveClass(/visited/);
});

test("shows the complete interactive planet navigator", async ({ page }) => {
  await expect(page).toHaveTitle(/КосмоДром/);
  await expect(page.locator("#planet-list button[data-object]")).toHaveCount(15);
  await expect(page.locator("#planet-list .destination-group")).toHaveCount(3);
  await expect(page.locator(".space-label")).toHaveCount(15);
  await expect(page.locator('[data-object="comet"]')).toHaveCount(2);
  await expect(page.locator("canvas")).toBeVisible();
});

test("collapses and expands the destination list", async ({ page }) => {
  await page.locator("#planet-nav summary").click();
  await expect(page.locator("#planet-list")).not.toBeVisible();
  await page.locator("#planet-nav summary").click();
  await expect(page.locator("#planet-list")).toBeVisible();
});

test("toggles space labels from the destination panel heading", async ({ page }) => {
  await expect(page.locator("#planet-list")).toBeVisible();
  await expect(page.locator('.space-label[data-object="sun"]')).toBeVisible();

  await page.locator("#labelsHidden").check();
  await expect(page.locator("#planet-list")).toBeVisible();
  await expect(page.locator('.space-label[data-object="sun"]')).toBeHidden();

  await page.locator("#labelsHidden").uncheck();
  await expect(page.locator('.space-label[data-object="sun"]')).toBeVisible();
});

test("keeps planet labels anchored while they grow on hover", async ({ page }) => {
  const label = page.locator('.space-label[data-object="sun"]');
  const before = await label.boundingBox();
  await label.hover();
  const after = await label.boundingBox();

  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  expect((after.x + after.width / 2) - (before.x + before.width / 2)).toBeCloseTo(0, 1);
});

test("keeps dashboard sections and toolbar separate on desktop and mobile", async ({ page }) => {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    if (await page.locator("#dashboard").isHidden()) await page.locator("#dashboardBtn").click();
    for (const tab of ["route", "ship", "missions", "settings"]) {
      await page.locator('#tab-' + tab).click();
      await expect(page.locator('[role="tabpanel"]:visible')).toHaveCount(1);
      const panel = await page.locator("#dashboard").boundingBox();
      const toolbar = await page.locator("#controls").boundingBox();
      expect(panel.y).toBeGreaterThanOrEqual(60);
      expect(panel.y + panel.height).toBeLessThanOrEqual(toolbar.y);
      expect(panel.x + panel.width).toBeLessThanOrEqual(viewport.width);
    }
  }
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

test("controls simulation time and toggles the tour", async ({ page }) => {
  await page.locator("#tab-settings").click();
  await page.locator("#fastBtn").click();
  await expect(page.locator("#timeScale")).toHaveText("2×");
  await page.locator("#pauseBtn").click();
  await expect(page.locator("#pauseBtn")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator("#tourBtn").click();
  await expect(page.locator("body")).toHaveClass(/tour-active/);
  await expect(page.locator("#tourBtn")).toHaveAttribute("aria-pressed", "true");
  await page.locator("#tourBtn").click();
  await expect(page.locator("body")).not.toHaveClass(/tour-active/);
  await expect(page.locator("#tourBtn")).toHaveAttribute("aria-pressed", "false");
});

test("saves exploration progress and opens the quiz", async ({ page }) => {
  await page.getByRole("button", { name: "Земля", exact: true }).last().click();
  await expect(page.locator("#mission-count")).toHaveText("1 из 8");
  await expect(page.locator('[data-planet="earth"]')).toHaveClass(/visited/);

  await page.locator("#tab-settings").click();
  await page.locator("#quizBtn").click();
  await expect(page.locator("#quiz")).toBeVisible();
  await page.getByRole("button", { name: "Земля", exact: true }).last().click();
  await expect(page.locator("#quiz output")).toContainText("Верно");
  await expect(page.locator("#quiz .quiz-counter")).toHaveText("Вопрос 2 из 8", { timeout: 3_000 });
  await expect(page.locator("#quiz h2")).toContainText("ближе всего");
});

test("engine sound is enabled only in cockpit view", async ({ page }) => {
  await page.locator("#flightBtn").click();
  await expect(page.locator("body")).toHaveClass(/flight-mode/);
  await expect(page.locator("body")).not.toHaveClass(/cockpit-mode/);
  await page.locator("#cockpitBtn").click();
  await expect(page.locator("body")).toHaveClass(/cockpit-mode/);
  await page.locator("#cockpitBtn").click();
  await expect(page.locator("body")).not.toHaveClass(/cockpit-mode/);
});

test("keeps secondary controls out of the flight toolbar", async ({ page }) => {
  for (const id of ["tourDuration", "voiceBtn", "contrastBtn", "motionBtn"]) {
    await expect(page.locator(`#${id}`)).toHaveCount(0);
  }
});

test("persists muted ambient music and supports keyboard navigation in the dashboard", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.locator("#tab-route").focus();
  await page.keyboard.press("End");
  await expect(page.locator("#tab-settings")).toBeFocused();
  await expect(page.locator("#panel-settings")).toBeVisible();
  await page.locator("#musicVolume").fill("0");
  await expect(page.locator("#radio-message")).toContainText("0%");
  await page.reload();
  await expect(page.locator("#loading")).toBeHidden();
  await page.locator("#tab-settings").click();
  await expect(page.locator("#musicVolume")).toHaveValue("0");
  await page.keyboard.press("Escape");
  await expect(page.locator("#dashboard")).toBeHidden();
  await expect(page.locator("#dashboardBtn")).toBeFocused();
  expect(errors).toEqual([]);
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
  await page.locator("#tab-missions").click();
  await page.locator("#missionAction").click();
  await expect(page.locator("#active-mission")).toContainText("Марс");
  await expect(page.locator("#selected")).toHaveText("Марс");
});

test("uses one button to switch between ship and object modes", async ({ page }) => {
  const mode = page.locator("#flightBtn");
  await expect(mode).toHaveText(/На корабль/);
  await mode.click();
  await expect(mode).toHaveText(/На объект/);
  await expect(page.locator("body")).toHaveClass(/flight-mode/);
  await page.locator("#tab-route").click();
  await page.locator('#planet-list [data-object="earth-moon-1"]').click();
  await expect(page.locator("body")).not.toHaveClass(/flight-mode/);
  await expect(mode).toHaveText(/На корабль/);
  await expect(page.locator("#planet-name")).toHaveText("Луна");
});

test("places tour navigation on both sides and documents roll controls", async ({ page }) => {
  const order = await page.locator("#panel-settings button").evaluateAll((buttons) =>
    buttons.map((button) => button.id),
  );
  expect(order.indexOf("tourPrevBtn")).toBeLessThan(order.indexOf("tourBtn"));
  expect(order.indexOf("tourNextBtn")).toBeGreaterThan(order.indexOf("tourBtn"));
  await expect(page.locator("#cockpit-frame span")).toContainText("←/→ · крен");
  await expect(page.locator("#cockpit-frame span")).toContainText("↑/↓ · тангаж");
});
