import * as THREE from 'three';
import { fbm, ridged } from './noise.js';

export const SIZE = 600;

export function heightAt(x, z) {
  const warp = fbm(x * 0.004, z * 0.004, 2) * 40;
  const dunes = ridged((x + warp) * 0.012, (z * 0.7 - warp) * 0.012, 4);
  const big = fbm(x * 0.003 + 10, z * 0.003 + 10, 3);
  const flat = THREE.MathUtils.smoothstep(Math.hypot(x, z - 10), 0, 25);
  return (dunes * 14 + big * 18) * (0.35 + 0.65 * flat);
}

export function createTerrain() {
  const seg = 320;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const dark = new THREE.Color(0x7a3520);
  const mid = new THREE.Color(0xb5562c);
  const light = new THREE.Color(0xdba070);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const t = THREE.MathUtils.clamp((h + 5) / 30, 0, 1);
    const grain = fbm(x * 0.2, z * 0.2, 2) * 0.08;
    if (t < 0.5) c.lerpColors(dark, mid, t * 2);
    else c.lerpColors(mid, light, (t - 0.5) * 2);
    c.offsetHSL(0, 0, grain);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })
  );
  mesh.receiveShadow = true;
  return mesh;
}
