import * as THREE from "three";

import {
    updateTime,
    getTime
} from "./time.js";

import {
    updateAll
} from "./updatables.js";


export function createEngine({

    scene,
    camera,
    renderer,
    controls

}) {


    const clock = new THREE.Clock();


    const fpsElement =
        document.getElementById("fps");


    let frameCounter = 0;

    let fpsTimer =
        performance.now();



    function animate(){

        requestAnimationFrame(animate);


        const delta =
            clock.getDelta();


        updateTime(delta);


        const time =
            getTime();

        // console.log(time);

        controls.update();


        updateAll(
            time,
            delta
        );


        renderer.render(
            scene,
            camera
        );


        updateFPS();

    }



    function updateFPS(){

        frameCounter++;


        const now =
            performance.now();


        if(now - fpsTimer > 1000){

            fpsElement.textContent =
                frameCounter;


            frameCounter = 0;


            fpsTimer = now;

        }

    }



    return {

        start(){

            animate();
            document
                .getElementById("loading")
                .style.display = "none";

        }

    };

}