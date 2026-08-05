import { getTime, togglePause, setTimeScale } from "../core/time.js";
import { createNavigation } from "./navigation.js";
import { createLabels } from "./labels.js";
import { AMBIENT_AUDIO, ENGINE_AUDIO } from "../assets/audio-resources.js";

import { setupQuiz } from "./quiz.js";

export function initUI(world) {
  const name = document.getElementById("planet-name");
  const description = document.getElementById("planet-description");
  const selected = document.getElementById("selected");
  const timeScale = document.getElementById("timeScale");
  const pauseButton = document.getElementById("pauseBtn");
  const visited = new Set();
  const visitedMoons = new Set();
  function showInfo(config) {
    name.textContent = config.name;
    selected.textContent = config.name;
    description.innerHTML = `${config.description}<strong>💡 ${config.fact}</strong>`;
    const body = world.bodies.find((item) => item.config.id === config.id);
    if (body?.type === "planet") {
      visited.add(config.id);
      updateProgress();
    }
    if (body?.type === "moon") {
      visitedMoons.add(config.id);
      updateProgress();
    }
    document.getElementById("announcement").textContent =
      `Выбрано: ${config.name}. ${config.description}`;
  }

  const navigation = createNavigation(
    world.camera,
    world.controls,
    world.bodies,
    showInfo,
  );
  const labels = createLabels(
    world.bodies,
    world.camera,
    world.renderer,
    (body) => chooseBody(body),
  );
  world.navigation = navigation;
  world.labels = labels;

  const labelsHiddenToggle = document.getElementById("labelsHidden");
  labelsHiddenToggle.addEventListener("click", (event) => event.stopPropagation());
  labelsHiddenToggle.addEventListener("change", () => labels.setHidden(labelsHiddenToggle.checked));
  labels.setHidden(labelsHiddenToggle.checked);

  function chooseBody(body) {
    window.dispatchEvent(new CustomEvent("kosmodrom-target", { detail: body }));
    navigation.flyTo(body);
  }

  const destinationButtons = [];
  const planetList = document.getElementById("planet-list");
  const childBodies = new Map();
  world.bodies.forEach((body) => {
    if (body.parentId) {
      childBodies.set(body.parentId, [...(childBodies.get(body.parentId) ?? []), body]);
    }
  });

  function createDestinationButton(body) {
    const button = document.createElement("button");
    button.textContent = body.config.name;
    button.dataset.object = body.config.id;
    if (body.type === "planet") button.dataset.planet = body.config.id;
    if (body.type === "moon") button.dataset.moon = body.config.id;
    button.classList.toggle("secondary-object", body.type === "moon" || body.type === "comet");
    button.addEventListener("click", () => chooseBody(body));
    destinationButtons.push(button);
    return button;
  }

  world.bodies.forEach((body) => {
    if (body.type === "moon") return;
    const moons = childBodies.get(body.config.id) ?? [];
    if (body.type === "planet" && moons.length) {
      const group = document.createElement("div");
      group.className = "destination-group expanded";
      const row = document.createElement("div");
      row.className = "destination-row";
      const toggle = document.createElement("button");
      toggle.className = "moon-toggle";
      toggle.type = "button";
      toggle.textContent = "⌄";
      toggle.setAttribute("aria-label", `Свернуть спутники ${body.config.name}`);
      toggle.setAttribute("aria-expanded", "true");
      const moonList = document.createElement("div");
      moonList.className = "moon-list";
      moonList.append(...moons.map(createDestinationButton));
      toggle.addEventListener("click", () => {
        const expanded = group.classList.toggle("expanded");
        toggle.textContent = expanded ? "⌄" : "›";
        toggle.setAttribute("aria-expanded", String(expanded));
        toggle.setAttribute("aria-label", `${expanded ? "Свернуть" : "Развернуть"} спутники ${body.config.name}`);
      });
      row.append(createDestinationButton(body), toggle);
      group.append(row, moonList);
      planetList.append(group);
      return;
    }
    planetList.append(createDestinationButton(body));
  });
  const planetButtons = destinationButtons.filter((button) => button.dataset.planet);
  const moonButtons = destinationButtons.filter((button) => button.dataset.moon);

  function updateProgress() {
    const percent = Math.round((visited.size / planetButtons.length) * 100);
    const moonPercent = Math.round((visitedMoons.size / moonButtons.length) * 100);
    document.getElementById("mission-progress").style.width = `${percent}%`;
    document.getElementById("mission-count").textContent =
      `${visited.size} из ${planetButtons.length}`;
    document.getElementById("moon-mission-progress").style.width = `${moonPercent}%`;
    document.getElementById("moon-mission-count").textContent =
      `${visitedMoons.size} из ${moonButtons.length}`;
    planetButtons.forEach((button) =>
      button.classList.toggle("visited", visited.has(button.dataset.planet)),
    );
    moonButtons.forEach((button) =>
      button.classList.toggle("visited", visitedMoons.has(button.dataset.moon)),
    );
  }
  updateProgress();

  pauseButton.addEventListener("click", () => {
    togglePause();
    const paused = getTime().paused;
    pauseButton.textContent = paused ? "▶ Продолжить" : "⏸ Пауза";
    pauseButton.setAttribute("aria-pressed", String(paused));
  });
  [
    ["slowBtn", 0.04, "0.04×"],
    ["normalBtn", 0.2, "0.2×"],
    ["fastBtn", 2, "2×"],
  ].forEach(([id, scale, label]) => {
    document.getElementById(id).addEventListener("click", () => {
      setTimeScale(scale);
      timeScale.textContent = label;
    });
  });
  const tourButton = document.getElementById("tourBtn");
  tourButton.addEventListener("click", () => {
    const active = navigation.toggleTour();
    tourButton.setAttribute("aria-pressed", String(active));
  });
  addEventListener("kosmodrom-tour", (event) =>
    tourButton.setAttribute("aria-pressed", String(event.detail)),
  );
  document
    .getElementById("tourPrevBtn")
    .addEventListener("click", () => navigation.stepTour(-1));
  document
    .getElementById("tourNextBtn")
    .addEventListener("click", () => navigation.stepTour(1));
  setupQuiz();
  setupAudio();
}

function setupAudio() {
  const engine = document.getElementById("engineVolume");
  const music = document.getElementById("musicVolume");
  engine.value = localStorage.getItem("engineVolume") ?? 55;
  music.value = localStorage.getItem("musicVolume") ?? 30;

  let context;
  let musicGain;
  let engineGain;

  function gainFor(slider, maximum) {
    return (Number(slider.value) / 100) * maximum;
  }

  function startAudio() {
    if (!context) {
      context = new AudioContext();
      musicGain = context.createGain();
      engineGain = context.createGain();
      musicGain.connect(context.destination);
      engineGain.connect(context.destination);

      createLoop(AMBIENT_AUDIO, musicGain);
      createLoop(ENGINE_AUDIO, engineGain);
      updateAudioLevels();
    }
    context.resume();
  }

  function createLoop(source, destination) {
    const audio = new Audio(source);
    audio.loop = true;
    audio.preload = "auto";
    context.createMediaElementSource(audio).connect(destination);
    audio.play().catch(() => {});
  }

  function updateAudioLevels() {
    if (!context) return;
    const now = context.currentTime;
    musicGain.gain.setTargetAtTime(gainFor(music, 0.32), now, 0.15);
    const engineAudible = document.body.classList.contains("flight-mode") &&
      document.body.classList.contains("cockpit-mode");
    engineGain.gain.setTargetAtTime(engineAudible ? gainFor(engine, 0.22) : 0, now, 0.08);
  }

  [engine, music].forEach((slider) => slider.addEventListener("input", () => {
    startAudio();
    localStorage.setItem(slider.id, slider.value);
    updateAudioLevels();
    document.getElementById("radio-message").textContent = `ЦУП: канал ${slider.dataset.channel} настроен на ${slider.value}%`;
  }));
  addEventListener("kosmodrom-flight-mode", updateAudioLevels);
  addEventListener("kosmodrom-cockpit-mode", updateAudioLevels);
  addEventListener("pointerdown", startAudio, { once: true });
  addEventListener("keydown", startAudio, { once: true });
}
