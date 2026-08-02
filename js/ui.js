import { getTime, togglePause, setTimeScale } from "./time.js";
import { createNavigation } from "./navigation.js";
import { createLabels } from "./labels.js";

export function initUI(world) {
    const name = document.getElementById("planet-name");
    const description = document.getElementById("planet-description");
    const selected = document.getElementById("selected");
    const timeScale = document.getElementById("timeScale");
    const pauseButton = document.getElementById("pauseBtn");

    function showInfo(config) {
        name.textContent = config.name;
        selected.textContent = config.name;
        description.innerHTML = `${config.description}<strong>💡 ${config.fact}</strong>`;
    }

    const navigation = createNavigation(world.camera, world.controls, world.bodies, showInfo);
    const labels = createLabels(world.bodies, world.camera, world.renderer, (body) => navigation.flyTo(body));
    world.navigation = navigation;
    world.labels = labels;

    document.getElementById("planet-list").append(...world.bodies.slice(1).map((body) => {
        const button = document.createElement("button");
        button.textContent = body.config.name;
        button.dataset.planet = body.config.id;
        button.addEventListener("click", () => navigation.flyTo(body));
        return button;
    }));

    pauseButton.addEventListener("click", () => {
        togglePause();
        const paused = getTime().paused;
        pauseButton.textContent = paused ? "▶ Продолжить" : "⏸ Пауза";
        pauseButton.setAttribute("aria-pressed", String(paused));
    });
    [["slowBtn", .2, "0.2×"], ["normalBtn", 1, "1×"], ["fastBtn", 10, "10×"]].forEach(([id, scale, label]) => {
        document.getElementById(id).addEventListener("click", () => { setTimeScale(scale); timeScale.textContent = label; });
    });
    document.getElementById("tourBtn").addEventListener("click", () => navigation.startTour());
    document.getElementById("resetBtn").addEventListener("click", () => navigation.goHome());
}
