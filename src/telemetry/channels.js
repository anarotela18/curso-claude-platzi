import { dateOfSol } from './providers.js';

const fmt = (n, d = 0) => n.toLocaleString('es', { minimumFractionDigits: d, maximumFractionDigits: d });

// Cada dato: clave, nombre, unidad, proveedor y metadatos de sus valores (como telemetry.values en Open MCT).
// `meaning` devuelve la frase simple; `show` formatea el valor grande de la tarjeta.
export const CHANNELS = [
  {
    key: 'm20.distance',
    name: 'Distancia recorrida',
    unit: 'km',
    provider: 'nasa-waypoints',
    field: 'dist_total_m',
    convert: (m) => m / 1000,
    values: [{ key: 'sol', name: 'Sol', hints: { domain: 1 } }, { key: 'value', name: 'Distancia', unit: 'km', hints: { range: 1 } }],
    show: (v) => fmt(v, 2),
    meaning: (v) => `Desde que aterrizó en 2021, Percy ha rodado unos ${fmt(v, 1)} km: como ${fmt(Math.round((v * 1000) / 400))} vueltas a una pista de atletismo.`,
  },
  {
    key: 'm20.elevation',
    name: 'Altura del terreno',
    unit: 'm',
    provider: 'nasa-waypoints',
    field: 'elev_geoid',
    convert: (m) => m,
    values: [{ key: 'sol', name: 'Sol', hints: { domain: 1 } }, { key: 'value', name: 'Altura', unit: 'm', hints: { range: 1 } }],
    show: (v) => fmt(v),
    meaning: (v, { min, max }) =>
      `El suelo está ${fmt(Math.abs(v))} m ${v < 0 ? 'por debajo' : 'por encima'} del "nivel del mar" de Marte. Trabaja dentro del cráter Jezero; en toda la misión el terreno varió entre ${fmt(min)} y ${fmt(max)} m.`,
  },
  {
    key: 'm20.tilt',
    name: 'Inclinación',
    unit: '°',
    provider: 'nasa-waypoints',
    field: 'tilt',
    convert: (d) => d,
    values: [{ key: 'sol', name: 'Sol', hints: { domain: 1 } }, { key: 'value', name: 'Inclinación', unit: '°', hints: { range: 1 } }],
    show: (v) => fmt(v, 1),
    meaning: (v) =>
      `Al terminar su último manejo quedó inclinado ${fmt(v, 1)}°, una cuesta del ${fmt(Math.tan((v * Math.PI) / 180) * 100)} %. ${v < 3 ? 'Casi plano.' : v < 10 ? 'Una pendiente suave.' : 'Una pendiente notable.'}`,
  },
  {
    key: 'earth.lighttime',
    name: 'Tiempo de luz a la Tierra',
    unit: 'min',
    provider: 'light-time-live',
    live: true,
    convert: (s) => s / 60,
    values: [{ key: 'sol', name: 'Sol', hints: { domain: 1 } }, { key: 'value', name: 'Tiempo de luz', unit: 'min', hints: { range: 1 } }],
    show: (v) => {
      const s = Math.round(v * 60);
      return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
    },
    meaning: (v) =>
      `Una señal de radio tarda ${fmt(v, 1)} min en cruzar el espacio entre Marte y la Tierra, y la respuesta otro tanto. Por eso Percy no se maneja con un joystick en directo.`,
  },
];

export const asOf = (sol) => `sol ${sol} · ${dateOfSol(sol).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}`;
