import { FLYBY_DEFAULTS, FLYBY_PRESETS, predictFlyby } from "../game/flyby.js";
import { getTime } from "../core/time.js";

export function setupFlightLab() {
  const panel = document.getElementById("panel-course");
  const canvas = document.getElementById("flyby-canvas");
  const ctx = canvas.getContext("2d");
  const status = document.getElementById("flyby-status");
  const play = document.getElementById("flybyPlay");
  const inputs = { speed: document.getElementById("flyby-speed"), offset: document.getElementById("flyby-offset"), planetSpeed: document.getElementById("flyby-planet-speed") };
  let parameters = { ...FLYBY_DEFAULTS };
  let prediction;
  let bounds;
  let playing = false;
  let cursor = 0;
  let previousTime = performance.now();

  function recompute() {
    try {
      const next = Object.fromEntries(Object.entries(inputs).map(([name, input]) => [name, Number(input.value)]));
      prediction = predictFlyby(next);
      parameters = next;
      playing = false;
      cursor = 0;
      play.textContent = "Проиграть манёвр";
      const all = [...prediction.points, ...prediction.direct, { x: -1.5, y: -1.5 }, { x: 1.5, y: 1.5 }];
      bounds = { minX: Math.min(...all.map((p) => p.x)), maxX: Math.max(...all.map((p) => p.x)), minY: Math.min(...all.map((p) => p.y)), maxY: Math.max(...all.map((p) => p.y)) };
      for (const [name, input] of Object.entries(inputs)) document.getElementById(`${input.id}-value`).textContent = parameters[name].toFixed(2);
      const escaped = prediction.status === "escaped";
      const show = (n) => n === null ? "—" : n.toFixed(3);
      status.textContent = escaped ? "Пролёт рассчитан. Выход на таком же расстоянии от планеты, как вход." : prediction.status === "collision" ? "СТОЛКНОВЕНИЕ: траектория пересекает поверхность. Безопасного выхода и выигрыша скорости нет." : "Горизонт прогноза исчерпан. Выход ещё не рассчитан.";
      status.dataset.result = prediction.status;
      document.getElementById("flyby-closest").textContent = `${prediction.closest.toFixed(3)} R`;
      document.getElementById("flyby-angle").textContent = escaped ? `${prediction.turnAngle.toFixed(2)}°` : "—";
      document.getElementById("flyby-relative").textContent = `${show(prediction.initialRelativeSpeed)} → ${show(prediction.exitRelativeSpeed)}`;
      document.getElementById("flyby-station").textContent = `${show(prediction.initialStationSpeed)} → ${show(prediction.exitStationSpeed)}`;
      document.getElementById("flyby-gain").textContent = escaped ? `${prediction.deltaSpeed >= 0 ? "+" : ""}${prediction.deltaSpeed.toFixed(3)}` : "—";
      canvas.setAttribute("aria-label", `${status.textContent} Минимальное расстояние: ${prediction.closest.toFixed(3)} радиуса.`);
      draw();
    } catch (error) {
      playing = false;
      status.textContent = error.message;
      for (const [name, input] of Object.entries(inputs)) input.value = parameters[name];
    }
  }
  for (const input of Object.values(inputs)) input.addEventListener("input", recompute);
  for (const preset of FLYBY_PRESETS) {
    const button = document.createElement("button");
    button.textContent = preset.name;
    button.dataset.flybyPreset = preset.id;
    button.addEventListener("click", () => {
      for (const [name, input] of Object.entries(inputs)) input.value = preset[name];
      recompute();
    });
    document.getElementById("flyby-presets").append(button);
  }
  play.addEventListener("click", () => {
    if (cursor >= prediction.duration) cursor = 0;
    playing = !playing;
    previousTime = performance.now();
    play.textContent = playing ? "Пауза манёвра" : "Продолжить манёвр";
    draw();
  });
  document.getElementById("flybyReset").addEventListener("click", () => {
    for (const [name, input] of Object.entries(inputs)) input.value = FLYBY_DEFAULTS[name];
    recompute();
  });
  document.addEventListener("visibilitychange", () => { previousTime = performance.now(); });

  function draw() {
    if (!prediction || !bounds) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1) return;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const width = rect.width;
    const height = rect.height;
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = "#07101f"; ctx.fillRect(0, 0, width, height);
    const scale = Math.min((width - 36) / Math.max(3, bounds.maxX - bounds.minX), (height - 36) / Math.max(3, bounds.maxY - bounds.minY));
    const point = (p) => ({ x: width / 2 + (p.x - (bounds.minX + bounds.maxX) / 2) * scale, y: height / 2 - (p.y - (bounds.minY + bounds.maxY) / 2) * scale });
    const planet = point({ x: 0, y: 0 });
    ctx.fillStyle = "#436a81"; ctx.beginPath(); ctx.arc(planet.x, planet.y, scale, 0, Math.PI * 2); ctx.fill();
    function path(points, color, dashed) {
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash(dashed ? [5, 5] : []); ctx.beginPath();
      const stride = Math.max(1, Math.ceil(points.length / 1000));
      for (let i = 0; i < points.length; i += stride) { const p = point(points[i]); if (!i) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
      const end = point(points.at(-1)); ctx.lineTo(end.x, end.y); ctx.stroke(); ctx.setLineDash([]);
    }
    path(prediction.direct, "#99aabe", true);
    path(prediction.points, prediction.status === "collision" ? "#ff8875" : "#f5cc7a", false);
    let low = 0;
    let high = prediction.points.length - 1;
    while (high - low > 1) { const mid = Math.floor((low + high) / 2); if (prediction.points[mid].t <= cursor) low = mid; else high = mid; }
    const a = prediction.points[low];
    const b = prediction.points[high];
    const fraction = b.t === a.t ? 0 : Math.max(0, Math.min(1, (cursor - a.t) / (b.t - a.t)));
    const ship = point({ x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction });
    ctx.fillStyle = "#e7fff8"; ctx.beginPath(); ctx.arc(ship.x, ship.y, 5, 0, Math.PI * 2); ctx.fill();
    if (prediction.status === "collision") {
      const impact = point(prediction.points.at(-1));
      ctx.strokeStyle = "#ff8875"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(impact.x - 6, impact.y - 6); ctx.lineTo(impact.x + 6, impact.y + 6); ctx.moveTo(impact.x - 6, impact.y + 6); ctx.lineTo(impact.x + 6, impact.y - 6); ctx.stroke();
    }
    document.getElementById("flyby-time").textContent = `${cursor.toFixed(1)} / ${prediction.duration.toFixed(1)} усл. с${playing && getTime().paused ? " · общая пауза" : ""}`;
  }
  recompute();
  return {
    update() {
      const now = performance.now();
      const delta = Math.max(0, (now - previousTime) / 1000);
      previousTime = now;
      if (panel.hidden || document.getElementById("dashboard").hidden || document.hidden) return;
      if (playing && !getTime().paused) {
        cursor = Math.min(prediction.duration, cursor + delta * 5);
        if (cursor >= prediction.duration) { playing = false; play.textContent = "Повторить манёвр"; }
      }
      draw();
    },
  };
}
