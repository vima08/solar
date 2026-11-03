import { test, expect } from "@playwright/test";
import { newCareer, normalizeCareer } from "../js/game/contracts.js";
import { defenseTransition } from "../js/game/defense.js";
import { newDefense, defenseToken, defenseReward } from "../js/game/defense-state.js";
import { createSaveStore } from "../js/game/save-store.js";
import { serializeSave, parseSaveFile } from "../js/game/save-files.js";

const initial = () => ({ ...newCareer(), contractStatus: "completed", credits: 100 });
function command(career, action, extra = {}) {
  const before = structuredClone(career);
  const result = defenseTransition(career, action, { token: defenseToken(career.defense), landedOn: "mars", ...extra });
  expect(result.error).toBeUndefined();
  expect(career).toEqual(before);
  return result.career;
}
function run(kills) {
  let c = command(initial(), "start");
  for (let target = 0; target < kills; target++) {
    const hp = c.defense.hp[target];
    for (let shot = 0; shot < hp; shot++) {
      if (c.defense.cooldown > 0) c = command(c, "advance", { seconds: c.defense.cooldown });
      c = command(c, "fire", { target });
    }
  }
  if (c.defense.stage === "active") c = command(c, "advance", { seconds: 42 });
  return c;
}

test("zero, partial and complete protection pay exactly once only after claim", () => {
  for (const [count, amount] of [[0, 0], [1, 20], [2, 40], [3, 90]]) {
    const resolved = run(count);
    expect(resolved.defense.stage).toBe("resolved");
    expect(resolved.credits).toBe(100);
    expect(defenseReward(resolved.defense)).toBe(amount);
    const completed = command(resolved, "claim");
    expect(completed.credits).toBe(100 + amount);
    expect(completed.defense.stage).toBe("completed");
    expect(defenseTransition(completed, "claim", { token: defenseToken(completed.defense), landedOn: "mars" }).error).toBeTruthy();
    expect(defenseTransition(completed, "start", { token: defenseToken(completed.defense), landedOn: "mars" }).error).toBeTruthy();
  }
});

test("deadlines, cooldown, wrong ports and stale commands cannot be bypassed", () => {
  const active = command(initial(), "start");
  const fired = command(active, "fire", { target: 0 });
  expect(fired.defense.hp).toEqual([1, 3, 2]);
  const late = command(fired, "advance", { seconds: 18 });
  expect(late.defense.hp[0]).toBe(-1);
  const cases = [
    [newCareer(), "start", {}], [initial(), "start", { landedOn: null }],
    [initial(), "start", { landedOn: "earth" }], [fired, "fire", { target: 0 }],
    [late, "fire", { target: 0 }], [active, "fire", { target: 9 }],
    [active, "advance", { seconds: NaN }], [active, "advance", { seconds: -1 }],
    [active, "advance", { seconds: 43 }], [active, "fire", { target: 0, token: "old" }],
    [active, "claim", {}], [{ ...run(3), credits: Number.MAX_SAFE_INTEGER }, "claim", {}],
  ];
  for (const [career, action, extra] of cases) {
    const before = structuredClone(career);
    expect(defenseTransition(career, action, { landedOn: "mars", token: defenseToken(career.defense), ...extra }).error).toBeTruthy();
    expect(career).toEqual(before);
  }
});

test("new schema migrates v1–v3 without losing market cargo, discovery choice or money", () => {
  const bodies = ["mars", "earth"].map((id) => ({ config: { id }, type: "planet" }));
  for (const version of [1, 2, 3]) {
    const legacy = { ...initial(), version };
    delete legacy.defense;
    if (version >= 2) legacy.marketCargo = [{ goodId: "ore", purchasePrice: 18 }];
    if (version === 3) legacy.discovery = { stage: "return", choice: "salvage" };
    const normalized = normalizeCareer(legacy);
    expect(normalized.issue).toBeNull();
    expect(normalized.career.credits).toBe(100);
    expect(normalized.career.defense).toEqual(newDefense());
    if (version >= 2) expect(normalized.career.marketCargo).toEqual(legacy.marketCargo);
    if (version === 3) expect(normalized.career.discovery).toEqual(legacy.discovery);
    const state = { career: legacy, exploration: { planets: [], moons: [] } };
    expect(parseSaveFile(serializeSave(state), bodies).career).toEqual(normalized.career);
  }
  let c = command(initial(), "start");
  c = command(c, "fire", { target: 1 });
  c = command(c, "advance", { seconds: 3.25 });
  const state = { career: c, exploration: { planets: ["mars"], moons: [] } };
  expect(JSON.parse(serializeSave(state)).version).toBe(4);
  expect(parseSaveFile(serializeSave(state), bodies)).toEqual(state);
});

test("malformed encounter is gated and cannot erase the original snapshot", () => {
  const bodies = ["mars"].map((id) => ({ config: { id }, type: "planet" }));
  const malformed = [undefined, { ...newDefense(), hp: [2, 3, 9] },
    { ...newDefense(), stage: "resolved" }, { ...newDefense(), stage: "active", elapsed: 30 },
    { ...newDefense(), stage: "active", hp: [0, 3, 2], shots: 2, elapsed: 0, cooldown: 2 },
    { ...newDefense(), elapsed: Infinity }, { ...newDefense(), cooldown: 1 },
    { ...newDefense(), hp: [-1, 3, 2] }];
  for (const defense of malformed) {
    const state = { career: { ...initial(), defense }, exploration: { planets: [], moons: [] } };
    const raw = JSON.stringify(state);
    const store = createSaveStore(bodies, { getItem: () => raw, setItem() { throw Error("must not write"); } });
    expect(store.issue).toBe("damaged");
    expect(store.raw).toBe(raw);
    expect(store.save()).toBe(false);
    expect(() => parseSaveFile(serializeSave(state), bodies)).toThrow();
  }
});

test("write failure rolls back shots and rewards; external raw change blocks tick", () => {
  let raw = JSON.stringify({ career: command(initial(), "start") });
  let denied = true;
  const storage = { getItem: () => raw, setItem(key, value) { if (denied) throw Error("quota"); raw = value; } };
  const store = createSaveStore([], storage);
  const before = structuredClone(store.state.career);
  const next = command(before, "fire", { target: 0 });
  expect(store.commit({ ...store.state, career: next })).toBe(false);
  expect(store.state.career).toEqual(before);
  denied = false;
  expect(store.commit({ ...store.state, career: next })).toBe(true);
  raw = JSON.stringify({ career: { ...initial(), credits: 999 } });
  expect(store.commit({ career: command(next, "advance", { seconds: 2 }) })).toBe(false);
  expect(store.issue).toBe("external");
});
