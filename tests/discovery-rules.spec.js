import { test, expect } from "@playwright/test";
import { newCareer, normalizeCareer, contractTransition } from "../js/game/contracts.js";
import { discoveryTransition, discoveryDestination } from "../js/game/discovery.js";
import { EUROPA } from "../js/game/discovery-state.js";
import { usedSpace } from "../js/game/cargo.js";
import { trade, reliefTransition } from "../js/game/markets.js";
import { createSaveStore } from "../js/game/save-store.js";
import { parseSaveFile, serializeSave, SAVE_KEY } from "../js/game/save-files.js";

const bodies = ["earth", "mars", EUROPA].map((id) => ({ config: { id }, type: id === EUROPA ? "moon" : "planet" }));
const initial = () => ({ ...newCareer(), contractStatus: "completed", credits: 100, flightSeconds: 300 });
function step(career, action, port) {
  const before = structuredClone(career);
  const result = discoveryTransition(career, action, port, career.discovery.stage);
  expect(result.error).toBeUndefined();
  expect(career).toEqual(before);
  return result.career;
}
const found = () => step(step(initial(), "listen", null), "survey", EUROPA);

test("open and salvage branches have distinct destinations and exactly one reward per stage", () => {
  const choice = found();
  for (const [branch, immediate, destination, total] of [["open", 140, "earth", 170], ["salvage", 100, "mars", 210]]) {
    const returning = step(choice, branch, EUROPA);
    expect(returning.credits).toBe(immediate);
    expect(discoveryDestination(returning.discovery)).toBe(destination);
    expect(usedSpace(returning)).toBe(branch === "salvage" ? 1 : 0);
    expect(discoveryTransition(returning, branch === "open" ? "salvage" : "open", EUROPA, "choice").error).toBeTruthy();
    const completed = step(returning, "finish", destination);
    expect(completed.credits).toBe(total);
    expect(usedSpace(completed)).toBe(0);
    expect(completed.discovery).toEqual({ stage: "completed", choice: branch });
    expect(discoveryTransition(completed, "finish", destination, "return").error).toBeTruthy();
    expect(discoveryTransition(completed, "listen", destination, "completed").error).toBeTruthy();
  }
});

test("discovery rejects wrong ports, unavailable contract, stale stages, overflow and bad input without mutation", () => {
  const signal = step(initial(), "listen", null);
  const choice = found();
  const returning = step(choice, "open", EUROPA);
  for (const [career, action, port, stage] of [
    [newCareer(), "listen", "mars", "unheard"], [signal, "survey", null, "signal"],
    [signal, "survey", "mars", "signal"], [choice, "open", null, "choice"],
    [choice, "salvage", "earth", "choice"], [returning, "finish", "mars", "return"],
    [returning, "finish", null, "return"], [choice, "survey", EUROPA, "signal"],
    [choice, "unknown", EUROPA, "choice"], [{ ...choice, credits: Number.MAX_SAFE_INTEGER }, "open", EUROPA, "choice"],
    [{ ...returning, credits: Number.MAX_SAFE_INTEGER }, "finish", "earth", "return"],
    [null, "listen", "mars", "unheard"], [{ ...initial(), version: 2 }, "listen", null, "unheard"],
  ]) {
    const before = structuredClone(career);
    expect(discoveryTransition(career, action, port, stage).error).toBeTruthy();
    expect(career).toEqual(before);
  }
});

test("recorder shares capacity with goods and relief; full hold can still publish", () => {
  const choice = { ...found(), marketCargo: [{ goodId: "water", purchasePrice: 12 }, { goodId: "ore", purchasePrice: 18 }] };
  expect(discoveryTransition(choice, "salvage", EUROPA, "choice").error).toBeTruthy();
  const open = step(choice, "open", EUROPA);
  expect(usedSpace(open)).toBe(2);
  const oneGood = { ...choice, marketCargo: choice.marketCargo.slice(0, 1) };
  let recorder = step(oneGood, "salvage", EUROPA);
  expect(usedSpace(recorder)).toBe(2);
  expect(trade(recorder, "buy", "water", "mars").error).toBeTruthy();
  recorder = trade(recorder, "sell", "water", "mars").career;
  expect(usedSpace(recorder)).toBe(1);
  expect(trade(recorder, "sell", "water", "mars").error).toBeTruthy();
  expect(reliefTransition({ ...recorder, credits: 0 }, "accept", "earth", 0).error).toBeTruthy();
  const courier = { ...initial(), credits: 0, reliefContract: { sequence: 1, status: "active" }, discovery: { stage: "choice", choice: null } };
  expect(usedSpace(step(courier, "salvage", EUROPA))).toBe(2);
  expect(trade(step(recorder, "finish", "mars"), "buy", "water", "mars").career).toBeTruthy();
  expect(contractTransition({ ...recorder, contractStatus: "available", marketCargo: oneGood.marketCargo }, "accept", "earth")).toBeNull();
});

test("career1 and career2 files migrate without changing trade, courier or money; each stage round-trips", () => {
  const legacy1 = { version: 1, credits: 100, contractStatus: "completed", cargo: [], flightSeconds: 300 };
  const legacy2 = { ...trade(initial(), "buy", "water", "earth").career, version: 2 };
  delete legacy2.discovery;
  for (const legacy of [legacy1, legacy2]) {
    const expected = normalizeCareer(legacy).career;
    expect(expected.version).toBe(4);
    expect(expected.discovery).toEqual({ stage: "unheard", choice: null });
    expect(expected.credits).toBe(legacy.credits);
    expect(expected.marketCargo).toEqual(legacy.marketCargo ?? []);
    const envelope = { format: "kosmodrom-save", version: legacy.version, expedition: { career: legacy }, exploration: { planets: [], moons: [] } };
    expect(parseSaveFile(JSON.stringify(envelope), bodies).career).toEqual(expected);
  }
  const choice = found();
  const states = [initial(), step(initial(), "listen", null), choice];
  for (const branch of ["open", "salvage"]) {
    const returning = step(choice, branch, EUROPA);
    states.push(returning, step(returning, "finish", discoveryDestination(returning.discovery)));
  }
  for (const career of states) {
    const state = { career, exploration: { planets: ["earth"], moons: [EUROPA] } };
    expect(JSON.parse(serializeSave(state)).version).toBe(4);
    expect(parseSaveFile(serializeSave(state), bodies)).toEqual(state);
  }
  const migratedCourier = normalizeCareer({ ...legacy2, credits: 0, marketCargo: [], reliefContract: { status: "active", sequence: 2 } }).career;
  expect(usedSpace(migratedCourier)).toBe(1);
  expect(reliefTransition(migratedCourier, "deliver", "mars", 2).career.credits).toBe(30);
});

test("malformed story, overcapacity and future versions are gated with original data preserved", () => {
  const states = [
    { ...initial(), discovery: undefined }, { ...initial(), discovery: { stage: "bogus", choice: null } },
    { ...initial(), discovery: { stage: "signal", choice: "open" } },
    { ...initial(), discovery: { stage: "return", choice: null } },
    { ...newCareer(), discovery: { stage: "choice", choice: null } },
    { ...step(found(), "salvage", EUROPA), marketCargo: Array(2).fill({ goodId: "water", purchasePrice: 12 }) },
    { ...initial(), version: 99 },
  ];
  for (const career of states) {
    const state = { career, exploration: { planets: [], moons: [] } };
    const raw = JSON.stringify(state);
    let writes = 0;
    const store = createSaveStore(bodies, { getItem: () => raw, setItem() { writes++; } });
    expect(store.issue).toBe(career.version === 99 ? "future" : "damaged");
    expect(store.raw).toBe(raw);
    expect(store.save()).toBe(false);
    expect(store.commit({ career: initial() })).toBe(false);
    expect(writes).toBe(0);
    expect(() => parseSaveFile(serializeSave(state), bodies)).toThrow();
  }
});

test("failed atomic story write leaves rewards, stage and recorder intact; reset retires it", () => {
  let raw = JSON.stringify({ career: found() });
  let deny = true;
  const store = createSaveStore(bodies, { getItem: () => raw, setItem(key, value) { expect(key).toBe(SAVE_KEY); if (deny) throw Error("quota"); raw = value; } });
  const before = structuredClone(store.state.career);
  const next = discoveryTransition(before, "open", EUROPA, "choice").career;
  expect(store.commit({ ...store.state, career: next })).toBe(false);
  expect(store.state.career).toEqual(before);
  deny = false;
  expect(store.commit({ ...store.state, career: next })).toBe(true);
  expect(store.state.career.credits).toBe(140);
  expect(store.reset()).toBe(true);
  expect(JSON.parse(raw).career).toEqual(newCareer());
  expect(store.commit({ career: next })).toBe(false);
});
