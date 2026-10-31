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
  if (issue === "damaged") message = "Данные повреждены. Скачайте исходную копию перед восстановлением. До решения прогресс не записывается.";
  let notify = () => {};
  const report = (text) => { message = text; notify(); };
  return {
    state,
    get issue() { return issue; },
    get raw() { return raw; },
    get message() { return message; },
    subscribe(callback) { notify = callback; notify(); },
    save() {
      if (retired || issue) return false;
      try {
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
      return this.save();
    },
    reset() {
      return this.importState({ career: newCareer(), exploration: { planets: [], moons: [] }, samples: [], deliveryMission: 0, fuel: 100 },
        "Прогресс не сброшен: браузер отказал в записи. Текущий рейс не изменён.");
    },
    importState(next, failureMessage = "Загрузка не выполнена: браузер отказал в записи. Текущее сохранение не изменено.") {
      // A single setItem is atomic. Retire the old session before pagehide can write it back.
      try {
        storage.setItem(SAVE_KEY, JSON.stringify(next));
        retired = true;
        return true;
      } catch { report(failureMessage); return false; }
    },
  };
}
