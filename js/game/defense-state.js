export const METEORS = [
  { name: "Искра", hp: 2, deadline: 18 },
  { name: "Осколок", hp: 3, deadline: 30 },
  { name: "Глыба", hp: 2, deadline: 42 },
];
export const DEFENSE_DURATION = 42;
export const RELOAD_SECONDS = 2;
export const DEFENSE_EPSILON = 0.000001;

export function newDefense() {
  return { stage: "available", elapsed: 0, cooldown: 0, hp: METEORS.map((item) => item.hp), shots: 0 };
}

export function defenseReward(defense) {
  const count = defense.hp.filter((hp) => hp === 0).length;
  return count * 20 + (count === 3 ? 30 : 0);
}

export function defenseToken(defense) {
  return `${defense.stage}:${defense.elapsed}:${defense.shots}`;
}

export function validDefense(career) {
  const d = career.defense;
  if (!d || !["available", "active", "resolved", "completed"].includes(d.stage) ||
      !Number.isFinite(d.elapsed) || d.elapsed < 0 || d.elapsed > DEFENSE_DURATION ||
      !Number.isFinite(d.cooldown) || d.cooldown < 0 || d.cooldown > RELOAD_SECONDS ||
      !Number.isSafeInteger(d.shots) || d.shots < 0 || d.shots > 7 ||
      !Array.isArray(d.hp) || d.hp.length !== 3) return false;
  let known = 0;
  let lost = 0;
  for (let i = 0; i < 3; i++) {
    const hp = d.hp[i];
    const target = METEORS[i];
    if (!Number.isInteger(hp) || hp < -1 || hp > target.hp) return false;
    if (hp === -1) {
      if (d.elapsed + DEFENSE_EPSILON < target.deadline) return false;
      lost += target.hp - 1;
    } else {
      known += target.hp - hp;
      if (hp > 0 && d.elapsed + DEFENSE_EPSILON >= target.deadline) return false;
    }
  }
  if (d.shots < known || d.shots > known + lost || (!d.shots && d.cooldown !== 0)) return false;
  const earliest = Math.max(0, d.shots - 1) * RELOAD_SECONDS;
  if (d.elapsed + DEFENSE_EPSILON < earliest ||
      (d.cooldown > 0 && d.elapsed - RELOAD_SECONDS + d.cooldown + DEFENSE_EPSILON < earliest)) return false;
  if (d.stage === "available") return d.elapsed === 0 && d.cooldown === 0 && d.shots === 0 && d.hp.every((hp, i) => hp === METEORS[i].hp);
  if (career.contractStatus !== "completed") return false;
  return d.stage === "active" ? d.hp.some((hp) => hp > 0) : d.hp.every((hp) => hp <= 0);
}
