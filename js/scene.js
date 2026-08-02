import * as THREE from "three";

import { createRenderer } from "./renderer.js";

import { createCamera } from "./camera.js";

import { createControls } from "./controls.js";

import { setupResize } from "./resize.js";

import { populateWorld } from "./world.js";


export async function createScene() {

    //---------------------------------
    // Scene
    //---------------------------------

    const scene = new THREE.Scene();

    scene.background = new THREE.Color(0x000000);

    const world = populateWorld(scene);

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
        controls,
        bodies: world.bodies

    };

}
