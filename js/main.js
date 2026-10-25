/* ------------------------------------------------------------------
   Casa Entremuros · Cances Grande, Carballo · «La mesa puesta» · lo común de la página
   - Entremuros.fecha(): la fecha de hoy o la de ?fecha=2027-04-20 (para probar «Cada estación, una mesa»).
   - Monta los módulos (mesa, mesa-pie, lugares, obra, faros y reserva) con su respaldo.
     Contrato: window.Entremuros.<mod>.montar(el, { movimiento, densidad: 'mesa'|'sobria', fecha, modo }) → { destruir() }.
   - Las ramas del centro de mesa: Entremuros.mesa.rama(el, { n, dibujar }) al entrar cada sección + evento
     entremuros:rama { n } en document. Al llegar al pie se dibujan las que falten.
   - La cortina es de Mesa; el puente con ella está en partes/cabeza.html
     (Entremuros.abrir, Entremuros.retirarCortina, Entremuros.alAbrirse).
   - El simulador va en js/reserva.js (módulo Reserva): Entremuros.reservar() baja hasta él.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  const raiz = document.documentElement;
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // «con-movimiento» solo sin movimiento reducido: si no, los textos que entran se quedarían escondidos
  const motion = !quieto;
  if (motion) raiz.classList.add('con-movimiento');
  const sobria = () => raiz.classList.contains('densidad-sobria');
  const params = new URLSearchParams(location.search);

  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const E = (window.Entremuros = window.Entremuros || {});
  const anno = $('#anno');
  if (anno) anno.textContent = new Date().getFullYear();

  // el resize de la barra del móvil (mismo ancho, poca altura) no rehace NADA
  let anchoVista = innerWidth, altoVista = innerHeight;
  const esBarra = () => innerWidth === anchoVista && Math.abs(innerHeight - altoVista) < 160;

  /* ============ 1. la fecha ============ */
  // ?fecha=2027-04-20 → ese día a mediodía (hora local); sin parámetro, ahora
  const fechaFija = (() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(params.get('fecha') || '');
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0);
    return isNaN(d) ? null : d;
  })();
  E.fecha = () => (fechaFija ? new Date(fechaFija) : new Date());
  E.densidad = () => (sobria() ? 'sobria' : 'mesa');

  /* ============ 2. entradas con el scroll ============ */
  const rev = $$('.rev');
  if (motion && 'IntersectionObserver' in window) {
    const vistos = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('es-visto'); vistos.unobserve(e.target); }
    }), { rootMargin: '0px 0px -6% 0px' });
    rev.forEach((el) => vistos.observe(el));
  } else rev.forEach((el) => el.classList.add('es-visto'));

  /* ============ 3. Lenis (y el ScrollTrigger de los módulos) ============ */
  const G = window.gsap, ST = window.ScrollTrigger;
  if (G && ST) G.registerPlugin(ST);
  let lenis = null;
  if (typeof Lenis !== 'undefined' && !quieto) {
    lenis = new Lenis({ duration: 1.1, smoothWheel: true, lerp: 0.11 });
    if (G && ST) {
      lenis.on('scroll', ST.update);
      G.ticker.add((t) => lenis.raf(t * 1000));
    } else {
      const bucle = (t) => { lenis.raf(t); requestAnimationFrame(bucle); };
      requestAnimationFrame(bucle);
    }
  }
  const cabAlto = () => parseFloat(getComputedStyle(raiz).getPropertyValue('--cab')) || 72;
  const irA = (sel) => {
    const el = typeof sel === 'string' ? $(sel) : sel;
    if (!el) return;
    const y = el.getBoundingClientRect().top + scrollY - cabAlto() - 8;
    if (lenis) lenis.scrollTo(y, { duration: 1.3 });
    else scrollTo({ top: y, behavior: quieto ? 'auto' : 'smooth' });
  };
  // los módulos llaman aquí para reservar: baja al simulador
  E.reservar = () => irA('#reservar');

  /* ============ 4. módulos: se montan al acercarse; la mesa de la portada, al abrirse la cortina ============ */
  // Si el JS de un módulo falla o no está, se queda el respaldo del HTML. Se guarda el respaldo para
  // volver a montar al cambiar de densidad.
  const montados = new Map();     // el → { inst, respaldo }
  const esperando = new Set();    // cerca de la pantalla, pero su JS aún no ha llegado
  const portadaMesa = $('#portada [data-modulo="mesa"]');
  // «mesa-pie» puede ser Entremuros['mesa-pie'] o Entremuros.mesa con modo:'pie' (se admiten las dos)
  const modulo = (el) => {
    const n = el.dataset.modulo;
    const m = E[n] || (n === 'mesa-pie' ? E.mesa : null);
    return m && typeof m.montar === 'function' ? m : null;
  };
  const opciones = (el) => {
    const nombre = el.dataset.modulo;
    const op = { movimiento: motion, densidad: sobria() ? 'sobria' : 'mesa', fecha: E.fecha() };
    if (nombre === 'mesa') op.modo = 'portada';
    if (nombre === 'mesa-pie') op.modo = 'pie';
    if (nombre === 'reserva') op.fecha = fechaFija || undefined;
    return op;
  };
  function montarModulo(el) {
    if (montados.has(el)) return;
    const mod = modulo(el);
    if (!mod) { esperando.add(el); return; }
    esperando.delete(el);
    const respaldo = el.innerHTML;
    montados.set(el, { inst: null, respaldo });   // reservado ya: no se monta dos veces
    try {
      const inst = mod.montar(el, opciones(el));
      montados.set(el, { inst, respaldo });
      if (el.dataset.modulo === 'mesa-pie') avisarRamasAlPie();
    } catch (er) {
      console.warn('Módulo ' + el.dataset.modulo + ': se queda el respaldo', er);
      el.innerHTML = respaldo;
    }
  }
  const reintentar = () => { if (esperando.size) [...esperando].forEach(montarModulo); };
  addEventListener('load', () => { reintentar(); envolverRama(); });
  document.addEventListener('entremuros:listo', () => { reintentar(); envolverRama(); });
  function remontarTodos() {
    // sobre una copia: montar otra vez mete la entrada de nuevo en el Map
    [...montados].forEach(([el, { inst, respaldo }]) => {
      try { inst && inst.destruir && inst.destruir(); } catch (er) { console.warn(er); }
      el.innerHTML = respaldo;
      delete el.dataset.montado;
      montados.delete(el);
      montarModulo(el);
    });
    if (ST) ST.refresh();
  }
  if ('IntersectionObserver' in window) {
    const ioMod = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { ioMod.unobserve(e.target); montarModulo(e.target); }
    }), { rootMargin: '900px 0px' });
    $$('[data-modulo]').forEach((el) => { if (el !== portadaMesa) ioMod.observe(el); });
  } else $$('[data-modulo]').forEach((el) => { if (el !== portadaMesa) montarModulo(el); });
  // con la mesa montada, la portada deja de ser el respaldo (.con-mesa): la pieza ocupa la pantalla y el titular va encima
  if (portadaMesa && 'MutationObserver' in window) {
    const sec = $('#portada');
    const mirar = () => sec.classList.toggle('con-mesa', portadaMesa.dataset.montado === '1');
    new MutationObserver(mirar).observe(portadaMesa, { attributes: true, attributeFilter: ['data-montado'] });
  }

  /* ============ 5. las ramas del centro de mesa ============ */
  // Entremuros.mesa.rama(el, { n, dibujar }) dibuja la rama n; la web la llama al entrar cada sección (1: la casa,
  // 2: seis lugares, 3: dentro y fuera, 4: antes y después, 5: reservar) y lanza entremuros:rama { n } en document.
  // Al llegar al pie se dibujan las que falten (alLlegar: true). En la sobria, las cinco, ya dibujadas.
  const hechas = new Set();
  E.ramasDibujadas = () => [...hechas];
  let ramaEnvuelta = false;
  function avisarRama(n, alLlegar) {
    const nueva = !hechas.has(n);
    hechas.add(n);
    if (nueva || alLlegar) document.dispatchEvent(new CustomEvent('entremuros:rama', { detail: { n, alLlegar: !!alLlegar } }));
  }
  // los módulos (Reserva dibuja la 5 al final) también pueden llamar a mesa.rama: se avisa igual
  function envolverRama() {
    const m = E.mesa;
    if (ramaEnvuelta || !m || typeof m.rama !== 'function' || m.rama.__web) return;
    const orig = m.rama;
    m.rama = function (el, op) {
      const r = orig.apply(this, arguments);
      const n = (op && +op.n) || (el && el.dataset ? +el.dataset.rama : 0);
      if (n) avisarRama(n);
      return r;
    };
    m.rama.__web = true;
    ramaEnvuelta = true;
  }
  function dibujarRama(el, { animar = motion && !sobria(), alLlegar = false } = {}) {
    const n = +el.dataset.rama;
    if (!n || el.dataset.dibujada === '1') return;
    el.dataset.dibujada = '1';
    envolverRama();
    if (E.mesa && typeof E.mesa.rama === 'function') {
      try { E.mesa.rama(el, { n, dibujar: animar, movimiento: animar }); if (hechas.has(n)) { if (alLlegar) avisarRama(n, true); return; } } catch (er) { console.warn(er); }
    }
    avisarRama(n, alLlegar);
  }
  const ramas = $$('[data-rama]');
  let ioRama = null;
  function observarRamas() {
    if (!('IntersectionObserver' in window)) return;
    if (ioRama) ioRama.disconnect();
    ioRama = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      ioRama.unobserve(e.target);
      dibujarRama(e.target);
    }), { rootMargin: '-8% 0px -20% 0px' });
    ramas.forEach((el) => ioRama.observe(el));
  }
  // si el lector llega al pie sin haber pasado por alguna sección, esa rama se dibuja al llegar
  function avisarRamasAlPie() { [1, 2, 3, 4, 5].forEach((n) => { if (hechas.has(n) || llegoAlPie) avisarRama(n, true); }); }
  let llegoAlPie = false;
  const pie = $('#pie');
  if (pie && 'IntersectionObserver' in window) {
    const ioPie = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      ioPie.disconnect();
      llegoAlPie = true;
      ramas.forEach((el) => dibujarRama(el, { animar: false, alLlegar: true }));
      [1, 2, 3, 4, 5].forEach((n) => { if (!hechas.has(n)) avisarRama(n, true); });
    }), { threshold: 0.15 });
    ioPie.observe(pie);
  }
  function dibujarTodasLasRamas() { ramas.forEach((el) => dibujarRama(el, { animar: false })); [1, 2, 3, 4, 5].forEach((n) => { if (!hechas.has(n)) avisarRama(n, true); }); }
  function reiniciarRamas() {
    ramas.forEach((el) => { el.innerHTML = ''; delete el.dataset.dibujada; });
    hechas.clear();
    llegoAlPie = false;
    observarRamas();
  }
  observarRamas();

  /* ============ 6. la cortina (de Mesa): alAbrirse() y su retirada ============ */
  const cortina = $('#cortina');
  E.alAbrirse(() => {
    $('#portada').classList.add('abierta');
    if (portadaMesa) montarModulo(portadaMesa);
  });
  let fuera = false;
  function alSalir() {
    if (fuera) return;
    fuera = true;
    if (cortina && !cortina.hidden && getComputedStyle(cortina).display !== 'none') cortina.hidden = true;
    if (lenis) lenis.start();
    if (G) G.ticker.lagSmoothing(0);      // al retirar la cortina, nunca antes
    if (ST) ST.refresh();
    mostrarCookies();
  }
  document.addEventListener('entremuros:fuera', alSalir);
  const retirarCortina = () => { E.retirarCortina(); alSalir(); };
  if (E.cortinaFuera) setTimeout(alSalir, 0);
  // si la cortina se esconde o desaparece por su cuenta, también cuenta como retirada
  if (cortina && 'MutationObserver' in window) {
    const mo = new MutationObserver(() => {
      if (!document.contains(cortina) || cortina.hidden || cortina.dataset.estado === 'fuera') { mo.disconnect(); retirarCortina(); }
    });
    mo.observe(document.body, { childList: true });
    mo.observe(cortina, { attributes: true, attributeFilter: ['hidden', 'data-estado'] });
  }

  /* ============ 7. cabecera, menú y anclas ============ */
  const cab = $('#cab');
  const btnMenu = $('#menu-btn'), menu = $('#menu-movil');
  const cerrarMenu = () => {
    document.body.classList.remove('menu');
    btnMenu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
    if (lenis) lenis.start();
  };
  btnMenu.addEventListener('click', () => {
    const abierto = document.body.classList.toggle('menu');
    btnMenu.setAttribute('aria-expanded', String(abierto));
    menu.setAttribute('aria-hidden', String(!abierto));
    if (lenis) abierto ? lenis.stop() : lenis.start();
  });
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const destino = a.getAttribute('href');
    if (destino.length < 2 || !$(destino)) return;
    e.preventDefault();
    cerrarMenu();
    irA(destino);
    setTimeout(() => {
      const t = $(destino);
      if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
      t.focus({ preventScroll: true });
    }, 1000);
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('menu')) { cerrarMenu(); btnMenu.focus(); } });

  /* ============ 8. cookies (y el mando se aparta mientras están) ============ */
  const ck = $('#cookies');
  const LLAVE = 'entremuros-cookies';
  const leer = () => { try { return localStorage.getItem(LLAVE); } catch (e) { return null; } };
  const guardar = (v) => { try { localStorage.setItem(LLAVE, v); } catch (e) {} };
  const mando = $('#mando');
  const verMando = () => { if (mando && raiz.classList.contains('revision')) mando.hidden = !ck.hidden; };
  let cookiesPendientes = !leer();
  function mostrarCookies() {
    if (!cookiesPendientes) { verMando(); return; }
    cookiesPendientes = false;
    ck.hidden = false;
    verMando();
  }
  const cerrarCk = (v) => { guardar(v); ck.hidden = true; verMando(); };
  $('#ck-si').addEventListener('click', () => cerrarCk('si'));
  $('#ck-no').addEventListener('click', () => cerrarCk('no'));
  $('#abrir-cookies').addEventListener('click', () => { ck.hidden = false; verMando(); $('#ck-si').focus(); });

  // si la cortina expone su propio objeto (Entremuros.cortina), se engancha a él (también después de las cookies: alRetirarse puede llegar ya)
  if (E.cortina && typeof E.cortina.alAbrirse === 'function') E.cortina.alAbrirse(() => E.abrir());
  if (E.cortina && typeof E.cortina.alRetirarse === 'function') E.cortina.alRetirarse(() => retirarCortina());
  // sin cortina (o con movimiento reducido): fuera ya. Va aquí, después de las cookies, que alSalir() usa.
  if (!cortina || !motion) retirarCortina();
  // red de seguridad propia por si la cortina se atasca
  setTimeout(retirarCortina, 7000);

  /* ============ 9. mapa de Google solo al pedirlo ============ */
  const btnMapa = $('#mapa-btn');
  if (btnMapa) btnMapa.addEventListener('click', () => {
    const marco = document.createElement('iframe');
    marco.src = 'https://www.google.com/maps?q=' + encodeURIComponent('Casa Entremuros, Cances Grande 77, 15107 Carballo') + '&z=15&output=embed';
    marco.loading = 'lazy';
    marco.title = 'Mapa con la Casa Entremuros en Cances Grande, Carballo';
    marco.referrerPolicy = 'no-referrer-when-downgrade';
    $('#mapa').appendChild(marco);
    $('#mapa-consent').remove();
  });

  /* ============ 10. visor de fotos: se abre por el NOMBRE de la foto ============ */
  const visor = $('#visor');
  const vImg = $('#visor-img'), vPie = $('#visor-pie'), vN = $('#visor-n');
  // la serie se hace de la MISMA lista de miniaturas, sin repetir nombres
  function serie() {
    const vistas = new Map();
    $$('[data-visor]').forEach((b) => {
      const n = b.dataset.visor;
      if (vistas.has(n)) return;
      const img = b.querySelector('img');
      if (!img) return;
      const anchos = (img.getAttribute('srcset') || '').split(',').map((x) => parseInt(x.trim().split(/\s+/)[1], 10)).filter(Boolean).sort((a, z) => a - z);
      const pie = b.closest('figure, article, li')?.querySelector('figcaption, h3');
      vistas.set(n, { n, alt: img.alt, pie: pie ? pie.textContent.replace(/\s+/g, ' ').trim() : img.alt, anchos: anchos.length ? anchos : [800], ancho: +img.getAttribute('width') || 1024, alto: +img.getAttribute('height') || 768 });
    });
    return [...vistas.values()];
  }
  let lista = [], actual = 0, origen = null;
  function poner(i) {
    actual = (i + lista.length) % lista.length;
    const f = lista[actual];
    const peq = f.anchos.includes(800) ? 800 : f.anchos[0], gran = f.anchos[f.anchos.length - 1];
    // primero la de 800 (o la menor, ya en caché), y la grande al cargar
    vImg.src = `img/fotos/${f.n}-${peq}.jpg`;
    vImg.dataset.nombre = f.n;
    vImg.alt = f.alt;
    vImg.width = f.ancho; vImg.height = f.alto;
    vImg.style.setProperty('--nat', f.ancho + 'px');
    if (gran !== peq) {
      const grande = new Image();
      grande.onload = () => { if (vImg.dataset.nombre === f.n) vImg.src = grande.src; };
      grande.src = `img/fotos/${f.n}-${gran}.jpg`;
    }
    vPie.textContent = f.pie;
    vN.textContent = (actual + 1) + ' / ' + lista.length;
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-visor]');
    if (!b || !visor || typeof visor.showModal !== 'function') return;
    lista = serie();
    const i = lista.findIndex((f) => f.n === b.dataset.visor);
    if (i < 0) return;
    origen = b;
    poner(i);
    visor.showModal();
    if (lenis) lenis.stop();
  });
  if (visor) {
    $('#visor-ant').addEventListener('click', () => poner(actual - 1));
    $('#visor-sig').addEventListener('click', () => poner(actual + 1));
    $('#visor-cerrar').addEventListener('click', () => visor.close());
    visor.addEventListener('click', (e) => { if (e.target === visor || e.target.classList.contains('visor__fig')) visor.close(); });
    visor.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') poner(actual - 1); else if (e.key === 'ArrowRight') poner(actual + 1); });
    visor.addEventListener('close', () => { if (lenis) lenis.start(); if (origen) origen.focus({ preventScroll: true }); });
  }

  /* ============ 11. cada estación, una mesa: empieza por la de ahora (o la de ?fecha=) ============ */
  (function estaciones() {
    const fila = $('#estaciones-fila');
    if (!fila) return;
    const d = E.fecha(), m = d.getMonth() + 1, dia = d.getDate();
    const ahora = (m === 3 && dia >= 20) || m === 4 || m === 5 || (m === 6 && dia < 21) ? 'primavera'
      : (m === 6 && dia >= 21) || m === 7 || m === 8 || (m === 9 && dia < 22) ? 'verano'
        : (m === 9 && dia >= 22) || m === 10 || m === 11 || (m === 12 && dia < 21) ? 'otono' : 'invierno';
    const orden = ['primavera', 'verano', 'otono', 'invierno'];
    const desde = orden.indexOf(ahora);
    const items = orden.map((k) => $(`[data-estacion="${k}"]`, fila));
    for (let i = 0; i < 4; i++) fila.appendChild(items[(desde + i) % 4]);
    items[desde].classList.add('es-ahora');
    fila.dataset.ahora = ahora;
  })();

  /* ============ 12. el foco del teclado: contorno de 2 px y una ramita junto al elemento ============ */
  const focoRama = $('#foco-rama');
  let enfocado = null;
  function ponerRama() {
    if (!focoRama) return;
    const el = enfocado;
    if (!el || !document.contains(el) || el.closest('dialog')) { focoRama.classList.remove('es-visible'); return; }
    const r = el.getBoundingClientRect();
    if (!r.width) { focoRama.classList.remove('es-visible'); return; }
    // fija en la ventana (position:fixed): a la izquierda del elemento, señalándolo; si no cabe, justo debajo
    const w = 38, h = 23;
    let x = r.left - w - 6, y = r.top + r.height / 2 - h / 2;
    if (x < 3) { x = Math.max(3, r.left); y = r.bottom + 5; }
    focoRama.style.transform = 'translate(' + Math.round(x) + 'px, ' + Math.round(y) + 'px)';
    // el dibujo de Mesa, si lo ofrece, sustituye al de respaldo (una sola vez)
    if (!focoRama.firstChild && E.mesa && typeof E.mesa.focoRama === 'function' && !focoRama.__probado) {
      focoRama.__probado = true;
      try { E.mesa.focoRama(focoRama); } catch (er) { console.warn(er); }
    }
    focoRama.classList.add('es-visible');
  }
  // :focus-visible se decide al terminar de moverse el foco: se mira un instante después
  let tFoco = 0;
  const mirarFoco = () => {
    clearTimeout(tFoco);
    tFoco = setTimeout(() => {
      const el = document.activeElement;
      let visible = false;
      try { visible = !!el && el !== document.body && el.matches(':focus-visible'); } catch (er) {}
      enfocado = visible ? el : null;
      ponerRama();
    }, 0);
  };
  document.addEventListener('focusin', mirarFoco);
  document.addEventListener('focusout', mirarFoco);

  /* ============ 13. con el scroll: cabecera y módulos que esperan ============ */
  let pend = 0;
  function alScroll() {
    pend = 0;
    cab.classList.toggle('sc', scrollY > 24);
    reintentar();
    if (enfocado) ponerRama();
  }
  addEventListener('scroll', () => { if (!pend) pend = requestAnimationFrame(alScroll); }, { passive: true });
  alScroll();

  /* ============ 14. MANDO DE MAQUETA (no viaja al cliente) ============ */
  if (mando && raiz.classList.contains('revision')) {
    const botones = $$('button[data-densidad]', mando);
    const pintarMando = () => botones.forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.densidad === 'sobria') === sobria())));
    botones.forEach((b) => b.addEventListener('click', () => {
      const antes = sobria();
      raiz.classList.toggle('densidad-sobria', b.dataset.densidad === 'sobria');
      const u = new URL(location.href);
      if (b.dataset.densidad === 'sobria') u.searchParams.set('densidad', 'sobria'); else u.searchParams.delete('densidad');
      history.replaceState(null, '', u);
      pintarMando();
      if (antes === sobria()) return;
      reiniciarRamas();
      remontarTodos();
      if (sobria()) dibujarTodasLasRamas();
      document.dispatchEvent(new CustomEvent('entremuros:densidad', { detail: sobria() ? 'sobria' : 'mesa' }));
    }));
    pintarMando();
    verMando();
  }
  /* fin del MANDO DE MAQUETA */
  // la sobria: las cinco ramas ya dibujadas desde el principio
  if (sobria()) dibujarTodasLasRamas();

  /* ============ 15. resize de verdad (no el de la barra del móvil) ============ */
  let tRes = 0;
  addEventListener('resize', () => {
    if (esBarra()) return;
    clearTimeout(tRes);
    tRes = setTimeout(() => {
      anchoVista = innerWidth; altoVista = innerHeight;
      document.dispatchEvent(new CustomEvent('entremuros:resize'));
      ponerRama();
    }, 200);
  });

  // lo que pueden usar los módulos y las pruebas
  E.web = {
    motion, quieto, sobria, lenis, irA, montados, params,
    alAbrirse: E.alAbrirse, abrir: E.abrir, retirarCortina,
    get fuera() { return fuera; }, get altoVista() { return altoVista; },
  };
  document.dispatchEvent(new CustomEvent('entremuros:web'));
})();
