export function stickVector(dx, dy, radius) {
  const distance = Math.hypot(dx, dy) / radius;
  if (distance <= 0.12) return { x: 0, y: 0 };
  const strength = (Math.min(distance, 1) - 0.12) / 0.88;
  const length = Math.hypot(dx, dy);
  return { x: dx / length * strength, y: dy / length * strength };
}

export function createTouchControls() {
  const layer = document.getElementById("touch-controls");
  const toggle = document.getElementById("touchEnabled");
  const axes = { thrust: 0, yaw: 0, pitch: 0, roll: 0 };
  const sticks = [];
  toggle.checked = matchMedia("(any-pointer: coarse)").matches || navigator.maxTouchPoints > 0;
  function reset() {
    for (const stick of sticks) stick.reset();
  }
  for (const [id, horizontal, vertical] of [["thrust-stick", "yaw", "thrust"], ["attitude-stick", "roll", "pitch"]]) {
    const element = document.getElementById(id);
    const thumb = element.querySelector(".stick-thumb");
    let pointer = null;
    const resetStick = () => {
      const captured = pointer;
      pointer = null;
      axes[horizontal] = 0;
      axes[vertical] = 0;
      thumb.style.transform = "translate(0px, 0px)";
      if (captured !== null && element.hasPointerCapture(captured)) element.releasePointerCapture(captured);
    };
    function move(event) {
      if (pointer !== event.pointerId) return;
      const rect = element.getBoundingClientRect();
      const radius = rect.width * 0.35;
      const vector = stickVector(event.clientX - rect.x - rect.width / 2, event.clientY - rect.y - rect.height / 2, radius);
      axes[horizontal] = vector.x;
      axes[vertical] = -vector.y;
      thumb.style.transform = `translate(${vector.x * radius}px, ${vector.y * radius}px)`;
      event.preventDefault();
    }
    element.addEventListener("pointerdown", (event) => {
      if (layer.hidden || pointer !== null || event.button !== 0) return;
      pointer = event.pointerId;
      element.setPointerCapture(pointer);
      move(event);
    });
    element.addEventListener("pointermove", move);
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
      element.addEventListener(type, (event) => { if (pointer === event.pointerId) resetStick(); });
    }
    sticks.push({ reset: resetStick });
  }
  function sync() {
    const blocked = !document.body.classList.contains("flight-mode") || document.body.classList.contains("landed-mode") ||
      document.body.classList.contains("autopilot-mode") || document.body.classList.contains("simulation-paused") || !document.getElementById("dashboard").hidden ||
      Boolean(document.querySelector("dialog[open]")) || document.hidden;
    layer.hidden = !toggle.checked || blocked;
    if (layer.hidden) reset();
  }
  const observer = new MutationObserver(sync);
  observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  observer.observe(document.getElementById("dashboard"), { attributes: true, attributeFilter: ["hidden"] });
  document.querySelectorAll("dialog").forEach((dialog) => observer.observe(dialog, { attributes: true, attributeFilter: ["open"] }));
  for (const type of ["blur", "kosmodrom-input-reset", "kosmodrom-flight-mode", "kosmodrom-landing"]) addEventListener(type, reset);
  document.addEventListener("visibilitychange", () => { reset(); sync(); });
  toggle.addEventListener("change", sync);
  sync();
  return { axes, reset };
}
