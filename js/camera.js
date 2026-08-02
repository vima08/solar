import * as THREE from "three";

import {

    CAMERA_FAR,
    CAMERA_FOV,
    CAMERA_NEAR,
    CAMERA_START

} from "./constants.js";

export function createCamera() {

    const camera =
        new THREE.PerspectiveCamera(

            CAMERA_FOV,

            window.innerWidth /
            window.innerHeight,

            CAMERA_NEAR,

            CAMERA_FAR

        );

    camera.position.set(

        CAMERA_START.x,

        CAMERA_START.y,

        CAMERA_START.z

    );

    return camera;

}