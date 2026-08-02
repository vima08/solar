import * as THREE from "three";

import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { addUpdatable, updateAll } from "./updatables.js";

import { createRenderer } from "./renderer.js";

import { createCamera } from "./camera.js";

import { createControls } from "./controls.js";

import { setupResize } from "./resize.js";

import { populateWorld } from "./world.js";


import {

    CAMERA_FAR,
    CAMERA_FOV,
    CAMERA_NEAR,
    CAMERA_START

} from "./constants.js";

import { createStars } from "./stars.js";

export async function createScene() {

    //---------------------------------
    // Scene
    //---------------------------------

    const scene = new THREE.Scene();

    scene.background = new THREE.Color(0x000000);

    populateWorld(scene);

    //---------------------------------
    // Camera
    //---------------------------------

    const camera = createCamera();

    //---------------------------------
    // Renderer
    //---------------------------------

    const renderer = createRenderer();

    //---------------------------------
    // Controls
    //---------------------------------

    const controls = createControls(
        camera,
        renderer.domElement
    );  

    //---------------------------------
    // Resize
    //---------------------------------

    setupResize(
        camera,
        renderer
    );

    //---------------------------------

    return {

        scene,
        camera,
        renderer,
        controls

    };

}