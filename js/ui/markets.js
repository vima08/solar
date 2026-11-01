import { GOODS, PORT_NAMES, trade, reliefTransition } from "../game/markets.js";
import { usedSpace, CAPACITY } from "../game/cargo.js";

export function setupMarkets({ store, landedOn, snapshot, chooseDestination }) {
  const cards = document.getElementById("market-goods");
  const result = document.getElementById("market-result");
  const relief = document.getElementById("reliefAction");
  let previous = "";
  let reliefSequence = 0;
  let reliefAction = "accept";
  for (const good of GOODS) {
    const card = document.createElement("article");
    card.className = "market-card";
    card.dataset.good = good.id;
    card.innerHTML = `<h3>${good.name}</h3><p class="market-prices"></p><p class="market-margin"></p><p class="market-stock"></p><div class="button-row"><button data-kind="buy" data-good="${good.id}"></button><button data-kind="sell" data-good="${good.id}"></button></div><p class="market-reason"></p>`;
    cards.append(card);
  }
  function apply(transition) {
    if (transition.error) { result.textContent = transition.error; return; }
    snapshot();
    if (!store.commit({ ...store.state, career: transition.career })) {
      result.textContent = store.message;
      return;
    }
    dispatchEvent(new Event("kosmodrom-career-change"));
  }
  cards.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-kind]");
    if (!button || store.issue) return;
    apply(trade(store.state.career, button.dataset.kind, button.dataset.good, landedOn()));
  });
  relief.addEventListener("click", () => {
    if (store.issue) return;
    apply(reliefTransition(store.state.career, reliefAction, landedOn(), reliefSequence));
  });
  for (const id of ["earth", "mars"]) document.getElementById(`market-route-${id}`).addEventListener("click", () => chooseDestination(id));
  document.getElementById("marketBtn").addEventListener("click", () => dispatchEvent(new CustomEvent("kosmodrom-open-tab", { detail: "market" })));

  function render() {
    const career = store.state.career;
    const port = landedOn();
    const key = JSON.stringify([career.credits, career.contractStatus, career.cargo, career.marketCargo, career.lastTrade, career.reliefContract, career.discovery, port, store.issue]);
    if (previous === key) return;
    previous = key;
    const local = Boolean(PORT_NAMES[port]);
    document.getElementById("market-port").textContent = local ? `Порт: ${PORT_NAMES[port]}` : "Торговля доступна после посадки на Землю или Марс.";
    document.getElementById("market-wallet").textContent = `${career.credits} кр. · Трюм: ${usedSpace(career)} / ${CAPACITY}`;
    for (const good of GOODS) {
      const card = cards.querySelector(`[data-good="${good.id}"]`);
      const held = career.marketCargo.filter((item) => item.goodId === good.id);
      card.querySelector(".market-prices").textContent = `Земля: купить ${good.prices.earth.buy} / продать ${good.prices.earth.sell} кр. · Марс: купить ${good.prices.mars.buy} / продать ${good.prices.mars.sell} кр.`;
      const other = port === "earth" ? "mars" : "earth";
      card.querySelector(".market-margin").textContent = local ? `Продажа в порту «${PORT_NAMES[other]}»: ${good.prices[other].sell} кр. · прибыль с единицы: ${good.prices[other].sell - good.prices[port].buy} кр.` : "Цены за 1 единицу. На борту — максимум 2 единицы общего груза.";
      card.querySelector(".market-stock").textContent = `На борту: ${held.length}${held.length ? ` · первая закупка: ${held[0].purchasePrice} кр.` : ""}`;
      const reasons = [];
      for (const kind of ["buy", "sell"]) {
        const button = card.querySelector(`[data-kind="${kind}"]`);
        const check = trade(career, kind, good.id, port);
        button.textContent = `${kind === "buy" ? "Купить за" : "Продать за"} ${local ? good.prices[port][kind] : "—"} кр.`;
        button.disabled = Boolean(store.issue || check.error);
        if (check.error) reasons.push(`${kind === "buy" ? "Покупка" : "Продажа"}: ${check.error}`);
      }
      card.querySelector(".market-reason").textContent = store.issue ? "Запись отключена. Откройте сохранения в настройках." : reasons.join(" ");
    }
    const last = career.lastTrade;
    result.textContent = last ? last.kind === "buy" ? `Куплено: ${GOODS.find((good) => good.id === last.goodId).name}. Расход: ${last.price} кр.` : `Продано: ${GOODS.find((good) => good.id === last.goodId).name}. Выручка: ${last.price} кр. · закупка: ${last.basis} кр. · прибыль: ${last.profit} кр.` : "Выберите товар. Каждое нажатие — одна единица; контрактный груз не продаётся.";
    const active = career.reliefContract.status === "active";
    reliefSequence = career.reliefContract.sequence;
    reliefAction = active ? "deliver" : "accept";
    const check = reliefTransition(career, reliefAction, port, reliefSequence);
    relief.textContent = active ? "Сдать курьерский груз · +30 кр." : "Взять бесплатный курьерский груз";
    relief.disabled = Boolean(store.issue || check.error);
    document.getElementById("relief-status").textContent = active ? "Курьерский груз: 1 место. Доставьте с Земли на Марс и сдайте отдельной кнопкой. Награда: 30 кр." : "Подработка Земля → Марс: 30 кр. Доступна после первого контракта при балансе менее 12 кр. и пустом трюме. Принятие бесплатно.";
    document.getElementById("relief-reason").textContent = store.issue ? "Запись отключена." : check.error ?? "Можно выполнить действие.";
  }
  store.subscribe(render);
  addEventListener("kosmodrom-career-change", render);
  return { render };
}
