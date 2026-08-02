import * as THREE from "three";

export function createLabels(bodies, camera, renderer, onChoose) {
  const layer = document.getElementById("labels");
  const entries = bodies.map((body) => {
    const button = document.createElement("button");
    button.className = "space-label";
    button.dataset.object = body.config.id;
    button.textContent = body.config.name;
    button.addEventListener("click", () => onChoose(body));
    layer.appendChild(button);
    return { body, button };
  });
  const point = new THREE.Vector3();

  return {
    update() {
      const width = renderer.domElement.clientWidth;
      const height = renderer.domElement.clientHeight;
      for (const { body, button } of entries) {
        body.object.getWorldPosition(point);
        point.project(camera);
        const visible =
          point.z > -1 &&
          point.z < 1 &&
          Math.abs(point.x) < 1.1 &&
          Math.abs(point.y) < 1.1;
        button.hidden = !visible;
        button.style.transform = `translate(${(point.x * 0.5 + 0.5) * width}px, ${(-point.y * 0.5 + 0.5) * height}px)`;
      }
    },
  };
}
