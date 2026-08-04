import { getTime, togglePause, setTimeScale } from "./time.js";
import { createNavigation } from "./navigation.js";
import { createLabels } from "./labels.js";
import { AMBIENT_AUDIO, ENGINE_AUDIO } from "./audio-resources.js";

const QUIZ_QUESTIONS = [
  { question: "Какую планету называют голубой?", answers: ["Марс", "Земля", "Сатурн"], correct: 1, fact: "Землю называют голубой планетой из-за океанов." },
  { question: "Какая планета ближе всего к Солнцу?", answers: ["Венера", "Меркурий", "Марс"], correct: 1, fact: "Меркурий — ближайшая к Солнцу планета." },
  { question: "У какой планеты самые заметные кольца?", answers: ["Сатурн", "Земля", "Нептун"], correct: 0, fact: "Кольца Сатурна состоят в основном из частиц льда и камня." },
  { question: "Какая планета самая большая?", answers: ["Юпитер", "Уран", "Земля"], correct: 0, fact: "Юпитер — крупнейшая планета Солнечной системы." },
  { question: "Как называется естественный спутник Земли?", answers: ["Титан", "Луна", "Европа"], correct: 1, fact: "Луна — единственный естественный спутник Земли." },
  { question: "Какую планету называют красной?", answers: ["Марс", "Венера", "Нептун"], correct: 0, fact: "Оксиды железа придают поверхности Марса красноватый цвет." },
  { question: "Какая планета вращается почти «лёжа на боку»?", answers: ["Меркурий", "Уран", "Юпитер"], correct: 1, fact: "Ось вращения Урана наклонена примерно на 98 градусов." },
  { question: "Какая планета дальше всего от Солнца?", answers: ["Сатурн", "Уран", "Нептун"], correct: 2, fact: "Нептун — восьмая и самая далёкая планета." },
];

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
    (body) => chooseBody(body),
  );
  world.navigation = navigation;
  world.labels = labels;

  function chooseBody(body) {
    window.dispatchEvent(new CustomEvent("kosmodrom-target", { detail: body }));
    navigation.flyTo(body);
  }

  const destinationButtons = world.bodies.map((body) => {
    const button = document.createElement("button");
    button.textContent = body.config.name;
    button.dataset.object = body.config.id;
    if (body.type === "planet") button.dataset.planet = body.config.id;
    button.classList.toggle("secondary-object", body.type === "moon" || body.type === "comet");
    button.addEventListener("click", () => chooseBody(body));
    return button;
  });
  document.getElementById("planet-list").append(...destinationButtons);
  const planetButtons = destinationButtons.filter((button) => button.dataset.planet);

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

function setupQuiz() {
  const dialog = document.getElementById("quiz");
  const title = dialog.querySelector("h2");
  const answers = dialog.querySelector(".quiz-answers");
  const result = dialog.querySelector("output");
  const counter = dialog.querySelector(".quiz-counter");
  let current = 0;

  function showQuestion() {
    const item = QUIZ_QUESTIONS[current];
    counter.textContent = `Вопрос ${current + 1} из ${QUIZ_QUESTIONS.length}`;
    title.textContent = item.question;
    result.textContent = "";
    answers.replaceChildren(...item.answers.map((answer, index) => {
      const button = document.createElement("button");
      button.textContent = answer;
      button.addEventListener("click", () => {
        if (index !== item.correct) {
          result.textContent = "Почти! Попробуй ещё раз.";
          return;
        }
        result.textContent = `Верно! ${item.fact} 🏅`;
        setTimeout(() => {
          current = (current + 1) % QUIZ_QUESTIONS.length;
          showQuestion();
        }, 1400);
      });
      return button;
    }));
  }
  document
    .getElementById("quizBtn")
    .addEventListener("click", () => { showQuestion(); dialog.showModal(); });
  dialog
    .querySelector(".close-quiz")
    .addEventListener("click", () => dialog.close());
}
