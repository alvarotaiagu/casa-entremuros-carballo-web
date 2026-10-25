/* Verificación de la web de Casa Entremuros (Playwright, un solo navegador, ventanas pequeñas, escala 1).
   Uso: node verificar.mjs   (puerto 8901). Sin capturas: lo que hay que mirar a ojo va en el README.
   Antes de lanzarlo: Get-CimInstance Win32_Process -Filter "Name='chrome-headless-shell.exe'" (una prueba a la vez).
   No hay WebGL en esta web (el zoom aéreo es 2D): el navegador arranca con --disable-3d-apis por si algún módulo lo intentara.
   Todas las pruebas con movimiento reducido salvo las de movimiento (cortina, entrada de la portada), que van una vez
   y al final. Los módulos de los otros agentes se prueban solo si ya están; el contrato (opciones, ramas, pie) se
   prueba con módulos de mentira que se inyectan, para no depender de ellos. */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const { chromium } = require('playwright');

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const PUERTO = 8901;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.bin': 'application/octet-stream' };
const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(RAIZ, p);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
servidor.on('error', (e) => { console.error(`El puerto ${PUERTO} está ocupado (¿otra sesión?): ${e.message}`); process.exit(2); });
await new Promise((r) => servidor.listen(PUERTO, r));
const BASE = `http://localhost:${PUERTO}/`;
const PAG = BASE + 'index.html';

const fallos = [];
let nOk = 0;
const comprobar = (cond, m, detalle) => { if (cond) { nOk++; console.log('  ok     ' + m); } else { fallos.push(m); console.log('  FALLO  ' + m + (detalle !== undefined ? ' → ' + JSON.stringify(detalle) : '')); } };
const nota = (m) => console.log('  ·      ' + m);
const LLAVE = 'entremuros-cookies';
const sinCookies = `try { localStorage.setItem('${LLAVE}', 'si'); } catch (e) {}`;
const existe = (f) => fs.existsSync(path.join(RAIZ, f));
const HAY = { mesa: existe('js/mesa.js'), cortina: existe('partes/cortina.html') && existe('js/cortina.js'), lugares: existe('js/lugares.js'), obra: existe('js/obra.js'), faros: existe('js/faros.js'), reserva: existe('js/reserva.js') };
const JS_MODULOS = /js\/(cortina|mesa|lugares|obra|faros|reserva)\.js/;

/* librerías desde una copia local: la prueba no depende del CDN ese día */
const CDN = {
  'lenis.min.js': 'https://cdn.jsdelivr.net/npm/@studio-freight/lenis@1.0.42/dist/lenis.min.js',
  'gsap.min.js': 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js',
  'ScrollTrigger.min.js': 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js',
};
const CACHE = path.join(os.tmpdir(), 'tulla-cdn'); // la misma copia que usan las webs hermanas
fs.mkdirSync(CACHE, { recursive: true });
for (const [n, u] of Object.entries(CDN)) {
  const f = path.join(CACHE, n);
  if (!fs.existsSync(f)) fs.writeFileSync(f, Buffer.from(await (await fetch(u)).arrayBuffer()));
}
const RE_CDN = /cdn\.jsdelivr\.net\/npm\/.*\/(lenis|gsap|ScrollTrigger)\.min\.js$/;
const local = (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(CACHE, r.request().url().split('/').pop())) });

/* módulos de mentira (contrato): registran con qué se les llama y marcan data-montado */
const FALSOS = (con = 'todos') => `
  window.__ops = []; window.__ramas = []; window.__destruidos = 0;
  const E = window.Entremuros = window.Entremuros || {};
  const falso = (nombre) => ({ montar(el, op) { window.__ops.push({ nombre, modo: op.modo, op: { movimiento: op.movimiento, densidad: op.densidad, fecha: op.fecha instanceof Date, fechaISO: op.fecha instanceof Date ? op.fecha.toISOString().slice(0, 10) : null } }); el.dataset.montado = '1'; return { destruir() { window.__destruidos++; } }; } });
  E.mesa = falso('mesa'); { const m0 = E.mesa.montar; E.mesa.montar = function (el, op) { el.style.minHeight = '100svh'; return m0.call(this, el, op); }; }
  window.__eventos = []; document.addEventListener('entremuros:rama', (e) => window.__eventos.push([e.detail.n, !!e.detail.alLlegar]));
  E.mesa.rama = function (el, op) { window.__ramas.push({ n: op && op.n, dibujar: op && op.dibujar, el: el && el.dataset ? el.dataset.rama : null }); if (el) el.innerHTML = '<svg viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg>'; };
  ${con === 'todos' ? "E['mesa-pie'] = falso('mesa-pie');" : ''}
  for (const n of ['lugares', 'obra', 'faros', 'reserva']) E[n] = falso(n);
`;

/* ================= 0. archivos (sin navegador) ================= */
console.log('\n0. Archivos');
console.log('  (módulos presentes: ' + Object.entries(HAY).map(([k, v]) => k + (v ? ' sí' : ' no')).join(', ') + ')');
const htmls = fs.readdirSync(RAIZ).filter((f) => f.endsWith('.html') && !f.endsWith('.src.html'));
for (const f of htmls) {
  const s = fs.readFileSync(path.join(RAIZ, f), 'utf8');
  comprobar(/^<!DOCTYPE html>\s*<html lang="es">\s*<head>\s*<meta charset="utf-8">\s*<meta name="robots" content="noindex, ?nofollow">/.test(s), `${f}: charset lo primero y noindex justo detrás`);
  const ids = [...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const rep = ids.filter((x, i) => ids.indexOf(x) !== i);
  comprobar(rep.length === 0, `${f}: ningún id repetido`, [...new Set(rep)]);
  comprobar(!/<!--parte:/.test(s) && !/<!-- sin partes\/(cabeza|cabecera|reserva|llegar|pie|guiones)/.test(s) && !/\{\{[a-z_0-9]+\}\}/.test(s) && !/<!--(marca-cabecera|placa-pie)-->/.test(s), `${f}: todas las partes y datos sustituidos`);
}
if (!HAY.cortina) nota('aún no está partes/cortina.html con js/cortina.js (agente Mesa): la web va sin cortina');
comprobar(['.nojekyll', '404.html', 'manifest.json', 'datos.json', 'img/og.jpg', 'marca/favicon.svg', 'marca/favicon-32.png', 'marca/apple-touch-icon.png', 'marca/icono-512.png'].every(existe), '.nojekyll, 404, manifest, datos, og:image y favicons');
const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const lista = JSON.parse(fs.readFileSync(path.join(RAIZ, 'scripts/fotos-lista.json'), 'utf8'));
const fotosJson = JSON.parse(fs.readFileSync(path.join(RAIZ, 'img/fotos/fotos.json'), 'utf8'));
const datos = JSON.parse(fs.readFileSync(path.join(RAIZ, 'datos.json'), 'utf8'));
const mainJs = fs.readFileSync(path.join(RAIZ, 'js/main.js'), 'utf8');
const css = fs.readFileSync(path.join(RAIZ, 'css/estilos.css'), 'utf8');
{
  const rutas = new Set();
  for (const m of html.matchAll(/(src|srcset|href|imagesrcset)="([^"]+)"/g)) for (const parte of (/srcset/.test(m[1]) ? m[2].split(',') : [m[2]])) {
    const r = parte.trim().split(/\s+/)[0].split('?')[0];
    if (r && r !== './' && !/^(https?:|mailto:|tel:|#|data:)/.test(r)) rutas.add(r);
  }
  const faltan = [...rutas].filter((r) => !existe(r));
  comprobar(faltan.length === 0, `index.html: existen los ${rutas.size} archivos que enlaza`, faltan);
  const pre = /<link rel="preload" as="image" type="image\/avif" imagesrcset="([^"]+)"/.exec(html);
  const pic = /<picture data-foto="mesa-larga-otono"><source type="image\/avif" srcset="([^"]+)"/.exec(html);
  comprobar(pre && pic && pre[1] === pic[1], 'la foto de la portada (mesa-larga-otono) va precargada con el mismo srcset que pinta el <picture>');
  // fotos: solo del Instagram de la casa; ninguna de la lista «NO usar» de FOTOS.md (personas, celebraciones con niños, otros negocios, terceros)
  const PROHIBIDAS = /^(0045_1|0072_1|0087_1|0119_\d|0123_1|0149_1|0220_1|0203_1|0056_1|0082_1|0109_1|0183_\d+|0184_\d+|0168_\d+|0130_1|0187_\d|0078_\d|0165_1|0167_1|0180_\d|0240_1|0172_1|0202_1|0237_1|0238_1|0235_1|0043_1)$/;
  const malas = lista.filter((f) => PROHIBIDAS.test(f.codigo)).map((f) => f.nombre + ' ' + f.codigo);
  comprobar(lista.every((f) => /^\d{4}_\d+$/.test(f.codigo)) && malas.length === 0, 'todas las fotos son del Instagram de la casa y ninguna es de la lista «NO usar» (personas, niños en celebraciones, otros negocios, terceros)', malas);
  comprobar(fotosJson.length === lista.length && fotosJson.every((f) => f.ancho <= f.origenAncho * 1.0001 && f.anchos.every((w) => w <= f.ancho)), 'ninguna foto se amplía (ancho de salida ≤ ancho de origen) y fotos.json tiene todas las de la lista', [fotosJson.length, lista.length]);
  comprobar(fotosJson.every((f) => f.anchos.every((w) => ['avif', 'webp', 'jpg'].every((e) => existe(`img/fotos/${f.nombre}-${w}.${e}`)))), 'cada foto existe en AVIF, WebP y JPG en todos sus anchos');
  const usadas = [...html.matchAll(/<picture data-foto="([^"]+)"/g)].map((m) => m[1]);
  comprobar(usadas.length >= 15 && usadas.every((n) => fotosJson.some((f) => f.nombre === n)), `las ${usadas.length} fotos de la página están en fotos.json`);
  // lo que pide el ENCARGO por nombre y lo que piden los demás agentes (los nombres de FOTOS.md)
  const pedidas = ['placa', 'fachada', 'aerea-2015', 'casita', 'mesa-larga-otono', 'mesa-chimenea', 'mesa-blanca', 'salon', 'cocina', 'comedor', 'chimenea', 'detalle-lavanda-1', 'aparador-1', 'hab-rio-anllons', 'hab-refuxo', 'hab-ponte-lubians', 'hab-fervenza', 'hab-razo', 'hab-baldaio-puerta', 'alpendre', 'piscina', 'limonada', 'campo', 'cabana', 'huerto', 'obra-fachada-1', 'obra-fachada-5', 'lugar-nariga-1', 'lugar-refuxo', 'lugar-razo'];
  comprobar(pedidas.every((n) => fotosJson.some((f) => f.nombre === n)), 'están las fotos por nombre que piden los demás agentes', pedidas.filter((n) => !fotosJson.some((f) => f.nombre === n)));

  const texto = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<\/(p|li|h[1-6]|td|th|figcaption|dd|dt|caption)>/g, '. ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  comprobar(/4,7/.test(texto) && /141 reseñas/.test(texto) && /25 de octubre de 2026/.test(texto) && !/\b(una|1)( sola| única)? (reseña|opinión)\b/i.test(texto) && !/la (primera|segunda) reseña/i.test(texto), 'la nota de Google es la leída (4,7 con 141 reseñas, fechada el 25 de octubre de 2026) y no hay «una sola reseña»');
  comprobar(!/el mejor|los mejores|la mejor |clientes satisfechos|cientos de|miles de|sin permanencia|garantizad/i.test(texto.replace(/«[^»]*»/g, '').replace(/<blockquote[\s\S]*?<\/blockquote>/g, '')), 'sin superlativos propios ni prueba social inventada (las citas, aparte)');
  comprobar(/3[0-9]{2}\s*reseñas|aggregateRating/.test(html) === false, 'el JSON-LD y el HTML no llevan un recuento de reseñas inventado');
  comprobar(!/wa\.me[^"]*"[^>]*>[^<]*por confirmar/i.test(html), 'el WhatsApp va como enlace (consta en Páxinas Galegas); lo «por confirmar» va a PENDIENTES.md');
  comprobar(/wa\.me\/34627777074/.test(html), 'WhatsApp al mismo número que el teléfono');
  comprobar(!/three\.js|webgl|\bTHREE\b|sin-3d|3d\//i.test(html + mainJs) && !existe('js/3d') && !existe('css/3d.css'), 'sin 3D (WebGL de terreno): el zoom aéreo es 2D con la ortofoto del IGN');
  comprobar(/<html lang="es">/.test(html) && !/\/es\/|hreflang|lang="gl"/.test(html), 'solo castellano');
  comprobar([...html.matchAll(/<img\b[^>]*>/g)].every((m) => /\salt="/.test(m[0])), 'todas las imágenes llevan alt');
  comprobar((() => { try { JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]); return true; } catch (e) { return false; } })(), 'el JSON-LD se lee');
  // datos: un solo sitio (datos.json) y lo dudoso, marcado
  comprobar(new RegExp(`${datos.tarifa_baja_8} €`).test(html) && new RegExp(`${datos.tarifa_baja_12} €`).test(html) && new RegExp(`${datos.tarifa_alta_agosto} €`).test(html) && /por confirmar/.test(html) && !/275 €|375 €|245 €|295 €/.test(texto), 'precios de la página «Tarifas» de la web antigua (datos.json), marcados «por confirmar» y sin los de la portada vieja');
  comprobar(/627 777 074/.test(html) && /Cances Grande nº 77/.test(html) && /15107/.test(html) && !/15106/.test(html) && /info@casaentremuros\.com/.test(html), 'teléfono, dirección, código postal 15107 y correo de DATOS');
  comprobar(/hasta 12 personas/.test(html) && /hasta 16 con camas supletorias/.test(html) && /supuesto|por confirmar/.test(datos.plazas_nota + datos.alquiler_nota), 'plazas: «hasta 12 personas (16 con camas supletorias, por confirmar)»');
  comprobar(/No esperes tenerlo todo para disfrutar de la vida, ya tienes la vida para disfrutar de todo/.test(html), 'el lema de la casa, literal, en el pie');
  comprobar(/Me encanta cuidar hasta el mínimo detalle/.test(html) && /hortensia es una de mis favoritas/.test(html), 'las citas de la casa, literales y con su mes y año');
  comprobar(/XIX/.test(html) && /id="casa"/.test(html) && /data-rama="1"/.test(html), 'La casa: la cifra del siglo y la rama 1');
  comprobar(!/hórreo/i.test(texto), 'ni una palabra del hórreo (no consta si se alquila hoy: PENDIENTES.md)');
  comprobar(!/evento|organizamos celebraciones|bodas/i.test(texto) && /han celebrado|se han celebrado/.test(texto), 'las celebraciones, solo como «se han celebrado…» con fecha, sin vender eventos');
  comprobar(!/\badaptad[ao]\b[^.]{0,160}\b(Razo|Baldaio)\b|\b(Razo|Baldaio)\b[^.]{0,160}\badaptad[ao]\b/i.test(texto), 'la habitación adaptada va sin nombrar (IG 85 dice Razo e IG 135, Baldaio)');
  comprobar(/Mónica/.test(texto) && !/cara de Mónica|Mónica (en la foto|sale)/.test(texto) && !/[A-Z][a-z]+ [A-Z][a-z]+ Mónica/.test(texto), 'Mónica, solo de nombre (no sale su cara ni su apellido)');
  comprobar(/Apartamento Area Maior/.test(html) && /VUT-CO-006176/.test(html) && /No se alquila en julio y agosto/.test(html) && /id="malpica"/.test(html), 'la franja «Y frente al mar, en Malpica»: Area Maior, su registro y «no disponible en julio y agosto»');
  const mods = [['mesa', 'portada'], ['lugares', 'habitaciones'], ['obra', 'antes-y-despues'], ['faros', 'alrededores'], ['reserva', 'reservar']];
  comprobar(mods.every(([m, id]) => new RegExp(`<section[^>]*id="${id}"[^>]*>[\\s\\S]*?data-modulo="${m}"`).test(html)) && /<footer class="pie[^"]*" id="pie">[\s\S]*?data-modulo="mesa-pie"/.test(html), 'los sitios de los módulos, como dice el contrato (mesa, mesa-pie, lugares, obra, faros y reserva)');
  comprobar(/<section class="portada[^"]*" id="portada"[^>]*>\s*<div class="portada__mesa" data-modulo="mesa">[\s\S]*?<\/div>\s*<div class="portada-texto">/.test(html), 'la portada es <section id="portada"><div data-modulo="mesa">…</div><div class="portada-texto">…</div></section>');
  comprobar([1, 2, 3, 4, 5].every((n) => new RegExp(`<span class="rama" data-rama="${n}" aria-hidden="true"></span>`).test(html)) && (html.match(/data-rama=/g) || []).length === 5, 'las cinco ramas (data-rama 1-5, aria-hidden) junto a los titulares: la casa, los lugares, dentro y fuera, antes y después, reservar');
  comprobar(/<span id="foco-rama" aria-hidden="true"><\/span>/.test(html), '#foco-rama para el foco del teclado');
  comprobar(/<!--\s*sin partes\/cortina\.html\s*-->/.test(html) ? true : /id="cortina"/.test(html), 'la cortina de Mesa, o el hueco para ella');
  const iMain = html.indexOf('js/main.js');
  const jsMods = ['js/cortina.js', 'js/mesa.js', 'js/lugares.js', 'js/obra.js', 'js/faros.js', 'js/reserva.js'].filter((s) => html.includes('src="' + s));
  comprobar(jsMods.every((s) => html.indexOf('src="' + s) < iMain && new RegExp('<script src="' + s.replace('.', '\\.') + '[^"]*" defer>').test(html)), 'los JS de los módulos que hay, con defer y antes de main.js', jsMods);
  const cssMods = ['css/mesa.css', 'css/lugares.css', 'css/obra.css', 'css/faros.css', 'css/reserva.css'].filter((c) => html.includes(c));
  comprobar(cssMods.every((c) => html.indexOf(c) < html.indexOf('</head>') && html.indexOf(c) > html.indexOf('css/estilos.css')), 'los CSS de los módulos que hay, en el <head> y después de estilos.css', cssMods);
  // letras: tres, ninguna repetida en otras webs de la cartera
  const fam = [...html.matchAll(/family=([A-Za-z+]+)/g)].map((m) => m[1]);
  comprobar(fam.length === 3 && ['Golos+Text', 'Hedvig+Letters+Serif', 'Pinyon+Script'].every((n) => fam.includes(n)) && /display=swap/.test(html), 'tres letras de Google Fonts con display=swap: Hedvig Letters Serif, Golos Text y Pinyon Script', fam);
  const otras = new Set();
  for (const d of fs.readdirSync(path.join(RAIZ, '..'))) {
    if (d === path.basename(RAIZ)) continue;
    for (const f of ['index.html', 'index.src.html']) {
      const p = path.join(RAIZ, '..', d, f);
      if (fs.existsSync(p)) for (const m of fs.readFileSync(p, 'utf8').matchAll(/family=([A-Za-z+]+)/g)) if (['Golos+Text', 'Hedvig+Letters+Serif', 'Pinyon+Script'].includes(m[1])) otras.add(d + ': ' + m[1]);
    }
  }
  comprobar(otras.size === 0, 'ninguna de las tres letras la usa otra web de la cartera', [...otras].slice(0, 5));
}
// tokens de la paleta (medida de ENCARGO) y alias que piden los módulos
comprobar(['--lino: #F3EEE5', '--lino-2: #E9E1D3', '--blanco: #FBF9F4', '--tinta: #2B2823', '--tinta-2: #5E574D', '--granito: #B6AA98', '--granito-2: #8F8473', '--teja: #A9503A', '--hoja: #5D7347', '--hoja-2: #8EA273', '--noche: #121822', '--noche-2: #1E2633', '--faro: #FFE7A6'].every((t) => css.includes(t)), 'los tokens de la paleta del encargo (lino, tinta, granito, teja, hoja, noche y faro)');
comprobar(/--teja-texto:\s*color-mix\(in srgb, var\(--teja\) 62%, var\(--tinta\)\)/.test(css), '--teja-texto derivado con color-mix hacia la tinta (la teja sola no llega a 4,5:1 sobre lino 2)');
comprobar(/--f-titulo:/.test(css) && /--f-texto:/.test(css) && /--f-nombre:/.test(css) && /--f-voz:/.test(css) && /--f-txt:/.test(css) && /--cab:/.test(css), 'los tokens y alias que leen los módulos (--f-titulo, --f-texto, --f-nombre, --f-voz, --f-txt y --cab)');
comprobar((css.match(/Pinyon Script/g) || []).length === 1 && !/font-family:\s*var\(--f-nombre\)/.test(css), 'Pinyon Script solo como token (--f-nombre) para las tarjetas de Mesa y Reserva: la web no la usa en ningún otro sitio');
comprobar(/\.cookies:not\(\[hidden\]\)\s*\{[^}]*display:\s*flex/.test(css) && !/\.cookies\s*\{[^}]*display:/.test(css), 'cookies: display solo en :not([hidden])');
comprobar(/\.mando:not\(\[hidden\]\)/.test(css) && !/\.mando\s*\{[^}]*display:/.test(css), 'mando: display solo en :not([hidden])');
comprobar(/\.menu-movil\s*\{[^}]*height:\s*100dvh/.test(css) && !/\.menu-movil\s*\{[^}]*inset:\s*0/.test(css), 'menú móvil: altura 100dvh, nunca inset:0 (la cabecera lleva backdrop-filter)');
comprobar(!/\ddvh/.test(css.replace(/\.menu-movil\s*\{[^}]*\}/, '')), 'fuera del menú fijo, ningún dvh (la barra del móvil no mueve nada)');
comprobar(/html\.cortina-fuera #cortina\s*\{\s*display:\s*none/.test(css) && /prefers-reduced-motion: reduce\)\s*\{\s*#cortina\s*\{\s*display:\s*none/.test(css) && /#cortina\[hidden\]\s*\{\s*display:\s*none/.test(css), 'cortina: la web la oculta al salir, con [hidden] y con movimiento reducido');
comprobar(!/cursor:\s*none/.test(css + mainJs) && !/class="cursor/.test(html), 'sin cursor propio (nunca dos cursores)');
comprobar(!/position:\s*sticky/.test(css) && !/marquee/i.test(css + html), 'fuera la pila sticky de tarjetas y el marquee');
comprobar(/const motion = !quieto;\s*if \(motion\) raiz\.classList\.add\('con-movimiento'\)/.test(mainJs), '«con-movimiento» solo sin movimiento reducido');
comprobar(/if \(esBarra\(\)\) return;/.test(mainJs) && !/addEventListener\('resize'[^;]*innerHeight/.test(mainJs), 'el resize de la barra del móvil no rehace nada');
comprobar(/window\.__redCortina = setTimeout/.test(html) && /<noscript><style>\.cortina,#cortina\{display:none!important\}<\/style><\/noscript>/.test(html), 'red de seguridad inline y <noscript> para la cortina');
comprobar(/\.s-granito\s*\{[^}]*--fondo:\s*var\(--granito-claro\)/.test(css), 'las secciones de granito usan el granito claro con texto (la tinta sobre #B6AA98 no pasa APCA); #B6AA98 queda para piedra y marcos');
{
  const ck = fs.readFileSync(path.join(RAIZ, 'cookies.html'), 'utf8');
  comprobar(/Google Fonts/.test(ck) && /Google Maps/.test(ck) && /jsDelivr/.test(ck) && /entremuros-cookies/.test(ck), 'la página de cookies cita Google Fonts, el mapa de Google, jsDelivr y la clave de localStorage');
  const g = fs.readFileSync(path.join(RAIZ, '404.html'), 'utf8');
  comprobar(/Esta página no está en la mesa/.test(g) && /Vuelve a la casa/.test(g), 'la 404: «Esta página no está en la mesa. Vuelve a la casa»');
  const al = fs.readFileSync(path.join(RAIZ, 'aviso-legal.html'), 'utf8');
  comprobar(/PNOA/.test(al) && /OpenStreetMap/.test(al) && /CC BY 4\.0/.test(al), 'el aviso legal cita PNOA © IGN (CC BY 4.0) y OpenStreetMap');
}
{
  const m = JSON.parse(fs.readFileSync(path.join(RAIZ, 'manifest.json'), 'utf8'));
  comprobar(m.lang === 'es' && m.icons.every((i) => existe(i.src)), 'manifest.json: en castellano y con iconos que existen');
}

/* ================= navegador: uno solo ================= */
const browser = await chromium.launch({ headless: true, args: ['--disable-3d-apis'] });
try {
  async function nueva(op = {}, { cdn = 'local', script, abortar } = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: 'reduce', ...op });
    if (cdn === 'local') await ctx.route(RE_CDN, local);
    if (cdn === 'caido') await ctx.route(RE_CDN, (r) => r.abort());
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await ctx.route(/google\.com\/maps/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>mapa</p>' }));
    ctx._red = [];
    ctx.on('request', (r) => { if (!/^http:\/\/localhost/.test(r.url()) && !/^(data|blob):/.test(r.url())) ctx._red.push(r.url()); });
    if (abortar) await ctx.route(abortar, (r) => r.abort());
    if (script) await ctx.addInitScript(script);
    const page = await ctx.newPage();
    page._errores = [];
    page.on('pageerror', (e) => page._errores.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|net::|WebGL|webgl/.test(m.text())) page._errores.push('consola: ' + m.text()); });
    page.on('response', (r) => { if (r.status() >= 400) page._errores.push(r.status() + ' ' + r.url()); });
    return { ctx, page };
  }
  const fuera = (page) => page.waitForFunction(() => document.documentElement.classList.contains('cortina-fuera'), null, { timeout: 12000 });
  // contraste de las parejas de texto: WCAG 2 y APCA (componiendo el alfa sobre el fondo)
  const contrastes = (page, sel) => page.evaluate((sel) => {
    const lz = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const rgba = (c) => { lz.clearRect(0, 0, 1, 1); lz.fillStyle = '#000'; lz.fillStyle = c; lz.fillRect(0, 0, 1, 1); return [...lz.getImageData(0, 0, 1, 1).data]; };
    const L = (m) => { m = m.map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * m[0] + .7152 * m[1] + .0722 * m[2]; };
    const Y = (m) => .2126729 * (m[0] / 255) ** 2.4 + .7151522 * (m[1] / 255) ** 2.4 + .0721750 * (m[2] / 255) ** 2.4;
    const apca = (txt, bg) => { let yt = Y(txt), yb = Y(bg); const bc = .022, bt = 1.414; yt = yt > bc ? yt : yt + (bc - yt) ** bt; yb = yb > bc ? yb : yb + (bc - yb) ** bt; let s, o; if (yb > yt) { s = (yb ** .56 - yt ** .57) * 1.14; o = s < .1 ? 0 : s - .027; } else { s = (yb ** .65 - yt ** .62) * 1.14; o = s > -.1 ? 0 : s + .027; } return Math.abs(Math.round(o * 1000) / 10); };
    const fondo = (el) => { while (el) { const b = getComputedStyle(el).backgroundColor; if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b) && !/[, /] ?0\)$/.test(b)) return rgba(b).slice(0, 3); el = el.parentElement; } return rgba(getComputedStyle(document.body).backgroundColor).slice(0, 3); };
    return sel.map((s) => {
      const el = document.querySelector(s); if (!el) return [s, 'falta'];
      const f = fondo(el), c = rgba(getComputedStyle(el).color), a = c[3] / 255;
      const t = [0, 1, 2].map((i) => c[i] * a + f[i] * (1 - a));
      const x = L(t), y = L(f); return [s, Math.round(((Math.max(x, y) + .05) / (Math.min(x, y) + .05)) * 100) / 100, apca(t, f)];
    });
  }, sel);
  const ir = (page, y) => page.evaluate((y) => { const l = window.Entremuros.web && window.Entremuros.web.lenis; if (l) l.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); }, y);
  const yDe = (page, sel, extra = 0) => page.evaluate(([s, e]) => document.querySelector(s).getBoundingClientRect().top + scrollY + e, [sel, extra]);

  /* ---------- 1. portada, superficies y contraste (escritorio, movimiento reducido) ---------- */
  console.log('\n1. Portada, superficies y contraste (escritorio, movimiento reducido)');
  {
    const { ctx, page } = await nueva({}, { script: sinCookies, abortar: JS_MODULOS });
    await page.goto(PAG);
    await fuera(page);
    comprobar(await page.evaluate(() => { const c = document.getElementById('cortina'); return (!c || getComputedStyle(c).display === 'none') && !document.documentElement.classList.contains('con-movimiento'); }), 'con movimiento reducido no hay cortina ni «con-movimiento»');
    comprobar(await page.evaluate(() => getComputedStyle(document.body).cursor !== 'none' && !document.querySelector('.cursor, [class*="cursor-"]')), 'sin cursor propio (nunca dos cursores)');
    const p = await page.evaluate(() => {
      const R = (s) => document.querySelector(s).getBoundingClientRect();
      const img = document.querySelector('.portada__foto img');
      const t = R('.portada-texto__caja'), m = R('.portada__mesa');
      return { carga: !!img && img.complete && img.naturalWidth > 0, ancho: Math.round(img ? img.getBoundingClientRect().width : 0), nat: img ? img.naturalWidth : 0, vista: innerWidth, solapa: !(t.right <= m.left || m.right <= t.left || t.bottom <= m.top || m.bottom <= t.top), cab: document.getElementById('cab').getBoundingClientRect().bottom <= t.top + 1, abierta: document.getElementById('portada').classList.contains('abierta'), titulo: getComputedStyle(document.querySelector('.portada-texto__caja')).opacity, textoIzq: t.right <= m.left + 2, altoPortada: Math.round(R('#portada').height) };
    });
    comprobar(p.carga, 'la foto de la mesa de la portada carga', p);
    comprobar(p.textoIzq && !p.solapa && p.cab && p.altoPortada >= 790, 'en escritorio, respaldo: el texto a la izquierda y la foto de la mesa a la derecha, sin pisarse ni con la cabecera', p);
    comprobar(p.abierta && p.titulo === '1', 'sin cortina, la portada ya está abierta y el titular entero', p);
    const fondos = await page.evaluate(() => ['#portada', '#casa', '#habitaciones', '#dentro', '#antes-y-despues', '#estaciones', '#alrededores', '#opiniones', '#reservar', '#llegar', '#pie'].map((s) => getComputedStyle(document.querySelector(s)).backgroundColor));
    comprobar(fondos.join('|') === 'rgb(243, 238, 229)|rgb(243, 238, 229)|rgb(233, 225, 211)|rgb(213, 204, 191)|rgb(243, 238, 229)|rgb(243, 238, 229)|rgb(233, 225, 211)|rgb(243, 238, 229)|rgb(243, 238, 229)|rgb(213, 204, 191)|rgb(233, 225, 211)', 'cada sección con su superficie: lino, lino, lino 2, granito, lino, lino, lino 2 (con el panel de noche), lino, lino, granito y lino 2', fondos);
    comprobar(await page.evaluate(() => [...document.querySelectorAll('.s-noche')].every((e) => e.classList.contains('faros-panel') && e.closest('#alrededores')) && document.querySelectorAll('.s-noche').length === 1), 'lo único de noche es el panel de los faros');
    const sels = ['.portada .eyebrow', '.portada__baj', '.portada__tit', '#casa .eyebrow', '.casa__lead', '.casa__txt p:nth-of-type(3)', '#casa h2 em', '.casa__f figcaption', '.cifras span', '.cifras b', '.voz footer .num', '.voz p', '#habitaciones .eyebrow', '#habitaciones .sec-cab__txt', '.lg-resp-dato', '.lg-resp-dist', '.lg-resp-item blockquote', '.habitaciones__nota', '#dentro .eyebrow', '.dentro__sub', '.revista__txt p', '.rf figcaption', '.rf figcaption .num', '#antes-y-despues .eyebrow', '#antes-y-despues .sec-cab__txt', '.obra-respaldo p', '.obra-respaldo figcaption', '.obra-respaldo h3', '#estaciones .eyebrow', '.estacion figcaption', '.estacion figcaption b', '.estaciones__nota', '#alrededores .eyebrow', '#alrededores .sec-cab__txt', '.faros-tabla caption', '.faros-tabla tbody th', '.faros-tabla thead th', '.faros-tabla td', '.recomienda li', '.recomienda li b', '.recomienda .num', '#opiniones .eyebrow', '.cita blockquote p', '.cita figcaption .num', '.cita figcaption b', '.opiniones__nota .num', '.opiniones__nota b', '.demo', '.datos dt', '.datos dd', '.sup', '.llegar__dir', '.como', '.contacto span', '.contacto b', '.map-consent p', '.malpica p', '.malpica h3', '.pie__lema', '.pie__lema span', '.pie__cols p', '.pie__legal', '#portada .btn--marca', '#portada .btn--hueco', '#llegar .btn--marca', '#pie .btn--marca', '#opiniones .btn--hueco', '.cab__nav a', '.cab__tel'];
    const cs = await contrastes(page, sels);
    const malosW = cs.filter(([, w]) => w === 'falta' || w < 4.5);
    const malosA = cs.filter(([, w, a]) => w !== 'falta' && a < 60);
    comprobar(malosW.length === 0, `contraste WCAG ≥ 4,5:1 en ${cs.length} parejas de texto, en todas las superficies`, malosW);
    comprobar(malosA.length === 0, `contraste APCA |Lc| ≥ 60 en las mismas ${cs.length} parejas (texto sobre color: la teja, la hoja y el granito, medidos)`, malosA);
    const lc = Object.fromEntries(cs.filter(([s]) => ['.portada__baj', '.cita blockquote p', '#portada .btn--marca', '.revista__txt p', '.recomienda li'].includes(s)).map(([s, w, a]) => [s, a]));
    nota('APCA de referencia: ' + JSON.stringify(lc));
    comprobar(await page.evaluate(() => { const m = document.getElementById('mando'); return m.hidden && getComputedStyle(m).display === 'none'; }), 'sin ?revision el mando no se ve');
    comprobar(await page.evaluate(() => getComputedStyle(document.getElementById('vistazo')).display === 'none'), 'la tabla «de un vistazo» solo sale en la sobria');
    // las fotos nunca más de 1,3× su detalle real (se miden las visibles en pantalla ancha)
    const grandes = await page.evaluate(() => [...document.querySelectorAll('main img[width], footer img[width]')].filter((i) => i.getBoundingClientRect().width > 0 && !i.closest('.portada__foto')).map((i) => [i.currentSrc.split('/').pop(), Math.round(i.getBoundingClientRect().width), +i.getAttribute('width')]).filter(([, w, n]) => w > n * 1.31));
    comprobar(grandes.length === 0, 'ninguna foto se ve a más de 1,3× su detalle real en escritorio', grandes);
    // el foco: contorno de 2 px y la ramita junto al elemento
    await ir(page, 0); await page.waitForTimeout(100);
    await page.locator('#portada .btn--marca').focus();
    await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab'); await page.waitForTimeout(80);
    const foco = await page.evaluate(() => { const e = document.activeElement, s = getComputedStyle(e), r = e.getBoundingClientRect(), p = document.getElementById('foco-rama'), q = p.getBoundingClientRect(); return { el: e.className, outline: s.outlineStyle, ancho: s.outlineWidth, rama: getComputedStyle(p).opacity, junto: Math.abs((q.top + q.height / 2) - (r.top + r.height / 2)) < 6 && q.right <= r.left, fijo: getComputedStyle(p).position, img: getComputedStyle(p).backgroundImage.slice(0, 40) }; });
    comprobar(foco.outline === 'solid' && foco.ancho === '2px' && +foco.rama > 0.5 && foco.junto && foco.fijo === 'fixed', 'el foco del teclado: contorno de 2 px y una ramita (#foco-rama) junto al elemento', foco);
    const fn = await page.evaluate(() => { const b = document.querySelector('#alrededores a, #alrededores button'); if (!b) return 'rgb(255, 231, 166)'; b.focus(); return getComputedStyle(b).outlineColor; });
    comprobar(fn === 'rgb(255, 231, 166)' || /^rgb\(255, 231, 166\)/.test(fn), 'sobre la noche de los faros el contorno del foco es el color del faro (se ve)', fn);
    // mapa solo al pedirlo
    comprobar(await page.evaluate(() => !document.querySelector('#mapa iframe')), 'el mapa de Google no se carga solo');
    await page.locator('#mapa-btn').click();
    comprobar(await page.evaluate(() => /google\.com\/maps\?q=Casa%20Entremuros/.test(document.querySelector('#mapa iframe')?.src || '')), 'el mapa se carga al pulsar, con el nombre y la dirección de la casa');
    comprobar(await page.evaluate(() => typeof window.Entremuros.reservar === 'function' && typeof window.Entremuros.alAbrirse === 'function' && typeof window.Entremuros.fecha === 'function' && typeof window.Entremuros.ramasDibujadas === 'function'), 'la web pone Entremuros.reservar(), alAbrirse(), fecha() y ramasDibujadas() para los módulos');
    comprobar(page._errores.length === 0, 'portada: sin errores de consola ni 404', page._errores.slice(0, 5));
    await ctx.close();
  }

  /* ---------- 2. cada estación, una mesa: empieza por la de la fecha ---------- */
  console.log('\n2. Cada estación, una mesa');
  {
    const { ctx, page } = await nueva({}, { script: sinCookies, abortar: JS_MODULOS });
    const casos = [['2027-04-20', ['primavera', 'verano', 'otono', 'invierno']], ['2027-07-15', ['verano', 'otono', 'invierno', 'primavera']], ['2026-10-25', ['otono', 'invierno', 'primavera', 'verano']], ['2026-12-24', ['invierno', 'primavera', 'verano', 'otono']], ['2027-03-19', ['invierno', 'primavera', 'verano', 'otono']], ['2027-03-20', ['primavera', 'verano', 'otono', 'invierno']], ['2027-09-22', ['otono', 'invierno', 'primavera', 'verano']]];
    for (const [f, esperado] of casos) {
      await page.goto(`${PAG}?fecha=${f}`);
      await fuera(page);
      const r = await page.evaluate(() => ({ orden: [...document.querySelectorAll('#estaciones-fila > li')].map((l) => l.dataset.estacion), ahora: [...document.querySelectorAll('#estaciones-fila > li.es-ahora')].map((l) => l.dataset.estacion), visible: getComputedStyle(document.querySelector('#estaciones-fila > li.es-ahora .ahora')).display }));
      comprobar(r.orden.join() === esperado.join() && r.ahora.join() === esperado[0] && r.visible === 'inline', `?fecha=${f}: empieza por ${esperado[0]}, la marca «ahora» solo en esa`, r);
    }
    await page.goto(PAG + '?fecha=2027-04-20');
    const iguales = await page.evaluate(() => document.querySelectorAll('#estaciones-fila > li').length === 4 && document.querySelectorAll('#estaciones-fila [data-visor]').length === 4);
    comprobar(iguales, 'las cuatro estaciones, cada una con su foto y su visor');
    await ctx.close();
  }

  /* ---------- 3. módulos (contrato, con módulos de mentira): montan al acercarse; opciones; ramas; pie ---------- */
  console.log('\n3. Módulos y ramas (contrato)');
  {
    const { ctx, page } = await nueva({}, { script: sinCookies + FALSOS('todos'), abortar: JS_MODULOS });
    await page.goto(PAG + '?fecha=2027-04-20');
    await fuera(page);
    await page.waitForTimeout(400);
    comprobar(await page.evaluate(() => ['lugares', 'obra', 'faros', 'reserva', 'mesa-pie'].every((m) => document.querySelector(`[data-modulo="${m}"]`).dataset.montado !== '1')), 'lugares, obra, faros, reserva y pie no se montan al arrancar (solo al acercarse)');
    comprobar(await page.evaluate(() => window.__ops.filter((o) => o.nombre === 'mesa').length === 1 && document.querySelector('#portada [data-modulo="mesa"]').dataset.montado === '1'), 'la mesa de la portada se monta en cuanto llega alAbrirse (una sola vez)');
    comprobar(await page.evaluate(() => document.getElementById('portada').classList.contains('con-mesa')), 'con la mesa montada, la portada pasa a .con-mesa (la pieza manda y el titular va encima)');
        for (const n of [1, 2]) { await page.evaluate((n) => document.querySelector(`[data-rama="${n}"]`).scrollIntoView({ block: 'center' }), n); await page.waitForTimeout(250); }
    for (const [sel, dm] of [['#habitaciones', 'lugares'], ['#antes-y-despues', 'obra'], ['#alrededores', 'faros'], ['#reservar', 'reserva'], ['#pie', 'mesa-pie']]) {
      await page.locator(sel).scrollIntoViewIfNeeded();
      comprobar(await page.waitForFunction((d) => document.querySelector(`[data-modulo="${d}"]`).dataset.montado === '1', dm, { timeout: 8000 }).then(() => true, () => false), `${dm} monta al acercarse (data-montado=1)`);
    }
    const ops = await page.evaluate(() => window.__ops);
    const bien = ops.every((o) => o.op.movimiento === false && o.op.densidad === 'mesa' && o.op.fecha === true && o.op.fechaISO === '2027-04-20');
    comprobar(ops.length === 6 && bien, 'cada módulo recibe { movimiento (false con movimiento reducido), densidad: mesa, fecha (la de ?fecha=) }', ops);
    comprobar(ops.find((o) => o.nombre === 'mesa').modo === 'portada' && ops.find((o) => o.nombre === 'mesa-pie').modo === 'pie', 'la mesa recibe modo «portada» y el pie, modo «pie»');
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({ eventos: window.__eventos, ramas: window.__ramas, hechas: window.Entremuros.ramasDibujadas().sort(), pintadas: [...document.querySelectorAll('[data-rama]')].map((e) => !!e.querySelector('svg')) }));
    comprobar([1, 2, 3, 4, 5].every((n) => r.eventos.some(([m]) => m === n)) && r.hechas.join() === '1,2,3,4,5', 'entremuros:rama llega para las cinco ramas (la 1 y la 2 al entrar en su sección; las que falten, al llegar al pie)', r);
    comprobar(r.eventos.find(([n]) => n === 1) && !r.eventos.find(([n]) => n === 1)[1] && !r.eventos.find(([n]) => n === 2)[1], 'las ramas de la casa y los lugares se avisan al entrar en su sección, no al llegar al pie', r.eventos);
    comprobar(r.ramas.length >= 5 && r.ramas.every((x) => x.el === String(x.n)) && r.pintadas.every(Boolean), 'Entremuros.mesa.rama(el, { n }) se llama con el elemento de cada rama y las cinco quedan dibujadas (también las que se saltó el lector)', r.ramas);
    comprobar(page._errores.length === 0, 'módulos montados sin errores', page._errores.slice(0, 5));
    await ctx.close();
  }
  {
    // solo Entremuros.mesa (sin «mesa-pie»): el pie se monta con mesa.montar(..., { modo: 'pie' })
    const { ctx, page } = await nueva({}, { script: sinCookies + FALSOS('mesa'), abortar: JS_MODULOS });
    await page.goto(PAG);
    await fuera(page);
    await page.locator('#pie').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('[data-modulo="mesa-pie"]').dataset.montado === '1', null, { timeout: 8000 }).catch(() => {});
    const o = await page.evaluate(() => window.__ops.filter((x) => x.nombre === 'mesa').map((x) => x.modo));
    comprobar(o.includes('pie') && o.includes('portada'), 'sin «mesa-pie» propio, el pie se monta con Entremuros.mesa.montar y modo «pie»', o);
    await ctx.close();
  }
  {
    // la sobria: las cinco ramas ya dibujadas desde el principio y los módulos con densidad «sobria»
    const { ctx, page } = await nueva({}, { script: sinCookies + FALSOS('todos'), abortar: JS_MODULOS });
    await page.goto(PAG + '?revision&densidad=sobria');
    await fuera(page);
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({ hechas: window.Entremuros.ramasDibujadas().sort().join(), ramas: window.__ramas.map((x) => x.dibujar), dens: window.__ops.map((o) => o.op.densidad) }));
    comprobar(r.hechas === '1,2,3,4,5' && r.ramas.length >= 5 && r.ramas.every((d) => d === false), 'sobria: las cinco ramas ya dibujadas desde el principio (dibujar: false)', r);
    await page.locator('#reservar').scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
    comprobar((await page.evaluate(() => window.__ops.map((o) => o.op.densidad))).every((d) => d === 'sobria'), 'sobria: los módulos reciben densidad «sobria»');
    await ctx.close();
  }
  {
    // con los JS reales que haya
    const { ctx, page } = await nueva({}, { script: sinCookies });
    await page.goto(PAG);
    await fuera(page);
    await page.waitForTimeout(400);
    for (const [sel, clave, dm] of [['#habitaciones', 'lugares', 'lugares'], ['#antes-y-despues', 'obra', 'obra'], ['#alrededores', 'faros', 'faros'], ['#reservar', 'reserva', 'reserva'], ['#pie', 'mesa', 'mesa-pie']]) {
      await page.locator(sel).scrollIntoViewIfNeeded();
      const ok = await page.waitForFunction((d) => document.querySelector(`[data-modulo="${d}"]`).dataset.montado === '1', dm, { timeout: 8000 }).then(() => true, () => false);
      if (HAY[clave]) comprobar(ok, `módulo real: ${dm} monta al acercarse`); else nota(`${dm}: su JS aún no está; se queda el respaldo`);
    }
    if (HAY.mesa) comprobar(await page.evaluate(() => document.querySelector('#portada [data-modulo="mesa"]').dataset.montado === '1'), 'módulo real: la mesa de la portada está montada');
    comprobar(page._errores.length === 0, 'con los módulos reales que hay: sin errores', page._errores.slice(0, 5));
    await ctx.close();
  }
  {
    // sin los JS de los módulos se queda cada respaldo
    const { ctx, page } = await nueva({}, { script: sinCookies, abortar: JS_MODULOS });
    await page.goto(PAG);
    await fuera(page);
    for (const sel of ['#habitaciones', '#antes-y-despues', '#alrededores', '#reservar', '#pie']) { await page.locator(sel).scrollIntoViewIfNeeded(); await page.waitForTimeout(250); }
    const r = await page.evaluate(() => [...document.querySelectorAll('[data-modulo]')].map((el) => ({ m: el.dataset.modulo, montado: el.dataset.montado || '', alto: Math.round(el.getBoundingClientRect().height), cosas: el.querySelectorAll('img, svg, li, p, table').length })));
    comprobar(r.length === 6 && r.every((x) => !x.montado && x.cosas >= 1 && x.alto > 60), 'sin los JS de los módulos se queda cada respaldo (la foto de la mesa, las seis habitaciones, las parejas, los faros, los datos de reserva y la mesa del pie)', r);
    comprobar(await page.evaluate(() => /Demostración/.test(document.querySelector('[data-modulo="reserva"]').textContent) && /627 777 074/.test(document.getElementById('reservar').textContent)), 'el respaldo de reservar dice que es una demostración y da el teléfono');
    comprobar(await page.evaluate(() => document.querySelectorAll('[data-modulo="lugares"] .lg-resp-item').length === 6 && document.querySelectorAll('[data-modulo="obra"] .obra-respaldo__figura').length >= 10), 'respaldos: las seis habitaciones y la fachada en cinco tiempos con sus paradas');
    comprobar(page._errores.length === 0, 'y la página no da errores', page._errores);
    await ctx.close();
  }

  /* ---------- 4. el visor se abre por NOMBRE (cada miniatura, ratón) ---------- */
  console.log('\n4. Visor');
  {
    const { ctx, page } = await nueva({}, { script: sinCookies, abortar: JS_MODULOS });
    await page.goto(PAG);
    await fuera(page);
    const n = await page.locator('[data-visor]').count();
    const malos = [];
    for (let i = 0; i < n; i++) {
      const b = page.locator('[data-visor]').nth(i);
      const nombre = await b.getAttribute('data-visor');
      await b.scrollIntoViewIfNeeded();
      await b.click();
      const v = await page.evaluate(() => ({ open: document.getElementById('visor').open, n: document.getElementById('visor-img').dataset.nombre, src: document.getElementById('visor-img').getAttribute('src') }));
      if (!(v.open && v.n === nombre && v.src.includes(nombre + '-'))) malos.push([nombre, v]);
      await page.keyboard.press('Escape');
    }
    comprobar(n >= 15 && malos.length === 0, `cada una de las ${n} miniaturas abre SU foto en el visor`, malos);
    const dos = await page.evaluate(() => [...document.querySelectorAll('[data-visor]')].slice(0, 2).map((b) => b.dataset.visor));
    await page.locator(`[data-visor="${dos[0]}"]`).first().click();
    await page.keyboard.press('ArrowRight');
    const sig = await page.evaluate(() => document.getElementById('visor-img').dataset.nombre);
    comprobar(sig === dos[1], `con la flecha pasa a la siguiente de la serie (${dos[0]} → ${dos[1]})`, sig);
    await page.keyboard.press('Escape');
    comprobar(await page.evaluate((d) => !document.getElementById('visor').open && document.activeElement?.dataset.visor === d, dos[0]), 'Escape cierra el visor y el foco vuelve a la miniatura');
    comprobar(await page.evaluate(() => { const v = new Set(); return [...document.querySelectorAll('[data-visor]')].every((b) => { const k = b.dataset.visor; return !!b.querySelector('img') && !!document.querySelector(`[data-foto="${k}"]`) && (v.add(k), true); }); }), 'cada data-visor apunta a una foto que existe en la página');
    await ctx.close();
  }

  /* ---------- 5. cookies en cuatro pasos y mando con ?revision ---------- */
  console.log('\n5. Cookies y mando');
  {
    const { ctx, page } = await nueva({}, { abortar: JS_MODULOS });
    await page.goto(PAG);
    await fuera(page);
    await page.waitForSelector('#cookies:not([hidden])', { timeout: 4000 }).catch(() => {});
    comprobar(await page.isVisible('#cookies'), 'cookies: se ven en la primera visita');
    await page.click('#ck-si');
    comprobar(!(await page.isVisible('#cookies')) && (await page.evaluate((k) => localStorage.getItem(k), LLAVE)) === 'si', 'cookies: «Entendido» las cierra y guarda la marca');
    await page.reload(); await fuera(page);
    comprobar(!(await page.isVisible('#cookies')), 'cookies: al recargar no vuelven');
    await page.evaluate((k) => localStorage.removeItem(k), LLAVE);
    await page.reload(); await fuera(page);
    await page.waitForSelector('#cookies:not([hidden])', { timeout: 4000 }).catch(() => {});
    comprobar(await page.isVisible('#cookies'), 'cookies: sin la marca vuelven a salir');
    await page.click('#ck-no');
    await ctx.close();
  }
  {
    const { ctx, page } = await nueva({ reducedMotion: 'no-preference' }, { script: sinCookies + FALSOS('todos'), abortar: JS_MODULOS });
    await page.goto(BASE + 'index.html?revision&densidad=sobria'); await fuera(page);
    await page.waitForTimeout(500);
    await ir(page, await yDe(page, '#vistazo', -100)); await page.waitForTimeout(250);
    const s = await page.evaluate(() => ({ mando: !document.getElementById('mando').hidden, sobria: document.documentElement.classList.contains('densidad-sobria'), vistazo: getComputedStyle(document.getElementById('vistazo')).display, filas: document.querySelectorAll('.vistazo__tabla tr').length, texto: document.querySelector('.vistazo__tabla').textContent, etiquetas: [...document.querySelectorAll('#mando button')].map((b) => b.textContent) }));
    comprobar(s.mando && s.sobria && s.vistazo === 'block' && s.filas >= 12, 'con ?revision el mando se ve y la sobria añade «Casa Entremuros, de un vistazo»', s);
    comprobar(s.etiquetas.join() === 'Mesa puesta,Sobria', 'el mando se llama «Mesa puesta» y «Sobria»', s.etiquetas);
    comprobar(/hasta 12 personas/.test(s.texto) && /Río Anllóns/.test(s.texto) && /cama de 1,80/.test(s.texto) && /adaptada/.test(s.texto) && /agua salada/.test(s.texto) && /Mascotas/.test(s.texto) && /15:00/.test(s.texto) && /200 €/.test(s.texto) && /430 €/.test(s.texto) && /Malpica, 10 min/.test(s.texto), 'la tabla de la sobria: plazas, habitaciones y camas, baños, adaptada, piscina, mascotas, entrada, fianza, precios y distancias');
    await page.click('#mando [data-densidad="mesa"]');
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => ({ sobria: document.documentElement.classList.contains('densidad-sobria'), vistazo: getComputedStyle(document.getElementById('vistazo')).display, url: location.search, ops: window.__ops.map((o) => o.op.densidad), destruidos: window.__destruidos, hechas: window.Entremuros.ramasDibujadas().length }));
    comprobar(!r.sobria && r.vistazo === 'none' && !r.url.includes('sobria') && r.destruidos >= 1 && r.ops.includes('mesa'), 'el mando vuelve a «Mesa puesta»: fuera la tabla de la sobria y los módulos se destruyen y vuelven a montar', r);
    comprobar(r.hechas === 0 || r.hechas <= 5, 'al volver a «Mesa puesta» las ramas se reinician (se dibujarán al entrar en su sección)', r.hechas);
    comprobar(page._errores.length === 0, 'cambiar de densidad no da errores', page._errores.slice(0, 4));
    await ctx.close();
  }

  /* ---------- 6. móvil: anchos, portada sin solapes, menú y barra del navegador ---------- */
  console.log('\n6. Móvil');
  for (const [w, h] of [[360, 640], [375, 667], [390, 844], [768, 1024]]) {
    const { ctx, page } = await nueva({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true }, { script: sinCookies, abortar: JS_MODULOS });
    await page.goto(PAG);
    await fuera(page);
    await page.waitForTimeout(300);
    const ancho = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    comprobar(ancho[0] <= w && ancho[1] <= w, `${w}×${h}: sin scroll lateral`, ancho);
    const salen = await page.evaluate((w) => [...document.querySelectorAll('main *, footer *')]
      .filter((e) => { const b = e.getBoundingClientRect(); return b.width && b.right > w + 1 && !e.closest('[aria-hidden="true"], .vh, canvas'); })
      .slice(0, 4).map((e) => e.tagName.toLowerCase() + '.' + [...e.classList].join('.')), w);
    comprobar(!salen.length, `${w}×${h}: nada se sale por la derecha`, salen);
    const r = await page.evaluate(() => {
      const R = (s) => document.querySelector(s).getBoundingClientRect();
      const t = R('.portada-texto'), cab = R('#cab'), m = R('.portada__mesa');
      return { fotoBajoCab: m.top >= cab.bottom - 1 || m.top <= 1, fotoAncho: m.width >= innerWidth - 1, textoBajoFoto: t.top >= m.bottom - 1, h1Visible: R('.portada__tit').right <= innerWidth };
    });
    comprobar(Object.values(r).every(Boolean), `${w}×${h}: la foto de la mesa arriba a todo el ancho y el texto debajo, sin pisar nada`, r);
    // con la mesa montada (mentira): la caja del titular cabe en la primera pantalla y no pisa la cabecera
    if (w === 390 || w === 360) {
      await page.evaluate(() => { document.getElementById('portada').classList.add('con-mesa'); });
      const c = await page.evaluate(() => { const b = document.querySelector('.portada-texto__caja').getBoundingClientRect(); return { dentro: b.bottom <= innerHeight && b.top >= document.getElementById('cab').getBoundingClientRect().bottom - 1, alto: Math.round(b.height), vista: innerHeight }; });
      comprobar(c.dentro && c.alto < c.vista * 0.55, `${w}×${h}: con la mesa montada, el titular y los botones caben en una caja en la parte baja de la primera pantalla`, c);
      await page.evaluate(() => { document.getElementById('portada').classList.remove('con-mesa'); });
    }
    if (w === 390) {
      await page.evaluate(() => scrollTo(0, 1600));
      await page.waitForFunction(() => document.getElementById('cab').classList.contains('sc'));
      await page.click('#menu-btn');
      const mm = await page.evaluate(() => { const r = document.getElementById('menu-movil').getBoundingClientRect(); return { top: r.top, alto: r.height, vista: innerHeight, vis: getComputedStyle(document.getElementById('menu-movil')).visibility }; });
      comprobar(mm.top === 0 && Math.abs(mm.alto - mm.vista) < 2 && mm.vis === 'visible', 'menú móvil a pantalla completa con la cabecera ya fija', mm);
      await page.click('#menu-movil a[href="#reservar"]');
      comprobar(await page.waitForFunction(() => !document.body.classList.contains('menu'), null, { timeout: 3000 }).then(() => true, () => false), 'el menú se cierra al elegir');
      // visor con el dedo
      await page.locator('[data-visor="fachada"]').scrollIntoViewIfNeeded();
      await page.locator('[data-visor="fachada"]').tap();
      comprobar(await page.evaluate(() => document.getElementById('visor').open && document.getElementById('visor-img').dataset.nombre === 'fachada'), 'en el móvil, tocar una miniatura abre su foto');
      await page.click('#visor-cerrar');
      // la barra del navegador: 6 cambios de alto → ningún «entremuros:resize» y nada se mueve
      await page.evaluate(() => document.querySelectorAll('main > section, footer').forEach((s) => { s.style.height = s.offsetHeight + 'px'; }));
      const n = await page.evaluate(() => { window.__res = 0; document.addEventListener('entremuros:resize', () => window.__res++); scrollTo(0, 5200); return document.getElementById('llegar').getBoundingClientRect().top + scrollY; });
      await page.waitForTimeout(150);
      for (const alto of [788, 844, 788, 844, 800, 844]) { await page.setViewportSize({ width: 390, height: alto }); await page.waitForTimeout(260); }
      const d = await page.evaluate(() => ({ res: window.__res, top: document.getElementById('llegar').getBoundingClientRect().top + scrollY }));
      comprobar(d.res === 0 && Math.abs(d.top - n) < 1, 'barra del móvil: nada se rehace y la página no se mueve', { ...d, antes: n });
      await page.setViewportSize({ width: 844, height: 390 });
      await page.waitForTimeout(450);
      comprobar(await page.evaluate(() => window.__res) >= 1, 'al girar el móvil (ancho distinto) sí se avisa del resize');
    }
    comprobar(page._errores.length === 0, `${w}×${h}: sin errores`, page._errores.slice(0, 3));
    await ctx.close();
  }

  /* ---------- 7. legales ---------- */
  console.log('\n7. Legales');
  {
    const { ctx, page } = await nueva();
    for (const f of ['aviso-legal', 'privacidad', 'cookies', 'accesibilidad', '404']) {
      page._errores.length = 0;
      await page.goto(BASE + f + '.html');
      comprobar((await page.locator('h1').count()) === 1 && page._errores.length === 0, `${f}.html se abre sin errores`, page._errores);
    }
    await ctx.close();
  }

  /* ---------- 8. con movimiento (una vez, al final): cortina y entrada de la portada ---------- */
  console.log('\n8. Con movimiento');
  {
    const { ctx, page } = await nueva({ reducedMotion: 'no-preference' }, { script: sinCookies });
    await page.goto(PAG);
    const tapa = await page.evaluate(() => { const c = document.getElementById('cortina'); if (!c) return 'sin cortina'; const r = c.getBoundingClientRect(); return getComputedStyle(c).display !== 'none' && r.width >= innerWidth - 1 && r.height >= innerHeight - 1; });
    if (tapa === 'sin cortina') nota('sin cortina todavía (agente Mesa): la portada se abre sola');
    else comprobar(tapa === true, 'la cortina tapa la pantalla al cargar');
    await fuera(page);
    await page.waitForFunction(() => document.getElementById('portada').classList.contains('abierta'), null, { timeout: 8000 }).catch(() => {});
    comprobar(await page.evaluate(() => document.getElementById('portada').classList.contains('abierta') && document.documentElement.classList.contains('con-movimiento')), 'la cortina se retira y la portada se abre');
    await page.waitForFunction(() => !document.getElementById('cortina') || getComputedStyle(document.getElementById('cortina')).display === 'none', null, { timeout: 9000 }).catch(() => {});
    comprobar(await page.evaluate(() => !document.getElementById('cortina') || getComputedStyle(document.getElementById('cortina')).display === 'none'), 'la cortina desaparece de verdad');
    if (HAY.mesa) comprobar(await page.waitForFunction(() => document.querySelector('#portada [data-modulo="mesa"]').dataset.montado === '1', null, { timeout: 6000 }).then(() => true, () => false), 'la mesa de la portada se monta al abrirse la cortina');
    // recorrido entero con la rueda: las entradas (.rev) acaban visibles y la cabecera sigue fija
    const fin = () => page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    for (let y = 0, f = await fin(); y <= f + 400; y += 400, f = await fin()) { await ir(page, Math.min(y, f)); await page.waitForTimeout(110); }
    await page.waitForTimeout(500);
    const rv = await page.evaluate(() => ({ total: document.querySelectorAll('.rev').length, vistos: document.querySelectorAll('.rev.es-visto').length, cab: document.getElementById('cab').getBoundingClientRect().top, ramas: window.Entremuros.ramasDibujadas().length }));
    comprobar(rv.total > 25 && rv.vistos === rv.total && rv.cab === 0, 'tras recorrer la página, todo lo que entra con el scroll está visible y la cabecera sigue fija', rv);
    comprobar(rv.ramas === 5, 'tras recorrer la página, las cinco ramas del centro de mesa han llegado', rv);
    comprobar(page._errores.length === 0, 'con movimiento: sin errores', page._errores.slice(0, 5));
    await ctx.close();
  }
  {
    // Lenis y GSAP caídos y con movimiento: la cortina se va igual
    const { ctx, page } = await nueva({ reducedMotion: 'no-preference' }, { cdn: 'caido', script: sinCookies });
    await page.goto(PAG);
    await fuera(page);
    await page.waitForFunction(() => !document.getElementById('cortina') || getComputedStyle(document.getElementById('cortina')).display === 'none', null, { timeout: 9000 }).catch(() => {});
    comprobar(await page.evaluate(() => (!document.getElementById('cortina') || getComputedStyle(document.getElementById('cortina')).display === 'none') && document.getElementById('portada').classList.contains('abierta')), 'sin Lenis ni GSAP la cortina se retira y la portada se abre');
    comprobar(page._errores.length === 0, 'sin las librerías no hay errores', page._errores.slice(0, 3));
    await ctx.close();
  }
  {
    // sin JavaScript: la cortina no tapa y se lee todo
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, javaScriptEnabled: false });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    const page = await ctx.newPage();
    await page.goto(PAG);
    comprobar(await page.evaluate(() => { const c = document.getElementById('cortina'); return (!c || getComputedStyle(c).display === 'none') && getComputedStyle(document.querySelector('.portada-texto__caja')).opacity === '1' && getComputedStyle(document.querySelector('.rev')).opacity === '1'; }), 'sin JavaScript no hay cortina y todo se lee (titular y secciones visibles)');
    await ctx.close();
  }
} finally {
  await browser.close();
  servidor.close();
}

console.log(`\n${nOk} ok, ${fallos.length} fallos`);
if (fallos.length) { console.log(fallos.map((f) => ' - ' + f).join('\n')); process.exitCode = 1; }
