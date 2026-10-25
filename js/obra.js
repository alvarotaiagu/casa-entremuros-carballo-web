/* ------------------------------------------------------------------
   Casa Entremuros · módulo «Antes y después» (obra)
   Contrato: window.Entremuros.obra.montar(el, { movimiento, densidad: 'mesa'|'sobria' }) → { destruir() }.
   El HTML de `el` es el respaldo (cada pareja lado a lado, lo escribe la web): se oculta cuando el módulo
   monta y vuelve con destruir() o si algo falla. Pone el.dataset.montado = '1'.

   Qué monta (todo son fotos de la casa, de su Instagram; nada dibujado salvo el yeso del horno, que lo dice):
   1. «La fachada en cinco tiempos»: cinco fotos de la misma fachada, alineadas con homografía
      (pruebas/obra-alinear.py), con la casa que se rehace al bajar: la foto siguiente aparece de abajo arriba,
      a sillares, como se levanta un muro. Fijada con CSS sticky (sin pin-spacer).
   2. La línea del tiempo (2010 · 2011 · sin año · 2019 · hoy), con las citas literales de Mónica y sus parejas:
      - «picar»: el antes se desprende a trozos irregulares (semilla fija, con polvo) y debajo aparece el después.
        Solo se usa donde las fotos se pudieron alinear (comedor, baño, casita) y en el horno, cuyo último trozo
        lo destapa. El progreso lo marca el scroll, o el deslizador (flechas o arrastrando).
      - «tira»: las fotos lado a lado, cuando no encajan en encuadre (no se fuerzan).
   Movimiento: con movimiento reducido o densidad «sobria» no se pica ni se rehace nada: cada pareja es un
   deslizador manual (role="slider", «60 % después») y la fachada se recorre con los cinco botones. El
   contenido (qué tiempo está activo, qué se ve) cambia igual; solo se quita el movimiento.
   Sin GSAP: va con el scroll nativo (Lenis lo suaviza si está). ScrollTrigger solo si algún ancestro rompe el sticky.
   Sin requestAnimationFrame mientras nada se mueve.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  const guion = document.currentScript && document.currentScript.src;
  const base = (ruta) => {
    try { return guion ? new URL(ruta, guion).href : ruta.replace(/^\.\.\//, ''); } catch (e) { return ruta.replace(/^\.\.\//, ''); }
  };
  const IMG = base('../img/obra/');

  let cacheDatos = null;
  const pedirDatos = () => {
    if (!cacheDatos) {
      cacheDatos = fetch(IMG + 'obra.json', { credentials: 'same-origin' }).then((r) => {
        if (!r.ok) throw new Error('obra.json ' + r.status);
        return r.json();
      });
      cacheDatos.catch(() => { cacheDatos = null; });
    }
    return cacheDatos;
  };

  /* ---------- utilidades ---------- */
  const lim = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const suave = (t) => t * t * (3 - 2 * t);
  const salir = (t) => 1 - Math.pow(1 - t, 3);
  const mulberry32 = (a) => () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const h = (tag, attrs, ...hijos) => {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v === false || v === null || v === undefined) continue;
      if (k === 'class') e.className = v;
      else if (k === 'texto') e.textContent = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    hijos.forEach((c) => { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  };

  // <picture> con AVIF, WebP y JPG a los anchos que existen (nunca amplía); devuelve { pic, img }
  const foto = (datos, nombre, alt, o) => {
    o = o || {};
    const m = datos.imagenes[nombre];
    const set = (ext) => m.anchos.map((a) => IMG + nombre + '-' + a + '.' + ext + ' ' + a + 'w').join(', ');
    const sizes = o.sizes || '(min-width: 900px) 46vw, 92vw';
    const pic = h('picture');
    pic.appendChild(h('source', { type: 'image/avif', srcset: set('avif'), sizes }));
    pic.appendChild(h('source', { type: 'image/webp', srcset: set('webp'), sizes }));
    const mayor = m.anchos[m.anchos.length - 1];
    const img = h('img', {
      src: IMG + nombre + '-' + mayor + '.jpg', srcset: set('jpg'), sizes, width: m.ancho, height: m.alto,
      alt: alt || '', decoding: 'async', loading: o.eager ? 'eager' : 'lazy'
    });
    pic.appendChild(img);
    return { pic, img, m };
  };

  const cita = (c, clase) => {
    if (!c) return null;
    return h('blockquote', { class: clase || 'ob-cita' },
      h('p', { texto: '«' + c.texto + '»' }),
      h('footer', null, h('cite', { texto: 'Mónica, Instagram · ' + c.fuente })));
  };

  // ¿algún ancestro rompe el sticky? (overflow distinto de visible; el del <body> pasa a la ventana)
  const stickyRoto = (el) => {
    const htmlVisible = getComputedStyle(document.documentElement).overflowY === 'visible';
    for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
      if (n === document.body && htmlVisible) continue;
      const cs = getComputedStyle(n);
      if (/(hidden|auto|scroll)/.test(cs.overflowX + ' ' + cs.overflowY)) return true;
    }
    return false;
  };

  /* ==================================================================================
     El yeso: una capa generada (semilla fija) para el horno, donde no hay foto del «antes».
     ================================================================================== */
  const crearYeso = (W, H) => {
    const rnd = mulberry32(2010);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#e2dbcb'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) {            // pasadas de llana: manchas anchas, casi invisibles
      const x = rnd() * W, y = rnd() * H, rx = 60 + rnd() * 180, ry = 22 + rnd() * 60;
      g.fillStyle = rnd() < 0.5 ? 'rgba(246,242,232,.16)' : 'rgba(176,164,142,.10)';
      g.beginPath(); g.ellipse(x, y, rx, ry, (rnd() - 0.5) * 0.9, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < Math.round(W * H / 190); i++) {   // grano
      g.fillStyle = rnd() < 0.55 ? 'rgba(86,76,60,.07)' : 'rgba(255,255,255,.2)';
      const s = rnd() < 0.15 ? 2 : 1; g.fillRect(rnd() * W, rnd() * H, s, s);
    }
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let i = 0; i < 6; i++) {             // grietas: caminatas cortas
      let x = rnd() * W, y = rnd() * H, a = rnd() * Math.PI * 2;
      g.strokeStyle = 'rgba(80,70,56,.26)'; g.lineWidth = 0.8 + rnd() * 0.6;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 18; k++) { a += (rnd() - 0.5) * 0.9; x += Math.cos(a) * (8 + rnd() * 12); y += Math.sin(a) * (8 + rnd() * 12); g.lineTo(x, y); }
      g.stroke();
    }
    return c;
  };

  // una nube de polvo blanda, pintada una vez: mucho más barato que un degradado por partícula y por cuadro
  let polvo = null;
  const polvoSprite = () => {
    if (polvo) return polvo;
    polvo = document.createElement('canvas'); polvo.width = polvo.height = 48;
    const g = polvo.getContext('2d'), d = g.createRadialGradient(24, 24, 0, 24, 24, 24);
    d.addColorStop(0, 'rgba(232,225,211,1)'); d.addColorStop(0.55, 'rgba(232,225,211,.45)'); d.addColorStop(1, 'rgba(232,225,211,0)');
    g.fillStyle = d; g.fillRect(0, 0, 48, 48);
    return polvo;
  };

  /* ==================================================================================
     Los trozos de yeso: celdas irregulares con vértices compartidos (no quedan huecos), cada una con su
     instante de caída. Semilla fija: siempre se pica igual. `ultimo` = [x, y] relativos: el trozo que cubre ese
     punto (y los de alrededor) caen los últimos.
     ================================================================================== */
  const DUR = 0.2;
  const generarTrozos = (W, H, semilla, ultimo) => {
    const rnd = mulberry32(semilla);
    const celda = lim(W / 9.5, 64, 104);
    const nx = Math.max(3, Math.round(W / celda)), ny = Math.max(3, Math.round(H / celda));
    const cw = W / nx, ch = H / ny;
    const V = [];
    for (let j = 0; j <= ny; j++) {
      const fila = [];
      for (let i = 0; i <= nx; i++) {
        let x = i * cw, y = j * ch;
        if (i > 0 && i < nx) x += (rnd() - 0.5) * cw * 0.62;
        if (j > 0 && j < ny) y += (rnd() - 0.5) * ch * 0.62;
        fila.push([x, y]);
      }
      V.push(fila);
    }
    const medios = {};
    const medio = (clave, a, b, borde) => {
      if (medios[clave]) return medios[clave];
      let mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      if (!borde) {
        const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
        const o = (rnd() - 0.5) * 0.34 * Math.min(cw, ch);
        mx += (-dy / l) * o; my += (dx / l) * o;
      }
      return (medios[clave] = [mx, my]);
    };
    const trozos = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = V[j][i], b = V[j][i + 1], c = V[j + 1][i + 1], d = V[j + 1][i];
      const poly = [a, medio('h' + i + ',' + j, a, b, j === 0), b, medio('v' + (i + 1) + ',' + j, b, c, i + 1 === nx),
        c, medio('h' + i + ',' + (j + 1), d, c, j + 1 === ny), d, medio('v' + i + ',' + j, a, d, i === 0)];
      let sx = 0, sy = 0, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      poly.forEach((p) => { sx += p[0]; sy += p[1]; x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
      const t = {
        poly, cx: sx / poly.length, cy: sy / poly.length,
        x0: Math.floor(x0 - 2), y0: Math.floor(y0 - 2), x1: Math.ceil(x1 + 2), y1: Math.ceil(y1 + 2),
        gx: (rnd() - 0.5) * 3.2, gy: (rnd() - 0.5) * 2.4,           // la grieta: se mueve un pelo antes de caer
        dx: (rnd() - 0.5) * 70, caida: 0.5 + rnd() * 0.5, rot: (rnd() - 0.5) * 0.55,
        polvo: [0, 1].map(() => ({ ox: (rnd() - 0.5) * (cw * 1.1), oy: (rnd() - 0.5) * (ch * 0.9), r: 5 + rnd() * 9, vx: (rnd() - 0.5) * 1.2 })),
        t0: 0
      };
      trozos.push(t);
    }
    // instantes: se empieza por unos pocos golpes y se va extendiendo
    const golpes = [0, 1, 2].map(() => [rnd() * W, rnd() * H]);
    const diag = Math.hypot(W, H) / 2;
    let maxRaw = 0;
    trozos.forEach((t) => {
      const d = Math.min.apply(null, golpes.map((g) => Math.hypot(t.cx - g[0], t.cy - g[1]))) / diag;
      t.raw = 0.04 + 0.62 * d + 0.2 * rnd();
      maxRaw = Math.max(maxRaw, t.raw);
    });
    const T = 1 - DUR - 0.01;
    if (ultimo) {
      const px = ultimo[0] * W, py = ultimo[1] * H, R = 0.16 * W;
      let mejor = null, md = 1e9;
      trozos.forEach((t) => {
        t.t0 = t.raw / maxRaw * 0.58;
        const dd = Math.hypot(t.cx - px, t.cy - py);
        if (dd < md) { md = dd; mejor = t; }
        if (dd < R) t.t0 = 0.62 + (T - 0.62) * (1 - dd / R) * 0.9;
      });
      mejor.t0 = T;
    } else {
      trozos.forEach((t) => { t.t0 = t.raw / maxRaw * T; });
    }
    trozos.sort((a, b) => a.t0 - b.t0);
    return trozos;
  };

  /* ==================================================================================
     Los sillares de la fachada: hiladas de piedra irregulares. Cada sillar aparece en su instante, de abajo
     arriba: como se levanta un muro.
     ================================================================================== */
  const generarSillares = (W, H) => {
    const rnd = mulberry32(1818);
    const filas = [];
    let y = H;
    while (y > 0) {
      const alto = Math.min(y, (30 + rnd() * 26) * (W / 588));
      filas.push({ y: y - alto, alto });
      y -= alto;
    }
    const bloques = [];
    filas.forEach((f, n) => {
      let x = -rnd() * 50 * (W / 588);
      const desdeAbajo = n / Math.max(1, filas.length - 1);
      while (x < W) {
        const ancho = (46 + rnd() * 70) * (W / 588);
        const x0 = Math.max(0, x), x1 = Math.min(W, x + ancho);
        if (x1 - x0 > 2) bloques.push({ x: x0, y: Math.floor(f.y), w: Math.ceil(x1 - x0), h: Math.ceil(f.alto) + 1, t0: desdeAbajo * 0.66 + rnd() * 0.22 });
        x += ancho;
      }
    });
    const max = Math.max.apply(null, bloques.map((b) => b.t0));
    const dur = 0.14;
    bloques.forEach((b) => { b.t0 = b.t0 / max * (1 - dur); b.dur = dur; });
    return bloques;
  };

  /* ==================================================================================
     El módulo
     ================================================================================== */
  function montar(el, opciones) {
    const opc = opciones || {};
    const raiz = document.documentElement;
    const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
    let vivo = true;
    let nodo = null;
    let respaldo = [];
    const limpiar = [];
    const fachada = { p: 0, objetivo: 0, tiempo: -1, raf: 0, ultimo: 0 };
    const figuras = [];
    let coord = 0;           // rAF de la actualización por scroll
    let ioFiguras = null;

    const quieto = () => opc.movimiento === false || mqReduce.matches || opc.densidad === 'sobria' || raiz.classList.contains('densidad-sobria');

    /* ------------------------------------------------------------------
       1. La fachada en cinco tiempos
       ------------------------------------------------------------------ */
    const montarFachada = (datos, esQuieto) => {
      const F = datos.fachada;
      const nT = F.tiempos.length;
      const sec = h('section', { class: 'ob-fachada ' + (esQuieto ? 'ob-fachada--quieto' : 'ob-fachada--mov'), 'aria-labelledby': 'ob-f-tit' });
      const escena = h('div', { class: 'ob-fachada__escena' });
      const marco = h('div', { class: 'ob-fachada__marco', role: 'img', 'aria-label': F.tiempos[0].alt });
      const pila = h('div', { class: 'ob-fachada__pila' });
      const imgs = F.tiempos.map((t, i) => {
        const f = foto(datos, t.foto, t.alt, { eager: i === 0, sizes: '(min-width: 900px) 46vw, 94vw' });
        f.img.className = 'ob-f-img' + (i === 0 ? ' es-activa' : '');
        pila.appendChild(f.pic);
        return f;
      });
      marco.appendChild(pila);
      const lienzo = h('canvas', { class: 'ob-fachada__lienzo', 'aria-hidden': 'true' });   // se añade al marco solo si hay movimiento
      const barra = h('div', { class: 'ob-fachada__barra', 'aria-hidden': 'true' }, h('i'));
      for (let i = 0; i < nT; i++) barra.appendChild(h('b', { style: 'left:' + (i / (nT - 1) * 100) + '%' }));
      marco.appendChild(barra);

      const lado = h('div', { class: 'ob-fachada__lado' });
      lado.appendChild(h('h3', { id: 'ob-f-tit', class: 'ob-titulo', texto: F.titulo }));
      lado.appendChild(h('p', { class: 'ob-intro', texto: F.intro }));
      const lista = h('ol', { class: 'ob-tiempos' });
      const botones = F.tiempos.map((t, i) => {
        const b = h('button', { type: 'button', class: 'ob-tiempo', 'data-i': i, 'aria-label': (i + 1) + ' de ' + nT + ': ' + t.titulo },
          h('span', { class: 'ob-tiempo__n', 'aria-hidden': 'true', texto: String(i + 1) }),
          h('span', { class: 'ob-tiempo__t', texto: t.titulo }));
        lista.appendChild(h('li', null, b));
        return b;
      });
      lado.appendChild(lista);
      const detalle = h('div', { class: 'ob-detalle', 'aria-live': 'polite' });
      const detTit = h('p', { class: 'ob-detalle__tit' });
      const detTxt = h('p', { class: 'ob-detalle__txt' });
      detalle.appendChild(detTit); detalle.appendChild(detTxt);
      lado.appendChild(detalle);
      lado.appendChild(h('p', { class: 'ob-nota', texto: F.nota + ' ' + F.fuente }));

      escena.appendChild(marco); escena.appendChild(lado); sec.appendChild(escena);

      let activo = -1;
      const ponerTiempo = (i) => {
        if (i === activo) return;
        activo = i;
        botones.forEach((b, k) => {
          b.classList.toggle('es-activo', k === i); b.classList.toggle('es-pasado', k < i);
          if (k === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
        });
        const t = F.tiempos[i];
        detTit.textContent = (i + 1) + '. ' + t.titulo;
        detTxt.textContent = t.texto;
        marco.setAttribute('aria-label', t.alt);
        sec.dataset.tiempo = String(i);
        fachada.tiempo = i;
        imgs.forEach((f, k) => f.img.classList.toggle('es-activa', k === i));
      };
      ponerTiempo(0);

      /* ---- lienzo: se rehace la casa, tiempo a tiempo ---- */
      let ctx = null, cargadas = null, W = 0, H = 0, sillares = null, anchoCss = 0;
      const prepararLienzo = () => {
        const mayor = datos.imagenes[F.tiempos[0].foto];
        const css = marco.clientWidth || 480;
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        // el ancho de archivo más cercano por arriba al que se necesita; nunca más que el original
        const want = css * dpr;
        const ancho = mayor.anchos.filter((a) => a >= want)[0] || mayor.anchos[mayor.anchos.length - 1];
        return Promise.all(F.tiempos.map((t) => new Promise((ok, ko) => {
          const im = new Image();
          im.decoding = 'async';
          im.onload = () => ok(im);
          im.onerror = () => {
            const im2 = new Image(); im2.onload = () => ok(im2); im2.onerror = ko;
            im2.src = IMG + t.foto + '-' + ancho + '.jpg';
          };
          im.src = IMG + t.foto + '-' + ancho + '.webp';
        }))).then((ims) => {
          cargadas = ims; W = ims[0].naturalWidth; H = ims[0].naturalHeight;
          lienzo.width = W; lienzo.height = H;
          ctx = lienzo.getContext('2d');
          sillares = generarSillares(W, H);
          marco.insertBefore(lienzo, barra);
          marco.classList.add('con-lienzo');
        });
      };
      const pintar = (p) => {
        if (!ctx) return;
        const t = p * (nT - 1);
        const k = Math.min(nT - 2, Math.floor(t + 1e-9));
        const f = t - k;
        const q = suave(lim((f - 0.22) / 0.56));
        ctx.globalAlpha = 1;
        ctx.clearRect(0, 0, W, H);
        if (q >= 1) { ctx.drawImage(cargadas[k + 1], 0, 0, W, H); return; }
        ctx.drawImage(cargadas[k], 0, 0, W, H);
        if (q <= 0) return;
        const B = cargadas[k + 1];
        for (let i = 0; i < sillares.length; i++) {
          const s = sillares[i];
          const e = lim((q - s.t0) / s.dur);
          if (e <= 0) continue;
          const dy = -(1 - salir(e)) * 9;
          ctx.globalAlpha = Math.min(1, e * 1.6);
          ctx.drawImage(B, s.x, s.y, s.w, s.h, s.x, s.y + dy, s.w, s.h);
        }
        ctx.globalAlpha = 1;
      };

      /* ---- el progreso: de 0 a 1 mientras la escena está fijada ---- */
      let modo = '';
      let st = null, pinST = null;
      const cabPx = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cab')) || 72;
      // el «top» del sticky solo cambia con el ancho (es --cab): no se pregunta al estilo en cada cuadro
      let anchoLeido = -1, arribaLeido = 0;
      const arribaPx = () => {
        if (anchoLeido !== innerWidth) {
          anchoLeido = innerWidth;
          const t = parseFloat(getComputedStyle(escena).top);
          arribaLeido = isNaN(t) ? (sec.classList.contains('ob-fachada--pin') ? cabPx() : 0) : t;
        }
        return arribaLeido;
      };
      const medir = () => {
        const r = sec.getBoundingClientRect();
        const rec = sec.offsetHeight - escena.offsetHeight;
        return rec > 0 ? lim((arribaPx() - r.top) / rec) : (r.top < 0 ? 1 : 0);
      };
      const aplicar = (v) => {
        fachada.p = v;
        pintar(v);
        const i = Math.round(v * (nT - 1));
        ponerTiempo(i);
        barra.firstChild.style.transform = 'scaleX(' + v.toFixed(4) + ')';
        sec.dataset.progreso = v.toFixed(3);
      };
      const paso = (ahora) => {
        fachada.raf = 0;
        if (!vivo) return;
        const dt = Math.min(0.1, (ahora - (fachada.ultimo || ahora)) / 1000) || 1 / 60;
        fachada.ultimo = ahora;
        const dif = fachada.objetivo - fachada.p;
        const v = Math.abs(dif) < 0.0004 ? fachada.objetivo : fachada.p + dif * (1 - Math.exp(-dt / 0.07));
        aplicar(v);
        if (v !== fachada.objetivo) fachada.raf = requestAnimationFrame(paso); else fachada.ultimo = 0;
      };
      const pedir = (v) => {
        fachada.objetivo = lim(v);
        if (!fachada.raf) { fachada.ultimo = 0; fachada.raf = requestAnimationFrame(paso); }
      };
      const alScroll = () => { if (modo === 'mov') pedir(medir()); };
      const irATiempo = (i) => {
        if (modo === 'mov') {
          const r = sec.getBoundingClientRect();
          const rec = sec.offsetHeight - escena.offsetHeight;
          const y = scrollY + r.top - arribaPx() + rec * (i / (nT - 1));
          scrollTo({ top: y, behavior: 'auto' });
        } else { ponerTiempo(i); }
      };
      botones.forEach((b, i) => b.addEventListener('click', () => irATiempo(i)));
      // flechas dentro de la lista (en el modo quieto es la forma de recorrer los cinco tiempos)
      lista.addEventListener('keydown', (ev) => {
        const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[ev.key];
        if (!d) return;
        const aqui = botones.indexOf(document.activeElement);
        const i = lim((aqui < 0 ? activo : aqui) + d, 0, nT - 1);
        if (i === aqui) return;
        ev.preventDefault(); irATiempo(i); botones[i].focus();
      });

      const ponerModo = () => {
        const nuevo = esQuieto ? 'quieto' : 'mov';
        if (nuevo === modo) return;
        modo = nuevo;
        if (nuevo === 'quieto') {
          sec.dataset.modo = 'quieto';
          return;
        }
        const roto = stickyRoto(sec);
        const STr = window.ScrollTrigger;
        if (roto && !STr) { sec.classList.replace('ob-fachada--mov', 'ob-fachada--quieto'); sec.dataset.modo = 'quieto'; modo = 'quieto'; esQuieto = true; return; }
        sec.dataset.modo = 'mov';
        sec.classList.toggle('ob-fachada--pin', roto);
        if (roto && STr) {
          pinST = STr.create({ trigger: sec, start: 'top ' + cabPx() + 'px', end: () => '+=' + Math.max(1, sec.offsetHeight - escena.offsetHeight), pin: escena, pinSpacing: false });
        }
        prepararLienzo().then(() => { if (vivo) { fachada.p = medir(); aplicar(fachada.p); fachada.objetivo = fachada.p; } })
          .catch(() => { /* sin lienzo: la pila de fotos hace de respaldo, con cambio seco */
            imgs.forEach((f, k) => f.img.classList.toggle('es-activa', k === activo));
            sec.classList.add('sin-lienzo');
          });
      };
      // se llama con la sección ya en el documento (hay que medir y mirar los ancestros)
      const iniciar = () => {
        ponerModo();
        if (modo === 'mov') { fachada.p = fachada.objetivo = medir(); aplicar(fachada.p); }
      };

      return {
        el: sec, iniciar,
        destruir: () => {
            if (fachada.raf) cancelAnimationFrame(fachada.raf);
          if (pinST) { try { pinST.kill(true); } catch (e) { /* nada */ } }
          if (st) { try { st.kill(); } catch (e) { /* nada */ } }
        },
        alScroll
      };
    };

    /* ------------------------------------------------------------------
       2. Las parejas
       ------------------------------------------------------------------ */
    // el deslizador: role="slider" en la mano; arrastrar en la pista o en la foto, o con el teclado
    const crearPista = (etiqueta, alCambiar, pista0) => {
      const pista = h('div', { class: 'ob-pista' });
      const riel = h('div', { class: 'ob-pista__riel' }, h('i', { class: 'ob-pista__lleno' }));
      const mano = h('div', {
        class: 'ob-pista__mano', role: 'slider', tabindex: '0', 'aria-orientation': 'horizontal',
        'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0', 'aria-valuetext': '0 % después', 'aria-label': etiqueta
      });
      riel.appendChild(mano);
      pista.appendChild(h('span', { class: 'ob-pista__ext', 'aria-hidden': 'true', texto: 'Antes' }));
      pista.appendChild(riel);
      pista.appendChild(h('span', { class: 'ob-pista__ext', 'aria-hidden': 'true', texto: 'Después' }));
      const poner = (p) => {
        const n = Math.round(lim(p) * 100);
        mano.setAttribute('aria-valuenow', String(n));
        mano.setAttribute('aria-valuetext', n + ' % después');
        pista.style.setProperty('--p', (lim(p) * 100).toFixed(2) + '%');
      };
      const desdeX = (x) => { const r = riel.getBoundingClientRect(); return lim((x - r.left) / (r.width || 1)); };
      let arr = false;
      pista.addEventListener('pointerdown', (ev) => {
        if (ev.button !== undefined && ev.button > 0) return;
        arr = true; try { pista.setPointerCapture(ev.pointerId); } catch (e) { /* nada */ }
        mano.focus({ preventScroll: true });
        alCambiar(desdeX(ev.clientX)); ev.preventDefault();
      });
      pista.addEventListener('pointermove', (ev) => { if (arr) alCambiar(desdeX(ev.clientX)); });
      const suelta = () => { arr = false; };
      pista.addEventListener('pointerup', suelta); pista.addEventListener('pointercancel', suelta);
      mano.addEventListener('keydown', (ev) => {
        const actual = +mano.getAttribute('aria-valuenow') / 100;
        const d = { ArrowRight: 0.05, ArrowUp: 0.05, ArrowLeft: -0.05, ArrowDown: -0.05, PageUp: 0.2, PageDown: -0.2 }[ev.key];
        if (d !== undefined) { alCambiar(lim(actual + d)); ev.preventDefault(); }
        else if (ev.key === 'Home') { alCambiar(0); ev.preventDefault(); }
        else if (ev.key === 'End') { alCambiar(1); ev.preventDefault(); }
      });
      poner(pista0 || 0);
      return { el: pista, mano, poner };
    };

    const figuraTira = (datos, f) => {
      const fig = h('figure', { class: 'ob-fig ob-tira', 'data-id': f.id });
      fig.appendChild(h('figcaption', { class: 'ob-fig__tit' }, h('h5', { texto: f.titulo })));
      const cols = f.fotos.length === 3 ? 3 : 2;
      const fila = h('div', { class: 'ob-tira__fotos', style: '--cols:' + cols });
      f.fotos.forEach((x) => {
        const m = datos.imagenes[x.nombre];
        const fo = foto(datos, x.nombre, x.alt, { sizes: '(min-width: 900px) ' + Math.round(62 / cols) + 'vw, ' + Math.round(92 / (window.innerWidth < 600 ? 2 : 1)) + 'vw' });
        const c = h('figure', { class: 'ob-foto' + (m.ancho < 520 ? ' es-chica' : '') });
        const caja = h('div', { class: 'ob-foto__caja', style: 'aspect-ratio:' + m.ancho + '/' + m.alto }, fo.pic);
        c.appendChild(caja);
        if (x.etiqueta) c.appendChild(h('figcaption', { class: 'ob-foto__et', texto: x.etiqueta }));
        fila.appendChild(c);
      });
      fig.appendChild(fila);
      if (f.pie) fig.appendChild(h('p', { class: 'ob-fig__pie', texto: f.pie }));
      const c1 = cita(f.cita); if (c1) fig.appendChild(c1);
      const c2 = cita(f.cita2); if (c2) fig.appendChild(c2);
      return { fig, id: f.id, tipo: 'tira' };
    };

    const figuraPicar = (datos, f, esQuieto) => {
      const nombres = f.fotos;
      const solo = nombres.length === 1;          // el horno: la capa de yeso es un dibujo
      const fig = h('figure', { class: 'ob-fig ob-par' + (solo ? ' ob-par--yeso' : ''), 'data-id': f.id });
      fig.appendChild(h('figcaption', { class: 'ob-fig__tit' }, h('h5', { texto: f.titulo })));
      const ult = datos.imagenes[nombres[nombres.length - 1]];
      const marco = h('div', { class: 'ob-par__marco', style: 'aspect-ratio:' + ult.ancho + '/' + ult.alto, role: 'group', 'aria-label': f.titulo });
      const capas = nombres.map((n, i) => {
        const fo = foto(datos, n, (f.alts && f.alts[i]) || altDe(datos, n), { sizes: '(min-width: 900px) 52vw, 94vw' });
        fo.img.className = 'ob-par__img';
        marco.appendChild(fo.pic);
        return fo;
      });
      let lienzo = null;
      const et = f.etiquetas || [];
      const rotulos = h('div', { class: 'ob-par__rot', 'aria-hidden': 'true' });
      const rotA = h('span', { class: 'ob-par__rot-a' }), rotB = h('span', { class: 'ob-par__rot-b' });
      rotulos.appendChild(rotA); rotulos.appendChild(rotB);
      fig.appendChild(marco);

      const estado = { id: f.id, tipo: 'picar', p: 0, manual: false, enVista: false, modo: '', dibujado: -1 };
      fig.dataset.p = '0.000';
      let pista = null;
      const ponerP = (p, deUsuario) => {
        p = lim(p);
        if (deUsuario) estado.manual = true;
        estado.p = p;
        fig.dataset.p = p.toFixed(3);
        if (pista) pista.poner(p);
        if (estado.modo === 'picar') pintarPicar(p); else if (estado.modo === 'dividir') pintarDividir(p);
        // el rótulo dice qué se ve (en dividir, a la izquierda lo que llega y a la derecha lo que se va)
        if (!solo) {
          const n = nombres.length;
          const nom = (k) => et[k] || (k === 0 ? 'Antes' : k === n - 1 ? 'Después' : 'Durante');
          if (estado.modo === 'dividir') {
            const seg = Math.min(n - 2, Math.floor(p * (n - 1) + 1e-9));
            rotA.textContent = nom(seg + 1); rotB.textContent = nom(seg);
          } else { rotA.textContent = nom(Math.round(p * (n - 1))); rotB.textContent = ''; }
        }
      };

      // ---------- picar
      let ctx = null, capa = null, cctx = null, W = 0, H = 0, trozos = null, r = 1, fuentes = [], yeso = null;
      const hechoPicar = { listo: false, cargando: false };
      const prepararPicar = () => {
        if (hechoPicar.listo || hechoPicar.cargando) return;
        hechoPicar.cargando = true;
        capas.forEach((c) => { c.img.loading = 'eager'; });
        Promise.all(capas.map((c) => (c.img.decode ? c.img.decode().catch(() => null) : null))).then(() => {
          if (!vivo) return;
          // medidas del archivo (naturalWidth de un <img> con srcset sale ampliado a lo que pide `sizes`: no vale)
          W = ult.ancho; H = ult.alto;
          if (solo) { yeso = crearYeso(W, H); fuentes = [yeso, capas[0].img]; } else fuentes = capas.map((c) => c.img);
          trozos = generarTrozos(W, H, f.id.length * 977 + 2010, f.ultimo || null);
          lienzo = lienzo || h('canvas', { class: 'ob-par__lienzo', 'aria-hidden': 'true' });
          marco.appendChild(lienzo);
          ajustarLienzo();
          hechoPicar.listo = true;
          capas.forEach((c) => { c.img.style.opacity = '0'; });
          marco.classList.add('con-lienzo');
          pintarPicar(estado.p);
        });
      };
      const ajustarLienzo = () => {
        if (!lienzo) return;
        const css = marco.clientWidth || W;
        const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
        const ancho = Math.max(1, Math.min(W, 720, Math.round(css * dpr)));
        r = ancho / W;
        lienzo.width = ancho; lienzo.height = Math.round(H * r);
        ctx = lienzo.getContext('2d');
        capa = document.createElement('canvas'); capa.width = lienzo.width; capa.height = lienzo.height;
        cctx = capa.getContext('2d');
        estado.dibujado = -1;
      };
      const ruta = (g, poly) => {
        g.beginPath(); g.moveTo(poly[0][0], poly[0][1]);
        for (let i = 1; i < poly.length; i++) g.lineTo(poly[i][0], poly[i][1]);
        g.closePath();
      };
      const pintarPicar = (p) => {
        if (!hechoPicar.listo || !ctx) return;
        const nSeg = fuentes.length - 1;
        const s = Math.min(nSeg - 1, Math.floor(p * nSeg + 1e-9));
        const q = lim(p * nSeg - s);
        const clave = s * 10 + q;
        if (Math.abs(clave - estado.dibujado) < 0.0004) return;
        estado.dibujado = clave;
        const A = fuentes[s], B = fuentes[s + 1];
        ctx.setTransform(r, 0, 0, r, 0, 0);
        ctx.globalAlpha = 1;
        ctx.clearRect(0, 0, W, H);
        if (q >= 0.9999) { ctx.drawImage(B, 0, 0, W, H); return; }
        if (q <= 0.0001) { ctx.drawImage(A, 0, 0, W, H); return; }
        ctx.drawImage(B, 0, 0, W, H);
        // la capa de arriba con los huecos de los trozos que ya se han soltado
        cctx.setTransform(r, 0, 0, r, 0, 0);
        cctx.globalCompositeOperation = 'source-over';
        cctx.clearRect(0, 0, W, H);
        cctx.drawImage(A, 0, 0, W, H);
        cctx.globalCompositeOperation = 'destination-out';
        cctx.lineWidth = 1.6; cctx.strokeStyle = '#000'; cctx.fillStyle = '#000';
        for (let i = 0; i < trozos.length; i++) {
          const t = trozos[i];
          if (q <= t.t0) break;
          ruta(cctx, t.poly); cctx.fill(); cctx.stroke();
        }
        cctx.globalCompositeOperation = 'source-over';
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(capa, 0, 0);
        ctx.setTransform(r, 0, 0, r, 0, 0);
        // los trozos que están cayendo, y el polvo
        for (let i = 0; i < trozos.length; i++) {
          const t = trozos[i];
          if (q <= t.t0) break;
          const u = (q - t.t0) / DUR;
          if (u >= 1) continue;
          const v = u < 0.16 ? 0 : (u - 0.16) / 0.84;
          const grieta = u < 0.16 ? u / 0.16 : 1;
          const tx = t.gx * grieta + t.dx * v, ty = t.gy * grieta + t.caida * H * 0.55 * v * v + 14 * v;
          const ang = t.rot * v * v;
          const alfa = 1 - suave(lim((v - 0.5) / 0.5));
          ctx.save();
          ctx.globalAlpha = alfa;
          ctx.translate(t.cx + tx, t.cy + ty); ctx.rotate(ang); ctx.translate(-t.cx, -t.cy);
          if (v > 0) {
            ctx.fillStyle = 'rgba(32,26,18,.22)'; ctx.save(); ctx.translate(3, 5); ruta(ctx, t.poly); ctx.fill(); ctx.restore();
            
          }
          ruta(ctx, t.poly); ctx.clip();
          ctx.drawImage(A, t.x0, t.y0, t.x1 - t.x0, t.y1 - t.y0, t.x0, t.y0, t.x1 - t.x0, t.y1 - t.y0);
          ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(255,255,255,.5)'; ruta(ctx, t.poly); ctx.stroke();
          ctx.restore();
        }
        for (let i = 0; i < trozos.length; i++) {
          const t = trozos[i];
          if (q <= t.t0) break;
          const u = (q - t.t0) / DUR;
          if (u <= 0.04 || u >= 0.8) continue;
          const w = (u - 0.04) / 0.76;
          for (let k = 0; k < t.polvo.length; k++) {
            const pv = t.polvo[k];
            const x = t.cx + pv.ox + pv.vx * w * 26, y = t.cy + pv.oy - w * 24 + w * w * 12;
            const rad = pv.r * (0.7 + 1.2 * w);
            const a = 0.3 * Math.sin(w * Math.PI) * (1 - 0.3 * w);
            ctx.globalAlpha = a;
            ctx.drawImage(polvoSprite(), x - rad, y - rad, rad * 2, rad * 2);
          }
        }
        ctx.globalAlpha = 1;
      };

      // ---------- dividir (sobria / sin lienzo): fotos apiladas, la línea reparte
      const pintarDividir = (p) => {
        const n = capas.length;
        if (solo) return;
        const t = p * (n - 1);
        for (let i = 1; i < n; i++) {
          // la capa i cubre por la izquierda lo que le toca: 0 hasta que t llega a i-1, todo cuando t llega a i
          const c = lim(t - (i - 1));
          capas[i].img.style.clipPath = 'inset(0 ' + ((1 - c) * 100).toFixed(2) + '% 0 0)';
        }
        const seg = Math.min(n - 2, Math.floor(t + 1e-9));
        const c = lim(t - seg);
        marco.style.setProperty('--linea', (c * 100).toFixed(2) + '%');
      };

      const ponerModoFig = () => {
        const nuevo = solo ? (esQuieto ? 'foto' : 'picar') : (esQuieto ? 'dividir' : 'picar');
        estado.modo = nuevo;
        fig.dataset.modo = nuevo;
        marco.classList.toggle('es-dividir', nuevo === 'dividir');
        marco.classList.toggle('es-picar', nuevo === 'picar');
        if (nuevo === 'dividir') {
          capas.forEach((c, i) => { c.img.style.opacity = '1'; if (i === 0) c.img.style.clipPath = ''; });
          marco.appendChild(h('div', { class: 'ob-par__linea', 'aria-hidden': 'true' }));
          marco.appendChild(rotulos);
          estado.p = 0.5;
        } else if (nuevo === 'picar') {
          capas.forEach((c, i) => { c.img.style.opacity = (i === 0 && !solo) ? '1' : '0'; });
          if (!solo) marco.appendChild(rotulos);
        } else {
          capas.forEach((c) => { c.img.style.opacity = '1'; });
        }
      };
      ponerModoFig();

      if (estado.modo !== 'foto') {      // el horno en la sobria es la foto sola: no hay antes con que comparar
        const etq = solo ? 'Destapar el horno: ' + f.titulo : 'Comparar el antes y el después: ' + f.titulo;
        pista = crearPista(etq, (v) => ponerP(v, true), estado.p);
        fig.appendChild(pista.el);
      }
      if (f.pie) fig.appendChild(h('p', { class: 'ob-fig__pie', texto: f.pie }));
      const c1 = cita(f.cita); if (c1) fig.appendChild(c1);
      const c2 = cita(f.cita2); if (c2) fig.appendChild(c2);

      // arrastrar en la propia foto (en táctil, solo en horizontal: el scroll vertical se queda)
      if (estado.modo !== 'foto') {
        let d0 = null;
        const aX = (x) => { const rr = marco.getBoundingClientRect(); return lim((x - rr.left) / (rr.width || 1)); };
        marco.addEventListener('pointerdown', (ev) => {
          if (ev.button !== undefined && ev.button > 0) return;
          d0 = { x: ev.clientX, y: ev.clientY, id: ev.pointerId, activo: ev.pointerType === 'mouse', tipo: ev.pointerType };
          if (d0.activo) { try { marco.setPointerCapture(ev.pointerId); } catch (e) { /* nada */ } }
        });
        marco.addEventListener('pointermove', (ev) => {
          if (!d0) return;
          if (!d0.activo) {
            const dx = ev.clientX - d0.x, dy = ev.clientY - d0.y;
            if (Math.abs(dx) > 9 && Math.abs(dx) > Math.abs(dy) * 1.4) { d0.activo = true; try { marco.setPointerCapture(ev.pointerId); } catch (e) { /* nada */ } } else return;
          }
          // en picar, arrastrar a la derecha pica; en dividir, la línea sigue al dedo
          ponerP(estado.modo === 'dividir' ? aX(ev.clientX) : aX(ev.clientX), true);
        });
        const fin = () => { d0 = null; };
        marco.addEventListener('pointerup', fin); marco.addEventListener('pointercancel', fin);
      }

      if (estado.modo === 'dividir') ponerP(0.5, false);
      else if (estado.modo === 'foto') { /* la foto sola */ }

      // el scroll lleva el progreso mientras nadie lo toque
      const porScroll = () => {
        if (estado.modo !== 'picar' || estado.manual) return;
        const rr = marco.getBoundingClientRect();
        const vh = innerHeight;
        const p = lim((vh * 0.86 - rr.top) / (rr.height + vh * 0.22));
        if (Math.abs(p - estado.p) > 0.0005) ponerP(p, false);
      };
      let ro = null;
      if (window.ResizeObserver) {
        ro = new ResizeObserver(() => { if (hechoPicar.listo) { ajustarLienzo(); pintarPicar(estado.p); } });
        ro.observe(marco);
      }
      estado.porScroll = porScroll;
      estado.preparar = () => { if (estado.modo === 'picar') prepararPicar(); };
      estado.salir = () => { estado.manual = false; };
      estado.fig = fig; estado.marco = marco;
      estado.destruir = () => { if (ro) ro.disconnect(); };
      estado.poner = (p) => ponerP(p, true);
      return { fig, estado };
    };

    // alt de una foto de la lista de la fachada/figuras (para las capas que no traen el suyo)
    const altDe = (datos, nombre) => {
      for (const s of datos.paradas) for (const f of s.figuras) {
        if (f.tipo === 'tira') { const x = f.fotos.find((q) => q.nombre === nombre); if (x) return x.alt; }
        else if (f.fotos.indexOf(nombre) >= 0) {
          const i = f.fotos.indexOf(nombre);
          return (f.alts && f.alts[i]) || (f.etiquetas ? f.etiquetas[i] + ': ' : '') + f.titulo;
        }
      }
      return nombre;
    };

    const montarLinea = (datos, esQuieto) => {
      const sec = h('section', { class: 'ob-linea', 'aria-labelledby': 'ob-l-tit' });
      sec.appendChild(h('h3', { id: 'ob-l-tit', class: 'ob-titulo ob-titulo--linea', texto: 'Lo que se fue destapando' }));
      const spine = h('div', { class: 'ob-linea__eje', 'aria-hidden': 'true' }, h('i'));
      sec.appendChild(spine);
      const lista = h('ol', { class: 'ob-linea__lista' });
      datos.paradas.forEach((p) => {
        const li = h('li', { class: 'ob-parada', id: 'ob-p-' + p.id, 'data-parada': p.id, 'data-largo': p.etiqueta.length > 4 ? 'si' : 'no' });
        const sello = h('div', { class: 'ob-parada__sello' },
          h('span', { class: 'ob-parada__ano', texto: p.etiqueta }),
          h('span', { class: 'ob-parada__sub', texto: p.sub }));
        const cuerpo = h('div', { class: 'ob-parada__cuerpo' });
        cuerpo.appendChild(h('h4', { class: 'ob-parada__tit', texto: p.titulo }));
        cuerpo.appendChild(h('p', { class: 'ob-parada__txt', texto: p.texto }));
        const c = cita(p.cita); if (c) cuerpo.appendChild(c);
        if (p.id === 'hoy') {
          const a = h('a', { class: 'ob-boton', href: '#reservar', texto: 'Ver fechas' });
          a.addEventListener('click', (ev) => {
            const E = window.Entremuros;
            if (E && typeof E.reservar === 'function') { ev.preventDefault(); E.reservar(); }
          });
          cuerpo.appendChild(a);
        }
        if (p.figuras.length) {
          const fs = h('div', { class: 'ob-figuras' });
          p.figuras.forEach((f) => {
            if (f.tipo === 'picar') {
              const r = figuraPicar(datos, f, esQuieto);
              figuras.push(r.estado); fs.appendChild(r.fig);
            } else {
              const r = figuraTira(datos, f); fs.appendChild(r.fig);
            }
          });
          cuerpo.appendChild(fs);
        }
        li.appendChild(sello); li.appendChild(cuerpo);
        lista.appendChild(li);
      });
      sec.appendChild(lista);
      return sec;
    };

    /* ------------------------------------------------------------------
       3. Todo junto
       ------------------------------------------------------------------ */
    let fachadaInst = null;
    let eje = null;
    const actualizar = () => {
      coord = 0;
      if (!vivo) return;
      if (fachadaInst) fachadaInst.alScroll();
      figuras.forEach((f) => { if (f.enVista) f.porScroll(); });
      if (eje) {
        const lista = nodo.querySelector('.ob-linea__lista');
        const r = lista.getBoundingClientRect();
        const centro = innerHeight * 0.55;
        eje.style.transform = 'scaleY(' + lim((centro - r.top) / Math.max(1, r.height)).toFixed(4) + ')';
      }
    };
    const pedirActualizar = () => { if (!coord) coord = requestAnimationFrame(actualizar); };

    const construir = (datos) => {
      if (!vivo) return;
      const esQuieto = quieto();
      nodo = h('div', { class: 'ob ' + (esQuieto ? 'ob--quieto' : 'ob--mov') });
      nodo.dataset.modo = esQuieto ? 'quieto' : 'mov';
      fachadaInst = montarFachada(datos, esQuieto);
      // las dos piezas necesitan estar en el documento para medir
      const linea = montarLinea(datos, esQuieto);
      nodo.appendChild(fachadaInst.el);
      nodo.appendChild(linea);
      respaldo = Array.prototype.slice.call(el.children).map((n) => { const hh = n.hidden; n.hidden = true; return { n, h: hh }; });
      el.appendChild(nodo);
      el.dataset.montado = '1';
      fachadaInst.iniciar();
      eje = linea.querySelector('.ob-linea__eje i');

      if ('IntersectionObserver' in window) {
        ioFiguras = new IntersectionObserver((es) => {
          es.forEach((e) => {
            const f = figuras.find((x) => x.marco === e.target);
            if (!f) return;
            const antes = f.enVista;
            f.enVista = e.isIntersecting;
            if (e.isIntersecting) { f.preparar(); pedirActualizar(); }
            else if (antes) f.salir();
          });
        }, { rootMargin: '700px 0px' });
        figuras.forEach((f) => ioFiguras.observe(f.marco));
      } else figuras.forEach((f) => { f.enVista = true; f.preparar(); });

      window.addEventListener('scroll', pedirActualizar, { passive: true });
      limpiar.push(() => window.removeEventListener('scroll', pedirActualizar));
      pedirActualizar();
      nodo.dataset.listo = '1';
      if (window.ScrollTrigger) { try { window.ScrollTrigger.refresh(); } catch (e) { /* nada */ } }
    };

    pedirDatos().then(construir).catch((err) => {
      // sin datos: se queda el respaldo de la web
      if (window.console) console.warn('[obra] se queda el respaldo:', err && err.message);
    });

    const instancia = {
      destruir() {
        vivo = false;
        if (coord) cancelAnimationFrame(coord);
        limpiar.forEach((f) => { try { f(); } catch (e) { /* nada */ } });
        if (ioFiguras) ioFiguras.disconnect();
        if (fachadaInst) fachadaInst.destruir();
        figuras.forEach((f) => f.destruir && f.destruir());
        if (nodo && nodo.parentNode) nodo.parentNode.removeChild(nodo);
        respaldo.forEach((rr) => { rr.n.hidden = rr.h; });
        delete el.dataset.montado;
        if (window.ScrollTrigger) { try { window.ScrollTrigger.refresh(); } catch (e) { /* nada */ } }
      },
      // para las pruebas: qué hay montado
      estado() {
        return {
          modo: nodo ? nodo.dataset.modo : null,
          fachada: { p: fachada.p, tiempo: fachada.tiempo },
          figuras: figuras.map((f) => ({ id: f.id, modo: f.modo, p: f.p, manual: f.manual }))
        };
      },
      figura(id) { return figuras.find((f) => f.id === id) || null; }
    };
    el.__obra = instancia;
    return instancia;
  }

  window.Entremuros = window.Entremuros || {};
  // __prueba: solo para pruebas/obra-prueba.mjs (comprueba que los trozos embaldosan el marco sin huecos)
  window.Entremuros.obra = { montar, __prueba: { generarTrozos, generarSillares, DUR } };
})();
