import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const key = "kosmodrom-expedition-v1";
const career = { version: 1, credits: 100, contractStatus: "completed", cargo: [], flightSeconds: 300 };
const file = (patch = {}) => ({ format: "kosmodrom-save", version: 1, expedition: { position: [24, 2, 0], velocity: [0, 0, 0], target: "mars", fuel: 62, samples: ["mars"], deliveryMission: 1, career, ...patch }, exploration: { planets: ["mars", "earth"], moons: ["earth-moon-1"] } });
const upload = (page, data) => page.locator("#importSaveFile").setInputFiles({ name: "trip.json", mimeType: "application/json", buffer: Buffer.from(typeof data === "string" ? data : JSON.stringify(data)) });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#loading")).toBeHidden();
  await page.locator("#tab-settings").click();
});

test("file preview is non-destructive, cancel keeps state, confirm restores all progress", async ({ page }) => {
  const before = await page.evaluate((key) => localStorage.getItem(key), key);
  await upload(page, file());
  await expect(page.locator("#import-summary")).toContainText("100 кр.");
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(before);
  await page.locator("#import-dialog").getByRole("button", { name: "Отмена", exact: true }).click();
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(before);
  await upload(page, file());
  await Promise.all([page.waitForEvent("load"), page.locator("#confirmImportBtn").click()]);
  await expect(page.locator("#loading")).toBeHidden();
  await page.locator("#contractBtn").click();
  await expect(page.locator("#credit-count")).toHaveText("100");
  await expect(page.locator("#mission-count")).toHaveText("2 из 8");
  await expect(page.locator("#moon-mission-count")).toHaveText("1 из 5");
  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
  expect(state.fuel).toBe(62);
  expect(state.samples).toEqual(["mars"]);
  expect(state.deliveryMission).toBe(1);
  expect(state.position).toEqual([24, 2, 0]);
});

test("downloaded JSON imports back after a different state has been loaded", async ({ page }) => {
  test.setTimeout(60000);
  await upload(page, file());
  await Promise.all([page.waitForEvent("load"), page.locator("#confirmImportBtn").click()]);
  await expect(page.locator("#loading")).toBeHidden();
  await page.locator("#tab-settings").click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#exportSaveBtn").click()]);
  const exported = await readFile(await download.path(), "utf8");
  const parsed = JSON.parse(exported);
  expect(parsed.format).toBe("kosmodrom-save");
  expect(parsed.expedition.career.credits).toBe(100);
  expect(parsed.exploration.planets).toEqual(["mars", "earth"]);
  await upload(page, file({ career: { ...career, credits: 999 } }));
  await Promise.all([page.waitForEvent("load"), page.locator("#confirmImportBtn").click()]);
  await expect(page.locator("#loading")).toBeHidden();
  await page.locator("#tab-settings").click();
  await upload(page, exported);
  await Promise.all([page.waitForEvent("load"), page.locator("#confirmImportBtn").click()]);
  await expect(page.locator("#loading")).toBeHidden();
  await page.locator("#contractBtn").click();
  await expect(page.locator("#credit-count")).toHaveText("100");
});

test("bad JSON, future versions and oversized files leave the current save unchanged", async ({ page }) => {
  const before = await page.evaluate((key) => localStorage.getItem(key), key);
  for (const invalid of ["{broken", { ...file(), version: 999 }, file({ position: ["bad", 1, 2] }), file({ career: { ...career, version: 2 } }), "x".repeat(1024 * 1024 + 1)]) {
    await upload(page, invalid);
    await expect(page.locator("#save-status")).toContainText("Файл не загружен");
    await expect(page.locator("#import-dialog")).toBeHidden();
    expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(before);
  }
});

test("failed confirmed import leaves the original snapshot intact without reloading", async ({ page }) => {
  await page.evaluate((key) => { localStorage.setItem(key, JSON.stringify({ fuel: 21 })); }, key);
  const before = await page.evaluate((key) => localStorage.getItem(key), key);
  await upload(page, file());
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException("full", "QuotaExceededError"); }; });
  await page.locator("#confirmImportBtn").click();
  await expect(page.locator("#import-error")).toContainText("не изменено");
  await expect(page.locator("#import-dialog")).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(before);
});
