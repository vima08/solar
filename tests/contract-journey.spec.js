import { test, expect } from "@playwright/test";

const key = "kosmodrom-expedition-v1";
const cargo = [{ contractId: "earth-mars-equipment", quantity: 1 }];
const career = (status = "available", flightSeconds = 0) => ({ version: 1, credits: 0, contractStatus: status, cargo: status === "active" ? cargo : [], flightSeconds });

async function seed(page, data) {
  await page.addInitScript(({ key, data }) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem(key, JSON.stringify(data));
      sessionStorage.setItem("seeded", "1");
    }
  }, { key, data });
  await page.goto("/");
  await expect(page.locator("#loading")).toBeHidden();
}

async function saved(page) { return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key); }

test("accepts a landed contract, resumes cruise, lands and pays once after reload", async ({ page }) => {
  test.setTimeout(60000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seed(page, { landedOn: "earth", career: career(), samples: ["earth"] });
  await page.locator("#contractBtn").click();
  await page.locator("#contractAction").click();
  expect((await saved(page)).career.cargo).toEqual(cargo);
  await expect(page.locator("#contractAction")).toBeDisabled();
  await page.locator("#contractRoute").click();
  await page.locator("#flightBtn").click();
  await page.locator("#landBtn").click();
  await page.locator("#autopilotBtn").click();
  await expect(page.locator("#cruise-time")).toHaveText(/4:5\d|5:00/);
  // The running timer and position both freeze under pause.
  await page.locator("#tab-settings").click();
  await page.locator("#pauseBtn").click();
  const before = await page.locator("#cruise-time").textContent();
  await page.waitForTimeout(1100);
  await expect(page.locator("#cruise-time")).toHaveText(before);
  await page.locator("#pauseBtn").click();
  await page.locator("#autopilotBtn").click();
  expect((await saved(page)).career.flightSeconds).toBeGreaterThan(0);
  // Use a near-arrival saved fixture for the quick browser regression; full duration is a separate test.
  await page.evaluate((key) => {
    dispatchEvent(new Event("pagehide"));
    const state = JSON.parse(localStorage.getItem(key));
    state.career.flightSeconds = 299;
    localStorage.setItem(key, JSON.stringify(state));
    // Reload uses the validated fixture; prevent the old pagehide handler from overwriting it.
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(k, v) { if (k !== key) original.call(this, k, v); };
  }, key);
  await page.reload();
  await expect(page.locator("#loading")).toBeHidden();
  await page.locator("#flightBtn").click();
  await page.locator("#autopilotBtn").click();
  await expect(page.locator("#landBtn")).toBeEnabled({ timeout: 15000 });
  await page.locator("#landBtn").click();
  await page.locator("#contractBtn").click();
  await page.locator("#contractAction").click();
  await expect(page.locator("#credit-count")).toHaveText("100");
  await expect(page.locator("#cargo-count")).toHaveText("0 / 2");
  expect((await saved(page)).deliveryMission).toBe(1);
  await page.reload();
  await expect(page.locator("#loading")).toBeHidden();
  await page.locator("#contractBtn").click();
  await expect(page.locator("#credit-count")).toHaveText("100");
  await expect(page.locator("#contractAction")).toBeDisabled();
  expect(errors).toEqual([]);
});

test("does not accept a contract from flight and preserves cargo after ship recovery", async ({ page }) => {
  await seed(page, { crashed: true, career: career("active"), target: "earth" });
  await page.locator("#contractBtn").click();
  await expect(page.locator("#contractAction")).toBeDisabled();
  await page.locator("#flightBtn").click();
  expect((await saved(page)).career.cargo).toEqual(cargo);
  expect((await saved(page)).crashed).toBe(false);
});

test("damaged and future saves remain untouched until an explicit recovery decision", async ({ page }) => {
  await seed(page, { landedOn: "earth", career: { ...career(), credits: -1 }, samples: ["earth"] });
  await page.locator("#flightBtn").click();
  await page.waitForTimeout(3000);
  expect((await saved(page)).career.credits).toBe(-1);
  await page.locator("#tab-settings").click();
  await expect(page.locator("#save-status")).toContainText("повреждены");
  await page.locator("#restoreSaveBtn").click();
  expect((await saved(page)).career.credits).toBe(0);
  expect((await saved(page)).samples).toEqual(["earth"]);
});

test("failed writes warn without crashing or claiming persistence", async ({ page }) => {
  await seed(page, { landedOn: "earth", career: career() });
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException("full", "QuotaExceededError"); }; });
  await page.locator("#contractBtn").click();
  await page.locator("#contractAction").click();
  await page.locator("#tab-settings").click();
  await expect(page.locator("#save-status")).toContainText("не сохранён");
  expect((await saved(page)).career.contractStatus).toBe("available");
});

test("full cruise lasts five real minutes and leads to a payable delivery", async ({ page }) => {
  test.setTimeout(360000);
  test.slow();
  await seed(page, { landedOn: "earth", career: career() });
  await page.locator("#contractBtn").click();
  await page.locator("#contractAction").click();
  await page.locator("#contractRoute").click();
  await page.locator("#flightBtn").click();
  await page.locator("#landBtn").click();
  const start = Date.now();
  await page.locator("#autopilotBtn").click();
  await expect(page.locator("#landBtn")).toBeEnabled({ timeout: 335000 });
  const duration = (Date.now() - start) / 1000;
  expect(duration).toBeGreaterThanOrEqual(299);
  expect(duration).toBeLessThan(335);
  await page.locator("#landBtn").click();
  await page.locator("#contractBtn").click();
  await page.locator("#contractAction").click();
  await expect(page.locator("#credit-count")).toHaveText("100");
});
