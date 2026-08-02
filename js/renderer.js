import * as THREE from "three";

export function createRenderer() {

    const renderer =
        new THREE.WebGLRenderer({

            antialias: true

        });

    renderer.setPixelRatio(
        window.devicePixelRatio
    );

    renderer.setSize(

        window.innerWidth,

        window.innerHeight

    );

    renderer.outputColorSpace =
        THREE.SRGBColorSpace;

    renderer.toneMapping =
        THREE.ACESFilmicToneMapping;

    renderer.toneMappingExposure = 1.2;

    renderer.shadowMap.enabled = true;

    document
        .getElementById("scene-container")
        .appendChild(renderer.domElement);

    return renderer;

}