import { newCareer, normalizeCareer } from "./contracts.js";
import { SAVE_KEY, validateExpedition, validateExploration } from "./save-files.js";

export function createSaveStore(bodies, storage = localStorage) {
  let raw = null;
  let issue = null;
  let state = {};
  let retired = false;
  let message = "Прогресс сохраняется в этом браузере.";
  try {
    raw = storage.getItem(SAVE_KEY);
    if (raw !== null) {
      try { state = JSON.parse(raw); } catch { issue = "damaged"; }
      if (!state || typeof state !== "object" || Array.isArray(state)) { state = {}; issue = "damaged"; }
    }
  } catch { message = "Хранилище недоступно. Прогресс не сохранён; скачайте JSON перед выходом."; }
  const career = normalizeCareer(state.career);
  issue = career.issue === "future" ? "future" : issue ?? career.issue;
  // Validate legacy fields independently; malformed data must never reach THREE.Vector3.
  try { Object.assign(state, validateExpedition({ ...state, career: undefined }, bodies)); }
  catch { state = {}; issue = issue === "future" ? issue : "damaged"; }
  state.career = career.career;
  try { state.exploration = validateExploration(state.exploration ?? { planets: [], moons: [] }, bodies); }
  catch {
    const original = state.exploration;
    state.exploration = {};
    for (const [key, type] of [["planets", "planet"], ["moons", "moon"]]) {
      const ids = bodies.filter((body) => body.type === type).map((body) => body.config.id);
      state.exploration[key] = Array.isArray(original?.[key]) ? [...new Set(original[key].filter((id) => ids.includes(id)))] : [];
    }
    issue = issue === "future" ? issue : "damaged";
  }
  if (issue === "future") message = "Это сохранение из более новой версии. Запись отключена, карьера недоступна. Скачайте исходную копию.";
  if (issue === "damaged") message = "Данные повреждены. Скачайте исходную копию перед восстановлением. Восстановление может удалить повреждённый торговый груз и журнал. До решения прогресс не записывается.";
  const listeners = new Set();
  const notify = () => listeners.forEach((callback) => callback());
  const report = (text) => { message = text; notify(); };
  const external = () => {
    issue = "external";
    report("Прогресс изменён в другой вкладке. Запись отключена. Перезагрузите игру, чтобы продолжить.");
  };
  const writable = () => {
    if (retired || issue === "external") return false;
    if (storage.getItem(SAVE_KEY) !== raw) { external(); return false; }
    return true;
  };
  if (typeof window !== "undefined") {
    addEventListener("storage", (event) => {
      if ((event.key === SAVE_KEY || event.key === null) && event.storageArea === storage && event.newValue !== raw) external();
    });
  }
  return {
    state,
    get issue() { return issue; },
    get raw() { return raw; },
    get message() { return message; },
    subscribe(callback) { listeners.add(callback); callback(); return () => listeners.delete(callback); },
    commit(nextState) {
      if (retired || issue) return false;
      try {
        if (!writable()) return false;
        const next = JSON.stringify(nextState);
        const copy = JSON.parse(next);
        storage.setItem(SAVE_KEY, next);
        for (const key of Object.keys(state)) delete state[key];
        Object.assign(state, copy);
        raw = next;
        report("Прогресс сохранён в браузере.");
        return true;
      } catch { report("Прогресс не сохранён: запись недоступна. Сделка отменена; деньги и груз не изменены."); return false; }
    },
    save() {
      if (retired || issue) return false;
      try {
        if (!writable()) return false;
        const next = JSON.stringify(state);
        storage.setItem(SAVE_KEY, next);
        raw = next;
        report("Прогресс сохранён в браузере.");
        return true;
      } catch { report("Прогресс не сохранён: хранилище недоступно или заполнено. Скачайте JSON перед выходом."); return false; }
    },
    restore() {
      if (issue !== "damaged") return false;
      issue = null;
      if (this.save()) return true;
      if (!issue) issue = "damaged";
      notify();
      return false;
    },
    reset() {
      return this.importState({ career: newCareer(), exploration: { planets: [], moons: [] }, samples: [], deliveryMission: 0, fuel: 100 },
        "Прогресс не сброшен: браузер отказал в записи. Текущий рейс не изменён.");
    },
    importState(next, failureMessage = "Загрузка не выполнена: браузер отказал в записи. Текущее сохранение не изменено.") {
      // A single setItem is atomic. Retire the old session before pagehide can write it back.
      try {
        if (!writable()) return false;
        storage.setItem(SAVE_KEY, JSON.stringify(next));
        retired = true;
        return true;
      } catch { report(failureMessage); return false; }
    },
  };
}
