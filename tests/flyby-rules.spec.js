import { test, expect } from "@playwright/test";
import { predictFlyby, FLYBY_PRESETS } from "../js/game/flyby.js";

test("gravity-free path is straight and equal-radius speeds agree", () => {
  const result = predictFlyby({}, { mu: 0 });
  expect(result.status).toBe("escaped");
  expect(result.points.every((point) => point.y === 3.5 && point.vx === 0.7 && point.vy === 0)).toBe(true);
  expect(result.turnAngle).toBe(0);
  expect(result.deltaSpeed).toBe(0);
  expect(Math.hypot(result.points.at(-1).x, result.points.at(-1).y)).toBeCloseTo(result.initialRadius, 8);
});

test("safe flybys conserve planet-frame energy and momentum and converge at half-step", () => {
  for (const preset of FLYBY_PRESETS.filter((p) => p.id !== "danger")) {
    const a = predictFlyby(preset);
    const b = predictFlyby(preset, { step: 0.01 });
    expect(a.status).toBe("escaped"); expect(b.status).toBe("escaped");
    expect(a.energyError).toBeLessThan(0.001);
    expect(a.momentumError).toBeLessThan(0.001);
    expect(Math.abs(a.closest - b.closest) / b.closest).toBeLessThan(0.001);
    expect(Math.abs(a.exitStationSpeed - b.exitStationSpeed) / b.exitStationSpeed).toBeLessThan(0.001);
    expect(Math.abs(a.turnAngle - b.turnAngle)).toBeLessThan(0.1);
    expect(Math.abs(a.exitRelativeSpeed - a.initialRelativeSpeed) / a.initialRelativeSpeed).toBeLessThan(0.001);
    expect(Math.hypot(a.points.at(-1).x, a.points.at(-1).y)).toBeCloseTo(a.initialRadius, 8);
  }
});

test("moving reference changes speed gains without changing relative geometry; mirror reverses turn", () => {
  const [turn, boost, brake] = FLYBY_PRESETS.map((p) => predictFlyby(p));
  expect(Math.abs(turn.deltaSpeed)).toBeLessThan(0.001);
  expect(boost.deltaSpeed).toBeGreaterThan(0.1);
  expect(brake.deltaSpeed).toBeLessThan(-0.1);
  expect(boost.points).toEqual(turn.points);
  expect(brake.points).toEqual(turn.points);
  const mirror = predictFlyby({ offset: -3.5 });
  expect(mirror.turnAngle).toBeCloseTo(-turn.turnAngle, 7);
  expect(mirror.closest).toBeCloseTo(turn.closest, 7);
});

test("safe flybys across the control range retain numerical accuracy", () => {
  let escaped = 0;
  for (const speed of [0.45, 0.5, 0.7, 1, 1.4]) {
    for (const offset of [1.2, 2, 2.5, 3, 3.2, 3.5, 4, 6]) {
      const result = predictFlyby({ speed, offset });
      if (result.status !== "escaped") continue;
      escaped++;
      expect(result.energyError, `energy at ${speed}/${offset}`).toBeLessThan(0.001);
      expect(result.momentumError).toBeLessThan(0.001);
      expect(Math.abs(result.exitRelativeSpeed - speed) / speed).toBeLessThan(0.001);
      expect(result.points.length).toBeLessThanOrEqual(8001);
    }
  }
  expect(escaped).toBeGreaterThan(20);
});

test("surface crossing and insufficient horizon never claim an exit or gain", () => {
  for (const result of [predictFlyby(FLYBY_PRESETS[3]), predictFlyby({ offset: 0 }), predictFlyby({}, { maxSteps: 5 })]) {
    expect(["collision", "incomplete"]).toContain(result.status);
    expect(result.exitRelativeSpeed).toBeNull();
    expect(result.exitStationSpeed).toBeNull();
    expect(result.deltaSpeed).toBeNull();
    expect(result.turnAngle).toBeNull();
    expect(result.points.length).toBeLessThanOrEqual(8001);
    expect(result.points.every((p) => Object.values(p).every(Number.isFinite))).toBe(true);
    if (result.status === "collision") expect(Math.hypot(result.points.at(-1).x, result.points.at(-1).y)).toBeCloseTo(1, 8);
  }
});

test("nonfinite and out-of-range inputs cannot start unbounded calculations", () => {
  for (const parameters of [{ speed: NaN }, { speed: Infinity }, { speed: 0 }, { speed: 2 }, { offset: 7 }, { offset: NaN }, { planetSpeed: 1 }]) expect(() => predictFlyby(parameters)).toThrow();
  for (const options of [{ step: 0 }, { step: NaN }, { step: 1 }, { maxSteps: Infinity }, { maxSteps: 0 }, { maxSteps: 9000 }, { maxSteps: 2.5 }, { mu: -1 }, { mu: Infinity }]) expect(() => predictFlyby({}, options)).toThrow();
  expect(predictFlyby({}, { step: 0.005 }).points.length).toBeLessThanOrEqual(8001);
});
