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
  await expect(page.locator("#planet-list button")).toHaveCount(15);
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

test("keeps planet labels anchored while they grow on hover", async ({ page }) => {
  const label = page.locator('.space-label[data-object="sun"]');
  const before = await label.boundingBox();
  await label.hover();
  const after = await label.boundingBox();

  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  expect((after.x + after.width / 2) - (before.x + before.width / 2)).toBeCloseTo(0, 1);
});

test("places the sound mixer above the onboard computer", async ({ page }) => {
  await page.locator("#sound-panel").evaluate((panel) => { panel.open = true; });
  const mixer = await page.locator("#sound-panel").boundingBox();
  const computer = await page.locator("#planet-panel").boundingBox();

  expect(mixer).not.toBeNull();
  expect(computer).not.toBeNull();
  expect(mixer.y + mixer.height).toBeLessThanOrEqual(computer.y);
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

test("uses one button to switch between ship and object modes", async ({ page }) => {
  const mode = page.locator("#flightBtn");
  await expect(mode).toHaveText(/На корабль/);
  await mode.click();
  await expect(mode).toHaveText(/На объект/);
  await expect(page.locator("body")).toHaveClass(/flight-mode/);
  await page.locator('#planet-list [data-object="earth-moon-1"]').click();
  await expect(page.locator("body")).not.toHaveClass(/flight-mode/);
  await expect(mode).toHaveText(/На корабль/);
  await expect(page.locator("#planet-name")).toHaveText("Луна");
});

test("places tour navigation on both sides and documents roll controls", async ({ page }) => {
  const order = await page.locator("#controls > button").evaluateAll((buttons) =>
    buttons.map((button) => button.id),
  );
  expect(order.indexOf("tourPrevBtn")).toBeLessThan(order.indexOf("tourBtn"));
  expect(order.indexOf("tourNextBtn")).toBeGreaterThan(order.indexOf("tourBtn"));
  await expect(page.locator("#cockpit-frame span")).toContainText("←/→ · крен");
  await expect(page.locator("#cockpit-frame span")).toContainText("↑/↓ · тангаж");
});
