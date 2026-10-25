/* La lámina de Bergantiños, «dibujada a pluma sobre lino», a partir de los datos de OSM de scripts/lugares-cache/ (los pide
   `node scripts/lugares.mjs datos`). Escribe:
     img/lugares/mapa.svg       la lámina base (papel de lino, costa con sus ondas, río Anllóns, ríos, carreteras, concellos,
                                caseríos como casitas, marco, rosa de los vientos, escala). Sin texto: es una <img> y no
                                podría usar las letras de la web; los rótulos y las seis líneas van encima, en SVG vivo.
     img/lugares/lugares.json   los seis lugares con coordenadas, fuente, distancia, textos de la casa y la lámina (líneas,
                                rótulos y puntos en el viewBox)
     img/lugares/respaldo.html  el respaldo sin JS: las seis habitaciones con foto y texto
     pruebas/lugares-demo.html  la página de prueba
   Con semilla fija: la misma lámina siempre. Sin azar sin semilla. */
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ, SAL, OSM, CAJA, CASA, ruta } from './lugares-comun.mjs';
import * as G from './lugares-geo.mjs';

const { W, H, proy, desproy, dist, trozos, unir, simplificar, chaikin, temblar, semilla, aPath, largo, elementos } = G;

/* tintas (los tokens de la web, horneados: una <img> SVG no lee variables CSS) */
const TINTA = '#2B2823', TINTA2 = '#5E574D', PAPEL = '#EFE8DA', LINO = '#F3EEE5', AGUA = '#3E5D63', TEJA = '#A9503A';
const MARCO = 14;                             // el marco, en unidades de la lámina
const f1 = (v) => (Math.round(v * 10) / 10).toString();
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ------------------------------------------------------------------ 1. tierra y mar con una rejilla ------------------------------------------------------------------ */
const CELDA = 2, NX = Math.ceil(W / CELDA) + 1, NY = Math.ceil(H / CELDA) + 1;

function mascaraMar(costa, casaXY) {
  const pared = new Uint8Array(NX * NY);
  const raya = (x0, y0, x1, y1) => {
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy;
    for (;;) {
      if (x0 >= 0 && y0 >= 0 && x0 < NX && y0 < NY) pared[y0 * NX + x0] = 1;
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  };
  const c = (v) => Math.round(v / CELDA);
  for (const ch of costa) for (let i = 1; i < ch.length; i++) raya(c(ch[i - 1][0]), c(ch[i - 1][1]), c(ch[i][0]), c(ch[i][1]));
  /* semillas: a la derecha de la costa (el mar queda a la derecha de la vía), en tramos rectos y largos */
  const semillas = [];
  for (const ch of costa) {
    let acum = 0;
    for (let i = 4; i < ch.length - 4; i++) {
      acum += Math.hypot(ch[i][0] - ch[i - 1][0], ch[i][1] - ch[i - 1][1]);
      if (acum < 40) continue;
      const a = ch[i - 4], b = ch[i + 4];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
      if (l < 8) continue;
      const rec = ch.slice(i - 4, i + 5); if (largo(rec) > l * 1.15) continue;      // no recta
      acum = 0;
      semillas.push([ch[i][0] + (-dy / l) * 7, ch[i][1] + (dx / l) * 7]);
    }
  }
  const mar = new Uint8Array(NX * NY);
  const idxCasa = c(casaXY[1]) * NX + c(casaXY[0]);
  let aceptadas = 0, rechazadas = 0;
  for (const [sx, sy] of semillas) {
    const ix = c(sx), iy = c(sy);
    if (ix < 0 || iy < 0 || ix >= NX || iy >= NY) continue;
    const i0 = iy * NX + ix;
    if (pared[i0] || mar[i0]) continue;
    const pila = [i0], region = [];
    const vis = new Map(); vis.set(i0, 1);
    let tierra = false;
    while (pila.length) {
      const i = pila.pop(); region.push(i);
      if (i === idxCasa || region.length > NX * NY * 0.7) { tierra = true; break; }
      const x = i % NX, y = (i / NX) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= NX || yy >= NY) continue;
        const j = yy * NX + xx;
        if (pared[j] || mar[j] || vis.has(j)) continue;
        vis.set(j, 1); pila.push(j);
      }
    }
    if (tierra) { rechazadas++; continue; }
    for (const i of region) mar[i] = 1;
    aceptadas++;
  }
  return { pared, mar, aceptadas, rechazadas, semillas: semillas.length };
}

/* distancia euclídea a la pared (Felzenszwalb) */
function edt(pared) {
  const INF = 1e12, f = new Float64Array(Math.max(NX, NY)), d = new Float64Array(Math.max(NX, NY)), v = new Int32Array(Math.max(NX, NY)), z = new Float64Array(Math.max(NX, NY) + 1);
  const g = new Float64Array(NX * NY);
  for (let i = 0; i < g.length; i++) g[i] = pared[i] ? 0 : INF;
  const pasada = (n, leer, escribir) => {
    for (let q = 0; q < n; q++) f[q] = leer(q);
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s;
      for (;;) { s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); if (s <= z[k] && k > 0) k--; else break; }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
    for (let q = 0; q < n; q++) escribir(q, d[q]);
  };
  for (let x = 0; x < NX; x++) pasada(NY, (y) => g[y * NX + x], (y, val) => { g[y * NX + x] = val; });
  for (let y = 0; y < NY; y++) pasada(NX, (x) => g[y * NX + x], (x, val) => { g[y * NX + x] = val; });
  for (let i = 0; i < g.length; i++) g[i] = Math.sqrt(g[i]) * CELDA;
  return g;
}

/* isolíneas (marching squares) del campo `campo` al nivel `nivel`; devuelve cadenas de puntos en unidades de lámina */
function isolineas(campo, nivel) {
  const pt = new Map(), ady = new Map();
  const val = (x, y) => campo[y * NX + x];
  const punto = (clave, x0, y0, x1, y1) => {
    if (pt.has(clave)) return clave;
    const a = val(x0, y0), b = val(x1, y1), t = (nivel - a) / (b - a || 1e-9);
    pt.set(clave, [(x0 + (x1 - x0) * t) * CELDA, (y0 + (y1 - y0) * t) * CELDA]);
    return clave;
  };
  const seg = (a, b) => { (ady.get(a) || ady.set(a, []).get(a)).push(b); (ady.get(b) || ady.set(b, []).get(b)).push(a); };
  for (let y = 0; y < NY - 1; y++) for (let x = 0; x < NX - 1; x++) {
    const a = val(x, y) >= nivel ? 1 : 0, b = val(x + 1, y) >= nivel ? 1 : 0, c = val(x + 1, y + 1) >= nivel ? 1 : 0, d = val(x, y + 1) >= nivel ? 1 : 0;
    const idx = a * 8 + b * 4 + c * 2 + d; if (idx === 0 || idx === 15) continue;
    const T = () => punto(`h${x},${y}`, x, y, x + 1, y), R = () => punto(`v${x + 1},${y}`, x + 1, y, x + 1, y + 1),
      B = () => punto(`h${x},${y + 1}`, x, y + 1, x + 1, y + 1), L = () => punto(`v${x},${y}`, x, y, x, y + 1);
    switch (idx) {
      case 1: case 14: seg(L(), B()); break;
      case 2: case 13: seg(B(), R()); break;
      case 3: case 12: seg(L(), R()); break;
      case 4: case 11: seg(T(), R()); break;
      case 5: seg(T(), L()); seg(B(), R()); break;
      case 6: case 9: seg(T(), B()); break;
      case 7: case 8: seg(T(), L()); break;
      case 10: seg(T(), R()); seg(L(), B()); break;
    }
  }
  const usado = new Set(), cadenas = [];
  for (const [k, vec] of ady) {
    if (usado.has(k) || vec.length !== 1) continue;           // empieza por los extremos abiertos
    const ch = [k]; usado.add(k); let cur = k;
    for (;;) { const sig = ady.get(cur).find((n) => !usado.has(n)); if (!sig) break; usado.add(sig); ch.push(sig); cur = sig; }
    cadenas.push(ch.map((q) => pt.get(q)));
  }
  for (const [k] of ady) {                                    // los anillos cerrados
    if (usado.has(k)) continue;
    const ch = [k]; usado.add(k); let cur = k;
    for (;;) { const sig = ady.get(cur).find((n) => !usado.has(n)); if (!sig) break; usado.add(sig); ch.push(sig); cur = sig; }
    cadenas.push(ch.map((q) => pt.get(q)));
  }
  return cadenas;
}

/* ------------------------------------------------------------------ 2. la lámina ------------------------------------------------------------------ */
function construirBase(ctx) {
  const rnd = semilla(20261025);
  const { costa, mar, campo } = ctx;
  const out = [];
  const trazo = (pts, { color = TINTA, ancho = 1, op = 1, dash = '', suave = true, extra = '' } = {}) =>
    out.push(`<path d="${aPath(pts, suave)}" fill="none" stroke="${color}" stroke-width="${ancho}" stroke-opacity="${op}" stroke-linecap="round" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ''}${extra}/>`);

  /* ondas del mar: líneas paralelas a la costa que se van espaciando */
  const niveles = [5, 10.5, 17, 25, 35, 48, 64, 84];
  niveles.forEach((nv, k) => {
    const cadenas = isolineas(campo, nv);
    for (const ch of cadenas) {
      if (largo(ch) < 26) continue;
      let p = simplificar(ch, 0.9); p = chaikin(p, 2); p = temblar(p, rnd, 0.9 + k * 0.12, 20);
      const dash = k < 2 ? '' : `${f1(40 + rnd() * 70)} ${f1(3 + rnd() * 6)} ${f1(18 + rnd() * 40)} ${f1(4 + rnd() * 6)}`;
      trazo(p, { color: AGUA, ancho: 0.8 - k * 0.04, op: Math.max(0.2, 0.62 - k * 0.055), dash, suave: false });
    }
  });

  /* costa: dos pasadas, la fina un poco desplazada, como una pluma que vuelve sobre su línea */
  for (const ch of costa) {
    if (largo(ch) < 4) continue;
    let p = simplificar(ch, 0.55); if (p.length > 2) p = chaikin(p, 1);
    trazo(temblar(p, rnd, 0.7, 11), { ancho: 1.75, op: 0.95, suave: false });
    trazo(temblar(p, rnd, 0.9, 7).map((q) => [q[0] + 0.5, q[1] - 0.4]), { ancho: 0.6, op: 0.55, suave: false });
  }

  /* lagoa de Baldaio y demás aguas con nombre: contorno y un lavado */
  for (const w of elementos('aguas')) {
    if (!/Baldaio/.test(w.tags.name || '')) continue;
    for (const t of trozos(w)) {
      const p = t.map((q) => proy(...q));
      out.push(`<path d="${aPath(p, false)}Z" fill="${AGUA}" fill-opacity="0.16" stroke="${AGUA}" stroke-width="0.9" stroke-opacity=".8"/>`);
    }
  }

  /* concellos: línea de puntos y rayas */
  const lim = unir(elementos('limites').flatMap(trozos), false);
  for (const ch of lim) {
    const p = simplificar(ch.map((q) => proy(...q)), 1.2);
    if (largo(p) < 30) continue;
    trazo(temblar(chaikin(p, 1), rnd, 0.6, 16), { color: TINTA2, ancho: 0.8, op: 0.62, dash: '7 3 1.4 3', suave: false });
  }

  /* carreteras */
  const porTipo = { motorway: [], primary: [], secondary: [] };
  for (const w of elementos('carreteras')) if (porTipo[w.tags.highway]) porTipo[w.tags.highway].push(...trozos(w));
  const ejes = (lista, eps) => unir(lista, false).map((ch) => simplificar(ch.map((q) => proy(...q)), eps)).filter((p) => largo(p) > 18);
  for (const p of ejes(porTipo.secondary, 1.1)) trazo(temblar(chaikin(p, 1), rnd, 0.5, 14), { color: TINTA2, ancho: 0.75, op: 0.62 });
  for (const p of ejes(porTipo.primary, 0.9)) trazo(temblar(chaikin(p, 1), rnd, 0.5, 14), { color: TINTA, ancho: 1.3, op: 0.8 });
  for (const p of ejes(porTipo.motorway, 0.9)) {
    const q = temblar(chaikin(p, 1), rnd, 0.5, 16);
    trazo(q, { color: TINTA, ancho: 3.4, op: 0.9 }); trazo(q, { color: PAPEL, ancho: 1.3, op: 1 });
  }

  /* ríos: el Anllóns, entero y con más tinta; los afluentes, finos */
  const ríos = elementos('rios'), anll = elementos('anllons');
  const esAnll = (w) => /Anll[oó]ns/.test(w.tags.name || '');
  const otros = ríos.filter((w) => !esAnll(w)).flatMap((w) => trozos(w).map((t) => ({ t, rio: w.tags.waterway === 'river' })));
  for (const { t, rio } of otros) {
    const p = simplificar(t.map((q) => proy(...q)), 0.7);
    if (largo(p) < (rio ? 24 : 70)) continue;
    trazo(temblar(chaikin(p, 1), rnd, 0.45, 12), { color: AGUA, ancho: rio ? 1.0 : 0.65, op: rio ? 0.85 : 0.6 });
  }
  const cadenasAnll = unir([...anll, ...ríos.filter(esAnll)].flatMap(trozos), false);
  for (const ch of cadenasAnll) {
    const p = simplificar(ch.map((q) => proy(...q)), 0.5), q = temblar(chaikin(p, 1), rnd, 0.5, 12);
    trazo(q, { color: AGUA, ancho: 3.4, op: 1 });
    trazo(temblar(chaikin(p, 1), rnd, 0.7, 9).map((r) => [r[0] + 0.35, r[1] + 0.3]), { color: PAPEL, ancho: 0.7, op: 0.5 });
  }

  /* núcleos: casitas dibujadas a pluma, solo en tierra */
  const casita = (x, y, s, r) => {
    const a = (r - 0.5) * 0.5, c = Math.cos(a), sn = Math.sin(a);
    const P = (px, py) => `${f1(x + px * c - py * sn)} ${f1(y + px * sn + py * c)}`;
    const w = 5.2 * s, h = 3.4 * s, t = 2.4 * s;
    return `<path d="M${P(-w / 2, 0)}L${P(w / 2, 0)}L${P(w / 2, -h)}L${P(0, -h - t)}L${P(-w / 2, -h)}Z" fill="${LINO}" stroke="${TINTA}" stroke-width=".8" stroke-linejoin="round"/>`;
  };
  const enTierra = (x, y) => { const i = Math.round(y / CELDA) * NX + Math.round(x / CELDA); return !mar[i]; };
  const pueblos = [['Carballo', 'town', 26, 20], ['Malpica', 'town', 15, 12], ['Ponteceso', 'village', 8, 8], ['San Roque', 'village', 8, 8], ['Zas', 'village', 7, 8], ['Buño', 'hamlet', 8, 7]];
  const nuc = elementos('nucleos');
  const lug = [];
  for (const [nom, , n, R] of pueblos) {
    const e = nuc.find((q) => q.tags.name === nom); if (!e) continue;
    const [cx, cy] = proy(e.lat, e.lon); const rr = semilla(nom.length * 977 + n);
    let puestas = 0, tries = 0;
    while (puestas < n && tries < n * 12) {
      tries++;
      const a = rr() * 6.283, rad = R * Math.sqrt(rr());
      const x = cx + Math.cos(a) * rad * 1.15, y = cy + Math.sin(a) * rad * 0.85;
      if (!enTierra(x, y) || !enTierra(x + 6, y) || !enTierra(x - 6, y) || !enTierra(x, y - 7)) continue;
      lug.push([x, y, 0.85 + rr() * 0.35, rr()]); puestas++;
    }
  }
  lug.sort((p, q) => p[1] - q[1]);
  for (const [x, y, s, r] of lug) out.push(casita(x, y, s, r));

  return out.join('\n');
}

function rosaYEscala() {
  const rnd = semilla(77);
  const cx = 905, cy = 96, R = 50, r = 12;
  const punta = (ang, largo, ancho) => {
    const a = (ang * Math.PI) / 180, p = [cx + Math.sin(a) * largo, cy - Math.cos(a) * largo];
    const b1 = [cx + Math.sin(a + 1.5708) * ancho, cy - Math.cos(a + 1.5708) * ancho], b2 = [cx + Math.sin(a - 1.5708) * ancho, cy - Math.cos(a - 1.5708) * ancho];
    return { p, b1, b2 };
  };
  let s = '';
  /* cuatro puntas largas (la norte, rellena a media tinta) y cuatro cortas */
  for (const [ang, l, w, lleno] of [[0, R, 6.2, 1], [90, R * 0.82, 5.2, 0], [180, R * 0.82, 5.2, 0], [270, R * 0.82, 5.2, 0], [45, R * 0.5, 3.2, 0], [135, R * 0.5, 3.2, 0], [225, R * 0.5, 3.2, 0], [315, R * 0.5, 3.2, 0]]) {
    const { p, b1, b2 } = punta(ang, l, w);
    s += `<path d="M${f1(b1[0])} ${f1(b1[1])}L${f1(p[0])} ${f1(p[1])}L${f1(b2[0])} ${f1(b2[1])}L${f1(cx)} ${f1(cy)}Z" fill="${lleno ? TINTA : LINO}" fill-opacity="${lleno ? 0.85 : 1}" stroke="${TINTA}" stroke-width="1" stroke-linejoin="round"/>`;
  }
  const circ = [];
  for (let i = 0; i <= 48; i++) { const a = (i / 48) * 6.283 + (rnd() - 0.5) * 0.01; circ.push([cx + Math.cos(a) * (R * 0.62 + (rnd() - 0.5) * 0.7), cy + Math.sin(a) * (R * 0.62 + (rnd() - 0.5) * 0.7)]); }
  s += `<path d="${aPath(circ)}Z" fill="none" stroke="${TINTA}" stroke-width=".8" stroke-opacity=".8"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${r * 0.25}" fill="${TINTA}"/>`;
  /* escala de 5 km */
  const U5 = G.U * 5, x0 = 962 - U5, y0 = 1054;
  s += `<path d="M${f1(x0)} ${y0}H${f1(x0 + U5)}M${f1(x0)} ${y0 - 7}V${y0 + 3}M${f1(x0 + U5 / 2)} ${y0 - 5}V${y0 + 3}M${f1(x0 + U5)} ${y0 - 7}V${y0 + 3}" stroke="${TINTA}" stroke-width="1.2" fill="none"/>`;
  s += `<rect x="${f1(x0)}" y="${y0 - 4}" width="${f1(U5 / 2)}" height="4" fill="${TINTA}"/>`;
  return { svg: s, escala: { x0, y0, u5: U5 }, rosa: { cx, cy, R } };
}

function marcoYPapel() {
  const rnd = semilla(5);
  const rect = (m, amp) => {
    const p = [];
    const lado = (x0, y0, x1, y1) => { const n = Math.round(Math.hypot(x1 - x0, y1 - y0) / 14); for (let i = 0; i < n; i++) p.push([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]); };
    lado(m, m, W - m, m); lado(W - m, m, W - m, H - m); lado(W - m, H - m, m, H - m); lado(m, H - m, m, m);
    return temblar(p, rnd, amp, 30);
  };
  const a = rect(MARCO, 0.5), b = rect(MARCO + 6, 0.4);
  return `<path d="${aPath(a, false)}Z" fill="none" stroke="${TINTA}" stroke-width="2" stroke-linejoin="round"/>
<path d="${aPath(b, false)}Z" fill="none" stroke="${TINTA}" stroke-width=".8" stroke-opacity=".8" stroke-linejoin="round"/>`;
}

/* ------------------------------------------------------------------ 3. los lugares ------------------------------------------------------------------ */
/* Los datos de cada habitación. Frases LITERALES de la casa con su número de post (ref/DATOS-ENTREMUROS.md, ref/raw/ig/ig-indice.md). */
export const HABITACIONES = [
  {
    id: 'rio-anllons', habitacion: 'Río Anllóns', edificio: 'casa', dato: 'Casa grande',
    tipoLugar: 'río', lugar: 'Río Anllóns',
    osm: { tipo: 'way', id: null, nota: 'el punto del río Anllóns más cercano a la casa (OSM, waterway=river «Río Anllóns»)' },
    casaDice: [
      { t: 'con vistas a la parte delantera de la casa y al jardín', ig: 28, fecha: '2023-07-26' },
      { t: 'es una de las que más gusta a nuestros huéspedes', ig: 90, fecha: '2020-08-30' },
      { t: 'picamos la piedra de las paredes que es preciosa y la puse en tonos neutros que le da más luz y amplitud', ig: 105, fecha: '2020-07-22' },
    ],
    lugarDice: 'El río de Carballo. Nace en los montes do Xalo y desemboca en la ría de Corme e Laxe; 54,4 km (Galipedia). La casa lo enseña desde el mirador de Monte Branco, «la desembocadura del río Anllóns» (IG 89).',
    lugarFuente: 'Galipedia, «Río Anllóns»; OSM; IG 89',
    distancia: { casa: null, solo_recta: true },
    foto: { hab: 'lg-rio-anllons-hab', lugar: 'lg-rio-anllons-lugar' },
    pendiente: 'El río no es un punto: la línea va a su tramo más cercano a la casa.',
    bow: 0.12, glifo: 'rio', lado: ['abajo', 'izqAba', 'izqAba2', 'derAba'],
  },
  {
    id: 'refuxo-de-verdes', habitacion: 'Refuxo de Verdes', edificio: 'casa', dato: 'Casa grande',
    tipoLugar: 'espacio natural', lugar: 'Refuxo de Verdes',
    osm: { tipo: 'way', id: 96730657, nota: 'OSM way 96730657, tourism=picnic_site «Refuxio de Verdes» (Verdes, Coristanco); el río, relación 1392812' },
    casaDice: [
      { t: 'cama con dosel', ig: 101, fecha: '2020-08-06' },
      { t: 'caracterizada por su cama con dosel que le da un aire romántico', ig: 131, fecha: '2019-08-07' },
    ],
    lugarDice: 'Un «espacio natural que tiene varios molinos y senderos con puentes por los que puedes pasear y por donde pasa el río Anllóns que se divide en varios ramales formando caídas de augas», dice la casa (IG 121).',
    lugarFuente: 'IG 121 (2020), IG 229 (2016); OSM',
    distancia: { casa: 'a 10 minutos en coche', casaFuente: 'IG 121: «solo 10 minutos en coche»' },
    foto: { hab: 'lg-refuxo-de-verdes-hab', lugar: 'lg-refuxo-de-verdes-lugar' },
    bow: -0.14, glifo: 'molino', lado: ['izqArr', 'arribaIzq', 'izq'],
  },
  {
    id: 'ponte-lubians', habitacion: 'Ponte Lubiáns', edificio: 'casa', dato: 'Casa grande · la más grande · cama de 1,80',
    tipoLugar: 'puente', lugar: 'Ponte Lubiáns',
    osm: { tipo: 'way', id: 368154510, nota: 'OSM way 368154510, bridge=yes, name «Ponte Lubiáns» (alt. «A Ponte Vella»), wikidata Q9064357' },
    casaDice: [
      { t: 'la habitación más grande de la casa con una cama de 1.80 y con vistas al frente de la casa y por el lateral al valle de Cances por donde entra toda la luz de la mañana', ig: 66, fecha: '2021-04-10' },
    ],
    lugarDice: 'Un puente sobre el río Rosende, entre las parroquias de Oca (Coristanco) y Carballo (Galipedia). En OSM figura también como «A Ponte Vella». La casa no lo cuenta en Instagram: va a pendientes.',
    lugarFuente: 'Galipedia, «Ponte Lubiáns»; OSM',
    distancia: { casa: null },
    foto: { hab: 'lg-ponte-lubians-hab', lugar: null },
    bow: 0.24, glifo: 'puente', lado: ['derAba', 'der', 'abajo', 'izqAba'],
  },
  {
    id: 'fervenza-de-san-paio', habitacion: 'Fervenza de San Paio', edificio: 'casa', dato: 'Casa grande · dos camas de 90 cm',
    tipoLugar: 'cascada', lugar: 'Fervenza de San Paio',
    osm: { tipo: 'node', id: 2723719421, nota: 'OSM node 2723719421, waterway=waterfall «Fervenza de San Paio» (alt. «Fervenza de Entrecruces»), wikidata Q25512158' },
    casaDice: [
      { t: 'dos camas de 0.90 cm, en su transformación picamos la pared que tiene de piedra, pintamos en un color neutro y le dimos un toque con muebles antiguos y restaurados', ig: 99, fecha: '2020-08-10' },
      { t: 'tiene una ducha y una bañera retro que no me puede gustar más', ig: 110, fecha: '2020-07-13', nota: 'el baño' },
    ],
    lugarDice: 'La fervenza de Entrecruces, «tamén coñecida como […] fervenza de San Paio», está en la parroquia de Entrecruces (Carballo), en el río Outón, cerca de su desembocadura en el río Grande (Galipedia). La casa la enseña como «Fervenza de Entrecruces» (IG 76).',
    lugarFuente: 'Galipedia, «Fervenza de Entrecruces»; OSM; IG 76',
    distancia: { casa: null },
    foto: { hab: 'lg-fervenza-de-san-paio-hab', lugar: 'lg-fervenza-de-san-paio-lugar' },
    bow: -0.2, glifo: 'cascada', lado: ['izq', 'abajo', 'der'],
  },
  {
    id: 'razo', habitacion: 'Razo', edificio: 'casita', dato: 'Casita de la piscina · cama de 1,50',
    tipoLugar: 'playa', lugar: 'Praia de Razo',
    osm: { tipo: 'way', id: 39473257, nota: 'OSM way 39473257, natural=beach «Praia de Razo» (centro del polígono)' },
    casaDice: [
      { t: 'sencilla, cálida, con luz natural y unas vistas al jardín y a la piscina', ig: 50, fecha: '2021-07-06' },
      { t: 'cama de 1.50, TV, calefacción', ig: 85, fecha: '2020-09-11' },
    ],
    lugarDice: 'Playa abierta de 1.300 m, casi unida a la de Baldaio (OSM). «Precioso día para visitar la playa de Razo, muy cerquita de Casa Entremuros», dice la casa (IG 189, 2017).',
    lugarFuente: 'OSM; IG 189',
    distancia: { casa: 'a 15 minutos en coche', casaFuente: 'web antigua de la casa: «Razo y Baldaio a quince minutos»' },
    foto: { hab: 'lg-razo-hab', lugar: 'lg-razo-lugar' },
    bow: -0.12, glifo: 'playa', lado: ['izqArr', 'izq', 'arribaIzq'],
  },
  {
    id: 'baldaio', habitacion: 'Baldaio', edificio: 'casita', dato: 'Casita de la piscina',
    tipoLugar: 'playa', lugar: 'Praia de Baldaio',
    osm: { tipo: 'way', id: 303157404, nota: 'OSM way 303157404, natural=beach «Praia de Baldaio - As Saíñas» (centro del polígono)' },
    casaDice: [
      { t: 'la habitación Baldaio que está en la casita de la piscina', ig: 135, fecha: '2019-06-28' },
    ],
    lugarDice: 'Playa abierta de 3.600 m de arena fina, con un gran complejo dunar y laguna (OSM). La casa no ha publicado fotos de esta playa: va a pendientes.',
    lugarFuente: 'OSM',
    distancia: { casa: 'a 15 minutos en coche', casaFuente: 'web antigua de la casa: «Razo y Baldaio a quince minutos»' },
    foto: { hab: 'lg-baldaio-hab', lugar: null },
    bow: 0.12, glifo: 'playa', lado: ['derArr', 'der', 'arriba'],
  },
];

const nCoord = (id) => {
  const todos = elementos('lugares');
  return todos.find((e) => e.id === id);
};

function datosLugares() {
  const todos = elementos('lugares');
  const por = (tipo, id) => todos.find((e) => e.type === tipo && e.id === id);
  const centro = (e) => (e.center ? [e.center.lat, e.center.lon] : [e.lat, e.lon]);
  const res = {};
  res['refuxo-de-verdes'] = centro(por('way', 96730657));
  res['ponte-lubians'] = centro(por('way', 368154510));
  res['fervenza-de-san-paio'] = centro(por('node', 2723719421));
  res['razo'] = centro(por('way', 39473257));
  res['baldaio'] = centro(por('way', 303157404));
  /* el río: el punto del Anllóns más cercano a la casa (sobre los segmentos) */
  const k = 111.32, cl = Math.cos((CASA.lat * Math.PI) / 180);
  const xy = (p) => [(p[1] - CASA.lon) * k * cl, (p[0] - CASA.lat) * k];
  let mejor = [1e9, null];
  for (const w of [...elementos('anllons'), ...elementos('rios').filter((q) => /Anll[oó]ns/.test(q.tags.name || ''))]) for (const t of trozos(w)) for (let i = 0; i < t.length - 1; i++) {
    const [ax, ay] = xy(t[i]), [bx, by] = xy(t[i + 1]), dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-9;
    const u = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)), d = Math.hypot(ax + u * dx, ay + u * dy);
    if (d < mejor[0]) mejor = [d, [t[i][0] + (t[i + 1][0] - t[i][0]) * u, t[i][1] + (t[i + 1][1] - t[i][1]) * u]];
  }
  res['rio-anllons'] = mejor[1];
  return res;
}

async function distancias(coords) {
  const f = path.join(OSM, 'rutas.json');
  const cache = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
  for (const h of HABITACIONES) {
    if (h.distancia.solo_recta || cache[h.id]) continue;
    const [lat, lon] = coords[h.id];
    const r = await ruta(CASA, { lat, lon });
    if (r) cache[h.id] = { km: +r.km.toFixed(2), min: +r.min.toFixed(1), fecha: new Date().toISOString().slice(0, 10) };
    await new Promise((ok) => setTimeout(ok, 1200));
  }
  fs.writeFileSync(f, JSON.stringify(cache, null, 1));
  return cache;
}

const coma = (n, d = 1) => n.toFixed(d).replace('.', ',');

/* ------------------------------------------------------------------ 4. rótulos: sitio sin choques ------------------------------------------------------------------ */
/* Tamaños (en unidades de la lámina) con los que se comprueban los choques: los de la lámina más pequeña (el móvil, k ≈ 0,32). */
const TAM = { lugar: 33, casa: 36, pob: 31, mar: 28, sec: 20 };
const ANCHO_CAR = 0.56;

function caja(x, y, anchor, texto, size, tracking = 0) {
  const w = texto.length * (size * ANCHO_CAR + tracking), h = size;
  const x0 = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
  return { x0, y0: y - h * 0.8, x1: x0 + w, y1: y + h * 0.25 };
}
const choca = (a, b, m = 3) => !(a.x1 + m < b.x0 || b.x1 + m < a.x0 || a.y1 + m < b.y0 || b.y1 + m < a.y0);

/* ------------------------------------------------------------------ 5. construir ------------------------------------------------------------------ */
export async function construirMapa() {
  fs.mkdirSync(SAL, { recursive: true });
  const costa = unir(elementos('costa').flatMap(trozos), true).map((ch) => ch.map((q) => proy(...q)));
  const casaXY = proy(CASA.lat, CASA.lon);
  const { mar, pared, aceptadas, rechazadas, semillas } = mascaraMar(costa, casaXY);
  let nmar = 0; for (let i = 0; i < mar.length; i++) nmar += mar[i];
  console.log(`  mar: ${aceptadas} regiones aceptadas, ${rechazadas} rechazadas (de ${semillas} semillas); ${(100 * nmar / mar.length).toFixed(1)} % de la lámina es mar`);
  const dm = edt(pared);
  const campo = new Float32Array(NX * NY); for (let i = 0; i < campo.length; i++) campo[i] = mar[i] ? dm[i] : -1;
  const base = construirBase({ costa, mar, campo });
  const ry = rosaYEscala();

  /* papel de lino: trama fina de hilos y motas de fibra */
  const defs = `<defs>
<filter id="tinta" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
 <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="11" result="r"/>
 <feDisplacementMap in="SourceGraphic" in2="r" scale="1.5" xChannelSelector="R" yChannelSelector="G" result="d"/>
 <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="4" result="m"/>
 <feColorMatrix in="m" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.7" result="mm"/>
 <feComposite in="d" in2="mm" operator="in"/>
</filter>
<filter id="fibra" x="0" y="0" width="100%" height="100%">
 <feTurbulence type="fractalNoise" baseFrequency="0.55 0.9" numOctaves="3" seed="2" result="n"/>
 <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.38  0 0 0 0 0.28  0 0 0 0.9 -0.34"/>
</filter>
<pattern id="trama" width="3" height="3" patternUnits="userSpaceOnUse">
 <path d="M0 .5H3" stroke="#7a6a50" stroke-opacity=".10" stroke-width=".5"/><path d="M.5 0V3" stroke="#7a6a50" stroke-opacity=".09" stroke-width=".5"/>
</pattern>
<radialGradient id="vineta" cx="50%" cy="50%" r="75%"><stop offset="55%" stop-color="#8a7452" stop-opacity="0"/><stop offset="100%" stop-color="#8a7452" stop-opacity=".22"/></radialGradient>
<clipPath id="marco"><rect x="${MARCO + 1}" y="${MARCO + 1}" width="${W - 2 * MARCO - 2}" height="${H - 2 * MARCO - 2}"/></clipPath>
</defs>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
${defs}
<rect width="${W}" height="${H}" fill="${PAPEL}"/>
<rect width="${W}" height="${H}" fill="url(#trama)"/>
<rect width="${W}" height="${H}" filter="url(#fibra)" opacity=".5"/>
<rect width="${W}" height="${H}" fill="url(#vineta)"/>
<g clip-path="url(#marco)"><g filter="url(#tinta)">
${base}
${ry.svg}
</g></g>
${marcoYPapel()}
</svg>`;
  fs.writeFileSync(path.join(SAL, 'mapa.svg'), svg);
  console.log(`  mapa.svg ${(svg.length / 1024).toFixed(0)} KB`);

  /* ---- los seis lugares ---- */
  const coords = datosLugares();
  const rutas = await distancias(coords);
  const fotos = JSON.parse(fs.readFileSync(path.join(SAL, 'fotos.json'), 'utf8'));
  const placed = [];                                    // cajas ocupadas
  const marcadores = [];
  const casaP = casaXY;
  const lugares = [];
  const lineas = [];

  for (const h of HABITACIONES) {
    const [lat, lon] = coords[h.id];
    const [x, y] = proy(lat, lon);
    const recta = dist(CASA, { lat, lon });
    const r = rutas[h.id];
    /* la línea: un arco con temblor de pluma */
    const dx = x - casaP[0], dy = y - casaP[1], L = Math.hypot(dx, dy);
    const nx = -dy / L, ny = dx / L, mid = [(casaP[0] + x) / 2 + nx * h.bow * L, (casaP[1] + y) / 2 + ny * h.bow * L];
    const pts = []; const N = 30;
    for (let i = 0; i <= N; i++) { const t = i / N; pts.push([(1 - t) * (1 - t) * casaP[0] + 2 * (1 - t) * t * mid[0] + t * t * x, (1 - t) * (1 - t) * casaP[1] + 2 * (1 - t) * t * mid[1] + t * t * y]); }
    const rr = semilla(h.id.length * 131 + 9);
    const tem = temblar(pts, rr, 1.3, 26);
    tem[0] = [casaP[0], casaP[1] - 2]; tem[tem.length - 1] = [x, y];
    const tem2 = temblar(pts, semilla(h.id.length * 17 + 3), 1.6, 19);
    tem2[0] = [casaP[0] + 1, casaP[1] - 2]; tem2[tem2.length - 1] = [x + 0.6, y + 0.5];
    lineas.push({ id: h.id, pts: tem });
    marcadores.push({ x0: x - 14, y0: y - 26, x1: x + 14, y1: y + 3 });

    let distancia;
    if (h.distancia.solo_recta) {
      distancia = { texto: `a unos ${coma(recta)} km en línea recta`, detalle: 'Hasta el punto del río más cercano a la casa; la línea recta se mide desde el núcleo de Cances Grande (OSM). El río no es un punto.', rectaKm: +recta.toFixed(2), carreteraKm: null, carreteraMin: null, casa: null };
    } else if (h.distancia.casa) {
      distancia = { texto: h.distancia.casa, detalle: `Lo dice la casa (${h.distancia.casaFuente}). Por carretera son ${coma(r.km)} km según OSRM (${coma(recta)} km en línea recta), medidos desde el núcleo de Cances Grande.`, rectaKm: +recta.toFixed(2), carreteraKm: r.km, carreteraMin: Math.round(r.min), casa: h.distancia.casaFuente };
    } else {
      distancia = { texto: `a unos ${coma(r.km)} km por carretera`, detalle: `Unos ${Math.round(r.min)} minutos en coche según OSRM (calculado, no medido), desde el núcleo de Cances Grande; ${coma(recta)} km en línea recta.`, rectaKm: +recta.toFixed(2), carreteraKm: r.km, carreteraMin: Math.round(r.min), casa: null };
    }
    const f = (n) => (n && fotos[n] ? { nombre: n, ...fotos[n] } : null);
    lugares.push({
      id: h.id, habitacion: h.habitacion, edificio: h.edificio, dato: h.dato, tipoLugar: h.tipoLugar, lugar: h.lugar,
      lat: +lat.toFixed(6), lon: +lon.toFixed(6), osm: h.osm, casaDice: h.casaDice, lugarDice: h.lugarDice, lugarFuente: h.lugarFuente,
      distancia, foto: { hab: f(h.foto.hab), lugar: f(h.foto.lugar) }, pendiente: h.pendiente || null,
      lamina: { x: +x.toFixed(1), y: +y.toFixed(1), glifo: h.glifo, linea: aPath(tem), linea2: aPath(tem2), etiqueta: null },
      _lado: h.lado,
    });
  }

  /* rótulos con sitio: primero los de los lugares y la casa (los que no pueden faltar), luego el resto */
  const rotulos = [];
  const lineaPts = lineas.flatMap((l) => l.pts);
  const libre = (b) => b.x0 > MARCO + 6 && b.x1 < W - MARCO - 6 && b.y0 > MARCO + 6 && b.y1 < H - MARCO - 6
    && !placed.some((p) => choca(p, b)) && !marcadores.some((p) => choca(p, b, 1))
    && !lineaPts.some((p) => p[0] > b.x0 - 3 && p[0] < b.x1 + 3 && p[1] > b.y0 - 3 && p[1] < b.y1 + 3);
  const ponerRotulo = (r, cands, size, tracking = 0) => {
    for (const [ox, oy, anchor] of cands) {
      const x = r.x + ox, y = r.y + oy, b = caja(x, y, anchor, r.t, size, tracking);
      if (libre(b)) { placed.push(b); return { ...r, x: +x.toFixed(1), y: +y.toFixed(1), anchor }; }
    }
    return null;
  };
  /* casa: su marcador (una casita de ~34 × 26 unidades sobre el punto) y su rótulo */
  marcadores.push({ x0: casaP[0] - 22, y0: casaP[1] - 36, x1: casaP[0] + 22, y1: casaP[1] + 4 });
  const rc = ponerRotulo({ t: 'Casa Entremuros', x: casaP[0], y: casaP[1], clase: 'casa' }, [[-26, -14, 'end'], [26, -14, 'start'], [0, 24, 'middle'], [-26, 12, 'end']], TAM.casa);
  if (rc) rotulos.push(rc); else console.warn('  ! no cabe el rótulo de la casa');
  if (rc) { const sx = rc.x, sy = rc.y + 23; placed.push(caja(sx, sy, rc.anchor, 'Cances Grande', TAM.sec)); rotulos.push({ t: 'Cances Grande', x: sx, y: sy, clase: 'sec', anchor: rc.anchor }); }
  for (const l of lugares) {
    const cand = [];
    const lado = { izq: [-17, -5, 'end'], der: [17, -5, 'start'], abajo: [0, 22, 'middle'], arriba: [0, -32, 'middle'], izqArr: [-16, -18, 'end'], derArr: [16, -18, 'start'], izqAba: [-16, 16, 'end'], izqAba2: [-18, 36, 'end'], derAba: [16, 16, 'start'], arribaIzq: [-6, -34, 'end'], arribaDer: [6, -34, 'start'] };
    for (const d of [...l._lado, 'izq', 'der', 'abajo', 'arriba']) cand.push(lado[d]);
    const nombre = l.habitacion;
    const r = ponerRotulo({ t: nombre, x: l.lamina.x, y: l.lamina.y, clase: 'lugar', id: l.id }, cand, TAM.lugar);
    if (!r) console.warn('  ! no cabe el rótulo de ' + nombre);
    else { l.lamina.etiqueta = { t: r.t, x: r.x, y: r.y, anchor: r.anchor }; rotulos.push({ ...r }); }
    delete l._lado;
  }

  /* el resto: poblaciones, mar y títulos */
  const nuc = elementos('nucleos');
  const pos = (nom) => { const e = nuc.find((q) => q.tags.name === nom); return e ? proy(e.lat, e.lon) : null; };
  const extra = [
    ['Carballo', 'pob', pos('Carballo'), [[0, 42, 'middle'], [26, 6, 'start'], [-26, 6, 'end']], 'esencial'],
    ['Malpica', 'pob', pos('Malpica'), [[0, 36, 'middle'], [18, 8, 'start'], [-18, 8, 'end']], 'esencial'],
    ['Ponteceso', 'pob', pos('Ponteceso'), [[0, -20, 'middle'], [16, 14, 'start']], ''],
    ['San Roque', 'pob', pos('San Roque'), [[-14, 18, 'end'], [16, 18, 'start']], ''],
    ['Zas', 'pob', pos('Zas'), [[14, 6, 'start']], ''],
    ['Buño', 'sec', pos('Buño'), [[14, 6, 'start'], [-14, 6, 'end']], ''],
  ];
  for (const [t, clase, p, cands, esencial] of extra) {
    if (!p) { console.warn('  ! sin núcleo ' + t); continue; }
    const r = ponerRotulo({ t, x: p[0], y: p[1], clase, esencial: !!esencial }, cands, TAM[clase]);
    if (r) rotulos.push(r); else console.warn('  ! no cabe ' + t);
  }
  const fijos = [
    { t: 'OCÉANO ATLÁNTICO', x: 700, y: 62, clase: 'mar', anchor: 'middle', tracking: 5, rot: -2 },
    { t: 'Illas Sisargas', x: 322, y: 46, clase: 'agua', anchor: 'start' },
    { t: 'Ría de Corme e Laxe', x: 26, y: 598, clase: 'agua', anchor: 'start' },
    { t: 'COSTA DA MORTE', x: 760, y: 130, clase: 'mar', anchor: 'middle', tracking: 4, rot: -4 },
    { t: 'Lagoa de Baldaio', x: 770, y: 330, clase: 'agua', anchor: 'start' },
  ];
  for (const r of fijos) {
    const b = caja(r.x, r.y, r.anchor, r.t, TAM[r.clase === 'agua' ? 'sec' : 'mar'], r.tracking || 0);
    if (libre(b) || r.clase === 'mar') { placed.push(b); rotulos.push(r); } else console.warn('  ! rótulo fijo en choque: ' + r.t);
  }
  rotulos.push({ t: 'Bergantiños', x: 40, y: 78, clase: 'titulo', anchor: 'start' });
  rotulos.push({ t: 'a pluma, desde la casa', x: 42, y: 108, clase: 'subtitulo', anchor: 'start' });
  rotulos.push({ t: 'N', x: ry.rosa.cx, y: ry.rosa.cy - ry.rosa.R - 6, clase: 'sec', anchor: 'middle' });
  rotulos.push({ t: '0 · 2,5 · 5 km', x: ry.escala.x0 + ry.escala.u5 / 2, y: ry.escala.y0 - 12, clase: 'sec', anchor: 'middle' });
  rotulos.push({ t: '© colaboradores de OpenStreetMap (ODbL)', x: 32, y: H - 28, clase: 'cred', anchor: 'start' });

  const json = {
    version: 1, generado: new Date().toISOString().slice(0, 10),
    origen: { ...CASA, nota: 'Las distancias salen de aquí: del lugar «Cances Grande» de OSM, no de la casa (el punto exacto está pendiente).' },
    atribucion: '© colaboradores de OpenStreetMap (ODbL). Rutas: OSRM (routing.openstreetmap.de, perfil coche). Textos de lugares: Galipedia (CC BY-SA).',
    lamina: { ancho: W, alto: H, caja: CAJA, kmPorUnidad: +(1 / G.U).toFixed(5), casa: { x: +casaP[0].toFixed(1), y: +casaP[1].toFixed(1) }, rosa: ry.rosa, escala: ry.escala, rotulos },
    notas: {
      adaptada: 'En la casita de la piscina, una de las dos habitaciones está adaptada para movilidad reducida. La casa lo dice de Razo (IG 85) y de Baldaio (IG 135), así que no se señala cuál: por confirmar.',
      distancias: 'Las distancias por carretera están calculadas con OSRM desde el núcleo de Cances Grande, no medidas. Donde la casa da su propio tiempo, manda el de la casa.',
    },
    lugares,
  };
  fs.writeFileSync(path.join(SAL, 'lugares.json'), JSON.stringify(json, null, 1));
  console.log(`  lugares.json ${(JSON.stringify(json).length / 1024).toFixed(0)} KB`);
  await escribirRespaldoYDemo(json);
}

/* ------------------------------------------------------------------ 6. respaldo y demo ------------------------------------------------------------------ */
const mes = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fechaCorta = (s) => { const [a, m] = s.split('-'); return `${mes[+m - 1]} ${a}`; };
export function pictureHtml(foto, sizes, ruta = 'img/lugares/', cls = '', eager = false) {
  if (!foto) return '';
  const set = (ext) => foto.anchos.map((a) => `${ruta}${foto.nombre}-${a}.${ext} ${a}w`).join(', ');
  return `<picture${cls ? ` class="${cls}"` : ''}><source type="image/avif" srcset="${set('avif')}" sizes="${sizes}"><source type="image/webp" srcset="${set('webp')}" sizes="${sizes}"><img src="${ruta}${foto.nombre}-${foto.ancho}.jpg" srcset="${set('jpg')}" sizes="${sizes}" width="${foto.ancho}" height="${foto.alto}" alt="${esc(foto.alt)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async"></picture>`;
}
async function escribirRespaldoYDemo(json) {
  /* respaldo: para pegar en index.src.html dentro de <div data-modulo="lugares">; las rutas cuelgan de la raíz de la web */
  const li = json.lugares.map((l) => `    <li class="lg-resp-item" data-lugar="${l.id}">
      <figure>${pictureHtml(l.foto.hab, '(max-width: 700px) 92vw, 380px')}<figcaption>${l.foto.hab?.soloRotulo ? 'Solo el rótulo de la puerta: falta la foto de la habitación.' : ''}</figcaption></figure>
      <h3>${esc(l.habitacion)}</h3>
      <p class="lg-resp-dato">${esc(l.dato)} · ${esc(l.tipoLugar)}: ${esc(l.lugar)}</p>
      ${l.casaDice.slice(0, 1).map((c) => `<blockquote>«${esc(c.t)}» <cite>IG ${c.ig} · ${fechaCorta(c.fecha)}</cite></blockquote>`).join('')}
      <p class="lg-resp-dist">${esc(l.distancia.texto)}</p>
    </li>`).join('\n');
  const resp = `<!-- Respaldo de «Seis lugares bajo un techo»: lo generó scripts/lugares.mjs; se queda si el JS falla. -->
<ul class="lg-resp" data-respaldo="lugares">
${li}
</ul>
<p class="lg-resp-nota">${esc(json.notas.adaptada)} ${esc(json.notas.distancias)} Mapa y datos: ${esc(json.atribucion)}</p>
`;
  fs.writeFileSync(path.join(SAL, 'respaldo.html'), resp);

  const demo = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Demo · Seis lugares bajo un techo</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600&family=Hedvig+Letters+Serif&display=swap">
<link rel="stylesheet" href="../css/estilos.css" onerror="this.remove()">
<link rel="stylesheet" href="../css/lugares.css">
<style>
  /* solo el andamio de la demo; la sección real la escribe la web en index.src.html */
  :root { --lino: #F3EEE5; --tinta: #2B2823; }
  html { scroll-behavior: auto; }
  body { margin: 0; background: var(--lino, #F3EEE5); color: var(--tinta, #2B2823); font: 400 1rem/1.55 var(--f-texto, 'Golos Text', system-ui, sans-serif); }
  .demo-barra { position: fixed; top: 0; left: 0; right: 0; z-index: 50; height: 48px; display: flex; align-items: center; gap: 14px; padding: 0 16px; background: rgba(243,238,229,.94); border-bottom: 1px solid rgba(43,40,35,.18); font-size: .8rem; }
  .demo-barra a { color: inherit; }
  .relleno { min-height: 260svh; display: grid; place-items: center; font-size: .8rem; letter-spacing: .14em; text-transform: uppercase; color: #5E574D; }
  .sec-demo { padding: 72px 16px 40px; max-width: 1240px; margin: 0 auto; }
  .sec-demo h2 { font: 400 clamp(2rem, 5vw, 3.4rem)/1.05 var(--f-titulo, 'Hedvig Letters Serif', Georgia, serif); margin: 0 0 1rem; }
</style>
</head>
<body>
<header class="demo-barra"><b>Seis lugares bajo un techo</b> <a href="?">con movimiento</a> <a href="?sobria">sobria</a> <a href="?quieto">quieto</a></header>
<div class="relleno" id="antes">Antes · la casa</div>
<main>
  <section id="habitaciones" class="sec-demo" aria-labelledby="lug-tit">
    <h2 id="lug-tit">Seis lugares bajo un techo</h2>
    <div data-modulo="lugares">
${resp.split('\n').map((s) => '      ' + s.replace(/(src|srcset)="img\//g, '$1="../img/').replace(/, img\//g, ', ../img/')).join('\n')}
    </div>
  </section>
</main>
<div class="relleno" id="despues">Después · reservar</div>
<script src="../js/lugares.js"></script>
<script>
  (function () {
    var q = location.search, el = document.querySelector('[data-modulo="lugares"]');
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.__lg = window.Entremuros.lugares.montar(el, { movimiento: !/quieto/.test(q) && !reduce, densidad: /sobria/.test(q) ? 'sobria' : 'mesa' });
  })();
</script>
</body>
</html>
`;
  fs.mkdirSync(path.join(RAIZ, 'pruebas'), { recursive: true });
  fs.writeFileSync(path.join(RAIZ, 'pruebas/lugares-demo.html'), demo);
  console.log('  respaldo.html y pruebas/lugares-demo.html');
}

if (path.basename(process.argv[1] || '') === 'lugares-mapa.mjs') await construirMapa();
