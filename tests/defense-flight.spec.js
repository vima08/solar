import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { newCareer } from "../js/game/contracts.js";

const key = "kosmodrom-expedition-v1";
const funded = () => ({ ...newCareer(), contractStatus: "completed", credits: 100, flightSeconds: 300 });
const stored = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
async function start(page, patch = {}) {
  await page.addInitScript(({ key, patch }) => {
    if (!sessionStorage.getItem("defense-flight-seed")) {
      localStorage.setItem(key, JSON.stringify(patch));
      sessionStorage.setItem("defense-flight-seed", "1");
    }
  }, { key, patch: { landedOn: "mars", target: "mars", fuel: 0, career: funded(), ...patch } });
  await page.goto("/");
  await expect(page.locator("#loading")).toBeHidden();
  await page.locator("#contractBtn").click();
}
async function openDefense(page) { await page.locator("#defenseOpen").click(); }

test("real shots destroy three meteors, pay once and practice never changes career", async ({ page }, testInfo) => {
  test.setTimeout(60000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  await openDefense(page);
  await expect(page.locator("#defenseFire")).toBeDisabled();
  await page.locator("#defensePlay").click();
  for (let i = 0; i < 7; i++) {
    await expect(page.locator("#defenseFire")).toBeEnabled({ timeout: 6000 });
    await page.locator("#defenseFire").click();
    if (i === 0) await page.screenshot({ path: testInfo.outputPath("defense-active.png") });
  }
  await expect(page.locator("#defense-result")).toContainText("Сбито: 3/3");
  await expect(page.locator("#defenseClaim")).toBeVisible();
  expect((await stored(page)).career.credits).toBe(100);
  await page.locator("#defenseClaim").click();
  expect((await stored(page)).career.credits).toBe(190);
  await expect(page.locator("#defenseClaim")).toBeHidden();
  await page.locator("#defenseClose").click();
  const before = (await stored(page)).career;
  await page.locator("#defensePractice").click();
  await expect(page.locator("#defense-mode")).toContainText("без наград");
  await page.locator("#defensePlay").click();
  await page.locator("#defenseFire").click();
  await page.locator("#defenseClose").click();
  expect((await stored(page)).career).toEqual(before);
  expect(errors).toEqual([]);
});

test("deadline impacts reduce only the potential reward; no auto payment on resolution", async ({ page }) => {
  await page.clock.install();
  await start(page, { career: { ...funded(), marketCargo: [{ goodId: "water", purchasePrice: 12 }] } });
  await openDefense(page);
  await page.locator("#defensePlay").click();
  await page.clock.fastForward(43000);
  await expect(page.locator("#defense-result")).toContainText("Урон станции: 3/3");
  await expect(page.locator("#defenseClaim")).toHaveText("Получить награду · 0 кр.");
  const before = (await stored(page)).career;
  expect(before.credits).toBe(100);
  expect(before.marketCargo).toEqual([{ goodId: "water", purchasePrice: 12 }]);
  await page.locator("#defenseClaim").click();
  expect((await stored(page)).career.credits).toBe(100);
  expect((await stored(page)).career.defense.stage).toBe("completed");
});

test("pause, close, reload and JSON retain active encounter without offline damage", async ({ page }) => {
  test.setTimeout(60000);
  await start(page);
  await openDefense(page);
  await page.locator("#defensePlay").click();
  await page.locator("#defenseFire").click();
  await page.locator("#defensePlay").click();
  const before = (await stored(page)).career;
  await page.waitForTimeout(1100);
  expect((await stored(page)).career.defense).toEqual(before.defense);
  await page.locator("#defenseClose").click();
  await page.reload();
  await expect(page.locator("#loading")).toBeHidden();
  await page.locator("#contractBtn").click();
  await openDefense(page);
  await expect(page.locator("#defense-clock")).toContainText("пауза");
  await expect(page.locator("#defenseFire")).toBeDisabled();
  expect((await stored(page)).career.defense).toEqual(before.defense);
  await page.locator("#defenseClose").click();
  await page.locator("#savesBtn").click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#exportSaveBtn").click()]);
  const text = await readFile(await download.path(), "utf8");
  expect(JSON.parse(text).expedition.career.defense).toEqual(before.defense);
  await page.locator("#resetProgressBtn").click();
  await Promise.all([page.waitForEvent("load"), page.locator("#confirmResetBtn").click()]);
  await expect(page.locator("#loading")).toBeHidden();
  expect((await stored(page)).career.defense.stage).toBe("available");
  await page.locator("#savesBtn").click();
  await page.locator("#importSaveFile").setInputFiles({ name: "defense.json", mimeType: "application/json", buffer: Buffer.from(text) });
  await Promise.all([page.waitForEvent("load"), page.locator("#confirmImportBtn").click()]);
  await expect(page.locator("#loading")).toBeHidden();
  expect((await stored(page)).career).toEqual(before);
});

test("failed shot write is cancelled and external tab freezes the battery", async ({ page, context }) => {
  await start(page);
  await openDefense(page);
  await page.locator("#defensePlay").click();
  const before = (await stored(page)).career.defense;
  await page.evaluate(() => {
    window.realSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new DOMException("quota", "QuotaExceededError"); };
    document.getElementById("defenseFire").click();
  });
  await expect(page.locator("#defense-error")).toContainText("не сохранён");
  expect((await stored(page)).career.defense.hp).toEqual(before.hp);
  expect((await stored(page)).career.defense.shots).toBe(0);
  await expect(page.locator("#defenseFire")).toBeDisabled();
  await page.evaluate(() => { Storage.prototype.setItem = window.realSetItem; });
  const other = await context.newPage();
  await other.goto("/");
  await other.evaluate((key) => localStorage.setItem(key, JSON.stringify({ career: { version: 99 } })), key);
  await expect(page.locator("#defensePlay")).toBeDisabled();
  await page.evaluate(() => dispatchEvent(new Event("pagehide")));
  expect((await stored(page)).career.version).toBe(99);
  await other.close();
});

test("battery is gated by first contract and Mars; respawn retains encounter", async ({ page, browser }) => {
  await start(page, { landedOn: "earth", target: "earth" });
  await expect(page.locator("#defenseOpen")).toBeDisabled();
  await expect(page.locator("#defense-port-reason")).toContainText("посадку на Марс");
  const context = await browser.newContext();
  const other = await context.newPage();
  const defense = { stage: "active", elapsed: 2, cooldown: 0, hp: [1, 3, 2], shots: 1 };
  await start(other, { career: { ...funded(), defense }, crashed: true, landedOn: null });
  await other.locator("#flightBtn").click();
  expect((await stored(other)).career.defense).toEqual(defense);
  await context.close();
});

test("lab presets calculate gains and impacts, animate, pause and reset without changing the ship", async ({ page }, testInfo) => {
  await start(page, { landedOn: null, position: [24, 2, 0], quaternion: [0, 0, 0, 1], velocity: [0, 0, 0], fuel: 52, career: newCareer() });
  await expect(page.locator("#defense-panel")).toBeHidden();
  await page.keyboard.press("Alt+6");
  await expect(page.locator("#panel-course")).toBeVisible();
  const before = (await stored(page)).career;
  await page.locator('[data-flyby-preset="boost"]').click();
  expect(Number(await page.locator("#flyby-gain").textContent())).toBeGreaterThan(0.1);
  await page.screenshot({ path: testInfo.outputPath("flyby-boost.png") });
  await page.locator('[data-flyby-preset="brake"]').click();
  expect(Number(await page.locator("#flyby-gain").textContent())).toBeLessThan(-0.1);
  await page.locator('[data-flyby-preset="danger"]').click();
  await expect(page.locator("#flyby-status")).toContainText("СТОЛКНОВЕНИЕ");
  await expect(page.locator("#flyby-gain")).toHaveText("—");
  await page.locator('[data-flyby-preset="turn"]').click();
  await page.locator("#flybyPlay").click();
  await expect(page.locator("#flyby-time")).not.toHaveText(/^0\.0 /);
  await page.locator("#flybyPlay").click();
  const paused = await page.locator("#flyby-time").textContent();
  await page.waitForTimeout(500);
  await expect(page.locator("#flyby-time")).toHaveText(paused);
  await page.locator("#flybyReset").click();
  await expect(page.locator("#flyby-speed")).toHaveValue("0.7");
  await expect(page.locator("#flyby-time")).toHaveText(/^0\.0 /);
  await page.evaluate(() => dispatchEvent(new Event("pagehide")));
  const after = await stored(page);
  expect(after.career).toEqual(before);
  expect(after.position).toEqual([24, 2, 0]); expect(after.fuel).toBe(52);
});

test("touch battery and lab stay usable in both tablet orientations", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await start(page);
  for (const viewport of [{ width: 768, height: 1024 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    await page.locator("#contractBtn").tap();
    await page.locator("#defenseOpen").tap();
    for (const locator of [page.locator("#defensePlay"), page.locator("#defenseFire"), page.locator("#defenseClose"), page.locator('[data-meteor="0"]')]) {
      await locator.scrollIntoViewIfNeeded();
      const box = await locator.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.locator("#defenseClose").tap();
    await page.locator("#tab-course").tap();
    await page.locator('[data-flyby-preset="boost"]').tap();
    expect(Number(await page.locator("#flyby-gain").textContent())).toBeGreaterThan(0);
    for (const input of ["flyby-speed", "flyby-offset", "flyby-planet-speed"]) {
      await page.locator(`#${input}`).scrollIntoViewIfNeeded();
      const box = await page.locator(`#${input}`).boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.locator('[data-flyby-preset="boost"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`tablet-lab-${viewport.width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await context.close();
});

test("battery explicitly suspends on simulated visibility changes and the global pause", async ({ page }) => {
  await page.clock.install();
  await start(page);
  await openDefense(page);
  await page.locator("#defensePlay").click();
  await page.clock.fastForward(2000);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const before = (await stored(page)).career.defense;
  await page.clock.fastForward(60000);
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event("visibilitychange")); });
  expect((await stored(page)).career.defense).toEqual(before);
  await expect(page.locator("#defenseFire")).toBeDisabled();
  await page.locator("#defensePlay").click();
  await page.evaluate(() => document.getElementById("pauseBtn").click());
  const frozen = (await stored(page)).career.defense;
  await page.clock.fastForward(30000);
  expect((await stored(page)).career.defense).toEqual(frozen);
  await expect(page.locator("#defense-clock")).toContainText("общая пауза");
  await page.locator("#defensePlay").click();
  await page.clock.fastForward(2000);
  expect((await stored(page)).career.defense.elapsed).toBeGreaterThan(frozen.elapsed);
});

test("lab clock ignores global pause and hidden time without jumping on return", async ({ page }) => {
  await page.clock.install();
  await start(page, { landedOn: null, career: newCareer() });
  await page.locator("#tab-course").click();
  await page.locator("#flybyPlay").click();
  await page.clock.fastForward(1000);
  await page.evaluate(() => document.getElementById("pauseBtn").click());
  const time = () => page.locator("#flyby-time").textContent();
  const before = parseFloat(await time());
  await page.clock.fastForward(30000);
  expect(parseFloat(await time())).toBe(before);
  await page.evaluate(() => {
    document.getElementById("pauseBtn").click();
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.fastForward(60000);
  expect(parseFloat(await time())).toBe(before);
  const resumedAt = await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
    return performance.now();
  });
  await page.clock.fastForward(1000);
  const after = await page.evaluate(() => ({ now: performance.now(), cursor: parseFloat(document.getElementById("flyby-time").textContent) }));
  // The installed clock also advances during Playwright protocol calls.
  const visibleAdvance = (after.now - resumedAt) / 1000 * 5;
  expect(after.cursor - before).toBeGreaterThan(4.5);
  expect(Math.abs(after.cursor - before - visibleAdvance)).toBeLessThan(0.5);
});
