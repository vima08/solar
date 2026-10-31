import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { newCareer } from "../js/game/contracts.js";
import { createSaveStore } from "../js/game/save-store.js";
import { SAVE_KEY } from "../js/game/save-files.js";
import { PLANETS } from "../js/core/constants.js";
import { createShipCamera, surfaceFrame } from "../js/ui/ship-camera.js";

const progressed = { career: { ...newCareer(), credits: 100, contractStatus: "completed", flightSeconds: 300 },
  position: [24, 10, 0], fuel: 43, samples: ["mars"], deliveryMission: 1, target: "mars", exploration: { planets: ["earth", "mars"], moons: ["earth-moon-1"] } };
async function start(page, state = progressed) {
  await page.addInitScript(({ key, state }) => {
    if (!sessionStorage.getItem("reset-camera-seed")) {
      localStorage.setItem(key, JSON.stringify(state));
      localStorage.setItem("musicVolume", "37");
      localStorage.setItem("engineVolume", "0");
      localStorage.setItem("unrelated-key", "preserve");
      sessionStorage.setItem("reset-camera-seed", "1");
    }
  }, { key: SAVE_KEY, state });
  await page.goto("/");
  await expect(page.locator("#loading")).toBeHidden();
}

test("atomic reset retires old saves, preserves unrelated keys and fails without changing state", () => {
  const records = new Map([[SAVE_KEY, JSON.stringify(progressed)], ["musicVolume", "37"], ["unrelated-key", "keep"]]);
  let deny = false;
  const storage = { getItem: (key) => records.get(key) ?? null, setItem: (key, value) => { if (deny) throw new Error("full"); records.set(key, value); } };
  const bodies = ["earth", "mars"].map((id) => ({ type: "planet", config: { id } }));
  bodies.push({ type: "moon", config: { id: "earth-moon-1" } });
  const store = createSaveStore(bodies, storage);
  const before = records.get(SAVE_KEY);
  deny = true;
  expect(store.reset()).toBe(false);
  expect(store.state.career.credits).toBe(100);
  expect(records.get(SAVE_KEY)).toBe(before);
  deny = false;
  expect(store.reset()).toBe(true);
  expect(JSON.parse(records.get(SAVE_KEY)).career).toEqual(newCareer());
  expect(store.save()).toBe(false);
  expect(records.get("musicVolume")).toBe("37");
  expect(records.get("unrelated-key")).toBe("keep");
});

test("reset requires confirmation and backup restores the original progress from JSON", async ({ page }) => {
  test.setTimeout(60000);
  await start(page);
  await page.locator("#savesBtn").click();
  const before = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
  await page.locator("#resetProgressBtn").click();
  await expect(page.locator("#reset-dialog")).toBeVisible();
  await page.locator("#reset-dialog").getByRole("button", { name: "Отмена", exact: true }).click();
  expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY)).toBe(before);
  await page.locator("#resetProgressBtn").click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#resetBackupBtn").click()]);
  const backup = await readFile(await download.path());
  await Promise.all([page.waitForEvent("load"), page.locator("#confirmResetBtn").click()]);
  await expect(page.locator("#loading")).toBeHidden();
  await page.locator("#contractBtn").click();
  await expect(page.locator("#credit-count")).toHaveText("0");
  await expect(page.locator("#cargo-count")).toHaveText("0 / 2");
  await expect(page.locator("#sample-count")).toHaveText("0");
  await expect(page.locator("#mission-count")).toHaveText("0 из 8");
  await expect(page.locator("#moon-mission-count")).toHaveText("0 из 5");
  await expect(page.locator("#active-mission")).toContainText("Доставь зонд");
  await page.locator("#savesBtn").click();
  const preferences = await page.evaluate(() => [localStorage.getItem("musicVolume"), localStorage.getItem("engineVolume"), localStorage.getItem("unrelated-key")]);
  expect(preferences).toEqual(["37", "0", "preserve"]);
  await page.locator("#importSaveFile").setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: backup });
  await Promise.all([page.waitForEvent("load"), page.locator("#confirmImportBtn").click()]);
  await expect(page.locator("#loading")).toBeHidden();
  await page.locator("#contractBtn").click();
  await expect(page.locator("#credit-count")).toHaveText("100");
  await expect(page.locator("#mission-count")).toHaveText("2 из 8");
  await expect(page.locator("#sample-count")).toHaveText("1");
});

test("failed reset keeps the current game and the confirmation open", async ({ page }) => {
  await start(page);
  await page.locator("#savesBtn").click();
  await page.locator("#resetProgressBtn").click();
  const before = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException("full", "QuotaExceededError"); }; });
  await page.locator("#confirmResetBtn").click();
  await expect(page.locator("#reset-error")).toContainText("не сброшен");
  await expect(page.locator("#reset-dialog")).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY)).toBe(before);
  await page.locator("#reset-dialog").getByRole("button", { name: "Отмена", exact: true }).click();
  await page.locator("#contractBtn").click();
  await expect(page.locator("#credit-count")).toHaveText("100");
});

test.describe("touch reset", () => {
  test.use({ hasTouch: true });
  test("tablet reset confirmation can be read and cancelled in both orientations", async ({ page }, testInfo) => {
    test.setTimeout(60000);
    await start(page);
    for (const viewport of [{ width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      await page.locator("#savesBtn").tap();
      await page.locator("#resetProgressBtn").tap();
      await expect(page.locator("#reset-dialog")).toBeVisible();
      await page.locator("#reset-heading").scrollIntoViewIfNeeded();
      await expect(page.locator("#reset-heading")).toBeInViewport();
      await page.screenshot({ path: testInfo.outputPath(`reset-${viewport.width}.png`) });
      await page.locator("#reset-dialog").getByRole("button", { name: "Отмена", exact: true }).tap();
      await expect(page.locator("#reset-dialog")).toBeHidden();
    }
    await page.locator("#contractBtn").tap();
    await expect(page.locator("#credit-count")).toHaveText("100");
  });
});

test("surface course is continuous across the south pole and handles a parallel heading", () => {
  const left = surfaceFrame(new THREE.Vector3(0.00001, -1, 0));
  const right = surfaceFrame(new THREE.Vector3(-0.00001, -1, 0));
  expect(left.quaternion.angleTo(right.quaternion)).toBeLessThan(0.001);
  const parallel = surfaceFrame(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 1));
  expect(parallel.forward.dot(parallel.up)).toBeCloseTo(0);
  expect(parallel.quaternion.length()).toBeCloseTo(1);
});

test("landed cameras stay fixed in a translating rotating surface frame at both poles and in cockpit", () => {
  for (const offset of [new THREE.Vector3(0.001, -2, 0), new THREE.Vector3(0, 2, 0), new THREE.Vector3(2, 0, 0)]) {
    for (const cockpit of [false, true]) {
      const parent = new THREE.Group();
      const body = new THREE.Object3D();
      parent.add(body);
      body.position.set(100, 20, 0);
      const ship = new THREE.Object3D();
      const camera = new THREE.PerspectiveCamera();
      const controller = createShipCamera(camera);
      const frame = surfaceFrame(offset);
      let previousLocal;
      let previousPosition;
      let maxTurn = 0;
      let maxDrift = 0;
      let minUp = 1;
      let finite = true;
      for (let i = 0; i < 180; i++) {
        parent.position.set(i * 3, -i, i * 0.2);
        parent.rotation.z = i * 0.03;
        body.rotation.y = i * 0.12;
        parent.updateMatrixWorld(true);
        const bodyQ = body.getWorldQuaternion(new THREE.Quaternion());
        ship.position.copy(body.localToWorld(offset.clone()));
        ship.quaternion.copy(bodyQ).multiply(frame.quaternion);
        controller.update({ ship, cockpit, body, offset, heading: frame.forward, delta: 1 / 60 });
        const localQ = bodyQ.clone().invert().multiply(camera.quaternion);
        const localPos = body.worldToLocal(camera.position.clone());
        if (previousLocal) maxTurn = Math.max(maxTurn, localQ.angleTo(previousLocal));
        if (previousPosition) maxDrift = Math.max(maxDrift, localPos.distanceTo(previousPosition));
        minUp = Math.min(minUp, camera.up.clone().applyQuaternion(bodyQ.clone().invert()).dot(frame.up));
        finite = finite && camera.position.toArray().every(Number.isFinite);
        previousLocal = localQ;
        previousPosition = localPos;
      }
      expect(maxTurn).toBeLessThan(0.000001);
      expect(maxDrift).toBeLessThan(0.000001);
      expect(minUp).toBeCloseTo(1);
      expect(finite).toBe(true);
    }
  }
});

test("surface camera smoothing has the same result at different frame rates", () => {
  const run = (fps) => {
    const body = new THREE.Object3D();
    const ship = new THREE.Object3D();
    const offset = new THREE.Vector3(0, 2, 0);
    ship.position.copy(offset);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(10, 10, 10);
    const controller = createShipCamera(camera);
    for (let i = 0; i < fps; i++) controller.update({ ship, cockpit: false, body, offset, delta: 1 / fps });
    return camera;
  };
  const fast = run(60);
  const slow = run(20);
  expect(fast.position.distanceTo(slow.position)).toBeLessThan(0.000001);
  expect(fast.quaternion.angleTo(slow.quaternion)).toBeLessThan(0.000001);
});

for (const landing of [
  { id: "mars", radius: PLANETS.find((body) => body.id === "mars").radius },
  { id: "jupiter-moon-2", radius: PLANETS.find((body) => body.id === "jupiter").moons[1].radius },
]) test(`real landed ${landing.id} camera keeps a stable local frame, cockpit and takeoff remain usable`, async ({ page }) => {
  test.setTimeout(60000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Observe the actual application's camera without adding a production debug API.
  await page.route("**/js/app/scene.js", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const factoryReturn = "return { scene, camera, renderer, controls, bodies: world.bodies };";
    expect(source).toContain(factoryReturn);
    await route.fulfill({ response, body: source.replace(factoryReturn, "const result = { scene, camera, renderer, controls, bodies: world.bodies }; window.cameraTestWorld = result; return result;") });
  });
  await start(page, { ...progressed, target: landing.id, landedOn: landing.id, landedOffset: [0.0001, -landing.radius - 0.3, 0], landedHeading: [0, 0, 1] });
  await page.evaluate(async (id) => {
    const THREE = await import("three");
    const renderer = window.cameraTestWorld.renderer;
    const original = renderer.render;
    window.cameraFrames = [];
    renderer.render = function(scene, camera) {
      const body = scene.getObjectByName(id);
      if (body && document.body.classList.contains("flight-mode") && document.body.classList.contains("landed-mode")) {
        const q = body.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(camera.quaternion);
        window.cameraFrames.push(q.toArray());
        if (window.cameraFrames.length > 200) window.cameraFrames.shift();
      }
      return original.call(this, scene, camera);
    };
  }, landing.id);
  await page.locator("#tab-settings").click();
  await page.locator("#fastBtn").click();
  await page.locator("#flightBtn").click();
  const maxTurn = () => page.evaluate(async () => {
    const THREE = await import("three");
    if (window.cameraFrames.length < 25) return 10;
    const frames = window.cameraFrames.slice(-20).map((q) => new THREE.Quaternion().fromArray(q));
    return Math.max(...frames.slice(1).map((q, i) => q.angleTo(frames[i])));
  });
  await expect.poll(maxTurn, { timeout: 12000 }).toBeLessThan(0.001);
  await page.locator("#cockpitBtn").click();
  await page.evaluate(() => { window.cameraFrames = []; });
  await expect.poll(maxTurn, { timeout: 15000 }).toBeLessThan(0.001);
  await page.locator("#landBtn").click();
  await expect(page.locator("body")).not.toHaveClass(/landed-mode/);
  await page.evaluate(() => dispatchEvent(new Event("pagehide")));
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
  expect(saved.landedHeading).toHaveLength(3);
  expect(saved.quaternion.every(Number.isFinite)).toBe(true);
  expect(errors).toEqual([]);
});

test("engine leaves the ship camera alone while orbit controls are disabled", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#loading")).toBeHidden();
  const result = await page.evaluate(async () => {
    const { createEngine } = await import("./js/core/engine.js");
    let orbits = 0;
    let flights = 0;
    const controls = { enabled: false, update: () => { orbits++; } };
    const engine = createEngine({ scene: {}, camera: {}, renderer: { render() {} }, controls, navigation: { update: () => { flights++; } } });
    engine.start();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const disabled = { orbits, flights };
    controls.enabled = true;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return { disabled, enabled: { orbits, flights } };
  });
  expect(result.disabled).toEqual({ orbits: 0, flights: 0 });
  expect(result.enabled.orbits).toBeGreaterThan(0);
  expect(result.enabled.flights).toBeGreaterThan(0);
});
