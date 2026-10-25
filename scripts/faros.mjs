/* Datos de «Los faros de la costa» (agente Faros).
   Uso:  node scripts/faros.mjs            (descarga lo que falte y regenera todo)
         node scripts/faros.mjs --red      (vuelve a descargar aunque haya caché)
         node scripts/faros.mjs --sin-fotos
   Escribe:
     img/faros/faros.json     los faros (característica OFICIAL + fuentes + discrepancias), la casa,
                              los lugares y «Lo que Mónica recomienda» (frases literales verificadas)
     img/faros/costa.json     la costa de OpenStreetMap simplificada (metros desde la esquina NO)
     img/faros/fuentes/       extracto del Libro de Faros y copia de lo que dijo la Wikipedia
     img/faros/fotos/         miniaturas de las fotos de la casa (sharp, nunca amplía)
   Fuentes:
     1. Libro de Faros y Señales de Niebla, Instituto Hidrográfico de la Marina (Armada), costa NW,
        edición 07/02/2023: https://armada.defensa.gob.es/ihm/XML/LF/LF_ESPANA_COSTA%20NW.xml  (OFICIAL)
     2. Wikipedia en castellano (ficha de cada faro, que viene de Wikidata y del propio Libro de Faros).
        Si no coincide con el Libro de Faros, gana el Libro y se anota en `discrepancias`.
     3. OpenStreetMap (Overpass) para la costa y los nombres de los pueblos; Nominatim para el municipio;
        OSRM (router.project-osrm.org, perfil coche, sin tráfico) para los minutos por carretera.
   Caché de descargas: scripts/faros-cache/ (se puede borrar). */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const SALIDA = path.join(RAIZ, 'img', 'faros');
const CACHE = path.join(AQUI, 'faros-cache');
const REF = path.join(RAIZ, 'ref');
const FORZAR = process.argv.includes('--red');
const SIN_FOTOS = process.argv.includes('--sin-fotos');
const UA = 'casa-entremuros-faros/1.0 (propuesta de web; alvarot2601@gmail.com)';

fs.mkdirSync(path.join(SALIDA, 'fuentes'), { recursive: true });
fs.mkdirSync(CACHE, { recursive: true });

/* ------------------------------------------------------------------ utilidades */
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
async function descargar(url, nombreCache, opts = {}) {
  const f = path.join(CACHE, nombreCache);
  if (!FORZAR && fs.existsSync(f)) return fs.readFileSync(f, 'utf8');
  let ultimo;
  for (const u of Array.isArray(url) ? url : [url]) {
    for (let intento = 0; intento < 2; intento++) {
      try {
        const r = await fetch(u, { headers: { 'User-Agent': UA, ...(opts.headers || {}) }, method: opts.method || 'GET', body: opts.body });
        if (!r.ok) throw new Error(r.status + ' ' + u);
        const t = await r.text();
        fs.writeFileSync(f, t);
        return t;
      } catch (e) { ultimo = e; await dormir(1500); }
    }
  }
  throw ultimo;
}
const rad = (g) => (g * Math.PI) / 180;
function haversine(a, b) {
  const R = 6371.0088, dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const redondea = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

/* ------------------------------------------------------------------ la caja del mapa */
const CAJA = { sur: 42.84, norte: 43.40, oeste: -9.34, este: -8.64 };
const LAT_REF = (CAJA.sur + CAJA.norte) / 2;
const M_LAT = 110574, M_LON = 111320 * Math.cos(rad(LAT_REF));
const ANCHO_M = Math.round((CAJA.este - CAJA.oeste) * M_LON);
const ALTO_M = Math.round((CAJA.norte - CAJA.sur) * M_LAT);
const proy = (lon, lat) => [(lon - CAJA.oeste) * M_LON, (CAJA.norte - lat) * M_LAT];

/* ------------------------------------------------------------------ 1. Libro de Faros */
const FAROS = [
  { id: 'sisargas', numnac: '03730', nombre: 'Illas Sisargas', wiki: 'Faro_de_las_islas_Sisargas', etiqueta: 'e',
    explicacion: 'Tres destellos blancos seguidos y una pausa larga, cada 15 segundos.', giratorio: false,
    anio: { texto: 'El primer faro de la isla se encendió el 29 de julio de 1853; el actual se construyó entre 1911 y 1915.', fuente: 'wikipedia' },
    foto: { archivo: '0195_BS8ZyFBjN9j_1.jpg', nombre: 'sisargas', alt: 'Las islas Sisargas vistas desde la costa de Malpica, con tojo en flor en primer plano', ig: 195 } },
  { id: 'nariga', numnac: '03735', nombre: 'Punta Nariga', wiki: 'Faro_de_Punta_Nariga', etiqueta: 'w',
    explicacion: 'Tres destellos y uno, cada 20 segundos: tres destellos seguidos y, tras una pausa, uno más; luego vuelta a empezar.', giratorio: false,
    anio: { texto: 'Diseñado por César Portela. La casa dice «construido en 1995» (IG 102); la Wikipedia, que «entró en funcionamiento en 1998».', fuente: 'ig+wikipedia' },
    foto: { archivo: '0023_Cv5f8AMs2Vw_1.jpg', nombre: 'nariga', alt: 'El faro de Punta Nariga con el sol poniéndose sobre el mar', ig: 23 } },
  { id: 'roncudo', numnac: '03750', nombre: 'Punta Roncudo', wiki: 'Baliza_de_Punta_Roncudo', etiqueta: 'w',
    explicacion: 'Un destello de un segundo cada 6 segundos.', giratorio: false, anio: null, foto: null },
  { id: 'laxe', numnac: '03760', nombre: 'Laxe (Punta Laxe)', wiki: 'Faro_de_Punta_Lage', etiqueta: 'w',
    explicacion: 'Cinco destellos seguidos y una pausa larga, cada 20 segundos.', giratorio: false, anio: null, foto: null },
  { id: 'vilan', numnac: '03800', nombre: 'Cabo Vilán', wiki: 'Faro_de_cabo_Villano', etiqueta: 'e',
    explicacion: 'Dos destellos blancos de medio segundo, cada 15 segundos.', giratorio: false,
    anio: { texto: 'El faro actual se encendió el 15 de enero de 1896; el primitivo, el 10 de julio de 1854.', fuente: 'wikipedia' }, foto: null },
  { id: 'barca', numnac: '03810', nombre: 'Punta da Barca (Muxía)', wiki: 'Baliza_de_Punta_de_la_Barca', etiqueta: 'e',
    explicacion: 'Luz blanca fija que se apaga un segundo cada 4 segundos (una ocultación, no un destello).', giratorio: false, anio: null, foto: null },
  { id: 'tourinan', numnac: '03880', nombre: 'Cabo Touriñán', wiki: 'Faro_Tori%C3%B1ana', etiqueta: 'e',
    explicacion: 'Dos destellos y uno, cada 15 segundos.', giratorio: false,
    anio: null, foto: null, nota: 'El faro más occidental de la España peninsular, según la Wikipedia.' },
  { id: 'fisterra', numnac: '03900', nombre: 'Cabo Fisterra', wiki: 'Faro_de_Finisterre', etiqueta: 'e',
    explicacion: 'Un destello de 0,3 segundos cada 5 segundos.', giratorio: true,
    giratorio_fuente: 'Wikipedia en castellano: «La linterna … gira en el sentido contrario a las agujas del reloj y emite actualmente un destello de luz blanca cada 5 segundos».',
    anio: { texto: 'En funcionamiento desde 1853; electrificado en 1931.', fuente: 'wikipedia' }, foto: null },
];

/* Lo que la Wikipedia (ficha, texto «Luz») decía el 2026-10-25, para avisar si cambia.
   `coincide`: lo que se comparó con el Libro de Faros. */
const WIKI = {
  sisargas: { luz: '[(L0 2 oc 2 8)2 veces]L0 2 oc 8 8', alcance_mn: 23, focal_m: 110, soporte_m: 11, coincide: true },
  nariga: { luz: 'GpD(3+1) B 20s 55m 22M', alcance_mn: 22, focal_m: 55, soporte_m: 39, coincide: true },
  roncudo: { luz: 'Fl W 6s', alcance_mn: 10, focal_m: 38, soporte_m: 11, coincide: true },
  laxe: { luz: '[(L 0 1 oc 2 4)4 veces]L 0 1 oc 9 9', alcance_mn: 20, focal_m: 66, soporte_m: 11, coincide: true },
  vilan: { luz: 'Fl(2) W 15s y L 0 5 oc 3 5 L 0 5 oc 10 5', alcance_mn: 28, focal_m: 104, soporte_m: 25, coincide: true,
    discrepancia: 'En la misma ficha de la Wikipedia el campo «Fases» dice «GpD (2) B 5 s» (5 s), que contradice su propia línea «Luz» (15 s). Gana el Libro de Faros: Fl(2)W 15s.' },
  barca: { luz: null, texto: 'una lámpara emite un destello de luz blanca cada 4 segundos', altura_m: 11, coincide: false,
    discrepancia: 'La Wikipedia dice «un destello de luz blanca cada 4 segundos»; el Libro de Faros la clasifica como luz de ocultaciones (OcW 4s): encendida 3 s y apagada 1 s. Gana el Libro de Faros.' },
  tourinan: { luz: 'L 0 2 oc 2 2 L 0 2 oc 6 1 L 0 2 oc 6 1', alcance_mn: 24, focal_m: 65, soporte_m: 14, coincide: true },
  fisterra: { luz: 'Fl W 5s y L0,3 oc4,7', alcance_mn: 23, focal_m: 143, soporte_m: 17, coincide: true,
    discrepancia: 'Otras páginas (turismo, hoteles) dan 31 millas de alcance y 138 o 140 m de altura; el texto de la Wikipedia habla de «unos 120 m». El Libro de Faros y la ficha de la Wikipedia dicen 23 millas y 143 m de altura focal. Gana el Libro de Faros.' },
};

function parseLibro(xml) {
  const luces = {};
  for (const m of xml.matchAll(/<luz [^>]*>/g)) {
    const s = m[0], a = {};
    for (const k of s.matchAll(/(\w+)='([^']*)'/g)) a[k[1]] = k[2];
    luces[a.numnac] = { linea: s, ...a };
  }
  return luces;
}
const COLOR = { W: 'blanco', R: 'rojo', G: 'verde', Y: 'amarillo' };
function caracteristica(aparpe, fasesTxt) {
  // «Fl(3+1)W 20s», «FlW 6s», «OcW 4s»
  const m = aparpe.match(/^(Fl|Oc)(?:\(([\d+]+)\))?([A-Z]) (\d+(?:,\d+)?)s$/);
  if (!m) throw new Error('característica rara: ' + aparpe);
  const [, tipo, grupo, col, per] = m;
  const periodo = parseFloat(per.replace(',', '.'));
  const fases = fasesTxt.split(';').map((x) => parseFloat(x.trim().replace(',', '.')));
  const suma = fases.reduce((a, b) => a + b, 0);
  if (Math.abs(suma - periodo) > 0.01) throw new Error(`fases no suman el periodo en ${aparpe}: ${suma}`);
  const es = `${tipo === 'Fl' ? (grupo ? 'GpD' : 'D') : (grupo ? 'GpOc' : 'Oc')}${grupo ? '(' + grupo + ')' : ''} ${col === 'W' ? 'B' : col} ${per}s`;
  const destellos = fases.length / 2;
  return { ihm: aparpe, es, tipo: tipo === 'Fl' ? 'destellos' : 'ocultaciones', grupo: grupo || null,
    color: COLOR[col], periodo_s: periodo, fases_s: fases, destellos };
}

/* ------------------------------------------------------------------ 2. Overpass (costa) */
const ESPEJOS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter', 'https://overpass.osm.ch/api/interpreter'];
async function overpass(q, nombre) {
  return JSON.parse(await descargar(ESPEJOS, nombre, { method: 'POST', body: 'data=' + encodeURIComponent(q),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }));
}

function dp(pts, eps) { // Douglas-Peucker sobre [[x,y],...] (cadenas abiertas)
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const pila = [[0, pts.length - 1]];
  while (pila.length) {
    const [a, b] = pila.pop(); let dmax = 0, im = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      let d;
      if (l2 === 0) d = Math.hypot(px - ax, py - ay);
      else { const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)); d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy)); }
      if (d > dmax) { dmax = d; im = i; }
    }
    if (dmax > eps && im > 0) { keep[im] = 1; pila.push([a, im], [im, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
/* Los anillos cerrados se parten por el vértice más lejano al primero (trampa del DP en anillos). */
function dpAnillo(pts, eps) {
  const p = pts.slice(0, -1); if (p.length < 4) return pts;
  let im = 0, dm = 0; for (let i = 1; i < p.length; i++) { const d = Math.hypot(p[i][0] - p[0][0], p[i][1] - p[0][1]); if (d > dm) { dm = d; im = i; } }
  const a = dp(p.slice(0, im + 1), eps), b = dp(p.slice(im).concat([p[0]]), eps);
  return a.concat(b.slice(1));
}

function unirCadenas(ways) {
  // une por id de nodo. Devuelve cadenas de {pts:[[lon,lat]], cerrada}
  const porInicio = new Map(), usadas = new Set();
  for (const w of ways) porInicio.set(w.nodes[0], w);
  const cadenas = [];
  const finales = new Set(ways.map((w) => w.nodes[w.nodes.length - 1]));
  // empezamos por las que no son continuación de otra
  const inicios = ways.filter((w) => !finales.has(w.nodes[0]) || w.nodes[0] === w.nodes[w.nodes.length - 1]);
  const orden = inicios.concat(ways.filter((w) => !inicios.includes(w)));
  for (const w0 of orden) {
    if (usadas.has(w0.id)) continue;
    let pts = w0.geometry.map((g) => [g.lon, g.lat]), ids = w0.nodes.slice(); usadas.add(w0.id);
    let sig = porInicio.get(ids[ids.length - 1]);
    while (sig && !usadas.has(sig.id)) {
      usadas.add(sig.id); pts = pts.concat(sig.geometry.slice(1).map((g) => [g.lon, g.lat])); ids = ids.concat(sig.nodes.slice(1));
      sig = porInicio.get(ids[ids.length - 1]);
    }
    cadenas.push({ pts, cerrada: ids[0] === ids[ids.length - 1] });
  }
  return cadenas;
}

/* recorte de un segmento a la caja [x0,x1]x[y0,y1] (Liang-Barsky); devuelve t0,t1 o null */
function clipSeg(a, b, cx0, cy0, cx1, cy1) {
  let t0 = 0, t1 = 1; const dx = b[0] - a[0], dy = b[1] - a[1];
  const p = [-dx, dx, -dy, dy], q = [a[0] - cx0, cx1 - a[0], a[1] - cy0, cy1 - a[1]];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return null; }
    else { const r = q[i] / p[i]; if (p[i] < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; } }
  }
  return [t0, t1];
}
/* coordenada de perímetro en sentido antihorario con y hacia ARRIBA (la tierra queda a la izquierda).
   Trabajamos con y hacia abajo en pantalla: pasamos a yA = ALTO - y. */
function perimetro(x, yA) {
  const W = ANCHO_M, H = ALTO_M, e = 1e-6;
  if (Math.abs(yA - 0) < e) return x;                 // borde inferior, de izquierda a derecha
  if (Math.abs(x - W) < e) return W + yA;             // borde derecho, hacia arriba
  if (Math.abs(yA - H) < e) return W + H + (W - x);   // borde superior, hacia la izquierda
  return 2 * W + H + (H - yA);                         // borde izquierdo, hacia abajo
}
function puntoDePerimetro(s) {
  const W = ANCHO_M, H = ALTO_M, P = 2 * (W + H); s = ((s % P) + P) % P;
  if (s <= W) return [s, 0]; if (s <= W + H) return [W, s - W];
  if (s <= 2 * W + H) return [W - (s - W - H), H]; return [0, H - (s - 2 * W - H)];
}

function ensamblarTierra(cadenas) {
  // cadenas abiertas ya proyectadas (y hacia abajo). Devuelve {tierra:[polígonos], lineas:[runs]}
  const W = ANCHO_M, H = ALTO_M, runs = [];
  for (const c of cadenas) {
    const P = c.pts.map(([x, y]) => [x, H - y]); // y hacia arriba
    let run = null;
    const cerrar = (salida) => { if (run) { run.salida = salida; runs.push(run); run = null; } };
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1], t = clipSeg(a, b, 0, 0, W, H);
      if (!t) { cerrar(null); continue; }
      const A = [a[0] + (b[0] - a[0]) * t[0], a[1] + (b[1] - a[1]) * t[0]], B = [a[0] + (b[0] - a[0]) * t[1], a[1] + (b[1] - a[1]) * t[1]];
      if (!run) run = { pts: [A], entrada: t[0] > 1e-9 ? A : null };
      run.pts.push(B);
      if (t[1] < 1) cerrar(B);
    }
    cerrar(null);
  }
  // runs: los que entran y salen por el borde dan polígonos; los que están dentro enteros se ignoran para el relleno
  const abiertas = runs.filter((r) => r.entrada && r.salida);
  const usadas = new Set(), tierra = [];
  for (const r0 of abiertas) {
    if (usadas.has(r0)) continue;
    let r = r0, poli = [];
    for (let guarda = 0; guarda < 20; guarda++) {
      usadas.add(r); poli.push(...r.pts);
      const sOut = perimetro(...r.salida);
      let mejor = null, dmin = Infinity;
      for (const q of abiertas) {
        const sIn = perimetro(...q.entrada); let d = sIn - sOut; if (d < -1e-6) d += 2 * (W + H);
        if (d < dmin) { dmin = d; mejor = q; }
      }
      // esquinas entre medias
      const sIn = sOut + dmin, esquinas = [0, W, W + H, 2 * W + H].map((e0) => { let d = e0 - sOut; if (d <= 1e-6) d += 2 * (W + H); return d < dmin ? [d, e0] : null; }).filter(Boolean).sort((a, b) => a[0] - b[0]);
      for (const [, s] of esquinas) poli.push(puntoDePerimetro(s));
      if (mejor === r0 || usadas.has(mejor)) break;
      r = mejor;
    }
    tierra.push(poli.map(([x, y]) => [x, H - y]));
  }
  return { tierra, lineas: runs.map((r) => r.pts.map(([x, y]) => [x, H - y])) };
}

function puntoEnPoligono(x, y, poli) {
  let dentro = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [xi, yi] = poli[i], [xj, yj] = poli[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}
const esTierra = (x, y, pols) => pols.some((p) => puntoEnPoligono(x, y, p));

/* ------------------------------------------------------------------ 3. IG: frases literales */
const IG = JSON.parse(fs.readFileSync(path.join(REF, 'raw', 'ig', 'ig-indice.json'), 'utf8'));
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaLarga = (iso) => { const [a, m] = iso.split('-'); return MESES[+m - 1] + ' de ' + a; };

/* Cada recomendación: frases LITERALES (se comprueban contra el pie del post; si no está, el script falla).
   `dice_casa`: lo que la propia casa da como tiempo/distancia (DATOS-ENTREMUROS.md); nada calculado. */
const RECOMIENDA = [
  { id: 'malpica', lugar: 'Malpica y las islas Sisargas', frases: [{ ig: 212, texto: 'Atardeceres con las Islas Sisargas de fondo' }, { ig: 213, texto: 'Playa de Malpica a 10 minutos de la Casa Entremuros' }],
    foto: { archivo: '0195_BS8ZyFBjN9j_1.jpg', nombre: 'malpica-sisargas', alt: 'Las islas Sisargas desde la costa de Malpica', ig: 195 } },
  { id: 'nariga', lugar: 'Faro de Punta Nariga', frases: [{ ig: 102, texto: 'lo más espectacular podras disfrutar de un atardecer que no olvidarás' }],
    dice_casa: { texto: 'A 20 minutos de la casa', ig: 23 }, faro: 'nariga',
    foto: { archivo: '0102_CDelt8cDRDo_1.jpg', nombre: 'nariga-torre', alt: 'La torre del faro de Punta Nariga sobre su base triangular', ig: 102 } },
  { id: 'seaia', lugar: 'Playa de Seaia', frases: [{ ig: 103, texto: 'esta playa cuenta con un merendero con mesas de piedra y barbacoa donde puedes ir a pasar el día y comer allí.' }],
    foto: { archivo: '0103_CDOOyILjKPk_1.jpg', nombre: 'seaia', alt: 'La playa de Seaia con un sendero entre las dunas', ig: 103 } },
  { id: 'seiruga', lugar: 'Barizo y la playa de Seiruga', frases: [{ ig: 106, texto: 'La playa de Seiruga se encuentra en Barizo en un entorno paisajístico espectacular, además tiene una ría para que los más pequeños se puedan bañar tranquilamente' }],
    foto: { archivo: '0106_CC6owjWD7i__1.jpg', nombre: 'seiruga', alt: 'La playa de Seiruga, con la ría que llega hasta la arena', ig: 106 } },
  { id: 'san-miro', lugar: 'San Miro', frases: [{ ig: 59, texto: 'Para acceder a ella hay una pasarela de madera.' }],
    foto: { archivo: '0059_CPFjqIZjUDD_1.jpg', nombre: 'san-miro', alt: 'La pasarela de madera que baja a la playa de San Miro', ig: 59 } },
  { id: 'insua', lugar: 'Ensenada da Insua', frases: [{ ig: 133, texto: 'un entorno espectacular' }],
    foto: { archivo: '0133_B0nNO99iT6H_1.jpg', nombre: 'insua', alt: 'La ensenada da Insua, con el agua en calma y el monte al fondo', ig: 133 } },
  { id: 'laxe', lugar: 'Laxe y la capilla de Santa Rosa', frases: [{ ig: 29, texto: 'una ermita pequeña y muy bonita desde donde tenéis unas vistas espectaculares del pueblo' }],
    foto: { archivo: '0029_CvCKa4PMK0J_1.jpg', nombre: 'laxe', alt: 'Laxe vista desde el mirador de Santa Rosa, con su puerto y su playa', ig: 29 } },
  { id: 'monte-branco', lugar: 'Mirador de Monte Branco', frases: [{ ig: 89, texto: 'Y además desde aquí se ven unos atardeceres de ensueño' }],
    foto: { archivo: '0089_CEl1P4hDSH9_1.jpg', nombre: 'monte-branco', alt: 'La entrada de la ría de Corme y Laxe desde el mirador de Monte Branco', ig: 89 } },
  { id: 'refuxo', lugar: 'Refuxo de Verdes', frases: [{ ig: 121, texto: 'un paraje de gran belleza' }],
    dice_casa: { texto: 'Desde Casa Entremuros hay solo 10 minutos en coche', ig: 121, literal: 'desde Casa Entremuros hay solo 10 minutos en coche' },
    foto: { archivo: '0229_BCBHQ8fQNB0_1.jpg', nombre: 'refuxo', alt: 'El río Anllóns a su paso por el Refuxo de Verdes, con la pasarela de madera', ig: 229 } },
  { id: 'castriz', lugar: 'Fervenza de Castriz', frases: [{ ig: 31, texto: 'Esta ubicada en una preciosa zona con pasarelas de madera que rodean el río hasta la cascada y algunos molinos antiguos restaurados.' }],
    foto: { archivo: '0031_CtwJinpuo3x_1.jpg', nombre: 'castriz', alt: 'Escaleras y pasarela junto a un molino restaurado en la fervenza de Castriz', ig: 31 } },
  { id: 'caldeiras', lugar: 'Caldeiras do Castro', frases: [{ ig: 52, texto: 'El río Castro desciende formando pequeñas piscinas naturales donde puedes darte un baño y una cascada de 8 m.' }],
    foto: { archivo: '0052_CQnmFqPsFKd_1.jpg', nombre: 'caldeiras', alt: 'La cascada y la poza de las Caldeiras do Castro', ig: 52 } },
  { id: 'ruta-auga', lugar: 'Ruta da Auga, en Zas', frases: [{ ig: 24, texto: 'Ruta de unos 10 km circular, de dificultad fácil con muy pocos desniveles.' }],
    foto: { archivo: '0024_Cv1t_9ROtkK_1.jpg', nombre: 'ruta-auga', alt: 'Poste con las flechas de la Ruta da Auga de Zas', ig: 24 } },
  { id: 'ponte-maceira', lugar: 'Ponte Maceira', frases: [{ ig: 143, texto: 'Ponte Maceira es un pueblo muy bonito y antiguo por donde pasa el Camino de Santiago, tiene un gran puente de piedra por donde cruza el rio Tambre y varios molinos.' }],
    dice_casa: { texto: 'Desde nuestra casa llegas en 40 minutos', ig: 143, literal: 'Desde nuestra casa llegas en 40 minutos' },
    foto: { archivo: '0143_BxcLr99Cw5M_1.jpg', nombre: 'ponte-maceira', alt: 'El puente de piedra de Ponte Maceira sobre el río Tambre', ig: 143 } },
  { id: 'pindo', lugar: 'Monte Pindo', frases: [{ ig: 61, texto: 'A los amantes del senderismo no os podéis perder la ruta del Monte Pindo' }],
    foto: { archivo: '0061_CO3KLW0D_XA_1.jpg', nombre: 'pindo', alt: 'Vista desde el Monte Pindo sobre la playa de Carnota', ig: 61 } },
  { id: 'ezaro', lugar: 'Ézaro', frases: [{ ig: 181, texto: 'Si vienes a Galicia tienes que visitar la @cascada_de_ezaro' }], foto: null },
  { id: 'buno', lugar: 'Buño y su olería', frases: [{ ig: 100, texto: 'La artesanía en Galicia ocupa un lugar muy importante' }], foto: null },
  { id: 'fisterra', lugar: 'Fisterra', frases: [{ ig: 177, texto: 'una bota de peregrino sobre una roca en el mismo Cabo Finisterre' }], faro: 'fisterra',
    foto: { archivo: '0177_BaOQCinDYyX_1.jpg', nombre: 'fisterra-bota', alt: 'La bota de bronce del peregrino sobre una roca en Fisterra', ig: 177 } },
];
const CAMINO = { ig: 47, texto: 'Son 8 etapas  en 200km que recorren toda la costa desde Malpica hasta Finisterre' };

function verificaFrases() {
  const malas = [];
  const chequea = (ig, texto) => { const pie = norm(IG[ig]?.pie || ''); if (!pie.includes(norm(texto))) malas.push(`IG ${ig}: «${texto}»`); };
  for (const r of RECOMIENDA) { r.frases.forEach((f) => chequea(f.ig, f.texto)); if (r.dice_casa?.literal) chequea(r.dice_casa.ig, r.dice_casa.literal); }
  chequea(CAMINO.ig, CAMINO.texto); chequea(23, 'A 20 minutos de la casa se encuentra el Faro Nariga');
  chequea(102, 'se encuentra el faro más moderno ,diseñado por Cesar Portela y construido en 1995');
  if (malas.length) throw new Error('Frases que NO están literalmente en el pie del post:\n  ' + malas.join('\n  '));
}

/* ------------------------------------------------------------------ principal */
async function main() {
  verificaFrases();
  console.log('frases literales: todas encontradas en ig-indice.json');

  // 1. Libro de Faros
  const xml = await descargar(['http://www.armada.mde.es/ihm/XML/LF/LF_ESPANA_COSTA%20NW.xml', 'https://armada.defensa.gob.es/ihm/XML/LF/LF_ESPANA_COSTA%20NW.xml'], 'libro-faros-nw.xml');
  const fechaLibro = (xml.match(/fecha='([^']+)'/) || [])[1];
  const libro = parseLibro(xml);
  fs.writeFileSync(path.join(SALIDA, 'fuentes', 'libro-de-faros-extracto.xml'),
    `<!-- Extracto del Libro de Faros y Señales de Niebla (Instituto Hidrografico de la Marina, Armada). Costa NW, edicion ${fechaLibro}.\n     Origen: https://armada.defensa.gob.es/ihm/XML/LF/LF_ESPANA_COSTA%20NW.xml  (descargado el ${new Date().toISOString().slice(0, 10)}).\n     \`fases\` = segundos de luz y de oscuridad alternos, empezando por la luz. -->\n` + FAROS.map((f) => libro[f.numnac].linea).join('\n') + '\n');

  // 2. Wikipedia (comprobar que sigue diciendo lo mismo)
  for (const f of FAROS) {
    try {
      const html = await descargar(`https://es.wikipedia.org/api/rest_v1/page/html/${f.wiki}`, `wiki-${f.id}.html`);
      const txt = norm(html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')).replace(/\s+/g, ' ');
      const w = WIKI[f.id];
      if (w.luz && !txt.includes(w.luz.replace(/[()]/g, (c) => c))) console.warn(`  AVISO wikipedia ${f.id}: la ficha ya no dice «${w.luz}»`);
      if (w.texto && !txt.includes(w.texto)) console.warn(`  AVISO wikipedia ${f.id}: el texto ya no dice «${w.texto}»`);
    } catch (e) { console.warn('  wikipedia', f.id, e.message); }
  }

  // 3. OSM: costa + pueblos + faros (comprobación de posición)
  const bb = `${CAJA.sur - 0.18},${CAJA.oeste - 0.18},${CAJA.norte + 0.18},${CAJA.este + 0.18}`;
  const costa = await overpass(`[out:json][timeout:120];way["natural"="coastline"](${bb});out geom;`, 'osm-costa.json');
  const ways = costa.elements.filter((e) => e.type === 'way' && e.geometry);
  console.log('costa OSM:', ways.length, 'vías,', ways.reduce((a, w) => a + w.geometry.length, 0), 'nodos');
  const cadenas = unirCadenas(ways).map((c) => ({ ...c, pts: c.pts.map(([lon, lat]) => proy(lon, lat)) }));
  const abiertas = cadenas.filter((c) => !c.cerrada), cerradas = cadenas.filter((c) => c.cerrada);
  console.log('cadenas abiertas:', abiertas.length, 'cerradas (islas):', cerradas.length);

  const EPS = 28; // metros
  let { tierra, lineas } = ensamblarTierra(abiertas.map((c) => ({ pts: c.pts })));
  // simplificar: las líneas (runs) y la tierra por separado
  const simp = (arr) => arr.map((p) => dp(p, EPS));
  lineas = simp(lineas); tierra = tierra.map((p) => dp(p, EPS));
  // islas: anillos cerrados con la tierra a la izquierda (sentido antihorario con y hacia arriba)
  const islas = [];
  for (const c of cerradas) {
    const P = c.pts; const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
    if (Math.max(...xs) < -2000 || Math.min(...xs) > ANCHO_M + 2000 || Math.max(...ys) < -2000 || Math.min(...ys) > ALTO_M + 2000) continue;
    let a = 0; for (let i = 0; i < P.length - 1; i++) a += P[i][0] * (-P[i + 1][1]) - P[i + 1][0] * (-P[i][1]);
    if (a <= 0) continue; // sentido horario con y arriba = agua rodeada de tierra: no es una isla
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
    if (Math.max(w, h) < 120) continue; // peñas de menos de 120 m
    islas.push(dpAnillo(P, Math.min(EPS, Math.max(w, h) / 25)));
  }
  const todaTierra = tierra.concat(islas);
  console.log(`tierra: ${tierra.length} polígono(s) + ${islas.length} islas; líneas de costa: ${lineas.length}`);

  const redondea0 = (p) => p.flatMap(([x, y]) => [Math.round(x), Math.round(y)]);
  const costaOut = { generado: new Date().toISOString().slice(0, 10), fuente: 'OpenStreetMap (colaboradores de OpenStreetMap, ODbL) vía Overpass; natural=coastline',
    simplificacion_m: EPS, caja: { ...CAJA, ancho_m: ANCHO_M, alto_m: ALTO_M, lat_ref: LAT_REF },
    nota: 'Coordenadas planas [x,y,x,y,…] en metros desde la esquina noroeste (x al este, y al sur).',
    lineas: lineas.map(redondea0), tierra: tierra.map(redondea0), islas: islas.map(redondea0) };

  // pueblos
  const lugaresDeseados = ['Malpica de Bergantiños', 'O Porto de Corme', 'Laxe', 'Camariñas', 'Muxía', 'Fisterra', 'Carballo', 'Ponteceso', 'Cances Grande'];
  const pl = await overpass(`[out:json][timeout:60];node["place"~"town|village|hamlet"]["name"](${CAJA.sur},${CAJA.oeste},${CAJA.norte},${CAJA.este});out;`, 'osm-lugares.json');
  const lugares = [];
  for (const nombre of lugaresDeseados) {
    const n = pl.elements.find((e) => e.tags.name === nombre) || pl.elements.find((e) => e.tags.name?.startsWith(nombre.split(' ')[0]) && nombre !== 'Cances Grande');
    if (!n) { console.warn('  sin lugar OSM:', nombre); continue; }
    const [x, y] = proy(n.lon, n.lat);
    lugares.push({ nombre: n.tags.name, lat: n.lat, lon: n.lon, x: Math.round(x), y: Math.round(y), osm: `node/${n.id}`, tipo: n.tags.place });
  }
  const cances = lugares.find((l) => l.nombre === 'Cances Grande');

  // comprobación de posición contra nodos de faro de OSM
  const osmFaros = await overpass(`[out:json][timeout:60];nwr["man_made"="lighthouse"](${CAJA.sur},${CAJA.oeste},${CAJA.norte},${CAJA.este});out center tags;`, 'osm-faros.json');

  // la casa: el lugar de OSM (Cances Grande); si Mesa deja img/aire/casa.json con lat/lon, se usa y se dice
  const casa = { nombre: 'Casa Entremuros', lat: cances?.lat ?? 43.2473, lon: cances?.lon ?? -8.73401,
    fuente: 'OpenStreetMap: el lugar «Cances Grande» (hamlet). El punto exacto de la casa está por confirmar (PENDIENTES).', exacto: false };
  try {
    const cj = JSON.parse(fs.readFileSync(path.join(RAIZ, 'img', 'aire', 'casa.json'), 'utf8'));
    const lat = cj.lat ?? cj.latitud ?? cj.punto?.lat, lon = cj.lon ?? cj.lng ?? cj.longitud ?? cj.punto?.lon;
    if (typeof lat === 'number' && typeof lon === 'number' && Math.abs(lat - casa.lat) < 0.02 && Math.abs(lon - casa.lon) < 0.03) {
      casa.lat = lat; casa.lon = lon; casa.exacto = cj.exacto !== false && !/cances grande/i.test(JSON.stringify(cj.metodo || ''));
      casa.fuente = 'img/aire/casa.json (agente Mesa): ' + (cj.metodo || cj.como || 'ver ese fichero');
    }
  } catch { /* aún no existe */ }
  [casa.x, casa.y] = proy(casa.lon, casa.lat).map(Math.round);

  // 4. cada faro
  const salida = [];
  for (const f of FAROS) {
    const l = libro[f.numnac];
    if (!l) throw new Error('no está en el Libro de Faros: ' + f.numnac);
    const lat = parseFloat(l.lat.split(' ')[0]) + parseFloat(l.lat.split(' ')[1].replace(',', '.')) / 60;
    const lon = -(parseFloat(l.lon.split(' ')[0]) + parseFloat(l.lon.split(' ')[1].replace(',', '.')) / 60);
    const car = caracteristica(l.aparpe, l.fases);
    const [x, y] = proy(lon, lat);
    const w = WIKI[f.id];
    const disc = [];
    if (w.discrepancia) disc.push(w.discrepancia);
    if (w.alcance_mn != null && w.alcance_mn !== Number(l.alc)) disc.push(`Alcance: Libro ${l.alc} M, Wikipedia ${w.alcance_mn} M.`);
    if (w.focal_m != null && w.focal_m !== Number(l.eleva)) disc.push(`Altura focal: Libro ${l.eleva} m, Wikipedia ${w.focal_m} m.`);
    if (w.soporte_m != null && w.soporte_m !== Number(l.altura)) disc.push(`Altura de la torre: Libro ${l.altura} m, Wikipedia ${w.soporte_m} m.`);
    if (w.altura_m != null && w.altura_m !== Number(l.altura)) disc.push(`Altura de la torre: Libro ${l.altura} m, Wikipedia ${w.altura_m} m.`);
    // posición contra OSM
    const osm = osmFaros.elements.map((e) => ({ e, d: haversine({ lat, lon }, { lat: e.lat ?? e.center?.lat, lon: e.lon ?? e.center?.lon }) * 1000 })).sort((a, b) => a.d - b.d)[0];
    // municipio (Nominatim, 1 s entre consultas)
    let municipio = null;
    try {
      const j = JSON.parse(await descargar(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=es&lat=${lat}&lon=${lon}`, `nom-${f.id}.json`));
      municipio = j.address?.municipality || j.address?.city || j.address?.town || j.address?.village || null;
      if (!fs.existsSync(path.join(CACHE, `nom-${f.id}.ok`))) { fs.writeFileSync(path.join(CACHE, `nom-${f.id}.ok`), '1'); await dormir(1100); }
    } catch (e) { console.warn('  nominatim', f.id, e.message); }
    // rumbo hacia el mar: promedio de direcciones sin tierra a 1,8 km
    let sx = 0, sy = 0;
    for (let g = 0; g < 360; g += 10) { const dx = Math.sin(rad(g)), dy = -Math.cos(rad(g)); if (!esTierra(x + dx * 1800, y + dy * 1800, todaTierra)) { sx += dx; sy += dy; } }
    const rumbo = sx === 0 && sy === 0 ? 270 : Math.round(((Math.atan2(sx, -sy) * 180) / Math.PI + 360) % 360);
    // distancia a la casa
    const linea = haversine(casa, { lat, lon });
    let carretera = null;
    if (f.id !== 'sisargas') {
      try {
        const r = JSON.parse(await descargar(`https://router.project-osrm.org/route/v1/driving/${casa.lon},${casa.lat};${lon},${lat}?overview=false`, `osrm-${f.id}.json`));
        const ruta = r.routes?.[0];
        if (ruta) carretera = { km: redondea(ruta.distance / 1000, 1), min_osrm: Math.round(ruta.duration / 60), hasta_m_del_faro: Math.round(r.waypoints[1].distance), origen_m_de_la_casa: Math.round(r.waypoints[0].distance) };
        await dormir(400);
      } catch (e) { console.warn('  osrm', f.id, e.message); }
    }
    const fuentes = [
      { tipo: 'oficial', nombre: 'Libro de Faros y Señales de Niebla, Instituto Hidrográfico de la Marina (Armada). Costa NW, edición ' + fechaLibro,
        url: 'https://armada.defensa.gob.es/ihm/XML/LF/LF_ESPANA_COSTA%20NW.xml', numero_nacional: l.numnac, numero_internacional: l.numint, uso: 'característica, fases, alturas, alcance, posición' },
      { tipo: 'segunda', nombre: 'Wikipedia en castellano: ' + decodeURIComponent(f.wiki).replace(/_/g, ' '), url: 'https://es.wikipedia.org/wiki/' + f.wiki,
        ficha_luz: w.luz ?? w.texto, coincide_con_el_libro: w.coincide && disc.length === 0, uso: 'segunda comprobación y años' },
    ];
    if (f.id === 'laxe') fuentes.push({ tipo: 'tercera', nombre: 'turismo.gal, Faro de Laxe: «cinco destellos en 20 segundos», alcance de 22 millas', url: 'https://www.turismo.gal/recurso/-/detalle/7541/faro-de-laxe',
      nota: 'Coincide en los cinco destellos cada 20 s; el alcance de 22 M difiere del Libro (20 M): gana el Libro.' });
    if (f.id === 'laxe') disc.push('turismo.gal da 22 millas de alcance; el Libro de Faros y la Wikipedia, 20. Gana el Libro de Faros.');
    const estado = l.estado || null;
    const nota_estado = estado ? `El Libro de Faros (edición ${fechaLibro}) la anota como «${estado}»: apagada temporalmente. No he podido confirmar si hoy luce; el resto de fuentes la describen en servicio.` : null;
    salida.push({
      id: f.id, nombre: f.nombre, nombre_libro: [l.c1, l.nomgeo].filter(Boolean).join(' · '), municipio,
      lat: redondea(lat, 5), lon: redondea(lon, 5), x: Math.round(x), y: Math.round(y),
      posicion_osm_comprobada: osm ? { elemento: `${osm.e.type}/${osm.e.id}`, nombre: osm.e.tags?.name || null, distancia_m: Math.round(osm.d) } : null,
      caracteristica: { ...car, texto_es: f.explicacion },
      altura_torre_m: Number(l.altura), altura_focal_m: Number(l.eleva), alcance_mn: Number(l.alc), alcance_km: redondea(Number(l.alc) * 1.852, 1),
      descripcion_libro: l.desorp, estado_libro: estado, nota_estado,
      giratorio: f.giratorio, giratorio_fuente: f.giratorio_fuente || null,
      rumbo_mar_deg: rumbo,
      etiqueta: f.etiqueta,
      anio: f.anio, nota: f.nota || null,
      casa: { linea_recta_km: redondea(linea, 1), carretera, metodo: 'Línea recta: fórmula del haversine entre el lugar de Cances Grande (OSM) y la posición del Libro de Faros. Carretera: OSRM (router.project-osrm.org, perfil coche, sin tráfico), ruta calculada el ' + new Date().toISOString().slice(0, 10) + (f.id === 'sisargas' ? '. Las Sisargas son una isla: solo línea recta.' : '. Los minutos de OSRM (min_osrm) salen bastante más lentos que los que da la casa (Malpica: 14 frente a «diez minutos»; Nariga: 37 frente a «20 minutos», IG 23), así que la web enseña los km y no esos minutos.') },
      fuentes, discrepancias: disc,
      foto: f.foto ? { nombre: f.foto.nombre, alt: f.foto.alt, ig: f.foto.ig, fecha: IG[f.foto.ig].fecha } : null,
    });
    console.log(`  ${f.id.padEnd(9)} ${car.ihm.padEnd(14)} ${String(l.eleva).padStart(3)} m ${String(l.alc).padStart(2)} M  ${municipio}  recta ${redondea(linea, 1)} km  coche ${carretera ? carretera.km + ' km / ' + carretera.min_osrm + ' min OSRM (snap ' + carretera.hasta_m_del_faro + ' m)' : '-'}  mar ${rumbo}°  osm ${osm ? Math.round(osm.d) + ' m' : '-'}${disc.length ? '  DISC: ' + disc.length : ''}`);
  }

  // 5. recomendaciones
  const recs = RECOMIENDA.map((r) => ({
    id: r.id, lugar: r.lugar, faro: r.faro || null,
    frases: r.frases.map((f) => ({ texto: f.texto, ig: f.ig, fecha: IG[f.ig].fecha, fecha_larga: fechaLarga(IG[f.ig].fecha), enlace: `https://www.instagram.com/p/${IG[f.ig].code}/` })),
    dice_casa: r.dice_casa ? { texto: r.dice_casa.texto, ig: r.dice_casa.ig, fecha_larga: fechaLarga(IG[r.dice_casa.ig].fecha) } : null,
    foto: r.foto ? { nombre: r.foto.nombre, alt: r.foto.alt, ig: r.foto.ig, fecha: IG[r.foto.ig].fecha, credito: 'Foto de @casaentremuros' } : null,
  }));

  const datos = {
    generado: new Date().toISOString().slice(0, 10),
    nota: 'Característica de cada faro: Libro de Faros del Instituto Hidrográfico de la Marina (oficial). Si la Wikipedia difiere, gana el Libro y se anota en `discrepancias`.',
    libro_de_faros: { edicion: fechaLibro, url: 'https://armada.defensa.gob.es/ihm/XML/LF/LF_ESPANA_COSTA%20NW.xml', autor: 'Instituto Hidrográfico de la Marina (Armada)' },
    caja: { ...CAJA, ancho_m: ANCHO_M, alto_m: ALTO_M, lat_ref: LAT_REF },
    casa, lugares, faros: salida,
    camino_de_los_faros: { texto: CAMINO.texto.replace(/\s+/g, ' '), ig: CAMINO.ig, fecha_larga: fechaLarga(IG[CAMINO.ig].fecha), nota: 'O Camiño dos Faros: 8 etapas y 200 km de Malpica a Fisterra (IG 47).' },
    dice_casa_nariga: { texto: 'A 20 minutos de la casa se encuentra el Faro Nariga', ig: 23, fecha_larga: fechaLarga(IG[23].fecha) },
    recomendaciones: recs,
    atribucion: 'Costa y pueblos: © colaboradores de OpenStreetMap (ODbL). Característica de los faros: Libro de Faros, Instituto Hidrográfico de la Marina (edición ' + fechaLibro + ').',
    destellos_max_por_segundo: 3,
  };

  // desfase de cada ciclo respecto al reloj (NO es dato de la costa: ahí no sé cuándo empieza cada ciclo).
  // Sin él, los ocho faros arrancarían a la vez cada 60 s (el mínimo común múltiplo de 4, 5, 6, 15 y 20 s).
  // Se busca (semilla fija) el reparto con menos inicios de destello juntos entre TODOS los faros,
  // contando en ventanas deslizantes de 1 s durante una hora.
  {
    const ciclo = (f) => { const c = f.caracteristica; let a = 0; const ons = []; c.fases_s.forEach((d, i) => { if (i % 2 === 0) ons.push(a); a += d; }); return ons; };
    const maxVentana = (offs) => {
      const ev = [];
      salida.forEach((f, i) => { const P = f.caracteristica.periodo_s; for (let k = 0; k * P < 3700; k++) ciclo(f).forEach((x) => { const t = k * P + x + offs[i]; if (t >= 0 && t < 3600) ev.push(t); }); });
      ev.sort((a, b) => a - b);
      let mx = 0, dos = 0, j = 0;
      for (let i = 0; i < ev.length; i++) { while (ev[j] < ev[i] - 1 + 1e-9) j++; const n = i - j + 1; if (n > mx) mx = n; if (n >= 3) dos++; }
      return { mx, tres: dos };
    };
    let a32 = 20261025; const R = () => { a32 |= 0; a32 = (a32 + 0x6D2B79F5) | 0; let t = Math.imul(a32 ^ (a32 >>> 15), 1 | a32); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    let mejor = null, coste = Infinity, info = null;
    for (let n = 0; n < 3000; n++) {
      const offs = salida.map((f) => redondea(R() * f.caracteristica.periodo_s, 1));
      const r = maxVentana(offs), c = r.mx * 100000 + r.tres;
      if (c < coste) { coste = c; mejor = offs; info = r; }
    }
    salida.forEach((f, i) => { f.caracteristica.desfase_s = mejor[i]; });
    console.log('inicios de destello en cualquier ventana de 1 s, entre TODOS los faros y en una hora: máximo', info.mx, '(' + info.tres + ' veces con 3)');
    datos.destellos_max_global_por_segundo = info.mx;
    if (info.mx > 3) throw new Error('hay más de 3 destellos por segundo entre todos los faros: cambia los desfases');
  }

  // comprobación WCAG 2.3.1 de los datos: ningún faro más de 3 destellos por segundo
  for (const f of salida) {
    const ons = []; let t = 0; f.caracteristica.fases_s.forEach((d, i) => { if (i % 2 === 0) ons.push(t); t += d; });
    const hz = ons.length ? Math.max(...ons.map((o, i) => { const sig = ons[(i + 1) % ons.length] + (i + 1 === ons.length ? f.caracteristica.periodo_s : 0); return 1 / (sig - o); })) : 0;
    f.caracteristica.max_inicios_por_segundo = redondea(hz, 3);
    if (hz > 3) throw new Error('más de 3 destellos por segundo en ' + f.id);
  }

  fs.writeFileSync(path.join(SALIDA, 'faros.json'), JSON.stringify(datos, null, 1));
  fs.writeFileSync(path.join(SALIDA, 'costa.json'), JSON.stringify(costaOut));
  console.log('escrito faros.json', (fs.statSync(path.join(SALIDA, 'faros.json')).size / 1024).toFixed(1), 'KB; costa.json', (fs.statSync(path.join(SALIDA, 'costa.json')).size / 1024).toFixed(1), 'KB');

  // 6. fotos
  if (!SIN_FOTOS) {
    const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
    const sharp = require('sharp');
    const dirIn = path.join(REF, 'fotos', 'instagram'), dirOut = path.join(SALIDA, 'fotos');
    fs.mkdirSync(dirOut, { recursive: true });
    const lista = new Map();
    for (const f of FAROS) if (f.foto) lista.set(f.foto.nombre, f.foto.archivo);
    for (const r of RECOMIENDA) if (r.foto) lista.set(r.foto.nombre, r.foto.archivo);
    const manifiesto = {};
    for (const [nombre, archivo] of lista) {
      const origen = path.join(dirIn, archivo);
      const meta = await sharp(origen).metadata();
      const ancho = Math.min(meta.width, 560); // nunca amplía; son miniaturas
      const alto = Math.round((meta.height * ancho) / meta.width);
      // una corrección común y suave (menos saturación y negros menos duros)
      const base = () => sharp(origen).rotate().resize({ width: ancho, withoutEnlargement: true }).modulate({ saturation: 0.94 }).linear(0.97, 4);
      await base().webp({ quality: 76 }).toFile(path.join(dirOut, `${nombre}-${ancho}.webp`));
      await base().jpeg({ quality: 76, mozjpeg: true }).toFile(path.join(dirOut, `${nombre}-${ancho}.jpg`));
      manifiesto[nombre] = { ancho, alto, origen: archivo, origenAncho: meta.width, origenAlto: meta.height };
    }
    fs.writeFileSync(path.join(dirOut, 'fotos.json'), JSON.stringify(manifiesto, null, 1));
    console.log('fotos:', Object.keys(manifiesto).length);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
