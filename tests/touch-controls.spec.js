import { test, expect } from "@playwright/test";

test.use({ hasTouch: true, viewport: { width: 1024, height: 768 } });

test("two real touch pointers steer independently and reset when cancelled or dashboard opens", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.locator("#loading")).toBeHidden();
  await page.locator("#flightBtn").click();
  if (await page.locator("#dashboard").isVisible()) await page.locator("#closeDashboard").click();
  await expect(page.locator("#touch-controls")).toBeVisible();
  const left = await page.locator("#thrust-stick").boundingBox();
  const right = await page.locator("#attitude-stick").boundingBox();
  const a = { x: left.x + left.width / 2, y: left.y + left.height * 0.18, id: 1 };
  const b = { x: right.x + right.width * 0.8, y: right.y + right.height * 0.2, id: 2 };
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [a] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [a, b] });
  const leftThumb = page.locator("#thrust-stick .stick-thumb");
  const rightThumb = page.locator("#attitude-stick .stick-thumb");
  await expect(leftThumb).not.toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  await expect(rightThumb).not.toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  await page.waitForTimeout(250);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [a] });
  await expect(leftThumb).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  await expect(rightThumb).not.toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  await expect(rightThumb).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  await page.evaluate(() => dispatchEvent(new Event("pagehide")));
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("kosmodrom-expedition-v1")));
  expect(state.fuel).toBeLessThan(100);
  expect(Math.hypot(...state.velocity)).toBeGreaterThan(0);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [a] });
  await page.locator("#dashboardBtn").click();
  await expect(page.locator("#touch-controls")).toBeHidden();
  expect(await leftThumb.evaluate((el) => el.style.transform)).toBe("translate(0px, 0px)");
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.locator("#closeDashboard").click();
  await expect(leftThumb).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
});

test("tablet and phone layouts keep touch targets and toolbar reachable in both orientations", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.locator("#loading")).toBeHidden();
  for (const viewport of [{ width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await page.locator("#contractBtn").click();
    await expect(page.locator("#contract-panel")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`journal-${viewport.width}.png`) });
    for (const selector of ["#controls button", ".dashboard-tabs button"]) {
      for (const box of await page.locator(selector).evaluateAll((elements) => elements.map((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }))) {
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
      }
    }
    await page.locator("#flightBtn").click();
    if (!await page.locator("body").evaluate((el) => el.classList.contains("flight-mode"))) await page.locator("#flightBtn").click();
    await page.locator("#closeDashboard").click();
    await expect(page.locator("#touch-controls")).toBeVisible();
    const toolbar = await page.locator("#controls").boundingBox();
    const sticks = await page.locator("#touch-controls").boundingBox();
    expect(sticks.y + sticks.height).toBeLessThanOrEqual(toolbar.y);
    expect(sticks.y).toBeGreaterThan(60);
    await page.screenshot({ path: testInfo.outputPath(`flight-${viewport.width}.png`) });
  }
});

test("web users can opt into sticks and analog force scales acceleration", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#loading")).toBeHidden();
  const ratio = await page.evaluate(async () => {
    const THREE = await import("three");
    const { createShipControls } = await import("./js/ui/ship-controls.js");
    const force = (thrust) => {
      const velocity = new THREE.Vector3();
      const controls = createShipControls(new THREE.Group(), velocity, { isActive: () => true, isSimple: () => true, hasFuel: () => true, consumeFuel: () => {}, analog: { thrust } });
      controls.update(0.1);
      return velocity.length();
    };
    return force(0.25) / force(1);
  });
  expect(ratio).toBeCloseTo(0.25);
});
