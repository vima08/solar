import { test, expect } from "@playwright/test";
import { newCareer, normalizeCareer, contractTransition } from "../js/game/contracts.js";
import { trade, reliefTransition } from "../js/game/markets.js";
import { usedSpace } from "../js/game/cargo.js";
import { createSaveStore } from "../js/game/save-store.js";
import { serializeSave, parseSaveFile } from "../js/game/save-files.js";

const bodies = ["earth", "mars"].map((id) => ({ config: { id }, type: "planet" }));
const funded = (credits = 100) => ({ ...newCareer(), credits, contractStatus: "completed" });

test("two-market circuit earns exactly 40; local resale loses money and sales use FIFO", () => {
  let state = funded();
  for (const [kind, good, port, balance] of [
    ["buy", "components", "earth", 70], ["buy", "components", "earth", 40],
    ["sell", "components", "mars", 80], ["sell", "components", "mars", 120],
    ["buy", "ore", "mars", 102], ["buy", "ore", "mars", 84],
    ["sell", "ore", "earth", 112], ["sell", "ore", "earth", 140],
  ]) {
    const before = structuredClone(state);
    const next = trade(state, kind, good, port);
    expect(next.error).toBeUndefined();
    expect(state).toEqual(before);
    state = next.career;
    expect(state.credits).toBe(balance);
  }
  expect(state.lastTrade.profit).toBe(10);
  let water = trade(funded(12), "buy", "water", "earth").career;
  expect(trade(water, "sell", "water", "mars").career.credits).toBe(16);
  expect(trade(water, "sell", "water", "earth").career.credits).toBe(8);
  water.marketCargo.push({ goodId: "water", purchasePrice: 20 });
  water = trade(water, "sell", "water", "mars").career;
  expect(water.lastTrade).toMatchObject({ basis: 12, profit: 4 });
  expect(water.marketCargo).toEqual([{ goodId: "water", purchasePrice: 20 }]);
});

test("trade rechecks port, funds, shared capacity, valid data and safe arithmetic", () => {
  const full = { ...funded(), marketCargo: [{ goodId: "ore", purchasePrice: 18 }, { goodId: "water", purchasePrice: 12 }] };
  expect(contractTransition({ ...full, contractStatus: "available" }, "accept", "earth")).toBeNull();
  const active = contractTransition({ ...newCareer(), credits: 100 }, "accept", "earth");
  const one = trade(active, "buy", "water", "earth").career;
  expect(usedSpace(one)).toBe(2);
  expect(trade(one, "buy", "water", "earth").error).toBeTruthy();
  for (const [state, kind, good, port] of [
    [funded(), "buy", "water", null], [funded(), "buy", "water", "jupiter"],
    [funded(11), "buy", "water", "earth"], [full, "buy", "ore", "earth"],
    [active, "sell", "components", "earth"], [funded(), "buy", "bad", "earth"],
    [funded(), "bad", "water", "earth"], [{ ...full, credits: Number.MAX_SAFE_INTEGER }, "sell", "water", "mars"],
    [{ ...funded(), marketCargo: [{ goodId: "ore", purchasePrice: -1 }] }, "sell", "ore", "mars"],
    [{ ...full, lastTrade: { sequence: Number.MAX_SAFE_INTEGER, kind: "buy", goodId: "water", portId: "earth", price: 12, basis: 12, profit: 0 } }, "sell", "water", "earth"],
  ]) {
    const before = structuredClone(state);
    expect(trade(state, kind, good, port).error).toBeTruthy();
    expect(state).toEqual(before);
  }
});

test("bankruptcy courier is free, occupies space, pays once and rejects stale actions", () => {
  const broke = funded(8);
  for (const state of [funded(12), newCareer(), { ...broke, marketCargo: [{ goodId: "water", purchasePrice: 12 }] }]) {
    expect(reliefTransition(state, "accept", "earth", 0).error).toBeTruthy();
  }
  expect(reliefTransition(broke, "accept", "mars", 0).error).toBeTruthy();
  const active = reliefTransition(broke, "accept", "earth", 0).career;
  expect(active.credits).toBe(8);
  expect(usedSpace(active)).toBe(1);
  expect(reliefTransition(active, "accept", "earth", 0).error).toBeTruthy();
  expect(reliefTransition(active, "deliver", "earth", 1).error).toBeTruthy();
  expect(trade(active, "sell", "water", "mars").error).toBeTruthy();
  const paid = reliefTransition(active, "deliver", "mars", 1).career;
  expect(paid.credits).toBe(38);
  expect(reliefTransition(paid, "deliver", "mars", 1).error).toBeTruthy();
  expect(reliefTransition(paid, "accept", "earth", 1).error).toBeTruthy();
  const nextJob = reliefTransition({ ...paid, credits: 0 }, "accept", "earth", 1).career;
  expect(reliefTransition(nextJob, "deliver", "mars", 1).error).toBeTruthy();
  expect(reliefTransition({ ...active, credits: Number.MAX_SAFE_INTEGER }, "deliver", "mars", 1).error).toBeTruthy();
  expect(reliefTransition({ ...broke, reliefContract: { status: "idle", sequence: Number.MAX_SAFE_INTEGER } }, "accept", "earth", Number.MAX_SAFE_INTEGER).error).toBeTruthy();
});

test("legacy saves migrate and v2 economic corruption is gated locally and rejected on import", () => {
  const legacy = { version: 1, credits: 100, contractStatus: "completed", cargo: [], flightSeconds: 300 };
  expect(normalizeCareer(legacy)).toEqual({ career: { ...funded(), flightSeconds: 300 }, issue: null });
  const state = { career: reliefTransition(funded(0), "accept", "earth", 0).career, exploration: { planets: ["earth"], moons: [] } };
  state.career = trade({ ...state.career, credits: 12 }, "buy", "water", "earth").career;
  expect(JSON.parse(serializeSave(state)).version).toBe(3);
  expect(parseSaveFile(serializeSave(state), bodies)).toEqual(state);
  for (const patch of [
    { marketCargo: [{ goodId: "unknown", purchasePrice: 1 }] },
    { marketCargo: [{ goodId: "water", purchasePrice: 0 }] },
    { marketCargo: Array(3).fill({ goodId: "ore", purchasePrice: 18 }) },
    { reliefContract: { status: "active", sequence: -1 } },
    { lastTrade: { ...state.career.lastTrade, profit: 999 } },
  ]) {
    const damaged = { ...state, career: { ...state.career, ...patch } };
    const raw = JSON.stringify(damaged);
    let writes = 0;
    const store = createSaveStore(bodies, { getItem: () => raw, setItem() { writes++; } });
    expect(store.issue).toBe("damaged");
    expect(store.raw).toBe(raw);
    expect(store.commit(state)).toBe(false);
    expect(writes).toBe(0);
    expect(() => parseSaveFile(serializeSave(damaged), bodies)).toThrow();
  }
});

test("commit preserves state identity, writes once, notifies all and never applies failed trades", () => {
  let raw = JSON.stringify({ career: funded(), obsolete: true });
  let denied = false;
  let writes = 0;
  const storage = { getItem: () => raw, setItem(key, value) { if (denied) throw Error("full"); raw = value; writes++; } };
  const store = createSaveStore(bodies, storage);
  const identity = store.state;
  const notifications = [0, 0];
  store.subscribe(() => notifications[0]++);
  store.subscribe(() => notifications[1]++);
  const next = { career: trade(store.state.career, "buy", "water", "earth").career };
  denied = true;
  const before = structuredClone(store.state);
  expect(store.commit(next)).toBe(false);
  expect(store.state).toEqual(before);
  denied = false;
  expect(store.commit(next)).toBe(true);
  expect(store.state).toBe(identity);
  expect(store.state.obsolete).toBeUndefined();
  expect(writes).toBe(1);
  expect(notifications).toEqual([3, 3]);
  expect(store.importState({ career: funded(9) })).toBe(true);
  expect(store.commit(next)).toBe(false);
  const other = createSaveStore(bodies, storage);
  raw = JSON.stringify({ career: funded(999) });
  expect(other.commit(next)).toBe(false);
  expect(other.issue).toBe("external");
  expect(other.save()).toBe(false);
  expect(other.reset()).toBe(false);
  expect(other.importState(next)).toBe(false);
  expect(JSON.parse(raw).career.credits).toBe(999);
});
