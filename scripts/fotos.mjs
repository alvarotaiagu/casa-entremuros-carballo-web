/* Prepara las fotos de la web desde las del Instagram de la casa (ref/fotos/instagram).
   Uso: node scripts/fotos.mjs                 (todas)
        node scripts/fotos.mjs cocina salon    (solo esas; el resto de fotos.json se conserva)
   - Lista: scripts/fotos-lista.json. Cada foto lleva `nombre` (el de salida) y `codigo` ("NNNN_k":
     NNNN = numero del post en ref/raw/ig/ig-indice.json, k = posicion en el carrusel; ver ref/FOTOS.md).
     Opciones: `recorte` {left,top,width,height} en pixeles del original, `interior` (medio balance de
     blancos «mundo gris»), `fuerza` (0-1, suaviza la gradacion), `suave` (sin afinar), `maxAncho`,
     `aq`/`wq` (calidad AVIF/WebP).
   - Gradacion comun para que parezcan de la misma sesion (vienen de moviles de 2015-2026 y de
     recompresiones de Instagram): menos saturacion general, aun menos en el verde de cesped y el
     fucsia, negros mas suaves.
   - NUNCA amplia: anchos 480, 800, 1024 y 1280 solo si caben, mas el ancho propio.
   - Escribe img/fotos/<nombre>-<ancho>.{avif,webp,jpg} e img/fotos/fotos.json
     ({nombre, codigo, nota, anchos, ancho, alto, origen, origenAncho, origenAlto, recorte}).
     fotos.json es el INDICE para los demas agentes: se busca por `nombre` o por `codigo`. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const sharp = require('sharp');

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const REF = path.join(RAIZ, 'ref');
const IG = path.join(REF, 'fotos/instagram');
const SALIDA = path.join(RAIZ, 'img/fotos');
fs.mkdirSync(SALIDA, { recursive: true });

const FOTOS = JSON.parse(fs.readFileSync(path.join(RAIZ, 'scripts/fotos-lista.json'), 'utf8'));
const ANCHOS = [480, 800, 1024, 1280];
const solo = process.argv.slice(2);
const ficherosIG = fs.readdirSync(IG);

function resolver(codigo) {
  const [n, k] = codigo.split('_');
  const f = ficherosIG.find((x) => x.startsWith(n + '_') && x.endsWith('_' + k + '.jpg'));
  if (!f) throw new Error('No hay foto para ' + codigo);
  return path.join(IG, f);
}

function peso(h, centro, ancho) {
  let d = Math.abs(h - centro); if (d > 180) d = 360 - d;
  return d >= ancho ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * d / ancho);
}

function gradar(data, canales, interior, fuerza = 1) {
  if (fuerza <= 0) return data;
  const n = data.length / canales;
  let gr = 1, gg = 1, gb = 1;
  if (interior) {
    let sr = 0, sg = 0, sb = 0;
    for (let i = 0; i < data.length; i += canales) { sr += data[i]; sg += data[i + 1]; sb += data[i + 2]; }
    const mr = sr / n, mg = sg / n, mb = sb / n, mm = (mr + mg + mb) / 3;
    gr = 1 + 0.4 * (mm / mr - 1); gg = 1 + 0.4 * (mm / mg - 1); gb = 1 + 0.4 * (mm / mb - 1);
  }
  const LEVANTE = 0.035;
  for (let i = 0; i < data.length; i += canales) {
    let r = Math.min(1, data[i] * gr / 255), g = Math.min(1, data[i + 1] * gg / 255), b = Math.min(1, data[i + 2] * gb / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), c = max - min;
    let h = 0;
    if (c > 0) {
      if (max === r) h = 60 * (((g - b) / c) % 6);
      else if (max === g) h = 60 * ((b - r) / c + 2);
      else h = 60 * ((r - g) / c + 4);
      if (h < 0) h += 360;
    }
    let s = max === 0 ? 0 : c / max;
    const v = max;
    // menos saturacion general; aun menos en el verde de cesped (~100) y el fucsia (~330)
    s *= 0.93 * (1 - 0.2 * peso(h, 100, 50) - 0.14 * peso(h, 330, 30));
    const cc = v * s, x = cc * (1 - Math.abs(((h / 60) % 2) - 1)), m0 = v - cc;
    let rr, gg2, bb;
    if (h < 60) [rr, gg2, bb] = [cc, x, 0];
    else if (h < 120) [rr, gg2, bb] = [x, cc, 0];
    else if (h < 180) [rr, gg2, bb] = [0, cc, x];
    else if (h < 240) [rr, gg2, bb] = [0, x, cc];
    else if (h < 300) [rr, gg2, bb] = [x, 0, cc];
    else [rr, gg2, bb] = [cc, 0, x];
    r = rr + m0; g = gg2 + m0; b = bb + m0;
    const curva = (t) => LEVANTE + (1 - LEVANTE - 0.02) * t;
    r = curva(r); g = curva(g); b = curva(b);
    const o0 = data[i], o1 = data[i + 1], o2 = data[i + 2];
    data[i] = Math.round(o0 + (r * 255 - o0) * fuerza); data[i + 1] = Math.round(o1 + (g * 255 - o1) * fuerza); data[i + 2] = Math.round(o2 + (b * 255 - o2) * fuerza);
  }
  return data;
}

const previo = fs.existsSync(path.join(SALIDA, 'fotos.json')) ? JSON.parse(fs.readFileSync(path.join(SALIDA, 'fotos.json'), 'utf8')) : [];
const rehacer = process.argv.includes('--rehacer');
const nombres = solo.filter((x) => !x.startsWith('--'));
const hechas = new Map(previo.map((x) => [x.nombre, x]));
const resultado = new Map();
const guardar = () => fs.writeFileSync(path.join(SALIDA, 'fotos.json'), JSON.stringify(FOTOS.map((f) => resultado.get(f.nombre) || hechas.get(f.nombre)).filter(Boolean), null, 1));

async function hacer(f) {
  const fuente = resolver(f.codigo);
  const meta = await sharp(fuente).metadata();
  let base = sharp(fuente).rotate();
  if (f.recorte) base = base.extract(f.recorte);
  const { data, info } = await base.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  gradar(data, info.channels, !!f.interior, f.fuerza ?? 0.8);
  const buf = await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } }).png().toBuffer();
  const W = info.width, H = info.height;
  const tope = Math.min(W, f.maxAncho || W);
  const unicos = [...new Set([...ANCHOS.filter((w) => w < tope - 30), tope])];
  for (const w of unicos) {
    let p = sharp(buf).resize({ width: w, withoutEnlargement: true, kernel: 'lanczos3' });
    if (!f.suave) p = p.sharpen({ sigma: 0.5, m1: 0.5, m2: 1 });
    const dst = path.join(SALIDA, `${f.nombre}-${w}`);
    await Promise.all([
      p.clone().avif({ quality: f.aq ?? 50, effort: 3 }).toFile(dst + '.avif'),
      p.clone().webp({ quality: f.wq ?? 76 }).toFile(dst + '.webp'),
      p.clone().jpeg({ quality: 82, mozjpeg: true }).toFile(dst + '.jpg'),
    ]);
  }
  const alto = Math.round(H * tope / W);
  const r = {
    nombre: f.nombre, codigo: f.codigo, nota: f.nota, anchos: unicos, ancho: tope, alto,
    origen: path.relative(REF, fuente).split(path.sep).join('/'), origenAncho: meta.width, origenAlto: meta.height,
    recorte: f.recorte || null,
  };
  resultado.set(f.nombre, r);
  guardar();
  console.log(f.nombre.padEnd(24), unicos.join(','), `${tope}x${alto}`, '<-', f.codigo);
}

const pendientes = FOTOS.filter((f) => {
  resolver(f.codigo);
  if (nombres.length) return nombres.includes(f.nombre);
  const h = hechas.get(f.nombre);
  if (rehacer || !h) return true;
  return !h.anchos.every((w) => fs.existsSync(path.join(SALIDA, `${f.nombre}-${w}.avif`)) && fs.existsSync(path.join(SALIDA, `${f.nombre}-${w}.jpg`)));
});
console.log(pendientes.length + ' por hacer de ' + FOTOS.length);
let sig = 0;
const HILOS = 3;
await Promise.all(Array.from({ length: HILOS }, async () => { while (sig < pendientes.length) await hacer(pendientes[sig++]); }));
for (const f of FOTOS) { const h = hechas.get(f.nombre); if (h && !resultado.has(f.nombre)) resultado.set(f.nombre, { ...h, codigo: f.codigo, nota: f.nota }); }
guardar();
console.log(FOTOS.length + ' fotos');
