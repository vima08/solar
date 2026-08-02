import { createScene } from "./scene.js";

import { createEngine } from "./engine.js";

import { initUI } from "./ui.js";

window.addEventListener("DOMContentLoaded", async () => {

    const world = await createScene();

    const engine = createEngine(world);

    initUI();

    engine.start();

});