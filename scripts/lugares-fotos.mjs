/* Fotos de «Seis lugares»: las seis habitaciones y las fotos de los lugares que la casa ha publicado.
   Salen de ref/fotos/instagram/ (nombre NNNN_codigo_k.jpg). NUNCA amplía. Recorte 4:3 a mano (en píxeles del original) y
   una gradación suave común (menos saturación, negros algo más suaves) para que parezcan de la misma sesión.
   Escribe img/lugares/lg-<id>-<hab|lugar>-<ancho>.{avif,webp,jpg} y img/lugares/fotos.json. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { RAIZ, SAL } from './lugares-comun.mjs';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const sharp = require('sharp');
const IG = path.join(RAIZ, 'ref/fotos/instagram');

/* origen: prefijo NNNN_ + k. recorte en píxeles del original. `ig` = número de post, para la nota de fuente. */
export const FOTOS = [
  /* habitaciones (sin duda: el pie de IG las nombra) */
  { id: 'rio-anllons', tipo: 'hab', origen: '0105_', k: 1, ig: 105, recorte: { x: 0, y: 60, w: 791, h: 593 },
    alt: 'La habitación Río Anllóns: cama doble con colcha dorada, pared de piedra vista, lámpara de cristal y tocador blanco', nota: 'IG 105 (2020): la habitación después del cambio de 2019' },
  { id: 'refuxo-de-verdes', tipo: 'hab', origen: '0131_', k: 1, ig: 131, recorte: { x: 40, y: 0, w: 1007, h: 755 },
    alt: 'La habitación Refuxo de Verdes: cama con dosel de hierro y cortinas blancas, pared de piedra y suelo de madera', nota: 'IG 131 (2019)' },
  { id: 'ponte-lubians', tipo: 'hab', origen: '0066_', k: 1, ig: 66, recorte: { x: 190, y: 0, w: 753, h: 565 },
    alt: 'La habitación Ponte Lubiáns: la más grande de la casa, cama de 1,80 con cabecero blanco, vigas de madera y pared de piedra', nota: 'IG 66 (2021)' },
  { id: 'fervenza-de-san-paio', tipo: 'hab', origen: '0099_', k: 2, ig: 99, recorte: { x: 2, y: 0, w: 1076, h: 807 },
    alt: 'La habitación Fervenza de San Paio: dos camas de 90 cm con ropa de cama de plumas grises, pared de piedra picada y espejo antiguo', nota: 'IG 99 (2020): después de la reforma' },
  { id: 'razo', tipo: 'hab', origen: '0050_', k: 1, ig: 50, recorte: { x: 0, y: 250, w: 1080, h: 810 },
    alt: 'La habitación Razo, en la casita de la piscina: cama con cabecero de madera clara y cojines con borlas', nota: 'IG 50 (2021)' },
  /* Baldaio: la casa solo ha publicado un vídeo y el rótulo de la puerta; la web antigua tenía fotos, pero no se han podido bajar */
  { id: 'baldaio', tipo: 'hab', origen: '0135_', k: 1, ig: 135, recorte: { x: 0, y: 0, w: 720, h: 540 },
    alt: 'La puerta de madera de la habitación Baldaio, con su rótulo', nota: 'IG 135 (2019, miniatura del vídeo): solo el rótulo de la puerta; falta la foto de la habitación', rotulo: true },
  /* lugares (fotos de la casa o de sus huéspedes) */
  { id: 'refuxo-de-verdes', tipo: 'lugar', origen: '0121_', k: 1, ig: 121, recorte: { x: 0, y: 270, w: 1080, h: 810 },
    alt: 'El Refuxo de Verdes: pasarela de madera con barandilla sobre el río Anllóns, entre árboles', nota: 'IG 121 (2020), foto de @viajocomoquiero', credito: '@viajocomoquiero' },
  { id: 'razo', tipo: 'lugar', origen: '0189_', k: 1, ig: 189, recorte: { x: 0, y: 0, w: 705, h: 529 },
    alt: 'La playa de Razo: arena clara, hierbas de duna y el mar al fondo', nota: 'IG 189 (2017)' },
  { id: 'fervenza-de-san-paio', tipo: 'lugar', origen: '0076_', k: 4, ig: 76, recorte: { x: 100, y: 0, w: 747, h: 560 },
    alt: 'La fervenza de Entrecruces, entre rocas y helechos, con un hilo de agua que baja por la garganta', nota: 'IG 76 (2020): «Fervenza de Entrecruces»' },
  { id: 'rio-anllons', tipo: 'lugar', origen: '0089_', k: 1, ig: 89, recorte: { x: 100, y: 0, w: 753, h: 565 },
    alt: 'La ría de Corme e Laxe con la desembocadura del Anllóns, vista desde el mirador de Monte Branco', nota: 'IG 89 (2020): mirador de Monte Branco' },
];

const ANCHOS = [480, 800];

export async function hacerFotos() {
  fs.mkdirSync(SAL, { recursive: true });
  const salida = {};
  for (const f of FOTOS) {
    const fich = fs.readdirSync(IG).find((n) => n.startsWith(f.origen) && n.endsWith('_' + f.k + '.jpg'));
    if (!fich) throw new Error('falta la foto ' + f.origen + f.k);
    const r = f.recorte;
    const meta = await sharp(path.join(IG, fich)).metadata();
    if (r.x + r.w > meta.width || r.y + r.h > meta.height) throw new Error(`recorte fuera de ${fich}: ${meta.width}x${meta.height}`);
    const base = await sharp(path.join(IG, fich)).extract({ left: r.x, top: r.y, width: r.w, height: r.h })
      .modulate({ saturation: f.rotulo ? 0.95 : 0.93 }).linear(0.97, 6).toBuffer();
    const anchos = ANCHOS.filter((a) => a <= r.w); if (r.w < ANCHOS.at(-1)) anchos.push(r.w);
    const nombre = `lg-${f.id}-${f.tipo}`;
    for (const a of [...new Set(anchos)]) {
      const h = Math.round((a * r.h) / r.w);
      const t = sharp(base).resize(a, h, { kernel: 'lanczos3' });
      await t.clone().avif({ quality: 55, effort: 4 }).toFile(path.join(SAL, `${nombre}-${a}.avif`));
      await t.clone().webp({ quality: 78 }).toFile(path.join(SAL, `${nombre}-${a}.webp`));
      await t.clone().jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(SAL, `${nombre}-${a}.jpg`));
    }
    const lista = [...new Set(anchos)].sort((a, b) => a - b);
    salida[nombre] = { anchos: lista, ancho: lista.at(-1), alto: Math.round((lista.at(-1) * r.h) / r.w), origen: fich, origenAncho: meta.width, origenAlto: meta.height, recorte: r, ig: f.ig, alt: f.alt, nota: f.nota, credito: f.credito || null, soloRotulo: !!f.rotulo };
    console.log('  ' + nombre + ' ' + lista.join('/') + ' ← ' + fich);
  }
  fs.writeFileSync(path.join(SAL, 'fotos.json'), JSON.stringify(salida, null, 1));
}

if (path.basename(process.argv[1] || '') === 'lugares-fotos.mjs') await hacerFotos();
