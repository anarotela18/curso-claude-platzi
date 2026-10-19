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
