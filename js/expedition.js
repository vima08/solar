import * as THREE from "three";

const SAVE_KEY = "kosmodrom-expedition-v1";
const START = new THREE.Vector3(24, 2, 0);

export function createExpedition(world) {
  const ship = createShip();
  world.scene.add(ship);
  const state = loadState();
  ship.position.fromArray(state.position ?? START.toArray());
  const velocity = new THREE.Vector3().fromArray(state.velocity ?? [0, 0, 0]);
  const keys = new Set();
  let active = false;
  let cockpit = false;
  let simple = state.simple ?? true;
  let fuel = state.fuel ?? 100;
  let target = world.bodies.find((body) => body.config.id === (state.target ?? "earth"));
  let lastSave = 0;

  addEventListener("keydown", (event) => {
    if (["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE"].includes(event.code)) {
      keys.add(event.code);
      if (active) event.preventDefault();
    }
  });
  addEventListener("keyup", (event) => keys.delete(event.code));

  function setActive(value) {
    active = value;
    ship.visible = value;
    world.controls.enabled = !value;
    document.body.classList.toggle("flight-mode", value);
    document.getElementById("flightBtn").setAttribute("aria-pressed", String(value));
    announce(value ? "Корабль готов. Используй W A S D, Q и E." : "Автопилот отключён.");
  }

  function setCockpit(value) {
    cockpit = value;
    document.body.classList.toggle("cockpit-mode", value);
    document.getElementById("cockpitBtn").setAttribute("aria-pressed", String(value));
  }

  function setTarget(body) {
    target = body;
    updateRoute();
  }

  function update(delta) {
    if (!active) return;
    const targetPosition = target.object.getWorldPosition(new THREE.Vector3());
    const toTarget = targetPosition.clone().sub(ship.position);
    const forward = toTarget.clone().normalize();
    const side = new THREE.Vector3().crossVectors(forward, world.camera.up).normalize();
    const thrust = new THREE.Vector3();
    if (keys.has("KeyW")) thrust.add(forward);
    if (keys.has("KeyS")) thrust.sub(forward);
    if (keys.has("KeyA")) thrust.add(side);
    if (keys.has("KeyD")) thrust.sub(side);
    if (keys.has("KeyQ")) thrust.y += 1;
    if (keys.has("KeyE")) thrust.y -= 1;
    if (thrust.lengthSq() && fuel > 0) {
      velocity.addScaledVector(thrust.normalize(), delta * (simple ? 10 : 5));
      fuel = Math.max(0, fuel - delta * 0.7);
    }
    if (simple) velocity.multiplyScalar(Math.pow(0.12, delta));
    else applyGravity(world.bodies, ship.position, velocity, delta);
    velocity.clampLength(0, simple ? 8 : 15);
    ship.position.addScaledVector(velocity, delta);
    ship.lookAt(ship.position.clone().add(forward));

    const distance = toTarget.length();
    const safeDistance = target.config.radius + 1.3;
    if (distance < safeDistance) {
      velocity.multiplyScalar(0.35);
      document.getElementById("flight-warning").textContent =
        velocity.length() < 1.3 ? "Мягкая посадка! Образец получен 🪨" : "Снизь скорость! Опасное сближение";
      if (velocity.length() < 1.3) completeLanding(target.config.id);
    } else {
      document.getElementById("flight-warning").textContent = distance < 6 ? "Внимание: объект близко" : "Системы в норме";
    }
    positionCamera(forward);
    updateHud(distance);
    if (performance.now() - lastSave > 2500) save();
  }

  function positionCamera(forward) {
    if (cockpit) {
      world.camera.position.copy(ship.position).addScaledVector(forward, 0.9).add(new THREE.Vector3(0, 0.35, 0));
    } else {
      world.camera.position.lerp(ship.position.clone().addScaledVector(forward, -7).add(new THREE.Vector3(0, 3, 0)), 0.12);
    }
    world.camera.lookAt(ship.position.clone().addScaledVector(forward, 8));
  }

  function updateHud(distance) {
    document.getElementById("ship-speed").textContent = `${velocity.length().toFixed(1)} км/с`;
    document.getElementById("ship-distance").textContent = `${distance.toFixed(1)} млн км`;
    document.getElementById("ship-fuel").textContent = `${Math.round(fuel)}%`;
    document.getElementById("fuel-level").style.width = `${fuel}%`;
  }

  function updateRoute() {
    const distance = target.object.getWorldPosition(new THREE.Vector3()).distanceTo(ship.position);
    document.getElementById("route-target").textContent = target.config.name;
    document.getElementById("route-eta").textContent = `≈ ${Math.max(1, Math.ceil(distance / 6))} мин`;
  }

  function completeLanding(id) {
    const samples = new Set(state.samples ?? []);
    samples.add(id);
    state.samples = [...samples];
    document.getElementById("sample-count").textContent = String(samples.size);
    save();
  }

  function save() {
    lastSave = performance.now();
    Object.assign(state, { position: ship.position.toArray(), velocity: velocity.toArray(), fuel, simple, target: target.config.id });
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }

  document.getElementById("flightBtn").addEventListener("click", () => setActive(!active));
  addEventListener("kosmodrom-target", (event) => setTarget(event.detail));
  document.getElementById("cockpitBtn").addEventListener("click", () => setCockpit(!cockpit));
  document.getElementById("physicsMode").addEventListener("change", (event) => { simple = event.target.checked; save(); });
  document.getElementById("refuelBtn").addEventListener("click", () => { fuel = 100; updateHud(0); save(); });
  document.getElementById("missionAction").addEventListener("click", () => {
    const missions = ["Доставь зонд на Марс", "Сфотографируй шторм Юпитера", "Пролети через кольца Сатурна", "Вернись на Землю"];
    state.mission = ((state.mission ?? -1) + 1) % missions.length;
    document.getElementById("active-mission").textContent = missions[state.mission];
    save();
  });
  document.getElementById("physicsMode").checked = simple;
  document.getElementById("sample-count").textContent = String((state.samples ?? []).length);
  document.getElementById("active-mission").textContent = ["Доставь зонд на Марс", "Сфотографируй шторм Юпитера", "Пролети через кольца Сатурна", "Вернись на Землю"][state.mission ?? 0];
  setActive(false);
  updateRoute();
  return { update, setTarget, save };
}

function createShip() {
  const ship = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.8, 12), new THREE.MeshStandardMaterial({ color: 0xe8f4ff, metalness: 0.65, roughness: 0.25 }));
  hull.rotation.x = Math.PI / 2;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2, 0.08, 0.65), new THREE.MeshStandardMaterial({ color: 0x4fc9ff, emissive: 0x063a65 }));
  const engine = new THREE.PointLight(0x58cfff, 3, 8);
  engine.position.z = 1;
  ship.add(hull, wing, engine);
  ship.visible = false;
  return ship;
}

function applyGravity(bodies, position, velocity, delta) {
  for (const body of bodies) {
    const offset = body.object.getWorldPosition(new THREE.Vector3()).sub(position);
    const distanceSq = Math.max(offset.lengthSq(), 4);
    velocity.addScaledVector(offset.normalize(), (body.config.radius ** 2 * delta) / distanceSq);
  }
}

function loadState() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)) ?? {}; } catch { return {}; }
}

function announce(text) { document.getElementById("announcement").textContent = text; }
