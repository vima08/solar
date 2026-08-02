import * as THREE from "three";
import { createPlanet } from "./planet.js";
import { PLANETS } from "./constants.js";
import { addUpdatable } from "./updatables.js";

export function createPlanets() {
    const group = new THREE.Group();
    const bodies = [];
    for (const config of PLANETS) {
        const planet = createPlanet(config);
        addUpdatable(planet);
        group.add(planet);
        bodies.push({ object: planet.userData.sphere, config });
    }
    return { group, bodies };
}
