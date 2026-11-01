import { CONTRACT, contractTransition } from "../game/contracts.js";
import { usedSpace } from "../game/cargo.js";

export function setupContracts({ store, landedOn, chooseDestination, snapshot }) {
  const action = document.getElementById("contractAction");
  const route = document.getElementById("contractRoute");
  const journal = document.getElementById("contract-journal");
  let previous = "";
  function render() {
    const career = store.state.career;
    const blocked = Boolean(store.issue);
    const key = JSON.stringify([career.contractStatus, career.credits, usedSpace(career), Math.ceil(career.flightSeconds), landedOn(), blocked]);
    if (key === previous) return;
    previous = key;
    const status = career.contractStatus;
    document.getElementById("credit-count").textContent = String(career.credits);
    document.getElementById("cargo-count").textContent = `${usedSpace(career)} / ${CONTRACT.capacity}`;
    const remaining = Math.max(0, Math.ceil(CONTRACT.cruiseSeconds - career.flightSeconds));
    const time = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
    const message = status === "completed" ? "Груз принят на Марсе. +100 кредитов. В журнале появилась история «Тихий маяк». Откройте рынок: на Марсе выгоднее купить руду для Земли, на Земле — компоненты для Марса. Или продолжите экспедицию к Европе." :
      status === "available" ? "Сядьте на Землю и примите контракт. Аппаратура займёт 1 из 2 мест. Награда: 100 кредитов." :
      landedOn() === "mars" ? "Вы на Марсе. Передайте аппаратуру станции и получите награду." :
      `Аппаратура в трюме. Выберите Марс, взлетите, включите автопилот. Остаток круиза: ${time}.`;
    journal.textContent = blocked ? "Карьера недоступна до решения проблемы сохранения. Откройте настройки." : message;
    document.getElementById("voyage-status").textContent = status === "active" ? `МАРС · ${time}` : status === "completed" ? "+100 кр. · рейс завершён" : "ЗЕМЛЯ → МАРС · 100 кр.";
    document.getElementById("contract-status").textContent = { available: "ДОСТУПЕН", active: "ГРУЗ НА БОРТУ", completed: "ЗАВЕРШЁН" }[status];
    action.textContent = status === "completed" ? "Контракт выполнен" : status === "active" ? "Сдать груз · +100 кр." : "Принять контракт";
    action.disabled = blocked || status === "completed" || landedOn() !== (status === "available" ? "earth" : "mars");
    route.hidden = status === "completed";
    route.textContent = status === "available" ? "Маршрут к Земле" : "Маршрут к Марсу";
    document.getElementById("contract-cargo").textContent = status === "active" ? "Научная аппаратура · 1 место" : "Контрактный отсек пуст";
  }
  action.addEventListener("click", () => {
    if (store.issue) return;
    const next = contractTransition(store.state.career, store.state.career.contractStatus === "available" ? "accept" : "deliver", landedOn());
    if (!next) {
      const used = usedSpace(store.state.career);
      journal.textContent = used >= CONTRACT.capacity ? "В грузовом отсеке недостаточно места для аппаратуры." :
        "Действие недоступно. Проверьте груз и место посадки: получение на Земле, сдача на Марсе.";
      return;
    }
    snapshot();
    store.commit({ ...store.state, career: next });
    render();
  });
  route.addEventListener("click", () => chooseDestination(store.state.career.contractStatus === "available" ? "earth" : "mars"));
  document.getElementById("contractBtn").addEventListener("click", () => dispatchEvent(new CustomEvent("kosmodrom-open-tab", { detail: "missions" })));
  addEventListener("kosmodrom-career-change", render);
  store.subscribe(render);
  render();
  return { render };
}
