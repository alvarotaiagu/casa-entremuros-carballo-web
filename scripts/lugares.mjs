/* «Seis lugares bajo un techo» · datos, mapa y fotos (agente Lugares).
   Uso:  node scripts/lugares.mjs datos    Overpass (con espejos y User-Agent propio) + OSRM -> scripts/lugares-cache/*.json
         node scripts/lugares.mjs mapa     img/lugares/mapa.svg (la lámina base), lugares.json, respaldo.html y la demo
         node scripts/lugares.mjs fotos    fotos de las habitaciones y de los lugares -> img/lugares/*.{avif,webp,jpg}
         node scripts/lugares.mjs          las tres, en ese orden (con --refrescar vuelve a pedir los datos)
   Los datos de OSM se guardan en scripts/lugares-cache/ (caché: Overpass falla a menudo); si ya están, no se piden.
   Atribución obligatoria: © colaboradores de OpenStreetMap (ODbL). */
import path from 'node:path';
import { pedirDatos } from './lugares-comun.mjs';

if (path.basename(process.argv[1] || '') === 'lugares.mjs') {
  const orden = process.argv[2] && !process.argv[2].startsWith('--') ? [process.argv[2]] : ['datos', 'fotos', 'mapa'];
  const refrescar = process.argv.includes('--refrescar');
  for (const o of orden) {
    if (o === 'datos') { console.log('datos'); await pedirDatos(refrescar); }
    else if (o === 'mapa') { console.log('mapa'); await (await import('./lugares-mapa.mjs')).construirMapa(); }
    else if (o === 'fotos') { console.log('fotos'); await (await import('./lugares-fotos.mjs')).hacerFotos(); }
  }
}
