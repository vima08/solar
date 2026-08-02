import * as THREE from "three";
import { createStars } from "./stars.js";
import { createSun } from "./sun.js";
import { createPlanets } from "./planets.js";
import { addUpdatable } from "./updatables.js";
import { createAsteroidBelt } from "./asteroids.js";

export function populateWorld(scene) {
  scene.add(new THREE.HemisphereLight(0x8fb9ff, 0x050611, 0.45));
  const stars = createStars();
  scene.add(stars);
  addUpdatable(stars);

  const sun = createSun();
  scene.add(sun);
  addUpdatable(sun);

  const asteroidBelt = createAsteroidBelt();
  scene.add(asteroidBelt);
  addUpdatable(asteroidBelt);
  const planets = createPlanets();
  scene.add(planets.group);
  return {
    bodies: [
      {
        object: sun.userData.sphere,
        config: {
          id: "sun",
          name: "Солнце",
          radius: 5,
          description: "Наша звезда дарит планетам свет и тепло.",
          fact: "Внутри Солнца поместилось бы около миллиона Земель.",
        },
      },
      ...planets.bodies,
    ],
  };
}
