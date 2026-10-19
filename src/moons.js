import * as THREE from 'three';
import { noise2 } from './noise.js';

function lumpy(radius, stretch, seed, detail = 4) {
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = noise2(v.x * 0.5 + seed, v.y * 0.5 + v.z * 0.3 + seed);
    const k = 1 + (n - 0.5) * 0.35;
    v.multiplyScalar(k).multiply(stretch);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function moon(radius, stretch, seed, color, pos) {
  const m = new THREE.Mesh(
    lumpy(radius, stretch, seed),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 1,
      fog: false,
      emissive: color,
      emissiveIntensity: 0.55,
    })
  );
  m.position.copy(pos);
  return m;
}

export function createMoons() {
  const g = new THREE.Group();
  // Fobos: grande e irregular; Deimos: pequeña
  const phobos = moon(26, new THREE.Vector3(1.25, 0.95, 1), 3.1, 0xc9ad98, new THREE.Vector3(251, 205, -620));
  const deimos = moon(9, new THREE.Vector3(1.1, 0.9, 1), 7.7, 0xd8bfa8, new THREE.Vector3(-57, 239, -655));
  g.add(phobos, deimos);
  g.userData = { phobos, deimos };
  return g;
}
