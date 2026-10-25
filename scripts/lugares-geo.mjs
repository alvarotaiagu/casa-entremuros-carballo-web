/* Geometría común de «Seis lugares»: lectura de la caché de OSM, proyección a la lámina, ensamblado de cadenas,
   simplificación y un ruido con semilla fija (la misma lámina siempre). Lo usan lugares-mapa.mjs y las pruebas. */
import fs from 'node:fs';
import path from 'node:path';
import { OSM, CAJA } from './lugares-comun.mjs';

export const leer = (n) => JSON.parse(fs.readFileSync(path.join(OSM, n + '.json'), 'utf8'));
export const elementos = (n) => leer(n).elementos;

/* ------------------------------------------------ proyección (equirrectangular, sobra a esta escala) ------------------------------------------------ */
const KM = 111.32;
export const LAT0 = (CAJA.S + CAJA.N) / 2;
const COS = Math.cos((LAT0 * Math.PI) / 180);
export const ANCHO_KM = (CAJA.E - CAJA.W) * KM * COS;
export const ALTO_KM = (CAJA.N - CAJA.S) * KM;
export const W = 1000;                       // ancho del viewBox
export const U = W / ANCHO_KM;               // unidades por kilómetro
export const H = Math.round(ALTO_KM * U);    // alto del viewBox
export const proy = (lat, lon) => [(lon - CAJA.W) * KM * COS * U, (CAJA.N - lat) * KM * U];
export const desproy = (x, y) => [CAJA.N - y / (KM * U), CAJA.W + x / (KM * COS * U)];
/* distancia en línea recta entre dos puntos {lat, lon}, en km */
export const dist = (a, b) => Math.hypot((a.lon - b.lon) * KM * COS, (a.lat - b.lat) * KM);

/* ------------------------------------------------ cadenas ------------------------------------------------ */
/* Una vía de Overpass con `out geom (caja)` trae null donde sale de la caja: se parte en trozos. */
export function trozos(w) {
  const sal = []; let cur = [];
  for (const p of w.geometry || []) {
    if (!p) { if (cur.length > 1) sal.push(cur); cur = []; } else cur.push([p.lat, p.lon]);
  }
  if (cur.length > 1) sal.push(cur);
  return sal;
}
const clave = (p) => p[0].toFixed(6) + ',' + p[1].toFixed(6);

/* Une trozos que comparten extremo (misma orientación o no) en cadenas largas. `orientada`: la costa va con la tierra a la
   izquierda, así que solo se une en el sentido de la vía y no se invierte nada. */
export function unir(lista, orientada) {
  const cadenas = lista.map((l) => l.slice());
  let cambio = true;
  while (cambio) {
    cambio = false;
    const porInicio = new Map();
    cadenas.forEach((c, i) => { if (c) porInicio.set(clave(c[0]), i); });
    for (let i = 0; i < cadenas.length; i++) {
      const c = cadenas[i]; if (!c) continue;
      const j = porInicio.get(clave(c[c.length - 1]));
      if (j !== undefined && j !== i && cadenas[j]) {
        cadenas[i] = c.concat(cadenas[j].slice(1)); cadenas[j] = null; cambio = true; break;
      }
    }
    if (!orientada && !cambio) {
      /* sin orientación: probar a invertir */
      for (let i = 0; i < cadenas.length && !cambio; i++) {
        const c = cadenas[i]; if (!c) continue;
        for (let j = 0; j < cadenas.length; j++) {
          const d = cadenas[j]; if (!d || j === i) continue;
          if (clave(c[c.length - 1]) === clave(d[d.length - 1])) { cadenas[i] = c.concat(d.slice(0, -1).reverse()); cadenas[j] = null; cambio = true; break; }
          if (clave(c[0]) === clave(d[0])) { cadenas[i] = d.slice(1).reverse().concat(c); cadenas[j] = null; cambio = true; break; }
          if (clave(c[0]) === clave(d[d.length - 1])) { cadenas[i] = d.concat(c.slice(1)); cadenas[j] = null; cambio = true; break; }
        }
      }
    }
  }
  return cadenas.filter(Boolean);
}

/* Douglas-Peucker en unidades de lámina */
export function simplificar(pts, eps) {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  (function rec(a, b) {
    let dm = 0, im = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      let d;
      if (l2 === 0) d = Math.hypot(px - ax, py - ay);
      else { const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)); d = Math.hypot(px - ax - t * dx, py - ay - t * dy); }
      if (d > dm) { dm = d; im = i; }
    }
    if (dm > eps) { rec(a, im); out.push(pts[im]); rec(im, b); }
  })(0, pts.length - 1);
  out.push(pts[pts.length - 1]);
  return out;
}
export const largo = (pts) => { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; };

/* Chaikin: suaviza una polilínea (la pluma no hace ángulos de ordenador) */
export function chaikin(pts, vueltas = 1, cerrada = false) {
  let p = pts;
  for (let v = 0; v < vueltas; v++) {
    const q = [];
    if (!cerrada) q.push(p[0]);
    for (let i = 0; i < p.length - (cerrada ? 0 : 1); i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      q.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
    }
    if (!cerrada) q.push(p[p.length - 1]);
    p = q;
  }
  return p;
}

/* ------------------------------------------------ azar con semilla ------------------------------------------------ */
export function semilla(s) {
  let a = s >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/* ruido de valor 1D suave (para el temblor de la mano a lo largo de una línea) */
export function ruido1(rnd) {
  const tabla = Array.from({ length: 256 }, () => rnd() * 2 - 1);
  return (x) => { const i = Math.floor(x), f = x - i, t = f * f * (3 - 2 * f); return tabla[i & 255] * (1 - t) + tabla[(i + 1) & 255] * t; };
}

/* Temblor de pluma: desplaza cada punto, a lo largo de la normal, con un ruido suave de longitud de onda `onda` y amplitud `amp`. */
export function temblar(pts, rnd, amp = 0.9, onda = 14) {
  const n1 = ruido1(rnd), n2 = ruido1(rnd);
  const out = []; let s = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const d = n1(s / onda) * amp + n2(s / (onda * 0.37)) * amp * 0.35;
    out.push([pts[i][0] - dy * d, pts[i][1] + dx * d]);
  }
  return out;
}

/* ------------------------------------------------ cadenas a path ------------------------------------------------ */
const f1 = (v) => (Math.round(v * 10) / 10).toString();
export function aPath(pts, suave = true) {
  if (pts.length < 2) return '';
  if (!suave || pts.length < 3) return 'M' + pts.map((p) => f1(p[0]) + ' ' + f1(p[1])).join('L');
  /* Catmull-Rom -> Bézier cúbica */
  let d = 'M' + f1(pts[0][0]) + ' ' + f1(pts[0][1]);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += 'C' + f1(c1[0]) + ' ' + f1(c1[1]) + ' ' + f1(c2[0]) + ' ' + f1(c2[1]) + ' ' + f1(p2[0]) + ' ' + f1(p2[1]);
  }
  return d;
}
