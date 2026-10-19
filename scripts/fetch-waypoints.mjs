// Descarga el historial de manejos de Perseverance (NASA/JPL MMGIS) y guarda una versión liviana
// en public/data/. El servidor de la NASA no envía cabeceras CORS, por eso no se pide desde el navegador.
// Solo se conservan los puntos "final: y" (fin de manejo, distancia acumulada consistente) y sin fotos.
import { mkdirSync, writeFileSync } from 'node:fs';

const SOURCE = 'https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json';
const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`HTTP ${res.status} al pedir ${SOURCE}`);
const json = await res.json();

const rows = json.features
  .map((f) => f.properties)
  .filter((p) => p.final === 'y')
  .map((p) => ({
    sol: p.sol,
    site: p.site,
    drive: p.drive,
    dist_total_m: p.dist_total_m,
    elev_geoid: p.elev_geoid,
    tilt: p.tilt,
    roll: p.roll,
    pitch: p.pitch,
    lat: p.lat,
    lon: p.lon,
  }))
  .sort((a, b) => a.sol - b.sol || a.dist_total_m - b.dist_total_m);

mkdirSync('public/data', { recursive: true });
writeFileSync(
  'public/data/m20_waypoints.json',
  JSON.stringify({ source: SOURCE, fetchedAt: new Date().toISOString(), count: rows.length, rows })
);
console.log(`✓ ${rows.length} puntos guardados (sol ${rows[0].sol} → ${rows.at(-1).sol}) en public/data/m20_waypoints.json`);
