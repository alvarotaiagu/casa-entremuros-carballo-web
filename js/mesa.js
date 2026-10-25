/* ------------------------------------------------------------------
   Casa Entremuros · «La mesa puesta» · módulo Mesa (agente Mesa)
   Una mesa larga vista desde arriba, dibujada con mimo, que se pone sola; el zoom «del plato al mar»;
   las cinco ramas del centro de mesa, la ramita del foco y la mesa completa del pie; y las piezas
   que usa Reserva (cubierto y tarjeta).

   API (todo en window.Entremuros):
     Entremuros.mesa.montar(el, { movimiento, densidad: 'mesa'|'sobria', modo: 'portada'|'pie', fecha })  → { destruir(), ... }
     Entremuros['mesa-pie'].montar(el, op)       la mesa completa del pie (= mesa.montar con modo:'pie')
     Entremuros.mesa.rama(el, { n, dibujar })    la rama n (1 hortensia, 2 lavanda, 3 hoja de arce, 4 olivo, 5 hierbas de San Juan)
     Entremuros.mesa.cubierto(el, { girado, animar, tipo })   un cubierto en el cuadrado `el` (comensal abajo, copa arriba a la derecha)
     Entremuros.mesa.tarjeta(el, nombre, { animar })           la tarjeta con el nombre, escrita a pluma (Pinyon Script)
     Entremuros.mesa.foco(el)                    la ramita del foco del teclado (#foco-rama)
   Sin dependencias duras: usa GSAP y ScrollTrigger si están; si no, todo queda quieto pero completo.
   Los colores y las letras salen de los tokens de :root (var(--x, valor)); los dibujos propios (madera de pino,
   esparto, loza azul grisácea, latón) son los de las mesas reales de la casa (IG 19, IG 4).
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var E = (window.Entremuros = window.Entremuros || {});
  var M = (E.mesa = E.mesa || {});
  var uidN = 0;
  var uid = function (p) { return (p || 'mz') + (++uidN); };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var G = function () { return window.gsap || null; };
  var ST = function () { return window.ScrollTrigger || null; };
  var reducido = function () { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var smooth = function (t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  var seg = function (p, a, b) { return clamp((p - a) / (b - a), 0, 1); };   // progreso local 0-1 de p entre a y b
  var f1 = function (n) { return Math.round(n * 10) / 10; };
  var f2 = function (n) { return Math.round(n * 100) / 100; };

  /* generador con semilla: la misma mesa siempre */
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- paleta: tokens de la web y los materiales de la mesa real ---------- */
  function token(n, fb) {
    try { var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v || fb; } catch (e) { return fb; }
  }
  function paleta() {
    return {
      lino: token('--lino', '#F3EEE5'), lino2: token('--lino-2', '#E9E1D3'), blanco: token('--blanco', '#FBF9F4'),
      tinta: token('--tinta', '#2B2823'), tinta2: token('--tinta-2', '#5E574D'),
      granito: token('--granito', '#B6AA98'), granito2: token('--granito-2', '#8F8473'),
      teja: token('--teja', '#A9503A'), hoja: token('--hoja', '#5D7347'), hoja2: token('--hoja-2', '#8EA273'),
      // la mesa de pino de IG 19 (miel, con nudos), el esparto de los salvamanteles, la loza azul grisácea con borde de perlas, el latón
      pino: '#D2A46A', pinoOsc: '#A8743A', pinoClaro: '#E9C795',
      esparto: '#BE9E64', espartoOsc: '#9C7C46', espartoClaro: '#D8BE88',
      loza: '#F2F5F4', lozaSombra: '#C6D3D7', lozaAzul: '#A7C1C9', lozaAzulOsc: '#7D9DA8',
      laton: '#C9A456', latonOsc: '#8F6B26', latonClaro: '#EBD08A',
      silla: '#F6F3EC', caña: '#DCCBA2',
      cera: '#F3ECD6', flor: ['#8498CC', '#A2B2DC', '#B9B4DE', '#CFC8E8', '#DDE3F3', '#D7A9C3'],
      eucalipto: ['#7C9B87', '#9BB3A0', '#6C8C76', '#B4C7B2', '#5D7347']
    };
  }

  /* ---------- texturas generadas con semilla fija (canvas → dataURL): la trama del lino y las vetas del pino ---------- */
  var cacheTex = {};
  function texLino() {
    if (cacheTex.lino) return cacheTex.lino;
    var n = 192, c = document.createElement('canvas'); c.width = c.height = n;
    var x = c.getContext('2d'), r = rng(1109), i;
    x.fillStyle = '#EFE8DA'; x.fillRect(0, 0, n, n);
    for (i = 0; i < n; i += 2) {                       // hilos de urdimbre y trama, con su grosor desigual
      x.fillStyle = 'rgba(' + (r() > .5 ? '120,100,70' : '255,252,244') + ',' + (0.05 + r() * 0.09) + ')';
      x.fillRect(0, i, n, 1 + (r() > .7 ? 1 : 0));
      x.fillStyle = 'rgba(' + (r() > .5 ? '120,100,70' : '255,252,244') + ',' + (0.04 + r() * 0.08) + ')';
      x.fillRect(i, 0, 1 + (r() > .75 ? 1 : 0), n);
    }
    for (i = 0; i < 70; i++) {                         // nudillos del hilo (slubs)
      var y = r() * n, l = 6 + r() * 24, xx = r() * n;
      x.fillStyle = 'rgba(110,90,60,' + (0.06 + r() * 0.08) + ')'; x.fillRect(xx, y, l, 1.4);
    }
    return (cacheTex.lino = c.toDataURL('image/png'));
  }
  function texPino() {
    if (cacheTex.pino) return cacheTex.pino;
    var W = 680, H = 640, c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d'), r = rng(1919), p = paleta(), i, j;
    var tablas = 4, ancho = W / tablas;
    for (i = 0; i < tablas; i++) {
      var g = x.createLinearGradient(i * ancho, 0, (i + 1) * ancho, 0);
      var dl = (r() - .5) * 26;
      g.addColorStop(0, shade(p.pino, dl - 6)); g.addColorStop(.5, shade(p.pino, dl + 5)); g.addColorStop(1, shade(p.pino, dl - 4));
      x.fillStyle = g; x.fillRect(i * ancho, 0, ancho, H);
      for (j = 0; j < 150; j++) {                      // vetas: trazos largos y ondulados a lo largo de la tabla (envuelven en vertical)
        var px = i * ancho + 4 + r() * (ancho - 8), py = r() * H, len = 120 + r() * 420, amp = 0.8 + r() * 2.2, fase = r() * 6.28;
        x.strokeStyle = r() > .22 ? 'rgba(120,76,32,' + (0.05 + r() * 0.13) + ')' : 'rgba(255,236,196,' + (0.05 + r() * 0.1) + ')';
        x.lineWidth = 0.5 + r() * 1.6;
        for (var k = -1; k <= 1; k++) {
          x.beginPath();
          for (var s = 0; s <= len; s += 12) {
            var yy = py + s + k * H, xx = px + Math.sin(fase + s / 70) * amp;
            if (s === 0) x.moveTo(xx, yy); else x.lineTo(xx, yy);
          }
          x.stroke();
        }
      }
      var nudo = { x: i * ancho + ancho * (0.3 + r() * 0.4), y: r() * H };       // un nudo por tabla, con sus anillos
      for (j = 7; j >= 1; j--) {
        x.strokeStyle = 'rgba(96,58,22,' + (0.1 + (7 - j) * 0.035) + ')'; x.lineWidth = 1.1;
        x.beginPath(); x.ellipse(nudo.x, nudo.y, 3 + j * 2.3, 6 + j * 5.6, 0, 0, 6.283); x.stroke();
      }
      x.fillStyle = 'rgba(78,44,16,.55)'; x.beginPath(); x.ellipse(nudo.x, nudo.y, 3.4, 7.5, 0, 0, 6.283); x.fill();
      x.fillStyle = 'rgba(78,44,16,.5)'; x.fillRect(i * ancho - 1, 0, 2, H);           // la junta entre tablas
      x.fillStyle = 'rgba(255,236,200,.28)'; x.fillRect(i * ancho + 1, 0, 1.2, H);
    }
    return (cacheTex.pino = c.toDataURL('image/jpeg', 0.86));
  }
  function shade(hex, d) {
    var n = parseInt(hex.slice(1), 16), r = clamp((n >> 16) + d, 0, 255), g = clamp(((n >> 8) & 255) + d, 0, 255), b = clamp((n & 255) + d, 0, 255);
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }
  function mezcla(a, b, t) {   // a, b: '#rrggbb'
    var A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16), o = '#', i, ca, cb;
    for (i = 16; i >= 0; i -= 8) { ca = (A >> i) & 255; cb = (B >> i) & 255; o += ('0' + Math.round(ca + (cb - ca) * t).toString(16)).slice(-2); }
    return o;
  }

  /* =====================================================================
     1. LAS PIEZAS (cadenas SVG; cada una dibujada con el origen en su centro, luz de ventana arriba a la izquierda,
        sombra hacia abajo a la derecha)
     ===================================================================== */
  var DEFS_ID = 'emz';
  function ensureDefs(p) {
    if (!document.getElementById(DEFS_ID + '-defs')) {
      var h = document.createElementNS(NS, 'svg');
      h.setAttribute('id', DEFS_ID + '-defs'); h.setAttribute('width', '0'); h.setAttribute('height', '0'); h.setAttribute('aria-hidden', 'true'); h.setAttribute('focusable', 'false');
      h.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
      h.innerHTML = '<defs>' + defs(DEFS_ID, p || paleta()) + '</defs>';
      (document.body || document.documentElement).appendChild(h);
    }
    return DEFS_ID;
  }
  function defs(id, p) {
    var s = '';
    s += '<radialGradient id="' + id + '-plato" cx=".36" cy=".3" r=".85"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="' + p.loza + '"/><stop offset="1" stop-color="' + p.lozaSombra + '"/></radialGradient>';
    s += '<radialGradient id="' + id + '-pozo" cx=".62" cy=".64" r=".78"><stop offset="0" stop-color="#FBFDFC"/><stop offset=".62" stop-color="#E8EFEF"/><stop offset="1" stop-color="#C2D3D8"/></radialGradient>';
    s += '<radialGradient id="' + id + '-bajo" cx=".36" cy=".3" r=".9"><stop offset="0" stop-color="' + mezcla(p.lozaAzul, '#ffffff', .38) + '"/><stop offset="1" stop-color="' + p.lozaAzulOsc + '"/></radialGradient>';
    s += '<radialGradient id="' + id + '-sombra"><stop offset="0" stop-color="#3a2810" stop-opacity=".40"/><stop offset=".68" stop-color="#3a2810" stop-opacity=".28"/><stop offset="1" stop-color="#3a2810" stop-opacity="0"/></radialGradient>';
    s += '<radialGradient id="' + id + '-perlaG" cx=".34" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="' + p.lozaSombra + '"/></radialGradient>';
    s += '<symbol id="' + id + '-perla" overflow="visible"><circle r="2.35" fill="url(#' + id + '-perlaG)" stroke="rgba(100,130,140,.35)" stroke-width=".5"/></symbol>';
    s += '<radialGradient id="' + id + '-esp" cx=".34" cy=".28" r=".95"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#2a1a08" stop-opacity=".34"/></radialGradient>';
    s += '<linearGradient id="' + id + '-laton" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="' + p.latonOsc + '"/><stop offset=".32" stop-color="' + p.latonClaro + '"/><stop offset=".66" stop-color="' + p.laton + '"/><stop offset="1" stop-color="' + p.latonOsc + '"/></linearGradient>';
    s += '<radialGradient id="' + id + '-baseL" cx=".34" cy=".3" r=".9"><stop offset="0" stop-color="' + p.latonClaro + '"/><stop offset=".55" stop-color="' + p.laton + '"/><stop offset="1" stop-color="' + p.latonOsc + '"/></radialGradient>';
    s += '<radialGradient id="' + id + '-cera" cx=".36" cy=".3" r=".85"><stop offset="0" stop-color="#FFFDF1"/><stop offset="1" stop-color="' + mezcla(p.cera, '#9b8a5a', .35) + '"/></radialGradient>';
    s += '<radialGradient id="' + id + '-llama" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFFBE6"/><stop offset=".4" stop-color="#FFD670"/><stop offset="1" stop-color="#FF9B2F" stop-opacity="0"/></radialGradient>';
    s += '<radialGradient id="' + id + '-halo" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFD98A" stop-opacity=".66"/><stop offset=".45" stop-color="#FFC060" stop-opacity=".24"/><stop offset="1" stop-color="#FFB050" stop-opacity="0"/></radialGradient>';
    s += '<radialGradient id="' + id + '-cristal" cx=".38" cy=".34" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".62"/><stop offset=".7" stop-color="#DCEBEF" stop-opacity=".30"/><stop offset="1" stop-color="#9DBBC4" stop-opacity=".42"/></radialGradient>';
    s += '<radialGradient id="' + id + '-caust" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".72"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>';
    s += '<linearGradient id="' + id + '-velaS" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a2810" stop-opacity=".30"/><stop offset="1" stop-color="#3a2810" stop-opacity="0"/></linearGradient>';
    s += '<linearGradient id="' + id + '-sombraL" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#3a2810" stop-opacity=".0"/><stop offset="1" stop-color="#3a2810" stop-opacity=".34"/></linearGradient>';
    s += '<linearGradient id="' + id + '-sombraR" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#3a2810" stop-opacity=".34"/><stop offset="1" stop-color="#3a2810" stop-opacity="0"/></linearGradient>';
    s += '<linearGradient id="' + id + '-servG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#4a3a22" stop-opacity=".22"/></linearGradient>';
    s += '<linearGradient id="' + id + '-ban" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".0"/><stop offset=".5" stop-color="#FFF4D6" stop-opacity=".30"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>';
    s += '<linearGradient id="' + id + '-banO" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#3a2810" stop-opacity="0"/><stop offset=".5" stop-color="#3a2810" stop-opacity=".12"/><stop offset="1" stop-color="#3a2810" stop-opacity="0"/></linearGradient>';
    s += '<pattern id="' + id + '-lino" width="192" height="192" patternUnits="userSpaceOnUse"><image href="' + texLino() + '" width="192" height="192"/></pattern>';
    s += '<pattern id="' + id + '-pino" x="-340" y="0" width="680" height="640" patternUnits="userSpaceOnUse"><image href="' + texPino() + '" width="680" height="640"/></pattern>';
    s += '<pattern id="' + id + '-pinoH" x="0" y="0" width="680" height="640" patternUnits="userSpaceOnUse" patternTransform="rotate(90)"><image href="' + texPino() + '" width="680" height="640"/></pattern>';
    s += '<pattern id="' + id + '-cana" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="9" fill="' + p.caña + '"/><path d="M0 0H9M0 4.5H9" stroke="#B49A66" stroke-width=".9" opacity=".7"/><path d="M0 0V9M4.5 0V9" stroke="#fff" stroke-width=".7" opacity=".55"/></pattern>';
    var i;
    for (i = 0; i < p.flor.length; i++) {
      s += '<symbol id="' + id + '-fl' + i + '" overflow="visible"><g fill="' + p.flor[i] + '" stroke="' + mezcla(p.flor[i], '#2a2e5a', .22) + '" stroke-width=".5" stroke-opacity=".6"><circle cx="-3.5" cy="0" r="4.1"/><circle cx="3.5" cy="0" r="4.1"/><circle cx="0" cy="-3.5" r="4.1"/><circle cx="0" cy="3.5" r="4.1"/></g><circle r="1.5" fill="#EFE8C8" opacity=".85"/></symbol>';
    }
    return s;
  }

  /* ---------- loza: plato con borde de perlas, plato bajo azul, cuenco ---------- */
  function plato(id, p, r, o) {
    o = o || {};
    var n = Math.round(r * 0.66), i, perlas = '';
    for (i = 0; i < n; i++) perlas += '<use href="#' + id + '-perla" transform="rotate(' + f1(i * 360 / n) + ') translate(0 ' + f1(-(r - 5.3)) + ')"/>';
    var s = '<g class="sombra"><ellipse cx="' + f1(r * .11) + '" cy="' + f1(r * .17) + '" rx="' + f1(r * 1.06) + '" ry="' + f1(r * 1.04) + '" fill="url(#' + id + '-sombra)"/></g>';
    s += '<g class="cuerpo">';
    if (o.bajo) {
      var rb = r * 1.2, nb = Math.round(rb * 0.5);
      s += '<circle r="' + f1(rb) + '" fill="url(#' + id + '-bajo)" stroke="' + p.lozaAzulOsc + '" stroke-width="1"/>';
      s += '<circle r="' + f1(rb - 4) + '" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="1.2"/>';
      for (i = 0; i < nb; i++) s += '<circle cx="0" cy="' + f1(-(rb - 2.6)) + '" r="1.5" fill="rgba(255,255,255,.55)" transform="rotate(' + f1(i * 360 / nb) + ')"/>';
    }
    s += '<circle r="' + f1(r) + '" fill="url(#' + id + '-plato)" stroke="#B3C4C9" stroke-width="1"/>';
    s += perlas;
    s += '<circle r="' + f1(r * .7) + '" fill="url(#' + id + '-pozo)" stroke="rgba(110,140,150,.38)" stroke-width="1.2"/>';
    s += '<path d="M' + f1(-r * .86) + ' ' + f1(-r * .24) + 'A' + f1(r * .9) + ' ' + f1(r * .9) + ' 0 0 1 ' + f1(-r * .24) + ' ' + f1(-r * .86) + '" fill="none" stroke="#fff" stroke-opacity=".95" stroke-width="2.6" stroke-linecap="round"/>';
    s += '<path d="M' + f1(r * .9) + ' ' + f1(r * .26) + 'A' + f1(r * .93) + ' ' + f1(r * .93) + ' 0 0 1 ' + f1(r * .26) + ' ' + f1(r * .9) + '" fill="none" stroke="rgba(80,110,122,.28)" stroke-width="3" stroke-linecap="round"/>';
    if (o.cuenco) s += cuenco(id, p, r * .64, o);
    s += '</g>';
    return s;
  }
  function cuenco(id, p, r, o) {
    var n = Math.round(r * 0.62), i, perlas = '';
    for (i = 0; i < n; i++) perlas += '<use href="#' + id + '-perla" transform="rotate(' + f1(i * 360 / n) + ') translate(0 ' + f1(-(r - 4.4)) + ') scale(.82)"/>';
    var s = '<g class="cuenco"><ellipse cx="' + f1(r * .12) + '" cy="' + f1(r * .2) + '" rx="' + f1(r * 1.04) + '" ry="' + f1(r * 1.02) + '" fill="url(#' + id + '-sombra)" opacity=".9"/>';
    s += '<circle r="' + f1(r) + '" fill="url(#' + id + '-plato)" stroke="#AFC1C7" stroke-width="1"/>' + perlas;
    s += '<circle r="' + f1(r * .76) + '" fill="url(#' + id + '-pozo)" stroke="rgba(100,130,142,.45)" stroke-width="1.3"/>';
    s += '<path d="M' + f1(-r * .72) + ' ' + f1(-r * .16) + 'A' + f1(r * .74) + ' ' + f1(r * .74) + ' 0 0 1 ' + f1(-r * .16) + ' ' + f1(-r * .72) + '" fill="none" stroke="rgba(70,100,112,.38)" stroke-width="3.2" stroke-linecap="round"/>';
    if (o.hoja !== false) {      // la hojita de laurel y las dos bellotas del cuenco de IG 19
      s += '<g transform="translate(' + f1(-r * .12) + ' ' + f1(r * .12) + ') rotate(-24)"><path d="M0 -10Q8 -2 0 11Q-8 -2 0 -10Z" fill="#5F7D4A" stroke="#46603A" stroke-width=".7"/><path d="M0 -9V10" stroke="#8EA273" stroke-width=".8"/></g>';
      s += '<ellipse cx="' + f1(r * .22) + '" cy="' + f1(r * .1) + '" rx="3.4" ry="4.2" fill="#6C3C34" transform="rotate(20 ' + f1(r * .22) + ' ' + f1(r * .1) + ')"/><ellipse cx="' + f1(r * .34) + '" cy="' + f1(r * .2) + '" rx="3.2" ry="4" fill="#7B4A3B" transform="rotate(-10 ' + f1(r * .34) + ' ' + f1(r * .2) + ')"/>';
    }
    return s + '</g>';
  }

  /* ---------- salvamanteles de esparto trenzado ---------- */
  function esparto(id, p, R) {
    var s = '<g class="sombra"><ellipse cx="' + f1(R * .08) + '" cy="' + f1(R * .13) + '" rx="' + f1(R * 1.03) + '" ry="' + f1(R * 1.0) + '" fill="url(#' + id + '-sombra)"/></g>';
    s += '<g class="cuerpo"><circle r="' + f1(R) + '" fill="' + p.espartoOsc + '"/>';
    var n = 0, rr;
    for (rr = R - 3.6; rr > R * 0.3; rr -= 6.3) {
      n++;
      s += '<circle r="' + f1(rr) + '" fill="none" stroke="' + (n % 2 ? p.espartoClaro : p.esparto) + '" stroke-width="5.6" stroke-dasharray="' + (n % 3 ? '9.5 2.6' : '6.5 3.4') + '" stroke-dashoffset="' + f1((n * 4.7) % 13) + '"/>';
      s += '<circle r="' + f1(rr - 2.6) + '" fill="none" stroke="rgba(70,45,15,.28)" stroke-width=".7"/>';
    }
    s += '<circle r="' + f1(R * .3) + '" fill="' + p.espartoOsc + '"/>';
    s += '<circle r="' + f1(R) + '" fill="url(#' + id + '-esp)"/><circle r="' + f1(R - .6) + '" fill="none" stroke="' + p.espartoOsc + '" stroke-width="1.6"/></g>';
    return s;
  }

  /* ---------- servilleta de lino doblada (el pliegue es un grupo aparte: «se dobla» al ponerse la mesa) ---------- */
  function servilleta(id, p, r) {
    var w = r * 1.5, h = r * .8, x = -w / 2, y = -h / 2;
    var s = '<g class="sombra"><rect x="' + f1(x + 4) + '" y="' + f1(y + 8) + '" width="' + f1(w) + '" height="' + f1(h) + '" rx="3" fill="#3a2810" opacity=".13"/><rect x="' + f1(x + 2.5) + '" y="' + f1(y + 5) + '" width="' + f1(w) + '" height="' + f1(h) + '" rx="3" fill="#3a2810" opacity=".16"/></g>';
    s += '<g class="cuerpo"><rect x="' + f1(x) + '" y="' + f1(y) + '" width="' + f1(w) + '" height="' + f1(h) + '" rx="2.5" fill="#EAE5DA" stroke="rgba(120,105,80,.35)" stroke-width=".8"/>';
    s += '<rect x="' + f1(x) + '" y="' + f1(y) + '" width="' + f1(w) + '" height="' + f1(h) + '" rx="2.5" fill="url(#' + id + '-lino)" opacity=".85"/>';
    s += '<rect x="' + f1(x) + '" y="' + f1(y) + '" width="' + f1(w) + '" height="' + f1(h) + '" rx="2.5" fill="url(#' + id + '-servG)"/>';
    s += '<g class="pliegue"><path d="M' + f1(x + w * .64) + ' ' + f1(y) + 'H' + f1(x + w) + 'V' + f1(y + h) + 'H' + f1(x + w * .64) + 'Z" fill="#F4F0E6" stroke="rgba(120,105,80,.3)" stroke-width=".8"/>';
    s += '<path d="M' + f1(x + w * .64) + ' ' + f1(y) + 'V' + f1(y + h) + '" stroke="rgba(90,75,50,.3)" stroke-width="1.4"/><path d="M' + f1(x + w * .64 + 1.6) + ' ' + f1(y) + 'V' + f1(y + h) + '" stroke="rgba(255,255,255,.7)" stroke-width="1"/></g>';
    s += '<path d="M' + f1(x + 5) + ' ' + f1(y + 4.5) + 'H' + f1(x + w * .6) + '" stroke="rgba(120,105,80,.25)" stroke-width=".8" stroke-dasharray="3 2"/>';
    return s + '</g>';
  }

  /* ---------- cubiertos de latón: tenedor y cuchillo (vertical, origen arriba) ---------- */
  function tenedor(id, p, esc) {
    var t = '', i;
    for (i = 0; i < 4; i++) t += '<rect x="' + f1(-6.7 + i * 3.7) + '" y="0" width="2.3" height="27" rx="1.1"/>';
    var d = 'M-6.7 24H6.7Q6.7 38 2.7 46V50H-2.7V46Q-6.7 38 -6.7 24Z M-2.7 48H2.7L3.9 136Q3.9 150 0 150Q-3.9 150 -3.9 136Z';
    return '<g class="cubierto" transform="scale(' + esc + ')"><g transform="translate(4 6)" fill="#3a2810" opacity=".22"><path d="' + d + '"/>' + t + '</g>' +
      '<g fill="url(#' + id + '-laton)" stroke="' + p.latonOsc + '" stroke-width=".55">' + t + '<path d="' + d + '"/></g>' +
      '<path d="M-1.4 56L-2 136" stroke="rgba(255,248,214,.8)" stroke-width=".9" stroke-linecap="round"/></g>';
  }
  function cuchillo(id, p, esc) {
    var d = 'M-4.6 0C3 0 6.2 10 6.2 24V66H-4.6Z M-4.6 64H6.2L5.7 144Q5.7 150 .8 150Q-4 150 -4 144Z';
    return '<g class="cubierto" transform="scale(' + esc + ')"><g transform="translate(4 6)" fill="#3a2810" opacity=".22"><path d="' + d + '"/></g>' +
      '<path d="M-4.6 0C3 0 6.2 10 6.2 24V66H-4.6Z" fill="' + mezcla(p.latonClaro, '#ffffff', .25) + '" stroke="' + p.latonOsc + '" stroke-width=".55"/>' +
      '<path d="M-4.6 64H6.2L5.7 144Q5.7 150 .8 150Q-4 150 -4 144Z" fill="url(#' + id + '-laton)" stroke="' + p.latonOsc + '" stroke-width=".55"/>' +
      '<path d="M-2.4 6V60" stroke="rgba(255,255,255,.75)" stroke-width="1" stroke-linecap="round"/><path d="M-1.4 70L-1.8 138" stroke="rgba(255,248,214,.8)" stroke-width=".9" stroke-linecap="round"/></g>';
  }

  /* ---------- copa de agua y vaso (vistos desde arriba: aro, vaso, brillo, y la luz que el cristal deja en el mantel) ---------- */
  function copa(id, p, r) {
    var s = '<g class="sombra"><ellipse cx="' + f1(r * .55) + '" cy="' + f1(r * .75) + '" rx="' + f1(r * 1.0) + '" ry="' + f1(r * .95) + '" fill="#3a2810" opacity=".16"/>';
    s += '<ellipse cx="' + f1(r * .95) + '" cy="' + f1(r * 1.35) + '" rx="' + f1(r * .72) + '" ry="' + f1(r * .5) + '" fill="url(#' + id + '-caust)" transform="rotate(38 ' + f1(r * .95) + ' ' + f1(r * 1.35) + ')"/></g>';
    s += '<g class="cuerpo"><circle r="' + f1(r) + '" fill="url(#' + id + '-cristal)" stroke="#fff" stroke-opacity=".95" stroke-width="2.2"/>';
    s += '<circle r="' + f1(r - 2.4) + '" fill="none" stroke="rgba(120,150,162,.55)" stroke-width="1"/>';
    s += '<circle r="' + f1(r * .55) + '" fill="rgba(210,228,233,.28)" stroke="rgba(130,160,172,.35)" stroke-width=".8"/>';
    s += '<circle cx="' + f1(r * .08) + '" cy="' + f1(r * .1) + '" r="' + f1(r * .2) + '" fill="rgba(255,255,255,.35)"/>';
    s += '<path d="M' + f1(-r * .74) + ' ' + f1(-r * .22) + 'A' + f1(r * .78) + ' ' + f1(r * .78) + ' 0 0 1 ' + f1(-r * .22) + ' ' + f1(-r * .74) + '" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".95"/>';
    s += '<path d="M' + f1(r * .7) + ' ' + f1(r * .3) + 'A' + f1(r * .76) + ' ' + f1(r * .76) + ' 0 0 1 ' + f1(r * .3) + ' ' + f1(r * .7) + '" fill="none" stroke="rgba(90,125,140,.5)" stroke-width="1.8" stroke-linecap="round"/></g>';
    return s;
  }
  function vaso(id, p, r) {
    var s = copa(id, p, r), i, nervios = '';
    for (i = 0; i < 18; i++) nervios += '<path d="M' + f1(Math.cos(i * 0.349) * r * .62) + ' ' + f1(Math.sin(i * 0.349) * r * .62) + 'L' + f1(Math.cos(i * 0.349) * (r - 2.6)) + ' ' + f1(Math.sin(i * 0.349) * (r - 2.6)) + '" stroke="rgba(130,160,172,.5)" stroke-width=".8"/>';
    var k = s.lastIndexOf('</g>');
    return s.slice(0, k) + nervios + s.slice(k);
  }

  /* ---------- vela alta en candelabro de latón (la sombra larga cae hacia la derecha) ---------- */
  function vela(id, p, o) {
    o = o || {};
    var s = '<g class="sombra"><path d="M-7 3L7 5L84 128L64 140Z" fill="url(#' + id + '-velaS)"/><ellipse cx="6" cy="9" rx="24" ry="22" fill="#3a2810" opacity=".22"/></g>';
    s += '<g class="cuerpo"><circle r="24" fill="url(#' + id + '-baseL)" stroke="' + p.latonOsc + '" stroke-width=".9"/>';
    s += '<circle r="17" fill="none" stroke="rgba(255,244,200,.55)" stroke-width="1.1"/><circle r="9.5" fill="' + p.latonOsc + '" opacity=".78"/>';
    s += '<path d="M-9 0L-11.6 -9.5A8.8 8.8 0 0 1 5.6 -9.5L9 0Z" fill="' + mezcla(p.cera, '#8c7a4a', .3) + '"/>';
    s += '<circle cx="-3" cy="-10" r="8.8" fill="url(#' + id + '-cera)" stroke="rgba(120,100,50,.45)" stroke-width=".7"/>';
    s += '<circle cx="-3" cy="-10" r="4.8" fill="#E8DDB4" stroke="rgba(120,100,50,.3)" stroke-width=".5"/><circle cx="-3" cy="-10.6" r="1.2" fill="#4a3a28"/></g>';
    s += '<g class="llama"><circle cx="-3" cy="-11" r="76" fill="url(#' + id + '-halo)" class="halo"/><ellipse cx="-3" cy="-12" rx="4.6" ry="6.4" fill="url(#' + id + '-llama)" class="fuego"/><ellipse cx="-3" cy="-11.4" rx="1.6" ry="2.6" fill="#fff" opacity=".9" class="nucleo"/></g>';
    s += '<circle class="hit" r="36" fill="transparent"/>';
    return s;
  }

  /* ---------- hortensias en su jarrita esmaltada ---------- */
  function hortensias(id, p, rnd, R) {
    var i, s = '<g class="sombra"><ellipse cx="9" cy="14" rx="' + f1(R * 1.0) + '" ry="' + f1(R * .98) + '" fill="url(#' + id + '-sombra)"/></g><g class="cuerpo">';
    s += '<circle r="' + f1(R * .62) + '" fill="#F4F1E8" stroke="#C9C0AC" stroke-width="1.2"/><circle r="' + f1(R * .5) + '" fill="#58656C"/>';
    for (i = 0; i < 7; i++) {        // hojas grandes que asoman por debajo
      var a = i * 51 + rnd() * 20, l = R * (.95 + rnd() * .22);
      s += '<g transform="rotate(' + f1(a) + ')"><path d="M0 ' + f1(-R * .35) + 'C' + f1(l * .38) + ' ' + f1(-l * .55) + ' ' + f1(l * .2) + ' ' + f1(-l * 1.0) + ' 0 ' + f1(-l * 1.05) + 'C' + f1(-l * .2) + ' ' + f1(-l * 1.0) + ' ' + f1(-l * .38) + ' ' + f1(-l * .55) + ' 0 ' + f1(-R * .35) + 'Z" fill="' + (i % 2 ? '#5C7A47' : '#6C8A55') + '" stroke="#42592F" stroke-width=".8"/><path d="M0 ' + f1(-R * .4) + 'V' + f1(-l * .95) + '" stroke="#9DB77F" stroke-width=".9"/></g>';
    }
    for (i = 0; i < 74; i++) {        // florecillas: densas en el centro, algo sueltas en el borde
      var rr = R * 0.9 * Math.sqrt(rnd()), th = rnd() * 6.283, c = Math.floor(rnd() * rnd() * p.flor.length * 1.1);
      c = Math.min(c, p.flor.length - 1);
      var k = .75 + rnd() * .55 + (1 - rr / R) * .25;
      s += '<use href="#' + id + '-fl' + c + '" transform="translate(' + f1(Math.cos(th) * rr) + ' ' + f1(Math.sin(th) * rr) + ') rotate(' + f1(rnd() * 90) + ') scale(' + f2(k) + ')"/>';
    }
    s += '<circle cx="' + f1(-R * .25) + '" cy="' + f1(-R * .3) + '" r="' + f1(R * .42) + '" fill="#fff" opacity=".1"/>';
    s += '<circle class="hit" r="' + f1(R * 1.05) + '" fill="transparent"/></g>';
    return s;
  }

  /* ---------- guirnalda de eucalipto y cardos a lo largo del camino de mesa (coordenadas de mesa: x = a lo ancho, y = a lo largo) ---------- */
  function guirnalda(id, p, rnd, y0, y1) {
    var sombra = '', hojas = '', tallos = '', adornos = '', i, j;
    var n = Math.round((y1 - y0) / 24);
    for (i = 0; i < n; i++) {
      var by = y0 + (i + rnd()) * (y1 - y0) / n, bx = (rnd() - .5) * 46;
      var dir = rnd() < .5 ? -1 : 1, ang = (rnd() - .5) * 1.1 + (dir < 0 ? Math.PI : 0) + Math.PI / 2;     // a lo largo del camino, con abanico
      var len = 70 + rnd() * 70, curv = (rnd() - .5) * 46;
      var ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len;
      var cx = (bx + ex) / 2 + Math.cos(ang + 1.57) * curv, cy = (by + ey) / 2 + Math.sin(ang + 1.57) * curv;
      tallos += '<path d="M' + f1(bx) + ' ' + f1(by) + 'Q' + f1(cx) + ' ' + f1(cy) + ' ' + f1(ex) + ' ' + f1(ey) + '" fill="none" stroke="#5C6E4A" stroke-width="2.2" stroke-linecap="round" class="tallo"/>';
      var m = Math.round(len / 13);
      for (j = 1; j <= m; j++) {
        var t = j / m, px = (1 - t) * (1 - t) * bx + 2 * (1 - t) * t * cx + t * t * ex, py = (1 - t) * (1 - t) * by + 2 * (1 - t) * t * cy + t * t * ey;
        var tx = 2 * (1 - t) * (cx - bx) + 2 * t * (ex - cx), ty = 2 * (1 - t) * (cy - by) + 2 * t * (ey - cy), tl = Math.hypot(tx, ty) || 1;
        var lado = j % 2 ? 1 : -1, nx = -ty / tl * lado, ny = tx / tl * lado;
        var rl = (7.5 + rnd() * 6) * (1.1 - t * .35), lx = px + nx * rl * .85, ly = py + ny * rl * .85;
        var rot = Math.atan2(ny, nx) * 57.3 + 90;
        var col = p.eucalipto[Math.floor(rnd() * p.eucalipto.length)];
        sombra += '<ellipse cx="' + f1(lx + 5) + '" cy="' + f1(ly + 8) + '" rx="' + f1(rl * .88) + '" ry="' + f1(rl) + '" transform="rotate(' + f1(rot) + ' ' + f1(lx + 5) + ' ' + f1(ly + 8) + ')"/>';
        hojas += '<g class="hoja" transform="translate(' + f1(lx) + ' ' + f1(ly) + ') rotate(' + f1(rot) + ')"><ellipse rx="' + f1(rl * .88) + '" ry="' + f1(rl) + '" fill="' + col + '" stroke="' + mezcla(col, '#2a3a24', .35) + '" stroke-width=".7"/><path d="M0 ' + f1(rl * .85) + 'V' + f1(-rl * .8) + '" stroke="' + mezcla(col, '#ffffff', .4) + '" stroke-width=".7" opacity=".7"/><ellipse cx="' + f1(-rl * .25) + '" cy="' + f1(-rl * .3) + '" rx="' + f1(rl * .3) + '" ry="' + f1(rl * .4) + '" fill="#fff" opacity=".13"/></g>';
      }
    }
    for (i = 0; i < 9; i++) {       // cardos azules (los de la guirnalda de IG 19)
      var ty2 = y0 + 30 + rnd() * (y1 - y0 - 60), tx2 = (rnd() - .5) * 60, r = 8 + rnd() * 4;
      adornos += '<g class="cardo" transform="translate(' + f1(tx2) + ' ' + f1(ty2) + ')"><ellipse cx="4" cy="7" rx="' + f1(r * 1.3) + '" ry="' + f1(r * 1.3) + '" fill="#3a2810" opacity=".16"/>';
      for (j = 0; j < 14; j++) adornos += '<path d="M0 0L' + f1(Math.cos(j * .449) * (r + 6)) + ' ' + f1(Math.sin(j * .449) * (r + 6)) + '" stroke="#4E62A8" stroke-width="1.4" stroke-linecap="round"/>';
      adornos += '<circle r="' + f1(r) + '" fill="#6B7FBD" stroke="#4A5C9E" stroke-width=".8"/><circle cx="-2" cy="-2.5" r="' + f1(r * .45) + '" fill="#9BAAD6" opacity=".7"/></g>';
    }
    return { sombra: '<g fill="#3a2810" opacity=".15">' + sombra + '</g>', cuerpo: '<g class="guirnalda-tallos">' + tallos + '</g><g class="guirnalda-hojas">' + hojas + '</g><g class="guirnalda-cardos">' + adornos + '</g>' };
  }

  /* ---------- silla blanca de respaldo de rejilla (vista desde arriba, metida bajo la mesa) ---------- */
  function silla(id, p, lado) {
    // lado: -1 izquierda, +1 derecha; el origen es el centro del asiento; el respaldo queda hacia fuera
    var s = '<g transform="scale(' + lado + ' 1)">';
    s += '<ellipse cx="' + (lado > 0 ? 18 : 18) + '" cy="16" rx="82" ry="76" fill="url(#' + id + '-sombra)" opacity=".8"/>';
    s += '<rect x="-62" y="-60" width="124" height="120" rx="30" fill="' + p.silla + '" stroke="#CFC8B6" stroke-width="1.2"/>';
    s += '<rect x="-52" y="-50" width="104" height="100" rx="24" fill="none" stroke="#fff" stroke-width="2" opacity=".8"/>';
    s += '<path d="M62 -64Q96 -62 98 -40V40Q96 62 62 64Q74 0 62 -64Z" fill="url(#' + id + '-cana)" stroke="' + p.silla + '" stroke-width="7" stroke-linejoin="round"/>';
    s += '<path d="M62 -64Q96 -62 98 -40V40Q96 62 62 64" fill="none" stroke="#CFC8B6" stroke-width="1" />';
    s += '<rect x="-62" y="-60" width="124" height="120" rx="30" fill="url(#' + id + '-servG)" opacity=".7"/></g>';
    return s;
  }

  /* =====================================================================
     2. LA TARJETA CON EL NOMBRE (escrita a pluma) · Entremuros.mesa.tarjeta
     ===================================================================== */
  function elSVG(tag, attrs, html) {
    var e = document.createElementNS(NS, tag), k;
    if (attrs) for (k in attrs) e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esperarLetra(fam, cb) {
    var hecho = false, fin = function () { if (!hecho) { hecho = true; cb(); } };
    try {
      if (document.fonts && document.fonts.load) {
        document.fonts.load('40px ' + fam).then(fin, fin);
        setTimeout(fin, 1400);
      } else fin();
    } catch (e) { fin(); }
  }
  var FUENTE_NOMBRE = "var(--f-nombre, 'Pinyon Script', 'Snell Roundhand', cursive)";

  /* Construye una tarjeta en el grupo `g` (origen en el centro). Devuelve el control de escritura. */
  function tarjetaEn(g, id, p, texto, o) {
    o = o || {};
    var W = o.w || 128, H = o.h || 52, escribiendo = null;
    var t = String(texto == null ? '' : texto).replace(/\s+/g, ' ').trim() || 'Bienvenidos';
    var mid = uid('tm');
    g.innerHTML =
      '<defs><linearGradient id="' + mid + '-k" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E6D2A8"/><stop offset=".6" stop-color="#D8BE8E"/><stop offset="1" stop-color="#C9AC78"/></linearGradient>' +
      '<mask id="' + mid + '-m" maskUnits="userSpaceOnUse" x="' + (-W) + '" y="' + (-H) + '" width="' + (W * 2) + '" height="' + (H * 2) + '"><path class="t-traza" d="" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/></mask></defs>' +
      '<rect x="' + f1(-W / 2 + 3) + '" y="' + f1(-H / 2 + 6) + '" width="' + W + '" height="' + H + '" rx="5" fill="#3a2810" opacity=".18"/>' +
      '<rect x="' + f1(-W / 2) + '" y="' + f1(-H / 2) + '" width="' + W + '" height="' + H + '" rx="5" fill="url(#' + mid + '-k)" stroke="#A8895A" stroke-width=".9"/>' +
      '<rect x="' + f1(-W / 2 + 4) + '" y="' + f1(-H / 2 + 4) + '" width="' + (W - 8) + '" height="' + (H - 8) + '" rx="3" fill="none" stroke="rgba(110,80,40,.28)" stroke-width=".8" stroke-dasharray="2.4 2"/>' +
      '<circle cx="' + f1(W / 2 - 8) + '" cy="0" r="2.6" fill="#F6F0E2" stroke="#A8895A" stroke-width=".8"/>' +
      '<g class="t-pinza" transform="translate(' + f1(-W / 2 - 1) + ' 0)"><rect x="-8" y="-9" width="22" height="7" rx="2" fill="#C9A878" stroke="#8C6B3E" stroke-width=".7" transform="rotate(-6)"/><rect x="-8" y="2" width="22" height="7" rx="2" fill="#B9955F" stroke="#8C6B3E" stroke-width=".7" transform="rotate(6)"/><circle cx="2" cy="0" r="2.4" fill="#8C6B3E"/></g>' +
      '<text class="t-texto" text-anchor="middle" x="0" y="0" mask="url(#' + mid + '-m)" fill="#2B2823" style="font-family:' + FUENTE_NOMBRE + '">' + t.replace(/[<>&]/g, '') + '</text>' +
      '<g class="t-pluma" opacity="0"><path d="M0 0L9 -14L12 -12L3 2Z" fill="#2B2823"/><path d="M9 -14L22 -34" stroke="#8C6B3E" stroke-width="2.4" stroke-linecap="round"/></g>';
    var txt = g.querySelector('.t-texto'), traza = g.querySelector('.t-traza'), pluma = g.querySelector('.t-pluma');
    var largoTraza = 1, prog = 0;
    function ajustar() {
      var fs = o.fs || 34, maxW = W - 36, L = 0;
      txt.setAttribute('font-size', fs);
      try { L = txt.getComputedTextLength(); } catch (e) { L = 0; }
      if (!L) L = fs * 0.46 * t.length;
      if (L > maxW) { fs = fs * maxW / L; txt.setAttribute('font-size', f1(fs)); L = maxW; }
      txt.setAttribute('y', f1(fs * 0.3));
      // la traza de la pluma: un zigzag que recorre el renglón de izquierda a derecha y destapa las letras en el orden en que se escribirían
      var x0 = -L / 2 - 6, x1 = L / 2 + 8, amp = fs * 0.46, paso = Math.max(5, fs * 0.3), d = '', i = 0, x;
      for (x = x0; x <= x1 + paso; x += paso, i++) {
        var y = (i % 2 ? -1 : 1) * amp * (0.55 + 0.45 * Math.abs(Math.sin(i * 1.3))) - fs * 0.02;
        d += (i ? 'L' : 'M') + f1(Math.min(x, x1)) + ' ' + f1(y);
      }
      traza.setAttribute('d', d);
      traza.setAttribute('stroke-width', f1(fs * 1.05));
      try { largoTraza = traza.getTotalLength(); } catch (e) { largoTraza = L * 2; }
      poner(prog);
    }
    function poner(v) {
      prog = clamp(v, 0, 1);
      traza.setAttribute('stroke-dashoffset', f2(1 - prog));
      g.setAttribute('data-escrito', f2(prog));
      if (pluma) {
        try {
          var pt = traza.getPointAtLength(prog * largoTraza);
          pluma.setAttribute('transform', 'translate(' + f1(pt.x) + ' ' + f1(pt.y) + ')');
        } catch (e) {}
        pluma.setAttribute('opacity', prog > 0 && prog < 1 ? '1' : '0');
      }
    }
    poner(1);                                     // por defecto, escrita (respaldo quieto pero completo)
    esperarLetra(FUENTE_NOMBRE.indexOf('Pinyon') > -1 ? "'Pinyon Script'" : 'cursive', function () { ajustar(); });
    ajustar();
    return {
      g: g,
      get progreso() { return prog; },
      poner: poner,
      reajustar: ajustar,
      escribir: function (dur, alAcabar) {
        var gs = G();
        if (escribiendo) { escribiendo.kill && escribiendo.kill(); escribiendo = null; }
        if (!gs) { poner(1); if (alAcabar) alAcabar(); return; }
        poner(0);
        var o2 = { v: 0 };
        escribiendo = gs.to(o2, { v: 1, duration: dur || 1.6, ease: 'sine.inOut', autoRound: false, onUpdate: function () { poner(o2.v); }, onComplete: function () { poner(1); escribiendo = null; if (alAcabar) alAcabar(); } });
      },
      destruir: function () { if (escribiendo && escribiendo.kill) escribiendo.kill(); }
    };
  }

  M.tarjeta = function (el, nombre, op) {
    op = op || {};
    var cuadro = typeof el === 'string' ? $(el) : el;
    if (!cuadro) return null;
    var p = paleta(), id = uid('tj');
    var svg = elSVG('svg', { viewBox: '0 0 240 120', class: 'mesa-tarjeta', role: 'img', 'aria-label': 'Tarjeta con el nombre: ' + nombre, preserveAspectRatio: 'xMidYMid meet' });
    svg.style.cssText = 'display:block;width:100%;height:auto;max-width:100%;overflow:visible';
    var g = elSVG('g', { transform: 'translate(120 60) rotate(-3)' });
    svg.appendChild(g);
    cuadro.innerHTML = '';
    cuadro.appendChild(svg);
    var tj = tarjetaEn(g, id, p, nombre, { w: 214, h: 92, fs: 60 });
    if (op.animar !== false && G() && !reducido()) tj.escribir(op.duracion || 1.8, op.alAcabar); else if (op.alAcabar) setTimeout(op.alAcabar, 0);
    cuadro.dataset.tarjeta = '1';
    return { el: svg, escribir: tj.escribir, get progreso() { return tj.progreso; }, destruir: function () { tj.destruir(); } };
  };

  /* =====================================================================
     3. UN CUBIERTO · Entremuros.mesa.cubierto (lo usa Reserva: el comensal se sienta ABAJO y la copa queda arriba a la derecha)
     ===================================================================== */
  M.cubierto = function (el, op) {
    op = op || {};
    var cuadro = typeof el === 'string' ? $(el) : el;
    if (!cuadro) return null;
    var p = paleta(), id = ensureDefs(p), tipo = op.tipo || 'adulto';
    var giro = op.girado === true ? 180 : (typeof op.girado === 'number' ? op.girado : 0);
    var svg = elSVG('svg', { viewBox: '0 0 260 260', class: 'mesa-cubierto', 'aria-hidden': 'true', focusable: 'false', preserveAspectRatio: 'xMidYMid meet' });
    svg.style.cssText = 'display:block;width:100%;height:100%;overflow:visible';
    var pz = function (cls, tf, inner) { return '<g class="' + cls + '"' + (tf ? ' transform="' + tf + '"' : '') + '><g class="ent">' + inner + '</g></g>'; };
    var h = '<g transform="translate(130 130) rotate(' + giro + ')">';
    if (tipo === 'cuenco') {      // la mascota: un cuenco de esmalte en el suelo, junto a la mesa
      h += pz('c-cuenco', '', '<ellipse cx="9" cy="14" rx="84" ry="80" fill="url(#' + id + '-sombra)"/><circle r="80" fill="url(#' + id + '-bajo)" stroke="' + p.lozaAzulOsc + '" stroke-width="1.4"/><circle r="64" fill="url(#' + id + '-pozo)" stroke="rgba(90,120,132,.5)" stroke-width="1.4"/><circle r="38" fill="#7C98A2" opacity=".45"/><path d="M-60 -18A64 64 0 0 1 -18 -60" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".9"/>');
    } else {
      var r = tipo === 'nino' ? 64 : 76, R = r * 1.42, esc = r / 76;
      h += pz('c-esparto', '', esparto(id, p, R));
      h += pz('c-servilleta', 'translate(' + f1(-r * .5) + ' ' + f1(r * .46) + ') rotate(-16)', servilleta(id, p, r * .82));
      h += pz('c-plato', '', plato(id, p, r, { bajo: tipo !== 'nino', cuenco: tipo !== 'nino' }));
      h += pz('c-tenedor', 'translate(' + f1(-(r + 30)) + ' ' + f1(-75 * esc) + ')', tenedor(id, p, esc));
      h += pz('c-cuchillo', 'translate(' + f1(r + 30) + ' ' + f1(-75 * esc) + ')', cuchillo(id, p, esc));
      h += pz('c-copa', 'translate(' + f1(r * .98) + ' ' + f1(-r * 1.02) + ')', tipo === 'nino' ? vaso(id, p, 15) : copa(id, p, 21));
    }
    h += '</g>';
    svg.innerHTML = h;
    cuadro.innerHTML = '';
    cuadro.appendChild(svg);
    cuadro.dataset.cubierto = tipo;
    var gs = G();
    if (op.animar !== false && gs && !reducido()) {
      // el asentamiento: cada pieza se posa en su sitio, sin caer ni rebotar
      var orden = tipo === 'cuenco' ? ['.c-cuenco'] : ['.c-esparto', '.c-servilleta', '.c-plato', '.c-tenedor', '.c-cuchillo', '.c-copa'];
      orden.forEach(function (sel, i) {
        var n = $(sel + ' > .ent', svg);
        if (!n) return;
        gs.fromTo(n, { opacity: 0, y: sel === '.c-copa' ? -6 : -10 }, { opacity: 1, y: 0, duration: .55, delay: .05 + i * .07, ease: 'power3.out', overwrite: 'auto' });
      });
    }
    return { el: svg, destruir: function () { if (gs) gs.killTweensOf($$('.ent', svg)); } };
  };

  /* =====================================================================
     4. LA ESCENA: la mesa larga vista desde arriba (pino, camino de lino, esparto, loza azul grisácea, latón, sillas blancas)
        Coordenadas: la mesa va en vertical; x = a lo ancho (−340…340), y = a lo largo. En escritorio queda a la derecha y el
        titular de la web va a la izquierda; en móvil ocupa la pantalla entera y el titular va abajo.
     ===================================================================== */
  var ANCHO_MESA = 340;       // medio ancho de la mesa
  var PASO_FILA = 270;        // distancia entre servicios
  var R_PLATO = 76, R_ESPARTO = 108;

  function simbolos(id, p) {
    var rnd = rng(31);
    return '<g id="' + id + '-s-mat">' + esparto(id, p, R_ESPARTO) + '</g>' +
      '<g id="' + id + '-s-plato">' + plato(id, p, R_PLATO, { bajo: true, cuenco: true }) + '</g>' +
      '<g id="' + id + '-s-plato2">' + plato(id, p, R_PLATO, { bajo: true }) + '</g>' +
      '<g id="' + id + '-s-serv">' + servilleta(id, p, R_PLATO * .82) + '</g>' +
      '<g id="' + id + '-s-tenedor">' + tenedor(id, p, 1) + '</g>' +
      '<g id="' + id + '-s-cuchillo">' + cuchillo(id, p, 1) + '</g>' +
      '<g id="' + id + '-s-copa">' + copa(id, p, 21) + '</g>' +
      '<g id="' + id + '-s-vaso">' + vaso(id, p, 24) + '</g>';
  }

  function crearEscena(host, op) {
    var p = paleta(), id = ensureDefs(p), rnd = rng(77), i, j;
    if (!document.getElementById(id + '-s-mat')) {
      var d = document.querySelector('#' + id + '-defs defs');
      d.insertAdjacentHTML('beforeend', simbolos(id, p));
    }
    // la portada ocupa la pantalla entera cuando la web la monta (antes del cambio de clase la columna puede ser la mitad)
    var sec = host.closest ? host.closest('section') : null;
    var W = (sec && sec.clientWidth) || document.documentElement.clientWidth || innerWidth, H = innerHeight;
    var vertical = W / H < 1.05;
    var vbW, vbH, xc;
    if (!vertical) { vbH = 900; vbW = Math.round(900 * W / H); xc = vbW - 440; }
    else { vbW = 760; vbH = Math.round(760 * H / W); xc = 380; }
    var filas = [], u;
    for (u = 150 - PASO_FILA; u < vbH + PASO_FILA; u += PASO_FILA) filas.push(u);
    var objetivo = (vertical ? 0.4 : 0.47) * vbH, bienvenida = filas[0];
    filas.forEach(function (v) { if (Math.abs(v - objetivo) < Math.abs(bienvenida - objetivo)) bienvenida = v; });

    var svg = elSVG('svg', { viewBox: '0 0 ' + vbW + ' ' + vbH, class: 'mesa-svg', preserveAspectRatio: vertical ? 'xMidYMid slice' : 'xMaxYMid slice', role: 'group', 'aria-label': 'La mesa larga de la casa, puesta: platos, copas, velas y flores. Platos, copas y velas se pueden recolocar con el dedo, el ratón o las flechas del teclado.' });
    var sid = uid('es');
    var h = '';
    h += '<defs><clipPath id="' + sid + '-mesa"><rect x="' + (-ANCHO_MESA) + '" y="-600" width="' + (ANCHO_MESA * 2) + '" height="' + (vbH + 1200) + '"/></clipPath><clipPath id="' + sid + '-camino"><rect class="cam-clip" x="-140" y="-600" width="280" height="' + (vbH + 1200) + '"/></clipPath></defs>';
    // sillas (debajo de la mesa)
    h += '<g class="m-sillas" transform="translate(' + xc + ' 0)">';
    filas.forEach(function (v) { [-1, 1].forEach(function (s) { h += '<g class="silla" data-lado="' + s + '" transform="translate(' + (s * 366) + ' ' + f1(v + (rnd() - .5) * 8) + ')"><g class="ent">' + silla(id, p, s) + '</g></g>'; }); });
    h += '</g>';
    // la mesa
    h += '<g class="m-mesa" transform="translate(' + xc + ' 0)">';
    h += '<rect x="' + (-ANCHO_MESA - 22) + '" y="-600" width="22" height="' + (vbH + 1200) + '" fill="url(#' + id + '-sombraL)"/>';
    h += '<rect x="' + ANCHO_MESA + '" y="-600" width="64" height="' + (vbH + 1200) + '" fill="url(#' + id + '-sombraR)"/>';
    h += '<rect x="' + (-ANCHO_MESA) + '" y="-600" width="' + (ANCHO_MESA * 2) + '" height="' + (vbH + 1200) + '" fill="' + p.pino + '"/>';
    h += '<rect x="' + (-ANCHO_MESA) + '" y="-600" width="' + (ANCHO_MESA * 2) + '" height="' + (vbH + 1200) + '" fill="url(#' + id + '-pino)"/>';
    h += '<rect x="' + (-ANCHO_MESA) + '" y="-600" width="7" height="' + (vbH + 1200) + '" fill="rgba(255,238,198,.45)"/><rect x="' + (-ANCHO_MESA + 7) + '" y="-600" width="2" height="' + (vbH + 1200) + '" fill="rgba(90,52,16,.25)"/>';
    h += '<rect x="' + (ANCHO_MESA - 9) + '" y="-600" width="9" height="' + (vbH + 1200) + '" fill="rgba(70,38,10,.42)"/><rect x="' + (ANCHO_MESA - 11) + '" y="-600" width="2" height="' + (vbH + 1200) + '" fill="rgba(255,230,180,.25)"/>';
    // camino de lino (se despliega a lo largo con un recorte)
    var pts = [], yy, camL = '', camR = '';
    for (yy = -600; yy <= vbH + 600; yy += 50) { camL += (camL ? 'L' : 'M') + f1(-119 + (rnd() - .5) * 2.6) + ' ' + yy; }
    for (yy = vbH + 600; yy >= -600; yy -= 50) { camR += 'L' + f1(119 + (rnd() - .5) * 2.6) + ' ' + yy; }
    var camino = camL + camR + 'Z';
    h += '<g class="m-camino" clip-path="url(#' + sid + '-camino)"><path d="' + camino + '" transform="translate(5 4)" fill="#3a2810" opacity=".16"/><path d="' + camino + '" fill="#EDE7DA"/><path d="' + camino + '" fill="url(#' + id + '-lino)"/>';
    h += '<rect x="-119" y="-600" width="238" height="' + (vbH + 1200) + '" fill="url(#' + id + '-servG)" opacity=".8"/>';
    h += '<path d="M-111 -600V' + (vbH + 600) + 'M111 -600V' + (vbH + 600) + '" stroke="rgba(120,100,70,.3)" stroke-width=".9" stroke-dasharray="4 3" fill="none"/>';
    for (yy = filas[0] - 135; yy < vbH + 300; yy += PASO_FILA * 2) h += '<path d="M-119 ' + yy + 'H119" stroke="rgba(120,100,70,.18)" stroke-width="1.4"/><path d="M-119 ' + (yy + 1.6) + 'H119" stroke="rgba(255,255,255,.55)" stroke-width="1"/>';
    h += '</g>';
    // luz de ventana: dos barras claras y la sombra del parteluz
    h += '<g clip-path="url(#' + sid + '-mesa)" class="m-luz" style="pointer-events:none"><g transform="rotate(-19) translate(-380 -300)">' +
      '<rect x="0" y="0" width="190" height="' + (vbH * 2 + 900) + '" fill="url(#' + id + '-ban)"/><rect x="215" y="0" width="34" height="' + (vbH * 2 + 900) + '" fill="url(#' + id + '-banO)"/>' +
      '<rect x="300" y="0" width="190" height="' + (vbH * 2 + 900) + '" fill="url(#' + id + '-ban)"/><rect x="520" y="0" width="34" height="' + (vbH * 2 + 900) + '" fill="url(#' + id + '-banO)"/></g></g>';
    h += '</g>';
    svg.innerHTML = h;

    // ---- capa de piezas (encima de la mesa) ----
    var tg = elSVG('g', { class: 'm-piezas', transform: 'translate(' + xc + ' 0)' });
    var estaticos = elSVG('g', { class: 'm-servicio' }), moviles = elSVG('g', { class: 'm-moviles' });
    var guir = guirnalda(id, p, rnd, filas[0] - 220, filas[filas.length - 1] + 260);
    var gSom = elSVG('g', { class: 'm-guirnalda-sombra' }, guir.sombra), gGui = elSVG('g', { class: 'm-guirnalda' }, guir.cuerpo);
    tg.appendChild(estaticos); tg.appendChild(gSom); tg.appendChild(gGui); tg.appendChild(moviles);
    svg.appendChild(tg);

    var piezas = [], velas = [], servicios = [], cierre = { welcome: null, tarjeta: null };
    function hacerMovil(tipo, x, y, inner, o) {
      o = o || {};
      var g = elSVG('g', { class: 'mov mov-' + tipo, transform: 'translate(' + f1(x) + ' ' + f1(y) + ')', tabindex: '0', role: 'button', 'data-tipo': tipo, 'aria-label': o.etiqueta || tipo });
      var ent = elSVG('g', { class: 'ent' });
      ent.innerHTML = '<ellipse class="lift" cx="' + f1((o.r || 40) * .22) + '" cy="' + f1((o.r || 40) * .34) + '" rx="' + f1((o.r || 40) * 1.08) + '" ry="' + f1((o.r || 40) * 1.04) + '" fill="url(#' + id + '-sombra)" opacity="0"/>' + inner;
      g.appendChild(ent);
      g.insertAdjacentHTML('beforeend', '<circle class="aro" r="' + f1((o.r || 40) * 1.18) + '" fill="none"/><circle class="hit" r="' + f1((o.r || 40) * 1.05) + '" fill="transparent"/>');
      var pz = { tipo: tipo, g: g, ent: ent, x: x, y: y, bx: x, by: y, r: o.r || 40, lado: o.lado || 0, etiqueta: o.etiqueta || tipo };
      g.__pz = pz;
      moviles.appendChild(g);
      piezas.push(pz);
      return pz;
    }

    var nSet = 0;
    filas.forEach(function (v, fi) {
      [-1, 1].forEach(function (s) {
        nSet++;
        var px = s * 205 + (rnd() - .5) * 6, py = v + (rnd() - .5) * 6, th = s < 0 ? 90 : -90;
        var esBien = (v === bienvenida && s < 0);
        var srv = elSVG('g', { class: 'servicio', 'data-lado': s, 'data-fila': fi, transform: 'translate(' + f1(px) + ' ' + f1(py) + ')' });
        // el servicio se dibuja en el marco del comensal (sentado abajo) y se gira hacia su lado de la mesa
        var inner = '<g transform="rotate(' + th + ')">' +
          '<g class="s-mat"><g class="ent"><use href="#' + id + '-s-mat"/></g></g>' +
          '<g transform="translate(' + f1(-R_PLATO * .5) + ' ' + f1(R_PLATO * .46) + ') rotate(' + f1(-16 + (rnd() - .5) * 8) + ')"><g class="s-serv"><g class="ent"><use href="#' + id + '-s-serv"/></g></g></g>' +
          '<g transform="translate(' + (-(R_PLATO + 30)) + ' -75)"><g class="s-cub"><g class="ent"><use href="#' + id + '-s-tenedor"/></g></g></g>' +
          '<g transform="translate(' + (R_PLATO + 30) + ' -75)"><g class="s-cub"><g class="ent"><use href="#' + id + '-s-cuchillo"/></g></g></g>' +
          '</g>';
        srv.innerHTML = inner;
        estaticos.appendChild(srv);
        servicios.push(srv);
        // el plato (movible); si es el de la bienvenida lleva la servilleta larga, el ramito y la tarjeta
        var etq = esBien ? 'Plato de bienvenida, con una tarjeta. ' : 'Plato. ';
        var cuerpo;
        if (esBien) {
          cuerpo = '<use href="#' + id + '-s-plato2"/>' +
            '<g class="b-serv" transform="rotate(7)"><rect x="-26" y="-67" width="54" height="134" rx="3" fill="#3a2810" opacity=".16" transform="translate(5 7)"/><rect x="-27" y="-68" width="54" height="136" rx="3" fill="#EAE5DA" stroke="rgba(120,105,80,.4)" stroke-width=".9"/><rect x="-27" y="-68" width="54" height="136" rx="3" fill="url(#' + id + '-lino)" opacity=".9"/><rect x="-27" y="-68" width="54" height="136" rx="3" fill="url(#' + id + '-servG)"/><path d="M-9 -68V68" stroke="rgba(110,95,70,.25)" stroke-width="1.2"/><path d="M-7.4 -68V68" stroke="rgba(255,255,255,.65)" stroke-width="1"/></g>' +
            '<g class="b-rama" transform="translate(-6 -16) rotate(-28)"><path d="M0 28V-30" stroke="#4D6B3C" stroke-width="1.6" stroke-linecap="round"/>' + (function () { var t = '', k; for (k = 0; k < 9; k++) { var y = 24 - k * 6.2, l = 12 - k * .8; t += '<path d="M0 ' + f1(y) + 'L' + f1(-l) + ' ' + f1(y - 7) + '" stroke="#5A7C46" stroke-width="2.2" stroke-linecap="round"/><path d="M0 ' + f1(y) + 'L' + f1(l) + ' ' + f1(y - 7) + '" stroke="#6B8E52" stroke-width="2.2" stroke-linecap="round"/>'; } return t; })() + '</g>' +
            '<g class="b-tarjeta" transform="translate(4 24) rotate(-7)"></g>';
        } else {
          cuerpo = '<use href="#' + id + '-s-' + (fi % 2 ? 'plato' : 'plato') + '"/>';
        }
        var pzP = hacerMovil('plato', px, py, cuerpo, { r: R_PLATO * 1.1, etiqueta: etq + 'Arrastra o usa las flechas para moverlo.', lado: s });
        pzP.fila = fi; pzP.esBienvenida = esBien;
        if (esBien) {
          cierre.welcome = pzP;
          var gT = pzP.g.querySelector('.b-tarjeta');
          cierre.tarjeta = tarjetaEn(gT, id, p, 'Bienvenidos', { w: 128, h: 52, fs: 34 });
          cierre.tarjetaG = gT;
        }
        // copas: la de agua (arriba a la derecha del comensal) y el vaso
        var lc = function (a, b) { return s < 0 ? [px + (-b), py + a] : [px + b, py - a]; };
        var c1 = lc(R_PLATO * .98, -R_PLATO * 1.02), c2 = lc(R_PLATO * .22, -R_PLATO * 1.36);
        var pzc = hacerMovil('copa', c1[0], c1[1], '<use href="#' + id + '-s-copa"/>', { r: 24, etiqueta: 'Copa. Arrastra o usa las flechas para moverla.', lado: s });
        var pzv = hacerMovil('copa', c2[0], c2[1], '<use href="#' + id + '-s-vaso"/>', { r: 27, etiqueta: 'Vaso. Arrastra o usa las flechas para moverlo.', lado: s });
        pzc.fila = pzv.fila = fi;
      });
    });

    // centro de mesa: velas y jarritas con hortensias entre servicios
    filas.forEach(function (v, fi) {
      var yy = v + PASO_FILA / 2, ciclo = ((fi % 3) + 3) % 3;
      if (ciclo === 1) {
        var pj = hacerMovil('jarra', (rnd() - .5) * 24, yy, hortensias(id, p, rnd, 46), { r: 58, etiqueta: 'Jarrita con hortensias. Arrastra o usa las flechas para moverla.' });
        pj.fila = fi;
      } else {
        var vl = hacerMovil('vela', (ciclo === 0 ? 1 : -1) * (14 + rnd() * 10), yy, vela(id, p), { r: 30, etiqueta: 'Vela encendida. Intro la apaga; arrastra o usa las flechas para moverla.' });
        vl.fila = fi; vl.enc = true; vl.llama = $('.llama', vl.g); vl.halo = $('.halo', vl.g); vl.fuego = $('.fuego', vl.g); vl.nucleo = $('.nucleo', vl.g);
        vl.g.setAttribute('aria-pressed', 'true');
        velas.push(vl);
      }
    });

    host.appendChild(svg);
    return {
      svg: svg, tg: tg, xc: xc, vbW: vbW, vbH: vbH, vertical: vertical, filas: filas, bienvenida: bienvenida, piezas: piezas, velas: velas,
      servicios: servicios, estaticos: estaticos, moviles: moviles, camino: $('.m-camino', svg), camClip: $('.cam-clip', svg),
      guirnalda: gGui, guirnaldaSombra: gSom, sillas: $$('.silla', svg), tarjeta: cierre.tarjeta, tarjetaG: cierre.tarjetaG, bienvenidaPieza: cierre.welcome, id: id, p: p, rnd: rnd
    };
  }

  /* =====================================================================
     5. RECOLOCAR LA MESA: arrastrar con inercia (en táctil, tras mantener pulsado 250 ms), flechas con el teclado,
        doble toque o Intro sobre una vela para encenderla o apagarla
     ===================================================================== */
  function activarRecolocar(esc, ctrl) {
    var svg = esc.svg, tg = esc.tg, mov = esc.moviles;
    var arr = null, ultimoToque = { t: 0, pz: null, x: 0, y: 0 }, inercia = 0;
    var gs = G();
    var LIM_X = ANCHO_MESA - 26;
    function aEscena(cx, cy) {
      var pt = svg.createSVGPoint(); pt.x = cx; pt.y = cy;
      var m = tg.getScreenCTM();
      if (!m) return { x: 0, y: 0 };
      var q = pt.matrixTransform(m.inverse());
      return { x: q.x, y: q.y };
    }
    function poner(pz, x, y) {
      pz.x = clamp(x, -LIM_X, LIM_X);
      pz.y = clamp(y, -40, esc.vbH + 40);
      pz.g.setAttribute('transform', 'translate(' + f1(pz.x) + ' ' + f1(pz.y) + ')');
    }
    function levantar(pz, on) {
      if (!gs) { if (pz.ent) pz.ent.style.transform = on ? 'scale(1.04)' : ''; return; }
      var lift = pz.ent.querySelector('.lift');
      gs.to(pz.ent, { scale: on ? 1.045 : 1, duration: on ? .16 : .34, ease: on ? 'power2.out' : 'power3.out', overwrite: 'auto' });
      if (lift) gs.to(lift, { opacity: on ? .5 : 0, x: on ? 7 : 0, y: on ? 10 : 0, duration: on ? .16 : .5, ease: 'power2.out', overwrite: 'auto' });
    }
    function alFrente(pz) { if (pz.g.parentNode === mov && pz.g !== mov.lastChild) mov.appendChild(pz.g); }
    function alternarVela(pz) {
      pz.enc = !pz.enc;
      pz.g.setAttribute('aria-pressed', String(pz.enc));
      pz.g.setAttribute('aria-label', (pz.enc ? 'Vela encendida. Intro la apaga' : 'Vela apagada. Intro la enciende') + '; arrastra o usa las flechas para moverla.');
      if (gs) {
        gs.killTweensOf([pz.llama, pz.fuego, pz.halo, pz.nucleo]);
        gs.to(pz.llama, { opacity: pz.enc ? 1 : 0, duration: pz.enc ? .5 : .28, ease: 'power2.out', overwrite: 'auto' });
        if (pz.enc) { gs.set([pz.fuego, pz.nucleo, pz.halo], { scale: 1, opacity: 1 }); ctrl.parpadeo(pz); }
      } else pz.llama.style.opacity = pz.enc ? 1 : 0;
      document.dispatchEvent(new CustomEvent('entremuros:vela', { detail: { encendida: pz.enc } }));
    }
    ctrl.alternarVela = alternarVela;

    function inicio(ev) {
      var g = ev.target.closest ? ev.target.closest('.mov') : null;
      if (!g || !g.__pz || ev.button > 0) return;
      var pz = g.__pz, tactil = ev.pointerType === 'touch';
      if (inercia) { cancelAnimationFrame(inercia); inercia = 0; }
      arr = { id: ev.pointerId, pz: pz, cx0: ev.clientX, cy0: ev.clientY, t0: performance.now(), activo: false, mov: 0, muestras: [], tactil: tactil, timer: 0 };
      var empezar = function () {
        if (!arr || arr.pz !== pz) return;
        arr.activo = true;
        var q = aEscena(arr.cx0, arr.cy0);
        arr.dx = pz.x - q.x; arr.dy = pz.y - q.y;
        alFrente(pz);
        levantar(pz, true);
        try { svg.setPointerCapture(arr.id); } catch (e) {}
        svg.classList.add('arrastrando');
      };
      arr.empezar = empezar;
      if (tactil) arr.timer = setTimeout(empezar, 250);    // no bloquea el scroll: solo arrastra tras mantener pulsado
      else { empezar(); ev.preventDefault(); }
    }
    function mover(ev) {
      if (!arr || ev.pointerId !== arr.id) return;
      var dd = Math.hypot(ev.clientX - arr.cx0, ev.clientY - arr.cy0);
      arr.mov = Math.max(arr.mov, dd);
      if (!arr.activo) {
        if (arr.tactil && dd > 8) { clearTimeout(arr.timer); arr = null; }    // se movió antes de tiempo: es un scroll
        return;
      }
      var q = aEscena(ev.clientX, ev.clientY);
      poner(arr.pz, q.x + arr.dx, q.y + arr.dy);
      var t = performance.now();
      arr.muestras.push({ t: t, x: arr.pz.x, y: arr.pz.y });
      while (arr.muestras.length > 2 && t - arr.muestras[0].t > 110) arr.muestras.shift();
      ev.preventDefault();
    }
    function fin(ev) {
      if (!arr || ev.pointerId !== arr.id) return;
      clearTimeout(arr.timer);
      var a = arr, pz = a.pz; arr = null;
      try { svg.releasePointerCapture(a.id); } catch (e) {}
      svg.classList.remove('arrastrando');
      var ahora = performance.now();
      if (!a.activo || a.mov < 6) {                          // un toque: ¿doble toque sobre una vela?
        if (pz.tipo === 'vela') {
          if (ultimoToque.pz === pz && ahora - ultimoToque.t < 380 && Math.hypot(ev.clientX - ultimoToque.x, ev.clientY - ultimoToque.y) < 24) { alternarVela(pz); ultimoToque.pz = null; }
          else ultimoToque = { t: ahora, pz: pz, x: ev.clientX, y: ev.clientY };
        }
        if (a.activo) levantar(pz, false);
        return;
      }
      // inercia: velocidad de los últimos ~100 ms, que se va apagando; y luego se posa
      var m = a.muestras, v = { x: 0, y: 0 };
      if (m.length > 1) {
        var dt = Math.max(16, m[m.length - 1].t - m[0].t);
        v.x = (m[m.length - 1].x - m[0].x) / dt; v.y = (m[m.length - 1].y - m[0].y) / dt;
      }
      var sinMov = reducido();
      if (sinMov || Math.hypot(v.x, v.y) < 0.03) { levantar(pz, false); return; }
      var t0 = performance.now(), ult = t0;
      var paso = function (t) {
        var dt2 = Math.min(40, t - ult); ult = t;
        var f = Math.exp(-dt2 / 190);
        v.x *= f; v.y *= f;
        poner(pz, pz.x + v.x * dt2, pz.y + v.y * dt2);
        if ((pz.x <= -LIM_X + .5 && v.x < 0) || (pz.x >= LIM_X - .5 && v.x > 0)) v.x = 0;
        if (Math.hypot(v.x, v.y) < 0.012 || t - t0 > 1100 || document.hidden) { inercia = 0; levantar(pz, false); return; }
        inercia = requestAnimationFrame(paso);
      };
      inercia = requestAnimationFrame(paso);
    }
    svg.addEventListener('pointerdown', inicio);
    svg.addEventListener('pointermove', mover);
    svg.addEventListener('pointerup', fin);
    svg.addEventListener('pointercancel', function (ev) { if (arr && ev.pointerId === arr.id) { clearTimeout(arr.timer); if (arr.activo) levantar(arr.pz, false); arr = null; svg.classList.remove('arrastrando'); } });
    svg.addEventListener('touchmove', function (ev) { if (arr && arr.activo && ev.cancelable) ev.preventDefault(); }, { passive: false });
    svg.addEventListener('dblclick', function (ev) {
      var g = ev.target.closest ? ev.target.closest('.mov-vela') : null;
      if (g && g.__pz) { alternarVela(g.__pz); ev.preventDefault(); }
    });
    // teclado: tabulación por las piezas, flechas para moverlas, Intro/espacio en una vela
    svg.addEventListener('keydown', function (ev) {
      var g = ev.target.closest ? ev.target.closest('.mov') : null;
      if (!g || !g.__pz) return;
      var pz = g.__pz, k = ev.key, paso = ev.shiftKey ? 6 : 22, dx = 0, dy = 0;
      if (k === 'ArrowLeft') dx = -paso; else if (k === 'ArrowRight') dx = paso; else if (k === 'ArrowUp') dy = -paso; else if (k === 'ArrowDown') dy = paso;
      else if ((k === 'Enter' || k === ' ') && pz.tipo === 'vela') { alternarVela(pz); ev.preventDefault(); return; }
      else if (k === 'Home' || k === 'Escape') { poner(pz, pz.bx, pz.by); ev.preventDefault(); return; }
      else return;
      ev.preventDefault();
      alFrente(pz);
      g.focus({ preventScroll: true });
      poner(pz, pz.x + dx, pz.y + dy);
      if (gs && !reducido()) {
        gs.fromTo(pz.ent, { scale: 1.035 }, { scale: 1, duration: .32, ease: 'power3.out', overwrite: 'auto' });
      }
    });
    return function () { if (inercia) cancelAnimationFrame(inercia); };
  }

  /* =====================================================================
     6. LA LLAMA: parpadeo suave de cada vela; se para fuera de pantalla y con la pestaña oculta
     ===================================================================== */
  function llamas(esc, ctrl) {
    var gs = G();
    ctrl.parpadeo = function (v) {
      if (!gs || !v.enc || ctrl.destruido) return;
      if (v.parpadeando) return;
      v.parpadeando = true;
      var ciclo = function () {
        if (!v.enc || ctrl.destruido) { v.parpadeando = false; return; }
        if (!ctrl.visible || document.hidden) { v.parpadeando = false; return; }
        var r = Math.random;
        gs.to(v.fuego, { scaleY: 1 + r() * .22, scaleX: 1 - r() * .1, duration: .12 + r() * .22, ease: 'sine.inOut', transformOrigin: '50% 90%', overwrite: 'auto' });
        gs.to(v.nucleo, { scaleY: 1 + r() * .18, duration: .14 + r() * .2, ease: 'sine.inOut', transformOrigin: '50% 90%', overwrite: 'auto' });
        gs.to(v.halo, { opacity: .8 + r() * .2, scale: .96 + r() * .08, duration: .2 + r() * .3, ease: 'sine.inOut', transformOrigin: '50% 50%', overwrite: 'auto', onComplete: ciclo });
      };
      ciclo();
    };
    ctrl.encenderTodas = function () { esc.velas.forEach(function (v) { v.parpadeando = false; ctrl.parpadeo(v); }); };
    ctrl.reanudar = function () { if (ctrl.visible && !document.hidden) esc.velas.forEach(function (v) { if (v.enc && !v.parpadeando) ctrl.parpadeo(v); }); };
    document.addEventListener('visibilitychange', ctrl.reanudar);
    ctrl.limpiar.push(function () { document.removeEventListener('visibilitychange', ctrl.reanudar); });
  }

  /* =====================================================================
     7. LA MESA SE PONE SOLA: todo se posa como lo haría una mano (nada cae ni rebota)
     ===================================================================== */
  function ponerLaMesa(esc, ctrl, op) {
    var gs = G();
    var fin = function () {
      esc.svg.classList.add('puesta');
      ctrl.puesta = true;
      document.dispatchEvent(new CustomEvent('entremuros:mesa-puesta'));
      if (op.alPoner) op.alPoner();
    };
    if (!gs || op.movimiento === false || op.yaPuesta || reducido()) { esc.svg.classList.add('puesta'); ctrl.puesta = true; esc.velas.forEach(function (v) { v.enc = true; }); fin(); if (gs && op.yaPuesta && op.movimiento !== false && !reducido()) ctrl.encenderTodas(); return null; }
    var tl = gs.timeline({ defaults: { overwrite: false }, onComplete: fin });
    ctrl.tl = tl;
    var q = function (sel, r) { return $$(sel, r || esc.svg); };
    var ents = function (sel) { return q(sel + ' > .ent'); };
    var sillas = q('.silla > .ent'), mats = ents('.s-mat'), servs = ents('.s-serv'), cubs = ents('.s-cub');
    var platos = esc.piezas.filter(function (z) { return z.tipo === 'plato'; });
    var copas = esc.piezas.filter(function (z) { return z.tipo === 'copa'; });
    var jarras = esc.piezas.filter(function (z) { return z.tipo === 'jarra'; });
    var velas = esc.velas;
    var hojas = q('.guirnalda-hojas .hoja', esc.svg), tallos = q('.tallo', esc.svg), cardos = q('.cardo', esc.svg);
    var lifts = platos.map(function (z) { return z.ent.querySelector('.lift'); });
    // estado de partida (lo que no se ve en el paso 1 no está pintado antes de que le toque)
    gs.set(sillas, { opacity: 0, x: function (i, el) { return (+el.parentNode.getAttribute('data-lado') || 1) * 26; } });
    gs.set(esc.camClip, { attr: { height: 0 } });
    gs.set(mats, { opacity: 0, scale: .94, transformOrigin: '50% 50%' });
    gs.set(servs, { opacity: 0, scaleX: 1.5, scaleY: .55, rotation: 12 });
    gs.set(cubs, { opacity: 0, y: 34 });
    platos.forEach(function (z, i) { gs.set(z.ent, { opacity: 0, x: z.lado * 56, rotation: z.lado * 5 }); gs.set(lifts[i], { opacity: .5, x: 9, y: 14 }); });
    copas.forEach(function (z) { gs.set(z.ent, { opacity: 0, scale: .9, y: -5 }); });
    jarras.forEach(function (z) { gs.set(z.ent, { opacity: 0, y: -8, scale: .86 }); });
    velas.forEach(function (z) { gs.set(z.ent, { opacity: 0, y: -8 }); gs.set(z.llama, { opacity: 0 }); gs.set([z.fuego, z.nucleo], { scale: 0, transformOrigin: '50% 90%' }); });
    gs.set(tallos, { strokeDasharray: 1, strokeDashoffset: 1 });
    tallos.forEach(function (t) { t.setAttribute('pathLength', '1'); });
    gs.set(hojas, { scale: 0 });
    gs.set(cardos, { scale: 0 });
    gs.set(esc.guirnaldaSombra, { opacity: 0 });
    var tj = esc.tarjetaG;
    if (tj) { gs.set(tj, { opacity: 0, y: -10 }); esc.tarjeta.poner(0); }

    // 1. las sillas se arriman y se despliega el camino de lino
    tl.to(sillas, { opacity: 1, x: 0, duration: .9, ease: 'power3.out', stagger: .04 }, 0);
    tl.to(esc.camClip, { attr: { height: esc.vbH + 1200 }, duration: 1.15, ease: 'power2.inOut', autoRound: false }, .05);
    // 2. el esparto, las servilletas que se doblan, los platos que se deslizan hasta su sitio
    tl.to(mats, { opacity: 1, scale: 1, duration: .6, ease: 'power2.out', stagger: .06 }, .35);
    tl.to(servs, { opacity: 1, scaleX: 1, scaleY: 1, rotation: 0, duration: .85, ease: 'power3.out', stagger: .06 }, .62);
    tl.to(platos.map(function (z) { return z.ent; }), { opacity: 1, x: 0, rotation: 0, duration: 1.0, ease: 'power3.out', stagger: .09 }, .75);
    tl.to(lifts, { opacity: 0, x: 0, y: 0, duration: .7, ease: 'power2.inOut', stagger: .09 }, 1.05);       // la sombra se recoge al apoyarse
    // 3. los cubiertos y las copas
    tl.to(cubs, { opacity: 1, y: 0, duration: .75, ease: 'power3.out', stagger: .03 }, 1.15);
    tl.to(copas.map(function (z) { return z.ent; }), { opacity: 1, scale: 1, y: 0, duration: .7, ease: 'power2.out', stagger: .035 }, 1.4);
    // 4. el centro: la guirnalda se dibuja, hoja a hoja
    tl.to(esc.guirnaldaSombra, { opacity: 1, duration: 1.1 }, 1.2);
    tl.to(tallos, { strokeDashoffset: 0, duration: .9, ease: 'power1.inOut', stagger: .035, autoRound: false }, 1.2);
    tl.to(hojas, { scale: 1, duration: .55, ease: 'power2.out', stagger: { each: .006, from: 'start' } }, 1.4);
    tl.to(cardos, { scale: 1, duration: .6, ease: 'power2.out', stagger: .08 }, 2.3);
    // 5. las hortensias, las velas, y se encienden
    jarras.forEach(function (z, i) {
      tl.to(z.ent, { opacity: 1, y: 0, scale: 1, duration: .8, ease: 'power3.out' }, 2.2 + i * .2);
    });
    velas.forEach(function (z, i) {
      tl.to(z.ent, { opacity: 1, y: 0, duration: .55, ease: 'power3.out' }, 2.3 + i * .18);
      tl.set(z.llama, { opacity: 1 }, 3.0 + i * .22);
      tl.to([z.fuego, z.nucleo], { scale: 1, duration: .7, ease: 'power2.out', onComplete: function () { ctrl.parpadeo(z); } }, 3.0 + i * .22);
    });
    // 6. la tarjeta del plato del centro: se posa y se escribe a pluma
    if (tj) {
      tl.to(tj, { opacity: 1, y: 0, duration: .55, ease: 'power3.out' }, 2.6);
      tl.add(function () { esc.tarjeta.escribir(1.9); }, 3.1);
      tl.to({}, { duration: 1.9 }, 3.1);
    }
    return tl;
  }

  /* =====================================================================
     8. «DEL PLATO AL MAR»: al bajar, la cámara sube. Una sola sección fijada con scrub.
        mesa dibujada → su mesa real (IG 19) → la fachada, con la mesa tras una ventana (IG 14) → la ortofoto PNOA centrada en la casa
        → zoom aéreo continuo y exacto (5 niveles encajados, mismo centro y misma proyección) hasta el valle de Cances y la costa.
        Fotos de IG: no se finge que una contenga a la otra; es un zoom con desenfoque de movimiento.
     ===================================================================== */
  var RAIZ = (function () {
    try { var s = document.currentScript && document.currentScript.src; if (s) return new URL('../', s).href; } catch (e) {}
    return document.baseURI;
  })();
  var urlR = function (r) { try { return new URL(r, RAIZ).href; } catch (e) { return r; } };
  var FALLBACK_FOTO = { 'mesa-larga-otono': 'ref/fotos/instagram/0019_CzCXVUGshQC_2.jpg', 'fachada': 'ref/fotos/instagram/0014_C1hubIyMIZN_1.jpg' };
  var cacheJSON = {};
  function cargarJSON(r) {
    if (!cacheJSON[r]) cacheJSON[r] = fetch(urlR(r)).then(function (x) { if (!x.ok) throw new Error(r + ' ' + x.status); return x.json(); });
    return cacheJSON[r];
  }
  /* <picture> de una foto de la web por su nombre (img/fotos/fotos.json); si no existe, la foto de ref/ */
  function fotoPicture(nombre, alt, sizes, extra) {
    return cargarJSON('img/fotos/fotos.json').then(function (lista) {
      var f = (lista || []).filter(function (x) { return x.nombre === nombre; })[0];
      if (!f) throw new Error('sin ' + nombre);
      var an = (f.anchos || []).slice().sort(function (a, b) { return a - b; });
      var mk = function (ext) { return an.map(function (w) { return urlR('img/fotos/' + nombre + '-' + w + '.' + ext) + ' ' + w + 'w'; }).join(', '); };
      var grande = an[an.length - 1];
      return '<picture><source type="image/avif" srcset="' + mk('avif') + '" sizes="' + sizes + '"><source type="image/webp" srcset="' + mk('webp') + '" sizes="' + sizes + '"><img src="' + urlR('img/fotos/' + nombre + '-' + grande + '.jpg') + '" srcset="' + mk('jpg') + '" sizes="' + sizes + '" alt="' + (alt || '') + '" decoding="async" ' + (extra || '') + '></picture>';
    }).catch(function () {
      var r = FALLBACK_FOTO[nombre];
      return '<img src="' + urlR(r || '') + '" alt="' + (alt || '') + '" decoding="async" ' + (extra || '') + '>';
    });
  }
  function aireHTML(k, extra) {
    var b = 'img/aire/aire-' + k;
    return '<picture><source type="image/avif" srcset="' + urlR(b + '.avif') + '"><source type="image/webp" srcset="' + urlR(b + '.webp') + '"><img src="' + urlR(b + '.jpg') + '" alt="" decoding="async" ' + (extra || '') + '></picture>';
  }

  var VENTANA = { x0: .0302, x1: .1079, y0: .289, y1: .421 };               // la ventana con balcón de la fachada (IG 14), en fracción de la foto
  var PLATO_FOTO = { x: .228, y: .346, d: .2 };                              // el cuenco de la izquierda de la mesa de IG 19, en fracción de la foto
  var LUGARES_VER = {   // rango de zoom (metros visibles en el lado grande) donde se enseña cada rótulo: [aparece completo, desaparece, aparece, completo]
    casa: [0, 0, 2600, 5200], cances: [150, 600, 3200, 6500], carballo: [6500, 12000, 99999, 99999], malpica: [9000, 15000, 99999, 99999],
    sisargas: [9000, 15000, 99999, 99999], razo: [9000, 15000, 99999, 99999], baldaio: [9000, 15000, 99999, 99999]
  };
  function banda(w, r) {   // 1 dentro de [r0,r1], con rampas
    var a = clamp((w - r[0]) / Math.max(1, r[1] - r[0]), 0, 1), b = 1 - clamp((w - r[2]) / Math.max(1, r[3] - r[2]), 0, 1);
    if (r[0] === 0 && r[1] === 0) a = 1;
    return smooth(a) * smooth(b);
  }

  function crearZoom(host, esc, ctrl, op, aire) {
    var gs = G(), st = ST();
    var sec = host.closest('section') || host.parentNode;
    var texto = sec ? sec.querySelector('.portada-texto') : null;
    var capa = document.createElement('div');
    capa.className = 'mz-zoom';
    capa.setAttribute('aria-hidden', 'true');
    capa.innerHTML =
      '<div class="mz-aire"></div>' +
      '<div class="mz-fachada"><div class="mz-f-img"></div><div class="mz-ventana"><div class="mz-v-img"></div><div class="mz-vidrio"></div></div></div>' +
      '<div class="mz-foto"></div>' +
      '<svg class="mz-lineas" width="100%" height="100%"></svg><div class="mz-lugares"></div>' +
      '<p class="mz-cred" lang="es">Ortofoto: PNOA © IGN, CC BY 4.0</p>';
    host.appendChild(capa);
    var elAire = $('.mz-aire', capa), elFach = $('.mz-fachada', capa), elFoto = $('.mz-foto', capa), elVent = $('.mz-ventana', capa);
    var lineas = $('.mz-lineas', capa), lugaresEl = $('.mz-lugares', capa), cred = $('.mz-cred', capa);
    var niv = aire.niveles, lugs = aire.lugares;
    var imgNiv = [];
    // los cinco niveles de la ortofoto (se cargan cuando la sección se acerca)
    niv.forEach(function (n, k) {
      var d = document.createElement('div');
      d.className = 'mz-nivel'; d.dataset.nivel = k;
      d.style.width = d.style.height = n.px + 'px';
      d.innerHTML = aireHTML(k, 'loading="lazy"');
      elAire.appendChild(d);
      imgNiv.push(d);
    });
    // lugares, líneas y minutos (solo los que dice la casa: Malpica 10 min, Razo y Baldaio 15 min)
    var pLug = {};
    lugs.forEach(function (l) {
      var d = document.createElement('div');
      d.className = 'mz-lugar mz-' + l.id + (l.id === 'casa' ? ' es-casa' : '');
      d.innerHTML = '<i class="mz-punto"></i><span class="mz-nombre">' + l.nombre + (l.min ? '<b class="mz-min"> · ' + l.min + '</b>' : '') + '</span>';
      lugaresEl.appendChild(d);
      pLug[l.id] = { d: d, l: l };
    });
    var lns = {};
    lugs.forEach(function (l) {
      if (!l.min) return;
      var ln = document.createElementNS(NS, 'line');
      ln.setAttribute('class', 'mz-linea'); ln.setAttribute('pathLength', '1');
      lineas.appendChild(ln);
      lns[l.id] = ln;
    });
    // fotos
    var okFoto = false;
    fotoPicture('mesa-larga-otono', '', '100vw', 'fetchpriority="low"').then(function (h) { elFoto.innerHTML = h; $('.mz-foto', capa); okFoto = true; });
    fotoPicture('mesa-larga-otono', '', '30vw', 'loading="lazy"').then(function (h) { $('.mz-v-img', capa).innerHTML = h; });
    fotoPicture('fachada', '', '100vw', 'loading="lazy"').then(function (h) { $('.mz-f-img', capa).innerHTML = h; });

    var g = { vw: 0, vh: 0, S0: 0, dT: 0, K0: 1, Kc: 1, Kend: 1, F1: 1, px: 0, py: 0, Z: 1, T0x: 0, T0y: 0, ancho: 0, maxd: 0 };
    var escenaWrap = esc.svg;
    function medir() {
      var r = host.getBoundingClientRect();
      g.vw = r.width; g.vh = r.height; g.maxd = Math.max(g.vw, g.vh); g.S0 = g.maxd;
      var m = esc.svg.getScreenCTM();
      var pz = esc.bienvenidaPieza;
      if (m && pz) {
        var pt = esc.svg.createSVGPoint(); pt.x = esc.xc + pz.bx; pt.y = pz.by;
        var q = pt.matrixTransform(m);
        g.px = q.x - r.left; g.py = q.y - r.top;
        g.dPlato = 2 * R_PLATO * m.a;
      } else { g.px = g.vw * .6; g.py = g.vh * .5; g.dPlato = Math.min(g.vw, g.vh) * .2; }
      g.dT = Math.min(g.vw, g.vh) * (esc.vertical ? .78 : .62);       // el plato, al acabar la primera zoom
      g.Z = clamp(g.dT / g.dPlato, 1.6, 7);
      var wa = (VENTANA.x1 - VENTANA.x0) / (VENTANA.y1 - VENTANA.y0);
      g.wa = wa;
      g.dFoto = PLATO_FOTO.d * g.S0;
      g.K0 = g.dT / g.dFoto;
      g.Kc = Math.min(g.vw, g.vh) / g.S0;
      g.winH = (esc.vertical ? .42 : .5) * g.vh;
      g.Kend = g.winH / g.S0;
      var wH = (VENTANA.y1 - VENTANA.y0) * g.S0;
      g.F1 = g.winH / wH;
      g.wcx = (VENTANA.x0 + VENTANA.x1) / 2; g.wcy = (VENTANA.y0 + VENTANA.y1) / 2;
      // tamaños de las capas cuadradas, centradas en la pantalla
      [elFoto, elFach].forEach(function (e) { e.style.width = e.style.height = g.S0 + 'px'; e.style.left = (g.vw - g.S0) / 2 + 'px'; e.style.top = (g.vh - g.S0) / 2 + 'px'; });
      elVent.style.left = VENTANA.x0 * 100 + '%'; elVent.style.top = VENTANA.y0 * 100 + '%';
      elVent.style.width = (VENTANA.x1 - VENTANA.x0) * 100 + '%'; elVent.style.height = (VENTANA.y1 - VENTANA.y0) * 100 + '%';
      lineas.setAttribute('viewBox', '0 0 ' + g.vw + ' ' + g.vh);
      escenaWrap.style.transformOrigin = g.px + 'px ' + g.py + 'px';
    }
    var easeIO = function (t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
    var ultimoP = -1;

    function render(p) {
      p = clamp(p, 0, 1);
      ultimoP = p;
      var a = easeIO(seg(p, 0, .21));
      // A · la mesa se acerca al plato de la bienvenida
      var S = lerp(1, g.Z, a), Tx = (g.vw / 2 - g.px) * a, Ty = (g.vh / 2 - g.py) * a;
      escenaWrap.style.transform = 'translate3d(' + f1(Tx) + 'px,' + f1(Ty) + 'px,0) scale(' + f2(S) + ')';
      var oEsc = 1 - smooth(seg(p, .17, .26));
      escenaWrap.style.opacity = f2(oEsc);
      escenaWrap.style.visibility = oEsc <= 0.001 ? 'hidden' : 'visible';
      if (texto) { var ot = 1 - smooth(seg(p, 0, .07)); texto.style.opacity = f2(ot); texto.style.visibility = ot <= 0.01 ? 'hidden' : ''; }
      // B · se funde con su mesa real
      var fB = smooth(seg(p, .15, .25));
      var t1 = easeIO(seg(p, .22, .36)), t2 = easeIO(seg(p, .34, .46));
      var K = g.K0 * Math.pow(g.Kc / g.K0, t1) * lerp(1, g.Kend / g.Kc, t2);
      var tx = -(PLATO_FOTO.x - .5) * g.S0 * K * (1 - t1), ty = -(PLATO_FOTO.y - .5) * g.S0 * K * (1 - t1);
      var ih = lerp(0, (1 - g.wa) / 2 * g.S0, t2);
      var oFoto = fB * (1 - smooth(seg(p, .452, .475)));
      elFoto.style.transform = 'translate3d(' + f1(tx) + 'px,' + f1(ty) + 'px,0) scale(' + f2(K * 1000) / 1000 + ')';
      elFoto.style.clipPath = 'inset(0 ' + f1(ih) + 'px 0 ' + f1(ih) + 'px)';
      elFoto.style.opacity = f2(oFoto);
      elFoto.style.filter = 'blur(' + f1(5 * Math.sin(Math.PI * seg(p, .22, .36))) + 'px)';
      elFoto.style.visibility = oFoto <= .001 ? 'hidden' : 'visible';
      // C · la fachada: la mesa queda tras la ventana, y la cámara se aleja
      var oF = smooth(seg(p, .28, .37)) * (1 - smooth(seg(p, .54, .62)));
      var u = easeIO(seg(p, .47, .62));
      var F = g.F1 * Math.pow(.62 / g.F1, u);
      var fx = -(g.wcx - .5) * g.S0 * F * (1 - u), fy = -(g.wcy - .5) * g.S0 * F * (1 - u);
      elFach.style.transform = 'translate3d(' + f1(fx) + 'px,' + f1(fy) + 'px,0) scale(' + f2(F * 1000) / 1000 + ')';
      elFach.style.opacity = f2(oF);
      elFach.style.visibility = oF <= .001 ? 'hidden' : 'visible';
      elFach.style.filter = 'blur(' + f1(4 * Math.sin(Math.PI * seg(p, .47, .62))) + 'px)';
      elVent.style.setProperty('--vidrio', f2(smooth(seg(p, .4, .52))));
      // D · la ortofoto: aparece mientras la fachada se va, y se aleja sin saltos
      var oA = smooth(seg(p, .52, .62));
      var q = easeIO(seg(p, .5, 1));
      var W0 = 105, W1 = 27000;
      var Wv = W0 * Math.pow(W1 / W0, q);
      var ppm = g.maxd / Wv;
      elAire.style.opacity = f2(oA);
      elAire.style.visibility = oA <= .001 ? 'hidden' : 'visible';
      var cx = g.vw / 2, cy = g.vh / 2;
      var casa = aire.casa_xy;
      for (var k = 0; k < niv.length; k++) {
        var side = niv[k].ancho_m * ppm, r = side / g.maxd;
        var o = k === niv.length - 1 ? 1 : smooth(seg(r, 1.02, 1.36));
        var d = imgNiv[k];
        if (o <= .001) { d.style.visibility = 'hidden'; continue; }
        var dx = -(casa[k].x - .5) * side, dy = -(casa[k].y - .5) * side;
        d.style.visibility = 'visible';
        d.style.opacity = f2(o);
        d.style.transform = 'translate3d(' + f1(cx + dx - niv[k].px / 2) + 'px,' + f1(cy + dy - niv[k].px / 2) + 'px,0) scale(' + (side / niv[k].px).toFixed(5) + ')';
        d.style.zIndex = String(niv.length - k);
      }
      elAire.style.filter = oA < 1 ? 'blur(' + f1(5 * (1 - oA)) + 'px)' : '';
      cred.style.opacity = f2(oA > .5 ? (oA - .5) * 2 : 0);
      // rótulos y minutos
      var ps = {};
      lugs.forEach(function (l) {
        var x = cx + (l.lon - aire.casa.lon) * aire.metros_por_grado.lon * ppm, y = cy - (l.lat - aire.casa.lat) * aire.metros_por_grado.lat * ppm;
        var vis = banda(Wv, LUGARES_VER[l.id] || [0, 0, 1, 1]) * oA;
        var dd = pLug[l.id].d;
        var dentro = x > -60 && x < g.vw + 60 && y > -40 && y < g.vh + 40;
        if (vis < .02 || !dentro) { dd.style.opacity = 0; dd.style.visibility = 'hidden'; }
        else { dd.style.visibility = 'visible'; dd.style.opacity = f2(vis); dd.style.transform = 'translate3d(' + f1(x) + 'px,' + f1(y) + 'px,0)'; }
        ps[l.id] = { x: x, y: y, vis: vis };
      });
      lugs.forEach(function (l) {
        var ln = lns[l.id]; if (!ln) return;
        var a2 = ps.casa, b2 = ps[l.id], v = smooth(seg(Wv, 9000, 20000)) * oA * (b2 ? 1 : 0);
        if (!b2 || v < .02) { ln.style.opacity = 0; return; }
        ln.setAttribute('x1', f1(a2.x)); ln.setAttribute('y1', f1(a2.y)); ln.setAttribute('x2', f1(b2.x)); ln.setAttribute('y2', f1(b2.y));
        ln.style.opacity = f2(v); ln.style.strokeDashoffset = f2(1 - v);
      });
      capa.dataset.p = f2(p);
      host.dataset.zoomP = f2(p);
    }
    ctrl.zoom = {
      render: render,
      // para pruebas: dónde cae la casa y qué escala tiene cada nivel con el zoom en p (centro y escala, en píxeles de pantalla)
      sonda: function (p) {
        render(p);
        return imgNiv.map(function (d, k) {
          var r = d.getBoundingClientRect(), hr = host.getBoundingClientRect();
          return { nivel: k, visible: d.style.visibility !== 'hidden', opacidad: +d.style.opacity || 0, ancho: r.width, casaX: r.left - hr.left + aire.casa_xy[k].x * r.width, casaY: r.top - hr.top + aire.casa_xy[k].y * r.height };
        });
      },
      niveles: niv, medir: medir, geom: g
    };
    medir();
    render(0);
    // el ScrollTrigger: una sola sección fijada, ≤ 3 pantallas en escritorio y ≤ 1,8 en móvil
    var trig = null, anchoV = innerWidth, altoV = innerHeight;
    if (st && gs && sec) {
      var pant = function () { return esc.vertical ? 1.75 : 2.9; };
      trig = st.create({
        trigger: sec, start: 'top top', end: function () { return '+=' + Math.round(innerHeight * pant()); }, pin: true, pinSpacing: true, anticipatePin: 1, invalidateOnRefresh: true,
        onRefresh: function () { medir(); render(ultimoP < 0 ? 0 : ultimoP); },
        onUpdate: function (self) { render(self.progress); },
        onToggle: function (self) { ctrl.visible = self.isActive || ctrl.visible; }
      });
      ctrl.pantallas = pant();
    }
    // el resize de la barra del móvil no rehace nada
    var onResize = function () {
      if (innerWidth === anchoV && Math.abs(innerHeight - altoV) < 160) return;
      anchoV = innerWidth; altoV = innerHeight;
      medir(); render(ultimoP < 0 ? 0 : ultimoP);
    };
    addEventListener('resize', onResize);
    return { destruir: function () { removeEventListener('resize', onResize); if (trig) trig.kill(true); escenaWrap.style.transform = escenaWrap.style.opacity = escenaWrap.style.visibility = ''; if (texto) { texto.style.opacity = ''; texto.style.visibility = ''; } if (capa.parentNode) capa.parentNode.removeChild(capa); } };
  }

  /* la versión sobria: tres imágenes fijas (mesa, fachada, valle) en lugar del zoom */
  function crearTres(host, aire) {
    var cont = document.createElement('div');
    cont.className = 'mz-tres';
    var casa = aire && aire.casa_xy ? aire.casa_xy[3] : { x: .5, y: .5 };
    cont.innerHTML =
      '<figure class="mz-t-fig"><div class="mz-t-img" data-foto="mesa"></div><figcaption>La mesa de la casa, puesta con flores y velas <span class="num">Instagram, octubre de 2023</span></figcaption></figure>' +
      '<figure class="mz-t-fig"><div class="mz-t-img" data-foto="fachada"></div><figcaption>La casa grande y el patio, vistos desde arriba <span class="num">Instagram</span></figcaption></figure>' +
      '<figure class="mz-t-fig"><div class="mz-t-img mz-t-valle">' + aireHTML(3, 'loading="lazy"') + '<i class="mz-punto" style="left:' + f1(casa.x * 100) + '%;top:' + f1(casa.y * 100) + '%"></i><span class="mz-nombre mz-t-casa" style="left:' + f1(casa.x * 100) + '%;top:' + f1(casa.y * 100) + '%">Casa Entremuros</span></div><figcaption>El valle de Cances, a diez minutos de Malpica <span class="num">Ortofoto: PNOA © IGN, CC BY 4.0</span></figcaption></figure>';
    host.appendChild(cont);
    fotoPicture('mesa-larga-otono', 'La mesa larga de pino de la casa, puesta', '(max-width: 899px) 100vw, 33vw', 'loading="lazy"').then(function (h) { $('[data-foto="mesa"]', cont).innerHTML = h; });
    fotoPicture('fachada', 'La fachada de piedra de la casa grande y el patio', '(max-width: 899px) 100vw, 33vw', 'loading="lazy"').then(function (h) { $('[data-foto="fachada"]', cont).innerHTML = h; });
    return { destruir: function () { if (cont.parentNode) cont.parentNode.removeChild(cont); } };
  }

  /* =====================================================================
     9. LAS CINCO RAMAS DEL CENTRO DE MESA · Entremuros.mesa.rama(el, { n, dibujar })
        1 hortensia · 2 lavanda · 3 hoja de arce · 4 olivo · 5 hierbas de San Juan  (todas salen de su Instagram)
        Cada rama se dibuja: primero el trazo (pathLength=1 + strokeDashoffset, autoRound:false) y luego el relleno.
     ===================================================================== */
  function hojaP(len, wid) {   // una hoja lanceolada con la punta en (0,-len)
    return 'M0 0C' + f1(wid * .95) + ' ' + f1(-len * .22) + ' ' + f1(wid * .75) + ' ' + f1(-len * .78) + ' 0 ' + f1(-len) + 'C' + f1(-wid * .75) + ' ' + f1(-len * .78) + ' ' + f1(-wid * .95) + ' ' + f1(-len * .22) + ' 0 0Z';
  }
  function hojaG(x, y, ang, len, wid, fill, stroke, nervio) {
    return { rel: '<g transform="translate(' + f1(x) + ' ' + f1(y) + ') rotate(' + f1(ang) + ')"><path d="' + hojaP(len, wid) + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1"/></g>',
      tr: nervio === false ? '' : '<path class="t" d="M' + f1(x) + ' ' + f1(y) + 'L' + f1(x + Math.sin(ang * .01745) * len * .86) + ' ' + f1(y - Math.cos(ang * .01745) * len * .86) + '" stroke="' + stroke + '" stroke-width=".9" opacity=".7"/>' };
  }
  function florCuatro(x, y, r, fill, centro) {
    var s = '<g transform="translate(' + f1(x) + ' ' + f1(y) + ')" fill="' + fill + '" stroke="rgba(40,50,100,.35)" stroke-width=".5"><circle cx="' + f1(-r * .85) + '" r="' + f1(r) + '"/><circle cx="' + f1(r * .85) + '" r="' + f1(r) + '"/><circle cy="' + f1(-r * .85) + '" r="' + f1(r) + '"/><circle cy="' + f1(r * .85) + '" r="' + f1(r) + '"/></g>';
    return s + (centro ? '<circle cx="' + f1(x) + '" cy="' + f1(y) + '" r="' + f1(r * .38) + '" fill="#EFE8C8"/>' : '');
  }
  var RAMAS = {
    1: function (p) {      // hortensia: la flor favorita de Mónica (IG 161)
      var tr = '<path class="t" d="M44 97C46 84 52 74 58 62" stroke="' + p.hoja + '" stroke-width="2.6" fill="none" stroke-linecap="round"/>', rel = '', i;
      var h1 = hojaG(48, 84, -62, 28, 13, p.hoja2, p.hoja), h2 = hojaG(52, 90, 58, 26, 12, p.hoja2, p.hoja), h3 = hojaG(55, 72, 24, 18, 8.5, '#9DB383', p.hoja);
      rel += h1.rel + h2.rel + h3.rel; tr += h1.tr + h2.tr;
      var cols = p.flor, c = [[0, 0]], k;
      for (k = 0; k < 6; k++) c.push([Math.cos(k * 1.047) * 9.6, Math.sin(k * 1.047) * 9.6]);
      for (k = 0; k < 12; k++) c.push([Math.cos(k * .5236 + .26) * 19, Math.sin(k * .5236 + .26) * 19]);
      c.forEach(function (q, j) { rel += florCuatro(58 + q[0] * .9, 38 + q[1] * .9, 4.3, cols[(j * 5 + (j > 6 ? 1 : 0)) % 5], true); });
      return { tr: tr, rel: rel };
    },
    2: function (p) {      // lavanda
      var tr = '', rel = '', i, j;
      var tallos = [[50, 97, 30, 20], [50, 97, 50, 8], [50, 97, 71, 18]];
      tallos.forEach(function (t, ti) {
        var cx = (t[0] + t[2]) / 2 + (ti - 1) * 6, cy = (t[1] + t[3]) / 2;
        tr += '<path class="t" d="M' + t[0] + ' ' + t[1] + 'Q' + f1(cx) + ' ' + f1(cy) + ' ' + t[2] + ' ' + t[3] + '" stroke="' + p.hoja + '" stroke-width="1.8" fill="none" stroke-linecap="round"/>';
        for (j = 0; j < 11; j++) {
          var u = .5 + j * .05, bx = (1 - u) * (1 - u) * t[0] + 2 * (1 - u) * u * cx + u * u * t[2], by = (1 - u) * (1 - u) * t[1] + 2 * (1 - u) * u * cy + u * u * t[3];
          var col = j % 2 ? '#8C7AB9' : '#A596CE';
          rel += '<ellipse cx="' + f1(bx - 2.2) + '" cy="' + f1(by) + '" rx="2.4" ry="3.6" fill="' + col + '" stroke="#6A5A98" stroke-width=".5" transform="rotate(-25 ' + f1(bx - 2.2) + ' ' + f1(by) + ')"/><ellipse cx="' + f1(bx + 2.2) + '" cy="' + f1(by - 1.5) + '" rx="2.4" ry="3.6" fill="' + col + '" stroke="#6A5A98" stroke-width=".5" transform="rotate(25 ' + f1(bx + 2.2) + ' ' + f1(by - 1.5) + ')"/>';
        }
      });
      var l1 = hojaG(50, 96, -38, 30, 3.6, '#8EA273', p.hoja, false), l2 = hojaG(50, 96, 36, 30, 3.6, '#8EA273', p.hoja, false), l3 = hojaG(50, 97, -8, 26, 3.2, '#7C9A6B', p.hoja, false);
      rel = l1.rel + l2.rel + l3.rel + rel;
      tr += '<path class="t" d="M44 96Q50 92 56 96" stroke="#7B5E3A" stroke-width="2" fill="none" stroke-linecap="round"/>';
      return { tr: tr, rel: rel };
    },
    3: function (p) {      // hoja de arce (los arces del jardín, IG 46 y 77)
      var tips = [[50, 4, 1], [74, 20, .8], [92, 44, .72], [75, 62, .6], [56, 66, .3], [44, 66, .3], [25, 62, .6], [8, 44, .72], [26, 20, .8]];
      var d = 'M50 70L48 66', n = [[50, 4], [61, 24], [76, 18], [70, 38], [93, 42], [76, 52], [82, 66], [62, 62], [52, 78], [48, 78], [38, 62], [18, 66], [24, 52], [7, 42], [30, 38], [24, 18], [39, 24]];
      d = 'M' + n.map(function (q) { return q[0] + ' ' + q[1]; }).join('L') + 'Z';
      var tr = '<path class="t" d="M50 76L49 96" stroke="#7A4A2A" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
        '<path class="t" d="M50 72L50 12M50 58L78 22M50 58L22 22M50 62L88 44M50 62L12 44M50 66L74 62M50 66L26 62" stroke="#7B2F18" stroke-width="1" fill="none" stroke-linecap="round" opacity=".85"/>';
      var rel = '<defs><linearGradient id="ma-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D98A32"/><stop offset=".55" stop-color="#C0612B"/><stop offset="1" stop-color="#9E3E22"/></linearGradient></defs><path d="' + d + '" fill="url(#ma-g)" stroke="#7B2F18" stroke-width="1.4" stroke-linejoin="round"/>';
      return { tr: tr, rel: rel };
    },
    4: function (p) {      // olivo (la corona de olivo de IG 74)
      var tr = '<path class="t" d="M10 92C32 80 52 62 62 44C70 30 80 22 92 16" stroke="#7A5F3C" stroke-width="2.4" fill="none" stroke-linecap="round"/>', rel = '', i;
      var pts = function (t) { var u = 1 - t; return [u * u * u * 10 + 3 * u * u * t * 32 + 3 * u * t * t * 52 + t * t * t * 62, u * u * u * 92 + 3 * u * u * t * 80 + 3 * u * t * t * 62 + t * t * t * 44]; };
      var pts2 = function (t) { var u = 1 - t; return [u * u * u * 62 + 3 * u * u * t * 70 + 3 * u * t * t * 80 + t * t * t * 92, u * u * u * 44 + 3 * u * u * t * 30 + 3 * u * t * t * 22 + t * t * t * 16]; };
      var hojas = [];
      for (i = 1; i <= 7; i++) { var q = pts(i / 7.5); hojas.push([q[0], q[1], 40 - i * 3]); }
      for (i = 0; i <= 6; i++) { var q2 = pts2(i / 6.6); hojas.push([q2[0], q2[1], 55 - i * 6]); }
      hojas.forEach(function (h, j) {
        var lado = j % 2 ? 1 : -1, ang = h[2] + lado * 48;
        var a = hojaG(h[0], h[1], ang, 17, 4.6, j % 2 ? '#A3B08E' : '#8E9F7D', p.hoja);
        rel += a.rel; tr += a.tr;
      });
      rel += '<g><path d="M44 72L47 80" stroke="#7A5F3C" stroke-width="1.2"/><ellipse cx="48" cy="84" rx="4.4" ry="5.6" fill="#4A3D5C" stroke="#2F2640" stroke-width=".8" transform="rotate(14 48 84)"/><ellipse cx="46.6" cy="82.4" rx="1.3" ry="2" fill="#fff" opacity=".35"/></g>';
      rel += '<g><path d="M70 36L72 44" stroke="#7A5F3C" stroke-width="1.2"/><ellipse cx="73" cy="49" rx="4.1" ry="5.3" fill="#566B3E" stroke="#3A4A2A" stroke-width=".8" transform="rotate(-10 73 49)"/><ellipse cx="71.8" cy="47.4" rx="1.2" ry="1.9" fill="#fff" opacity=".35"/></g>';
      return { tr: tr, rel: rel };
    },
    5: function (p) {      // hierbas de San Juan (IG 30): hinojo, romero, ruda, laurel y una margarita, atadas con cuerda
      var tr = '', rel = '', i;
      var tallos = [[38, 97, 30, 26], [46, 97, 44, 14], [54, 97, 60, 20], [62, 97, 74, 34], [50, 97, 52, 40]];
      tallos.forEach(function (t, k) {
        tr += '<path class="t" d="M' + t[0] + ' ' + t[1] + 'Q' + f1((t[0] + t[2]) / 2 + (k - 2) * 3) + ' ' + f1((t[1] + t[3]) / 2) + ' ' + t[2] + ' ' + t[3] + '" stroke="' + (k % 2 ? p.hoja : '#6E8A52') + '" stroke-width="1.7" fill="none" stroke-linecap="round"/>';
      });
      // hinojo: plumas finas y sombrilla amarilla
      for (i = 0; i < 9; i++) { var y = 36 - i * 2.6; tr += '<path class="t" d="M30 ' + f1(y + 22) + 'L' + f1(22 + i * .6) + ' ' + f1(y + 17) + 'M30 ' + f1(y + 22) + 'L' + f1(38 - i * .6) + ' ' + f1(y + 17) + '" stroke="#7C9A5E" stroke-width=".8" fill="none" opacity=".9"/>'; }
      rel += '<g fill="#CFC95E" stroke="#9A9638" stroke-width=".5"><circle cx="30" cy="22" r="2.6"/><circle cx="25" cy="25" r="2.1"/><circle cx="35" cy="25" r="2.1"/><circle cx="21" cy="29" r="1.8"/><circle cx="39" cy="29" r="1.8"/><circle cx="30" cy="29" r="1.9"/></g>';
      // romero: agujas a lo largo del tallo
      for (i = 0; i < 9; i++) { var yy = 20 + i * 5.2, xx = 60 + (i * .9); rel += '<path d="M' + f1(xx) + ' ' + f1(yy) + 'l-6 -3M' + f1(xx) + ' ' + f1(yy) + 'l6 -3" stroke="#5B7A57" stroke-width="1.7" stroke-linecap="round"/>'; }
      // laurel y ruda
      var lau = hojaG(46, 70, -38, 26, 9, '#5F7D4A', '#3F5A2F'), lau2 = hojaG(54, 74, 42, 24, 8.5, '#6C8A55', '#3F5A2F');
      rel += lau.rel + lau2.rel; tr += lau.tr + lau2.tr;
      for (i = 0; i < 5; i++) rel += '<g transform="translate(' + f1(70 + i * 2.2) + ' ' + f1(40 + i * 5) + ')"><circle cx="-3" r="3.1" fill="#8FA7A0" stroke="#5E7B73" stroke-width=".6"/><circle cx="3" r="3.1" fill="#9BB1AA" stroke="#5E7B73" stroke-width=".6"/></g>';
      // margarita
      var j;
      rel += '<g transform="translate(76 22)">';
      for (j = 0; j < 10; j++) rel += '<ellipse cx="0" cy="-6.6" rx="2.1" ry="4.8" fill="#FBF9F4" stroke="#C9C2AE" stroke-width=".5" transform="rotate(' + (j * 36) + ')"/>';
      rel += '<circle r="3.6" fill="#E8B83A" stroke="#B88A1C" stroke-width=".6"/></g>';
      tr += '<path class="t" d="M76 28Q72 40 64 56" stroke="' + p.hoja + '" stroke-width="1.5" fill="none" stroke-linecap="round"/>';
      // la cuerda
      tr += '<path class="t" d="M33 80Q50 74 70 80M34 84Q50 78 69 84" stroke="#9A7A4C" stroke-width="2" fill="none" stroke-linecap="round"/><path class="t" d="M52 80Q56 90 52 96M52 80Q47 88 48 97" stroke="#9A7A4C" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
      return { tr: tr, rel: rel };
    }
  };

  /* dibuja la rama n en el; se dibuja con trazo y relleno (o ya hecha, si no hay GSAP o se pide movimiento reducido) */
  var ramasPuestas = {};
  M.ramasPuestas = function () { return Object.keys(ramasPuestas).map(Number).sort(); };
  function ramaSVG(n, p) {
    var d = RAMAS[n](p);
    return '<svg viewBox="0 0 100 100" width="100%" height="100%" overflow="visible" aria-hidden="true" focusable="false" class="mesa-rama mesa-rama-' + n + '"><g class="r-sombra" opacity=".16" transform="translate(2.2 3.2)" fill="#2a1a08"></g><g class="r-tr" fill="none">' + d.tr + '</g><g class="r-rel">' + d.rel + '</g></svg>';
  }
  M.rama = function (el, op) {
    op = op || {};
    var nodo = typeof el === 'string' ? $(el) : el;
    var n = +(op.n || (nodo && nodo.dataset && nodo.dataset.rama));
    if (!nodo || !RAMAS[n]) return null;
    var p = paleta(), gs = G();
    nodo.innerHTML = ramaSVG(n, p);
    nodo.dataset.rama = n;
    nodo.dataset.dibujada = '1';
    ramasPuestas[n] = true;
    var svg = nodo.firstChild;
    var anim = op.dibujar !== false && op.movimiento !== false && gs && !reducido();
    if (!anim) return { n: n, destruir: function () {} };
    var trazos = $$('.t', svg), rels = $$('.r-rel > *', svg);
    trazos.forEach(function (t) { t.setAttribute('pathLength', '1'); });
    gs.set(trazos, { strokeDasharray: 1, strokeDashoffset: 1 });
    gs.set(rels, { opacity: 0, scale: .6, transformOrigin: '50% 50%' });
    var tl = gs.timeline();
    tl.to(trazos, { strokeDashoffset: 0, duration: 1.0, ease: 'power1.inOut', stagger: .05, autoRound: false }, 0);
    tl.to(rels, { opacity: 1, scale: 1, duration: .55, ease: 'power2.out', stagger: .014 }, .35);
    return { n: n, destruir: function () { tl.kill(); } };
  };

  /* la ramita del foco del teclado (#foco-rama: 38 × 23 px) */
  M.foco = function (el) {
    var nodo = typeof el === 'string' ? $(el) : el;
    if (!nodo) return null;
    var p = paleta();
    nodo.innerHTML = '<svg viewBox="0 0 40 24" width="100%" height="100%" aria-hidden="true" focusable="false"><path d="M2 12C14 11.2 26 12.2 37 9.8" fill="none" stroke="' + p.hoja + '" stroke-width="1.7" stroke-linecap="round"/><path d="M10 11.6C9 6.4 12.6 3.2 17 3 17.2 8 14 11 10 11.6ZM18.2 11.8C19 17.6 23.6 21 28 20.2 27.2 14.6 23.4 11.6 18.2 11.8ZM25 10.8C24.6 6.2 28.6 3.6 33 4.2 32.4 8.2 29 10.4 25 10.8Z" fill="' + p.hoja2 + '" stroke="' + p.hoja + '" stroke-width="1" stroke-linejoin="round"/><path d="M12 10.8L15.6 5.6M20 12.4L25.6 18M27.4 10.2L31 6.2" stroke="' + p.hoja + '" stroke-width=".8" stroke-linecap="round" opacity=".8"/><circle cx="37" cy="9.8" r="1.5" fill="' + p.teja + '"/></svg>';
    return { destruir: function () { nodo.innerHTML = ''; } };
  };

  /* =====================================================================
     10. EL PIE: un tramo de la mesa del principio, ya recogida la sobremesa, con el centro de mesa COMPLETO (las cinco ramas)
         y debajo la placa de piedra, quieta, con el lema de la casa
     ===================================================================== */
  var LEMA = 'No esperes tenerlo todo para disfrutar de la vida, ya tienes la vida para disfrutar de todo';
  function montarPie(el, op) {
    op = op || {};
    var gs = G(), p = paleta(), id = ensureDefs(p), rnd = rng(505);
    var mov = op.movimiento !== false && !reducido() && !!gs;
    el.innerHTML = '';
    el.classList.add('mesa-pie');
    var pinoH = 'url(#' + id + '-pinoH)';
    var svg = '<svg class="mp-svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' +
      '<rect width="1200" height="400" fill="' + p.pino + '"/><rect width="1200" height="400" fill="' + pinoH + '"/>' +
      '<rect width="1200" height="8" fill="rgba(255,238,198,.4)"/><rect y="392" width="1200" height="8" fill="rgba(70,38,10,.4)"/>';
    var cam = 'M-10 100L1210 100L1210 300L-10 300Z';
    svg += '<path d="' + cam + '" transform="translate(5 6)" fill="#3a2810" opacity=".18"/><path d="' + cam + '" fill="#EDE7DA"/><path d="' + cam + '" fill="url(#' + id + '-lino)"/><rect y="100" width="1200" height="200" fill="url(#' + id + '-servG)" opacity=".8"/>';
    svg += '<path d="M-10 109H1210M-10 291H1210" stroke="rgba(120,100,70,.3)" stroke-width=".9" stroke-dasharray="4 3"/>';
    svg += '<g transform="rotate(-14) translate(-200 -150)"><rect x="150" y="0" width="150" height="900" fill="url(#' + id + '-ban)"/><rect x="620" y="0" width="150" height="900" fill="url(#' + id + '-ban)"/><rect x="380" y="0" width="26" height="900" fill="url(#' + id + '-banO)"/></g>';
    // tras la sobremesa: dos vasos vacíos, una servilleta arrugada, un plato con los cubiertos juntos
    svg += '<g transform="translate(300 44)"><use href="#' + id + '-s-copa"/></g><g transform="translate(900 52)"><use href="#' + id + '-s-vaso"/></g>';
    svg += '<g transform="translate(150 350) rotate(-10) scale(.52)"><use href="#' + id + '-s-plato2"/><g transform="translate(18 6) rotate(64) translate(-3 -52) scale(.9)"><use href="#' + id + '-s-tenedor"/></g><g transform="translate(34 14) rotate(64) translate(-3 -52) scale(.9)"><use href="#' + id + '-s-cuchillo"/></g></g>';
    svg += '<g transform="translate(1010 346) rotate(12) scale(.62)"><use href="#' + id + '-s-serv"/><path d="M-30 -8C-14 -22 -2 -2 12 -14C22 -22 30 -4 34 4" stroke="rgba(110,95,70,.4)" stroke-width="1.4" fill="none"/></g>';
    svg += '</svg>';
    var slots = '';
    var xs = [160, 380, 600, 820, 1040];
    xs.forEach(function (x, i) { slots += '<div class="mp-slot" data-n="' + (i + 1) + '" style="left:' + f2((x - 85) / 12) + '%;top:' + f2((200 - 90) / 4) + '%;width:' + f2(170 / 12) + '%;height:' + f2(180 / 4) + '%"></div>'; });
    var velasH = '<svg class="mp-velas" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><g transform="translate(270 200) scale(.8)" class="mp-vela">' + vela(id, p) + '</g><g transform="translate(930 200) scale(.8)" class="mp-vela">' + vela(id, p) + '</g></svg>';
    el.innerHTML = '<div class="mp"><div class="mp-mesa" role="img" aria-label="La mesa, ya recogida la sobremesa, con el centro de mesa completo: una hortensia, lavanda, una hoja de arce, una rama de olivo y las hierbas de San Juan.">' + svg + slots + velasH + '</div>' +
      '<figure class="mp-placa"><img src="' + urlR('img/mesa/placa-pie.webp') + '" width="640" height="525" loading="lazy" decoding="async" alt="El letrero de piedra de la entrada de la casa: «Casa Entremuros», con una vieira y dos abanicos tallados en el granito"></figure>' +
      '<p class="mp-lema">«' + LEMA + '»</p></div>';
    var cont = $('.mp', el), slotEl = {};
    $$('.mp-slot', el).forEach(function (s) { slotEl[s.dataset.n] = s; });
    var hechas = {}, vivo = true, visible = false;
    function dibujar(n, animar) {
      if (hechas[n] || !slotEl[n]) return;
      hechas[n] = true;
      M.rama(slotEl[n], { n: n, dibujar: animar && mov, movimiento: animar && mov });
    }
    var yaVistas = M.ramasPuestas();
    // las ramas de las secciones por las que ya pasó el lector aparecen hechas; las que falten se dibujan al llegar
    var escucha = function (e) { var n = e.detail && +e.detail.n; if (n >= 1 && n <= 5) dibujar(n, visible); };
    document.addEventListener('entremuros:rama', escucha);
    yaVistas.forEach(function (n) { dibujar(n, false); });
    // velas bajas
    var llamasPie = $$('.mp-vela', el).map(function (g) { return { llama: $('.llama', g), fuego: $('.fuego', g), halo: $('.halo', g), nucleo: $('.nucleo', g) }; });
    function parpadeo() {
      if (!gs || !vivo || !visible || document.hidden) { pie.parpadeando = false; return; }
      pie.parpadeando = true;
      llamasPie.forEach(function (v, i) {
        gs.to(v.fuego, { scaleY: 1 + Math.random() * .2, scaleX: 1 - Math.random() * .08, duration: .14 + Math.random() * .24, ease: 'sine.inOut', transformOrigin: '50% 90%', overwrite: 'auto' });
        gs.to(v.halo, { opacity: .8 + Math.random() * .2, scale: .96 + Math.random() * .07, duration: .25 + Math.random() * .3, ease: 'sine.inOut', transformOrigin: '50% 50%', overwrite: 'auto', onComplete: i === 0 ? parpadeo : null });
      });
    }
    var pie = { parpadeando: false };
    var llegada = function () {
      var falta = [1, 2, 3, 4, 5].filter(function (n) { return !hechas[n]; });
      falta.forEach(function (n, i) { setTimeout(function () { if (vivo) dibujar(n, true); }, mov ? 250 + i * 520 : 0); });
      if (!falta.length) cont.classList.add('completa'); else setTimeout(function () { cont.classList.add('completa'); }, mov ? 250 + falta.length * 520 + 900 : 0);
    };
    var io = null, llego = false;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          visible = e.isIntersecting;
          if (visible) { if (!llego) { llego = true; llegada(); } if (!pie.parpadeando) parpadeo(); }
        });
      }, { threshold: .2 });
      io.observe(cont);
    } else { visible = true; llegada(); }
    var vis = function () { if (!document.hidden && visible && !pie.parpadeando) parpadeo(); };
    document.addEventListener('visibilitychange', vis);
    el.dataset.montado = '1';
    return {
      destruir: function () { vivo = false; if (io) io.disconnect(); document.removeEventListener('entremuros:rama', escucha); document.removeEventListener('visibilitychange', vis); if (gs) gs.killTweensOf($$('*', el)); },
      ramas: function () { return Object.keys(hechas).map(Number).sort(); }
    };
  }

  /* =====================================================================
     11. LA PORTADA: montar(el, opciones)
     ===================================================================== */
  function montarPortada(el, op) {
    op = op || {};
    var gs = G();
    var densidad = op.densidad === 'sobria' ? 'sobria' : 'mesa';
    var sobria = densidad === 'sobria';
    var mov = op.movimiento !== false && !reducido() && !!gs;
    var ctrl = { visible: true, limpiar: [], destruido: false, puesta: false, mov: mov, densidad: densidad, zoom: null, tl: null };
    el.innerHTML = '';
    el.classList.add('mesa-portada');
    el.classList.toggle('mesa-sobria', sobria || !mov);
    var esc = crearEscena(el, op);
    ctrl.escena = esc;
    var espacio = document.createElement('div');
    espacio.className = 'mz-espacio'; espacio.setAttribute('aria-hidden', 'true');
    el.appendChild(espacio);
    ctrl.limpiar.push(activarRecolocar(esc, ctrl));
    llamas(esc, ctrl);
    var io = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          ctrl.visible = e.isIntersecting;
          if (e.isIntersecting) ctrl.reanudar();
          else if (gs) { gs.killTweensOf(esc.velas.map(function (v) { return v.halo; })); esc.velas.forEach(function (v) { v.parpadeando = false; }); }
          if (ctrl.tl) { if (e.isIntersecting) ctrl.tl.resume(); else ctrl.tl.pause(); }
        });
      }, { threshold: 0 });
      io.observe(el);
    }
    // los datos aéreos son necesarios para el zoom y para la imagen del valle de la versión sobria
    var promesaAire = cargarJSON('img/aire/aire.json').catch(function () { return null; });
    ctrl.tl = ponerLaMesa(esc, ctrl, op);
    if (!mov) esc.velas.forEach(function (v) { v.enc = true; });
    if (mov && !sobria) {
      promesaAire.then(function (aire) {
        if (ctrl.destruido || !aire) return;
        ctrl.zoom = crearZoom(el, esc, ctrl, op, aire);
        el.classList.add('mesa-con-zoom');
      });
    } else {
      promesaAire.then(function (aire) { if (!ctrl.destruido) ctrl.tres = crearTres(el, aire); });
    }
    // si la pantalla cambia de formato (apaisada ↔ vertical), la mesa se rehace; el resize de la barra del móvil no hace nada
    var an = innerWidth, al = innerHeight, formato = esc.vertical;
    var onResize = function () {
      if (innerWidth === an && Math.abs(innerHeight - al) < 160) return;
      an = innerWidth; al = innerHeight;
      var r = el.getBoundingClientRect();
      var vert = r.width / r.height < 1.05;
      if (vert !== formato) { formato = vert; ctrl.reiniciar && ctrl.reiniciar(); }
    };
    addEventListener('resize', onResize);
    ctrl.limpiar.push(function () { removeEventListener('resize', onResize); });
    ctrl.reiniciar = function () {
      limpiarTodo();
      ctrl.reemplazo = montarPortada(el, Object.assign({}, op, { yaPuesta: true, modo: 'portada' }));
    };
    el.dataset.montado = '1';
    function limpiarTodo() {
      ctrl.destruido = true;
      if (ctrl.tl) ctrl.tl.kill();
      if (ctrl.zoom && ctrl.zoom.destruir) ctrl.zoom.destruir();
      if (ctrl.tres && ctrl.tres.destruir) ctrl.tres.destruir();
      if (io) io.disconnect();
      if (gs) gs.killTweensOf($$('*', el));
      ctrl.limpiar.forEach(function (f) { try { f(); } catch (e) {} });
      el.classList.remove('mesa-portada', 'mesa-con-zoom', 'mesa-sobria');
      delete el.dataset.montado;
    }
    var inst = {
      destruir: function () { if (ctrl.reemplazo) ctrl.reemplazo.destruir(); else limpiarTodo(); },
      get escena() { return (ctrl.reemplazo || inst)._esc || esc; },
      get zoom() { return ctrl.reemplazo ? ctrl.reemplazo.zoom : ctrl.zoom; },
      get puesta() { return ctrl.puesta; },
      _esc: esc,
      _ctrl: ctrl
    };
    M._ultima = inst;
    return inst;
  }

  M.montar = function (el, op) {
    op = op || {};
    var nodo = typeof el === 'string' ? $(el) : el;
    if (!nodo) return null;
    if (op.modo === 'pie' || nodo.dataset.modulo === 'mesa-pie') return montarPie(nodo, op);
    return montarPortada(nodo, op);
  };
  E['mesa-pie'] = E['mesa-pie'] || {};
  E['mesa-pie'].montar = function (el, op) { return montarPie(typeof el === 'string' ? $(el) : el, op || {}); };
  E.mesaPie = E['mesa-pie'];
  M.version = '2026-10-25';
})();
