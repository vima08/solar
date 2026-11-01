export const CAPACITY = 2;
export const GOOD_IDS = ["components", "ore", "water"];
export const PORT_IDS = ["earth", "mars"];

export function usedSpace(career) {
  return career.cargo.reduce((sum, item) => sum + item.quantity, 0) +
    (career.marketCargo?.length ?? 0) + Number(career.reliefContract?.status === "active") +
    Number(career.discovery?.stage === "return" && career.discovery.choice === "salvage");
}

export function newEconomy() {
  return { marketCargo: [], lastTrade: null, reliefContract: { sequence: 0, status: "idle" } };
}

const price = (n) => Number.isSafeInteger(n) && n >= 1 && n <= 1000000;
export function validEconomy(career) {
  if (!Array.isArray(career.marketCargo) || career.marketCargo.length > CAPACITY ||
      career.marketCargo.some((item) => !item || !GOOD_IDS.includes(item.goodId) || !price(item.purchasePrice))) return false;
  const job = career.reliefContract;
  if (!job || !Number.isSafeInteger(job.sequence) || job.sequence < 0 || !["idle", "active"].includes(job.status) ||
      (job.status === "active" && (job.sequence === 0 || career.contractStatus !== "completed"))) return false;
  if (usedSpace(career) > CAPACITY) return false;
  const trade = career.lastTrade;
  if (trade === null) return true;
  return Boolean(trade && Number.isSafeInteger(trade.sequence) && trade.sequence > 0 &&
    ["buy", "sell"].includes(trade.kind) && GOOD_IDS.includes(trade.goodId) && PORT_IDS.includes(trade.portId) &&
    price(trade.price) && price(trade.basis) && Number.isSafeInteger(trade.profit) &&
    (trade.kind === "buy" ? trade.price === trade.basis && trade.profit === 0 : trade.profit === trade.price - trade.basis));
}
