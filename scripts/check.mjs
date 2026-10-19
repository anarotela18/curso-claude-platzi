import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const url = process.env.URL || 'http://localhost:5173/';
const errors = [];

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

try {
  await page.goto(url, { waitUntil: 'load', timeout: 15000 });
  await page.waitForTimeout(3000);
  mkdirSync('screenshots', { recursive: true });
  await page.screenshot({ path: 'screenshots/check.png' });
} catch (e) {
  errors.push(`check: ${e.message}`);
}
await browser.close();

if (errors.length) {
  console.log(`✗ ${errors.length} error(es):`);
  errors.forEach((e) => console.log(' -', e));
  process.exit(1);
}
console.log('✓ Sin errores de consola. Captura: screenshots/check.png');
