import * as THREE from "three";

const FORWARD = new THREE.Vector3(0, 0, 1);
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const CAMERA_FORWARD_FIX = new THREE.Quaternion().setFromAxisAngle(WORLD_UP, Math.PI);

export function surfaceFrame(offset, heading = FORWARD) {
  const up = offset.clone().normalize();
  const forward = heading.clone().projectOnPlane(up);
  if (forward.lengthSq() < 1e-8) {
    forward.copy(Math.abs(up.z) < 0.9 ? FORWARD : new THREE.Vector3(1, 0, 0)).projectOnPlane(up);
  }
  forward.normalize();
  const right = new THREE.Vector3().crossVectors(up, forward).normalize();
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, forward));
  return { up, forward, quaternion };
}

export function landingHeading(body, offset, worldForward) {
  const local = worldForward.clone().applyQuaternion(body.getWorldQuaternion(new THREE.Quaternion()).invert());
  return surfaceFrame(offset, local).forward;
}

export function createShipCamera(camera) {
  let surface = null;
  let previousCockpit = null;
  let localPosition = new THREE.Vector3();
  let localQuaternion = new THREE.Quaternion();
  return {
    reset() { surface = null; previousCockpit = null; },
    update({ ship, cockpit, body = null, offset, heading, delta }) {
      const blend = 1 - Math.exp(-8 * Math.max(0, delta));
      if (body) {
        const frame = surfaceFrame(offset, heading);
        const bodyQuaternion = body.getWorldQuaternion(new THREE.Quaternion());
        const desiredPosition = cockpit ? offset.clone().add(new THREE.Vector3(0, 0.35, -0.35).applyQuaternion(frame.quaternion)) :
          offset.clone().addScaledVector(frame.forward, -7).addScaledVector(frame.up, 3);
        const desiredQuaternion = cockpit ? frame.quaternion.clone().multiply(CAMERA_FORWARD_FIX) :
          new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(desiredPosition, offset.clone().addScaledVector(frame.forward, 8), frame.up));
        if (surface !== body || previousCockpit !== cockpit) {
          // Enter from the existing view, but avoid sweeping across the whole system after loading.
          const distant = camera.position.distanceTo(ship.position) > 40;
          localPosition.copy(distant ? desiredPosition : body.worldToLocal(camera.position.clone()));
          localQuaternion.copy(distant ? desiredQuaternion : bodyQuaternion.clone().invert().multiply(camera.quaternion));
          surface = body;
          previousCockpit = cockpit;
        }
        localPosition.lerp(desiredPosition, blend);
        localQuaternion.slerp(desiredQuaternion, blend);
        camera.position.copy(body.localToWorld(localPosition.clone()));
        camera.quaternion.copy(bodyQuaternion).multiply(localQuaternion);
        camera.up.copy(frame.up).applyQuaternion(bodyQuaternion);
        return;
      }
      surface = null;
      previousCockpit = cockpit;
      if (cockpit) {
        camera.position.copy(ship.position).add(new THREE.Vector3(0, 0.35, -0.35).applyQuaternion(ship.quaternion));
        camera.quaternion.copy(ship.quaternion).multiply(CAMERA_FORWARD_FIX);
        camera.up.copy(WORLD_UP).applyQuaternion(ship.quaternion);
      } else {
        const forward = FORWARD.clone().applyQuaternion(ship.quaternion);
        camera.up.copy(WORLD_UP);
        camera.position.lerp(ship.position.clone().addScaledVector(forward, -7).add(new THREE.Vector3(0, 3, 0)), blend);
        camera.lookAt(ship.position.clone().addScaledVector(forward, 8));
      }
    },
  };
}
