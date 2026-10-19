// Descarga fotos reales de Perseverance elegidas a mano de la Biblioteca de Imágenes de la NASA
// (images-api.nasa.gov) y guarda public/photos/<id>.jpg + public/photos/photos.json.
// La API de raw images de mars.nasa.gov/rss/api devuelve 403, por eso se usa esta fuente oficial.
// La fecha de captura y el sol se leen de la descripción oficial de cada foto.
import { mkdirSync, writeFileSync } from 'node:fs';

// Cámara (clave del modelo 3D) → fotos elegidas
const PICKS = {
  Mastcam_Z_cams: ['PIA26208', 'PIA25660'],
  NavCams: ['PIA25658', 'PIA26479'],
  hazcams_front: ['PIA25339', 'PIA25325'],
  WATSON: ['PIA24542', 'PIA25659'],
};
const SIZES = ['large', 'medium', 'small']; // se usa el primero disponible

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const json = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} en ${url}`);
  return r.json();
};

function parseCapture(text) {
  const m = text.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? (\d{1,2}), (\d{4}),? the ([\d,]+)(?:st|nd|rd|th) Martian day/i);
  if (!m) return null;
  const date = new Date(Date.UTC(Number(m[3]), MONTHS[m[1].slice(0, 3).toLowerCase()], Number(m[2])));
  return { dateTaken: date.toISOString().slice(0, 10), sol: Number(m[4].replace(',', '')) };
}

mkdirSync('public/photos', { recursive: true });
const photos = [];
for (const [camera, ids] of Object.entries(PICKS)) {
  for (const id of ids) {
    const item = (await json(`https://images-api.nasa.gov/search?nasa_id=${id}`)).collection.items[0];
    const data = item.data[0];
    const text = (data.description || '').replace(/<[^>]+>/g, ' ');
    const cap = parseCapture(text);
    if (!cap) throw new Error(`${id}: no encuentro fecha y sol en la descripción oficial`);
    const assets = (await json(`https://images-api.nasa.gov/asset/${id}`)).collection.items.map((a) => a.href);
    const url = SIZES.map((s) => assets.find((u) => u.toLowerCase().endsWith(`~${s}.jpg`))).find(Boolean);
    if (!url) throw new Error(`${id}: sin JPG disponible`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} al bajar ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(`public/photos/${id}.jpg`, buf);
    photos.push({
      camera,
      id,
      title: data.title,
      sol: cap.sol,
      dateTaken: cap.dateTaken,
      credit: data.secondary_creator || 'NASA/JPL-Caltech',
      source: `https://images.nasa.gov/details/${id}`,
      file: `/photos/${id}.jpg`,
    });
    console.log(`✓ ${camera} ${id} · sol ${cap.sol} · ${cap.dateTaken} · ${(buf.length / 1024).toFixed(0)} KB`);
  }
}
writeFileSync('public/photos/photos.json', JSON.stringify({ fetchedAt: new Date().toISOString(), photos }, null, 1));
console.log(`✓ ${photos.length} fotos guardadas en public/photos/`);
