/* Genera los *.src.html de las páginas legales y el 404 con una plantilla común.
   Uso: node scripts/legales.mjs  (después, node construir.mjs)
   La titular NO consta (Mónica, sin apellido, según las reseñas; ninguna fuente es de la casa): va como
   PENDIENTE visible, igual que el NIF y el registro de turismo. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const TITULAR = `<dl>
  <dt>Titular</dt><dd><span class="aviso-corto">PENDIENTE</span></dd>
  <dt>NIF</dt><dd><span class="aviso-corto">PENDIENTE</span></dd>
  <dt>Nombre comercial</dt><dd>Casa Entremuros</dd>
  <dt>Dirección</dt><dd>{{direccion}} · {{cp}} {{municipio}}</dd>
  <dt>Teléfono</dt><dd><a href="tel:{{telefono_tel}}">{{telefono}}</a></dd>
  <dt>Correo</dt><dd><a href="mailto:{{correo}}">{{correo}}</a></dd>
  <dt>Actividad</dt><dd>Alojamiento turístico (casa rural)</dd>
  <dt>Registro de turismo</dt><dd><span class="aviso-corto">PENDIENTE</span></dd>
</dl>
<p class="aviso">PENDIENTE: confirmar quién es la titular y su NIF, y el número de registro de turismo de Galicia (no consta en ninguna fuente).</p>`;

const paginas = {
  'aviso-legal': {
    titulo: 'Aviso legal',
    cuerpo: `
<p>En cumplimiento del artículo 10 de la Ley 34/2002, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), estos son los datos de la titular de esta web:</p>
${TITULAR}
<h2>Uso de la web</h2>
<p>Esta web informa sobre Casa Entremuros, en Cances Grande (Carballo). Los precios y las condiciones pueden cambiar: los que valen son los que se confirman al reservar.</p>
<p>Por ahora, la reserva de esta web es una demostración: las noches libres son de ejemplo, los precios son supuestos y no se envía, se guarda ni se cobra nada.</p>
<h2>Propiedad intelectual</h2>
<p>Los textos y las fotografías son de la casa o se usan con su permiso. Las letras Hedvig Letters Serif, Golos Text y Pinyon Script se usan con su licencia libre (SIL Open Font License). Las imágenes aéreas son de la ortofotografía PNOA © Instituto Geográfico Nacional de España (IGN), CC BY 4.0; los mapas dibujados de la comarca y de la costa salen de datos de OpenStreetMap (ODbL), y las características de los faros, del Libro de Faros y Señales de Niebla del Instituto Hidrográfico de la Marina y de las demás fuentes que se citan en su sección. © OpenStreetMap contributors (ODbL).</p>
<p class="aviso">PENDIENTE: confirmar que todas las fotos son de la casa y se pueden usar (vienen de su cuenta de Instagram, y algunas llevan crédito: @raul_lorenzo_filmmaker y @viajocomoquiero), y el permiso de las personas que salen en alguna.</p>
<h2>Responsabilidad</h2>
<p>Los enlaces a otras webs (Google Maps, las reseñas de Google, Instagram) llevan a servicios de terceros con sus propias condiciones. Las citas de huéspedes y las frases de la casa son literales y llevan su fuente.</p>
<h2>Ley aplicable</h2>
<p>Estas condiciones se rigen por la ley española. Para cualquier reclamación, llámanos: buscaremos siempre una solución amistosa.</p>`,
  },
  privacidad: {
    titulo: 'Política de privacidad',
    cuerpo: `
<h2>Responsable</h2>
${TITULAR}
<h2>Qué datos tratamos y para qué</h2>
<p>Los que nos das al reservar, al escribirnos o al llamarnos: nombre, teléfono, correo, las fechas y lo que quieras contarnos. Los usamos para gestionar tu reserva y atenderte.</p>
<p>Al alojarte, la ley obliga a registrar los datos de los viajeros y comunicarlos a las autoridades (Real Decreto 933/2021).</p>
<p>La reserva de esta web es, por ahora, una demostración: el nombre y las fechas que escribas en ella no salen de tu navegador ni se guardan.</p>
<h2>Base legal y plazos</h2>
<p>La base es tu consentimiento al reservar, la ejecución de la reserva y, para el registro de viajeros, una obligación legal. Los datos se conservan mientras dura la relación y, después, el tiempo que exige la ley.</p>
<h2>Con quién se comparten</h2>
<p>Con nadie, salvo obligación legal (el registro de viajeros) y siempre con lo imprescindible.</p>
<h2>Tus derechos</h2>
<p>Puedes pedir el acceso, la rectificación, la supresión, la oposición, la limitación o la portabilidad de tus datos escribiendo a <a href="mailto:{{correo}}">{{correo}}</a> o llamando al <a href="tel:{{telefono_tel}}">{{telefono}}</a>. Si crees que no se han respetado, puedes reclamar ante la Agencia Española de Protección de Datos (<a href="https://www.aepd.es">aepd.es</a>).</p>
<h2>Lo que guarda esta web en tu navegador</h2>
<p>Una sola cosa: <code>entremuros-cookies</code> en el almacenamiento local, para recordar que ya has visto el aviso de cookies. Más detalles en <a href="cookies.html">cookies</a>.</p>`,
  },
  cookies: {
    titulo: 'Política de cookies',
    cuerpo: `
<p>Esta web no usa cookies propias de análisis ni de publicidad.</p>
<h2>Lo que se guarda en tu navegador</h2>
<ul>
  <li><b>entremuros-cookies</b> (almacenamiento local): recuerda que has visto el aviso, para no enseñártelo en cada visita. Es técnica y no caduca sola; puedes borrarla desde tu navegador.</li>
</ul>
<h2>Servicios de terceros</h2>
<ul>
  <li><b>Google Fonts</b>: las letras de la web (Hedvig Letters Serif, Golos Text y Pinyon Script) se cargan desde los servidores de Google, que reciben tu dirección IP.</li>
  <li><b>Google Maps</b>: el mapa de «Cómo llegar» solo se carga si pulsas «Ver el mapa». A partir de ese momento, Google puede instalar sus cookies.</li>
  <li><b>jsDelivr</b>: las librerías que suavizan el desplazamiento y mueven las animaciones (Lenis y GSAP) se descargan de jsDelivr, que recibe tu dirección IP. No instalan cookies.</li>
</ul>
<p>Las imágenes aéreas, los mapas dibujados y las fotos de la casa se sirven desde esta misma web.</p>
<p>Puedes volver a ver el aviso desde «Preferencias de cookies», en el pie de la página.</p>`,
  },
  accesibilidad: {
    titulo: 'Declaración de accesibilidad',
    cuerpo: `
<p>La titular se compromete a que esta web sea accesible conforme a la norma UNE-EN 301 549 (nivel AA de las WCAG 2.1).</p>
<h2>Situación de cumplimiento</h2>
<p class="aviso">PENDIENTE: completar tras la revisión de accesibilidad previa a la publicación.</p>
<p>La web se ha construido para poder usarse entera con el teclado y con lector de pantalla: contrastes suficientes, foco visible (un contorno de 2 px y una ramita junto al elemento), textos alternativos en las fotos, y animaciones que se desactivan si tu sistema pide reducir el movimiento. La mesa dibujada, las ramas, el mapa de la comarca y la escena de los faros son un adorno o una ayuda visual: la información está también en el texto. Los faros de la costa no destellan más de tres veces por segundo y, con movimiento reducido, no destellan.</p>
<h2>La casa</h2>
<p>Una de las dos habitaciones de la casita está adaptada para personas con movilidad reducida.</p>
<p class="aviso">PENDIENTE: confirmar cuál es y cómo es el acceso a la casa, el jardín y la piscina.</p>
<h2>Contacto</h2>
<p>Si encuentras una barrera, escribe a <a href="mailto:{{correo}}">{{correo}}</a> o llama al <a href="tel:{{telefono_tel}}">{{telefono}}</a>. Te responderemos y te daremos la información en un formato accesible.</p>`,
  },
};

const cabeza = (titulo) => `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo} · Casa Entremuros</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400..600&family=Hedvig+Letters+Serif&family=Pinyon+Script&display=swap">
<link rel="stylesheet" href="css/estilos.css">
<link rel="stylesheet" href="css/legal.css">
<link rel="icon" href="marca/favicon.svg" type="image/svg+xml">
<link rel="icon" href="marca/favicon-32.png" sizes="32x32" type="image/png">
</head>`;

const MARCA = `<a class="marca" href="./" aria-label="Casa Entremuros, a la portada"><!--marca-cabecera--></a>`;

for (const [nombre, p] of Object.entries(paginas)) {
  const html = `${cabeza(p.titulo)}
<body>
<header class="legal-cab">
  <div class="env">
    ${MARCA}
    <a class="volver" href="./">Volver a la portada</a>
  </div>
</header>
<main class="legal">
  <div class="env">
    <h1>${p.titulo}</h1>
${p.cuerpo}
  </div>
</main>
<footer class="legal-pie">
  <div class="env">
    <a href="aviso-legal.html">Aviso legal</a>
    <a href="privacidad.html">Privacidad</a>
    <a href="cookies.html">Cookies</a>
    <a href="accesibilidad.html">Accesibilidad</a>
  </div>
</footer>
</body>
</html>
`;
  fs.writeFileSync(path.join(RAIZ, `${nombre}.src.html`), html);
  console.log(`${nombre}.src.html`);
}

// la 404: la mesa sin poner
fs.writeFileSync(path.join(RAIZ, '404.src.html'), `${cabeza('Página no encontrada')}
<body class="no-hay">
  <main class="no">
    <img data-foto="placa-recorte" class="no__placa" alt="El letrero de piedra de la entrada: «Casa Entremuros», con una vieira en el centro y dos abanicos" sizes="160px">
    <h1>Esta página no está en la mesa</h1>
    <p>No la encontramos. La casa sigue donde estaba, en Cances Grande, y la mesa también está puesta.</p>
    <a class="btn btn--marca" href="./#casa">Vuelve a la casa</a>
    <a href="./#reservar">Ver fechas</a>
  </main>
</body>
</html>
`);
console.log('404.src.html');
