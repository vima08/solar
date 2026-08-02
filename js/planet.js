import * as THREE from "three";
import { COLORS } from "./constants.js";
import { getPlanetTexture } from "./planet-textures.js";

export function createPlanet(config) {
  const planet = new THREE.Group();
  const orbit = new THREE.Group();
  const geometry = new THREE.SphereGeometry(config.radius, 48, 48);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: getPlanetTexture(config.id),
    roughness: 0.72,
    metalness: 0.04,
  });
  const sphere = new THREE.Mesh(geometry, material);
  sphere.position.x = config.distance;
  sphere.userData.config = config;
  sphere.name = config.id;

  if (config.atmosphere) {
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(config.radius * 1.06, 32, 32),
      new THREE.MeshBasicMaterial({
        color: 0x72cfff,
        transparent: true,
        opacity: 0.14,
        side: THREE.BackSide,
      }),
    );
    sphere.add(atmosphere);
  }

  if (config.rings) {
    const rings = new THREE.Mesh(
      new THREE.RingGeometry(config.radius * 1.35, config.radius * 2.15, 96),
      new THREE.MeshBasicMaterial({
        color: 0xd9c795,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65,
      }),
    );
    rings.rotation.x = Math.PI / 2.25;
    sphere.add(rings);
  }

  const orbitCurve = new THREE.EllipseCurve(
    0,
    0,
    config.distance,
    config.distance,
    0,
    Math.PI * 2,
  );
  const orbitPoints = orbitCurve
    .getPoints(160)
    .map(({ x, y }) => new THREE.Vector3(x, 0, y));
  const orbitLine = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(orbitPoints),
    new THREE.LineBasicMaterial({
      color: COLORS.orbit,
      transparent: true,
      opacity: 0.28,
    }),
  );

  orbit.add(sphere);
  const moons = createMoons(config, sphere);
  planet.add(orbitLine, orbit);
  planet.userData = { orbit, sphere, config };
  planet.update = (time) => {
    orbit.rotation.y = time.elapsed * config.orbitSpeed * 0.12;
    sphere.rotation.y = time.elapsed * config.rotationSpeed;
    moons.forEach(({ pivot, speed }) => {
      pivot.rotation.y = time.elapsed * speed;
    });
  };
  return planet;
}

function createMoons(config, sphere) {
  return (config.moons ?? []).map((moon) => {
    const pivot = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(moon.radius, 24, 24),
      new THREE.MeshStandardMaterial({ color: moon.color, roughness: 0.9 }),
    );
    mesh.position.x = moon.distance;
    pivot.add(mesh);
    sphere.add(pivot);
    return { pivot, speed: moon.speed };
  });
}
