/* «Los faros de la costa» (agente Faros).
   window.Entremuros.faros.montar(el, opciones) -> { listo, destruir(), ... }
   opciones: { movimiento: bool, densidad: 'mesa'|'sobria', fecha?: Date, base?: string, reloj?: () => ms }
   - La costa es la de OpenStreetMap (img/faros/costa.json) y cada faro destella con la secuencia del Libro de Faros
     del Instituto Hidrográfico de la Marina (img/faros/faros.json), en tiempo real (reloj del aparato).
   - Canvas 2D, a 30 fotogramas como mucho, DPR <= 1,5, parado fuera de pantalla y con la pestaña oculta.
   - Con movimiento reducido (o densidad sobria): ningún destello; punto fijo y el ritmo escrito.
   - Nada destella más de 3 veces por segundo (WCAG 2.3.1): se comprueba al montar y lo dice el JSON. */
(function () {
  'use strict';
  var E = (window.Entremuros = window.Entremuros || {});

  var BASE_SCRIPT = (function () {
    try {
      var s = document.currentScript;
      if (s && s.src) return s.src.replace(/js\/faros\.js(\?.*)?$/, '');
    } catch (e) {}
    return '';
  })();

  var TAU = 0.22;            // segundos que tarda en apagarse el resplandor tras un destello
  var MAX_HZ = 3;            // WCAG 2.3.1
  var FPS_MIN_MS = 33;       // 30 fotogramas como mucho
  var CASA_COLOR = '255,178,107';
  var FARO_COLOR = '255,231,166';

  /* ---------------------------------------------------------------- la secuencia (pura, para probarla) */
  function intervalosLuz(c) {
    var out = [], t = 0, f = c.fases_s;
    for (var i = 0; i < f.length; i++) { if (i % 2 === 0) out.push([t, t + f[i]]); t += f[i]; }
    return out;
  }
  /* Estado de la luz en el instante tms (ms desde la época). Fases en segundos, luz y oscuridad alternas. */
  function luzEn(c, tms) {
    var P = c.periodo_s, p = ((((tms / 1000) - (c.desfase_s || 0)) % P) + P) % P, ons = intervalosLuz(c), i, dmin = Infinity;
    for (i = 0; i < ons.length; i++) {
      if (p >= ons[i][0] && p < ons[i][1]) return { encendido: true, desde: 0, fase: p, intensidad: 1 };
      var d = (p - ons[i][1] + P) % P; if (d < dmin) dmin = d;
    }
    return { encendido: false, desde: dmin, fase: p, intensidad: Math.exp(-dmin / TAU) };
  }
  function maxInicios(c) { // inicios de destello por segundo en el peor tramo
    var ons = intervalosLuz(c), P = c.periodo_s, mx = 0;
    for (var i = 0; i < ons.length; i++) {
      var sig = i + 1 < ons.length ? ons[i + 1][0] : ons[0][0] + P;
      mx = Math.max(mx, 1 / (sig - ons[i][0]));
    }
    return mx;
  }

  /* ---------------------------------------------------------------- utilidades */
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var num1 = function (n) { var s = Number(n).toFixed(1).replace('.', ','); return s; };
  function rng(seed) { var a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function css(el, nombre, por) { var v = ''; try { v = getComputedStyle(el).getPropertyValue(nombre).trim(); } catch (e) {} return v || por; }
  function fetchJSON(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status + ' ' + url); return r.json(); }); }
  function segs(n) { var s = Number(n); return (Math.round(s * 10) / 10).toString().replace('.', ',') + ' s'; }

  function picture(f, base, clase, sizes) {
    if (!f) return '';
    var d = (base || '') + 'img/faros/fotos/' + f.nombre + '-' + f.ancho;
    return '<picture class="' + clase + '"><source type="image/webp" srcset="' + d + '.webp"><img src="' + d + '.jpg" width="' + f.ancho + '" height="' + f.alto + '" loading="lazy" decoding="async" alt="' + esc(f.alt) + '"></picture>';
  }

  /* ---------------------------------------------------------------- montar */
  function montar(el, op) {
    op = op || {};
    var base = op.base != null ? op.base : BASE_SCRIPT;
    var reloj = op.reloj || function () { return Date.now(); };
    var mq = null; try { mq = window.matchMedia('(prefers-reduced-motion: reduce)'); } catch (e) {}
    var reducido = op.movimiento === false || op.densidad === 'sobria' || !!(mq && mq.matches);
    var inst = { destruir: function () {}, listo: null, reloj: reloj, rafActivo: false, rafLlamadas: 0 };
    var vivo = true, limpiezas = [];

    inst.listo = Promise.all([fetchJSON(base + 'img/faros/faros.json'), fetchJSON(base + 'img/faros/costa.json'), fetchJSON(base + 'img/faros/fotos/fotos.json').catch(function () { return {}; })])
      .then(function (r) { if (vivo) construir(r[0], r[1], r[2]); return inst; })
      .catch(function (e) { console.warn('[faros] no se pudo montar; queda el respaldo de la web', e); return inst; });

    inst.destruir = function () { vivo = false; limpiezas.forEach(function (f) { try { f(); } catch (e) {} }); limpiezas = []; };
    return inst;

    function construir(D, C, F) {
      var faros = D.faros, sinMov = reducido;
      var ANCHO = C.caja.ancho_m, ALTO = C.caja.alto_m;
      var fotoDe = function (ref) { if (!ref) return null; var m = F[ref.nombre]; return m ? { nombre: ref.nombre, ancho: m.ancho, alto: m.alto, alt: ref.alt } : null; };
      var byId = {}; faros.forEach(function (f) { byId[f.id] = f; f._hz = maxInicios(f.caracteristica); });
      var peor = faros.reduce(function (a, f) { return Math.max(a, f._hz); }, 0);
      if (peor > MAX_HZ) { console.warn('[faros] más de ' + MAX_HZ + ' destellos por segundo: se queda quieto'); sinMov = true; }
      var minGap = Math.round(10 / peor) / 10;
      var seleccion = (op.seleccion && byId[op.seleccion]) ? op.seleccion : 'nariga';
      var pausado = false, visible = false, raf = 0, ultimo = 0, antes = null;

      /* ---------- DOM */
      var etqLado = function (f) { return f.etiqueta || 'e'; };
      var cortos = { sisargas: 'Illas Sisargas', nariga: 'Punta Nariga', roncudo: 'Punta Roncudo', laxe: 'Punta Laxe', vilan: 'Cabo Vilán', barca: 'Punta da Barca', tourinan: 'Cabo Touriñán', fisterra: 'Cabo Fisterra' };
      var pct = function (x, y) { return 'left:' + (x / ANCHO * 100).toFixed(2) + '%;top:' + (y / ALTO * 100).toFixed(2) + '%'; };
      var botones = faros.map(function (f) {
        return '<button type="button" class="fr__faro" data-id="' + f.id + '" data-lado="' + etqLado(f) + '" style="' + pct(f.x, f.y) + '" aria-label="' + esc(f.nombre + ': ' + f.caracteristica.es + '. ' + f.caracteristica.texto_es) + '">' +
          '<span class="fr__nombre" aria-hidden="true">' + esc(cortos[f.id] || f.nombre) + '</span></button>';
      }).join('');
      var lugares = (D.lugares || []).filter(function (l) { return l.nombre !== 'Cances Grande' && l.nombre !== 'Ponteceso' && l.nombre !== 'Muxía'; }).map(function (l) {
        var lado = { 'Malpica de Bergantiños': 'e', 'O Porto de Corme': 'e', 'Laxe': 'e', 'Camariñas': 'e', 'Fisterra': 'e', 'Carballo': 'w' }[l.nombre] || 'e';
        var nom = l.nombre === 'Malpica de Bergantiños' ? 'Malpica' : l.nombre === 'O Porto de Corme' ? 'Corme' : l.nombre;
        return '<span class="fr__lugar" data-lado="' + lado + '" data-n="' + esc(nom) + '" style="' + pct(l.x, l.y) + '" aria-hidden="true">' + esc(nom) + '</span>';
      }).join('');
      var casa = D.casa;
      var casaHTML = '<span class="fr__casa" style="' + pct(casa.x, casa.y) + '"><span class="fr__casa-nombre">Casa Entremuros</span></span>';
      var km10 = 10000 / ANCHO * 100;

      var tabla = '<table class="fr__tabla-t"><caption class="fr__sr">Los faros de la costa, con su característica oficial</caption><thead><tr><th scope="col">Faro</th><th scope="col">Característica</th><th scope="col">Cómo se ve</th><th scope="col">Altura focal</th><th scope="col">Alcance</th><th scope="col">Desde la casa</th></tr></thead><tbody>' +
        faros.map(function (f) {
          var c = f.caracteristica, d = f.casa;
          return '<tr data-faro="' + f.id + '"><th scope="row">' + esc(f.nombre) + '</th><td data-label="Característica"><span class="fr__codigo">' + esc(c.es) + '</span></td><td data-label="Cómo se ve">' + esc(f.caracteristica.texto_es) + '</td><td data-label="Altura focal">' + f.altura_focal_m + ' m</td><td data-label="Alcance">' + f.alcance_mn + ' M</td><td data-label="Desde la casa">' + num1(d.linea_recta_km) + ' km' + (d.carretera ? ' · ' + d.carretera.km.toString().replace('.', ',') + ' km por carretera' : '') + '</td></tr>';
        }).join('') + '</tbody></table>';

      var rec = (D.recomendaciones || []).map(function (r, i) {
        var foto = fotoDe(r.foto);
        var frases = r.frases.map(function (fr) {
          return '<blockquote class="fr__cita"><p>«' + esc(fr.texto.replace(/\s+/g, ' ')) + '»</p><footer><cite><a href="' + esc(fr.enlace) + '" rel="noopener" target="_blank">IG ' + fr.ig + '</a> · ' + esc(fr.fecha_larga) + '</cite></footer></blockquote>';
        }).join('');
        var casaDice = r.dice_casa ? '<p class="fr__rec-casa">La casa dice: «' + esc(r.dice_casa.texto) + '» <span class="fr__cite-pq">(IG ' + r.dice_casa.ig + ', ' + esc(r.dice_casa.fecha_larga) + ')</span></p>' : '';
        var ver = r.faro ? '<button type="button" class="fr__ver" data-faro="' + r.faro + '">Ver su luz en la costa</button>' : '';
        return '<li class="fr__rec' + (i < 2 ? ' fr__rec--grande' : '') + '" id="fr-rec-' + esc(r.id) + '" data-ig="' + r.frases.map(function (f) { return f.ig; }).join(' ') + '">' +
          (foto ? '<figure class="fr__rec-foto">' + picture(foto, base, 'fr__pic') + '<figcaption class="fr__sr">' + esc(foto.alt) + '. Foto de la casa (IG ' + r.foto.ig + ').</figcaption></figure>' : '') +
          '<div class="fr__rec-texto"><h4 class="fr__rec-lugar">' + esc(r.lugar) + '</h4>' + frases + casaHTML2(casaDice) + ver + '</div></li>';
      }).join('');
      function casaHTML2(x) { return x; }

      var cam = D.camino_de_los_faros;
      el.innerHTML =
        '<div class="fr" data-estado="' + (sinMov ? 'quieto' : 'vivo') + '">' +
        '<div class="fr__noche">' +
          '<div class="fr__intro"><h3 class="fr__h">La costa de noche</h3>' +
          '<p class="fr__lede">La casa está a diez minutos de Malpica (IG 213), donde empieza O Camiño dos Faros: «' + esc(cam.texto) + '» (IG ' + cam.ig + ', ' + esc(cam.fecha_larga) + '). Esta es esa costa de noche, con cada luz a su ritmo. Toca un faro para ver su ficha.</p></div>' +
          '<div class="fr__cuerpo">' +
            '<div class="fr__escena" style="--ar:' + ANCHO + ' / ' + ALTO + '">' +
              '<canvas class="fr__lienzo" aria-hidden="true"></canvas>' +
              '<div class="fr__capa">' + lugares + casaHTML + botones +
              '<span class="fr__escala" style="width:' + km10.toFixed(2) + '%" aria-hidden="true"><span>10 km</span></span></div>' +
            '</div>' +
            '<aside class="fr__ficha" role="region" aria-label="Ficha del faro" tabindex="-1"></aside><p class="fr__sr fr__estado" role="status"></p>' +
          '</div>' +
          '<div class="fr__pie-noche">' +
            (sinMov ? '' : '<button type="button" class="fr__pausa" aria-pressed="false">Parar los destellos</button>') +
            '<p class="fr__leyenda">' + (sinMov ? 'Los faros están quietos (movimiento reducido o versión sobria): arriba, cada uno con su ritmo escrito. ' : 'Cada luz sigue su secuencia real según el reloj de tu aparato; el instante en que empieza cada ciclo no es el de la costa. Ninguna destella más de ' + MAX_HZ + ' veces por segundo (la más rápida repite cada ' + num1(minGap) + ' s). ') +
            'La casa, el punto cálido, no destella. Costa y pueblos: © colaboradores de OpenStreetMap (ODbL). Característica de los faros: Libro de Faros del Instituto Hidrográfico de la Marina, edición ' + esc(D.libro_de_faros.edicion) + '.</p>' +
          '</div>' +
        '</div>' +
        '<details class="fr__tabla"' + (sinMov ? ' open' : '') + '><summary>Los faros, uno a uno (tabla)</summary>' + tabla + '</details>' +
        '<section class="fr__dia" aria-labelledby="fr-dia-h"><h3 class="fr__h fr__h--dia" id="fr-dia-h">Lo que Mónica recomienda</h3>' +
          '<p class="fr__dia-lede">Lo que la casa enseña de su comarca en Instagram, con sus mismas palabras.</p>' +
          '<ul class="fr__lista">' + rec + '</ul></section>' +
        '</div>';

      var raiz = el.querySelector('.fr'), escena = el.querySelector('.fr__escena'), lienzo = el.querySelector('.fr__lienzo'), ficha = el.querySelector('.fr__ficha');
      var ctx = lienzo.getContext('2d');
      var btnPausa = el.querySelector('.fr__pausa');

      /* ---------- ficha */
      var cabeza = null;
      function fichaHTML(f) {
        var c = f.caracteristica, d = f.casa, foto = fotoDe(f.foto);
        var ons = intervalosLuz(c).map(function (i) { return segs(i[0]); });
        var P = c.periodo_s, W = 200, x = 0, rects = '';
        c.fases_s.forEach(function (s, i) { var w = s / P * W; if (i % 2 === 0) rects += '<rect class="fr__on" x="' + x.toFixed(2) + '" y="4" width="' + Math.max(w, 2).toFixed(2) + '" height="9" rx="1"/>'; x += w; });
        var svg = '<svg class="fr__ciclo" viewBox="0 0 200 22" role="img" aria-label="Ciclo de ' + segs(P) + ': la luz se enciende a los ' + ons.join(', ') + '"><rect class="fr__pista" x="0" y="4" width="200" height="9" rx="1"/>' + rects + '<line class="fr__cabeza" x1="0" x2="0" y1="1" y2="16"/><text x="0" y="22" class="fr__eje">0 s</text><text x="200" y="22" text-anchor="end" class="fr__eje">' + segs(P) + '</text></svg>';
        var dist = '<dd>' + num1(d.linea_recta_km) + ' km en línea recta' + (d.carretera && d.carretera.hasta_m_del_faro < 1500 ? ' · unos ' + d.carretera.km.toString().replace('.', ',') + ' km por carretera (calculado, OSRM)' : '') + '</dd>';
        var casaDice = f.id === 'nariga' && D.dice_casa_nariga ? '<p class="fr__f-casa">La casa dice: «' + esc(D.dice_casa_nariga.texto) + '» <span class="fr__cite-pq">(IG ' + D.dice_casa_nariga.ig + ', ' + esc(D.dice_casa_nariga.fecha_larga) + ')</span></p>' : '';
        var avisos = '';
        if (f.nota_estado) avisos += '<p class="fr__aviso">' + esc(f.nota_estado) + '</p>';
        if (f.anio) avisos += '<p class="fr__nota">' + esc(f.anio.texto) + '</p>';
        if (f.nota) avisos += '<p class="fr__nota">' + esc(f.nota) + '</p>';
        if (f.giratorio) avisos += '<p class="fr__nota">Su linterna gira: el haz que ves barrer es el que pasa por el mar a ese ritmo (Wikipedia).</p>';
        var disc = f.discrepancias && f.discrepancias.length ? '<details class="fr__disc"><summary>Fuentes y diferencias</summary><ul>' + f.discrepancias.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></details>' : '';
        var fuente = '<p class="fr__fuente">Característica: Libro de Faros (IHM, ' + esc(D.libro_de_faros.edicion) + '), n.º ' + esc(f.fuentes[0].numero_internacional) + '. Segunda fuente: Wikipedia, ' + (f.fuentes[1].coincide_con_el_libro ? 'coincide' : 'con diferencias (abajo)') + '.</p>';
        return (foto ? picture(foto, base, 'fr__f-foto') : '') +
          '<h3 class="fr__f-nombre" tabindex="-1">' + esc(f.nombre) + '</h3>' +
          '<p class="fr__f-sub">' + esc(f.municipio || '') + '</p>' +
          '<p class="fr__f-car"><span class="fr__codigo">' + esc(c.es) + '</span> <span class="fr__cite-pq">(' + esc(c.ihm) + ' en notación internacional)</span></p>' +
          '<p class="fr__f-expl">' + esc(c.texto_es) + '</p>' + svg +
          '<dl class="fr__datos"><div><dt>Torre</dt><dd>' + f.altura_torre_m + ' m</dd></div><div><dt>Altura de la luz sobre el mar</dt><dd>' + f.altura_focal_m + ' m</dd></div><div><dt>Alcance</dt><dd>' + f.alcance_mn + ' millas (' + num1(f.alcance_km) + ' km)</dd></div><div><dt>Desde la casa</dt>' + dist + '</div></dl>' +
          casaDice + avisos + fuente + disc;
      }
      function seleccionar(id, opts) {
        if (!byId[id]) return;
        seleccion = id; opts = opts || {};
        ficha.innerHTML = fichaHTML(byId[id]);
        cabeza = ficha.querySelector('.fr__cabeza');
        el.querySelectorAll('.fr__faro').forEach(function (b) { if (b.dataset.id === id) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
        el.querySelectorAll('.fr__tabla-t tbody tr').forEach(function (tr) { tr.classList.toggle('fr__sel', tr.dataset.faro === id); });
        el.dataset.faroSeleccionado = id;
        var st = el.querySelector('.fr__estado'); if (st && !opts.silencioso) st.textContent = byId[id].nombre + ': ' + byId[id].caracteristica.es + '. ' + byId[id].caracteristica.texto_es;
        if (!opts.silencioso) {
          try { document.dispatchEvent(new CustomEvent('entremuros:faro', { detail: { id: id } })); } catch (e) {}
          var r = ficha.getBoundingClientRect();
          if (r.top < 0 || r.bottom > (window.innerHeight || 0)) { try { ficha.scrollIntoView({ block: 'nearest', behavior: sinMov ? 'auto' : 'smooth' }); } catch (e) { ficha.scrollIntoView(); } }
        }
        pintar(reloj());
      }
      el.addEventListener('click', onClick);
      limpiezas.push(function () { el.removeEventListener('click', onClick); });
      function onClick(ev) {
        var b = ev.target.closest && ev.target.closest('.fr__faro');
        if (b && el.contains(b)) { seleccionar(b.dataset.id); return; }
        var v = ev.target.closest && ev.target.closest('.fr__ver');
        if (v && el.contains(v)) { seleccionar(v.dataset.faro, { silencioso: true }); try { escena.scrollIntoView({ block: 'center', behavior: sinMov ? 'auto' : 'smooth' }); } catch (e) {} var bb = el.querySelector('.fr__faro[data-id="' + v.dataset.faro + '"]'); if (bb) bb.focus({ preventScroll: true }); }
      }
      if (btnPausa) {
        btnPausa.addEventListener('click', function () {
          pausado = !pausado; btnPausa.setAttribute('aria-pressed', pausado ? 'true' : 'false');
          btnPausa.textContent = pausado ? 'Reanudar los destellos' : 'Parar los destellos';
          raiz.dataset.estado = pausado ? 'pausado' : 'vivo'; regular();
        });
      }

      /* ---------- el lienzo */
      var w = 0, h = 0, dpr = 1, sc = 1, capaBase = null;
      var cNoche = '#121822', cNoche2 = '#1E2633';
      function construirBase() {
        cNoche = css(raiz, '--noche', '#121822'); cNoche2 = css(raiz, '--noche-2', '#1E2633');
        capaBase = document.createElement('canvas'); capaBase.width = lienzo.width; capaBase.height = lienzo.height;
        var g = capaBase.getContext('2d'); g.scale(dpr, dpr);
        // mar
        var gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0e1520'); gr.addColorStop(.5, '#121c2b'); gr.addColorStop(1, '#0f1824');
        g.fillStyle = cNoche; g.fillRect(0, 0, w, h); g.fillStyle = gr; g.globalAlpha = .9; g.fillRect(0, 0, w, h); g.globalAlpha = 1;
        // brillo leve del mar: destellitos fijos (no parpadean) y una franja de luz de luna
        var R = rng(20261025), n = Math.round(w * h / 2400);
        g.lineCap = 'round';
        for (var i = 0; i < n; i++) {
          var x = R() * w, y = R() * h, l = 2 + R() * 7, a = .035 + R() * .11;
          var luna = Math.exp(-Math.pow((x - w * .22) / (w * .32), 2)); // más brillo a la izquierda (el océano abierto)
          g.strokeStyle = 'rgba(150,182,222,' + (a * (.5 + luna)).toFixed(3) + ')'; g.lineWidth = .8 + R() * .7;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + (R() - .5) * 1.2); g.stroke();
        }
        // tierra
        var trazar = function (arr) { g.beginPath(); for (var k = 0; k < arr.length; k++) { var p = arr[k]; g.moveTo(p[0] * sc, p[1] * sc); for (var j = 2; j < p.length; j += 2) g.lineTo(p[j] * sc, p[j + 1] * sc); g.closePath(); } };
        g.fillStyle = cNoche2; trazar(C.tierra); g.fill(); trazar(C.islas); g.fill();
        // lindes: un resplandor muy suave y el trazo fino
        var lineas = function () { g.beginPath(); C.lineas.forEach(function (p) { g.moveTo(p[0] * sc, p[1] * sc); for (var j = 2; j < p.length; j += 2) g.lineTo(p[j] * sc, p[j + 1] * sc); }); C.islas.forEach(function (p) { g.moveTo(p[0] * sc, p[1] * sc); for (var j = 2; j < p.length; j += 2) g.lineTo(p[j] * sc, p[j + 1] * sc); g.closePath(); }); };
        g.lineJoin = 'round'; g.lineCap = 'round';
        lineas(); g.strokeStyle = 'rgba(120,160,215,.05)'; g.lineWidth = 9; g.stroke();
        lineas(); g.strokeStyle = 'rgba(140,175,225,.09)'; g.lineWidth = 4; g.stroke();
        lineas(); g.strokeStyle = 'rgba(190,212,240,.62)'; g.lineWidth = Math.max(.8, Math.min(1.3, w / 800)); g.stroke();
        // la casa: punto cálido fijo
        var cx = casa.x * sc, cy = casa.y * sc, hr = Math.max(12, w * .028);
        var hg = g.createRadialGradient(cx, cy, 0, cx, cy, hr); hg.addColorStop(0, 'rgba(' + CASA_COLOR + ',.55)'); hg.addColorStop(1, 'rgba(' + CASA_COLOR + ',0)');
        g.fillStyle = hg; g.beginPath(); g.arc(cx, cy, hr, 0, 6.2832); g.fill();
        g.fillStyle = 'rgb(' + CASA_COLOR + ')'; g.beginPath(); g.arc(cx, cy, Math.max(3, w * .0058), 0, 6.2832); g.fill();
      }
      function medir() {
        var ancho = Math.round(escena.clientWidth);
        if (!ancho || (ancho === w && capaBase)) return false;
        w = ancho; h = Math.round(w * ALTO / ANCHO); dpr = Math.min(window.devicePixelRatio || 1, 1.5); sc = w / ANCHO;
        lienzo.width = Math.round(w * dpr); lienzo.height = Math.round(h * dpr);
        construirBase(); return true;
      }

      function pintar(t) {
        if (!capaBase) return;
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, lienzo.width, lienzo.height);
        ctx.drawImage(capaBase, 0, 0);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        var sel = byId[seleccion];
        // línea casa -> faro elegido
        if (sel) {
          ctx.save(); ctx.setLineDash([2, 5]); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(' + FARO_COLOR + ',.42)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(casa.x * sc, casa.y * sc); ctx.lineTo(sel.x * sc, sel.y * sc); ctx.stroke(); ctx.restore();
        }
        var movil = !sinMov && !pausado && t != null;
        var rad = Math.max(16, w * .036);
        faros.forEach(function (f) {
          var c = f.caracteristica, x = f.x * sc, y = f.y * sc, estado = movil ? luzEn(c, t) : { encendido: false, intensidad: 0, fase: 0 };
          var I = estado.intensidad;
          // haz hacia el mar
          if (f.giratorio) {
            var ang = ((f.rumbo_mar_deg - 360 * (estado.fase / c.periodo_s)) % 360 + 360) % 360;
            haz(x, y, ang, f, movil ? .13 + .32 * I : .1, 9);
          } else if (movil && I > .02) haz(x, y, f.rumbo_mar_deg, f, .34 * I, 11);
          // resplandor
          if (I > .01) {
            var g = ctx.createRadialGradient(x, y, 0, x, y, rad * (.55 + .45 * I));
            g.addColorStop(0, 'rgba(' + FARO_COLOR + ',' + (.85 * I).toFixed(3) + ')'); g.addColorStop(.35, 'rgba(' + FARO_COLOR + ',' + (.3 * I).toFixed(3) + ')'); g.addColorStop(1, 'rgba(' + FARO_COLOR + ',0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.2832); ctx.fill();
          }
          // el punto: siempre visible; fijo y tenue si no hay movimiento
          var base = movil ? .34 : .78;
          ctx.fillStyle = 'rgba(255,246,214,' + Math.min(1, base + .66 * I).toFixed(3) + ')';
          ctx.beginPath(); ctx.arc(x, y, Math.max(2.4, w * .0052) * (1 + .5 * I), 0, 6.2832); ctx.fill();
          if (f.estado_libro) { ctx.save(); ctx.setLineDash([2, 3]); ctx.strokeStyle = 'rgba(' + FARO_COLOR + ',.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 7.5, 0, 6.2832); ctx.stroke(); ctx.restore(); }
          if (f.id === seleccion) { ctx.strokeStyle = 'rgba(' + FARO_COLOR + ',.8)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x, y, 12, 0, 6.2832); ctx.stroke(); }
        });
        if (cabeza && movil) { var sc2 = byId[seleccion]; if (sc2) { var e = luzEn(sc2.caracteristica, t); var X = (e.fase / sc2.caracteristica.periodo_s * 200).toFixed(2); cabeza.setAttribute('x1', X); cabeza.setAttribute('x2', X); } }
        else if (cabeza) { cabeza.setAttribute('x1', -10); cabeza.setAttribute('x2', -10); }
        antes = t;
      }
      function haz(x, y, grados, f, alfa, semi) {
        if (alfa < .01) return;
        var L = Math.min(f.alcance_km * 1000 * sc, w * .2), a = (grados - 90) * Math.PI / 180, s = semi * Math.PI / 180;
        var g = ctx.createLinearGradient(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L);
        g.addColorStop(0, 'rgba(' + FARO_COLOR + ',' + alfa.toFixed(3) + ')'); g.addColorStop(1, 'rgba(' + FARO_COLOR + ',0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, L, a - s, a + s); ctx.closePath(); ctx.fill();
      }

      /* ---------- arranque y parada */
      function regular() {
        var debe = !sinMov && !pausado && visible && !document.hidden;
        if (debe && !raf) { inst.rafActivo = true; raf = requestAnimationFrame(bucle); inst.rafLlamadas++; }
        else if (!debe) { if (raf) cancelAnimationFrame(raf); raf = 0; inst.rafActivo = false; pintar(sinMov || pausado ? null : reloj()); }
      }
      function bucle(ts) {
        raf = 0;
        if (!(vivo && !sinMov && !pausado && visible && !document.hidden)) { inst.rafActivo = false; return; }
        if (ts - ultimo >= FPS_MIN_MS) { ultimo = ts; pintar(reloj()); }
        raf = requestAnimationFrame(bucle); inst.rafLlamadas++;
      }
      var io = null;
      if ('IntersectionObserver' in window) {
        io = new IntersectionObserver(function (es) { visible = es[0].isIntersecting; regular(); }, { rootMargin: '80px' });
        io.observe(escena); limpiezas.push(function () { io.disconnect(); });
      } else { visible = true; }
      var onVis = function () { regular(); };
      document.addEventListener('visibilitychange', onVis); limpiezas.push(function () { document.removeEventListener('visibilitychange', onVis); });
      var onMq = function () { if (mq && mq.matches) { sinMov = true; raiz.dataset.estado = 'quieto'; regular(); } };
      if (mq && mq.addEventListener) { mq.addEventListener('change', onMq); limpiezas.push(function () { mq.removeEventListener('change', onMq); }); }
      /* el resize de la barra del móvil no rehace nada: solo cuenta si cambia el ANCHO */
      var ro = null;
      if ('ResizeObserver' in window) {
        ro = new ResizeObserver(function () { if (medir()) pintar(sinMov || pausado ? null : reloj()); });
        ro.observe(escena); limpiezas.push(function () { ro.disconnect(); });
      }
      limpiezas.push(function () { if (raf) cancelAnimationFrame(raf); raf = 0; });

      medir(); seleccionar(seleccion, { silencioso: true }); regular();
      el.dataset.montado = '1';

      /* ---------- para las pruebas */
      inst.datos = D; inst.luzEn = luzEn;
      inst.pintar = function (t) { pintar(t == null ? reloj() : t); };
      inst.estado = function (t) { var o = {}; faros.forEach(function (f) { o[f.id] = luzEn(f.caracteristica, t); }); return o; };
      inst.sonda = function (id) { // brillo (0-765) del centro del punto en el lienzo, sin tocar el estado
        var f = byId[id], x = Math.round(f.x * sc * dpr), y = Math.round(f.y * sc * dpr), d = ctx.getImageData(x - 1, y - 1, 3, 3).data, s = 0;
        for (var i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; return s / 9;
      };
      inst.seleccionar = seleccionar;
      inst.quieto = function () { return sinMov; };
    }
  }

  E.faros = { montar: montar, luzEn: luzEn, maxInicios: maxInicios, version: 1 };
})();
