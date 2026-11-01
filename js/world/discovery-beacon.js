import * as THREE from "three";
import { EUROPA } from "../game/discovery-state.js";

export function createDiscoveryBeacon(bodies, getStory) {
  const body = bodies.find((item) => item.config.id === EUROPA);
  const group = new THREE.Group();
  group.name = "silent-beacon";
  const radius = Math.max(body.config.radius * 1.8, 0.72);
  const material = new THREE.MeshBasicMaterial({ color: 0xffd37a, transparent: true, opacity: 0.8, depthWrite: false });
  for (const tilt of [0.45, -0.65]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.016, 6, 64), material);
    ring.rotation.x = Math.PI / 2 + tilt;
    ring.rotation.y = tilt;
    group.add(ring);
  }
  const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), material);
  beacon.position.set(radius, 0.25, 0);
  group.add(beacon);
  body.object.add(group);
  group.visible = false;
  return {
    update(time) {
      group.visible = ["signal", "choice", "return"].includes(getStory().stage);
      material.opacity = 0.65 + Math.sin(time * 2) * 0.15;
      beacon.rotation.y = time;
    },
  };
}
