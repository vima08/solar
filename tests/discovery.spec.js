import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { newCareer } from "../js/game/contracts.js";
import { discoveryTransition, discoveryDestination } from "../js/game/discovery.js";
import { EUROPA } from "../js/game/discovery-state.js";

const key = "kosmodrom-expedition-v1";
const career = () => ({ ...newCareer(), contractStatus: "completed", credits: 100, flightSeconds: 300 });
const saved = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
async function journal(page) { await page.locator("#contractBtn").click(); }
async function start(page, data = {}) {
  await page.addInitScript(({ key, data }) => {
    if (!sessionStorage.getItem("discovery-seed")) {
      localStorage.setItem(key, JSON.stringify(data));
      sessionStorage.setItem("discovery-seed", "1");
    }
  }, { key, data: { landedOn: "mars", target: "mars", fuel: 0, deliveryMission: 1, career: career(), ...data } });
  await page.goto("/");
  await expect(page.locator("#loading")).toBeHidden();
  await journal(page);
}
async function fly(page) {
  await page.locator("#discoveryRoute").click();
  await page.locator("#autopilotBtn").click();
  await expect(page.locator("#landBtn")).toBeEnabled({ timeout: 25000 });
  await page.locator("#landBtn").click();
  await journal(page);
}
async function find(page) {
  await page.locator("#discoveryAction").click();
  await fly(page);
  expect((await saved(page)).landedOn).toBe(EUROPA);
  await page.locator("#discoveryAction").click();
  await expect(page.locator("#discovery-chapter")).toContainText("То, что сохранил лёд");
}

test("legacy captain discovers Europa, cancels choice, publishes and receives 70 only across two actions", async ({ page }, testInfo) => {
  test.setTimeout(90000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const old = { ...career(), version: 2 };
  delete old.discovery;
  await start(page, { career: old });
  await expect(page.locator("#contractBtn")).toContainText("✦");
  await page.locator("#discoveryAction").click();
  await expect(page.locator("#discoveryAction")).toBeDisabled();
  await expect(page.locator("#discovery-reason")).toContainText("посадку на Европу");
  await fly(page);
  expect((await saved(page)).career.credits).toBe(100);
  await page.locator("#discoveryAction").click();
  await page.locator("#discovery-open").click();
  await expect(page.locator("#discovery-choice-summary")).toContainText("всего 70 кр.");
  await page.locator("#discovery-dialog").getByRole("button", { name: "Отмена", exact: true }).click();
  expect((await saved(page)).career.discovery).toEqual({ stage: "choice", choice: null });
  expect((await saved(page)).career.credits).toBe(100);
  await page.locator("#discovery-open").click();
  await page.locator("#confirmDiscoveryBtn").click();
  await expect(page.locator("#discovery-wallet")).toContainText("140 кр.");
  await expect(page.locator("#discoveryRoute")).toHaveText("Маршрут: Земля →");
  await fly(page);
  expect((await saved(page)).career.credits).toBe(140);
  await page.locator("#discoveryAction").click();
  await expect(page.locator("#discovery-wallet")).toContainText("170 кр.");
  await expect(page.locator("#discovery-ending")).toBeVisible();
  await expect(page.locator("#discovery-log li")).toHaveCount(4);
  await page.screenshot({ path: testInfo.outputPath("open-ending.png") });
  await page.reload();
  await expect(page.locator("#loading")).toBeHidden();
  await journal(page);
  await expect(page.locator("#discovery-next")).toContainText("награда 70 кр.");
  expect((await saved(page)).career.credits).toBe(170);
  expect(errors).toEqual([]);
});

test("recorder and one good fill shared hold immediately; sale cannot remove recorder; delivery frees a slot", async ({ page }) => {
  test.setTimeout(90000);
  await start(page, { career: { ...career(), credits: 88, marketCargo: [{ goodId: "water", purchasePrice: 12 }] } });
  await find(page);
  await page.locator("#discovery-salvage").click();
  await expect(page.locator("#discovery-choice-summary")).toContainText("110 кр.");
  await page.locator("#confirmDiscoveryBtn").click();
  await expect(page.locator("#discovery-wallet")).toHaveText("88 кр. · Трюм: 2 / 2 · регистратор: 1 место");
  await page.locator("#tab-market").click();
  await expect(page.locator("#market-wallet")).toHaveText("88 кр. · Трюм: 2 / 2");
  await journal(page);
  await fly(page);
  expect((await saved(page)).career.credits).toBe(88);
  await page.locator("#tab-market").click();
  const waterBuy = page.locator('button[data-kind="buy"][data-good="water"]');
  const waterSell = page.locator('button[data-kind="sell"][data-good="water"]');
  await expect(waterBuy).toBeDisabled();
  await waterSell.click();
  await expect(waterSell).toBeDisabled();
  await expect(page.locator("#market-wallet")).toHaveText("104 кр. · Трюм: 1 / 2");
  expect((await saved(page)).career.discovery).toEqual({ stage: "return", choice: "salvage" });
  await page.locator('button[data-kind="buy"][data-good="ore"]').click();
  await expect(page.locator("#market-wallet")).toHaveText("86 кр. · Трюм: 2 / 2");
  await journal(page);
  await page.locator("#discoveryAction").click();
  await expect(page.locator("#discovery-wallet")).toHaveText("196 кр. · Трюм: 1 / 2");
  await page.locator("#tab-market").click();
  await expect(page.locator("#market-wallet")).toHaveText("196 кр. · Трюм: 1 / 2");
  await expect(waterBuy).toBeEnabled();
});

test("full hold blocks only recorder; failed write keeps confirmation and both branches; external save freezes it", async ({ page, context }) => {
  await start(page, { landedOn: EUROPA, target: EUROPA, career: { ...career(), credits: 40, marketCargo: Array(2).fill({ goodId: "components", purchasePrice: 30 }), discovery: { stage: "choice", choice: null } } });
  await expect(page.locator("#discovery-salvage")).toBeDisabled();
  await expect(page.locator("#discovery-salvage-reason")).toContainText("1 свободное место");
  await page.locator("#discovery-open").click();
  const before = (await saved(page)).career;
  await page.evaluate(() => {
    window.savedSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new DOMException("quota", "QuotaExceededError"); };
  });
  await page.locator("#confirmDiscoveryBtn").click();
  await expect(page.locator("#discovery-choice-error")).toContainText("не сохранён");
  await expect(page.locator("#discovery-dialog")).toBeVisible();
  expect((await saved(page)).career).toEqual(before);
  await page.evaluate(() => { Storage.prototype.setItem = window.savedSetItem; });
  const other = await context.newPage();
  await other.goto("/");
  await other.evaluate((key) => localStorage.setItem(key, JSON.stringify({ career: { version: 99 } })), key);
  await expect(page.locator("#confirmDiscoveryBtn")).toBeDisabled();
  await page.locator("#discovery-dialog").getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(page.locator("#saveWarning")).toContainText("другой вкладке");
  await page.evaluate(() => dispatchEvent(new Event("pagehide")));
  expect((await saved(page)).career.version).toBe(99);
  await other.close();
});

const states = [];
let state = career();
states.push(["unheard", state]);
state = discoveryTransition(state, "listen", null, "unheard").career;
states.push(["signal", state]);
state = discoveryTransition(state, "survey", EUROPA, "signal").career;
states.push(["choice", state]);
for (const branch of ["open", "salvage"]) {
  const returning = discoveryTransition(state, branch, EUROPA, "choice").career;
  states.push([`return-${branch}`, returning]);
  states.push([`completed-${branch}`, discoveryTransition(returning, "finish", discoveryDestination(returning.discovery), "return").career]);
}
for (const [name, fixture] of states) test(`reload, file export/import and reset retain ${name} correctly`, async ({ page }) => {
  test.setTimeout(60000);
  await start(page, { landedOn: EUROPA, target: EUROPA, career: fixture });
  await page.reload();
  await expect(page.locator("#loading")).toBeHidden();
  await page.locator("#savesBtn").click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#exportSaveBtn").click()]);
  const exported = await readFile(await download.path(), "utf8");
  expect(JSON.parse(exported).expedition.career).toEqual(fixture);
  await page.locator("#resetProgressBtn").click();
  await Promise.all([page.waitForEvent("load"), page.locator("#confirmResetBtn").click()]);
  await expect(page.locator("#loading")).toBeHidden();
  expect((await saved(page)).career).toEqual(newCareer());
  await page.locator("#savesBtn").click();
  await page.locator("#importSaveFile").setInputFiles({ name: "beacon.json", mimeType: "application/json", buffer: Buffer.from(exported) });
  await Promise.all([page.waitForEvent("load"), page.locator("#confirmImportBtn").click()]);
  await expect(page.locator("#loading")).toBeHidden();
  await journal(page);
  expect((await saved(page)).career).toEqual(fixture);
  if (fixture.discovery.stage === "completed") await expect(page.locator("#discovery-ending")).toBeVisible();
});

test("new captain keeps onboarding; crashed captain keeps recorder on recovery", async ({ page, browser }) => {
  await start(page, { career: newCareer() });
  await expect(page.locator("#discovery-panel")).toBeHidden();
  await expect(page.locator("#contractAction")).toBeVisible();
  const context = await browser.newContext();
  const other = await context.newPage();
  const record = states.find(([name]) => name === "return-salvage")[1];
  await start(other, { career: record, crashed: true, landedOn: null });
  await other.locator("#flightBtn").click();
  expect((await saved(other)).career).toEqual(record);
  expect((await saved(other)).crashed).toBe(false);
  await context.close();
});

test("tablet choices and confirmation support touch and cancellation in both orientations", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await start(page, { landedOn: EUROPA, target: EUROPA, career: { ...career(), discovery: { stage: "choice", choice: null } } });
  for (const viewport of [{ width: 768, height: 1024 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    await journal(page);
    await page.locator("#discovery-salvage").tap();
    await expect(page.locator("#discovery-choice-summary")).toContainText("1 свободное место");
    for (const target of [page.locator("#confirmDiscoveryBtn"), page.locator("#discovery-dialog").getByRole("button", { name: "Отмена", exact: true })]) {
      const box = await target.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    const rect = await page.locator("#discovery-dialog").boundingBox();
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width);
    expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height);
    await page.screenshot({ path: testInfo.outputPath(`choice-${viewport.width}.png`) });
    await page.locator("#discovery-dialog").getByRole("button", { name: "Отмена", exact: true }).tap();
    expect((await saved(page)).career.discovery.stage).toBe("choice");
  }
  await context.close();
});

test("Europa beacon is rendered in the actual world after decoding a signal", async ({ page }, testInfo) => {
  await start(page, { career: states.find(([name]) => name === "signal")[1] });
  // Freeze orbital motion with the player's control to frame the small moon.
  await page.locator("#tab-settings").click();
  await page.locator("#pauseBtn").click();
  await journal(page);
  await page.locator("#discoveryRoute").click();
  await expect(page.locator("#selected")).toHaveText("Европа");
  await page.locator("#tab-route").click();
  await page.locator("#labelsHidden").check();
  await page.locator("#closeDashboard").click();
  // Navigation has a 1500 ms camera animation with no completion event.
  await page.waitForTimeout(1800);
  await page.screenshot({ path: testInfo.outputPath("europa-beacon.png") });
});
