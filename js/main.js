import { createScene } from "./scene.js";

import { createEngine } from "./engine.js";

import { initUI } from "./ui.js";
import { createExpedition } from "./expedition.js";

window.addEventListener("DOMContentLoaded", async () => {
  const world = await createScene();
  initUI(world);
  world.expedition = createExpedition(world);
  const engine = createEngine(world);
  engine.start();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("./service-worker.js"),
  );
}
