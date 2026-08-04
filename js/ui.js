import { getTime, togglePause, setTimeScale } from "./time.js";
import { createNavigation } from "./navigation.js";
import { createLabels } from "./labels.js";

export function initUI(world) {
  const name = document.getElementById("planet-name");
  const description = document.getElementById("planet-description");
  const selected = document.getElementById("selected");
  const timeScale = document.getElementById("timeScale");
  const pauseButton = document.getElementById("pauseBtn");
  const progressKey = "visited-worlds-v2";
  const savedProgress = JSON.parse(localStorage.getItem(progressKey) ?? "[]");
  const visited = new Set(Array.isArray(savedProgress) ? savedProgress : []);
  function showInfo(config) {
    name.textContent = config.name;
    selected.textContent = config.name;
    description.innerHTML = `${config.description}<strong>💡 ${config.fact}</strong>`;
    if (config.id && config.id !== "sun") {
      visited.add(config.id);
      localStorage.setItem(progressKey, JSON.stringify([...visited]));
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
    (body) => navigation.flyTo(body),
  );
  world.navigation = navigation;
  world.labels = labels;

  const planetButtons = world.bodies.slice(1).map((body) => {
    const button = document.createElement("button");
    button.textContent = body.config.name;
    button.dataset.planet = body.config.id;
    button.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("kosmodrom-target", { detail: body }));
      navigation.flyTo(body);
    });
    return button;
  });
  document.getElementById("planet-list").append(...planetButtons);

  function updateProgress() {
    const percent = Math.round((visited.size / planetButtons.length) * 100);
    document.getElementById("mission-progress").style.width = `${percent}%`;
    document.getElementById("mission-count").textContent =
      `${visited.size} из ${planetButtons.length}`;
    planetButtons.forEach((button) =>
      button.classList.toggle("visited", visited.has(button.dataset.planet)),
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
  document
    .getElementById("tourBtn")
    .addEventListener("click", () => navigation.startTour());
  document
    .getElementById("tourPrevBtn")
    .addEventListener("click", () => navigation.stepTour(-1));
  document
    .getElementById("tourNextBtn")
    .addEventListener("click", () => navigation.stepTour(1));
  document
    .getElementById("resetBtn")
    .addEventListener("click", () => navigation.goHome());

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

      [110, 164.81, 220].forEach((frequency, index) => {
        const tone = context.createOscillator();
        const toneGain = context.createGain();
        tone.type = "sine";
        tone.frequency.value = frequency;
        toneGain.gain.value = [0.45, 0.2, 0.12][index];
        tone.connect(toneGain).connect(musicGain);
        tone.start();
      });
      const motor = context.createOscillator();
      motor.type = "sawtooth";
      motor.frequency.value = 48;
      motor.connect(engineGain);
      motor.start();
      updateAudioLevels();
    }
    context.resume();
  }

  function updateAudioLevels() {
    if (!context) return;
    const now = context.currentTime;
    musicGain.gain.setTargetAtTime(gainFor(music, 0.08), now, 0.05);
    const flying = document.body.classList.contains("flight-mode");
    engineGain.gain.setTargetAtTime(flying ? gainFor(engine, 0.035) : 0, now, 0.05);
  }

  [engine, music].forEach((slider) => slider.addEventListener("input", () => {
    startAudio();
    localStorage.setItem(slider.id, slider.value);
    updateAudioLevels();
    document.getElementById("radio-message").textContent = `ЦУП: канал ${slider.dataset.channel} настроен на ${slider.value}%`;
  }));
  addEventListener("kosmodrom-flight-mode", updateAudioLevels);
  addEventListener("pointerdown", startAudio, { once: true });
  addEventListener("keydown", startAudio, { once: true });
}

function setupQuiz() {
  const dialog = document.getElementById("quiz");
  document
    .getElementById("quizBtn")
    .addEventListener("click", () => dialog.showModal());
  dialog
    .querySelector(".close-quiz")
    .addEventListener("click", () => dialog.close());
  dialog.querySelectorAll("[data-answer]").forEach((button) => {
    button.addEventListener("click", () => {
      dialog.querySelector("output").textContent =
        button.dataset.answer === "earth"
          ? "Верно! Землю называют голубой планетой. 🏅"
          : "Почти! Подсказка: на ней есть океаны.";
    });
  });
}
