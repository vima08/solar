import { OrbitControls }
from "three/addons/controls/OrbitControls.js";

export function createControls(
    camera,
    domElement
) {

    const controls =
        new OrbitControls(

            camera,
            domElement

        );

    controls.enableDamping = true;

    controls.dampingFactor = 0.05;

    controls.minDistance = 15;

    controls.maxDistance = 1500;

    return controls;

}