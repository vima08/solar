import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { newCareer } from "../js/game/contracts.js";

const key = "kosmodrom-expedition-v1";
const career = (credits = 100) => ({ ...newCareer(), credits, contractStatus: "completed", flightSeconds: 300 });
const saved = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
const button = (page, kind, good) => page.locator(`button[data-kind="${kind}"][data-good="${good}"]`);
async function start(page, data = {}) {
  await page.addInitScript(({ key, data }) => {
    if (!sessionStorage.getItem("market-seed")) {
      localStorage.setItem(key, JSON.stringify(data));
      sessionStorage.setItem("market-seed", "1");
    }
  }, { key, data: { landedOn: "earth", target: "earth", career: career(), ...data } });
  await page.goto("/");
  await expect(page.locator("#loading")).toBeHidden();
  await page.locator("#contractBtn").click();
  await page.locator("#marketBtn").click();
}
async function fly(page, port) {
  await page.locator(`#market-route-${port}`).click();
  await page.locator("#autopilotBtn").click();
  await expect(page.locator("#landBtn")).toBeEnabled({ timeout: 25000 });
  await page.locator("#landBtn").click();
  await page.locator("#contractBtn").click();
  await page.locator("#marketBtn").click();
  await expect(page.locator("#market-port")).toContainText(port === "earth" ? "Земля" : "Марс");
}

test("actual Earth–Mars–Earth trade loop earns 140 with empty tank and survives reload", async ({ page }) => {
  test.setTimeout(90000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await start(page, { fuel: 0 });
  await expect(page.locator('[data-good="components"] .market-margin')).toContainText("10 кр.");
  await button(page, "buy", "components").click({ clickCount: 2 });
  await expect(page.locator("#market-wallet")).toHaveText("40 кр. · Трюм: 2 / 2");
  await expect(button(page, "buy", "water")).toBeDisabled();
  await fly(page, "mars");
  await button(page, "sell", "components").click({ clickCount: 2 });
  await expect(page.locator("#market-result")).toContainText("прибыль: 10 кр.");
  await button(page, "buy", "ore").click({ clickCount: 2 });
  await expect(page.locator("#market-wallet")).toHaveText("84 кр. · Трюм: 2 / 2");
  await fly(page, "earth");
  await button(page, "sell", "ore").click({ clickCount: 2 });
  await expect(page.locator("#market-wallet")).toHaveText("140 кр. · Трюм: 0 / 2");
  await page.reload();
  await expect(page.locator("#loading")).toBeHidden();
  await page.locator("#tab-market").click();
  await expect(page.locator("#market-wallet")).toHaveText("140 кр. · Трюм: 0 / 2");
  expect((await saved(page)).career.lastTrade).toMatchObject({ sequence: 8, basis: 18, profit: 10 });
  expect(errors).toEqual([]);
});

test("bankrupt player carries a free courier job to Mars and resumes trading", async ({ page }) => {
  test.setTimeout(60000);
  await start(page, { career: career(8) });
  await expect(button(page, "buy", "water")).toBeDisabled();
  await page.locator("#reliefAction").click();
  await expect(page.locator("#market-wallet")).toHaveText("8 кр. · Трюм: 1 / 2");
  await page.reload();
  await expect(page.locator("#loading")).toBeHidden();
  await page.locator("#tab-market").click();
  await expect(page.locator("#relief-status")).toContainText("Курьерский груз: 1 место");
  await fly(page, "mars");
  expect((await saved(page)).career.credits).toBe(8);
  await page.locator("#reliefAction").click();
  await expect(page.locator("#market-wallet")).toHaveText("38 кр. · Трюм: 0 / 2");
  await expect(page.locator("#reliefAction")).toBeDisabled();
  await button(page, "buy", "ore").click();
  await expect(page.locator("#market-wallet")).toHaveText("20 кр. · Трюм: 1 / 2");
});

test("failed writes preserve money, cargo and journal; another tab freezes every write", async ({ page, context }) => {
  await start(page);
  const before = (await saved(page)).career;
  await page.evaluate(() => {
    window.originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new DOMException("full", "QuotaExceededError"); };
  });
  await button(page, "buy", "water").click();
  await expect(page.locator("#market-result")).toContainText("Сделка отменена");
  await expect(page.locator("#market-wallet")).toHaveText("100 кр. · Трюм: 0 / 2");
  expect((await saved(page)).career).toEqual(before);
  await page.evaluate(() => { Storage.prototype.setItem = window.originalSetItem; });
  const other = await context.newPage();
  await other.goto("/");
  await other.evaluate((key) => localStorage.setItem(key, JSON.stringify({ career: { version: 99 } })), key);
  await expect(page.locator("#saveWarning")).toContainText("другой вкладке");
  await expect(button(page, "buy", "water")).toBeDisabled();
  await page.locator("#savesBtn").click();
  await expect(page.locator("#reloadSaveBtn")).toBeVisible();
  await page.evaluate(() => dispatchEvent(new Event("pagehide")));
  expect((await saved(page)).career.version).toBe(99);
  await other.close();
});

test("current file roundtrip preserves purchased goods, latest trade and active courier; reset clears all", async ({ page }) => {
  test.setTimeout(60000);
  await start(page, { career: { ...career(12), reliefContract: { sequence: 1, status: "active" } } });
  await button(page, "buy", "water").click();
  const expected = (await saved(page)).career;
  await page.locator("#savesBtn").click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#exportSaveBtn").click()]);
  const exported = await readFile(await download.path(), "utf8");
  expect(JSON.parse(exported).version).toBe(3);
  await page.locator("#resetProgressBtn").click();
  await Promise.all([page.waitForEvent("load"), page.locator("#confirmResetBtn").click()]);
  await expect(page.locator("#loading")).toBeHidden();
  expect((await saved(page)).career).toEqual(newCareer());
  await page.locator("#savesBtn").click();
  await page.locator("#importSaveFile").setInputFiles({ name: "market.json", mimeType: "application/json", buffer: Buffer.from(exported) });
  await Promise.all([page.waitForEvent("load"), page.locator("#confirmImportBtn").click()]);
  await expect(page.locator("#loading")).toBeHidden();
  expect((await saved(page)).career).toEqual(expected);
  await page.locator("#tab-market").click();
  await expect(page.locator("#market-wallet")).toHaveText("0 кр. · Трюм: 2 / 2");
});

test("tablet market supports touch without overlapping flight controls", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await start(page);
  await button(page, "buy", "components").tap();
  await expect(page.locator("#market-wallet")).toHaveText("70 кр. · Трюм: 1 / 2");
  const bounds = await button(page, "buy", "components").boundingBox();
  expect(bounds.height).toBeGreaterThanOrEqual(44);
  expect(bounds.width).toBeGreaterThanOrEqual(44);
  const overlap = await page.evaluate(() => {
    const a = document.getElementById("dashboard").getBoundingClientRect();
    const b = document.getElementById("controls").getBoundingClientRect();
    return a.bottom > b.top && a.right > b.left && a.left < b.right;
  });
  expect(overlap).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("tablet-market.png") });
  await page.setViewportSize({ width: 1180, height: 820 });
  await button(page, "buy", "components").tap();
  await expect(page.locator("#market-wallet")).toHaveText("40 кр. · Трюм: 2 / 2");
  const landscape = await button(page, "sell", "components").boundingBox();
  expect(landscape.height).toBeGreaterThanOrEqual(44);
  expect(landscape.width).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: testInfo.outputPath("tablet-market-landscape.png") });
  await context.close();
});

test("ship recovery preserves market cargo and active courier", async ({ page }) => {
  const state = { ...career(0), marketCargo: [{ goodId: "water", purchasePrice: 12 }], reliefContract: { status: "active", sequence: 4 } };
  await start(page, { career: state, crashed: true, landedOn: null });
  await page.locator("#flightBtn").click();
  expect((await saved(page)).career).toEqual(state);
  expect((await saved(page)).crashed).toBe(false);
});
