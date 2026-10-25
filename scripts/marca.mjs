/* La marca de la web: el letrero de piedra de la entrada. NO se redibuja aquí (lo hace Mesa: scripts/placa.py).
   Uso: node scripts/marca.mjs [--svg ruta/a/placa.svg]
   - Si existe marca/placa.svg (grupos con id: #marco, #casa, #entremuros, #punto, #vieira, #abanico-izq, #abanico-der):
       · marca/letra.svg + marca/letra.json: «CASA ENTREMUROS.» en UNA línea (las letras de #casa y #entremuros + #punto,
         a la misma altura, en tinta), para la cabecera (construir.mjs la usa en <!--marca-cabecera-->).
       · favicon.svg, favicon-32.png, apple-touch-icon.png, icono-512.png: la vieira (#vieira) sobre granito.
       · img/og.jpg: el titular a la izquierda y la placa entera a la derecha.
   - Si no existe: el letrero de la foto (img/fotos/vieira-recorte y placa-recorte) para los iconos y el og,
     y la cabecera lleva «Casa Entremuros» en texto.
   Necesita antes img/fotos/ (scripts/fotos.mjs). Si cambia el vector: node scripts/marca.mjs && node construir.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const sharp = require('sharp');
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LINO = '#F3EEE5', TINTA = '#2B2823', GRANITO = '#B6AA98';
const i = process.argv.indexOf('--svg');
const SVG = i > 0 ? path.resolve(process.argv[i + 1]) : path.join(RAIZ, 'marca/placa.svg');
fs.mkdirSync(path.join(RAIZ, 'marca'), { recursive: true });
fs.mkdirSync(path.join(RAIZ, 'img'), { recursive: true });
const out = (r) => path.join(RAIZ, r);

/* ---- utilidades del SVG ---- */
function grupo(svg, id) {
  const ini = svg.search(new RegExp(`<g\\b[^>]*\\bid="${id}"`));
  if (ini < 0) return null;
  const re = /<g\b|<\/g>/g;
  re.lastIndex = ini;
  let prof = 0, m;
  while ((m = re.exec(svg))) {
    prof += m[0] === '</g>' ? -1 : 1;
    if (prof === 0) return svg.slice(ini, m.index + 4);
  }
  return null;
}
const raizSvg = (svg) => /<svg\b[^>]*>/.exec(svg)[0];
const defs = (svg) => (svg.match(/<defs[\s\S]*?<\/defs>/g) || []).join('');
const style = (svg) => (svg.match(/<style[\s\S]*?<\/style>/g) || []).join('');
const viewBox = (svg) => (/viewBox="([\d.\s-]+)"/.exec(raizSvg(svg))[1]).trim().split(/\s+/).map(Number);
// las letras en tinta (el vector las lleva en tinta-2): la cabecera pide más contraste
const TINTA_LETRA = '<style>.pl-hondo{fill:' + TINTA + '}</style>';
const conGrupos = (svg, ids, vb, extra = '') => {
  const gs = ids.map((id) => grupo(svg, id)).filter(Boolean);
  if (!gs.length) return null;
  const v = vb || viewBox(svg);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${v.join(' ')}" width="${v[2]}" height="${v[3]}">${style(svg)}${extra}${defs(svg)}${gs.join('')}</svg>`;
};
// caja de los trazos de un SVG, en unidades de su viewBox (se pinta sobre blanco y se recorta)
async function caja(svgTexto) {
  const vb = viewBox(svgTexto);
  const escala = 2400 / vb[2];
  const png = await sharp(Buffer.from(svgTexto), { density: 72 * escala }).flatten({ background: '#fff' }).png().toBuffer();
  const { info } = await sharp(png).trim({ background: '#fff', threshold: 12 }).toBuffer({ resolveWithObject: true });
  const pad = 2;
  return [vb[0] + (-info.trimOffsetLeft - pad) / escala, vb[1] + (-info.trimOffsetTop - pad) / escala, (info.width + 2 * pad) / escala, (info.height + 2 * pad) / escala];
}

const hay = fs.existsSync(SVG);
const svg = hay ? fs.readFileSync(SVG, 'utf8') : null;

/* ---- 1. la letra de la cabecera: CASA ENTREMUROS. en una línea ---- */
if (hay && grupo(svg, 'casa') && grupo(svg, 'entremuros')) {
  const cCasa = await caja(conGrupos(svg, ['casa'], null, TINTA_LETRA));
  const cEntre = await caja(conGrupos(svg, ['entremuros', 'punto'], null, TINTA_LETRA));
  const H = 100, hueco = 52;                       // altura común y hueco entre palabras (unidades de la nueva caja)
  const sCasa = H / cCasa[3], sEntre = H / cEntre[3];
  const wCasa = cCasa[2] * sCasa, wEntre = cEntre[2] * sEntre;
  const W = wCasa + hueco + wEntre;
  const g = (ids, c, s, dx) => `<g transform="translate(${dx.toFixed(2)} 0) scale(${s.toFixed(5)}) translate(${(-c[0]).toFixed(2)} ${(-c[1]).toFixed(2)})">${ids.map((id) => grupo(svg, id)).filter(Boolean).join('')}</g>`;
  const letra = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(2)} ${H}">${style(svg)}${TINTA_LETRA}${defs(svg)}${g(['casa'], cCasa, sCasa, 0)}${g(['entremuros', 'punto'], cEntre, sEntre, wCasa + hueco)}</svg>\n`;
  fs.writeFileSync(out('marca/letra.svg'), letra);
  const alto = 26;
  fs.writeFileSync(out('marca/letra.json'), JSON.stringify({ alto, ancho: Math.round(alto * W / H), nota: 'CASA y ENTREMUROS. de marca/placa.svg, a la misma altura y en una línea' }) + '\n');
  console.log('marca/letra.svg:', W.toFixed(0) + '×' + H, '(CASA', cCasa.map((x) => x.toFixed(0)).join(' '), '· ENTREMUROS.', cEntre.map((x) => x.toFixed(0)).join(' ') + ')');
} else {
  for (const f of ['marca/letra.svg', 'marca/letra.json']) if (fs.existsSync(out(f))) fs.rmSync(out(f));
  console.warn('Sin marca/placa.svg con #casa y #entremuros: la cabecera se queda con el texto.');
}

/* ---- 2. iconos: la vieira (o, sin vector, la vieira de la foto) sobre granito ---- */
async function imagenIcono() {
  if (hay && grupo(svg, 'vieira')) {
    const v = conGrupos(svg, ['vieira'], null, '');
    const c = await caja(v);
    const v2 = conGrupos(svg, ['vieira'], c);
    return sharp(Buffer.from(v2), { density: 72 * (512 / c[2]) }).png().toBuffer();
  }
  return sharp(out('img/fotos/vieira-recorte-215.jpg')).png().toBuffer();
}
const base = await imagenIcono();
async function icono(tam, radio = 0) {
  const marco = Math.round(tam * 0.12), ancho = tam - 2 * marco;
  const dib = await sharp(base).resize({ width: ancho, height: ancho, fit: 'inside', kernel: 'lanczos3' }).toBuffer();
  const m = await sharp(dib).metadata();
  const fondo = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tam}" height="${tam}"><rect width="${tam}" height="${tam}" rx="${radio}" fill="${GRANITO}"/></svg>`);
  return sharp(fondo).composite([{ input: dib, left: Math.round((tam - m.width) / 2), top: Math.round((tam - m.height) / 2) }]).png().toBuffer();
}
await sharp(await icono(64, 12)).resize(32, 32).png().toFile(out('marca/favicon-32.png'));
await sharp(await icono(180)).png().toFile(out('marca/apple-touch-icon.png'));
await sharp(await icono(512)).png().toFile(out('marca/icono-512.png'));
const b64 = (await icono(96, 18)).toString('base64');
fs.writeFileSync(out('marca/favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="64" height="64" viewBox="0 0 96 96"><image width="96" height="96" href="data:image/png;base64,${b64}"/></svg>\n`);

/* ---- 3. og:image 1200×630: el titular a la izquierda y el letrero a la derecha ---- */
let placa;
if (hay) {
  const vb = viewBox(svg);
  placa = await sharp(Buffer.from(svg), { density: 72 * (520 / vb[3]) }).resize({ height: 520 }).png().toBuffer();
} else {
  placa = await sharp(out('img/fotos/placa-recorte-610.jpg')).resize({ height: 440 }).png().toBuffer();
}
const pm = await sharp(placa).metadata();
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="${LINO}"/>
  <text x="64" y="190" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" letter-spacing="3" fill="#794131">CASA RURAL · CANCES GRANDE · CARBALLO</text>
  <text x="64" y="290" font-family="Georgia, 'Times New Roman', serif" font-size="66" fill="${TINTA}">Una casa de piedra</text>
  <text x="64" y="364" font-family="Georgia, 'Times New Roman', serif" font-size="66" fill="${TINTA}">del siglo XIX,</text>
  <text x="64" y="438" font-family="Georgia, 'Times New Roman', serif" font-size="66" fill="${TINTA}">con la mesa puesta</text>
  <text x="64" y="520" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#5E574D">Casa entera · seis habitaciones con baño · piscina</text>
</svg>`;
await sharp(Buffer.from(og)).composite([{ input: placa, left: 1200 - 56 - pm.width, top: Math.round((630 - pm.height) / 2) }]).jpeg({ quality: 84, mozjpeg: true }).toFile(out('img/og.jpg'));
console.log(`marca/ e img/og.jpg listos (${hay ? 'desde marca/placa.svg' : 'sin vector todavía: del letrero de la foto'})`);
