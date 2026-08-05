import * as THREE from "three";
import { COLORS } from "../core/constants.js";
import { COMET_ORBIT_X, COMET_ORBIT_Z } from "../core/constants.js";

const INCLINATION = THREE.MathUtils.degToRad(58);


export function createComet() {
  const comet = new THREE.Group();
  comet.name = "inclined-comet";

  const nucleus = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.9, 2),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xb9efff,
      emissiveIntensity: 2.2,
      roughness: 0.82,
    }),
  );

  const coma = new THREE.Mesh(
    new THREE.SphereGeometry(1.65, 24, 24),
    new THREE.MeshBasicMaterial({
      color: 0xd9f8ff,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    }),
  );
  coma.renderOrder = 2;

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
    position.set(Math.cos(angle) * COMET_ORBIT_X, 0, Math.sin(angle) * COMET_ORBIT_Z);
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
    { length: 25, radius: 3.5, color: 0x60cfff, opacity: 0.38 },
    { length: 18, radius: 1.7, color: 0xe4fbff, opacity: 0.68 },
  ];

  layers.forEach(({ length, radius, color, opacity }) => {
    const plume = new THREE.Mesh(
      new THREE.ConeGeometry(radius, length, 28, 1, true),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    plume.renderOrder = 1;
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
      Math.cos(angle) * COMET_ORBIT_X,
      0,
      Math.sin(angle) * COMET_ORBIT_Z,
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
