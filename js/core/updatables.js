const updatables = [];

export function addUpdatable(object) {
  if (object && typeof object.update === "function") updatables.push(object);
}

export function updateAll(time, delta) {
  updatables.forEach((object) => object.update(time, delta));
}

export function clearUpdatables() {
  updatables.length = 0;
}
