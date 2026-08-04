import { createScene } from "./app/scene.js";

import { createEngine } from "./core/engine.js";

import { initUI } from "./ui/ui.js";
import { createExpedition } from "./ui/expedition.js";

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
