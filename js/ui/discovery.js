import { discoveryTransition, discoveryDestination, discoveryScene, discoveryLog } from "../game/discovery.js";
import { usedSpace } from "../game/cargo.js";

export function setupDiscovery({ store, landedOn, snapshot, chooseDestination }) {
  const panel = document.getElementById("discovery-panel");
  const action = document.getElementById("discoveryAction");
  const route = document.getElementById("discoveryRoute");
  const choices = document.getElementById("discovery-choices");
  const dialog = document.getElementById("discovery-dialog");
  const confirm = document.getElementById("confirmDiscoveryBtn");
  const error = document.getElementById("discovery-error");
  const dialogError = document.getElementById("discovery-choice-error");
  let previous = "";
  let renderedStage = "unheard";
  let pending = null;

  function apply(kind, expectedStage) {
    if (store.issue) { error.textContent = store.message; dialogError.textContent = store.message; return false; }
    const result = discoveryTransition(store.state.career, kind, landedOn(), expectedStage);
    if (result.error) { error.textContent = result.error; dialogError.textContent = result.error; return false; }
    snapshot();
    if (!store.commit({ ...store.state, career: result.career })) {
      error.textContent = store.message;
      dialogError.textContent = store.message;
      return false;
    }
    dispatchEvent(new Event("kosmodrom-career-change"));
    return true;
  }
  action.addEventListener("click", () => apply({ unheard: "listen", signal: "survey", return: "finish" }[renderedStage], renderedStage));
  route.addEventListener("click", () => chooseDestination(discoveryDestination(store.state.career.discovery)));
  choices.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-choice]");
    if (!button || store.issue) return;
    const kind = button.dataset.choice;
    const check = discoveryTransition(store.state.career, kind, landedOn(), renderedStage);
    if (check.error) { error.textContent = check.error; return; }
    pending = { kind, stage: renderedStage };
    document.getElementById("discovery-choice-heading").textContent = kind === "open" ? "Опубликовать архив?" : "Поднять регистратор?";
    document.getElementById("discovery-choice-summary").textContent = kind === "open" ?
      "Вы получите 40 кр. сразу и ещё 30 после отдельной сдачи на Земле — всего 70 кр. Данные не займут трюм. Регистратор останется на Европе. Выбор окончательный для этого прохождения." :
      "Регистратор займёт 1 свободное место в общем трюме. Оплата сейчас: 0 кр.; после отдельной сдачи на Марсе: 110 кр. Регистратор нельзя продать на рынке. Открытая публикация станет недоступна. Выбор окончательный для этого прохождения.";
    dialogError.textContent = "";
    confirm.disabled = false;
    dispatchEvent(new Event("kosmodrom-input-reset"));
    dialog.showModal();
  });
  confirm.addEventListener("click", () => {
    if (!pending) return;
    if (apply(pending.kind, pending.stage)) {
      pending = null;
      confirm.disabled = true;
      dialog.close();
      document.getElementById("discovery-heading").focus({ preventScroll: true });
    }
  });
  dialog.addEventListener("close", () => { pending = null; });
  document.getElementById("contractBtn").addEventListener("click", () => {
    if (!panel.hidden) panel.scrollIntoView({ block: "start" });
  });

  function render() {
    const career = store.state.career;
    const story = career.discovery;
    const key = JSON.stringify([story, career.contractStatus, career.credits, usedSpace(career), landedOn(), store.issue]);
    if (key === previous) return;
    previous = key;
    renderedStage = story.stage;
    const unlocked = career.contractStatus === "completed";
    panel.hidden = !unlocked;
    document.getElementById("contractBtn").textContent = unlocked && story.stage !== "completed" ? "✦ Журнал" : "Журнал";
    document.getElementById("contractBtn").title = unlocked && story.stage === "unheard" ? "Новый сигнал: «Тихий маяк»" : "Журнал контрактов и открытий";
    const scene = discoveryScene(story);
    document.getElementById("discovery-chapter").textContent = scene.chapter;
    const text = document.getElementById("discovery-text");
    text.replaceChildren(...scene.paragraphs.map((paragraph) => {
      const p = document.createElement("p");
      p.textContent = paragraph;
      return p;
    }));
    document.getElementById("discovery-next").textContent = scene.next;
    document.getElementById("discovery-wallet").textContent = `${career.credits} кр. · Трюм: ${usedSpace(career)} / 2${story.stage === "return" && story.choice === "salvage" ? " · регистратор: 1 место" : ""}`;
    choices.hidden = story.stage !== "choice";
    const kind = { unheard: "listen", signal: "survey", return: "finish" }[story.stage];
    action.hidden = !kind;
    action.textContent = { listen: "Расшифровать сигнал", survey: "Исследовать маяк", finish: story.choice === "open" ? "Передать наблюдения · +30 кр." : "Сдать регистратор · +110 кр." }[kind] ?? "История завершена";
    const check = kind ? discoveryTransition(career, kind, landedOn(), story.stage) : {};
    action.disabled = Boolean(store.issue || check.error);
    document.getElementById("discovery-reason").textContent = store.issue ? "Запись отключена. Откройте сохранения в настройках." : check.error ?? "";
    route.hidden = ["unheard", "completed"].includes(story.stage);
    const destination = discoveryDestination(story);
    route.textContent = `Маршрут: ${destination === "earth" ? "Земля" : destination === "mars" ? "Марс" : "Европа"} →`;
    for (const choice of ["open", "salvage"]) {
      const choiceCheck = discoveryTransition(career, choice, landedOn(), story.stage);
      document.getElementById(`discovery-${choice}`).disabled = Boolean(store.issue || choiceCheck.error);
      document.getElementById(`discovery-${choice}-reason`).textContent = story.stage === "choice" ? choiceCheck.error ?? "" : "";
    }
    const log = document.getElementById("discovery-log");
    log.replaceChildren(...discoveryLog(story).map((entry) => {
      const item = document.createElement("li");
      item.textContent = entry;
      return item;
    }));
    document.getElementById("discovery-log-panel").hidden = story.stage === "unheard";
    document.getElementById("discovery-ending").hidden = story.stage !== "completed";
    error.textContent = "";
    if (pending) confirm.disabled = Boolean(store.issue || discoveryTransition(career, pending.kind, landedOn(), pending.stage).error);
  }
  store.subscribe(render);
  addEventListener("kosmodrom-career-change", render);
  return { render };
}
