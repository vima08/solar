import * as THREE from "three";
import { updateTime, getTime } from "./time.js";
import { updateAll } from "./updatables.js";

export function createEngine({
  scene,
  camera,
  renderer,
  controls,
  navigation,
  labels,
  expedition,
}) {
  const clock = new THREE.Clock();
  const fpsElement = document.getElementById("fps");
  let frameCount = 0;
  let lastFpsUpdate = performance.now();

  function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    updateTime(delta);
    controls.update();
    navigation?.update();
    updateAll(getTime(), delta);
    labels?.update();
    expedition?.update(delta);
    renderer.render(scene, camera);
    updateFpsCounter();
  }

  function updateFpsCounter() {
    frameCount += 1;
    const now = performance.now();
    if (now - lastFpsUpdate < 1000) return;
    fpsElement.textContent = String(frameCount);
    frameCount = 0;
    lastFpsUpdate = now;
  }

  return {
    start() {
      animate();
      document.getElementById("loading").style.display = "none";
    },
  };
}
