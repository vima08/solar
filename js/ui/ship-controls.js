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
    const arrow = event.code.startsWith("Arrow");
    if (arrow) {
      // Reserve arrows before tabs, sliders and browser scrolling receive them.
      event.preventDefault();
      event.stopPropagation();
    } else if (event.target.closest?.("input, textarea, select")) return;
    if (!options.isActive()) return;
    keys.add(event.code);
    event.preventDefault();
  }, { capture: true });
  addEventListener("keyup", (event) => {
    keys.delete(event.code);
    if (event.code.startsWith("Arrow")) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, { capture: true });
  addEventListener("blur", () => keys.clear());
  addEventListener("kosmodrom-flight-mode", () => keys.clear());
  addEventListener("kosmodrom-landing", () => keys.clear());
  addEventListener("kosmodrom-input-reset", () => keys.clear());
  document.addEventListener("visibilitychange", () => keys.clear());

  function update(delta) {
    if (!options.isActive() || document.hidden || document.querySelector("dialog[open]")) {
      keys.clear();
      return { forward: getShipForward(ship), hasThrust: false };
    }
    const analog = options.analog ?? {};
    const clamp = (n) => Math.max(-1, Math.min(1, n));
    ship.rotateY(clamp(Number(keys.has("KeyA")) - Number(keys.has("KeyD")) - (analog.yaw ?? 0)) * TURN_SPEED * delta);
    ship.rotateX(clamp(Number(keys.has("ArrowUp")) - Number(keys.has("ArrowDown")) + (analog.pitch ?? 0)) * TURN_SPEED * delta);
    ship.rotateZ(clamp(Number(keys.has("ArrowRight")) - Number(keys.has("ArrowLeft")) + (analog.roll ?? 0)) * ROLL_SPEED * delta);

    const forward = getShipForward(ship);
    const strength = clamp(Number(keys.has("KeyW")) - Number(keys.has("KeyS")) + (analog.thrust ?? 0));

    const hasThrust = strength !== 0 && options.hasFuel();
    if (hasThrust) {
      velocity.addScaledVector(forward, strength * delta * (options.isSimple() ? 10 : 5));
      options.consumeFuel(Math.abs(strength) * delta * 0.7);
    }

    return { forward, hasThrust };
  }

  return { update };
}

export function getShipForward(ship) {
  return FORWARD.clone().applyQuaternion(ship.quaternion).normalize();
}
