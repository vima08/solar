import * as THREE from "three";

export function createRenderer() {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  const isLowPowerDevice =
    navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
  const maxPixelRatio = isLowPowerDevice ? 1 : 1.75;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = !isLowPowerDevice;
  document.getElementById("scene-container").appendChild(renderer.domElement);

  return renderer;
}
