import * as THREE from "three";
import { createStars } from "./stars.js";
import { createSun } from "./sun.js";
import { createPlanets } from "./planets.js";
import { addUpdatable } from "../core/updatables.js";
import { createAsteroidBelt } from "./asteroids.js";
import { createComet } from "./comet.js";

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
  const comet = createComet();
  scene.add(comet);
  addUpdatable(comet);
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
      {
        object: comet.userData.comet.children[0],
        type: "comet",
        config: {
          id: "comet",
          name: "Комета",
          radius: 0.9,
          description: "Ледяная странница с ярким хвостом пересекает Солнечную систему.",
          fact: "Хвост кометы всегда направлен в сторону от Солнца.",
        },
      },
    ],
  };
}
