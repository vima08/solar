import * as THREE from "three";
import { createPlanet } from "./planet.js";
import { PLANETS } from "../core/constants.js";
import { addUpdatable } from "../core/updatables.js";

export function createPlanets() {
  const group = new THREE.Group();
  const bodies = [];
  for (const config of PLANETS) {
    const planet = createPlanet(config);
    addUpdatable(planet);
    group.add(planet);
    bodies.push({ object: planet.userData.sphere, config, type: "planet" });
    bodies.push(...planet.userData.moons.map((moon) => ({
      object: moon.mesh,
      config: moon.config,
      type: "moon",
      parentId: config.id,
    })));
  }
  return { group, bodies };
}
