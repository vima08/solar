import { newEconomy, usedSpace, validEconomy } from "./cargo.js";

export const CONTRACT = Object.freeze({
  id: "earth-mars-equipment",
  title: "Аппаратура для «Ареса»",
  origin: "earth",
  destination: "mars",
  reward: 100,
  capacity: 2,
  cruiseSeconds: 300,
});

export function newCareer() {
  return { version: 2, credits: 0, contractStatus: "available", cargo: [], flightSeconds: 0, ...newEconomy() };
}

export function normalizeCareer(value) {
  if (value === undefined) return { career: newCareer(), issue: null };
  if (!value || typeof value !== "object" || Array.isArray(value) || !Number.isInteger(value.version) || value.version < 1) {
    return { career: newCareer(), issue: "damaged" };
  }
  if (value.version > 2) return { career: newCareer(), issue: "future" };
  const validStatus = ["available", "active", "completed"].includes(value.contractStatus);
  const contractStatus = validStatus ? value.contractStatus : "available";
  const validCredits = Number.isSafeInteger(value.credits) && value.credits >= 0;
  const validTime = Number.isFinite(value.flightSeconds) && value.flightSeconds >= 0 && value.flightSeconds <= CONTRACT.cruiseSeconds;
  const cargo = contractStatus === "active" ? [{ contractId: CONTRACT.id, quantity: 1 }] : [];
  const validCargo = Array.isArray(value.cargo) && value.cargo.length === cargo.length &&
    value.cargo.every((item, index) => item?.contractId === cargo[index].contractId && item.quantity === 1);
  const career = { ...value, version: 2, credits: validCredits ? value.credits : 0, contractStatus, cargo, flightSeconds: validTime ? value.flightSeconds : 0 };
  if (value.version === 1) Object.assign(career, newEconomy());
  const economyValid = validEconomy(career);
  if (!economyValid) Object.assign(career, newEconomy());
  return { career, issue: validStatus && validCredits && validTime && validCargo && economyValid ? null : "damaged" };
}

export function contractTransition(career, action, landedOn) {
  if (action === "accept" && career.contractStatus === "available" && landedOn === CONTRACT.origin) {
    const used = usedSpace(career);
    if (used + 1 > CONTRACT.capacity) return null;
    return { ...career, contractStatus: "active", cargo: [{ contractId: CONTRACT.id, quantity: 1 }], flightSeconds: 0 };
  }
  if (action === "deliver" && career.contractStatus === "active" && landedOn === CONTRACT.destination &&
      career.cargo.length === 1 && career.cargo[0].contractId === CONTRACT.id && career.cargo[0].quantity === 1 &&
      Number.isSafeInteger(career.credits + CONTRACT.reward)) {
    return { ...career, contractStatus: "completed", cargo: [], credits: career.credits + CONTRACT.reward };
  }
  return null;
}

// The same clock drives interpolation and the saved cruise counter. Physics has its own delta.
export function createFlightClock(now = performance.now()) {
  let previous = now;
  return {
    reset(time) { previous = time; },
    step(time, running) {
      const delta = Math.max(0, (time - previous) / 1000);
      previous = time;
      return running ? delta : 0;
    },
  };
}
