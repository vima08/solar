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

export function setupQuiz() {
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
