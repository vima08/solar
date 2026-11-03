import { normalizeCareer } from "./contracts.js";

export const SAVE_KEY = "kosmodrom-expedition-v1";
export const MAX_SAVE_BYTES = 1024 * 1024;
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const vector = (value) => Array.isArray(value) && value.length === 3 && value.every((n) => Number.isFinite(n) && Math.abs(n) <= 1e9);

export function validateExpedition(value, bodies) {
  if (!object(value)) throw new Error("Экспедиция должна быть объектом.");
  const ids = bodies.map((body) => body.config.id);
  const landable = bodies.filter((body) => ["planet", "moon"].includes(body.type)).map((body) => body.config.id);
  const result = {};
  if (value.quaternion !== undefined) {
    if (!Array.isArray(value.quaternion) || value.quaternion.length !== 4 || !value.quaternion.every(Number.isFinite) ||
        Math.abs(Math.hypot(...value.quaternion) - 1) > 0.01) throw new Error("Некорректная ориентация корабля.");
    result.quaternion = [...value.quaternion];
  }
  for (const key of ["position", "velocity", "landedOffset", "landedHeading"]) {
    if (value[key] === undefined) continue;
    if (!vector(value[key]) || (["landedOffset", "landedHeading"].includes(key) && Math.hypot(...value[key]) < 0.001)) throw new Error(`Некорректный вектор: ${key}.`);
    result[key] = [...value[key]];
  }
  for (const key of ["simple", "crashed"]) {
    if (value[key] === undefined) continue;
    if (typeof value[key] !== "boolean") throw new Error(`Некорректное поле: ${key}.`);
    result[key] = value[key];
  }
  if (value.fuel !== undefined) {
    if (!Number.isFinite(value.fuel) || value.fuel < 0 || value.fuel > 100) throw new Error("Некорректный запас топлива.");
    result.fuel = value.fuel;
  }
  if (value.target !== undefined) {
    if (!ids.includes(value.target)) throw new Error("Неизвестная цель полёта.");
    result.target = value.target;
  }
  if (value.landedOn !== undefined) {
    if (value.landedOn !== null && !landable.includes(value.landedOn)) throw new Error("Неизвестное место посадки.");
    result.landedOn = value.landedOn;
  }
  if (value.crashed && value.landedOn) throw new Error("Разрушенный корабль не может находиться на посадке.");
  if (value.deliveryMission !== undefined) {
    if (!Number.isInteger(value.deliveryMission) || value.deliveryMission < 0 || value.deliveryMission > 3) throw new Error("Некорректный этап миссии.");
    result.deliveryMission = value.deliveryMission;
  }
  if (value.samples !== undefined) {
    if (!Array.isArray(value.samples) || value.samples.length > landable.length || value.samples.some((id) => !landable.includes(id))) throw new Error("Некорректный список образцов.");
    result.samples = [...new Set(value.samples)];
  }
  const normalized = normalizeCareer(value.career);
  if (normalized.issue) throw new Error(normalized.issue === "future" ? "Версия карьеры новее этой игры." : "Повреждены данные карьеры.");
  result.career = normalized.career;
  return result;
}

export function validateExploration(value, bodies) {
  if (!object(value)) throw new Error("Нет данных исследования.");
  const result = {};
  for (const [key, type] of [["planets", "planet"], ["moons", "moon"]]) {
    const ids = bodies.filter((body) => body.type === type).map((body) => body.config.id);
    if (!Array.isArray(value[key]) || value[key].length > ids.length || value[key].some((id) => !ids.includes(id))) throw new Error("Некорректный список исследованных объектов.");
    result[key] = [...new Set(value[key])];
  }
  return result;
}

export function parseSaveFile(text, bodies) {
  if (new TextEncoder().encode(text).byteLength > MAX_SAVE_BYTES) throw new Error("Файл больше 1 МиБ.");
  let envelope;
  try { envelope = JSON.parse(text); } catch { throw new Error("Файл не является корректным JSON."); }
  if (!object(envelope) || envelope.format !== "kosmodrom-save" || ![1, 2, 3, 4].includes(envelope.version)) throw new Error("Неподдерживаемый формат или версия файла.");
  if (envelope.version === 1 && envelope.expedition?.career?.version > 1) throw new Error("Версия карьеры не соответствует старому формату файла.");
  if (envelope.version === 2 && envelope.expedition?.career?.version > 2) throw new Error("Версия карьеры не соответствует старому формату файла.");
  if (envelope.version === 3 && envelope.expedition?.career?.version > 3) throw new Error("Версия карьеры не соответствует старому формату файла.");
  return { ...validateExpedition(envelope.expedition, bodies), exploration: validateExploration(envelope.exploration, bodies) };
}

export function serializeSave(state) {
  const { exploration, ...expedition } = state;
  return JSON.stringify({ format: "kosmodrom-save", version: expedition.career?.version ?? 4, expedition, exploration }, null, 2);
}
