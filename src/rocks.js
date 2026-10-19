import * as THREE from 'three';
import { noise2 } from './noise.js';
import { heightAt } from './terrain.js';

function rockGeometry() {
  const geo = new THREE.IcosahedronGeometry(1, 3);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = noise2(v.x * 1.7 + 5, v.y * 1.7 + v.z * 1.3);
    v.multiplyScalar(0.75 + n * 0.5);
    v.y *= 0.7;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

export function createRocks(count = 420) {
  const mesh = new THREE.InstancedMesh(
    rockGeometry(),
    new THREE.MeshStandardMaterial({ color: 0xb06a48, roughness: 0.95, flatShading: true }),
    count
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const col = new THREE.Color();
  let seed = 12345;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    const r = 35 + Math.pow(rnd(), 1.8) * 220;
    const a = rnd() * Math.PI * 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r * 0.9 - 20;
    const size = 0.4 + Math.pow(rnd(), 2.5) * (r < 80 ? 1.6 : 4.5);
    pos.set(x, heightAt(x, z) + size * 0.2, z);
    e.set(rnd() * 0.5, rnd() * 6.28, rnd() * 0.5);
    q.setFromEuler(e);
    s.set(size * (0.8 + rnd() * 0.6), size, size * (0.8 + rnd() * 0.6));
    m.compose(pos, q, s);
    mesh.setMatrixAt(i, m);
    col.setHSL(0.04 + rnd() * 0.03, 0.45, 0.32 + rnd() * 0.14);
    mesh.setColorAt(i, col);
  }
  return mesh;
}
