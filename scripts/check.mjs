import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const url = process.env.URL || 'http://localhost:5173/';
const errors = [];
const info = [];

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  else if (m.text().startsWith('[')) info.push(m.text());
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

try {
  await page.goto(url, { waitUntil: 'load', timeout: 15000 });
  await page.waitForTimeout(3000);
  mkdirSync('screenshots', { recursive: true });
  // control de misión: los 4 datos deben cargar con números reales y dentro de rangos plausibles
  await page
    .waitForFunction(() => document.querySelectorAll('.mc-card[data-state="ok"]').length === 4, null, { timeout: 8000 })
    .catch(() => {});
  const cards = await page.$$eval('.mc-card', (els) =>
    els.map((e) => ({ key: e.dataset.channel, state: e.dataset.state, value: parseFloat(e.dataset.value), points: Number(e.dataset.points), shown: e.querySelector('.mc-value b').textContent }))
  );
  const expected = { 'm20.distance': [1, 100], 'm20.elevation': [-4000, 0], 'm20.tilt': [0, 30], 'earth.lighttime': [3, 23] };
  for (const key of Object.keys(expected)) {
    const c = cards.find((x) => x.key === key);
    const [lo, hi] = expected[key];
    if (!c) errors.push(`mision: falta el dato ${key}`);
    else if (c.state !== 'ok' || !Number.isFinite(c.value) || c.points < 2) errors.push(`mision: ${key} no cargó (estado=${c.state}, valor=${c.value}, puntos=${c.points})`);
    else if (c.value < lo || c.value > hi) errors.push(`mision: ${key}=${c.value} fuera de rango [${lo}, ${hi}]`);
    else info.push(`[check] ${key} = ${c.shown} (${c.points} puntos en la gráfica) OK`);
  }
  await page.screenshot({ path: 'screenshots/check.png' });
  // tecla T: oculta y vuelve a mostrar el panel
  const panelVisible = () => page.$eval('#mission-control', (e) => getComputedStyle(e).display !== 'none');
  await page.keyboard.press('KeyT');
  if (await panelVisible()) errors.push('mision: la tecla T no ocultó el panel');
  await page.screenshot({ path: 'screenshots/check-hidden.png' });
  await page.keyboard.press('KeyT');
  if (!(await panelVisible())) errors.push('mision: la tecla T no volvió a mostrar el panel');
  else info.push('[check] tecla T oculta y muestra el panel OK');
  // cámaras: cada punto brillante abre una foto real, con pie "cámara · sol · hace N días"
  const CAMS = ['Mastcam_Z_cams', 'NavCams', 'hazcams_front', 'WATSON'];
  await page.waitForSelector('.cam-dot', { timeout: 8000 }).catch(() => {});
  const dots = await page.$$eval('.cam-dot', (els) => els.map((e) => e.dataset.camera));
  for (const key of CAMS) if (!dots.includes(key)) errors.push(`fotos: falta el punto de la cámara ${key}`);
  const viewerState = () => page.$eval('#photo-viewer', (e) => e.dataset.state);
  for (const [n, key] of CAMS.entries()) {
    if (!dots.includes(key)) continue;
    const dot = page.locator(`.cam-dot[data-camera="${key}"] i`);
    if (n === 0) {
      await dot.hover({ force: true });
      await page.waitForTimeout(300);
      await page.screenshot({ path: 'screenshots/check-hover.png' });
    }
    await dot.click({ force: true });
    await page.waitForSelector('#photo-viewer[data-state="shown"]', { timeout: 10000 }).catch(() => {});
    const shot = await page.$eval('#photo-viewer', (v) => ({
      state: v.dataset.state,
      camera: v.dataset.camera,
      w: v.querySelector('.pv-img').naturalWidth,
      id: v.querySelector('.pv-img').dataset.photo,
      cap: v.querySelector('.pv-caption b').textContent,
    }));
    if (shot.camera !== key) errors.push(`fotos: se pulsó ${key} pero se abrió ${shot.camera}`);
    else if (shot.state !== 'shown' || shot.w < 300 || !/sol [\d.]+ · hace [\d.]+ días/.test(shot.cap)) errors.push(`fotos: ${key} no abrió una foto real (${JSON.stringify(shot)})`);
    else info.push(`[check] ${key}: ${shot.id} ${shot.w}px · ${shot.cap} OK`);
    await page.screenshot({ path: n === 0 ? 'screenshots/check-photo.png' : `screenshots/check-photo-${key}.png` });
    if (n === 0) {
      // flecha derecha: otra foto de la misma cámara; clic: ampliar
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction((id) => document.querySelector('.pv-img').dataset.photo !== id && document.querySelector('#photo-viewer').dataset.state === 'shown', shot.id, { timeout: 10000 }).catch(() => errors.push('fotos: la flecha derecha no mostró otra foto'));
      await page.click('.pv-img');
      const zoomed = await page.$eval('#photo-viewer', (v) => v.classList.contains('zoom'));
      if (!zoomed) errors.push('fotos: el clic no amplió la foto');
      await page.screenshot({ path: 'screenshots/check-photo-zoom.png' });
      await page.click('.pv-img');
    }
    await page.keyboard.press('Escape');
    if ((await viewerState()) !== 'idle') errors.push(`fotos: Esc no cerró el visor de ${key}`);
  }
  // conducir: avanzar, girar y avanzar para comprobar movimiento, cámara y huellas
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(2500);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1200);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(1000);
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'screenshots/check-drive.png' });
} catch (e) {
  errors.push(`check: ${e.message}`);
}
await browser.close();

info.forEach((l) => console.log(l));
if (errors.length) {
  console.log(`✗ ${errors.length} error(es):`);
  errors.forEach((e) => console.log(' -', e));
  process.exit(1);
}
console.log('✓ Sin errores de consola. Captura: screenshots/check.png');
