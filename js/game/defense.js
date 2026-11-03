import { CAREER_VERSION, normalizeCareer } from "./contracts.js";
import { METEORS, DEFENSE_DURATION, RELOAD_SECONDS, DEFENSE_EPSILON, defenseReward, defenseToken } from "./defense-state.js";

const round = (n) => Math.round(n * 1000000) / 1000000;
export function defenseTransition(career, action, { token, landedOn, seconds = 0, target = -1 } = {}) {
  if (career?.version !== CAREER_VERSION || normalizeCareer(career).issue) return { error: "Данные карьеры требуют восстановления." };
  const d = career.defense;
  if (token !== defenseToken(d)) return { error: "Обстановка изменилась. Команда не выполнена." };
  if (career.contractStatus !== "completed") return { error: "Сначала завершите доставку аппаратуры на Марс." };
  if (landedOn !== "mars") return { error: "Управление батареей и выплата доступны после посадки на Марс." };
  let next = { ...d, hp: [...d.hp] };
  let credits = career.credits;
  if (action === "start" && d.stage === "available") next.stage = "active";
  else if (action === "advance" && d.stage === "active") {
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > DEFENSE_DURATION) return { error: "Некорректный шаг дежурства." };
    next.elapsed = round(Math.min(DEFENSE_DURATION, d.elapsed + seconds));
    next.cooldown = round(Math.max(0, d.cooldown - (next.elapsed - d.elapsed)));
    next.hp = d.hp.map((hp, i) => hp > 0 && next.elapsed + DEFENSE_EPSILON >= METEORS[i].deadline ? -1 : hp);
  } else if (action === "fire" && d.stage === "active") {
    if (!Number.isInteger(target) || target < 0 || target >= 3 || d.hp[target] <= 0) return { error: "Выберите ещё летящую цель." };
    if (d.cooldown > DEFENSE_EPSILON) return { error: "Батарея перезаряжается: 2 секунды между выстрелами." };
    next.hp[target]--;
    next.shots++;
    next.cooldown = RELOAD_SECONDS;
  } else if (action === "claim" && d.stage === "resolved") {
    credits += defenseReward(d);
    if (!Number.isSafeInteger(credits)) return { error: "Награда не получена: баланс достиг допустимого предела." };
    next.stage = "completed";
  } else return { error: "Команда недоступна на этом этапе дежурства." };
  if (next.stage === "active" && next.hp.every((hp) => hp <= 0)) next.stage = "resolved";
  return { career: { ...career, credits, defense: next } };
}
