import * as THREE from "three";

export function createAsteroidBelt(count = 700) {
  const geometry = new THREE.IcosahedronGeometry(0.12, 0);
  const material = new THREE.MeshStandardMaterial({
    color: 0x77736f,
    roughness: 1,
  });
  const belt = new THREE.InstancedMesh(geometry, material, count);
  const dummy = new THREE.Object3D();

  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 33 + Math.random() * 3.8;
    dummy.position.set(
      Math.cos(angle) * radius,
      (Math.random() - 0.5) * 1.2,
      Math.sin(angle) * radius,
    );
    dummy.rotation.set(Math.random(), Math.random(), Math.random());
    dummy.scale.setScalar(0.5 + Math.random() * 1.8);
    dummy.updateMatrix();
    belt.setMatrixAt(index, dummy.matrix);
  }

  belt.update = (time) => {
    belt.rotation.y = time.elapsed * 0.015;
  };
  return belt;
}
