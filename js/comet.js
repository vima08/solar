import * as THREE from "three";
import { COLORS } from "./constants.js";

const INCLINATION = THREE.MathUtils.degToRad(58);
const ORBIT_X = 86;
const ORBIT_Z = 49;

export function createComet() {
  const comet = new THREE.Group();
  comet.name = "inclined-comet";

  const nucleus = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.65, 2),
    new THREE.MeshStandardMaterial({
      color: 0xd9e7ef,
      emissive: 0x739bb5,
      emissiveIntensity: 0.7,
      roughness: 0.82,
    }),
  );

  const coma = new THREE.Mesh(
    new THREE.SphereGeometry(1.25, 24, 24),
    new THREE.MeshBasicMaterial({
      color: 0xcaf4ff,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    }),
  );

  const tail = createTail();
  comet.add(nucleus, coma, tail);

  const orbit = createOrbitLine();
  const container = new THREE.Group();
  container.name = "comet-system";
  container.add(orbit, comet);
  container.userData.comet = comet;

  const position = new THREE.Vector3();
  const outward = new THREE.Vector3();
  const tailAxis = new THREE.Vector3(1, 0, 0);
  container.update = (time) => {
    const angle = time.elapsed * 0.055 + 1.15;
    position.set(Math.cos(angle) * ORBIT_X, 0, Math.sin(angle) * ORBIT_Z);
    position.applyAxisAngle(new THREE.Vector3(1, 0, 0), INCLINATION);
    comet.position.copy(position);

    // The solar wind always points the tail away from the Sun.
    outward.copy(position).normalize();
    tail.quaternion.setFromUnitVectors(tailAxis, outward);
    nucleus.rotation.set(time.elapsed * 0.6, time.elapsed * 0.35, 0);
    coma.scale.setScalar(1 + Math.sin(time.elapsed * 2.2) * 0.08);
  };
  container.update({ elapsed: 0 });

  return container;
}

function createTail() {
  const tail = new THREE.Group();
  const layers = [
    { length: 22, radius: 2.7, color: 0x8edfff, opacity: 0.18 },
    { length: 15, radius: 1.25, color: 0xe4fbff, opacity: 0.3 },
  ];

  layers.forEach(({ length, radius, color, opacity }) => {
    const plume = new THREE.Mesh(
      new THREE.ConeGeometry(radius, length, 28, 1, true),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    plume.rotation.z = Math.PI / 2;
    plume.position.x = length / 2 + 0.35;
    tail.add(plume);
  });

  return tail;
}

function createOrbitLine() {
  const points = [];
  for (let index = 0; index <= 220; index += 1) {
    const angle = (index / 220) * Math.PI * 2;
    const point = new THREE.Vector3(
      Math.cos(angle) * ORBIT_X,
      0,
      Math.sin(angle) * ORBIT_Z,
    );
    points.push(point.applyAxisAngle(new THREE.Vector3(1, 0, 0), INCLINATION));
  }
  return new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({
      color: COLORS.uiBlue,
      transparent: true,
      opacity: 0.16,
    }),
  );
}
