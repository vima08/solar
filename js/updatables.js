// =======================================
// updatables.js
//
// Здесь хранится список объектов,
// которые необходимо обновлять каждый кадр.
// =======================================

const updatables = [];

export function addUpdatable(object) {

    if (object && typeof object.update === "function") {

        updatables.push(object);

    }

}

export function updateAll(elapsed, delta) {

    for (const object of updatables) {

        object.update(elapsed, delta);

    }

}

export function clearUpdatables() {

    updatables.length = 0;

}