import * as THREE from "three";
import { EXPLOSION_AUDIO } from "../assets/audio-resources.js";
import { createShipControls } from "./ship-controls.js";

const SAVE_KEY = "kosmodrom-expedition-v1";
const START = new THREE.Vector3(24, 2, 0);
const SHIP_SCALE = 0.36;
const CAMERA_FORWARD_FIX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

export function createExpedition(world) {
  const ship = createShip();
  world.scene.add(ship);
  const state = loadState();
  ship.position.fromArray(state.position ?? START.toArray());
  const velocity = new THREE.Vector3().fromArray(state.velocity ?? [0, 0, 0]);
  const explosions = [];
  let active = false;
  let cockpit = false;
  let simple = state.simple ?? true;
  let fuel = state.fuel ?? 100;
  let target = world.bodies.find((body) => body.config.id === (state.target ?? "earth"));
  let crashed = Boolean(state.crashed);
  let lastSave = 0;
  const shipControls = createShipControls(ship, velocity, {
    isActive: () => active,
    isSimple: () => simple,
    hasFuel: () => fuel > 0,
    consumeFuel: (amount) => { fuel = Math.max(0, fuel - amount); },
  });

  function setActive(value) {
    active = value;
    ship.visible = !crashed;
    world.controls.enabled = !value;
    document.body.classList.toggle("flight-mode", value);
    dispatchEvent(new CustomEvent("kosmodrom-flight-mode", { detail: value }));
    document.getElementById("flightBtn").setAttribute("aria-pressed", String(value));
    document.getElementById("flightBtn").textContent = value ? "◎ На объект" : "🚀 На корабль";
    if (crashed) {
      announce("Корабль разрушен. Нажми «На корабль», чтобы собрать новый корабль на стартовой орбите.");
    } else {
      announce(value ? "Корабль готов. Стрелки управляют тангажом и креном." : "Режим выбора объекта включён, корабль остаётся на месте.");
    }
  }

  function setCockpit(value) {
    cockpit = value;
    document.body.classList.toggle("cockpit-mode", value);
    dispatchEvent(new CustomEvent("kosmodrom-cockpit-mode", { detail: value }));
    document.getElementById("cockpitBtn").setAttribute("aria-pressed", String(value));
  }

  function setTarget(body) {
    target = body;
    updateRoute();
  }

  function update(delta) {
    updateExplosions(delta);
    if (!active) return;
    const { forward, hasThrust } = shipControls.update(delta);
    updateFlame(ship, hasThrust);
    if (simple) velocity.multiplyScalar(Math.pow(0.12, delta));
    else applyGravity(world.bodies, ship.position, velocity, delta);
    velocity.clampLength(0, simple ? 8 : 15);
    ship.position.addScaledVector(velocity, delta);

    const collision = findCollision(ship.position);
    if (collision) {
      crashInto(collision);
      return;
    }

    const distance = target.object.getWorldPosition(new THREE.Vector3()).distanceTo(ship.position);
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

  function findCollision(position) {
    return world.bodies.find((body) => {
      const bodyPosition = body.object.getWorldPosition(new THREE.Vector3());
      return bodyPosition.distanceTo(position) <= body.config.radius + 0.18;
    });
  }

  function crashInto(body) {
    crashed = true;
    velocity.set(0, 0, 0);
    setTarget(body);
    setActive(false);
    createExplosion(ship.position, body.config.radius);
    playExplosionSample();
    ship.visible = false;
    world.navigation?.flyTo(body);
    document.getElementById("flight-warning").textContent = `Столкновение: ${body.config.name}. Корабль разрушен!`;
    announce(`Столкновение с объектом ${body.config.name}. Автопилот переключил обзор на объект.`);
    save();
  }


  function createExplosion(position, radius) {
    const group = new THREE.Group();
    const flash = new THREE.PointLight(0xfff2a0, 18, Math.max(10, radius * 7));
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(0.9, radius * 0.55), 24, 16),
      new THREE.MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0.95 }),
    );
    const shockwave = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(1.2, radius * 0.9), 32, 16),
      new THREE.MeshBasicMaterial({ color: 0xff4a00, transparent: true, opacity: 0.42, wireframe: true }),
    );
    group.position.copy(position);
    group.add(flash, core, shockwave);
    world.scene.add(group);
    explosions.push({ group, flash, core, shockwave, age: 0, duration: 1.05 });
  }

  function updateExplosions(delta) {
    for (let index = explosions.length - 1; index >= 0; index -= 1) {
      const explosion = explosions[index];
      explosion.age += delta;
      const progress = explosion.age / explosion.duration;
      explosion.core.scale.setScalar(1 + progress * 2.4);
      explosion.shockwave.scale.setScalar(1 + progress * 4.2);
      explosion.core.material.opacity = Math.max(0, 0.95 * (1 - progress));
      explosion.shockwave.material.opacity = Math.max(0, 0.42 * (1 - progress));
      explosion.flash.intensity = Math.max(0, 18 * (1 - progress));
      if (progress >= 1) {
        world.scene.remove(explosion.group);
        explosions.splice(index, 1);
      }
    }
  }

  function playExplosionSample() {
    const audio = new Audio(EXPLOSION_AUDIO);
    audio.volume = 0.75;
    audio.play().catch(() => {});
  }

  function respawnShip() {
    crashed = false;
    ship.position.copy(START);
    velocity.set(0, 0, 0);
    fuel = 100;
    ship.visible = true;
    world.camera.position.copy(ship.position).add(new THREE.Vector3(0, 3, 7));
    updateHud(target.object.getWorldPosition(new THREE.Vector3()).distanceTo(ship.position));
    save();
    setActive(true);
  }

  function positionCamera(forward) {
    if (cockpit) {
      const cockpitOffset = new THREE.Vector3(0, 0.35, -0.35).applyQuaternion(ship.quaternion);
      world.camera.position.copy(ship.position).add(cockpitOffset);
      world.camera.quaternion.copy(ship.quaternion).multiply(CAMERA_FORWARD_FIX);
    } else {
      world.camera.up.set(0, 1, 0);
      world.camera.position.lerp(ship.position.clone().addScaledVector(forward, -7).add(new THREE.Vector3(0, 3, 0)), 0.12);
      world.camera.lookAt(ship.position.clone().addScaledVector(forward, 8));
    }
  }

  function updateHud(distance) {
    document.getElementById("ship-speed").textContent = `${velocity.length().toFixed(1)} км/с`;
    document.getElementById("ship-distance").textContent = `${distance.toFixed(1)} млн км`;
    document.getElementById("ship-fuel").textContent = `${Math.floor(fuel)}%`;
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
    Object.assign(state, { position: ship.position.toArray(), velocity: velocity.toArray(), fuel, simple, target: target.config.id, crashed });
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }

  document.getElementById("flightBtn").addEventListener("click", () => {
    if (crashed && !active) {
      respawnShip();
      return;
    }
    setActive(!active);
  });
  addEventListener("kosmodrom-target", (event) => {
    setTarget(event.detail);
    setActive(false);
  });
  document.getElementById("cockpitBtn").addEventListener("click", () => setCockpit(!cockpit));
  document.getElementById("physicsMode").addEventListener("change", (event) => { simple = event.target.checked; save(); });
  document.getElementById("refuelBtn").addEventListener("click", () => { fuel = 100; updateHud(0); save(); });
  document.getElementById("missionAction").addEventListener("click", () => {
    const missions = ["Доставь зонд на Марс", "Сфотографируй шторм Юпитера", "Пролети через кольца Сатурна", "Вернись на Землю"];
    state.mission = ((state.mission ?? 0) + 1) % missions.length;
    document.getElementById("active-mission").textContent = missions[state.mission];
    save();
  });
  document.getElementById("physicsMode").checked = simple;
  document.getElementById("sample-count").textContent = String((state.samples ?? []).length);
  document.getElementById("active-mission").textContent = ["Доставь зонд на Марс", "Сфотографируй шторм Юпитера", "Пролети через кольца Сатурна", "Вернись на Землю"][state.mission ?? 0];
  ship.visible = !crashed;
  setActive(false);
  updateRoute();
  return { update, setTarget, save };
}

function updateFlame(ship, enabled) {
  const flame = ship.getObjectByName("engine-flame");
  if (!flame) return;
  flame.visible = enabled;
  flame.material.opacity = enabled ? 0.78 : 0;
  const pulse = 0.85 + Math.random() * 0.45;
  flame.scale.set(pulse, pulse, 1.2 + Math.random() * 0.6);
}


function createShip() {
  const ship = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.8, 12), new THREE.MeshStandardMaterial({ color: 0xe8f4ff, metalness: 0.65, roughness: 0.25 }));
  hull.rotation.x = Math.PI / 2;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2, 0.08, 0.65), new THREE.MeshStandardMaterial({ color: 0x4fc9ff, emissive: 0x063a65 }));
  const engine = new THREE.PointLight(0x58cfff, 2, 4);
  engine.position.z = -0.72;
  const flame = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 16, 10),
    new THREE.MeshBasicMaterial({ color: 0xff2a00, transparent: true, opacity: 0 }),
  );
  flame.name = "engine-flame";
  flame.position.z = -0.95;
  ship.add(hull, wing, engine, flame);
  ship.scale.setScalar(SHIP_SCALE);
  ship.visible = true;
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
