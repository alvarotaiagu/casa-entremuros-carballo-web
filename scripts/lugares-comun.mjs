/* Datos y utilidades comunes de «Seis lugares» (encuadre, origen, Overpass con espejos, OSRM). Lo usan lugares*.mjs. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SAL = path.join(RAIZ, 'img/lugares');
export const OSM = path.join(RAIZ, 'scripts/lugares-cache');

/* ---------------------------------------------------------------- encuadre ---------------------------------------------------------------- */
/* Bergantiños: de la ría de Corme e Laxe (oeste) a Baldaio (este), de Fervenza de San Paio (sur) a la costa de Malpica (norte). */
export const CAJA = { S: 43.095, W: -8.935, N: 43.362, E: -8.6 };
/* Origen de las distancias: el lugar de Cances Grande en OSM (DATOS: «OSM pone el lugar de Cances Grande en 43.24730, -8.73401»).
   El punto exacto de la casa está pendiente (lo resuelve el agente Mesa con la ortofoto; ver img/aire/casa.json si existe). */
export const CASA = { lat: 43.2473, lon: -8.73401, fuente: 'OSM, place=hamlet «Cances Grande» (DATOS-ENTREMUROS.md); punto exacto de la casa pendiente' };

const UA = 'casa-entremuros-lugares/1.0 (alvarot2601@gmail.com)';
const ESPEJOS = ['https://overpass.openstreetmap.fr/api/interpreter', 'https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function overpass(q) {
  let ultimo = '';
  for (let vuelta = 0; vuelta < 2; vuelta++) {
    for (const h of ESPEJOS) {
      try {
        const r = await fetch(h, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(120000) });
        if (!r.ok) { ultimo = h + ' ' + r.status; console.error('  ' + ultimo); continue; }
        const j = await r.json();
        if (j.remark && /error|timed out/i.test(j.remark)) { ultimo = h + ' ' + j.remark; console.error('  ' + ultimo); continue; }
        return j;
      } catch (e) { ultimo = h + ' ' + e.message; console.error('  ' + ultimo); }
    }
    await dormir(4000);
  }
  throw new Error('Overpass no responde: ' + ultimo);
}

const bb = `(${CAJA.S},${CAJA.W},${CAJA.N},${CAJA.E})`;
const CONSULTAS = {
  costa: `[out:json][timeout:90];way["natural"="coastline"]${bb};out geom ${bb};`,
  rios: `[out:json][timeout:90];(way["waterway"="river"]${bb};way["waterway"="stream"]["name"]${bb};);out geom ${bb};`,
  aguas: `[out:json][timeout:90];way["natural"="water"]["name"]${bb};out geom ${bb};`,
  carreteras: `[out:json][timeout:90];way["highway"~"^(motorway|trunk|primary|secondary)$"]${bb};out geom ${bb};`,
  limites: `[out:json][timeout:90];way["boundary"="administrative"]["admin_level"="8"]${bb};out geom ${bb};`,
  nucleos: `[out:json][timeout:90];node["place"~"^(city|town|village|hamlet|locality)$"]["name"]${bb};out;`,
  /* los seis lugares y la casa, por id (comprobados en Nominatim y Overpass el 2026-10-25) */
  lugares: `[out:json][timeout:90];(way(368154510);node(2723719421);way(39473257);way(303157404);way(96730657);way(96730663);node(1241628156);rel(1392812);node["name"="Cances Grande"]["place"]${bb};);out tags center;`,
  /* para el «Río Anllóns» : el río entero, con nombre */
  anllons: `[out:json][timeout:90];way["waterway"]["name"~"Anll[oó]ns"]${bb};out geom ${bb};`,
};

export async function pedirDatos(refrescar) {
  fs.mkdirSync(OSM, { recursive: true });
  for (const [nombre, q] of Object.entries(CONSULTAS)) {
    const f = path.join(OSM, nombre + '.json');
    if (!refrescar && fs.existsSync(f) && fs.statSync(f).size > 200) { console.log('  · ' + nombre + ' (en caché)'); continue; }
    console.log('  · pidiendo ' + nombre + ' …');
    const j = await overpass(q);
    fs.writeFileSync(f, JSON.stringify({ pedido: new Date().toISOString().slice(0, 10), generador: j.generator, base: j.osm3s?.timestamp_osm_base, elementos: j.elements }));
    console.log('    ' + j.elements.length + ' elementos');
    await dormir(1500);
  }
}

/* ---------------------------------------------------------------- OSRM ---------------------------------------------------------------- */
export async function ruta(a, b) {
  const u = `https://routing.openstreetmap.de/routed-car/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      if (j.code === 'Ok') return { km: j.routes[0].distance / 1000, min: j.routes[0].duration / 60 };
    } catch (e) { await dormir(2000); }
  }
  return null;
}

