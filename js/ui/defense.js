import { defenseTransition } from "../game/defense.js";
import { METEORS, newDefense, defenseToken, defenseReward } from "../game/defense-state.js";
import { getTime } from "../core/time.js";

export function setupDefense({ store, landedOn, snapshot, chooseDestination }) {
  const dialog = document.getElementById("defense-dialog");
  const canvas = document.getElementById("defense-canvas");
  const ctx = canvas.getContext("2d");
  const play = document.getElementById("defensePlay");
  const fire = document.getElementById("defenseFire");
  const claim = document.getElementById("defenseClaim");
  const error = document.getElementById("defense-error");
  const targets = [...document.querySelectorAll("[data-meteor]")];
  let training = null;
  let paused = true;
  let selected = 0;
  let buffered = 0;
  let previousTime = performance.now();
  let flash = null;
  const current = () => training ?? store.state.career.defense;

  function apply(action, extra = {}) {
    if (store.issue) { paused = true; error.textContent = store.message; return false; }
    const base = training ? { ...store.state.career, defense: training } : store.state.career;
    const result = defenseTransition(base, action, { landedOn: training ? "mars" : landedOn(), token: defenseToken(current()), ...extra });
    if (result.error) { paused = true; error.textContent = result.error; render(); return false; }
    if (training) training = result.career.defense;
    else {
      snapshot();
      if (!store.commit({ ...store.state, career: result.career })) {
        paused = true;
        error.textContent = store.message;
        render();
        return false;
      }
    }
    render();
    return true;
  }
  function flush() {
    const seconds = buffered;
    buffered = 0;
    return seconds > 0 && current().stage === "active" ? apply("advance", { seconds: Math.min(42, seconds) }) : true;
  }
  function open(practice) {
    training = practice ? newDefense() : null;
    paused = true;
    buffered = 0;
    selected = 0;
    flash = null;
    previousTime = performance.now();
    error.textContent = "";
    render();
    dispatchEvent(new Event("kosmodrom-input-reset"));
    dialog.showModal();
    draw();
  }
  document.getElementById("defenseOpen").addEventListener("click", () => open(false));
  document.getElementById("defensePractice").addEventListener("click", () => open(true));
  document.getElementById("defenseRoute").addEventListener("click", () => chooseDestination("mars"));
  document.getElementById("contractBtn").addEventListener("click", () => {
    if (store.state.career.contractStatus === "completed" && store.state.career.defense.stage !== "completed") document.getElementById("defense-panel").scrollIntoView({ block: "start" });
  });
  document.getElementById("defenseClose").addEventListener("click", () => { flush(); paused = true; dialog.close(); });
  dialog.addEventListener("cancel", () => { flush(); paused = true; });
  dialog.addEventListener("close", () => { paused = true; buffered = 0; });
  play.addEventListener("click", () => {
    error.textContent = "";
    if (!paused && !getTime().paused) { flush(); paused = true; }
    else {
      if (current().stage === "available" && !apply("start")) return;
      if (getTime().paused) document.getElementById("pauseBtn").click();
      paused = false;
      previousTime = performance.now();
    }
    render();
  });
  fire.addEventListener("click", () => {
    if (paused || getTime().paused || !flush() || current().stage !== "active") return;
    const aimed = selected;
    if (apply("fire", { target: aimed })) flash = { target: aimed, time: performance.now(), elapsed: current().elapsed };
    draw();
  });
  claim.addEventListener("click", () => { if (!training && apply("claim")) paused = true; });
  targets.forEach((button, i) => button.addEventListener("click", () => { if (current().hp[i] > 0) { selected = i; render(); draw(); } }));
  canvas.addEventListener("pointerdown", (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * canvas.width;
    const y = (event.clientY - rect.top) / rect.height * canvas.height;
    const candidates = METEORS.map((_, i) => ({ i, p: point(i, current().elapsed + buffered) })).filter(({ i }) => current().hp[i] > 0);
    candidates.sort((a, b) => Math.hypot(a.p.x - x, a.p.y - y) - Math.hypot(b.p.x - x, b.p.y - y));
    if (candidates[0] && Math.hypot(candidates[0].p.x - x, candidates[0].p.y - y) < 60) { selected = candidates[0].i; render(); }
  });
  const suspend = () => { flush(); paused = true; previousTime = performance.now(); render(); };
  document.addEventListener("visibilitychange", suspend);
  addEventListener("pagehide", suspend);
  document.getElementById("pauseBtn").addEventListener("click", () => { flush(); previousTime = performance.now(); render(); });
  store.subscribe(() => {
    if (store.issue) { paused = true; buffered = 0; error.textContent = store.message; }
    render();
  });

  function render() {
    const career = store.state.career;
    const d = current();
    const unlocked = career.contractStatus === "completed";
    document.getElementById("defense-panel").hidden = !unlocked;
    const main = career.defense;
    const destroyed = main.hp.filter((hp) => hp === 0).length;
    document.getElementById("defense-journal").textContent = main.stage === "available" ? "Три метеорита угрожают «Аресу». На Марсе можно взять управление батареей: выберите цель и стреляйте с автоматическим упреждением. До 90 кредитов; проигрыш уменьшает только эту награду." :
      `Дежурство: ${{ active: "приостановлено вне экрана", resolved: "угрозы разрешены, получите награду", completed: "завершено, выплата получена" }[main.stage]}. Сбито: ${destroyed}/3. Урон станции: ${main.hp.filter((hp) => hp === -1).length}/3. Награда: ${defenseReward(main)} кр. Груз и прежние деньги сохранены.`;
    document.getElementById("defenseOpen").disabled = Boolean(store.issue || landedOn() !== "mars");
    document.getElementById("defensePractice").hidden = main.stage !== "completed";
    document.getElementById("defensePractice").disabled = Boolean(store.issue);
    document.getElementById("defense-port-reason").textContent = store.issue ? "Запись отключена: откройте сохранения." : landedOn() !== "mars" ? "Сначала выполните посадку на Марс." : "";
    document.getElementById("defense-mode").textContent = training ? "ТРЕНИРОВКА · без наград, не сохраняется" : "ДЕЖУРСТВО · защита «Ареса»";
    if (d.hp[selected] <= 0) selected = d.hp.findIndex((hp) => hp > 0);
    targets.forEach((button, i) => {
      button.disabled = d.hp[i] <= 0;
      button.setAttribute("aria-pressed", String(i === selected));
      button.textContent = `${METEORS[i].name} · ${d.hp[i] === -1 ? "удар" : d.hp[i] === 0 ? "уничтожен" : `${d.hp[i]} HP · ${Math.max(0, METEORS[i].deadline - d.elapsed).toFixed(1)} с`}`;
    });
    const ended = ["resolved", "completed"].includes(d.stage);
    document.getElementById("defense-clock").textContent = ended ? "Угрозы разрешены" : `${d.elapsed.toFixed(1)} / 42 с · ${getTime().paused ? "общая пауза" : paused ? "пауза" : "дежурство идёт"}`;
    play.textContent = d.stage === "available" ? "Начать дежурство · 42 с" : paused || getTime().paused ? "Продолжить" : "Пауза";
    play.disabled = ended || Boolean(store.issue);
    fire.disabled = Boolean(store.issue || paused || getTime().paused || d.stage !== "active" || d.cooldown > 0.000001 || selected < 0);
    fire.textContent = d.cooldown > 0.000001 ? `Перезарядка · ${d.cooldown.toFixed(1)} с` : "Огонь по выбранной цели";
    claim.hidden = training !== null || d.stage !== "resolved";
    claim.disabled = Boolean(store.issue || landedOn() !== "mars");
    claim.textContent = `Получить награду · ${defenseReward(d)} кр.`;
    document.getElementById("defense-result").textContent = `Сбито: ${d.hp.filter((hp) => hp === 0).length}/3 · Урон станции: ${d.hp.filter((hp) => hp === -1).length}/3 · ${training ? "Учение: выплаты нет" : `${d.stage === "completed" ? "Выплачено" : "Награда при сдаче"}: ${defenseReward(d)} кр.`}`;
  }
  function point(i, elapsed) {
    const t = Math.min(1, elapsed / METEORS[i].deadline);
    return { x: [140, 450, 760][i] + (450 - [140, 450, 760][i]) * t, y: 60 + 220 * t };
  }
  function draw() {
    const d = current();
    ctx.fillStyle = "#07101f"; ctx.fillRect(0, 0, 900, 340);
    ctx.strokeStyle = "#1d354a"; ctx.lineWidth = 1;
    for (let x = 0; x < 900; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 340); ctx.stroke(); }
    for (let y = 0; y < 340; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(900, y); ctx.stroke(); }
    ctx.fillStyle = "#68d7e0"; ctx.fillRect(410, 280, 80, 18);
    ctx.fillStyle = "#dcefff"; ctx.font = "16px sans-serif"; ctx.fillText("АРЕС", 427, 322);
    METEORS.forEach((meteor, i) => {
      if (d.hp[i] <= 0) return;
      const p = point(i, d.elapsed + buffered);
      ctx.strokeStyle = "#ab7750"; ctx.beginPath(); ctx.moveTo(p.x - 10, p.y - 25); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.fillStyle = "#ffad68"; ctx.beginPath(); ctx.arc(p.x, p.y, 11 + d.hp[i] * 2, 0, Math.PI * 2); ctx.fill();
      if (selected === i) { ctx.strokeStyle = "#98f5ef"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, 24, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1; }
      ctx.fillStyle = "#f4e2cb"; ctx.fillText(`${meteor.name} · ${d.hp[i]} HP`, p.x - 38, p.y - 32);
    });
    if (flash && performance.now() - flash.time < 350) {
      const p = point(flash.target, flash.elapsed);
      ctx.strokeStyle = "#a4ffec"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(450, 280); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.strokeStyle = "#ffc77a"; ctx.beginPath(); ctx.arc(p.x, p.y, 30, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1;
    }
  }
  return {
    update() {
      const now = performance.now();
      const delta = Math.max(0, (now - previousTime) / 1000);
      previousTime = now;
      if (!dialog.open) return;
      if (!paused && !document.hidden && !getTime().paused && current().stage === "active") {
        buffered += delta;
        if (buffered >= 0.25) flush();
      }
      draw();
    },
  };
}
