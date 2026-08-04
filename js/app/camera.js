import * as THREE from "three";
import {
  CAMERA_FAR,
  CAMERA_FOV,
  CAMERA_NEAR,
  CAMERA_START,
} from "../core/constants.js";

export function createCamera() {
  const aspectRatio = window.innerWidth / window.innerHeight;
  const camera = new THREE.PerspectiveCamera(
    CAMERA_FOV,
    aspectRatio,
    CAMERA_NEAR,
    CAMERA_FAR,
  );
  camera.position.set(CAMERA_START.x, CAMERA_START.y, CAMERA_START.z);

  return camera;
}
