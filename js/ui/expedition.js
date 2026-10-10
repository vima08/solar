import * as THREE from "three";
import { EXPLOSION_AUDIO } from "../assets/audio-resources.js";
import { createShipControls, getShipForward } from "./ship-controls.js";

const SAVE_KEY = "kosmodrom-expedition-v1";
const START = new THREE.Vector3(24, 2, 0);
const SHIP_SCALE = 0.36;
const GIANTS = new Set(["jupiter", "saturn", "uranus", "neptune"]);
const CAMERA_FORWARD_FIX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

export function createExpedition(world) {
  const ship = createShip();
  world.scene.add(ship);
  const landingPad = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 0.85, 0.08, 48),
    new THREE.MeshStandardMaterial({ color: 0x34526a, emissive: 0x0a3038, metalness: 0.5, roughness: 0.5 }),
  );
  landingPad.visible = false;
  world.scene.add(landingPad);
  const state = loadState();
  ship.position.fromArray(state.position ?? START.toArray());
  const velocity = new THREE.Vector3().fromArray(state.velocity ?? [0, 0, 0]);
  const explosions = [];
  let active = false;
  let cockpit = false;
  let simple = state.simple ?? true;
  let fuel = state.fuel ?? 100;
  let target = world.bodies.find((body) => body.config.id === (state.target ?? "earth")) ??
    world.bodies.find((body) => body.config.id === "earth");
  let crashed = Boolean(state.crashed);
  let lastSave = 0;
  let landedBody = world.bodies.find((body) => body.config.id === state.landedOn) ?? null;
  const landedOffset = new THREE.Vector3().fromArray(state.landedOffset ?? [0, 1, 0]);
  let autopilot = null;
  let previousTargetPosition = target.object.getWorldPosition(new THREE.Vector3());
  const landButton = document.getElementById("landBtn");
  const autopilotButton = document.getElementById("autopilotBtn");
  const missions = [
    { target: "mars", title: "Доставь зонд на Марс", hint: "Выбери Марс, включи автопилот и посади корабль, чтобы доставить зонд." },
    { target: "jupiter-moon-2", title: "Собери образец на Европе", hint: "Посади корабль на Европу — спутник Юпитера. Образец загрузится в грузовой отсек." },
    { target: "earth", title: "Верни образец на Землю", hint: "Вернись на Землю и соверши посадку, чтобы передать образец учёным." },
  ];
  state.deliveryMission = Math.min(Math.max(Number(state.deliveryMission) || 0, 0), missions.length);
  const shipControls = createShipControls(ship, velocity, {
    isActive: () => active && !landedBody && !autopilot,
    isSimple: () => simple,
    hasFuel: () => fuel > 0,
    consumeFuel: (amount) => { fuel = Math.max(0, fuel - amount); },
  });

  function setActive(value) {
    active = value;
    if (!value) stopAutopilot();
    if (value) world.navigation?.stopTour();
    ship.visible = !crashed;
    world.controls.enabled = !value;
    document.body.classList.toggle("flight-mode", value);
    syncActions();
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
    stopAutopilot();
    target = body;
    previousTargetPosition = target.object.getWorldPosition(new THREE.Vector3());
    updateRoute();
  }

  function update(delta) {
    delta = Math.min(delta, 0.05);
    updateExplosions(delta);
    const center = target.object.getWorldPosition(new THREE.Vector3());
    if (landedBody) {
      ship.position.copy(landedBody.object.localToWorld(landedOffset.clone()));
      const normal = ship.position.clone().sub(landedBody.object.getWorldPosition(new THREE.Vector3())).normalize();
      ship.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      landingPad.position.copy(ship.position).addScaledVector(normal, -0.15);
      landingPad.quaternion.copy(ship.quaternion);
      velocity.set(0, 0, 0);
      updateFlame(ship, false);
    }
    landingPad.visible = Boolean(landedBody);
    if (!active) { previousTargetPosition.copy(center); return; }
    if (!landedBody) {
      if (autopilot) {
        autopilot.elapsed += delta;
        const progress = Math.min(1, autopilot.elapsed / autopilot.duration);
        const eased = progress * progress * (3 - 2 * progress);
        const offset = autopilot.from.clone().lerp(autopilot.to, eased);
        ship.position.copy(center).add(offset);
        ship.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), offset.clone().negate().normalize());
        velocity.set(0, 0, 0);
        updateFlame(ship, true);
        if (progress >= 1) { stopAutopilot(); announce("Прибытие к цели. Теперь можно выполнить посадку."); }
      } else {
        // Follow the local orbital frame so nearby moving planets remain reachable.
        if (ship.position.distanceTo(previousTargetPosition) < target.config.radius + 24) {
          ship.position.add(center.clone().sub(previousTargetPosition));
        }
        const { hasThrust } = shipControls.update(delta);
        updateFlame(ship, hasThrust);
        if (simple) velocity.multiplyScalar(Math.pow(0.12, delta));
        else applyGravity(world.bodies, ship.position, velocity, delta);
        velocity.clampLength(0, simple ? 8 : 15);
        ship.position.addScaledVector(velocity, delta);
        const collision = findCollision(ship.position);
        if (collision) { crashInto(collision); return; }
      }
    }
    previousTargetPosition.copy(center);
    const distance = center.distanceTo(ship.position);
    syncActions();
    const nearby = findLandingBody();
    document.getElementById("flight-warning").textContent = landedBody ?
      `${GIANTS.has(landedBody.config.id) ? "На платформе" : "На поверхности"}: ${landedBody.config.name}` : autopilot ? "Автопилот: переход к цели…" :
      nearby ? `Посадка доступна: ${nearby.config.name}` : "Системы в норме · выбери цель";
    positionCamera(getShipForward(ship));
    updateHud(distance);
    if (performance.now() - lastSave > 2500) save();
  }

  function findLandingBody() {
    return world.bodies.filter((body) => ["planet", "moon"].includes(body.type))
      .map((body) => ({ body, altitude: body.object.getWorldPosition(new THREE.Vector3()).distanceTo(ship.position) - body.config.radius }))
      .filter(({ altitude }) => altitude >= 0 && altitude <= 8)
      .sort((a, b) => a.altitude - b.altitude)[0]?.body;
  }

  function syncActions() {
    document.body.classList.toggle("landed-mode", Boolean(landedBody));
    landButton.disabled = !active || Boolean(autopilot) || (!landedBody && !findLandingBody());
    landButton.textContent = landedBody ? "↑ Взлёт" : "↓ Посадка";
    autopilotButton.disabled = !active || Boolean(landedBody) || !["planet", "moon"].includes(target.type);
    autopilotButton.setAttribute("aria-pressed", String(Boolean(autopilot)));
    autopilotButton.textContent = autopilot ? "■ Стоп" : "◎ К цели";
    document.getElementById("refuelBtn").disabled = !landedBody || landedBody.config.id !== "earth";
  }

  function stopAutopilot() { autopilot = null; syncActions(); }

  function toggleAutopilot() {
    if (autopilot) { stopAutopilot(); return; }
    if (!active || landedBody || !["planet", "moon"].includes(target.type)) return;
    const center = target.object.getWorldPosition(new THREE.Vector3());
    const from = ship.position.clone().sub(center);
    const normal = from.lengthSq() > 0.001 ? from.clone().normalize() : new THREE.Vector3(0, 1, 0);
    autopilot = { from, to: normal.multiplyScalar(target.config.radius + 4), elapsed: 0, duration: 8 };
    velocity.set(0, 0, 0);
    world.navigation?.stopTour();
    syncActions();
    announce(`Автопилот прокладывает маршрут: ${target.config.name}.`);
  }

  function toggleLanding() {
    if (!active || autopilot) return;
    if (landedBody) {
      const center = landedBody.object.getWorldPosition(new THREE.Vector3());
      const normal = ship.position.clone().sub(center).normalize();
      ship.position.copy(center).addScaledVector(normal, landedBody.config.radius + 3);
      ship.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      landedBody = null;
      velocity.set(0, 0, 0);
      announce("Взлёт завершён. Корабль на орбите.");
    } else {
      const body = findLandingBody();
      if (!body) return;
      landedBody = body;
      setTarget(body);
      landedOffset.copy(body.object.worldToLocal(ship.position.clone())).normalize().multiplyScalar(body.config.radius + (GIANTS.has(body.config.id) ? 1 : 0.3));
      ship.position.copy(body.object.localToWorld(landedOffset.clone()));
      velocity.set(0, 0, 0);
      completeLanding(body.config.id);
      announce(`Посадка выполнена: ${body.config.name}.${GIANTS.has(body.config.id) ? " У гигантов нет твёрдой поверхности: корабль на исследовательской платформе." : ""} Можно взлетать.`);
    }
    updateFlame(ship, false);
    syncActions();
    dispatchEvent(new CustomEvent("kosmodrom-landing"));
    save();
  }

  function findCollision(position) {
    return world.bodies.find((body) => {
      const bodyPosition = body.object.getWorldPosition(new THREE.Vector3());
      return bodyPosition.distanceTo(position) <= body.config.radius + 0.18;
    });
  }

  function crashInto(body) {
    landedBody = null;
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
    landedBody = null;
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
    const mission = missions[state.deliveryMission];
    if (mission?.target === id) {
      state.deliveryMission += 1;
      updateMission();
    }
    save();
  }

  function save() {
    lastSave = performance.now();
    Object.assign(state, { landedOn: landedBody?.config.id ?? null, landedOffset: landedOffset.toArray(), position: ship.position.toArray(), velocity: velocity.toArray(), fuel, simple, target: target.config.id, crashed });
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
  document.getElementById("refuelBtn").addEventListener("click", () => {
    if (landedBody?.config.id !== "earth") return;
    fuel = 100;
    updateHud(target.object.getWorldPosition(new THREE.Vector3()).distanceTo(ship.position));
    save();
  });
  function updateMission() {
    const mission = missions[state.deliveryMission];
    document.getElementById("active-mission").textContent = mission?.title ?? "Экспедиция завершена!";
    document.getElementById("mission-status").textContent = mission?.hint ?? "Зонд доставлен, образец Европы передан учёным. Продолжай исследовать систему!";
    document.getElementById("missionAction").disabled = !mission;
  }
  document.getElementById("missionAction").addEventListener("click", () => {
    const mission = missions[state.deliveryMission];
    if (!mission) return;
    const body = world.bodies.find((item) => item.config.id === mission.target);
    dispatchEvent(new CustomEvent("kosmodrom-target", { detail: body }));
    world.navigation.flyTo(body);
    dispatchEvent(new CustomEvent("kosmodrom-open-tab", { detail: "route" }));
  });
  landButton.addEventListener("click", toggleLanding);
  autopilotButton.addEventListener("click", toggleAutopilot);
  document.getElementById("physicsMode").checked = simple;
  document.getElementById("sample-count").textContent = String((state.samples ?? []).length);
  updateMission();
  addEventListener("pagehide", save);
  ship.visible = !crashed;
  setActive(false);
  updateRoute();
  updateHud(target.object.getWorldPosition(new THREE.Vector3()).distanceTo(ship.position));
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
