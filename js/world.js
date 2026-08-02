import * as THREE from "three";

import { createStars } from "./stars.js";

import { createSun } from "./sun.js";

import { createPlanets } from "./planets.js";

import {
    addUpdatable
}
from "./updatables.js";


export function populateWorld(scene){

    //---------------------------------
    // Свет
    //---------------------------------

    const ambient =
        new THREE.AmbientLight(

            0xffffff,

            0.15

        );

    scene.add(ambient);


    //---------------------------------
    // Звезды
    //---------------------------------

    const stars =
        createStars();

    scene.add(stars);

    const sun =
        createSun();

    scene.add(sun);

    scene.add(
        createPlanets() 
    );

    addUpdatable(stars);

}