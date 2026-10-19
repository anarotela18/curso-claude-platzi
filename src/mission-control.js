import './mission-control.css';
import { TelemetryRegistry } from './telemetry/registry.js';
import { NasaWaypointsProvider, LightTimeProvider } from './telemetry/providers.js';
import { CHANNELS, asOf } from './telemetry/channels.js';

function drawChart(canvas, data, live) {
  const dpr = Math.min(devicePixelRatio, 2);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const g = canvas.getContext('2d');
  g.scale(dpr, dpr);
  g.clearRect(0, 0, w, h);
  const xs = data.map((d) => d.sol), ys = data.map((d) => d.value);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  let [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  if (y0 === y1) y1 = y0 + 1;
  const pad = { l: 4, r: 6, t: 6, b: 14 };
  const X = (x) => pad.l + ((x - x0) / (x1 - x0 || 1)) * (w - pad.l - pad.r);
  const Y = (y) => h - pad.b - ((y - y0) / (y1 - y0)) * (h - pad.t - pad.b);
  g.beginPath();
  data.forEach((d, i) => (i ? g.lineTo(X(d.sol), Y(d.value)) : g.moveTo(X(d.sol), Y(d.value))));
  g.strokeStyle = '#ff9a5c';
  g.lineWidth = 1.5;
  g.stroke();
  g.lineTo(X(x1), h - pad.b);
  g.lineTo(X(x0), h - pad.b);
  g.closePath();
  g.fillStyle = 'rgba(255,154,92,0.15)';
  g.fill();
  const last = data.at(-1);
  g.beginPath();
  g.arc(X(last.sol), Y(last.value), 3, 0, Math.PI * 2);
  g.fillStyle = live ? '#8fe3ff' : '#ffe3cc';
  g.fill();
  g.fillStyle = 'rgba(255,227,204,0.65)';
  g.font = '10px ui-monospace, Menlo, monospace';
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.fillText(`sol ${Math.round(x0)}`, pad.l, h - 2);
  g.textAlign = 'right';
  g.fillText(`sol ${Math.round(x1)}`, w - pad.r, h - 2);
}

export function startMissionControl() {
  const registry = new TelemetryRegistry();
  const wp = new NasaWaypointsProvider();
  const light = new LightTimeProvider();
  registry.addProvider(wp);
  registry.addProvider(light);
  const providerLabel = { [wp.id]: wp.label, [light.id]: light.label };

  const panel = document.createElement('aside');
  panel.id = 'mission-control';
  panel.innerHTML = '<header><b>CONTROL DE MISIÓN · MARS 2020</b><span>T · ocultar</span></header>';
  const hint = document.createElement('div');
  hint.id = 'mission-hint';
  hint.textContent = 'T · control de misión';
  hint.hidden = true;
  document.body.append(panel, hint);

  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyT' || e.repeat) return;
    panel.classList.toggle('is-hidden');
    hint.hidden = !panel.classList.contains('is-hidden');
  });

  for (const channel of CHANNELS) {
    registry.addChannel(channel);
    const card = document.createElement('section');
    card.className = 'mc-card';
    card.dataset.channel = channel.key;
    card.dataset.state = 'loading';
    card.innerHTML = `
      <div class="mc-top"><span class="mc-name">${channel.name}</span><span class="mc-live"${channel.live ? '' : ' hidden'}>● EN VIVO</span></div>
      <div class="mc-value"><b>…</b><small>${channel.unit}</small></div>
      <canvas></canvas>
      <p class="mc-meaning"></p>
      <div class="mc-source"></div>`;
    panel.append(card);
    const [valueEl, canvas, meaningEl, sourceEl] = ['.mc-value b', 'canvas', '.mc-meaning', '.mc-source'].map((s) => card.querySelector(s));
    const unitEl = card.querySelector('.mc-value small');
    const provider = providerLabel[channel.provider];

    let data = [];
    const render = () => {
      const last = data.at(-1);
      const ys = data.map((d) => d.value);
      valueEl.textContent = channel.show(last.value);
      if (channel.show(1).includes('min')) unitEl.textContent = '';
      meaningEl.textContent = channel.meaning(last.value, { min: Math.min(...ys), max: Math.max(...ys) });
      sourceEl.textContent = `${provider} · ${channel.live ? 'cada segundo' : asOf(last.sol)}`;
      drawChart(canvas, data, channel.live);
      card.dataset.value = String(last.value);
      card.dataset.points = String(data.length);
      card.dataset.state = 'ok';
    };

    registry
      .request(channel.key)
      .then((rows) => {
        if (!rows.length) throw new Error('sin datos');
        data = rows;
        render();
        console.log(`[mision] ${channel.name}: ${channel.show(rows.at(-1).value)}${channel.live ? '' : ' ' + channel.unit} (${rows.length} puntos, ${provider})`);
        if (channel.live) {
          registry.subscribe(channel.key, (d) => {
            data = [...data.slice(0, -1), d];
            render();
          });
        }
      })
      .catch((err) => {
        card.dataset.state = 'error';
        valueEl.textContent = 'sin datos';
        meaningEl.textContent = 'No se pudo cargar este dato.';
        console.error(`[mision] ${channel.name}: ${err.message}`);
      });
  }
}
