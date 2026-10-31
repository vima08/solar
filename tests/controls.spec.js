import { test, expect } from "@playwright/test";

test("arrows steer the ship when dashboard tabs, sliders, buttons and summaries have focus", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#loading")).toBeHidden();
  await page.locator("#flightBtn").click();
  await page.keyboard.press("Alt+4");
  // Exercise the production controls with a separate ship so attitude can be measured.
  await page.evaluate(async () => {
    const THREE = await import("three");
    const { createShipControls } = await import("./js/ui/ship-controls.js");
    const ship = new THREE.Group();
    const controls = createShipControls(ship, new THREE.Vector3(), {
      isActive: () => true, isSimple: () => true, hasFuel: () => true, consumeFuel: () => {},
    });
    window.pilotTest = { ship, controls };
  });
  const originalVolume = await page.locator("#musicVolume").inputValue();
  for (const focus of ["#tab-settings", "#musicVolume", "#quizBtn", "#sound-panel summary"]) {
    await page.locator(focus).focus();
    for (const [key, axis, sign] of [["ArrowUp", "x", 1], ["ArrowDown", "x", -1], ["ArrowLeft", "z", -1], ["ArrowRight", "z", 1]]) {
      await page.evaluate(() => window.pilotTest.ship.quaternion.identity());
      await page.keyboard.down(key);
      const attitude = await page.evaluate(() => {
        window.pilotTest.controls.update(0.25);
        return window.pilotTest.ship.quaternion.toArray();
      });
      expect(attitude[axis === "x" ? 0 : 2] * sign).toBeGreaterThan(0.05);
      await page.keyboard.up(key);
      const released = await page.evaluate(() => {
        window.pilotTest.controls.update(0.25);
        return window.pilotTest.ship.quaternion.toArray();
      });
      expect(released).toEqual(attitude);
      await expect(page.locator("#tab-settings")).toHaveAttribute("aria-selected", "true");
      await expect(page.locator("#musicVolume")).toHaveValue(originalVolume);
    }
  }
  await page.keyboard.press("Alt+P");
  await expect(page.locator("#dashboard")).toBeHidden();
  await page.keyboard.press("Alt+3");
  await expect(page.locator("#panel-missions")).toBeVisible();
});
