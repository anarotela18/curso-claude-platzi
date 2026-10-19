import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { heightAt } from './terrain.js';

// Medidas reales de Perseverance: ~2.2 m de alto, ~3 m de largo, ruedas de 0.52 m de diámetro.
const REAL_HEIGHT = 2.2;
// Rotación del modelo para que su "frente" apunte a -Z (el frente del rover en el mundo)
const MODEL_YAW = Math.PI;
const CAMERA_NAME = /cam|lens|watson/i;
const NOT_CAMERA = /cover|wiring|calibration|bracket|^\d/i;

const MAX_SPEED = 6; // m/s (el real va a 0.04 m/s, aquí se acelera para poder explorar)
const TURN_SPEED = 1.1; // rad/s
const MARK_EVERY = 0.45; // m entre huellas
const LIMIT = 280;

function treadTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.fillRect(0, 0, 64, 128);
  g.fillStyle = 'rgba(255,255,255,0.95)';
  for (let y = 4; y < 128; y += 16) g.fillRect(2, y, 60, 8);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createRover(scene, onReady) {
  const rover = new THREE.Group(); // pose en el mundo (posición, rumbo, inclinación)
  const state = { heading: 0, speed: 0, wheelbase: 2, track: 2, trackWidth: 0.4 };
  rover.userData = { cameras: {}, state };
  rover.position.set(0, heightAt(0, 40), 40);

  const keys = new Set();
  addEventListener('keydown', (e) => keys.add(e.code));
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  // Huellas: planos instanciados con textura de dibujo, en anillo
  const MAX_MARKS = 4000;
  const markGeo = new THREE.PlaneGeometry(1, 1);
  markGeo.rotateX(-Math.PI / 2);
  const marks = new THREE.InstancedMesh(
    markGeo,
    new THREE.MeshStandardMaterial({
      map: treadTexture(),
      color: 0x2a1006,
      roughness: 1,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
    MAX_MARKS
  );
  marks.frustumCulled = false;
  marks.receiveShadow = true;
  marks.count = 0;
  scene.add(marks);
  let markIndex = 0;
  let sinceMark = 0;
  const mMat = new THREE.Matrix4();
  const mScale = new THREE.Vector3();
  const mPos = new THREE.Vector3();

  function addMarks() {
    rover.updateMatrixWorld();
    mScale.set(state.trackWidth, 1, MARK_EVERY * 1.25);
    for (const side of [-1, 1]) {
      mPos.set(side * state.track * 0.5, 0.03, state.wheelbase * 0.5).applyMatrix4(rover.matrixWorld);
      mMat.compose(mPos, rover.quaternion, mScale);
      marks.setMatrixAt(markIndex, mMat);
      markIndex = (markIndex + 1) % MAX_MARKS;
      marks.count = Math.max(marks.count, markIndex || MAX_MARKS);
    }
    marks.instanceMatrix.needsUpdate = true;
  }

  new GLTFLoader()
    .setDRACOLoader(new DRACOLoader().setDecoderPath('/draco/'))
    .load('/models/perseverance.glb', (gltf) => {
      const model = gltf.scene;
      model.rotation.y = MODEL_YAW;
      model.updateMatrixWorld(true);
      let box = new THREE.Box3().setFromObject(model);
      const k = REAL_HEIGHT / (box.max.y - box.min.y);
      model.scale.setScalar(k);
      model.updateMatrixWorld(true);
      box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      model.position.set(-center.x, -box.min.y, -center.z); // ruedas apoyadas en y=0, centrado
      const size = box.getSize(new THREE.Vector3());
      state.track = size.x * 0.82;
      state.wheelbase = size.z * 0.6;

      model.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
        if (CAMERA_NAME.test(o.name) && !NOT_CAMERA.test(o.name)) rover.userData.cameras[o.name] = o;
      });
      rover.add(model);
      console.log(
        `[rover] tamaño real: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)} m (ancho x alto x largo), escala ${k.toFixed(4)}`
      );
      console.log('[cámaras] piezas del modelo que son cámaras:', Object.keys(rover.userData.cameras).join(', '));
      onReady?.(rover);
    });

  scene.add(rover);

  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const target = new THREE.Quaternion();

  rover.userData.update = (dt) => {
    const drive = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    const steer = (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) - (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0);
    state.speed = THREE.MathUtils.damp(state.speed, drive * MAX_SPEED * (drive < 0 ? 0.5 : 1), 3, dt);
    state.heading += steer * TURN_SPEED * dt * THREE.MathUtils.clamp(Math.abs(state.speed) / 2 + (drive ? 0.3 : 0), 0, 1);

    fwd.set(-Math.sin(state.heading), 0, -Math.cos(state.heading));
    right.set(Math.cos(state.heading), 0, -Math.sin(state.heading));
    const step = state.speed * dt;
    rover.position.addScaledVector(fwd, step);
    rover.position.x = THREE.MathUtils.clamp(rover.position.x, -LIMIT, LIMIT);
    rover.position.z = THREE.MathUtils.clamp(rover.position.z, -LIMIT, LIMIT);

    // Altura e inclinación según el terreno bajo las ruedas
    const p = rover.position;
    const hw = state.wheelbase / 2;
    const ht = state.track / 2;
    const h = (a, b) => heightAt(p.x + fwd.x * a + right.x * b, p.z + fwd.z * a + right.z * b);
    const hF = h(hw, 0), hR = h(-hw, 0), hL = h(0, -ht), hRt = h(0, ht);
    p.y = (hF + hR + hL + hRt) / 4;
    euler.set(Math.atan2(hF - hR, state.wheelbase), state.heading, Math.atan2(hRt - hL, state.track));
    target.setFromEuler(euler);
    rover.quaternion.slerp(target, 1 - Math.exp(-10 * dt));

    sinceMark += Math.abs(step);
    if (sinceMark >= MARK_EVERY) {
      sinceMark = 0;
      addMarks();
    }
  };

  return rover;
}
