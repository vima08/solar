import * as THREE from "three";

const HOME_POSITION = new THREE.Vector3(0, 68, 118);

export function createNavigation(camera, controls, bodies, onSelect) {
  let flight = null;
  let tourTimer = null;
  let tourIndex = 0;
  const tourStopDuration = 5000;

  function worldPosition(body) {
    return body.object.getWorldPosition(new THREE.Vector3());
  }

  function flyTo(body, announce = true, preserveTour = false) {
    if (!preserveTour) stopTour();
    const target = worldPosition(body);
    const direction = camera.position.clone().sub(controls.target).normalize();
    const distance = Math.max(body.config.radius * 5.5, 8);
    flight = {
      body,
      started: performance.now(),
      duration: 1500,
      fromPosition: camera.position.clone(),
      fromTarget: controls.target.clone(),
      toTarget: target,
      toPosition: target.clone().add(direction.multiplyScalar(distance)),
    };
    if (announce) onSelect(body.config);
  }

  function goHome() {
    stopTour();
    flight = {
      started: performance.now(),
      duration: 1400,
      fromPosition: camera.position.clone(),
      fromTarget: controls.target.clone(),
      toPosition: HOME_POSITION.clone(),
      toTarget: new THREE.Vector3(),
    };
    onSelect({
      name: "Солнечная система",
      description: "Выбирай планету или запускай экскурсию!",
      fact: "Все восемь планет движутся вокруг Солнца.",
    });
  }

  function startTour() {
    stopTour(false);
    tourIndex = 0;
    document.body.classList.add("tour-active");
    flyTo(bodies[tourIndex], true, true);
    scheduleTour();
  }

  function scheduleTour() {
    tourTimer = window.setInterval(() => stepTour(1), tourStopDuration);
  }

  function stepTour(direction) {
    if (tourTimer) window.clearInterval(tourTimer);
    tourIndex = (tourIndex + direction + bodies.length) % bodies.length;
    flyTo(bodies[tourIndex], true, true);
    document.body.classList.add("tour-active");
    scheduleTour();
  }

  function stopTour(updateClass = true) {
    if (tourTimer) window.clearInterval(tourTimer);
    tourTimer = null;
    if (updateClass) document.body.classList.remove("tour-active");
  }

  function update() {
    if (!flight) return;
    if (flight.body) {
      const newTarget = worldPosition(flight.body);
      const offset = flight.toPosition.clone().sub(flight.toTarget);
      flight.toTarget.copy(newTarget);
      flight.toPosition.copy(newTarget).add(offset);
    }
    const progress = Math.min(
      (performance.now() - flight.started) / flight.duration,
      1,
    );
    const eased = 1 - Math.pow(1 - progress, 3);
    camera.position.lerpVectors(flight.fromPosition, flight.toPosition, eased);
    controls.target.lerpVectors(flight.fromTarget, flight.toTarget, eased);
    if (progress === 1) flight = null;
  }

  return {
    flyTo,
    goHome,
    startTour,
    stopTour,
    stepTour,
    update,
  };
}
