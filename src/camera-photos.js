import * as THREE from 'three';
import './camera-photos.css';

// Pieza del modelo 3D → nombre que se muestra
const CAMERAS = {
  Mastcam_Z_cams: 'Mastcam-Z',
  NavCams: 'Navcams',
  hazcams_front: 'Hazcam delantera',
  WATSON: 'WATSON',
};
const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyT', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

const MIN_GAP = 34; // separación mínima en pantalla entre puntos (px)
const daysAgo =(iso) => Math.max(0, Math.floor((Date.now() - Date.parse(`${iso}T00:00:00Z`)) / 86400000));

function shutterClick() {
  try {
    const ctx = new AudioContext();
    const len = Math.floor(ctx.sampleRate * 0.09);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.18));
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    src.connect(hp).connect(ctx.destination);
    src.start();
  } catch {
    /* sin audio: no pasa nada */
  }
}

export async function startCameraPhotos({ rover, camera }) {
  const res = await fetch('/photos/photos.json');
  if (!res.ok) throw new Error(`HTTP ${res.status} al leer /photos/photos.json`);
  const { photos } = await res.json();
  const byCamera = Object.fromEntries(Object.keys(CAMERAS).map((k) => [k, photos.filter((p) => p.camera === k)]));

  // ---- Visor de fotos ----
  const viewer = document.createElement('div');
  viewer.id = 'photo-viewer';
  viewer.hidden = true;
  viewer.dataset.state = 'idle';
  viewer.innerHTML = `
    <div class="pv-backdrop"></div>
    <figure class="pv-fig"><img class="pv-img" alt="" /></figure>
    <div class="pv-caption"><b></b><span></span><small></small></div>
    <div class="pv-shutter pv-top"></div><div class="pv-shutter pv-bottom"></div>
    <div class="pv-flash"></div>
    <div class="pv-help">← → más fotos de esta cámara · clic en la foto para ampliar · Esc para volver al juego</div>`;
  document.body.append(viewer);
  const $ = (s) => viewer.querySelector(s);
  const [fig, img, capB, capSpan, capSmall, top, bottom, flash, backdrop] = ['.pv-fig', '.pv-img', '.pv-caption b', '.pv-caption span', '.pv-caption small', '.pv-top', '.pv-bottom', '.pv-flash', '.pv-backdrop'].map($);
  const caption = $('.pv-caption');

  let current = { camera: null, index: 0 };
  let token = 0; // cancela revelados viejos si el usuario cambia de foto

  const anim = (el, frames, opts) => el.animate(frames, { fill: 'forwards', ...opts }).finished;
  const setZoom = (on) => {
    viewer.classList.toggle('zoom', on);
    img.style.width = on ? `${Math.max(img.naturalWidth, innerWidth)}px` : '';
  };

  async function show(cameraKey, index, { full }) {
    const list = byCamera[cameraKey];
    const photo = list[(index + list.length) % list.length];
    current = { camera: cameraKey, index: list.indexOf(photo) };
    const mine = ++token;
    viewer.hidden = false;
    viewer.dataset.state = 'shooting';
    viewer.dataset.camera = cameraKey;
    setZoom(false);
    caption.style.opacity = 0;
    fig.style.opacity = 0;

    const loaded = new Promise((ok, fail) => {
      img.onload = ok;
      img.onerror = () => fail(new Error(`no se pudo cargar ${photo.file}`));
    });
    img.src = photo.file;

    shutterClick();
    if (full) {
      anim(backdrop, [{ opacity: 0 }, { opacity: 1 }], { duration: 250 });
      // obturador: dos cuchillas se cierran y se abren
      await Promise.all([
        anim(top, [{ transform: 'translateY(-101%)' }, { transform: 'translateY(0)' }], { duration: 140, easing: 'ease-in' }),
        anim(bottom, [{ transform: 'translateY(101%)' }, { transform: 'translateY(0)' }], { duration: 140, easing: 'ease-in' }),
      ]);
    }
    anim(flash, [{ opacity: 0 }, { opacity: 0.95, offset: 0.12 }, { opacity: 0 }], { duration: full ? 520 : 320, easing: 'ease-out' });
    await loaded;
    if (mine !== token) return;
    if (full) {
      anim(top, [{ transform: 'translateY(0)' }, { transform: 'translateY(-101%)' }], { duration: 220, easing: 'ease-out' });
      anim(bottom, [{ transform: 'translateY(0)' }, { transform: 'translateY(101%)' }], { duration: 220, easing: 'ease-out' });
    }

    // la foto "llega" línea por línea, desenfocada y oscura, y se aclara
    viewer.dataset.state = 'revealing';
    fig.style.opacity = 1;
    await img.decode().catch(() => {});
    await anim(
      img,
      [
        { clipPath: 'inset(0 0 100% 0)', filter: 'blur(14px) brightness(0.35) saturate(0.6)' },
        { clipPath: 'inset(0 0 0% 0)', filter: 'blur(0px) brightness(1) saturate(1)' },
      ],
      { duration: 2800, easing: 'cubic-bezier(.25,.6,.3,1)' }
    );
    if (mine !== token) return;

    const dias = daysAgo(photo.dateTaken);
    capB.textContent = `${CAMERAS[cameraKey]} · sol ${photo.sol.toLocaleString('es')} · hace ${dias.toLocaleString('es')} días`;
    capSpan.textContent = photo.title;
    capSmall.textContent = `Foto ${current.index + 1} de ${list.length} · ${photo.credit}`;
    img.dataset.photo = photo.id;
    img.alt = `${CAMERAS[cameraKey]}: ${photo.title}`;
    anim(caption, [{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
    viewer.dataset.state = 'shown';
  }

  function close() {
    token++;
    viewer.hidden = true;
    viewer.dataset.state = 'idle';
    setZoom(false);
    for (const el of [top, bottom]) el.getAnimations().forEach((a) => a.cancel());
  }

  img.addEventListener('click', () => viewer.dataset.state === 'shown' && setZoom(!viewer.classList.contains('zoom')));
  backdrop.addEventListener('click', close);
  // En captura, para que las teclas del juego (WASD/T/flechas) no muevan el rover con el visor abierto
  addEventListener(
    'keydown',
    (e) => {
      if (viewer.hidden) return;
      if (e.code === 'Escape') close();
      else if (e.code === 'ArrowRight') show(current.camera, current.index + 1, { full: false });
      else if (e.code === 'ArrowLeft') show(current.camera, current.index - 1, { full: false });
      if (GAME_KEYS.has(e.code) || e.code === 'Escape') e.stopPropagation();
    },
    true
  );

  // ---- Puntos brillantes sobre las piezas del modelo ----
  const layer = document.createElement('div');
  layer.id = 'cam-layer';
  document.body.append(layer);
  rover.updateMatrixWorld(true);
  const hotspots = [];
  for (const [key, label] of Object.entries(CAMERAS)) {
    const obj = rover.userData.cameras[key];
    if (!obj || !byCamera[key].length) {
      console.error(`[fotos] sin pieza o sin fotos para ${key}`);
      continue;
    }
    const box = new THREE.Box3().setFromObject(obj);
    const local = rover.worldToLocal(box.getCenter(new THREE.Vector3()));
    const el = document.createElement('button');
    el.className = 'cam-dot';
    el.dataset.camera = key;
    el.setAttribute('aria-label', `${label}: ver fotos`);
    el.innerHTML = `<i></i><span>${label} · ${byCamera[key].length} fotos</span>`;
    el.addEventListener('click', () => {
      el.blur();
      show(key, 0, { full: true }).catch((err) => console.error(`[fotos] ${err.message}`));
    });
    layer.append(el);
    const size = box.getSize(new THREE.Vector3());
    console.log(`[fotos] ${key}: centro local (${local.x.toFixed(2)}, ${local.y.toFixed(2)}, ${local.z.toFixed(2)}) m · tamaño (${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)}) m`);
    hotspots.push({ el, local, radius: Math.min(box.getSize(new THREE.Vector3()).length() / 2, 0.6), occluded: false });
  }
  console.log(`[fotos] ${hotspots.length} cámaras con ${photos.length} fotos reales de la NASA`);

  const world = new THREE.Vector3();
  const ndc = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const ray = new THREE.Raycaster();
  let frame = 0;

  return {
    update() {
      frame++;
      rover.updateMatrixWorld();
      for (const h of hotspots) {
        world.copy(h.local).applyMatrix4(rover.matrixWorld);
        const dist = world.distanceTo(camera.position);
        ndc.copy(world).project(camera);
        const off = ndc.z > 1 || dist > 45;
        h.off = off;
        h.el.style.display = off ? 'none' : '';
        h.x = (ndc.x * 0.5 + 0.5) * innerWidth;
        h.y = (-ndc.y * 0.5 + 0.5) * innerHeight;
        if (frame % 12 === 0 && !off) {
          dir.copy(world).sub(camera.position).normalize();
          ray.set(camera.position, dir);
          ray.far = Math.max(dist - h.radius, 0.01);
          h.occluded = ray.intersectObjects(rover.children, true).length > 0;
          h.el.classList.toggle('is-occluded', h.occluded);
          h.el.style.zIndex = h.occluded ? 0 : 1; // los visibles quedan encima y reciben el clic
        }
      }
      // Los puntos que caen casi en el mismo pixel (mástil y cámaras alineadas) se separan en pantalla
      const shown = hotspots.filter((h) => !h.off);
      for (let pass = 0; pass < 4; pass++) {
        for (let i = 0; i < shown.length; i++) {
          for (let j = i + 1; j < shown.length; j++) {
            const a = shown[i], b = shown[j];
            let dx = b.x - a.x, dy = b.y - a.y;
            const d = Math.hypot(dx, dy);
            if (d >= MIN_GAP) continue;
            if (d < 0.5) [dx, dy] = [Math.cos(i * 2.4 + j), Math.sin(i * 2.4 + j)];
            const k = (MIN_GAP - Math.max(d, 0.5)) / 2 / (Math.hypot(dx, dy) || 1);
            a.x -= dx * k; a.y -= dy * k;
            b.x += dx * k; b.y += dy * k;
          }
        }
      }
      for (const h of shown) h.el.style.transform = `translate(${h.x}px, ${h.y}px)`;
    },
  };
}
