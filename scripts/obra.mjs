/* Obra · prepara las fotos de «Antes y después».
   Uso:  node scripts/obra.mjs            (todas)
         node scripts/obra.mjs fachada-3  (solo esas; el resto de obra.json se conserva)
   Lee   scripts/obra-lista.json            (qué fotos, textos y citas)
         pruebas/obra-trabajo/*.png         (fotos alineadas con homografía: python pruebas/obra-alinear.py)
         ref/fotos/instagram/NNNN_codigo_k.jpg
   Escribe img/obra/<nombre>-<ancho>.{avif,webp,jpg}, img/obra/obra.json y img/obra/respaldo.html.
   - NUNCA amplía: los anchos son los de la foto o menores (480 y 800 en las originales; el 75 % y el 100 %
     en las alineadas, que ya salen a escala 1 del marco).
   - Sin corrección de color: son fotos de épocas y cámaras muy distintas y lo que se enseña es justo cómo
     cambió cada cosa; igualarlas escondería el cambio.
   - Los collages de Mónica (alpendre, mesilla, cabecero) se parten o se dejan tal cual, sin tocar el contenido. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const sharp = require('sharp');

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const IG = path.join(RAIZ, 'ref/fotos/instagram');
const TRABAJO = path.join(RAIZ, 'pruebas/obra-trabajo');
const SALIDA = path.join(RAIZ, 'img/obra');
fs.mkdirSync(SALIDA, { recursive: true });

const lista = JSON.parse(fs.readFileSync(path.join(RAIZ, 'scripts/obra-lista.json'), 'utf8'));
const solo = process.argv.slice(2);

const buscarIG = (clave) => {
  const [n, k] = clave.split('_');
  const f = fs.readdirSync(IG).find((x) => x.startsWith(n + '_') && x.endsWith('_' + k + '.jpg'));
  if (!f) throw new Error('falta ' + clave);
  return path.join(IG, f);
};

const jsonRuta = path.join(SALIDA, 'obra.json');
const previo = fs.existsSync(jsonRuta) ? JSON.parse(fs.readFileSync(jsonRuta, 'utf8')) : { imagenes: {} };
const imagenes = solo.length ? { ...previo.imagenes } : {};

for (const im of lista.imagenes) {
  if (solo.length && !solo.includes(im.nombre)) continue;
  let buf, origen;
  if (im.alineada) { origen = 'pruebas/obra-trabajo/' + im.alineada + '.png'; buf = fs.readFileSync(path.join(RAIZ, origen)); }
  else { origen = 'ref/fotos/instagram/' + path.basename(buscarIG(im.origen)); buf = fs.readFileSync(buscarIG(im.origen)); }
  let img = sharp(buf);
  if (im.recorte) { const [l, t, w, h] = im.recorte; img = img.extract({ left: l, top: t, width: w, height: h }); }
  const base = await img.png().toBuffer();
  const meta = await sharp(base).metadata();
  const W = meta.width, H = meta.height;
  let anchos = im.alineada
    ? [Math.round(W * 0.75), W]
    : [480, 800, W];
  anchos = [...new Set(anchos.filter((a) => a <= W && a >= 320))].sort((a, b) => a - b);
  if (!anchos.length) anchos = [W];
  for (const a of anchos) {
    const h = Math.round(H * a / W);
    const r = a === W ? sharp(base) : sharp(base).resize(a, h, { kernel: 'lanczos3' });
    await r.clone().avif({ quality: 52, effort: 4 }).toFile(path.join(SALIDA, `${im.nombre}-${a}.avif`));
    await r.clone().webp({ quality: 78 }).toFile(path.join(SALIDA, `${im.nombre}-${a}.webp`));
    await r.clone().jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(SALIDA, `${im.nombre}-${a}.jpg`));
  }
  imagenes[im.nombre] = { anchos, ancho: W, alto: H, origen, recorte: im.recorte || null, alineada: !!im.alineada };
  console.log(im.nombre.padEnd(20), W + '×' + H, anchos.join('/'));
}

// resumen de la alineación (sin las matrices) para que obra.js y las pruebas lo vean
let alineacion = {};
const ali = path.join(TRABAJO, 'alineacion.json');
if (fs.existsSync(ali)) {
  const a = JSON.parse(fs.readFileSync(ali, 'utf8'));
  for (const [c, v] of Object.entries(a)) {
    alineacion[c] = { ref: v.ref, recorte: v.recorte, salida: v.salida, fotos: {} };
    for (const [k, f] of Object.entries(v.fotos)) {
      const { H, ancho, alto, ...resto } = f; alineacion[c].fotos[k] = resto;
    }
  }
}

const salida = { generado: new Date().toISOString().slice(0, 10), imagenes, alineacion, fachada: lista.fachada, paradas: lista.paradas };
fs.writeFileSync(jsonRuta, JSON.stringify(salida, null, 1));

// ---- respaldo.html: cada pareja lado a lado con su pie (lo pega la web en <div data-modulo="obra">) ----
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pic = (n, alt, extra = '') => {
  const m = imagenes[n]; if (!m) return '';
  const mayor = m.anchos[m.anchos.length - 1];
  const set = (e) => m.anchos.map((a) => `img/obra/${n}-${a}.${e} ${a}w`).join(', ');
  return `<picture><source type="image/avif" srcset="${set('avif')}" sizes="(min-width: 900px) 40vw, 92vw"><source type="image/webp" srcset="${set('webp')}" sizes="(min-width: 900px) 40vw, 92vw"><img src="img/obra/${n}-${mayor}.jpg" srcset="${set('jpg')}" sizes="(min-width: 900px) 40vw, 92vw" width="${m.ancho}" height="${m.alto}" alt="${esc(alt)}" loading="lazy" decoding="async"${extra}></picture>`;
};
const cita = (c) => c ? `<blockquote><p>«${esc(c.texto)}»</p><footer>${esc(c.fuente)}</footer></blockquote>` : '';
let h = '<!-- Generado por scripts/obra.mjs: respaldo de «Antes y después». Si obra.js monta, lo oculta. -->\n';
h += `<div class="obra-respaldo">\n<h3>${esc(lista.fachada.titulo)}</h3>\n<p>${esc(lista.fachada.intro)}</p>\n<ol class="obra-respaldo__tiempos">\n`;
for (const t of lista.fachada.tiempos) h += `<li><figure>${pic(t.foto, t.alt)}<figcaption><b>${esc(t.titulo)}.</b> ${esc(t.texto)}</figcaption></figure></li>\n`;
h += `</ol>\n<p><small>${esc(lista.fachada.nota)} ${esc(lista.fachada.fuente)}</small></p>\n`;
for (const p of lista.paradas) {
  h += `<section class="obra-respaldo__parada"><h3><span>${esc(p.etiqueta)}</span> ${esc(p.titulo)}</h3><p>${esc(p.texto)}</p>${cita(p.cita)}\n`;
  for (const f of p.figuras) {
    h += `<div class="obra-respaldo__figura"><h4>${esc(f.titulo)}</h4><div class="obra-respaldo__fotos">`;
    if (f.tipo === 'tira') for (const x of f.fotos) h += `<figure>${pic(x.nombre, x.alt)}${x.etiqueta ? `<figcaption>${esc(x.etiqueta)}</figcaption>` : ''}</figure>`;
    else f.fotos.forEach((n, i) => { h += `<figure>${pic(n, (f.alts && f.alts[i]) || (f.etiquetas ? f.etiquetas[i] : '') || f.titulo)}${f.etiquetas ? `<figcaption>${esc(f.etiquetas[i])}</figcaption>` : ''}</figure>`; });
    h += `</div>${f.pie ? `<p><small>${esc(f.pie)}</small></p>` : ''}${cita(f.cita)}${cita(f.cita2)}</div>\n`;
  }
  h += '</section>\n';
}
h += '</div>\n';
fs.writeFileSync(path.join(SALIDA, 'respaldo.html'), h);
console.log('obra.json y respaldo.html escritos; ' + Object.keys(imagenes).length + ' fotos');
