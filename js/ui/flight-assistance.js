export function autopilotUnavailable({ crashed, target, landedOn }) {
  if (crashed) return "Корабль разрушен. Нажмите «На корабль», чтобы восстановить его.";
  if (!["planet", "moon"].includes(target.type)) return "Выберите планету или луну в разделе «Маршрут».";
  if (landedOn === target.config.id) return "Вы уже на поверхности цели. Выберите другую цель или нажмите «Взлёт».";
  return "";
}

export function setupFlightAssistance({ onAutopilot, onEmergencyFuel }) {
  const panel = document.getElementById("flight-assist");
  const message = document.getElementById("flight-help-message");
  const auto = document.getElementById("assistAutopilotBtn");
  const rescue = document.getElementById("emergencyFuelBtn");
  const resume = document.getElementById("resumeFlightBtn");
  const fuelStatus = document.getElementById("flight-fuel-status");
  let previous = "";
  auto.addEventListener("click", onAutopilot);
  rescue.addEventListener("click", onEmergencyFuel);
  resume.addEventListener("click", () => document.getElementById("pauseBtn").click());
  document.getElementById("chooseFlightTarget").addEventListener("click", () => dispatchEvent(new CustomEvent("kosmodrom-open-tab", { detail: "route" })));
  return {
    render(flight) {
      const block = autopilotUnavailable(flight);
      const key = JSON.stringify([block, flight.target.config.id, flight.autopilot, flight.contractCruise, flight.paused, flight.landedOn, flight.nearby, Math.floor(flight.fuel)]);
      if (key === previous) return;
      previous = key;
      panel.hidden = flight.contractCruise && !flight.paused;
      resume.hidden = !flight.paused;
      auto.disabled = Boolean(block) && !flight.autopilot;
      auto.textContent = flight.autopilot ? "Остановить автопилот" : `Автопилот → ${flight.target.config.name}`;
      rescue.hidden = flight.fuel > 0 || flight.crashed;
      fuelStatus.classList.toggle("low-fuel", flight.fuel <= 20);
      fuelStatus.textContent = flight.fuel <= 0 ? "Бак пуст. Автопилот работает без топлива. Для ручного полёта запросите аварийный запас." :
        flight.fuel <= 20 ? `Мало топлива: ${Math.floor(flight.fuel)}%. Автопилот не расходует топливо; полная заправка — на Земле.` :
          `Топливо: ${Math.floor(flight.fuel)}% · автопилот не расходует топливо`;
      message.textContent = flight.paused ? "Игра на паузе: полёт остановлен. Нажмите «Снять паузу», чтобы продолжить." :
        flight.autopilot ? `Автопилот ведёт корабль к цели «${flight.target.config.name}». По прибытии нажмите «Посадка».` :
          block || (flight.nearby ? "Вы рядом с поверхностью. Нажмите «Посадка» или выберите следующую цель." :
            `Цель: ${flight.target.config.name}. Нажмите «Автопилот»: он включит корабль и при необходимости выполнит взлёт. Посадка — отдельной кнопкой.`);
    },
  };
}
