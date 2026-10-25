/* ------------------------------------------------------------------
   Casa Entremuros · reserva.js · «La mesa para…»
   Simulador de reservas de DEMOSTRACIÓN para una casa entera (motor de
   a-casa-da-tulla-gomesende-web llevado a esta casa). Pasos:
   fechas → cuántos sois → nombre → tu mesa (tarjeta, resumen, localizador y .ics).
   NO envía, NO guarda y NO cobra nada: no hay ni una petición de red, ni
   localStorage. El nombre no sale del navegador.

   Contrato (ENCARGO.md):
     window.Entremuros.reserva.montar(el, opciones)
     opciones = { movimiento: bool, densidad: 'mesa'|'sobria', fecha?: Date|'AAAA-MM-DD' }
   Pone el.dataset.montado = '1' y devuelve { destruir() }. El HTML previo de `el`
   (el respaldo que escribe la web) se queda si el JS falla y se restituye en destruir().

   La mesa larga pone un cubierto por persona (adultos + niños): cabeceras primero,
   luego los lados, alternos. Usa Entremuros.mesa.cubierto(el, {girado, animar}) y
   Entremuros.mesa.tarjeta(el, nombre, {animar}) si existen (los hace el agente Mesa);
   si no, una versión simple con los mismos tokens.

   SUPUESTOS (todos en TARIFAS, más abajo; también en el README y en PENDIENTES.md):
   precios y temporadas de la web antigua (captura 2026-07-12), «por noche» y
   «mínimo 2 noches» supuestos, Navidad del 24-dic al 6-ene, puentes de España y
   Galicia, camas supletorias a 20 € por cama y noche, 10 € por mascota y noche,
   bebés (cuna gratis) fuera de la cuenta de plazas, noches ocupadas de ejemplo.
   Al conectar el motor real, solo cambian ocupada() y confirmar().
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  const E = (window.Entremuros = window.Entremuros || {});

  /* ================= la casa y sus tarifas (SUPUESTO) ================= */
  const CASA = {
    nombre: 'Casa Entremuros',
    telefono: '627 777 074', // WEB, IG, PG (DATOS)
    direccion: 'Cances Grande, 77, 15107 Carballo, A Coruña',
    entrada: '15:00', salida: '11:00' // «entrada desde las 15:00; salida antes de las 11:00» (WEB)
  };

  // UN SOLO SITIO para precios y reglas. Todo lo de aquí es SUPUESTO hasta que lo confirme la casa.
  const TARIFAS = {
    altaJulio: 430, altaAgosto: 450,   // € por noche, casa completa, IVA incluido (WEB «Tarifas», 2026-07-12)
    altaEspecial: 400,                 // Semana Santa y puentes (WEB); Navidad: mismo precio, SUPUESTO
    baja8: 290, baja12: 340,           // temporada baja: hasta 8 personas / hasta 12 (WEB)
    bajaHasta: 8,
    plazas: 12,                        // plazas de la casa (SR «1 a 12», tarifa máxima de WEB)
    maxConSupletorias: 16,             // bio de IG «16 personas»; POR CONFIRMAR
    supletoria: 20,                    // € por cama supletoria (WEB); SUPUESTO que sea por cama y noche
    supletoriaPor: 'noche',            // 'noche' | 'estancia' (si la casa dice que es por estancia, se cambia aquí)
    mascota: 10, maxMascotas: 2,       // 10 € (WEB «Tarifas»; la portada decía 8); SUPUESTO por mascota y noche; POR CONFIRMAR
    bebesMax: 3,                       // cuna gratis hasta 3 años (WEB); cuántas cunas hay: POR CONFIRMAR
    fianza: 200,                       // se devuelve a las 72 h (WEB): se informa, no se cobra
    senal: 0.30,                       // «30 % por transferencia» (WEB): se informa, no se cobra
    minNoches: 2,                      // SUPUESTO; una noche «con coste adicional, consultar» (WEB)
    ventanaMeses: 12,
    // Temporada (SUPUESTO): julio y agosto por noche; Semana Santa = noches desde el Domingo de Ramos
    // (Pascua −7) hasta la del domingo de Pascua; Navidad = noches del 24-dic al 5-ene (salida el 6)
    semanaSanta: [-7, 0],
    navidad: ['12-24', '01-05'],
    // Festivos nacionales + Viernes Santo + los de Galicia (17-may, 25-jul, Jueves Santo): SUPUESTO
    festivosFijos: ['01-01', '01-06', '05-01', '05-17', '07-25', '08-15', '10-12', '11-01', '12-06', '12-08', '12-25'],
    festivosPascua: [-3, -2], // Jueves Santo y Viernes Santo
    // noches de puente según el día de la semana del festivo (0 = el propio día; negativo = antes). SUPUESTO
    puenteNoches: { 1: [-3, -1], 2: [-4, -1], 3: [-1, 0], 4: [-1, 2], 5: [-1, 1] }
  };
  const TIPOS = {
    julio: 'julio', agosto: 'agosto', 'semana-santa': 'Semana Santa', navidad: 'Navidad', puente: 'puente', baja: 'temporada baja'
  };

  /* ================= fechas ================= */
  const pad = (n) => String(n).padStart(2, '0');
  const clave = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const deClave = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const mas = (k, n) => { const d = deClave(k); d.setDate(d.getDate() + n); return clave(d); };
  const entre = (a, b) => Math.round((deClave(b) - deClave(a)) / 864e5);
  const fLarga = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const fCorta = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  const fDiaMes = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' });
  const fEur = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const larga = (k) => fLarga.format(deClave(k));
  const corta = (k) => fCorta.format(deClave(k));
  const diaMes = (k) => fDiaMes.format(deClave(k));
  const eur = (n) => fEur.format(Math.round(n * 100) / 100) + '\u00a0€';
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

  // Domingo de Pascua (algoritmo anónimo gregoriano)
  function pascua(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
    return clave(new Date(y, mes - 1, dia));
  }

  /* ================= temporadas y precio ================= */
  const cacheFest = new Map(), cachePuente = new Map();
  function festivosDe(y) {
    if (cacheFest.has(y)) return cacheFest.get(y);
    const p = pascua(y);
    const s = new Set(TARIFAS.festivosFijos.map((md) => `${y}-${md}`));
    TARIFAS.festivosPascua.forEach((n) => s.add(mas(p, n)));
    cacheFest.set(y, s);
    return s;
  }
  function puentesDe(y) { // noches de puente generadas por los festivos de ese año (pueden caer en el año vecino)
    if (cachePuente.has(y)) return cachePuente.get(y);
    const s = new Set();
    festivosDe(y).forEach((f) => {
      const r = TARIFAS.puenteNoches[deClave(f).getDay()];
      if (r) for (let n = r[0]; n <= r[1]; n++) s.add(mas(f, n));
    });
    cachePuente.set(y, s);
    return s;
  }
  // tipo de una NOCHE (la que empieza el día k)
  function tipoNoche(k) {
    const y = +k.slice(0, 4), md = k.slice(5);
    if (md >= '07-01' && md <= '07-31') return 'julio';
    if (md >= '08-01' && md <= '08-31') return 'agosto';
    const p = pascua(y);
    if (k >= mas(p, TARIFAS.semanaSanta[0]) && k <= mas(p, TARIFAS.semanaSanta[1])) return 'semana-santa';
    if (md >= TARIFAS.navidad[0] || md <= TARIFAS.navidad[1]) return 'navidad';
    if (puentesDe(y - 1).has(k) || puentesDe(y).has(k) || puentesDe(y + 1).has(k)) return 'puente';
    return 'baja';
  }
  const esAlta = (k) => tipoNoche(k) !== 'baja';
  function tarifaNoche(tipo, pers) {
    if (tipo === 'julio') return TARIFAS.altaJulio;
    if (tipo === 'agosto') return TARIFAS.altaAgosto;
    if (tipo !== 'baja') return TARIFAS.altaEspecial;
    return pers <= TARIFAS.bajaHasta ? TARIFAS.baja8 : TARIFAS.baja12;
  }
  function precio(d) {
    const ad = Math.max(0, d.adultos == null ? 1 : d.adultos), ni = Math.max(0, d.ninos || 0), masc = Math.max(0, d.mascotas || 0);
    const pers = ad + ni;
    const noches = [];
    if (d.ini && d.fin) for (let k = d.ini; k < d.fin; k = mas(k, 1)) noches.push(k);
    const grupos = new Map();
    let hospedaje = 0, alta = 0;
    noches.forEach((k) => {
      const tipo = tipoNoche(k), p = tarifaNoche(tipo, pers), g = tipo + '|' + p;
      hospedaje += p;
      if (tipo !== 'baja') alta++;
      if (!grupos.has(g)) grupos.set(g, { tipo, precio: p, n: 0 });
      grupos.get(g).n++;
    });
    const supletorias = Math.max(0, pers - TARIFAS.plazas);
    const suplTotal = supletorias * TARIFAS.supletoria * (TARIFAS.supletoriaPor === 'noche' ? noches.length : (noches.length ? 1 : 0));
    const mascTotal = masc * TARIFAS.mascota * noches.length;
    const total = hospedaje + suplTotal + mascTotal;
    return {
      n: noches.length, alta, baja: noches.length - alta, personas: pers, supletorias, mascotas: masc,
      grupos: [...grupos.values()], hospedaje, suplTotal, mascTotal, total,
      senal: Math.round(total * TARIFAS.senal * 100) / 100, fianza: TARIFAS.fianza
    };
  }

  /* ================= noches ocupadas de ejemplo (siempre las mismas) ================= */
  function azar(s) { return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const cacheOcup = new Map();
  function ocupadasDe(y) {
    if (cacheOcup.has(y)) return cacheOcup.get(y);
    const set = new Set(), r = azar(y * 2010 + 7);
    const tomar = (a, n) => { for (let i = 0; i < n; i++) set.add(mas(a, i)); };
    for (let k = `${y}-01-01`; k <= `${y}-12-31`; k = mas(k, 1)) {
      if (deClave(k).getDay() === 5) { const v = r(); if (v < 0.42) tomar(k, 2); else if (v < 0.5) tomar(k, 3); }
    }
    if (r() < 0.9) tomar(mas(pascua(y), -4), 4);
    let k = `${y}-07-01`;
    while (k < `${y}-09-01`) { const n = 3 + Math.floor(r() * 5); if (r() < 0.82) tomar(k, n); k = mas(k, n + (r() < 0.4 ? 1 : 0)); }
    [[`${y}-12-26`, 4], [`${y}-12-30`, 3], [`${y}-12-24`, 2]].forEach(([a, n]) => { if (r() < 0.7) tomar(a, n); });
    festivosDe(y).forEach((f) => { const rg = TARIFAS.puenteNoches[deClave(f).getDay()]; if (rg && r() < 0.55) tomar(mas(f, rg[0]), rg[1] - rg[0] + 1); });
    for (let i = 0; i < 9; i++) tomar(`${y}-${pad(1 + Math.floor(r() * 12))}-${pad(1 + Math.floor(r() * 26))}`, 2 + Math.floor(r() * 2));
    cacheOcup.set(y, set);
    return set;
  }
  const ocupada = (k) => ocupadasDe(+k.slice(0, 4)).has(k);
  const libreEntre = (a, b) => { for (let k = a; k < b; k = mas(k, 1)) if (ocupada(k)) return false; return true; };

  /* ================= localizador y .ics ================= */
  function hash(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
  function localizador(ini, fin, pers, nombre) { // ENT-AAMMDD-NNN (de la llegada)
    return 'ENT-' + ini.slice(2).replace(/-/g, '') + '-' + String(hash(`${ini}|${fin}|${pers}|${String(nombre).toLowerCase()}`) % 1000).padStart(3, '0');
  }
  function plegar(linea) { // líneas de ≤ 75 octetos, con CRLF + espacio (RFC 5545)
    const enc = new TextEncoder(), partes = [];
    let actual = '', bytes = 0, limite = 75;
    for (const ch of linea) {
      const b = enc.encode(ch).length;
      if (bytes + b > limite) { partes.push(actual); actual = ' '; bytes = 1; limite = 75; }
      actual += ch; bytes += b;
    }
    partes.push(actual);
    return partes.join('\r\n');
  }
  function crearICS(d) {
    const t = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const f = (k, h) => k.replace(/-/g, '') + 'T' + h.replace(':', '') + '00';
    const ahora = new Date();
    const sello = `${ahora.getUTCFullYear()}${pad(ahora.getUTCMonth() + 1)}${pad(ahora.getUTCDate())}T${pad(ahora.getUTCHours())}${pad(ahora.getUTCMinutes())}${pad(ahora.getUTCSeconds())}Z`;
    const lineas = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Casa Entremuros//Demostracion de reserva//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${d.loc}@demostracion.invalid`,
      `DTSTAMP:${sello}`,
      `DTSTART:${f(d.ini, CASA.entrada)}`,
      `DTEND:${f(d.fin, CASA.salida)}`,
      `SUMMARY:${t('Casa Entremuros (reserva de demostración)')}`,
      `LOCATION:${t(CASA.nombre + ', ' + CASA.direccion)}`,
      `DESCRIPTION:${t(`Reserva de DEMOSTRACIÓN: no existe en ningún sitio. Localizador ${d.loc}. ${plural(d.n, 'noche', 'noches')} · ${plural(d.personas, 'persona', 'personas')}. Entrada desde las ${CASA.entrada}, salida antes de las ${CASA.salida}. Teléfono de la casa: ${CASA.telefono}.`)}`,
      'STATUS:TENTATIVE', 'TRANSP:OPAQUE',
      'END:VEVENT', 'END:VCALENDAR'
    ];
    return lineas.map(plegar).join('\r\n') + '\r\n';
  }

  /* ================= dibujos propios (si Mesa no los da) ================= */
  const CUBIERTO_SVG = `<svg viewBox="0 0 100 100" focusable="false" aria-hidden="true">
    <ellipse class="c-sombra" cx="52" cy="55" rx="40" ry="38"/>
    <circle class="c-esparto" cx="50" cy="50" r="38"/>
    <circle class="c-esparto-ln" cx="50" cy="50" r="33"/><circle class="c-esparto-ln" cx="50" cy="50" r="28"/>
    <circle class="c-bajoplato" cx="50" cy="50" r="27"/>
    <circle class="c-plato" cx="50" cy="50" r="22"/>
    <circle class="c-perlas" cx="50" cy="50" r="19.5"/>
    <circle class="c-hondo" cx="50" cy="50" r="15"/>
    <path class="c-hoja" d="M45 52c3-7 10-9 14-8-1 6-6 10-14 8z"/><circle class="c-baya" cx="57" cy="55" r="1.8"/>
    <g class="c-servilleta"><rect x="5" y="30" width="15" height="40" rx="2"/><path d="M5 42h15M5 58h15"/></g>
    <g class="c-cubierto"><path d="M13 33v14M16 33v14M10 33v14M10 47c0 3 6 3 6 0M13 47v24"/></g>
    <g class="c-cubierto"><path d="M86 38c4 2 4 18 0 26M86 38v36"/></g>
    <g class="c-copa"><circle cx="82" cy="20" r="7.5"/><circle cx="82" cy="20" r="4.6"/></g>
    <g class="c-vaso"><circle cx="66" cy="11" r="6"/><circle cx="66" cy="11" r="3.8"/></g>
  </svg>`;
  const RAMO_SVG = `<svg viewBox="0 0 100 60" focusable="false" aria-hidden="true">
    <path class="r-tallo" d="M6 32c22-6 44-6 88 0"/>
    <g class="r-hojas">
      <path d="M18 31c-3-10 1-17 8-20 2 9-1 16-8 20z"/><path d="M18 33c-3 10 1 17 8 20 2-9-1-16-8-20z"/>
      <path d="M38 31c-3-11 2-19 9-22 2 10-2 18-9 22z"/><path d="M38 33c-3 11 2 19 9 22 2-10-2-18-9-22z"/>
      <path d="M60 31c-3-11 2-19 9-22 2 10-2 18-9 22z"/><path d="M60 33c-3 11 2 19 9 22 2-10-2-18-9-22z"/>
      <path d="M80 31c-3-9 1-15 7-18 2 8-1 14-7 18z"/><path d="M80 33c-3 9 1 15 7 18 2-8-1-14-7-18z"/>
    </g>
    <g class="r-flor"><circle cx="50" cy="29" r="3.2"/><circle cx="29" cy="30" r="2.4"/><circle cx="71" cy="30" r="2.4"/></g>
  </svg>`;
  const VELA_SVG = '<svg viewBox="0 0 40 40" focusable="false" aria-hidden="true"><circle class="v-halo" cx="20" cy="20" r="19"/><circle class="v-cera" cx="20" cy="20" r="9"/><circle class="v-llama" cx="20" cy="20" r="3.2"/></svg>';
  const CUENCO_SVG = '<svg viewBox="0 0 40 40" focusable="false" aria-hidden="true"><ellipse class="q-sombra" cx="22" cy="23" rx="16" ry="15"/><circle class="q-borde" cx="20" cy="20" r="16"/><circle class="q-fondo" cx="20" cy="20" r="11.5"/><g class="q-pienso"><circle cx="16" cy="18" r="2"/><circle cx="22" cy="16" r="2"/><circle cx="24" cy="22" r="2"/><circle cx="17" cy="24" r="2"/><circle cx="20" cy="20" r="2"/></g></svg>';
  const CUNA_SVG = '<svg viewBox="0 0 60 40" focusable="false" aria-hidden="true"><ellipse class="q-sombra" cx="32" cy="23" rx="26" ry="15"/><rect class="u-cesta" x="4" y="6" width="52" height="28" rx="13"/><rect class="u-colchon" x="10" y="11" width="40" height="18" rx="8"/><rect class="u-almohada" x="12" y="13" width="13" height="14" rx="5"/></svg>';
  const SILLA_HTML = '<span class="rs__silla"><i></i></span>';
  const VASITO_SVG = '<svg viewBox="0 0 20 20" focusable="false" aria-hidden="true"><circle class="n-vaso" cx="10" cy="10" r="8"/><circle class="n-vaso-in" cx="10" cy="10" r="5.2"/></svg>';
  const RAMITA_SVG = `<svg class="rs__ramita" viewBox="0 0 70 40" focusable="false" aria-hidden="true">
    <path class="t-tallo" pathLength="1" d="M4 34C20 30 40 22 66 6"/>
    <g class="t-hojas"><path d="M16 31c-2-7 0-12 5-14 1 6 0 11-5 14z"/><path d="M26 28c1 7 5 10 11 10-1-6-5-10-11-10z"/><path d="M34 22c-2-7 0-12 5-14 1 6 0 11-5 14z"/><path d="M46 17c1 6 5 9 11 9-1-6-5-9-11-9z"/><path d="M55 11c-1-5 1-8 5-9 1 5-1 8-5 9z"/></g>
  </svg>`;

  /* integración con Mesa (si existe) o versión propia */
  function dibujaCubierto(cont, opts) {
    const M = E.mesa;
    if (M && typeof M.cubierto === 'function') {
      try { M.cubierto(cont, opts); if (cont.childElementCount) { cont.dataset.origen = 'mesa'; return 'mesa'; } } catch (e) { /* queda el propio */ }
      cont.textContent = '';
    }
    cont.innerHTML = CUBIERTO_SVG; cont.dataset.origen = 'propio';
    return 'propio';
  }
  function dibujaTarjeta(cont, nombre, opts) {
    const M = E.mesa, animar = !!(opts && opts.animar);
    cont.textContent = '';
    if (nombre && M && typeof M.tarjeta === 'function') {
      try { M.tarjeta(cont, nombre, { animar }); if (cont.childElementCount || cont.textContent.trim()) { cont.dataset.origen = 'mesa'; return 'mesa'; } } catch (e) { /* queda la propia */ }
      cont.textContent = '';
    }
    cont.dataset.origen = 'propio';
    cont.innerHTML = `<span class="rs__etq${animar ? ' escribe' : ''}${nombre ? '' : ' en-blanco'}"><i class="rs__pinza" aria-hidden="true"></i>${RAMITA_SVG}<span class="rs__nombre"><span>${esc(nombre)}</span></span></span>`;
    ajustaNombre(cont);
    return 'propio';
  }
  function ajustaNombre(cont) { // que el nombre quepa en la etiqueta aunque sea largo
    const n = cont.querySelector('.rs__nombre > span');
    if (!n) return;
    const caja = n.parentNode;
    cont.style.setProperty('--ajuste', 1);
    const w = n.scrollWidth, max = caja.clientWidth;
    if (max && w > max) cont.style.setProperty('--ajuste', (max / w).toFixed(3));
  }
  function ramaCinco(cont, animar) { // la ramita del final (rama 5, hierbas de San Juan) con el dibujo de Mesa si existe
    const M = E.mesa;
    if (M && typeof M.rama === 'function') {
      try { M.rama(cont, { n: 5, dibujar: !!animar }); if (cont.childElementCount) { cont.dataset.origen = 'mesa'; return; } } catch (e) { /* queda la propia */ }
    }
    cont.dataset.origen = 'propio';
    cont.innerHTML = RAMITA_SVG;
  }

  /* ================= montaje ================= */
  const SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const SEMANA_L = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  const PASOS = [['fechas', 'Fechas'], ['personas', 'Quiénes sois'], ['datos', 'Tu nombre'], ['hecho', 'Tu mesa']];
  const SUP = '<span class="rs__sup">supuesto</span>';
  const POR = '<span class="rs__sup">por confirmar</span>';
  const MAXP = TARIFAS.maxConSupletorias;

  function montar(el, opciones) {
    opciones = opciones || {};
    if (!el) return { destruir() {} };
    if (el.__reservaEntremuros) el.__reservaEntremuros.destruir();
    const htmlOriginal = el.innerHTML;

    const f = opciones.fecha;
    const fecha = f instanceof Date ? new Date(f.getFullYear(), f.getMonth(), f.getDate())
      : (typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f) ? deClave(f) : new Date());
    const hoy = clave(fecha);
    const reducido = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const movimiento = opciones.movimiento !== false && opciones.densidad !== 'sobria' && !reducido;

    /* ---------- estado ---------- */
    const b0 = deClave(hoy);
    const st = { y: b0.getFullYear(), m: b0.getMonth(), ini: null, fin: null, adultos: 4, ninos: 0, bebes: 0, mascotas: 0, paso: 'fechas', msg: '', nombre: '', loc: '', foco: null, ics: '' };
    const minMes = st.y * 12 + st.m, maxMes = minMes + TARIFAS.ventanaMeses - 1;
    const limite = clave(new Date(b0.getFullYear(), b0.getMonth() + TARIFAS.ventanaMeses, 0));
    const personas = () => st.adultos + st.ninos;
    const cuenta = () => precio({ ini: st.ini, fin: st.fin, adultos: st.adultos, ninos: st.ninos, mascotas: st.mascotas });
    const nombreLimpio = () => {
      let n = st.nombre.replace(/\s+/g, ' ').trim().slice(0, 28);
      if (n && n === n.toLowerCase()) n = n.replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase());
      return n;
    };
    const timers = new Set();
    const despues = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };

    /* ---------- esqueleto ---------- */
    el.innerHTML = `<div class="rs" id="rs-raiz">
      <p class="rs__demo"><b>Demostración.</b> Esto es un simulador: no envía, no guarda ni cobra nada, y las noches ocupadas son de ejemplo. Los precios y las reglas de la casa están marcados como <span class="rs__sup">supuesto</span> hasta que los confirme la casa.</p>
      <ol class="rs__pasos" id="rs-pasos" aria-label="Pasos"></ol>
      <div class="rs__mesa-caja">
        <div class="rs__mesa" aria-hidden="true">
          <div class="rs__suelo">
            <div class="rs__tabla" style="--cols:2">
              <div class="rs__tablero"></div>
              <div class="rs__centro"></div>
              <div class="rs__sitios"></div>
              <div class="rs__extra"><div class="rs__cunas"></div><div class="rs__cuencos"></div></div>
            </div>
          </div>
        </div>
        <p class="rs__leyenda" id="rs-leyenda" aria-live="polite"></p>
      </div>
      <div class="rs__in" id="rs-in"></div>
      <p class="rs__sr" id="rs-estado" role="status" aria-live="polite"></p>
    </div>`;
    el.dataset.movimiento = movimiento ? '1' : '0';
    el.dataset.densidad = opciones.densidad === 'sobria' ? 'sobria' : 'mesa';
    const raiz = el.querySelector('#rs-raiz');
    const $pasos = el.querySelector('#rs-pasos'), $in = el.querySelector('#rs-in'), $leyenda = el.querySelector('#rs-leyenda');
    const $tabla = el.querySelector('.rs__tabla'), $sitios = el.querySelector('.rs__sitios'), $centro = el.querySelector('.rs__centro');
    const $cunas = el.querySelector('.rs__cunas'), $cuencos = el.querySelector('.rs__cuencos'), $estado = el.querySelector('#rs-estado');
    const anuncia = (t) => { $estado.textContent = ''; despues(() => { $estado.textContent = t; }, 30); };

    /* ---------- la mesa: un cubierto por persona ---------- */
    const sitios = []; // { el, i }
    const slot = (i) => (i === 0 ? { lado: 'cab0' } : i === 1 ? { lado: 'cab1' } : { lado: 'lado', c: (i - 2) >> 1, fila: (i - 2) & 1 });

    function crearSitio(i, anima, retardo) {
      const s = slot(i), d = document.createElement('div');
      d.className = 'rs__sitio' + (anima ? ' nuevo' : '');
      d.dataset.i = i; d.dataset.lado = s.lado;
      if (s.lado === 'lado') { d.style.setProperty('--c', s.c); d.style.setProperty('--fila', s.fila); }
      d.style.setProperty('--n', retardo || 0);
      d.innerHTML = `${SILLA_HTML}<span class="rs__cub"></span><span class="rs__vasito">${VASITO_SVG}</span>${i === 0 ? '<span class="rs__tarj"></span>' : ''}`;
      $sitios.appendChild(d);
      dibujaCubierto(d.querySelector('.rs__cub'), { girado: false, animar: anima });
      if (anima) despues(() => d.classList.remove('nuevo'), 900 + (retardo || 0) * 70);
      sitios.push({ el: d, i });
    }
    function quitarSitio(anima) {
      const s = sitios.pop();
      if (!s) return;
      if (anima) { s.el.classList.add('sale'); s.el.dataset.sale = '1'; despues(() => s.el.remove(), 380); } else s.el.remove();
    }
    function actualizaCentro(cols, anima) {
      const actuales = $centro.children.length;
      for (let c = actuales; c < cols; c++) {
        const d = document.createElement('div');
        d.className = 'rs__col' + (anima ? ' nuevo' : '');
        d.style.setProperty('--c', c);
        d.innerHTML = RAMO_SVG + (c % 2 === 0 ? `<span class="rs__vela">${VELA_SVG}</span>` : '');
        $centro.appendChild(d);
        if (anima) despues(() => d.classList.remove('nuevo'), 1000);
      }
      while ($centro.children.length > cols) $centro.lastElementChild.remove();
    }
    function actualizaExtras(anima) {
      const ajusta = (cont, n, html, cls) => {
        while (cont.children.length < n) { const d = document.createElement('span'); d.className = cls + (anima ? ' nuevo' : ''); d.innerHTML = html; cont.appendChild(d); if (anima) despues(() => d.classList.remove('nuevo'), 700); }
        while (cont.children.length > n) cont.lastElementChild.remove();
      };
      ajusta($cunas, st.bebes, CUNA_SVG, 'rs__cuna');
      ajusta($cuencos, st.mascotas, CUENCO_SVG, 'rs__cuenco');
    }
    function textoMesa() {
      const n = personas();
      const t = [`Mesa para ${n}`];
      if (st.ninos) t.push(plural(st.ninos, 'niño', 'niños'));
      if (st.bebes) t.push(plural(st.bebes, 'bebé con cuna', 'bebés con cuna'));
      if (st.mascotas) t.push(plural(st.mascotas, 'mascota', 'mascotas'));
      return t;
    }
    function actualizaMesa(anima) {
      anima = anima && movimiento;
      const n = personas(), cols = Math.max(2, Math.ceil((n - 2) / 2));
      $tabla.style.setProperty('--cols', cols);
      let k = 0;
      while (sitios.length < n) crearSitio(sitios.length, anima, k++);
      while (sitios.length > n) quitarSitio(anima);
      sitios.forEach((s, i) => s.el.classList.toggle('con-nino', i >= n - st.ninos && st.ninos > 0));
      actualizaCentro(cols, anima);
      actualizaExtras(anima);
      const t = textoMesa();
      $leyenda.innerHTML = `<b>${esc(t[0])}</b>${t.length > 1 ? ' · ' + esc(t.slice(1).join(' · ')) : ''}`;
      raiz.dataset.cubiertos = n;
      el.dataset.cubiertos = n;
      tarjetaCabecera(false);
    }
    // la tarjeta en el plato de la cabecera: nada al principio, en blanco o con lo que escribes en el paso 3, escrita a pluma en el último
    function tarjetaCabecera(animar) {
      const cab = sitios[0] && sitios[0].el.querySelector('.rs__tarj');
      if (!cab) return;
      const nombre = nombreLimpio();
      if (st.paso === 'fechas' || st.paso === 'personas') { cab.textContent = ''; cab.dataset.estado = 'ninguna'; return; }
      if (st.paso === 'datos') { dibujaTarjeta(cab, nombre, { animar: false }); cab.dataset.estado = nombre ? 'viva' : 'en-blanco'; return; }
      dibujaTarjeta(cab, nombre, { animar: animar && movimiento }); cab.dataset.estado = 'escrita';
    }

    /* ---------- calendario ---------- */
    function mesHTML(y, m) {
      const primero = new Date(y, m, 1), dias = new Date(y, m + 1, 0).getDate();
      const off = (primero.getDay() + 6) % 7;
      let nombre = primero.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      nombre = nombre[0].toUpperCase() + nombre.slice(1);
      const idm = `rs-m-${y}-${pad(m + 1)}`;
      const celdas = [];
      for (let i = 0; i < off; i++) celdas.push('<span role="presentation"></span>');
      for (let d = 1; d <= dias; d++) {
        const k = `${y}-${pad(m + 1)}-${pad(d)}`;
        const c = ['rs__dia'];
        let dis = false, et = larga(k);
        if (k < hoy || k > limite) { c.push('pasado'); dis = true; et += k < hoy ? ', ya pasado' : ', fuera de las fechas que se pueden pedir'; }
        else if (ocupada(k)) {
          if (st.ini && !st.fin && k > st.ini && libreEntre(st.ini, k)) { c.push('solo-salida'); et += ', ocupada esa noche, libre para salir'; }
          else { c.push('ocupado'); dis = true; et += ', ocupada'; }
        } else et += ', libre';
        if (!dis) { const tp = tipoNoche(k); if (tp !== 'baja') { c.push('alta'); et += ', ' + (tp === 'puente' || tp === 'navidad' || tp === 'semana-santa' ? TIPOS[tp] : 'temporada alta'); } }
        const sel = !!(st.ini && ((k === st.ini) || (st.fin && k >= st.ini && k <= st.fin)));
        if (st.ini && k === st.ini) { c.push('ini'); et += ', llegada'; }
        if (st.fin && k === st.fin) { c.push('fin'); et += ', salida'; }
        if (st.ini && st.fin && k > st.ini && k < st.fin) c.push('rango');
        celdas.push(`<span role="gridcell" aria-selected="${sel ? 'true' : 'false'}"><button type="button" class="${c.join(' ')}" data-k="${k}" tabindex="-1" aria-label="${esc(et)}"${dis ? ' aria-disabled="true"' : ''}>${d}</button></span>`);
      }
      const filas = [];
      for (let i = 0; i < celdas.length; i += 7) filas.push(`<div role="row" class="rs__fila">${celdas.slice(i, i + 7).join('')}</div>`);
      return `<div class="rs__mes"><h4 class="rs__mes-tit" id="${idm}">${nombre}</h4>
        <div class="rs__dias" role="grid" aria-labelledby="${idm}">
          <div role="row" class="rs__fila rs__semana">${SEMANA.map((d, i) => `<span role="columnheader" aria-label="${SEMANA_L[i]}">${d}</span>`).join('')}</div>
          ${filas.join('')}</div></div>`;
    }

    /* ---------- paneles ---------- */
    const rsFechas = () => `<div class="rs__fechas"><div><small>Llegada</small><b>${st.ini ? esc(corta(st.ini)) : '—'}</b></div><div><small>Salida</small><b>${st.fin ? esc(corta(st.fin)) : '—'}</b></div></div>`;
    function desglose() {
      const c = cuenta();
      let d = '<div class="rs__desglose" id="rs-desglose" role="group" aria-label="Desglose del precio">';
      if (!c.n) return d + `<div class="nada">${st.ini ? 'Ahora, el día de salida.' : 'Elige en el calendario el día de llegada.'}</div></div>`;
      c.grupos.forEach((g) => {
        const sub = g.tipo === 'baja' ? `${TIPOS.baja}, ${c.personas <= TARIFAS.bajaHasta ? 'hasta ' + TARIFAS.bajaHasta : 'hasta ' + TARIFAS.plazas} personas` : (g.tipo === 'julio' || g.tipo === 'agosto' ? 'de ' + TIPOS[g.tipo] : TIPOS[g.tipo]);
        d += `<div><span>${plural(g.n, 'noche', 'noches')} · ${esc(sub)} × ${eur(g.precio)}</span><span>${eur(g.n * g.precio)}</span></div>`;
      });
      if (c.supletorias) d += `<div><span>${plural(c.supletorias, 'cama supletoria', 'camas supletorias')} × ${eur(TARIFAS.supletoria)}${TARIFAS.supletoriaPor === 'noche' ? ' × ' + plural(c.n, 'noche', 'noches') : ''} ${POR}</span><span>${eur(c.suplTotal)}</span></div>`;
      if (c.mascotas) d += `<div><span>${plural(c.mascotas, 'mascota', 'mascotas')} × ${eur(TARIFAS.mascota)} × ${plural(c.n, 'noche', 'noches')} ${POR}</span><span>${eur(c.mascTotal)}</span></div>`;
      if (st.bebes) d += `<div><span>${plural(st.bebes, 'bebé', 'bebés')}: cuna gratis</span><span>gratis</span></div>`;
      d += `<div class="tot"><span>Total estimado</span><span data-total>${eur(c.total)}</span></div></div>`;
      return d;
    }
    const pie = () => `<p class="rs__fino">Entrada desde las ${CASA.entrada} · salida antes de las ${CASA.salida}. El precio es por noche y por la casa entera, IVA incluido ${SUP}.</p>`;

    function panelFechas() {
      const c = cuenta(), listo = c.n >= TARIFAS.minNoches;
      return `<h3 id="rs-tit" tabindex="-1">Elige tus noches</h3>
        ${rsFechas()}
        ${desglose()}
        <button type="button" class="rs__btn" data-acc="seguir" aria-disabled="${!listo}">Seguir: cuántos sois</button>
        <p class="rs__fino">Mínimo ${TARIFAS.minNoches} noches ${SUP}. Una sola noche tiene un coste adicional: hay que consultarlo con la casa ${POR}.</p>
        <p class="rs__fino">En temporada baja el precio depende de cuántos seáis: ${eur(TARIFAS.baja8)} hasta ${TARIFAS.bajaHasta} personas y ${eur(TARIFAS.baja12)} hasta ${TARIFAS.plazas} ${SUP}. En julio ${eur(TARIFAS.altaJulio)}, en agosto ${eur(TARIFAS.altaAgosto)} y en Semana Santa, Navidad y puentes ${eur(TARIFAS.altaEspecial)} ${SUP}.</p>
        ${pie()}`;
    }
    function contador(cual, titulo, nota, valor, min, max, masOk) {
      return `<div class="rs__cont" data-cont="${cual}"><div><span class="rs__cont-t">${titulo}</span><small>${nota}</small></div>
        <button type="button" data-acc="menos:${cual}" aria-label="Uno menos: ${esc(titulo.toLowerCase())}"${valor <= min ? ' disabled' : ''}>−</button>
        <b data-valor="${cual}">${valor}</b>
        <button type="button" data-acc="mas:${cual}" aria-label="Uno más: ${esc(titulo.toLowerCase())}"${!masOk || valor >= max ? ' disabled' : ''}>+</button></div>`;
    }
    function panelPersonas() {
      const p = personas(), libre = p < MAXP;
      return `<h3 id="rs-tit" tabindex="-1">¿Cuántos sois?</h3>
        <p class="rs__fino">${esc(corta(st.ini))} → ${esc(corta(st.fin))} · ${plural(cuenta().n, 'noche', 'noches')}</p>
        <div class="rs__conts">
          ${contador('adultos', 'Adultos', 'Cada persona, un cubierto', st.adultos, 1, MAXP, libre)}
          ${contador('ninos', 'Niños', 'El mismo cubierto, con un vasito', st.ninos, 0, MAXP, libre)}
          ${contador('bebes', 'Bebés', `Hasta 3 años: cuna gratis, sin cubierto ${POR}`, st.bebes, 0, TARIFAS.bebesMax, true)}
          ${contador('mascotas', 'Mascotas', `${eur(TARIFAS.mascota)} por noche ${POR}: un cuenco junto a la mesa`, st.mascotas, 0, TARIFAS.maxMascotas, true)}
        </div>
        <p class="rs__fino" data-aviso-plazas>${p > TARIFAS.plazas ? `Pasáis de ${TARIFAS.plazas}: ${plural(p - TARIFAS.plazas, 'cama supletoria', 'camas supletorias')} a ${eur(TARIFAS.supletoria)}${TARIFAS.supletoriaPor === 'noche' ? ' la noche' : ''} ${POR}. El máximo, con supletorias, es ${MAXP}.` : `La casa tiene plazas para ${TARIFAS.plazas}. Con camas supletorias, hasta ${MAXP} ${POR}.`}</p>
        ${desglose()}
        <button type="button" class="rs__btn" data-acc="a-datos">Seguir: tu nombre</button>
        <button type="button" class="rs__btn rs__btn--linea" data-acc="volver">Cambiar las fechas</button>`;
    }
    function panelDatos() {
      const c = cuenta();
      return `<h3 id="rs-tit" tabindex="-1">¿A nombre de quién ponemos la mesa?</h3>
        <p class="rs__fino">${esc(corta(st.ini))} → ${esc(corta(st.fin))} · ${plural(c.n, 'noche', 'noches')} · ${plural(c.personas, 'persona', 'personas')} · <b>${eur(c.total)}</b></p>
        <form class="rs__form" id="rs-form" novalidate>
          <label for="rs-nombre">Tu nombre <span>(el que quieras ver escrito en la tarjeta del plato)</span>
            <input type="text" id="rs-nombre" maxlength="28" autocomplete="off" autocapitalize="words" spellcheck="false" required value="${esc(st.nombre)}"></label>
          <p class="rs__msg" id="rs-error" role="alert"></p>
          <button type="submit" class="rs__btn">Poner la tarjeta en el plato</button>
          <p class="rs__fino rs__aviso">No envía, no guarda ni cobra nada. Tu nombre no sale de este navegador.</p>
          <button type="button" class="rs__btn rs__btn--linea" data-acc="volver-pers">Volver</button>
        </form>`;
    }
    function panelHecho() {
      const c = cuenta(), pers = c.personas;
      const detalle = [];
      if (st.ninos) detalle.push(plural(st.ninos, 'niño', 'niños'));
      if (st.bebes) detalle.push(plural(st.bebes, 'bebé con cuna', 'bebés con cuna'));
      if (st.mascotas) detalle.push(plural(st.mascotas, 'mascota', 'mascotas'));
      return `<div class="rs__hecho">
        <h3 id="rs-tit" tabindex="-1">Tu mesa está puesta</h3>
        <div class="rs__tarjeta-gr" data-tarjeta-grande><span class="rs__tarj-in"></span></div>
        <p class="rs__linea" id="rs-linea">Te esperamos el ${esc(diaMes(st.ini))} · ${plural(c.n, 'noche', 'noches')} · ${plural(pers, 'persona', 'personas')} · entrada desde las ${CASA.entrada}</p>
        ${detalle.length ? `<p class="rs__fino">Además: ${esc(detalle.join(', '))}.</p>` : ''}
        <p class="rs__loc"><small>Localizador (de demostración)</small><b id="rs-loc">${esc(st.loc)}</b></p>
        ${desglose()}
        <ul class="rs__info">
          <li>Para reservar de verdad, la casa pide el 30 % por transferencia: ${eur(c.senal)} ${POR}. Aquí no se cobra.</li>
          <li>El resto, el día de entrada, y una fianza de ${eur(c.fianza)} que se devuelve a las 72 horas ${POR}. Aquí no se cobra.</li>
        </ul>
        <div class="rs__acciones">
          <button type="button" class="rs__btn" data-acc="ics">Añadir al calendario (.ics)</button>
          <button type="button" class="rs__btn rs__btn--linea" data-acc="otra">Hacer otra reserva</button>
        </div>
        <p class="rs__fino rs__aviso" id="rs-aviso-final">Demostración: no se ha enviado, guardado ni cobrado nada, y tu nombre no ha salido de este navegador. El localizador no corresponde a ninguna reserva real. Para consultar fechas de verdad, llama a la casa: <a href="tel:+34${CASA.telefono.replace(/\s/g, '')}">${CASA.telefono}</a>.</p>
      </div>`;
    }

    function pintar(foco) {
      const iPaso = PASOS.findIndex((p) => p[0] === st.paso);
      $pasos.innerHTML = PASOS.map(([k, t], i) => `<li${i === iPaso ? ' aria-current="step"' : ''}${i < iPaso ? ' class="hecho"' : ''}>${t}</li>`).join('');
      const panel = { fechas: panelFechas, personas: panelPersonas, datos: panelDatos, hecho: panelHecho }[st.paso]();
      const y2 = st.m === 11 ? st.y + 1 : st.y, m2 = (st.m + 1) % 12, actual = st.y * 12 + st.m;
      const cal = st.paso === 'fechas' ? `<div class="rs__cal">
          <div class="rs__top"><h3>Noches libres</h3>
            <button type="button" class="rs__nav" data-acc="prev" aria-label="Mes anterior"${actual <= minMes ? ' disabled' : ''}>‹</button>
            <button type="button" class="rs__nav" data-acc="next" aria-label="Mes siguiente"${actual + 1 >= maxMes ? ' disabled' : ''}>›</button></div>
          <div class="rs__meses">${mesHTML(st.y, st.m)}${mesHTML(y2, m2)}</div>
          <div class="rs__ley"><span><i class="ley-sel"></i>Tu estancia</span><span><i class="ley-ocu"></i>Ocupada (de ejemplo)</span><span><i class="ley-alta"></i>Temporada alta o puente</span></div>
          <p class="rs__msg" role="status" aria-live="polite">${esc(st.msg)}</p>
        </div>` : '';
      if (st.msg) anuncia(st.msg);
      $in.dataset.paso = st.paso;
      raiz.dataset.paso = st.paso; el.dataset.paso = st.paso;
      $in.innerHTML = `${cal}<div class="rs__res">${panel}</div>`;
      if (st.paso === 'fechas') {
        // un solo día con tabindex=0 (el último con foco, la llegada o el primero libre)
        const botones = [...$in.querySelectorAll('.rs__dia')];
        const elegido = botones.find((b) => b.dataset.k === st.foco) || botones.find((b) => b.dataset.k === st.ini) || botones.find((b) => b.getAttribute('aria-disabled') !== 'true') || botones[0];
        if (elegido) elegido.tabIndex = 0;
      }
      if (st.paso === 'hecho') {
        const g = $in.querySelector('[data-tarjeta-grande] .rs__tarj-in');
        if (g) { dibujaTarjeta(g, nombreLimpio(), { animar: movimiento }); }
      }
      if (foco) {
        const x = $in.querySelector(foco);
        if (x) x.focus({ preventScroll: true });
      }
    }

    /* ---------- acciones ---------- */
    function irAlModulo() {
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.top > innerHeight * 0.45) { try { el.scrollIntoView({ behavior: movimiento ? 'smooth' : 'auto', block: 'start' }); } catch (e) { el.scrollIntoView(); } }
    }
    function cambiaPaso(p) {
      st.paso = p; st.msg = '';
      pintar('#rs-tit');
      tarjetaCabecera(p === 'hecho');
      irAlModulo();
    }
    function elegirDia(k) {
      st.msg = ''; st.foco = k;
      if (k < hoy || k > limite) { st.msg = 'Ese día no se puede elegir.'; return; }
      if (!st.ini || st.fin || k <= st.ini) {
        if (ocupada(k)) { st.msg = 'Esa noche está ocupada (de ejemplo): elige otra.'; return; }
        st.ini = k; st.fin = null;
      } else if (!libreEntre(st.ini, k)) {
        st.msg = 'Hay noches ocupadas entre medias: elige otra salida.';
        if (!ocupada(k)) { st.ini = k; st.fin = null; }
      } else if (entre(st.ini, k) < TARIFAS.minNoches) {
        st.msg = TARIFAS.minNoches > 1 && entre(st.ini, k) === 1
          ? `Una sola noche tiene un coste adicional: hay que consultarlo con la casa. Para esta demostración, el mínimo es de ${TARIFAS.minNoches} noches.`
          : `La estancia mínima es de ${TARIFAS.minNoches} noches.`;
      } else st.fin = k;
    }
    function mover(k, destino) { // mueve el foco entre días; cambia de mes si hace falta
      if (destino < hoy) destino = hoy;
      if (destino > limite) destino = limite;
      const d = deClave(destino), idx = d.getFullYear() * 12 + d.getMonth(), actual = st.y * 12 + st.m;
      let primero = actual;
      if (idx < actual) primero = idx; else if (idx > actual + 1) primero = idx - 1;
      primero = Math.max(minMes, Math.min(maxMes - 1, primero));
      st.y = Math.floor(primero / 12); st.m = primero % 12;
      st.foco = destino;
      pintar(`[data-k="${destino}"]`);
    }

    function onClick(e) {
      const b = e.target.closest('button');
      if (!b || !el.contains(b)) return;
      if (b.dataset.k) {
        if (st.paso !== 'fechas') return;
        if (b.getAttribute('aria-disabled') === 'true') {
          st.foco = b.dataset.k;
          st.msg = b.dataset.k < hoy ? 'Ese día ya ha pasado.' : (b.dataset.k > limite ? 'Ese día queda fuera de lo que se puede pedir en esta demostración.' : 'Esa noche está ocupada (de ejemplo): elige otra.');
          pintar(`[data-k="${b.dataset.k}"]`);
          return;
        }
        elegirDia(b.dataset.k);
        pintar(`[data-k="${b.dataset.k}"]`);
        return;
      }
      const a = b.dataset.acc;
      if (!a || b.disabled) return;
      let foco = `[data-acc="${a}"]:not(:disabled)`;
      let mesa = false;
      if (a === 'prev') { if (st.y * 12 + st.m <= minMes) return; if (st.m === 0) { st.m = 11; st.y--; } else st.m--; }
      else if (a === 'next') { if (st.y * 12 + st.m + 1 >= maxMes) return; if (st.m === 11) { st.m = 0; st.y++; } else st.m++; }
      else if (a.startsWith('mas:') || a.startsWith('menos:')) {
        const [dir, cual] = a.split(':'), v = dir === 'mas' ? 1 : -1;
        if (cual === 'adultos') st.adultos = Math.max(1, Math.min(MAXP - st.ninos, st.adultos + v));
        else if (cual === 'ninos') st.ninos = Math.max(0, Math.min(MAXP - st.adultos, st.ninos + v));
        else if (cual === 'bebes') st.bebes = Math.max(0, Math.min(TARIFAS.bebesMax, st.bebes + v));
        else if (cual === 'mascotas') st.mascotas = Math.max(0, Math.min(TARIFAS.maxMascotas, st.mascotas + v));
        mesa = true;
        foco = `[data-acc="${a}"]:not(:disabled)`;
        if (!$in.querySelector(foco)) foco = `[data-valor="${cual}"]`;
      }
      else if (a === 'seguir') {
        if (cuenta().n < TARIFAS.minNoches) { st.msg = st.ini ? 'Falta el día de salida (mínimo ' + TARIFAS.minNoches + ' noches).' : 'Elige primero el día de llegada.'; pintar(null); return; }
        cambiaPaso('personas'); return;
      }
      else if (a === 'a-datos') { cambiaPaso('datos'); return; }
      else if (a === 'volver') { cambiaPaso('fechas'); return; }
      else if (a === 'volver-pers') { cambiaPaso('personas'); return; }
      else if (a === 'otra') {
        st.ini = st.fin = null; st.nombre = ''; st.loc = ''; st.ics = ''; st.adultos = 4; st.ninos = 0; st.bebes = 0; st.mascotas = 0;
        actualizaMesa(true); cambiaPaso('fechas'); return;
      }
      else if (a === 'ics') { descargaICS(); return; }
      else return;
      pintar(foco);
      if (mesa) actualizaMesa(true);
    }
    function onKeydown(e) {
      const b = e.target.closest && e.target.closest('.rs__dia');
      if (!b || !el.contains(b)) return;
      const k = b.dataset.k;
      const mapa = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      let destino = null;
      if (e.key in mapa) destino = mas(k, mapa[e.key]);
      else if (e.key === 'Home') destino = mas(k, -((deClave(k).getDay() + 6) % 7));
      else if (e.key === 'End') destino = mas(k, 6 - ((deClave(k).getDay() + 6) % 7));
      else if (e.key === 'PageUp' || e.key === 'PageDown') {
        const d = deClave(k), v = e.key === 'PageUp' ? -1 : 1, t = new Date(d.getFullYear(), d.getMonth() + v, 1);
        destino = clave(new Date(t.getFullYear(), t.getMonth(), Math.min(d.getDate(), new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate())));
      } else if (e.key === 'Escape' && st.ini && st.paso === 'fechas') { st.ini = st.fin = null; st.msg = ''; pintar(`[data-k="${k}"]`); e.preventDefault(); return; }
      if (destino) { e.preventDefault(); mover(k, destino); }
    }
    function onInput(e) {
      if (e.target.id !== 'rs-nombre') return;
      st.nombre = e.target.value;
      const err = $in.querySelector('#rs-error');
      if (err) err.textContent = '';
      e.target.removeAttribute('aria-invalid');
      tarjetaCabecera(false);
    }
    function onSubmit(e) {
      if (e.target.id !== 'rs-form') return;
      e.preventDefault();
      const inp = e.target.querySelector('#rs-nombre'), err = e.target.querySelector('#rs-error');
      st.nombre = inp.value;
      if (!nombreLimpio()) { inp.setAttribute('aria-invalid', 'true'); err.textContent = 'Escribe tu nombre para ponerlo en la tarjeta.'; inp.focus(); return; }
      const c = cuenta();
      st.loc = localizador(st.ini, st.fin, c.personas, nombreLimpio());
      cambiaPaso('hecho');
    }
    function descargaICS() {
      const c = cuenta();
      st.ics = crearICS({ loc: st.loc, ini: st.ini, fin: st.fin, n: c.n, personas: c.personas });
      E.reserva.ultimoICS = st.ics;
      try {
        const url = URL.createObjectURL(new Blob([st.ics], { type: 'text/calendar;charset=utf-8' }));
        const a = document.createElement('a');
        a.href = url; a.download = `casa-entremuros-${st.loc}.ics`;
        document.body.appendChild(a); a.click(); a.remove();
        despues(() => URL.revokeObjectURL(url), 4000);
      } catch (err) { /* sin descarga: el texto queda en Entremuros.reserva.ultimoICS */ }
    }

    el.addEventListener('click', onClick);
    el.addEventListener('keydown', onKeydown);
    el.addEventListener('input', onInput);
    el.addEventListener('submit', onSubmit);

    /* ---------- estado inicial: el próximo fin de semana libre, para cuatro ---------- */
    for (let k = mas(hoy, 1), i = 0; i < 150; k = mas(k, 1), i++) {
      if (deClave(k).getDay() === 5 && libreEntre(k, mas(k, 2)) && k <= limite) {
        st.ini = k; st.fin = mas(k, 2);
        const d = deClave(k); st.y = d.getFullYear(); st.m = d.getMonth();
        if (st.y * 12 + st.m + 1 > maxMes) { st.y = b0.getFullYear(); st.m = b0.getMonth(); }
        break;
      }
    }
    pintar();
    actualizaMesa(true);
    el.dataset.montado = '1';
    el.style.scrollMarginTop = 'calc(var(--cab, 72px) + 8px)';
    // Pinyon Script llega tarde: cuando esté, se vuelve a medir el nombre en las tarjetas
    const remide = () => el.querySelectorAll('.rs__tarj, .rs__tarj-in').forEach(ajustaNombre);
    if (document.fonts) { try { document.fonts.ready.then(remide); document.fonts.addEventListener('loadingdone', remide); } catch (e) { /* sin remedida */ } }

    // las velas solo parpadean mientras el módulo se ve
    let ioVista = null;
    if (movimiento && 'IntersectionObserver' in window) {
      ioVista = new IntersectionObserver((es) => { el.dataset.visible = es[es.length - 1].isIntersecting ? '1' : '0'; });
      ioVista.observe(el);
    }

    const instancia = {
      destruir() {
        if (ioVista) ioVista.disconnect();
        el.removeEventListener('click', onClick);
        el.removeEventListener('keydown', onKeydown);
        el.removeEventListener('input', onInput);
        el.removeEventListener('submit', onSubmit);
        timers.forEach(clearTimeout); timers.clear();
        if (document.fonts) { try { document.fonts.removeEventListener('loadingdone', remide); } catch (e) { /* nada */ } }
        el.style.scrollMarginTop = '';
        el.innerHTML = htmlOriginal;
        delete el.dataset.montado; delete el.dataset.visible; delete el.dataset.movimiento; delete el.dataset.densidad; delete el.dataset.paso; delete el.dataset.cubiertos;
        delete el.__reservaEntremuros;
        if (E.reserva.ultima === instancia) E.reserva.ultima = null;
      },
      // solo para las pruebas
      prueba: { st, cuenta, personas, hoy, limite, nombreLimpio, sitios }
    };
    el.__reservaEntremuros = instancia;
    E.reserva.ultima = instancia;
    return instancia;
  }

  E.reserva = Object.assign(E.reserva || {}, { montar, TARIFAS, CASA, precio, tipoNoche, esAlta, ocupada, pascua, festivosDe, localizador, crearICS, ultima: null, ultimoICS: '' });
})();
