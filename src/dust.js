import * as THREE from 'three';

function softSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,220,180,1)');
  grad.addColorStop(1, 'rgba(255,220,180,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function createDust(count = 1800) {
  const geo = new THREE.BufferGeometry();
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = (Math.random() - 0.5) * 240;
    arr[i * 3 + 1] = Math.random() * 30 + 0.5;
    arr[i * 3 + 2] = (Math.random() - 0.5) * 240 - 30;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const pts = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      map: softSprite(),
      size: 1.6,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      color: 0xf0b88a,
    })
  );
  pts.userData.update = (t, cx = 0, cz = 0) => {
    pts.position.set(cx + Math.sin(t * 0.05) * 6, 0, cz);
  };
  return pts;
}
