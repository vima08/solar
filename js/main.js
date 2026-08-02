import { createScene } from "./scene.js";

import { createEngine } from "./engine.js";

import { initUI } from "./ui.js";

window.addEventListener("DOMContentLoaded", async () => {

    const world = await createScene();

    initUI(world);

    const engine = createEngine(world);

    engine.start();

});
