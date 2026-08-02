import * as THREE from "three";

import { createPlanet } from "./planet.js";

import { PLANETS } from "./constants.js";

import { addUpdatable } from "./updatables.js";

export function createPlanets(){

    const planets =
        new THREE.Group();

    for(const config of PLANETS){

        const planet = createPlanet(config);

        addUpdatable(
            planet
        );

        planets.add(
            planet
        );
    }


    return planets;

}