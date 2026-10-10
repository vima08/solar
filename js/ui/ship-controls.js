import * as THREE from "three";

const CONTROL_KEYS = [
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
];
const FORWARD = new THREE.Vector3(0, 0, 1);
const TURN_SPEED = 0.78;
const ROLL_SPEED = 1.05;

export function createShipControls(ship, velocity, options) {
  const keys = new Set();

  addEventListener("keydown", (event) => {
    if (!CONTROL_KEYS.includes(event.code)) return;
    if (event.target.closest?.("input, textarea, select")) return;
    if (event.code.startsWith("Arrow") && event.target.closest?.("button, summary, [role='tab']")) return;
    keys.add(event.code);
    if (options.isActive()) event.preventDefault();
  });
  addEventListener("keyup", (event) => keys.delete(event.code));
  addEventListener("blur", () => keys.clear());
  addEventListener("kosmodrom-flight-mode", () => keys.clear());

  function update(delta) {
    if (!options.isActive()) return { forward: getShipForward(ship), hasThrust: false };
    if (keys.has("KeyA")) ship.rotateY(TURN_SPEED * delta);
    if (keys.has("KeyD")) ship.rotateY(-TURN_SPEED * delta);
    if (keys.has("ArrowUp")) ship.rotateX(TURN_SPEED * delta);
    if (keys.has("ArrowDown")) ship.rotateX(-TURN_SPEED * delta);
    if (keys.has("ArrowLeft")) ship.rotateZ(-ROLL_SPEED * delta);
    if (keys.has("ArrowRight")) ship.rotateZ(ROLL_SPEED * delta);

    const forward = getShipForward(ship);
    const thrust = new THREE.Vector3();
    if (keys.has("KeyW")) thrust.add(forward);
    if (keys.has("KeyS")) thrust.sub(forward);

    const hasThrust = thrust.lengthSq() > 0 && options.hasFuel();
    if (hasThrust) {
      velocity.addScaledVector(thrust.normalize(), delta * (options.isSimple() ? 10 : 5));
      options.consumeFuel(delta * 0.7);
    }

    return { forward, hasThrust };
  }

  return { update };
}

export function getShipForward(ship) {
  return FORWARD.clone().applyQuaternion(ship.quaternion).normalize();
}
