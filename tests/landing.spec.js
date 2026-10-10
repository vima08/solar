import { test, expect } from "@playwright/test";

test("delivers the probe, collects a sample and returns it to Earth", async ({ page }) => {
  test.setTimeout(90_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto("/");
  await expect(page.locator("#loading")).toBeHidden();
  await expect(page.locator("#landBtn")).toBeDisabled();
  for (const [id, nextMission] of [
    ["mars", "Собери образец на Европе"],
    ["jupiter-moon-2", "Верни образец на Землю"],
    ["earth", "Экспедиция завершена!"],
  ]) {
    await page.locator("#tab-missions").click();
    await page.locator("#missionAction").click();
    // Viewing a destination alone must not complete a delivery.
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("kosmodrom-expedition-v1") ?? "{}").landedOn)).toBeFalsy();
    await page.locator("#flightBtn").click();
    await expect(page.locator("#landBtn")).toBeDisabled();
    await page.locator("#autopilotBtn").click();
    await expect(page.locator("#autopilotBtn")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#landBtn")).toBeEnabled({ timeout: 25_000 });
    await page.locator("#landBtn").click();
    await expect(page.locator("body")).toHaveClass(/landed-mode/);
    await expect(page.locator("#landBtn")).toHaveText("↑ Взлёт");
    await expect(page.locator("#active-mission")).toHaveText(nextMission);
    await expect(page.locator("#autopilotBtn")).toBeDisabled();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("kosmodrom-expedition-v1")).landedOn)).toBe(id);
    if (id === "mars") {
      await page.reload();
      await expect(page.locator("#loading")).toBeHidden();
      await page.locator("#flightBtn").click();
      await expect(page.locator("#flight-warning")).toContainText("На поверхности: Марс");
      await page.keyboard.down("w");
      await page.waitForTimeout(200);
      await page.keyboard.up("w");
      await expect(page.locator("#ship-speed")).toHaveText("0.0 км/с");
    }
    await page.locator("#landBtn").click();
    await expect(page.locator("body")).not.toHaveClass(/landed-mode/);
    await expect(page.locator("#landBtn")).toHaveText("↓ Посадка");
  }
  expect(errors).toEqual([]);
});

test("lets the pilot cancel autopilot and rejects a landing on the Sun", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#loading")).toBeHidden();
  await page.locator("#flightBtn").click();
  await page.locator("#autopilotBtn").click();
  await page.locator("#autopilotBtn").click();
  await expect(page.locator("#autopilotBtn")).toHaveAttribute("aria-pressed", "false");
  await page.locator("#tab-route").click();
  await page.locator('#planet-list [data-object="sun"]').click();
  await page.locator("#flightBtn").click();
  await expect(page.locator("#autopilotBtn")).toBeDisabled();
  await expect(page.locator("#landBtn")).toBeDisabled();
});
