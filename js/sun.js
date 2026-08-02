import * as THREE from "three";

import {

    SUN_RADIUS

} from "./constants.js";

export function createSun(){

    const sun =
        new THREE.Group();

    const geometry =
        new THREE.SphereGeometry(
            SUN_RADIUS,
            64,
            64
        );

    const material =
        new THREE.MeshBasicMaterial({
            color: 0xffdd55
        });

    const sphere = 
        new THREE.Mesh(
            geometry,
            material
        );
    sphere.name = "sun";
        
    sun.add(sphere);

    const light =
        new THREE.PointLight(
            0xffffff,
            2.5,
            0
        );

    sun.add(light);

    sun.userData.sphere = sphere;
    return sun;

}
