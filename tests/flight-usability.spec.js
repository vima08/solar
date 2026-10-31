import { test, expect } from "@playwright/test";

const key = "kosmodrom-expedition-v1";
const career = { version: 1, credits: 100, contractStatus: "completed", cargo: [], flightSeconds: 300 };

async function start(page, state) {
  await page.addInitScript(({ key, state }) => {
    if (!sessionStorage.getItem("usability-seed")) {
      localStorage.setItem(key, JSON.stringify(state));
      sessionStorage.setItem("usability-seed", "1");
    }
  }, { key, state });
  await page.goto("/");
  await expect(page.locator("#loading")).toBeHidden();
}

const stored = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
async function closeDashboard(page) {
  if (await page.locator("#dashboard").isVisible()) await page.locator("#closeDashboard").click();
}

test("empty tank can fly from landed Mars to Europa with one autopilot action and no Earth stop", async ({ page }) => {
  test.setTimeout(45000);
  await start(page, { fuel: 0, target: "mars", landedOn: "mars", samples: ["mars"], deliveryMission: 1, career });
  await expect(page.locator("#autopilotBtn")).toHaveText(/Автопилот/);
  await expect(page.locator("#autopilotBtn")).toBeDisabled();
  await expect(page.locator("#autopilotBtn")).toHaveAttribute("title", /уже на поверхности/);
  await page.locator("#contractBtn").click();
  await page.locator("#missionAction").click();
  await expect(page.locator("#selected")).toHaveText("Европа");
  await expect(page.locator("#autopilotBtn")).toBeEnabled();
  await page.locator("#autopilotBtn").click();
  await expect(page.locator("body")).toHaveClass(/flight-mode/);
  await expect(page.locator("body")).not.toHaveClass(/landed-mode/);
  await expect(page.locator("#autopilotBtn")).toHaveAttribute("aria-pressed", "true");
  await closeDashboard(page);
  await expect(page.locator("#flight-help-message")).toContainText("Автопилот ведёт");
  await expect(page.locator("#flight-fuel-status")).toContainText("без топлива");
  await expect(page.locator("#landBtn")).toBeEnabled({ timeout: 25000 });
  await expect(page.locator("#flight-help-message")).toContainText("Посадка");
  await page.locator("#landBtn").click();
  const state = await stored(page);
  expect(state.landedOn).toBe("jupiter-moon-2");
  expect(state.deliveryMission).toBe(2);
  expect(state.career).toEqual(career);
  expect(state.fuel).toBe(0);
});

test("emergency fuel restores manual flight without moving the ship or changing cargo, money or missions", async ({ page }) => {
  const active = { ...career, contractStatus: "active", cargo: [{ contractId: "earth-mars-equipment", quantity: 1 }], flightSeconds: 53 };
  await start(page, { fuel: 0, target: "mars", position: [24, 20, 0], career: active, samples: ["mars"], deliveryMission: 1 });
  await closeDashboard(page);
  await expect(page.locator("#emergencyFuelBtn")).toBeVisible();
  await page.locator("#emergencyFuelBtn").click();
  await expect(page.locator("#emergencyFuelBtn")).toBeHidden();
  let state = await stored(page);
  expect(state.fuel).toBe(25);
  expect(state.position).toEqual([24, 20, 0]);
  expect(state.career).toEqual(active);
  expect(state.samples).toEqual(["mars"]);
  expect(state.deliveryMission).toBe(1);
  await page.reload();
  await expect(page.locator("#loading")).toBeHidden();
  await expect(page.locator("#ship-fuel")).toHaveText("25%");
  await page.locator("#flightBtn").click();
  await page.keyboard.down("w");
  await expect(page.locator("#ship-speed")).not.toHaveText("0.0 км/с");
  await page.keyboard.up("w");
  await page.evaluate(() => dispatchEvent(new Event("pagehide")));
  state = await stored(page);
  expect(state.fuel).toBeLessThan(25);
});

test("low fuel warns before empty and paused autopilot explains how to resume", async ({ page }) => {
  await start(page, { fuel: 15, target: "earth", career });
  await closeDashboard(page);
  await expect(page.locator("#flight-fuel-status")).toContainText("Мало топлива: 15%");
  await expect(page.locator("#emergencyFuelBtn")).toBeHidden();
  await page.locator("#savesBtn").click();
  await page.locator("#pauseBtn").click();
  await page.locator("#autopilotBtn").click();
  await closeDashboard(page);
  await expect(page.locator("#flight-help-message")).toContainText("на паузе");
  await page.locator("#resumeFlightBtn").click();
  await expect(page.locator("#flight-help-message")).toContainText("Автопилот ведёт");
  await page.locator("#autopilotBtn").click();
  await expect(page.locator("body")).not.toHaveClass(/autopilot-mode/);
  await expect(page.locator("#resumeFlightBtn")).toBeHidden();
});

test("destroyed ship cannot request emergency fuel or start autopilot", async ({ page }) => {
  await start(page, { fuel: 0, target: "earth", crashed: true, career });
  await closeDashboard(page);
  await expect(page.locator("#emergencyFuelBtn")).toBeHidden();
  await expect(page.locator("#autopilotBtn")).toBeDisabled();
  await expect(page.locator("#flight-help-message")).toContainText("разрушен");
});

test.describe("touch discovery", () => {
  test.use({ hasTouch: true });
  test("saves open directly and flight help stays clear of sticks in all orientations", async ({ page }, testInfo) => {
    await start(page, { fuel: 0, target: "earth", career });
    for (const viewport of [{ width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      await page.locator("#savesBtn").tap();
      await expect(page.locator("#save-heading")).toBeFocused();
      await expect(page.locator("#save-heading")).toBeInViewport();
      await expect(page.locator("#save-panel")).toContainText("Автосохранение");
      const button = await page.locator("#savesBtn").boundingBox();
      expect(button.height).toBeGreaterThanOrEqual(44);
      expect(button.x + button.width).toBeLessThanOrEqual(viewport.width);
      await page.locator("#flightBtn").tap();
      if (!await page.locator("body").evaluate((el) => el.classList.contains("flight-mode"))) await page.locator("#flightBtn").tap();
      await closeDashboard(page);
      await expect(page.locator("#emergencyFuelBtn")).toBeVisible();
      await expect(page.locator("#emergencyFuelBtn")).toBeInViewport({ ratio: 1 });
      const helper = await page.locator("#flight-assist").boundingBox();
      const toolbar = await page.locator("#controls").boundingBox();
      expect(helper.y + helper.height).toBeLessThanOrEqual(toolbar.y);
      for (const selector of ["#thrust-stick", "#attitude-stick"]) {
        const stick = await page.locator(selector).boundingBox();
        const overlaps = helper.x < stick.x + stick.width && helper.x + helper.width > stick.x && helper.y < stick.y + stick.height && helper.y + helper.height > stick.y;
        expect(overlaps).toBe(false);
      }
      await page.screenshot({ path: testInfo.outputPath(`help-${viewport.width}.png`) });
    }
    await page.locator("#savesBtn").tap();
    const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#exportSaveBtn").tap()]);
    expect(download.suggestedFilename()).toBe("kosmodrom-save.json");
  });
});
