# Casa Entremuros · Cances Grande, Carballo · «La mesa puesta»

Web nueva para una casa rural real que no la ha encargado: su web antigua (`casaentremuros.com`, un WordPress) está caída con un error de base de datos. Es una propuesta que Álvaro les enseñará. En local, con `noindex, nofollow` en todas las páginas, sin publicar y sin commits.

- **Datos y fuentes:** `ref/DATOS-ENTREMUROS.md`; fotos: `ref/FOTOS.md`. Lo que no está ahí no se afirma: va a `PENDIENTES.md` o sale como «por confirmar» / «supuesto».
- **Encargo:** `ENCARGO.md` (seis agentes: Web, Mesa, Lugares, Obra, Faros y Reserva). **Sin 3D** de terreno: el zoom aéreo de la portada es 2D con la ortofoto del IGN.
- **Una sola página** (`index.html`) más legales y 404. **Solo castellano.** Los nombres propios, como son.

## Concepto

Lo propio de esta casa no es el muro sino **cómo recibe Mónica**: la mesa puesta con flores frescas, la tarjeta con el nombre de cada invitado en el plato, la chimenea encendida, la decoración de cada estación, los muebles que restaura ella. La web es **una revista de casas con alma, hecha por la casa**: papel de lino crema, letra serif grande y mucho aire. El sistema visual es **la mesa**:

- **Portada:** una mesa larga vista desde arriba que se pone sola y, al bajar, **del plato al mar** (módulo Mesa). Respaldo de la web: la foto real de su mesa.
- **Hilo:** **el centro de mesa** se compone a lo largo de la página con una rama por sección (hortensia, lavanda, hoja de arce, olivo, hierbas de San Juan) y **en el pie está completo**.
- **Reservar:** eliges cuántos sois y se pone un cubierto por cada uno; al final, una tarjeta con tu nombre en el plato (módulo Reserva, demostración).
- **Superficies:** **lino** (claro), **granito** (las paredes de piedra) y **noche** (solo el panel de los faros).
- **La marca** es el letrero de piedra de la entrada («CASA / ENTREMUROS.», una vieira y dos abanicos), redibujado fiel a la foto por Mesa (`marca/placa.svg`). La cabecera lleva sus letras en una línea (`marca/letra.svg`, del mismo vector); el favicon es la vieira.

### La página, de arriba abajo

| # | Sección | Quién | Qué lleva |
|---|---|---|---|
| — | **Cortina «La placa»** | Mesa | Su letrero tallado con luz rasante que se parte por la junta ENTRE | MUROS (`partes/cortina.html`, `js/cortina.js`). |
| 1 | **Portada** | Mesa + Web | La mesa dibujada que se pone sola y el zoom del plato al mar. Respaldo: la foto `mesa-larga-otono`, el titular y «Ver fechas». |
| 2 | **La casa** (rama 1) | Web | La casa de hidalgos del XIX, dos edificios, las cifras (XIX · 2 · 6 · 12 · 1 · 10 min) y la voz de la casa (dos citas literales con su fecha). |
| — | *De un vistazo* | Web | Solo en la sobria: plazas, habitaciones y camas, baños, adaptada, piscina, alpendre, mascotas, entrada y salida, fianza, temporadas y precios, distancias. |
| 3 | **Seis lugares bajo un techo** (rama 2) | Lugares | Las seis habitaciones y los seis lugares que les dan nombre. Respaldo: las seis habitaciones en rejilla. |
| 4 | **Dentro y fuera** (rama 3) | Web | Composición de revista (no rejilla de tarjetas): salón, cocina con el horno, baños, jardín, piscina, alpendre, campo, cabaña y jardín de noche. Visor abierto por nombre. |
| 5 | **Antes y después** (rama 4) | Obra | La fachada en cinco tiempos y las parejas con el yeso que se pica. Respaldo: la fachada en cinco tiempos y sus paradas (de Obra). |
| 6 | **Cada estación, una mesa** | Web | Cuatro fotos suyas con su frase; empieza por la estación de la fecha (`?fecha=2027-04-20`). |
| 7 | **Los faros de la costa** | Faros | La costa de noche con el ritmo real de cada faro. Respaldo: tabla y lista de lugares; el panel de noche es lo único de noche. |
| 8 | **Lo que dicen** | Web | Cinco citas literales (cuatro de Google, una de la web antigua) y la nota de Google con su fecha de lectura. |
| 9 | **Reservar · «La mesa para…»** (rama 5) | Reserva | Simulador de DEMOSTRACIÓN para la casa entera. |
| 10 | **Cómo llegar** | Web | Dirección, teléfono, WhatsApp, correo, mapa de Google solo al pedirlo, y la franja quitable del Apartamento Area Maior. |
| 11 | **Pie · la mesa completa** | Mesa + Web | El centro de mesa con sus cinco ramas, la placa, el lema y los legales. |

**§5 bis:** fuera la pila sticky de tarjetas y el marquee; gesto táctil del hero (**recolocar la mesa**, Mesa); el objeto que se completa en el pie (**el centro de mesa**); **foco del teclado con forma propia** (contorno de 2 px y una ramita, `#foco-rama`, la coloca `main.js`); LCP medido abajo. Sin cursor propio.

**Lo que NO está aquí (lo usan otras webs):** el muro de la finca visto desde arriba («Dentro del muro», Casa de Agosto), la losa que se parte por la veta ni la casa en corte (Casa da Laxa), la luz por la hora como sistema (A Casa da Tulla), el 3D del lugar con el cielo de ahora y los sellos del Camino.

## Paleta y letras

| Token | Color | Uso |
|---|---|---|
| `--lino` / `--lino-2` | `#F3EEE5` / `#E9E1D3` | El mantel y el papel (con una trama de lino casi invisible). |
| `--blanco` | `#FBF9F4` | La loza; texto sobre la teja. |
| `--tinta` / `--tinta-2` | `#2B2823` / `#5E574D` | Texto (nunca negro puro). |
| `--granito` / `--granito-2` | `#B6AA98` / `#8F8473` | La piedra: marcos, fondos de foto mientras carga. |
| `--granito-claro` | `#D5CCBF` | Granito para secciones **con texto** (la tinta sobre `#B6AA98` da APCA 54; sobre este, 71). |
| `--teja` / `--teja-texto` | `#A9503A` / `color-mix(teja 62 %, tinta)` | El acento: botón principal (blanco sobre teja: Lc 78) y, para texto pequeño, la versión derivada. |
| `--hoja` / `--hoja-2` | `#5D7347` / `#8EA273` | Las ramas y el jardín. |
| `--noche` / `--noche-2` / `--faro` | `#121822` / `#1E2633` / `#FFE7A6` | Solo los faros. |

**Letras** (Google Fonts, `display=swap`): **Hedvig Letters Serif** (titulares y cifras; solo existe en 400), **Golos Text** 400–600 (texto, cifras tabulares) y **Pinyon Script** solo como token `--f-nombre` para los nombres de las tarjetas de Mesa y Reserva. Comprobado con `grep` de `family=` en las demás webs de la cartera: ninguna de las tres se usa en otra. Los módulos leen `--f-titulo`, `--f-texto`, `--f-nombre` y los alias `--f-voz`, `--f-txt`, `--f-tit`.

## Cómo se trabaja

- **Edita siempre los `*.src.html` o las `partes/`** (cabeza, cabecera, reserva, llegar, pie y guiones; la cortina es de Mesa). `node construir.mjs`:
  1. incluye las partes (`<!--parte:…-->`);
  2. sustituye `{{clave}}` con **`datos.json`** (precios, temporada, teléfono, correo, plazas: **un solo sitio**);
  3. convierte `<img data-foto>` en `<picture>` AVIF/WebP/JPG;
  4. pone «Casa Entremuros» con las letras de la placa en la cabecera (`<!--marca-cabecera-->`) y la placa del pie (`<!--placa-pie-->`);
  5. **quita los `<link>`/`<script>` propios que aún no existan** (con aviso);
  6. pone `?v=<huella>` (`versionar.mjs`). Recuerda «Ctrl+F5» si se publica.
- **Fotos:** `scripts/fotos-lista.json` + `node scripts/fotos.mjs` (o `node scripts/fotos.mjs cocina salon` para unas pocas; `--rehacer` para forzar). Las 248 fotos son del Instagram de la casa (`ref/fotos/instagram/`), cada una con `nombre` y `codigo` («NNNN_k» = post y posición en el carrusel de `ref/FOTOS.md`). Gradación común y suave (menos saturación, aún menos en verdes y fucsias, negros más suaves; las de dentro, medio balance de blancos). **Nunca amplía.** `img/fotos/fotos.json` es el **índice**: nombre, código, nota, anchos, tamaño de salida y de origen. Convención de nombres: el de `FOTOS.md` (`mesa-larga-otono`, `fachada`, `placa`, `salon`, `cocina`…), `hab-<habitación>`, `bano-…`, `alpendre…`, `piscina…`, `jardin-NNNN-k`, `lugar-<sitio>-k`, `obra-…` y `mesa-navidad-k`. `placa-recorte` y `vieira-recorte` son solo el letrero de la foto (sin las placas oficiales), de respaldo.
- **Marca:** `node scripts/marca.mjs` → desde `marca/placa.svg` (de Mesa): `marca/letra.svg` + `letra.json` (CASA y ENTREMUROS. a la misma altura, en una línea), favicons (la vieira sobre granito) e `img/og.jpg` (titular + placa). Sin vector, usa el letrero de la foto. **Si cambia el vector: `node scripts/marca.mjs && node construir.mjs`.**
- **Legales y 404:** `node scripts/legales.mjs` y después `node construir.mjs`.
- **`node verificar.mjs`** (puerto 8901, una vez al terminar; sin capturas; navegador con `--disable-3d-apis`).
- **`node scripts/rendimiento.mjs`** (puerto 8902): móvil de gama media (Pixel 7, 4G lento, CPU ×4), con el texto comprimido con gzip como en GitHub Pages.
- **`node scripts/probar-borrado-mando.mjs`**: comprueba la receta de borrado del mando.
- Antes de lanzar cualquier prueba: `Get-CimInstance Win32_Process -Filter "Name='chrome-headless-shell.exe'"`; una a la vez; matar solo por PID.

## Contrato con los módulos

- `window.Entremuros.<mod>.montar(el, { movimiento, densidad: 'mesa'|'sobria', fecha, modo })` → `{ destruir() }`, con `<mod>` = `mesa` (portada, `modo: 'portada'`), `mesa-pie` (si no existe `Entremuros['mesa-pie']`, la web llama a `Entremuros.mesa.montar` con `modo: 'pie'`), `lugares`, `obra`, `faros` y `reserva`. El HTML de `el` es el respaldo. `main.js` monta **al acercarse** (900 px de margen) y **la mesa de la portada, en `Entremuros.alAbrirse`**. Si el JS de un módulo no ha llegado, vuelve a intentarlo al `load`, con `entremuros:listo` y con el scroll. Al cambiar de densidad: `destruir()`, devuelve el respaldo y vuelve a montar. Con la mesa montada, la portada recibe la clase `.con-mesa` (la pieza ocupa la pantalla y el titular va en una caja de lino encima, abajo a la izquierda).
- **La cortina:** el puente está en `partes/cabeza.html`: `Entremuros.alAbrirse(fn)`, `Entremuros.abrir()`, `Entremuros.retirarCortina()`; escucha `entremuros:cortina-abre` / `entremuros:cortina-fuera` y, si existe, `Entremuros.cortina.alAbrirse/alRetirarse`. Redes de seguridad: 6,5 s en la cabeza y 7 s en `main.js`.
- **Las ramas:** `Entremuros.mesa.rama(el, { n, dibujar })`. La web la llama al entrar en cada sección (con `dibujar: true`; `false` en la sobria o si se dibuja al llegar al pie) y lanza `entremuros:rama` con `{ n, alLlegar }` en `document`; la 5 también la puede llamar Reserva (la web envuelve `mesa.rama` para avisar de toda rama). Al llegar al pie se dibujan y avisan las que falten. `Entremuros.ramasDibujadas()` dice cuáles van dibujadas (para un pie que se monte tarde). En la sobria, las cinco, desde el principio.
- **El foco:** `#foco-rama` (en la web: una ramita de respaldo en CSS); si existe `Entremuros.mesa.focoRama(el)`, se le pasa el elemento una vez para que dibuje la suya.
- **Reservar:** `Entremuros.reservar()` baja al simulador. Los supuestos del motor están en `Entremuros.reserva.TARIFAS` y en `PENDIENTES.md`.
- **Fecha:** `Entremuros.fecha()` (`?fecha=2027-04-20` cambia el día a mediodía).
- **Fotos por nombre:** `img/fotos/<nombre>-<ancho>.jpg|webp|avif`.

## Mando de densidades (solo con `?revision`)

- **«Mesa puesta»:** la placa con luz rasante, la mesa que se pone sola, el zoom del plato al mar, las ramas que se dibujan, el antes y después que se descubre con el scroll, los faros que giran.
- **«Sobria»:** la mesa ya puesta y quieta, el zoom sustituido por tres imágenes fijas, las ramas ya dibujadas, los antes y después con deslizador manual, los faros quietos con su ritmo escrito. **Añade** la tabla «Casa Entremuros, de un vistazo».

### Receta de borrado del mando

1. En `partes/cabeza.html`, en el script, el `try { … }` de `// MANDO DE MAQUETA`.
2. En `partes/pie.html`, el bloque `<!-- MANDO DE MAQUETA` … `<!-- fin del MANDO DE MAQUETA -->`.
3. En `js/main.js`, el bloque `14. MANDO DE MAQUETA` hasta `fin del MANDO DE MAQUETA`.
4. Opcional: `.mando` y `.vistazo` en `css/estilos.css` y la sección `#vistazo` de `index.src.html`.
5. `node construir.mjs`. (`node scripts/probar-borrado-mando.mjs` lo comprueba en memoria.)

## Supuestos y datos dudosos (un solo sitio: `datos.json`)

Plazas, mascotas, precios, temporadas y hora de salida son **supuestos** porque las fuentes se contradicen (`ref/DATOS-ENTREMUROS.md`, «Contradicciones»): `datos.json` lleva la página «Tarifas» de la web antigua y la página los marca «por confirmar». El motor de reservas tiene los suyos (`TARIFAS`). Lo demás, en `PENDIENTES.md`.

## Qué mirar en Chrome

(La comprobación automática no hace capturas ni pinta nada con la tarjeta gráfica: esto lo ves tú.)

- **Cortina y portada** (Mesa): la placa con la luz rasante, el corte recto por la junta ENTRE | MUROS y las dos mitades que se abren como una puerta corredera; la mesa que se pone sola, la tarjeta «Bienvenidos» que se escribe a pluma; **recolocar la mesa** con el ratón, el dedo (mantener 250 ms) y el teclado; el zoom del plato al mar y que el cruce entre niveles de la ortofoto no salte. Con la mesa montada, que **el titular** (la caja de lino abajo a la izquierda) se lea sobre el dibujo y no tape lo importante, en escritorio y en móvil.
- **La cabecera:** «Casa Entremuros» con las letras de la placa (sale del mismo vector) y, en móvil, el menú con blur.
- **Las ramas:** que cada una se dibuje al entrar su sección, que en el pie esté el centro completo y que, bajando de golpe, las que faltan lleguen.
- **«La casa»** y **«Dentro y fuera»:** que parezcan una revista y no una rejilla: los cambios de escala, los saltos de altura y los pies de foto; que ninguna foto se vea blanda (casi todas son de 1080 px).
- **«Seis lugares»**, **«Antes y después»**, **«Los faros»** y **«Reservar»**: lo de sus agentes (ver sus informes), y que encajen en superficie, ritmo y tipografía con el resto. El panel de noche de los faros es lo único oscuro de la página.
- **Cada estación:** que empiece por la estación de hoy; con `?fecha=2027-04-20`, `2027-07-15`, `2026-10-25` y `2026-12-24`.
- **Lo que dicen:** las citas como columnas de revista y la nota de Google con su fecha.
- **Cómo llegar:** el mapa solo al pulsar «Ver el mapa» y la franja del Apartamento Area Maior (quitable).
- **Granito:** que el grano de las secciones de piedra (`#dentro` y `#llegar`) no canse ni ensucie el texto.
- **El mando** con `?revision`: las dos versiones; la sobria con su tabla.
- **El foco del teclado** (Tab): el contorno de 2 px y la ramita, también sobre el granito y el panel de noche.
- **Sin JavaScript** y **con movimiento reducido**: que se lea todo.

## Comprobaciones

- **`verificar.mjs`:** archivos (charset y noindex, ids, partes y datos sustituidos, enlaces), fotos (solo de su Instagram, ninguna de la lista «NO usar», ninguna ampliada), textos (nota de Google fechada, sin superlativos ni «una sola reseña», sin hórreo, celebraciones solo «se han celebrado…», adaptada sin nombrar), la paleta y las letras (y que ninguna la use otra web), los tokens y alias de los módulos, CSS de cookies/mando/menú/dvh/cortina, contraste (WCAG ≥ 4,5:1 y APCA ≥ 60 en ~70 parejas), el foco, el mapa, las estaciones por fecha, el contrato con módulos de mentira (montan al acercarse; opciones; ramas; pie con y sin `mesa-pie`; sobria), los módulos reales que haya, el visor por nombre, cookies en 4 pasos, mando y sobria, móvil a 360/375/390/768 (sin scroll lateral, caja del titular con la mesa montada, menú con la cabecera fija, barra del navegador sin rehacer nada), legales y, al final y con movimiento, la cortina, sin Lenis ni GSAP y sin JavaScript.
- **Resultado (2026-10-25, con los seis módulos y la cortina ya puestos): 180/180.**
- **`scripts/rendimiento.mjs`** (Pixel 7, 4G lento, CPU ×4, texto con gzip como en Pages): **LCP 1,2 s** en las tres pasadas (la foto `mesa-larga-otono-800.avif`, de 55 KB: AVIF a calidad 38 y `sizes` móvil de 70vw; sin gzip salía 4 s), 30 peticiones y ~1 MB. **Ojo:** con la CPU a ×4 la cortina de Mesa tarda ~10 s en irse (tareas largas de 1–3 s al pintar la placa y montar la mesa) y actúa la red de seguridad de 6,5 s: en un móvil de gama media conviene aligerar esa parte.

## Para publicar

Repo propio y GitHub Pages sobre la rama real (como las anteriores). Antes, `PENDIENTES.md` y la receta de borrado del mando si se entrega. Quitar el `noindex` solo si se vende. La casa no ha encargado esta web: no se publica ni se manda nada sin que Álvaro lo decida.
