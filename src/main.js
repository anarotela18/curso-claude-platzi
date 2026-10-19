import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createTerrain, heightAt } from './terrain.js';
import { createRocks } from './rocks.js';
import { createSky } from './sky.js';
import { createMoons } from './moons.js';
import { createDust } from './dust.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xd98a58, 0.0045);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 3000);
camera.position.set(0, heightAt(0, 30) + 3, 30);

// Sol de tarde: bajo en el horizonte, a la izquierda
const sunDir = new THREE.Vector3(-0.5, 0.2, -0.85).normalize();
const sun = new THREE.DirectionalLight(0xffa860, 3.2);
sun.position.copy(sunDir).multiplyScalar(300);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.radius = 4;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.05;
Object.assign(sun.shadow.camera, { left: -130, right: 130, top: 130, bottom: -130, near: 10, far: 700 });
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xe8a070, 0x7a4030, 1.0));

scene.add(createSky(sunDir));
scene.add(createTerrain());
scene.add(createRocks());
scene.add(createMoons());
const dust = createDust();
scene.add(dust);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, camera.position.y + 10, -100);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.6;
controls.update();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  dust.userData.update(t);
  controls.update();
  renderer.render(scene, camera);
});
