import { test, expect } from "@playwright/test";
import { CONTRACT, newCareer, normalizeCareer, contractTransition, createFlightClock } from "../js/game/contracts.js";
import { parseSaveFile, serializeSave, SAVE_KEY } from "../js/game/save-files.js";
import { createSaveStore } from "../js/game/save-store.js";
import { stickVector } from "../js/ui/touch-controls.js";

const bodies = ["earth", "mars"].map((id) => ({ config: { id }, type: "planet" }));
const empty = () => ({ career: newCareer(), exploration: { planets: [], moons: [] } });

test("contract transitions require the right landing and pay once", () => {
  const initial = newCareer();
  expect(contractTransition(initial, "accept", null)).toBeNull();
  expect(contractTransition(initial, "accept", "mars")).toBeNull();
  expect(contractTransition({ ...initial, cargo: [{ quantity: 2 }] }, "accept", "earth")).toBeNull();
  const active = contractTransition(initial, "accept", "earth");
  expect(active.cargo).toEqual([{ contractId: CONTRACT.id, quantity: 1 }]);
  expect(contractTransition(active, "accept", "earth")).toBeNull();
  expect(contractTransition(active, "deliver", null)).toBeNull();
  expect(contractTransition(active, "deliver", "earth")).toBeNull();
  const completed = contractTransition(active, "deliver", "mars");
  expect(completed.credits).toBe(100);
  expect(completed.cargo).toEqual([]);
  expect(contractTransition(completed, "deliver", "mars")).toBeNull();
  expect(contractTransition({ ...active, cargo: [] }, "deliver", "mars")).toBeNull();
});

test("career migration repairs cargo without minting money and detects future schemas", () => {
  expect(normalizeCareer(undefined)).toEqual({ career: newCareer(), issue: null });
  for (const invalid of [null, [], { version: "1" }, { version: 0 }]) expect(normalizeCareer(invalid).issue).toBe("damaged");
  expect(normalizeCareer({ version: 2 }).issue).toBe("future");
  const damaged = { ...newCareer(), contractStatus: "active", cargo: [], credits: -10, flightSeconds: NaN, extra: "preserve" };
  const repaired = normalizeCareer(damaged);
  expect(repaired.issue).toBe("damaged");
  expect(repaired.career).toMatchObject({ credits: 0, flightSeconds: 0, extra: "preserve" });
  expect(repaired.career.cargo).toHaveLength(1);
  expect(normalizeCareer({ ...newCareer(), contractStatus: "completed", cargo: repaired.career.cargo }).career.credits).toBe(0);
});

test("active flight time counts slow frames and excludes pauses and hidden intervals", () => {
  const clock = createFlightClock(0);
  expect(clock.step(5000, true)).toBe(5);
  expect(clock.step(100000, false)).toBe(0);
  clock.reset(200000);
  expect(clock.step(201000, true)).toBe(1);
  let seconds = 0;
  for (let i = 1; i <= 60; i++) seconds += clock.step(201000 + i * 5000, true);
  expect(seconds).toBe(CONTRACT.cruiseSeconds);
});

test("stick dead zone, circular clamp and proportional thrust remain analog", () => {
  expect(stickVector(2, 2, 50)).toEqual({ x: 0, y: 0 });
  const partial = stickVector(25, 0, 50);
  expect(partial.x).toBeGreaterThan(0.4);
  expect(partial.x).toBeLessThan(0.5);
  const full = stickVector(100, 100, 50);
  expect(Math.hypot(full.x, full.y)).toBeCloseTo(1);
});

test("file format round-trips all game progress and rejects malformed values", () => {
  const state = { ...empty(), position: [1, 2, 3], quaternion: [0, 0, 0, 1], fuel: 45, landedOn: "earth", target: "mars", deliveryMission: 2, samples: ["mars"], exploration: { planets: ["mars"], moons: [] } };
  expect(parseSaveFile(serializeSave(state), bodies)).toEqual(state);
  for (const invalid of ["{", JSON.stringify({ version: 2 }), "x".repeat(1024 * 1024 + 1)]) expect(() => parseSaveFile(invalid, bodies)).toThrow();
  for (const patch of [{ position: [null, 0, 0] }, { fuel: -1 }, { fuel: "40" }, { target: "unknown" }, { landedOn: "sun" }, { deliveryMission: 1.1 }, { samples: "mars" }, { career: { version: 2 } }, { career: { ...newCareer(), credits: 1e100 } }]) {
    expect(() => parseSaveFile(serializeSave({ ...state, ...patch }), bodies)).toThrow();
  }
  const legacy = JSON.parse(serializeSave(state));
  delete legacy.expedition.career;
  expect(parseSaveFile(JSON.stringify(legacy), bodies).career).toEqual(newCareer());
});

test("storage gates cover every write and confirmed import atomically retires the old session", () => {
  let raw = JSON.stringify({ ...empty(), career: { version: 99 } });
  let writes = 0;
  let denied = false;
  const storage = { getItem: () => raw, setItem(key, value) { expect(key).toBe(SAVE_KEY); if (denied) throw new Error("denied"); writes++; raw = value; } };
  const future = createSaveStore(bodies, storage);
  expect(future.issue).toBe("future");
  for (let i = 0; i < 4; i++) expect(future.save()).toBe(false);
  expect(future.restore()).toBe(false);
  expect(writes).toBe(0);
  raw = JSON.stringify({ ...empty(), career: { ...newCareer(), credits: -20 } });
  const damaged = createSaveStore(bodies, storage);
  expect(damaged.issue).toBe("damaged");
  expect(damaged.save()).toBe(false);
  expect(writes).toBe(0);
  expect(damaged.restore()).toBe(true);
  expect(writes).toBe(1);
  denied = true;
  const previous = raw;
  expect(damaged.importState({ ...empty(), fuel: 50 })).toBe(false);
  expect(raw).toBe(previous);
  denied = false;
  expect(damaged.importState({ ...empty(), fuel: 50 })).toBe(true);
  expect(damaged.save()).toBe(false);
  expect(JSON.parse(raw).fuel).toBe(50);
});
