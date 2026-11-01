import { CAPACITY, PORT_IDS, usedSpace } from "./cargo.js";
import { normalizeCareer } from "./contracts.js";

export const PORT_NAMES = { earth: "Земля", mars: "Марс" };
export const GOODS = [
  { id: "components", name: "Компоненты", prices: { earth: { buy: 30, sell: 24 }, mars: { buy: 48, sell: 40 } } },
  { id: "ore", name: "Руда", prices: { earth: { buy: 34, sell: 28 }, mars: { buy: 18, sell: 14 } } },
  { id: "water", name: "Вода", prices: { earth: { buy: 12, sell: 8 }, mars: { buy: 20, sell: 16 } } },
];

export function trade(career, kind, goodId, landedOn) {
  if (career?.version !== 2 || normalizeCareer(career).issue) return { error: "Данные карьеры требуют восстановления." };
  if (!PORT_IDS.includes(landedOn)) return { error: "Для торговли сядьте на Землю или Марс." };
  const good = GOODS.find((item) => item.id === goodId);
  if (!good || !["buy", "sell"].includes(kind)) return { error: "Неизвестный товар или действие." };
  const unitPrice = good.prices[landedOn][kind];
  const sequence = (career.lastTrade?.sequence ?? 0) + 1;
  if (!Number.isSafeInteger(sequence)) return { error: "Журнал сделок достиг предела. Сделка не выполнена." };
  let marketCargo = [...career.marketCargo];
  let basis = unitPrice;
  if (kind === "buy") {
    if (usedSpace(career) >= CAPACITY) return { error: "В трюме нет свободного места. Контрактный груз тоже занимает место." };
    if (career.credits < unitPrice) return { error: `Недостаточно денег: нужно ${unitPrice} кр.` };
    marketCargo.push({ goodId, purchasePrice: unitPrice });
  } else {
    const index = marketCargo.findIndex((item) => item.goodId === goodId);
    if (index === -1) return { error: "На борту нет этого товара. Контрактный груз продавать нельзя." };
    basis = marketCargo[index].purchasePrice;
    marketCargo.splice(index, 1);
  }
  const credits = career.credits + (kind === "buy" ? -unitPrice : unitPrice);
  if (!Number.isSafeInteger(credits) || credits < 0) return { error: "Сумма превышает допустимый предел. Сделка не выполнена." };
  return { career: { ...career, credits, marketCargo, lastTrade: { sequence, kind, goodId, portId: landedOn, price: unitPrice, basis, profit: kind === "sell" ? unitPrice - basis : 0 } } };
}

export function reliefTransition(career, action, landedOn, expectedSequence) {
  if (career?.version !== 2 || normalizeCareer(career).issue) return { error: "Данные карьеры требуют восстановления." };
  const job = career.reliefContract;
  if (expectedSequence !== job.sequence) return { error: "Условия подработки изменились. Откройте её заново." };
  if (action === "accept") {
    if (landedOn !== "earth" || career.contractStatus !== "completed" || career.credits >= 12 || usedSpace(career) !== 0 || job.status !== "idle") {
      return { error: "Подработка доступна на Земле после первого контракта: меньше 12 кредитов и пустой трюм." };
    }
    if (!Number.isSafeInteger(job.sequence + 1)) return { error: "Достигнут предел подработок." };
    return { career: { ...career, reliefContract: { sequence: job.sequence + 1, status: "active" } } };
  }
  if (action === "deliver" && landedOn === "mars" && job.status === "active" && Number.isSafeInteger(career.credits + 30)) {
    return { career: { ...career, credits: career.credits + 30, reliefContract: { sequence: job.sequence, status: "idle" } } };
  }
  return { error: "Сдача подработки доступна только с активным курьерским грузом на Марсе." };
}
