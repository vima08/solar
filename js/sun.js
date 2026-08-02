import * as THREE from "three";
import { SUN_RADIUS } from "./constants.js";

export function createSun() {
  const sun = new THREE.Group();
  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_RADIUS, 64, 64),
    new THREE.MeshBasicMaterial({ color: 0xffb52e }),
  );
  surface.name = "sun";

  const glowMaterial = new THREE.SpriteMaterial({
    map: createGlowTexture(),
    color: 0xffa733,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const corona = new THREE.Sprite(glowMaterial);
  corona.scale.setScalar(SUN_RADIUS * 5.2);

  sun.add(corona, surface, new THREE.PointLight(0xfff3d1, 2.7, 0));
  sun.userData.sphere = surface;
  sun.update = (time) => {
    surface.rotation.y = time.elapsed * 0.05;
    corona.material.opacity = 0.8 + Math.sin(time.elapsed * 1.4) * 0.08;
  };
  return sun;
}

function createGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(64, 64, 5, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,255,220,1)");
  gradient.addColorStop(0.2, "rgba(255,170,40,.8)");
  gradient.addColorStop(1, "rgba(255,80,0,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}
