import { createScene } from "./app/scene.js";

import { createEngine } from "./core/engine.js";

import { initUI } from "./ui/ui.js";
import { createExpedition } from "./ui/expedition.js";
import { createSaveStore } from "./game/save-store.js";

window.addEventListener("DOMContentLoaded", async () => {
  const world = await createScene();
  world.saveStore = createSaveStore(world.bodies);
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
