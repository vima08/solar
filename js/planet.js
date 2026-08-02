import * as THREE from "three";

export function createPlanet({

    radius,

    color,

    distance,

    orbitSpeed

}){

    const planet =
        new THREE.Group();

    const orbit =
        new THREE.Group();


    const geometry =
        new THREE.SphereGeometry(

            radius,

            48,

            48

        );


    const material =
        new THREE.MeshStandardMaterial({

            color

        });


    const sphere =
        new THREE.Mesh(

            geometry,

            material

        );


    sphere.position.x = distance;

    orbit.add(sphere);

    planet.add(orbit);

    planet.userData.orbit = orbit;

    planet.userData.orbitSpeed = orbitSpeed;

    planet.update = function(time, delta) {
        orbit.rotation.y =
            time.elapsed *
            orbitSpeed;
    };

    return planet;

}