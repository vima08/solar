import * as THREE from "three";
import { createRenderer } from "./renderer.js";
import { createCamera } from "./camera.js";
import { createControls } from "./controls.js";
import { setupResize } from "./resize.js";
import { populateWorld } from "../world/world.js";

export async function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const world = populateWorld(scene);
  const camera = createCamera();
  const renderer = createRenderer();
  const controls = createControls(camera, renderer.domElement);
  setupResize(camera, renderer);

  return { scene, camera, renderer, controls, bodies: world.bodies };
}
