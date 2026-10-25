/* Cortina «La placa» (agente Mesa).
   La losa de la entrada ocupa la pantalla. Una luz rasante la barre de izquierda a derecha y saca el relieve
   (~1,2 s); después la losa se parte por la junta ENTRE | MUROS y las dos mitades se abren hacia los lados con
   expo.inOut (~1 s), con paralaje interno (el relieve va un 15 % más rápido que la piedra) y sombra en el canto.
   Sin dependencias: no necesita GSAP ni Lenis (si no llegan, la cortina se abre igual).
   Contrato:
     window.Entremuros.alAbrirse(fn)        fn se llama cuando las losas EMPIEZAN a abrirse (o ya, si ya lo hicieron)
     window.Entremuros.cortina              { estado: 'cerrada' | 'abriendo' | 'fuera', alAbrirse(fn), alRetirarse(fn), retirar() }
     eventos en document: entremuros:cortina-abre, entremuros:cortina-fuera
     y llama a Entremuros.abrir() / Entremuros.retirarCortina() del puente de la web (partes/cabeza.html)
   Se retira SIEMPRE: sin JS (noscript), con movimiento reducido (CSS), con red de seguridad inline y otra aquí.
   Se salta si la página tardó más de 2 s en arrancar. */
(function () {
  'use strict';
  var E = (window.Entremuros = window.Entremuros || {});
  var raiz = document.documentElement;
  var estado = 'cerrada';
  var el = document.getElementById('cortina');
  var reducido = false;
  try { reducido = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  // El puente con la web (partes/cabeza.html) ya define Entremuros.alAbrirse / abrir / retirarCortina. Si no está
  // (la página de pruebas de Mesa), se define aquí lo mismo.
  if (typeof E.alAbrirse !== 'function') {
    var cola = [];
    E.alAbrirse = function (fn) { if (E.abierta) { try { fn(); } catch (er) { console.warn(er); } } else cola.push(fn); };
    E.abrir = function () {
      if (E.abierta) return;
      E.abierta = true;
      cola.splice(0).forEach(function (fn) { try { fn(); } catch (er) { console.warn(er); } });
    };
    E.retirarCortina = function () {
      if (E.cortinaFuera) return;
      E.cortinaFuera = true;
      raiz.classList.add('cortina-fuera');
      E.abrir();
    };
  }
  var salida = [];
  E.cortina = {
    get estado() { return estado; },
    alAbrirse: function (fn) { E.alAbrirse(fn); },
    alRetirarse: function (fn) { if (estado === 'fuera') setTimeout(fn, 0); else salida.push(fn); },
    retirar: function () { retirar(); }
  };

  function avisar(nombre) {
    try { document.dispatchEvent(new CustomEvent(nombre)); } catch (e) {}
  }
  function abre() {
    if (estado !== 'cerrada') return;
    estado = 'abriendo';
    raiz.dataset.cortina = 'abriendo';
    if (el) el.dataset.estado = 'abriendo';
    avisar('entremuros:cortina-abre');
    try { E.abrir(); } catch (e) { console.warn(e); }
  }
  function retirar() {
    if (estado === 'fuera') return;
    if (estado === 'cerrada') abre();
    estado = 'fuera';
    raiz.dataset.cortina = 'fuera';
    raiz.classList.remove('con-cortina');
    raiz.classList.add('cortina-fuera');
    if (el) { el.dataset.estado = 'fuera'; el.hidden = true; }
    try { E.retirarCortina(); } catch (e) { console.warn(e); }
    salida.splice(0).forEach(function (fn) { try { fn(); } catch (er) { console.warn(er); } });
    avisar('entremuros:cortina-fuera');
  }

  if (!el || reducido) { retirar(); return; }
  if (performance.now() > 2000) { retirar(); return; }   // la página llegó tarde: ni un fotograma de cortina
  raiz.classList.add('con-cortina');

  /* ---------- curvas ---------- */
  function expoInOut(t) { return t === 0 ? 0 : t === 1 ? 1 : t < .5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2; }
  function potInOut(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function suave(t) { return t * t * (3 - 2 * t); }

  var izq = el.querySelector('.cortina-izq');
  var der = el.querySelector('.cortina-der');
  var pIzq = izq.querySelectorAll('.cortina-placa');
  var pDer = der.querySelectorAll('.cortina-placa');
  var rIzq = izq.querySelector('.cortina-ras'), riIzq = izq.querySelector('.cortina-ras-in');
  var rDer = der.querySelector('.cortina-ras'), riDer = der.querySelector('.cortina-ras-in');
  var sIzq = izq.querySelector('.cortina-sombra');
  var sDer = der.querySelector('.cortina-sombra');
  var brillo = el.querySelector('.cortina-brillo');
  var cantos = el.querySelectorAll('.cortina-canto');

  var T_LUZ = 1100;        // la luz recorre la losa
  var T_ABRE = 1250;       // empiezan a separarse las losas
  var D_ABRE = 1000;       // duración de la apertura
  var PARALAJE = 0.15;
  var t0 = 0;
  var fin = false;
  var vw = innerWidth;
  var tx = function (e, x) { e.style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,0)'; };

  function fotograma(ahora) {
    if (fin) return;
    var t = ahora - t0;
    // 1) la luz rasante: de -25 vw a 125 vw. Solo transform y opacity: el relieve se destapa deslizando una capa (sin repintar)
    var u = Math.min(1, Math.max(0, t / T_LUZ));
    var luz = -25 + 150 * potInOut(u);
    var frente = luz * vw / 100, medio = vw / 2, pluma = vw * 0.09, ancho = medio + pluma;
    el.style.setProperty('--luz', luz.toFixed(2));
    var li = Math.min(0, Math.max(-ancho, frente - ancho)), ld = Math.min(0, Math.max(-ancho, frente - medio - ancho));
    tx(rIzq, li); tx(riIzq, -li); tx(rDer, ld); tx(riDer, -ld);
    tx(brillo, frente - brillo.offsetWidth / 2);
    brillo.style.opacity = (Math.sin(Math.min(1, u) * Math.PI) * 0.95).toFixed(3);
    // 2) la apertura
    if (t >= T_ABRE) {
      if (estado === 'cerrada') abre();
      var a = Math.min(1, (t - T_ABRE) / D_ABRE);
      var e = expoInOut(a);
      var dist = vw / 2 + Math.max(60, vw * 0.1);
      var d = dist * e;
      tx(izq, -d); tx(der, d);
      // paralaje interno: el relieve se mueve un 15 % más que la losa
      var p = d * PARALAJE;
      pIzq.forEach(function (n) { tx(n, -p); });
      pDer.forEach(function (n) { tx(n, p); });
      cantos[0].style.opacity = cantos[1].style.opacity = Math.min(1, a * 8).toFixed(3);
      var so = Math.sin(Math.min(1, a * 1.15) * Math.PI) * 0.9;
      sIzq.style.opacity = sDer.style.opacity = so.toFixed(3);
      if (a >= 1) { fin = true; retirar(); return; }
    }
    requestAnimationFrame(fotograma);
  }

  function arrancar() {
    if (fin || t0) return;
    t0 = performance.now();
    requestAnimationFrame(fotograma);
  }

  // empieza cuando la placa base está lista para pintarse; si no llega en 1,5 s (red o CPU lentas), no hay cortina
  var base = el.querySelector('.cortina-base');
  var listo = false;
  function go() { if (!listo) { listo = true; arrancar(); } }
  setTimeout(function () { if (!listo) { listo = true; fin = true; retirar(); } }, 1500);
  if (base && base.decode) base.decode().then(go, function () { if (!listo) { listo = true; fin = true; retirar(); } }); else go();

  // red de seguridad propia: pase lo que pase, a los 5 s fuera
  setTimeout(function () { fin = true; retirar(); }, 4200);
  // el resize de la barra del móvil no rehace nada: solo se guarda el ancho para la apertura
  addEventListener('resize', function () { vw = innerWidth; });
})();
