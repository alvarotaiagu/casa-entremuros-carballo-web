/* ------------------------------------------------------------------
   Casa Entremuros · módulo «Seis lugares bajo un techo» (agente Lugares)

   Cada habitación lleva el nombre de un lugar de la comarca. La sección enseña las
   seis habitaciones y los seis lugares a la vez: a la izquierda, una lámina de
   Bergantiños dibujada a pluma sobre lino (img/lugares/mapa.svg, hecha por
   scripts/lugares.mjs con los datos de OpenStreetMap: costa, río Anllóns, carreteras,
   concellos y núcleos); a la derecha, las seis habitaciones. Al bajar, de la casa
   salen seis líneas a mano que se trazan hasta cada lugar y, al llegar cada una,
   se abre la tarjeta de su habitación (foto de la habitación, foto del lugar si la
   casa la publicó, lo que dice la casa y la distancia).

   Contrato: window.Entremuros.lugares.montar(el, { movimiento, densidad, fecha? })
   → { destruir(), estado(), abrir(i) }. El HTML de `el` es el respaldo (lo escribe la
   web; hay uno generado en img/lugares/respaldo.html): se oculta al montar y vuelve con
   destruir() o si algo falla. Marca el.dataset.montado = '1' al terminar.

   Los datos (textos de la casa con su número de IG, coordenadas, fuentes, distancias,
   las líneas y los rótulos en el viewBox) viven en img/lugares/lugares.json; este
   fichero no lleva ninguno. La ruta se saca de la propia etiqueta <script>.

   Con movimiento:false, movimiento reducido o densidad 'sobria': la lámina queda con las
   seis líneas trazadas y las seis tarjetas abiertas, sin ningún requestAnimationFrame
   ni oyente de scroll (el contenido sale igual; solo se quita el movimiento).

   Presupuesto: un único requestAnimationFrame por fotograma de scroll, solo mientras la
   sección está cerca de la pantalla (IntersectionObserver). El `resize` de la barra del
   móvil no rehace nada (checklist punto 10): no se guarda ningún alto; las posiciones se
   leen en cada fotograma y el único cálculo guardado es el ancho de la lámina.
   Trazos: stroke-dasharray con pathLength="1" y stroke-dashoffset escrito a mano en
   style (sin GSAP: no hay autoRound que desactivar).
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  var E = (window.Entremuros = window.Entremuros || {});
  var SCRIPT = document.currentScript;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  /* Pictogramas de pluma, de unos 26 × 24 unidades, con la base en (0,0) y hacia arriba. Un solo path cada uno. */
  var GLIFOS = {
    rio: 'M-12 -9q3 -4.5 6 0t6 0t6 0t6 0M-12 -3q3 -4.5 6 0t6 0t6 0t6 0',
    molino: 'M-11 0V-8L-5 -14L1 -8V0ZM-8 0V-5H-2V0M10 -8a5.5 5.5 0 1 0 .01 0ZM10 -13.5V-2.5M4.5 -8H15.5M6 -12l8 8M14 -12l-8 8M1 -6H4.5',
    puente: 'M-14 -10H14M-11 0Q0 -15 11 0M-11 -10V0M11 -10V0M-5 -9V-3M5 -9V-3M-14 0H14',
    cascada: 'M-13 -22H13M-9 -22V-8M-3 -22V-13M3 -22V-6M9 -22V-11M-13 0q3.25 -4 6.5 0t6.5 0t6.5 0t6.5 0M-9 -3q2.2 -2.5 4.5 0',
    playa: 'M-13 -3q3.25 -4 6.5 0t6.5 0t6.5 0t6.5 0M-9 -10q3 -4 6 0t6 0t6 0M-13 0q6 -5 12 -2t14 2M-3 -17l3 -2l3 2',
    casa: 'M-21 0V-12L-7 -23L7 -12V0ZM-4 0V-8H4V0M2 -19V-26H5V-17M12 0V-7L18 -12L24 -7V0Z'
  };

  function nodo(tag, attrs, padre) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (padre) padre.appendChild(n);
    return n;
  }
  function h(tag, cls, html, padre) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    if (padre) padre.appendChild(n);
    return n;
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function suave(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
  function acota(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
  function fecha(s) { var p = s.split('-'); return MESES[+p[1] - 1] + ' ' + p[0]; }

  function baseDeDatos(el) {
    if (el.dataset && el.dataset.lugaresBase) return el.dataset.lugaresBase.replace(/\/?$/, '/');
    if (SCRIPT && SCRIPT.src) { try { return new URL('../img/lugares/', SCRIPT.src).href; } catch (e) { /* sigue */ } }
    return 'img/lugares/';
  }

  function picture(foto, base, sizes, eager) {
    if (!foto) return '';
    var set = function (ext) { return foto.anchos.map(function (a) { return base + foto.nombre + '-' + a + '.' + ext + ' ' + a + 'w'; }).join(', '); };
    return '<picture><source type="image/avif" srcset="' + set('avif') + '" sizes="' + sizes + '"><source type="image/webp" srcset="' + set('webp') + '" sizes="' + sizes + '">' +
      '<img src="' + base + foto.nombre + '-' + foto.ancho + '.jpg" srcset="' + set('jpg') + '" sizes="' + sizes + '" width="' + foto.ancho + '" height="' + foto.alto + '" alt="' + esc(foto.alt) + '" loading="' + (eager ? 'eager' : 'lazy') + '" decoding="async"></picture>';
  }

  /* ================================================================ montar ================================================================ */
  function montar(el, opciones) {
    var opc = opciones || {};
    var reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* sin matchMedia */ }
    var sobria = opc.densidad === 'sobria';
    var movimiento = opc.movimiento !== false && !reduce && !sobria;
    var base = baseDeDatos(el);
    var vivo = true, listo = false, limpiar = [];
    var estadoInterno = { ids: [], ps: [], abiertas: [], activa: -1 };
    var api = {
      destruir: function () { vivo = false; limpiar.forEach(function (f) { try { f(); } catch (e) { /* ya no está */ } }); limpiar = []; },
      estado: function () { return estadoInterno.ps.map(function (p, i) { return { id: estadoInterno.ids[i], p: p, abierta: !!estadoInterno.abiertas[i], activa: estadoInterno.activa === i }; }); },
      abrir: function () { /* se redefine al montar */ }
    };

    fetch(base + 'lugares.json', { credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (datos) { if (vivo) construir(datos); })
      .catch(function () { /* el respaldo se queda */ });

    function construir(D) {
      var L = D.lugares, LAM = D.lamina, n = L.length;
      estadoInterno.ids = L.map(function (l) { return l.id; });
      estadoInterno.ps = L.map(function () { return 0; });

      /* el respaldo se oculta, no se borra */
      var respaldo = [];
      Array.prototype.forEach.call(el.children, function (c) { respaldo.push({ n: c, h: c.hidden }); c.hidden = true; });

      var raiz = h('div', 'lg' + (movimiento ? ' lg--mov' : ' lg--quieto'));
      raiz.dataset.densidad = sobria ? 'sobria' : 'mesa';
      h('p', 'lg-intro', 'Cada habitación lleva el nombre de un lugar de la comarca. Baja y sal de la casa por cada uno: ellos están a la izquierda, ellas a la derecha.', raiz);
      var cuerpo = h('div', 'lg-cuerpo', null, raiz);

      /* ---------------- la lámina ---------------- */
      var mapa = h('div', 'lg-mapa', null, cuerpo);
      var lamina = h('div', 'lg-lamina', null, mapa);
      lamina.setAttribute('aria-hidden', 'true');
      var img = h('img', 'lg-base', null, lamina);
      img.src = base + 'mapa.svg'; img.alt = ''; img.width = LAM.ancho; img.height = LAM.alto; img.decoding = 'async'; img.draggable = false;
      var svg = nodo('svg', { 'class': 'lg-sobre', viewBox: '0 0 ' + LAM.ancho + ' ' + LAM.alto, focusable: 'false', 'aria-hidden': 'true' });
      lamina.appendChild(svg);

      var gLineas = nodo('g', { 'class': 'lg-lineas' }, svg);
      var gMarcas = nodo('g', { 'class': 'lg-marcas' }, svg);
      var gRotulos = nodo('g', { 'class': 'lg-rotulos' }, svg);
      var gLugares = nodo('g', { 'class': 'lg-et-lugares' }, svg);
      var gCasa = nodo('g', { 'class': 'lg-casa' }, svg);

      /* rótulos fijos (los de los lugares no: salen con su línea) */
      LAM.rotulos.forEach(function (r) {
        if (r.id || r.t === 'Casa Entremuros') return;       // los de los lugares salen con su línea; el de la casa va con su casita
        var t = nodo('text', { x: r.x, y: r.y, 'text-anchor': r.anchor || 'start', 'class': 'r r-' + r.clase + (r.esencial ? ' r-esencial' : '') }, gRotulos);
        if (r.tracking) t.setAttribute('letter-spacing', r.tracking);
        if (r.rot) t.setAttribute('transform', 'rotate(' + r.rot + ' ' + r.x + ' ' + r.y + ')');
        t.textContent = r.t;
      });
      /* la casa: dos edificios, como los de la finca; las líneas nacen de su base */
      var cx = LAM.casa.x, cy = LAM.casa.y;
      nodo('path', { d: GLIFOS.casa, transform: 'translate(' + cx + ' ' + cy + ')', 'class': 'lg-glifo-casa' }, gCasa);
      var casaRot = LAM.rotulos.filter(function (r) { return r.t === 'Casa Entremuros'; })[0];
      if (casaRot) { var tc = nodo('text', { x: casaRot.x, y: casaRot.y, 'text-anchor': casaRot.anchor, 'class': 'r r-casa' }, gCasa); tc.textContent = casaRot.t; }

      var els = L.map(function (l) {
        var g = nodo('g', { 'class': 'lg-l', 'data-id': l.id }, gLineas);
        var l2 = nodo('path', { d: l.lamina.linea2, pathLength: 1, 'class': 'lg-linea2' }, g);
        var l1 = nodo('path', { d: l.lamina.linea, pathLength: 1, 'class': 'lg-linea' }, g);
        var m = nodo('g', { 'class': 'lg-m', 'data-id': l.id, transform: 'translate(' + l.lamina.x + ' ' + l.lamina.y + ')' }, gMarcas);
        nodo('circle', { r: 3.2, 'class': 'lg-punto' }, m);
        var gl = nodo('path', { d: GLIFOS[l.lamina.glifo] || GLIFOS.rio, pathLength: 1, 'class': 'lg-glifo', transform: 'translate(0 -4)' }, m);
        var et = null;
        if (l.lamina.etiqueta) {
          et = nodo('text', { x: l.lamina.etiqueta.x, y: l.lamina.etiqueta.y, 'text-anchor': l.lamina.etiqueta.anchor, 'class': 'r r-lugar', 'data-id': l.id }, gLugares);
          et.textContent = l.lamina.etiqueta.t;
        }
        [l1, l2, gl].forEach(function (p) { p.style.strokeDasharray = '1'; p.style.strokeDashoffset = '1'; });
        return { g: g, l1: l1, l2: l2, m: m, gl: gl, et: et };
      });

      /* ---------------- las seis habitaciones ---------------- */
      var lista = h('ol', 'lg-lista', null, cuerpo);
      var pasos = L.map(function (l, i) {
        var li = h('li', 'lg-paso', null, lista);
        li.dataset.lugar = l.id; li.dataset.i = i;
        var art = h('article', 'lg-tarjeta', null, li);
        art.setAttribute('aria-labelledby', 'lg-h-' + l.id);
        var fotos = h('div', 'lg-fotos', null, art);
        var fh = h('figure', 'lg-foto-hab', picture(l.foto.hab, base, '(max-width: 899px) 92vw, 440px', i === 0), fotos);
        if (l.foto.hab && l.foto.hab.soloRotulo) h('figcaption', null, 'Solo el rótulo de la puerta: falta la foto de la habitación.', fh);
        if (l.foto.lugar) {
          var fl = h('figure', 'lg-foto-lugar', picture(l.foto.lugar, base, '(max-width: 899px) 44vw, 190px', false), fotos);
          h('figcaption', null, esc(l.tipoLugar.charAt(0).toUpperCase() + l.tipoLugar.slice(1)) + ' · ' + esc(l.habitacion) + (l.foto.lugar.credito ? ' · foto de ' + esc(l.foto.lugar.credito) : ' · foto de la casa'), fl);
        }
        var tx = h('div', 'lg-texto', null, art);
        h('p', 'lg-num', ROMANOS[i], tx).setAttribute('aria-hidden', 'true');
        h('p', 'lg-dato', esc(l.dato), tx);
        var t3 = h('h3', 'lg-nombre', null, tx); t3.id = 'lg-h-' + l.id;
        var b = h('button', 'lg-boton', esc(l.habitacion), t3);
        b.type = 'button'; b.setAttribute('aria-pressed', 'false');
        b.setAttribute('aria-label', l.habitacion + ': ver su lugar y su línea en el mapa');
        h('p', 'lg-lugar', '<span>' + esc(l.tipoLugar) + '</span>' + (l.lamina.glifo === 'rio' ? ' · el tramo más cercano a la casa' : ''), tx);
        var q = h('div', 'lg-citas', null, tx);
        l.casaDice.forEach(function (c) {
          h('blockquote', 'lg-cita', '<p>«' + esc(c.t) + '»</p><footer>Casa Entremuros, IG ' + c.ig + ' · ' + fecha(c.fecha) + (c.nota ? ' · ' + esc(c.nota) : '') + '</footer>', q);
        });
        var d = h('p', 'lg-dist', '<strong>' + esc(l.distancia.texto.charAt(0).toUpperCase() + l.distancia.texto.slice(1)) + '</strong> <small>' + esc(l.distancia.detalle) + '</small>', tx);
        d.dataset.rectaKm = l.distancia.rectaKm;
        h('p', 'lg-lugar-dice', esc(l.lugarDice), tx);
        h('p', 'lg-fuente', 'Fuentes: ' + esc(l.lugarFuente) + '. Punto en OSM: ' + esc(l.osm.nota) + '.', tx);
        return { li: li, art: art, btn: b };
      });

      var notas = h('div', 'lg-notas', null, raiz);
      h('p', null, esc(D.notas.adaptada), notas);
      h('p', null, esc(D.notas.distancias) + ' Las líneas del mapa son rectas dibujadas a mano: no siguen la carretera.', notas);
      h('p', 'lg-atrib', esc(D.atribucion), notas);
      el.appendChild(raiz);

      /* ancho de la lámina → --k (píxeles por unidad), para que los rótulos y las plumas midan lo mismo en cualquier tamaño */
      var anchoPrev = 0;
      function medirAncho() {
        var w = lamina.getBoundingClientRect().width;
        if (!w || Math.abs(w - anchoPrev) < 0.5) return;
        anchoPrev = w;
        lamina.style.setProperty('--k', (w / LAM.ancho).toFixed(4));
        lamina.dataset.t = w < 470 ? 's' : 'l';
      }
      medirAncho();
      if (window.ResizeObserver) { var ro = new ResizeObserver(medirAncho); ro.observe(lamina); limpiar.push(function () { ro.disconnect(); }); }
      else { window.addEventListener('resize', medirAncho); limpiar.push(function () { window.removeEventListener('resize', medirAncho); }); }

      /* ---------------- el estado de cada línea ---------------- */
      var fijada = L.map(function () { return false; });
      var foco = -1;
      function pintar(ps) {
        var activa = -1;
        for (var i = 0; i < n; i++) if (ps[i] > 0.001) activa = i;
        estadoInterno.activa = activa;
        for (i = 0; i < n; i++) {
          var p = ps[i], e = els[i], g = suave((p - 0.78) / 0.22);
          estadoInterno.ps[i] = +p.toFixed(4);
          e.l1.style.strokeDashoffset = (1 - p).toFixed(4);
          e.l2.style.strokeDashoffset = (1 - suave(p * 1.04 - 0.02)).toFixed(4);
          e.g.style.opacity = p > 0.001 ? '1' : '0';
          e.gl.style.strokeDashoffset = (1 - g).toFixed(4);
          e.m.style.opacity = g > 0 ? '1' : '0';
          if (e.et) e.et.style.opacity = g.toFixed(3);
          var abierta = p >= 0.999;
          estadoInterno.abiertas[i] = abierta;
          var c = pasos[i];
          if (c.li.classList.contains('is-abierta') !== abierta) c.li.classList.toggle('is-abierta', abierta);
          var act = i === activa;
          if (c.li.classList.contains('is-activa') !== act) c.li.classList.toggle('is-activa', act);
          if (e.g.classList.contains('is-activa') !== act) e.g.classList.toggle('is-activa', act);
          if (e.g.classList.contains('is-pasada') !== (p > 0.001 && !act)) e.g.classList.toggle('is-pasada', p > 0.001 && !act);
          c.li.dataset.abierta = abierta ? '1' : '0';
          var pres = String(fijada[i]);
          if (c.btn.getAttribute('aria-pressed') !== pres) c.btn.setAttribute('aria-pressed', pres);
        }
        raiz.dataset.activa = activa >= 0 ? L[activa].id : '';
      }

      var ps = L.map(function () { return 0; });
      function calcular() {
        var vh = window.innerHeight || document.documentElement.clientHeight;
        var ancho = window.innerWidth || document.documentElement.clientWidth;
        var m = mapa.getBoundingClientRect();
        var dos = cuerpo.getBoundingClientRect().width > 0 && lista.getBoundingClientRect().left > m.left + m.width * 0.5;   // dos columnas
        var yr, banda;
        if (dos) { yr = vh * 0.5; banda = vh * 0.3; }
        else { var libre = vh - m.bottom; yr = m.bottom + libre * 0.2; banda = Math.max(120, libre * 0.55); }
        for (var i = 0; i < n; i++) {
          var top = pasos[i].art.getBoundingClientRect().top;
          var p = acota((yr + banda - top) / banda);
          if (fijada[i] || foco === i) p = 1;
          ps[i] = p;
        }
        return ps;
      }

      var pendiente = false;
      function fotograma() { pendiente = false; if (!vivo) return; pintar(calcular()); }
      function pide() { if (!pendiente && vivo) { pendiente = true; requestAnimationFrame(fotograma); } }

      if (movimiento) {
        var cerca = true;
        var onScroll = function () { if (cerca) pide(); };
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        limpiar.push(function () { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); });
        if (window.IntersectionObserver) {
          var io = new IntersectionObserver(function (es) { cerca = es[0].isIntersecting; if (cerca) pide(); }, { rootMargin: '120% 0px 120% 0px' });
          io.observe(raiz); limpiar.push(function () { io.disconnect(); });
        }
        pintar(calcular());
        /* las fuentes y las fotos mueven los altos: se vuelve a calcular cuando llegan */
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(pide);
        window.addEventListener('load', pide); limpiar.push(function () { window.removeEventListener('load', pide); });
      } else {
        ps = ps.map(function () { return 1; });
        pintar(ps);
      }

      /* ---------------- teclado y ratón ---------------- */
      pasos.forEach(function (c, i) {
        c.btn.addEventListener('click', function () {
          fijada[i] = movimiento ? !fijada[i] : true;      // sin movimiento todo está abierto: el botón solo señala
          pintar(movimiento ? calcular() : ps);
          raiz.dataset.elegida = fijada[i] ? L[i].id : '';
        });
        c.art.addEventListener('focusin', function () { foco = i; if (movimiento) pide(); });
        c.art.addEventListener('focusout', function () { if (foco === i) { foco = -1; if (movimiento) pide(); } });
      });

      api.abrir = function (i) { fijada[i] = true; pintar(movimiento ? calcular() : ps); };
      limpiar.push(function () {
        if (raiz.parentNode) raiz.parentNode.removeChild(raiz);
        respaldo.forEach(function (r) { r.n.hidden = r.h; });
        delete el.dataset.montado;
      });
      el.dataset.montado = '1';
      listo = true;
    }
    return api;
  }

  E.lugares = { montar: montar };
})();
