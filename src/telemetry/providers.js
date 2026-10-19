// Datum: { sol, value }. "sol" es el eje de tiempo (domain) y "value" el dato (range).
export const LANDING_MS = Date.UTC(2021, 1, 18, 20, 55); // aterrizaje en Jezero (sol 0)
export const SOL_MS = 88775.244 * 1000;
export const solOf = (ms) => (ms - LANDING_MS) / SOL_MS;
export const dateOfSol = (sol) => new Date(LANDING_MS + sol * SOL_MS);

// --- Proveedor 1: historial de manejos de la NASA (solo histórico) ---
export class NasaWaypointsProvider {
  id = 'nasa-waypoints';
  label = 'NASA/JPL · M20_waypoints';
  #load;

  supportsRequest(channel) {
    return channel.provider === this.id;
  }

  supportsSubscribe() {
    return false;
  }

  request(channel) {
    this.#load ??= fetch('/data/m20_waypoints.json').then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} al leer /data/m20_waypoints.json`);
      return r.json();
    });
    return this.#load.then(({ rows }) =>
      rows
        .filter((r) => Number.isFinite(r[channel.field]))
        .map((r) => ({ sol: r.sol, value: channel.convert(r[channel.field]) }))
    );
  }
}

// --- Proveedor 2: tiempo de luz Tierra–Marte, calculado (histórico + en vivo) ---
// Elementos keplerianos aproximados de JPL (válidos 1800–2050): [valor, cambio por siglo].
const EARTH = { a: [1.00000261, 0.00000562], e: [0.01671123, -0.00004392], I: [-0.00001531, -0.01294668], L: [100.46457166, 35999.37244981], w: [102.93768193, 0.32327364], O: [0, 0] };
const MARS = { a: [1.52371034, 0.00001847], e: [0.0933941, 0.00007882], I: [1.84969142, -0.00813131], L: [-4.55343205, 19140.30268499], w: [-23.94362959, 0.44441088], O: [49.55953891, -0.29257343] };
const AU_LIGHT_S = 499.004784; // segundos que tarda la luz en recorrer 1 UA
const rad = Math.PI / 180;

function position(el, T) {
  const at = (k) => el[k][0] + el[k][1] * T;
  const a = at('a'), e = at('e'), I = at('I') * rad, w = at('w'), O = at('O') * rad;
  let M = (((at('L') - w) % 360) + 540) % 360 - 180;
  M *= rad;
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const om = (w * rad) - O;
  const [co, so, cO, sO, cI, sI] = [Math.cos(om), Math.sin(om), Math.cos(O), Math.sin(O), Math.cos(I), Math.sin(I)];
  return [
    (co * cO - so * sO * cI) * xp + (-so * cO - co * sO * cI) * yp,
    (co * sO + so * cO * cI) * xp + (-so * sO + co * cO * cI) * yp,
    so * sI * xp + co * sI * yp,
  ];
}

/** Segundos que tarda una señal de radio entre la Tierra y Marte en el instante `ms`. */
export function lightTimeSeconds(ms) {
  const T = (ms / 86400000 + 2440587.5 - 2451545) / 36525;
  const [e, m] = [position(EARTH, T), position(MARS, T)];
  return Math.hypot(e[0] - m[0], e[1] - m[1], e[2] - m[2]) * AU_LIGHT_S;
}

export class LightTimeProvider {
  id = 'light-time-live';
  label = 'Cálculo con órbitas JPL (aprox.)';

  supportsRequest(channel) {
    return channel.provider === this.id;
  }

  supportsSubscribe(channel) {
    return channel.provider === this.id;
  }

  // Toda la misión: un punto cada 5 soles desde el aterrizaje hasta hoy
  request(channel) {
    const out = [];
    const now = solOf(Date.now());
    for (let s = 0; s < now; s += 5) out.push({ sol: s, value: channel.convert(lightTimeSeconds(dateOfSol(s).getTime())) });
    out.push({ sol: now, value: channel.convert(lightTimeSeconds(Date.now())) });
    return Promise.resolve(out);
  }

  subscribe(channel, callback) {
    const tick = () => callback({ sol: solOf(Date.now()), value: channel.convert(lightTimeSeconds(Date.now())) });
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }
}
