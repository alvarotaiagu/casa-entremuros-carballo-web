#!/usr/bin/env python3
"""
placa.py · redibuja el letrero de piedra de Casa Entremuros (IG 221, 0221_1).

Pasos (receta de feedback_logo_jpg_redibujar_rectas):
  1. Endereza la foto con una homografia sobre las 4 esquinas de la placa
     (1240 x 1000, sistema de coordenadas del SVG).
  2. Dibuja la placa con sus medidas leidas en la foto enderezada: marco rebajado,
     CASA / ENTREMUROS. (incisas, un poco irregulares), la vieira con sus
     estrias y sus bisagras, y los dos abanicos con sus rayos.
  3. Escribe marca/placa.svg con grupos con id (#marco #casa #entremuros #punto
     #vieira #abanico-izq #abanico-der) y los datos que usan la cortina y la web.
  4. Mide el parecido con la foto (IoU) y escribe marca/placa-medidas.json y
     pruebas/mesa-placa-foto.jpg (la foto enderezada, para la pagina de prueba).

Uso:  python scripts/placa.py            (desde la raiz de casa-entremuros-carballo-web)
      python scripts/placa.py --medir    (ademas calcula el IoU)
"""
import json, math, os, sys, random
try:
    import pillow_avif  # noqa: F401
except Exception:
    pass
import numpy as np
import cv2

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FOTO = os.path.join(RAIZ, 'ref', 'fotos', 'instagram', '0221_BD5OhMYwNK2_1.jpg')
W, H = 1240, 1000
# esquinas exteriores de la placa en la foto (px de la foto), en orden TL TR BR BL
ESQ = np.float32([[64, 285], [662, 279], [658, 763], [72, 753]])

rnd = random.Random(221)  # semilla fija: las irregularidades de cantero son siempre las mismas


# ---------------------------------------------------------------- geometria
def jit(pts, a=1.3):
    return [(x + rnd.uniform(-a, a), y + rnd.uniform(-a, a)) for x, y in pts]


def R(x0, y0, x1, y1, a=1.2):
    return jit([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], a)


def arc(cx, cy, rx, ry, a0, a1, n=18):
    out = []
    for i in range(n + 1):
        t = math.radians(a0 + (a1 - a0) * i / n)
        out.append((cx + rx * math.cos(t), cy + ry * math.sin(t)))
    return out


def trazo(pts, w):
    """Polilinea gruesa -> poligono (offset a ambos lados, juntas en inglete)."""
    n = len(pts)
    izq, der = [], []
    for i in range(n):
        if i == 0:
            dx, dy = pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]
        elif i == n - 1:
            dx, dy = pts[-1][0] - pts[-2][0], pts[-1][1] - pts[-2][1]
        else:
            dx, dy = pts[i + 1][0] - pts[i - 1][0], pts[i + 1][1] - pts[i - 1][1]
        L = math.hypot(dx, dy) or 1
        nx, ny = -dy / L, dx / L
        izq.append((pts[i][0] + nx * w / 2, pts[i][1] + ny * w / 2))
        der.append((pts[i][0] - nx * w / 2, pts[i][1] - ny * w / 2))
    return izq + der[::-1]


def cuna(p0, p1, w0, w1):
    """Ranura en V: de p0 (ancho w0) a p1 (ancho w1)."""
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    L = math.hypot(dx, dy) or 1
    nx, ny = -dy / L, dx / L
    return [(p0[0] + nx * w0 / 2, p0[1] + ny * w0 / 2), (p1[0] + nx * w1 / 2, p1[1] + ny * w1 / 2),
            (p1[0] - nx * w1 / 2, p1[1] - ny * w1 / 2), (p0[0] - nx * w0 / 2, p0[1] - ny * w0 / 2)]


# ---------------------------------------------------------------- letras
# cada letra: lista de poligonos (el relleno nonzero los une); 'huecos' = contraluces (evenodd)
def letra_E(x0, x1, top, bot=346, s=30, brazo_med=0.82):
    m = (top + bot) / 2
    return [R(x0, top, x0 + s, bot), R(x0, top, x1, top + s - 2), R(x0, m - s / 2 + 2, x0 + (x1 - x0) * brazo_med - 8, m + s / 2 - 1),
            R(x0, bot - s + 2, x1, bot)]


def letra_N(x0, x1, top, bot=346, s=29):
    return [R(x0, top + 14, x0 + s, bot), R(x1 - 23, top, x1, bot),
            jit([(x0, top + 14), (x0 + s + 2, top + 14), (x1, bot - 16), (x1, bot), (x1 - s - 2, bot), (x0, top + 34)])]


def letra_T(x0, x1, top, bot=346, s=29, sx=None):
    sx = sx if sx is not None else (x0 + x1) / 2 - s / 2
    return [R(x0, top, x1, top + s - 2), R(sx, top, sx + s, bot)]


def poligono_bowl(x0, x1, top, y_med, s):
    """Panza de la R: anillo redondeado. Devuelve (exterior, hueco)."""
    r = (y_med - top) / 2
    ext = [(x0, top), (x1 - r, top)] + arc(x1 - r, top + r, r, r, -90, 90, 10) + [(x0, y_med)]
    ri = max(r - s, 4)
    inte = [(x0 + s, top + s), (x1 - r, top + s)] + arc(x1 - r, top + r, ri, ri, -90, 90, 10) + [(x0 + s, y_med - s)]
    return ext, inte


def letra_R(x0, x1, top, bot=346, s=29, y_med=None):
    y_med = y_med or top + (bot - top) * 0.52
    ext, inte = poligono_bowl(x0, x1, top, y_med, s - 3)
    return {'rel': [R(x0, top, x0 + s, bot), jit(ext), jit([(x0 + s + 6, y_med - 6), (x0 + s + 34, y_med - 6), (x1 + 4, bot), (x1 - 26, bot)])],
            'huecos': [jit(inte, 0.6)]}


def letra_M(x0, x1, top, bot=346, s=27):
    ax = (x0 + x1) / 2 - 8
    return [R(x0, top + 22, x0 + s, bot), R(x1 - s, top, x1, bot),
            jit(trazo([(x0 + s * 0.5 + 6, top + 26), (ax, bot - 22)], s - 4), 0.6),
            jit(trazo([(x1 - s * 0.5 - 4, top + 14), (ax, bot - 22)], s - 6), 0.6)]


def letra_U(x0, x1, top, bot=346, s=27):
    r = (x1 - x0) / 2
    # copa: de izquierda a derecha por abajo
    base = [(x0, top), (x0, bot - r)] + [(x0 + r - r * math.cos(math.radians(a)), bot - r + r * math.sin(math.radians(a))) for a in range(0, 181, 12)] + [(x1, bot - r), (x1, top)]
    ri = r - s
    inte = [(x1 - s, top), (x1 - s, bot - r)] + [(x0 + r + ri * math.cos(math.radians(a)), bot - r + ri * math.sin(math.radians(a))) for a in range(0, 181, 12)] + [(x0 + s, bot - r), (x0 + s, top)]
    # las dos puntas de la U, abierta por arriba: se rellena la copa y se quita el hueco
    return {'rel': [jit(base, 1.0)], 'huecos': [jit(inte, 0.6)], 'abierta': True}


def letra_O(x0, x1, top, bot=346, s=26):
    cx, cy = (x0 + x1) / 2, (top + bot) / 2
    rx, ry = (x1 - x0) / 2, (bot - top) / 2
    n = 32
    ext = [(cx + rx * math.copysign(abs(math.cos(t)) ** 0.62, math.cos(t)), cy + ry * math.copysign(abs(math.sin(t)) ** 0.62, math.sin(t))) for t in [2 * math.pi * i / n for i in range(n)]]
    rxi, ryi = rx - s, ry - s
    inte = [(cx + rxi * math.copysign(abs(math.cos(t)) ** 0.62, math.cos(t)), cy + ryi * math.copysign(abs(math.sin(t)) ** 0.62, math.sin(t))) for t in [2 * math.pi * i / n for i in range(n)]]
    return {'rel': [jit(ext, 0.9)], 'huecos': [jit(inte, 0.6)]}


def letra_S(x0, x1, top, bot=346, s=28):
    cx = (x0 + x1) / 2
    h = bot - top
    pts = [(x1 - 6, top + h * 0.20), (x1 - 22, top + 8), (cx, top + 2), (x0 + 14, top + 12), (x0 + 6, top + h * 0.28), (x0 + 16, top + h * 0.42),
           (cx, top + h * 0.52), (x1 - 12, top + h * 0.62), (x1 - 6, top + h * 0.77), (x1 - 18, bot - 10), (cx, bot - 2), (x0 + 16, bot - 10), (x0 + 4, bot - h * 0.18)]
    # suavizado Catmull-Rom
    q = catmull(pts, 8)
    return [jit(trazo(q, s), 0.5)]


def catmull_cerrada(p, n=6):
    k = len(p)
    out = []
    for i in range(k):
        p0, p1, p2, p3 = p[(i - 1) % k], p[i], p[(i + 1) % k], p[(i + 2) % k]
        for j in range(n):
            t = j / n
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3) for c in (0, 1)))
    return out


def catmull(p, n=8):
    out = []
    P = [p[0]] + p + [p[-1]]
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in (0, 1)))
    out.append(P[-2])
    return out


def letra_C(x0, x1, top, bot, s=22):
    cx, cy = (x0 + x1) / 2, (top + bot) / 2
    rx, ry = (x1 - x0) / 2 - s / 2, (bot - top) / 2 - s / 2
    pts = [(cx + rx * math.cos(math.radians(a)), cy + ry * math.sin(math.radians(a))) for a in range(-40, -321, -20)]
    return [jit(trazo(pts, s), 0.5)]


def letra_A(x0, x1, top, bot, s=22):
    xm = (x0 + x1) / 2
    return [jit([(xm - s * 0.6, top), (xm + s * 0.6, top), (x1, bot), (x1 - s, bot), (xm, top + s * 1.6), (x0 + s, bot), (x0, bot)], 0.8),
            R(x0 + (x1 - x0) * 0.25, bot - (bot - top) * 0.36, x1 - (x1 - x0) * 0.25, bot - (bot - top) * 0.36 + s * 0.8, 0.6)]


def letra_S_casa(x0, x1, top, bot, s=22):
    cx = (x0 + x1) / 2
    h = bot - top
    pts = [(x1 - 4, top + h * 0.22), (x1 - 18, top + 6), (cx, top), (x0 + 12, top + 10), (x0 + 6, top + h * 0.30), (x0 + 14, top + h * 0.45),
           (cx, top + h * 0.52), (x1 - 10, top + h * 0.63), (x1 - 4, top + h * 0.78), (x1 - 16, bot - 8), (cx, bot), (x0 + 14, bot - 8), (x0 + 2, bot - h * 0.2)]
    return [jit(trazo(catmull(pts, 8), s), 0.5)]


def construir_letras():
    """Devuelve dict nombre -> {'rel': [poligonos], 'huecos': [poligonos]} en coordenadas 1240x1000."""
    L = {}
    def put(k, v):
        L[k] = v if isinstance(v, dict) else {'rel': v, 'huecos': []}
    # ENTREMUROS. (medidas leidas en la foto enderezada)
    put('E1', letra_E(112, 192, 203))
    put('N', letra_N(203, 298, 213))
    put('T', letra_T(297, 392, 225, sx=346))
    put('R1', letra_R(402, 483, 224))
    put('E2', letra_E(497, 580, 226, brazo_med=0.74))
    put('M', letra_M(584, 681, 217))
    put('U', letra_U(700, 768, 228))
    put('R2', letra_R(775, 862, 230))
    put('O', letra_O(884, 959, 226))
    put('S', letra_S(982, 1063, 222, 348))
    # CASA
    put('C', letra_C(480, 541, 96, 197))
    put('A1', letra_A(546, 614, 96, 197))
    put('S2', letra_S_casa(622, 695, 96, 198))
    put('A2', letra_A(700, 773, 96, 197))
    return L


# ---------------------------------------------------------------- vieira y abanicos
def px(x, y):
    return (400 + x / 2.2, 340 + y / 2.2)


VIEIRA_CUERPO = [(550, 365), (614, 360), (682, 367), (734, 395), (773, 431), (800, 476), (814, 522), (814, 576), (811, 622), (800, 654),
                 (755, 679), (709, 704), (677, 717), (655, 726), (605, 726), (559, 708), (514, 690), (464, 667), (441, 635), (425, 595),
                 (423, 535), (436, 485), (464, 431), (505, 385)]
# ranuras de la vieira: (extremo exterior, extremo interior, ancho exterior, ancho interior)
VIEIRA_RANURAS = [
    (px(230, 180), px(328, 520), 6.5, 2.5), (px(255, 190), px(362, 388), 5.0, 2.0), (px(80, 405), px(322, 530), 6.0, 2.5),
    (px(470, 65), px(402, 440), 6.0, 2.0), (px(490, 100), px(552, 420), 5.5, 2.0), (px(735, 160), px(572, 490), 8.0, 2.5),
    (px(745, 175), px(636, 550), 6.0, 2.0), (px(893, 425), px(648, 555), 8.0, 2.5), (px(895, 430), px(600, 830), 9.0, 2.5),
    (px(150, 725), px(365, 810), 5.0, 2.0),
]
VIEIRA_BISAGRA_PTS = [(523, 719), (550, 735), (605, 742), (654, 740), (714, 724), (720, 726), (714, 760), (673, 779), (625, 790), (582, 779), (545, 765), (532, 740)]

VIEIRA_CUERPO_PTS = VIEIRA_CUERPO
VIEIRA_CUERPO = catmull_cerrada(VIEIRA_CUERPO_PTS, 6)
VIEIRA_BISAGRA = catmull_cerrada(VIEIRA_BISAGRA_PTS, 6)


# abanicos: ranuras (punta exterior, extremo interior, ancho en la punta) leidas en la foto enderezada
RANURAS_IZQ = [((172, 598), (97, 900), 15), ((300, 668), (113, 905), 14), ((396, 765), (128, 922), 11), ((430, 893), (100, 943), 13)]
BORDE_IZQ = [(104, 574), (60, 640), (60, 880)]  # primer rayo: del borde del marco a la primera ranura
RANURAS_DER = [((1124, 580), (1174, 900), 11), ((1001, 619), (1149, 878), 5), ((895, 712), (1050, 872), 4, False), ((872, 771), (1129, 923), 11), ((822, 894), (1129, 945), 13)]
BORDE_DER = [(1176, 586), (1180, 640), (1182, 900)]


def normal_hacia(a, b, ref):
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy) or 1
    nx, ny = -dy / L, dx / L
    if nx * (ref[0] - a[0]) + ny * (ref[1] - a[1]) < 0:
        nx, ny = -nx, -ny
    return nx, ny


def construir_abanico(ranuras, borde, lado):
    """Rayos = caras en relieve entre dos ranuras consecutivas (recortadas la mitad del ancho de la ranura); ranuras = cunas oscuras."""
    rayos = []
    # primer rayo: entre el borde del marco y la primera ranura
    tip, inn, w = ranuras[0][:3]
    cen = borde[len(borde) // 2]
    n = normal_hacia(tip, inn, cen)
    rayos.append(list(borde) + [(inn[0] + n[0] * 0.5, inn[1] + n[1] * 0.5), (tip[0] + n[0] * w / 2, tip[1] + n[1] * w / 2)])
    div = [r for r in ranuras if len(r) < 4 or r[3]]
    for k in range(len(div) - 1):
        (t0, i0, w0), (t1, i1, w1) = div[k][:3], div[k + 1][:3]
        c = ((t0[0] + t1[0] + i0[0] + i1[0]) / 4, (t0[1] + t1[1] + i0[1] + i1[1]) / 4)
        n0 = normal_hacia(t0, i0, c)
        n1 = normal_hacia(t1, i1, c)
        rayos.append([(t0[0] + n0[0] * w0 / 2, t0[1] + n0[1] * w0 / 2), (t1[0] + n1[0] * w1 / 2, t1[1] + n1[1] * w1 / 2),
                      (i1[0] + n1[0] * 0.5, i1[1] + n1[1] * 0.5), (i0[0] + n0[0] * 0.5, i0[1] + n0[1] * 0.5)])
    cunas = [cuna(r[0], r[1], r[2], 0.8) for r in ranuras]
    return rayos, cunas


# ---------------------------------------------------------------- SVG
def area(pl):
    return 0.5 * sum(pl[i][0] * pl[(i + 1) % len(pl)][1] - pl[(i + 1) % len(pl)][0] * pl[i][1] for i in range(len(pl)))


def d_poligonos(polys, dec=1, huecos=()):
    """Subtrazados SVG. Los poligonos se orientan (+) y los huecos (-): con fill-rule nonzero se unen y se vacian bien."""
    s = []
    for pl in polys:
        pl = list(pl) if area(pl) > 0 else list(pl)[::-1]
        s.append('M' + ' '.join(f'{x:.{dec}f} {y:.{dec}f}' for x, y in pl) + 'Z')
    for pl in huecos:
        pl = list(pl) if area(pl) < 0 else list(pl)[::-1]
        s.append('M' + ' '.join(f'{x:.{dec}f} {y:.{dec}f}' for x, y in pl) + 'Z')
    return ''.join(s)


def desplazar(v, dx, dy):
    f = lambda pl: [(x + dx, y + dy) for x, y in pl]
    return {'rel': [f(pl) for pl in v['rel']], 'huecos': [f(pl) for pl in v['huecos']], **({'abierta': True} if v.get('abierta') else {})}


def ajustar_letras_a_foto(letras, rect, radio=6):
    """Ajuste fino: cada letra se mueve como mucho `radio` px hasta que su contorno cae sobre las paredes de sombra de la foto."""
    zona = np.zeros((H, W), np.uint8)
    zona[70:365, 100:1105] = 255
    Wm = paredes_foto(rect, zona)
    out, desp = {}, {}
    for k, v in letras.items():
        m = raster_letra(v)
        ys, xs = np.where(m > 0)
        x0, x1, y0, y1 = xs.min() - 6, xs.max() + 7, ys.min() - 6, ys.max() + 7
        cont = cv2.morphologyEx(m, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8))
        dt = cv2.distanceTransform(255 - cont, cv2.DIST_L2, 3)
        wy, wx = np.where(Wm[y0:y1, x0:x1] > 0)
        wy, wx = wy + y0, wx + x0
        best = None
        for dy in range(-radio, radio + 1):
            for dx in range(-radio, radio + 1):
                yy = np.clip(wy - dy, 0, H - 1); xx = np.clip(wx - dx, 0, W - 1)
                sc = float(np.exp(-(dt[yy, xx] / 3.0) ** 2).mean()) - 0.002 * math.hypot(dx, dy)
                if best is None or sc > best[0]:
                    best = (sc, dx, dy)
        _, dx, dy = best
        out[k] = desplazar(v, dx, dy)
        desp[k] = (dx, dy)
    return out, desp


AJUSTADAS = {}


def ajustar_ranuras(ranuras, osc, lim=12):
    """Cada ranura se desplaza en perpendicular (como mucho `lim` px) hasta quedar sobre su cresta oscura de la foto."""
    out = []
    for r in ranuras:
        a, b = np.array(r[0], float), np.array(r[1], float)
        d = b - a; n = np.array([-d[1], d[0]]) / np.hypot(*d)
        mejor = None
        for off in np.arange(-lim, lim + 0.5, 0.5):
            ts = np.linspace(0.08, 0.92, 40)
            pts = a[None] + ts[:, None] * d[None] + off * n[None]
            v = cv2.remap(osc, pts[:, 0].astype(np.float32).reshape(1, -1), pts[:, 1].astype(np.float32).reshape(1, -1), cv2.INTER_LINEAR).mean() - 0.01 * abs(off)
            if mejor is None or v > mejor[0]:
                mejor = (v, off)
        o = mejor[1] * n
        out.append((tuple(a + o), tuple(b + o)) + tuple(r[2:]))
    return out


def construir_datos(ajustar=True):
    letras = construir_letras()
    ranuras_i, ranuras_d = RANURAS_IZQ, RANURAS_DER
    if ajustar:
        rect = rectificar()
        letras, _ = ajustar_letras_a_foto(letras, rect)
        g = cv2.cvtColor(rect, cv2.COLOR_BGR2GRAY).astype(np.float32)
        osc = cv2.GaussianBlur(g, (0, 0), 16) - cv2.GaussianBlur(g, (0, 0), 2.2)
        ranuras_i, ranuras_d = ajustar_ranuras(RANURAS_IZQ, osc), ajustar_ranuras(RANURAS_DER, osc)
    AJUSTADAS['izq'], AJUSTADAS['der'] = ranuras_i, ranuras_d
    izq_r, izq_g = construir_abanico(ranuras_i, BORDE_IZQ, 'izq')
    der_r, der_g = construir_abanico(ranuras_d, BORDE_DER, 'der')
    return letras, (izq_r, izq_g), (der_r, der_g)


def a_svg(letras, izq, der):
    marco_ext = f'M0 0H{W}V{H}H0Z'
    marco_int = 'M47 50H1183V952H47Z'
    # cada letra: <path> con evenodd si tiene huecos
    def path_letra(k):
        v = letras[k]
        return f'<path id="g-{k}" d="{d_poligonos(v["rel"], 1, v["huecos"])}"/>'
    casa = ''.join(path_letra(k) for k in ('C', 'A1', 'S2', 'A2'))
    entre = ''.join(path_letra(k) for k in ('E1', 'N', 'T', 'R1', 'E2', 'M', 'U', 'R2', 'O', 'S'))
    punto = '<circle id="g-punto" cx="1080.5" cy="337.5" r="12.5"/>'
    v_cuerpo = d_poligonos([VIEIRA_CUERPO])
    v_bis = d_poligonos([VIEIRA_BISAGRA])
    v_ran = d_poligonos([cuna(a, b, wa, wb) for a, b, wa, wb in VIEIRA_RANURAS])
    ab_i = d_poligonos(izq[0]), d_poligonos(izq[1])
    ab_d = d_poligonos(der[0]), d_poligonos(der[1])
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-labelledby="pl-t">
<title id="pl-t">Letrero de piedra de Casa Entremuros: «Casa Entremuros.», una vieira y dos abanicos</title>
<!-- Generado por scripts/placa.py a partir de ref/fotos/instagram/0221_BD5OhMYwNK2_1.jpg (enderezada con homografia). No editar a mano. -->
<style>
#pl-placa .pl-campo{{fill:var(--granito, #B6AA98)}}
#pl-placa .pl-marco{{fill:var(--granito-2, #8F8473)}}
#pl-placa .pl-hondo{{fill:var(--tinta-2, #5E574D)}}
#pl-placa .pl-alto{{fill:var(--lino, #F3EEE5)}}
</style>
<g id="pl-placa">
<g id="marco"><path class="pl-campo" d="{marco_ext}"/><path class="pl-marco" fill-rule="evenodd" d="{marco_ext}{marco_int}"/></g>
<g id="casa" class="pl-hondo">{casa}</g>
<g id="entremuros" class="pl-hondo">{entre}</g>
<g id="punto" class="pl-hondo">{punto}</g>
<g id="vieira"><path class="pl-alto" id="vieira-cuerpo" d="{v_cuerpo}"/><path class="pl-alto" id="vieira-bisagra" d="{v_bis}"/><path class="pl-hondo" id="vieira-estrias" d="{v_ran}"/></g>
<g id="abanico-izq"><path class="pl-alto" d="{ab_i[0]}"/><path class="pl-hondo" d="{ab_i[1]}"/></g>
<g id="abanico-der"><path class="pl-alto" d="{ab_d[0]}"/><path class="pl-hondo" d="{ab_d[1]}"/></g>
</g>
</svg>
'''
    return svg


# ---------------------------------------------------------------- rasterizado y medida
def raster(polys, evenodd_pairs=None, size=(W, H)):
    m = np.zeros((size[1], size[0]), np.uint8)
    for pl in polys:
        cv2.fillPoly(m, [np.round(np.array(pl) * 1).astype(np.int32)], 255)
    return m


def raster_letra(v):
    m = raster(v['rel'])
    for h in v['huecos']:
        cv2.fillPoly(m, [np.round(np.array(h)).astype(np.int32)], 0)
    return m


def rectificar():
    im = cv2.imread(FOTO)
    M = cv2.getPerspectiveTransform(ESQ, np.float32([[0, 0], [W, 0], [W, H], [0, H]]))
    return cv2.warpPerspective(im, M, (W, H), flags=cv2.INTER_CUBIC)


def iou(a, b):
    a, b = a > 0, b > 0
    u = (a | b).sum()
    return float((a & b).sum() / u) if u else 0.0


def referencia(foto_rect, prediccion, banda_ext=14, banda_int=7):
    """
    Mascara de referencia sacada de la FOTO: GrabCut con color y relieve, sembrado asi:
      seguro-dentro = prediccion erosionada banda_int px; seguro-fuera = lo que queda a mas de banda_ext px;
      la franja intermedia la decide la foto (bordes de relieve reales).
    """
    g = cv2.cvtColor(foto_rect, cv2.COLOR_BGR2GRAY).astype(np.float32)
    b = cv2.GaussianBlur(g, (0, 0), 1.6)
    hp = np.clip(128 + (b - cv2.GaussianBlur(g, (0, 0), 18)) * 3.5, 0, 255).astype(np.uint8)
    gx = cv2.Sobel(b, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(b, cv2.CV_32F, 0, 1, ksize=3)
    gm = np.clip(np.hypot(gx, gy) * 4, 0, 255).astype(np.uint8)
    img = cv2.merge([hp, gm, cv2.GaussianBlur(g, (0, 0), 1.0).astype(np.uint8)])
    k = lambda r: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
    dentro = cv2.erode(prediccion, k(banda_int))
    fuera = cv2.dilate(prediccion, k(banda_ext))
    mask = np.full(prediccion.shape, cv2.GC_BGD, np.uint8)
    mask[fuera > 0] = cv2.GC_PR_BGD
    mask[prediccion > 0] = cv2.GC_PR_FGD
    mask[dentro > 0] = cv2.GC_FGD
    bg = np.zeros((1, 65)); fg = np.zeros((1, 65))
    # solo trabaja en la caja que rodea a la prediccion
    ys, xs = np.where(fuera > 0)
    y0, y1, x0, x1 = max(ys.min() - 4, 0), min(ys.max() + 5, H), max(xs.min() - 4, 0), min(xs.max() + 5, W)
    sub = img[y0:y1, x0:x1].copy(); sm = mask[y0:y1, x0:x1].copy()
    cv2.grabCut(sub, sm, None, bg, fg, 4, cv2.GC_INIT_WITH_MASK)
    out = np.zeros_like(prediccion)
    out[y0:y1, x0:x1] = np.where((sm == cv2.GC_FGD) | (sm == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    return out


def paredes_foto(foto_rect, zona, pct=82, area_min=160):
    """Paredes de sombra de la foto: lo oscuro frente al fondo, a escala de trazo (sigma 2,4), sin la sal y pimienta del granito."""
    g = cv2.cvtColor(foto_rect, cv2.COLOR_BGR2GRAY).astype(np.float32)
    d = cv2.GaussianBlur(g, (0, 0), 16) - cv2.GaussianBlur(g, (0, 0), 2.4)
    thr = np.percentile(d[zona > 0], pct)
    Wm = ((d > thr) & (zona > 0)).astype(np.uint8) * 255
    Wm = cv2.morphologyEx(Wm, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(Wm)
    out = np.zeros_like(Wm)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] >= area_min:
            out[lab == i] = 255
    return out


def cobertura_paredes(Wm, prediccion, tol=5):
    """Que parte de las paredes de sombra de la foto cae a <= tol px del contorno dibujado, y a cuantos px queda de media."""
    cont = cv2.morphologyEx(prediccion, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8))
    dt = cv2.distanceTransform(255 - cont, cv2.DIST_L2, 3)
    w = Wm > 0
    if not w.any():
        return None
    return float((dt[w] <= tol).mean()), float(dt[w].mean())


def iou_bandas(Wm, prediccion, ancho=6):
    """IoU entre las paredes de la foto y una banda de `ancho` px de radio alrededor del contorno dibujado (solo donde hay pared o banda)."""
    cont = cv2.morphologyEx(prediccion, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8))
    banda = cv2.dilate(cont, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * ancho + 1, 2 * ancho + 1)))
    return iou(banda, Wm), float(((banda > 0) & (Wm > 0)).sum() / max((banda > 0).sum(), 1))


# ---------------------------------------------------------------- arte de la cortina (granito + relieve)
MARGEN = 50   # unidades de margen alrededor de la placa (para la sombra que proyecta)
CORTE_X = 582  # junta entre ENTRE y MUROS, en unidades de la placa


def granito_periodico(n, semilla, grano=1.0, tono=(143, 132, 115), contraste=1.0):
    """Granito sintetico periodico (n x n, BGR float 0-1). Semilla fija. Cuarzo y mica sobre un fondo de feldespato."""
    from scipy.ndimage import gaussian_filter
    rng = np.random.default_rng(semilla)

    def ruido(sig):
        z = gaussian_filter(rng.standard_normal((n, n)), sig, mode='wrap')
        return z / (z.std() + 1e-9)
    base = np.array(tono, np.float32) / 255.0  # RGB 0-1
    img = np.ones((n, n, 3), np.float32) * base[None, None, :]
    nube = ruido(40 * grano) * 0.035 + ruido(14 * grano) * 0.03
    img *= (1 + nube)[..., None]
    rosa = np.clip(ruido(3.2 * grano) - 0.6, 0, None) * 0.05
    img[..., 0] += rosa * 0.9
    img[..., 1] += rosa * 0.45
    fino = ruido(0.9 * grano) * 0.05 * contraste
    img *= (1 + fino)[..., None]
    q = ruido(1.25 * grano)
    img += (np.clip(q - 1.55, 0, None) * 0.22 * contraste)[..., None]
    m = ruido(1.1 * grano)
    mica = np.clip(m - 1.65, 0, None)
    img *= (1 - np.clip(mica * 0.55 * contraste, 0, 0.6))[..., None]
    return np.clip(img, 0, 1)[..., ::-1].copy()  # a BGR


def altura_placa(letras, izq, der, s, M=MARGEN, ss=2):
    """Mapa de alturas de la placa a escala s (px por unidad), con margen M. Devuelve (h, mascaras) a tamano final."""
    Wc, Hc = int(round((W + 2 * M) * s)), int(round((H + 2 * M) * s))
    f = s * ss

    def poly(pl):
        return np.round((np.array(pl) + M) * f).astype(np.int32)

    def capa(polys, huecos=()):
        m = np.zeros((Hc * ss, Wc * ss), np.uint8)
        for pl in polys:
            cv2.fillPoly(m, [poly(pl)], 255, cv2.LINE_AA)
        for pl in huecos:
            cv2.fillPoly(m, [poly(pl)], 0, cv2.LINE_AA)
        return cv2.resize(m, (Wc, Hc), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
    placa = capa([[(0, 0), (W, 0), (W, H), (0, H)]])
    campo = capa([[(47, 50), (1183, 50), (1183, 952), (47, 952)]])
    marco = placa * (1 - campo)
    cuerpo = capa([VIEIRA_CUERPO, VIEIRA_BISAGRA])
    rayos = capa(izq[0] + der[0])
    ranu = capa([cuna(a, b, wa, wb) for a, b, wa, wb in VIEIRA_RANURAS] + izq[1] + der[1])
    let = np.zeros_like(placa)
    for v in letras.values():
        let = np.maximum(let, capa(v['rel'], v['huecos']))
    pun = np.zeros_like(placa)
    cv2.circle(pun, (int((1080.5 + M) * s), int((337.5 + M) * s)), int(12.5 * s), 1.0, -1, cv2.LINE_AA)
    let = np.maximum(let, pun)

    def cupula(mask, radio_px):
        dt = cv2.distanceTransform((mask > 0.5).astype(np.uint8), cv2.DIST_L2, 5)
        t = np.clip(dt / radio_px, 0, 1)
        return mask * (np.sin(t * math.pi / 2) ** 0.8)
    h = np.zeros((Hc, Wc), np.float32)
    h += 1.0 * cupula(marco, 9 * s)
    h += 1.5 * cupula(cuerpo, 26 * s)
    h += 1.2 * cupula(rayos, 12 * s)
    h -= 1.1 * cv2.GaussianBlur(ranu, (0, 0), 1.6 * s)
    h -= 1.5 * cv2.GaussianBlur(let, (0, 0), 1.6 * s)
    return h, {'placa': placa, 'campo': campo, 'marco': marco, 'letras': let, 'cuerpo': cuerpo, 'rayos': rayos, 'ranuras': ranu}


def sombra_rasante(h, escala_h, tan_el, s):
    """Sombras arrojadas por una luz que viene de la izquierda a elevacion tan_el."""
    Hc, Wc = h.shape
    sh = np.zeros_like(h)
    m = np.full(Hc, -1e9, np.float32)
    paso = tan_el / s
    for x in range(Wc):
        col = h[:, x] * escala_h
        m = np.maximum(m - paso, col)
        sh[:, x] = np.clip((m - col) * 2.0, 0, 1)
    return cv2.GaussianBlur(sh, (0, 0), 1.2 * s)


def lambert(h, s, L, relieve=1.0):
    hb = cv2.GaussianBlur(h, (0, 0), 0.9 * s)
    gx = cv2.Sobel(hb, cv2.CV_32F, 1, 0, ksize=3) / 8.0
    gy = cv2.Sobel(hb, cv2.CV_32F, 0, 1, ksize=3) / 8.0
    k = relieve * 30 / s
    nx, ny, nz = -gx * k, -gy * k, np.ones_like(hb)
    n = np.sqrt(nx * nx + ny * ny + nz * nz)
    L = np.array(L, np.float32)
    L = L / np.linalg.norm(L)
    return (nx * L[0] + ny * L[1] + nz * L[2]) / n, float(L[2])


def tex_lino(n=192, semilla=1109):
    """Trama del lino (teselable): hilos de urdimbre y trama de grosor desigual y algun nudillo. RGB uint8."""
    rng = np.random.default_rng(semilla)
    img = np.empty((n, n, 3), np.float32)
    img[:] = (0xEF, 0xE8, 0xDA)
    for eje in (0, 1):
        for i in range(0, n, 2):
            col = np.array((120, 100, 70) if rng.random() > .5 else (255, 252, 244), np.float32)
            a = (0.05 + rng.random() * 0.09) if eje == 0 else (0.04 + rng.random() * 0.08)
            g = 1 + (1 if rng.random() > (.7 if eje == 0 else .75) else 0)
            if eje == 0:
                img[i:i + g, :, :] = img[i:i + g, :, :] * (1 - a) + col * a
            else:
                img[:, i:i + g, :] = img[:, i:i + g, :] * (1 - a) + col * a
    for _ in range(70):
        y, x, l = int(rng.random() * n), int(rng.random() * n), int(6 + rng.random() * 24)
        a = 0.06 + rng.random() * 0.08
        img[y, x:x + l, :] = img[y, x:x + l, :] * (1 - a) + np.array((110, 90, 60), np.float32) * a
    return np.clip(img, 0, 255).astype(np.uint8)


def tex_pino(W=680, H=640, semilla=1919):
    """Cuatro tablas de pino con vetas y un nudo por tabla (teselable en vertical). RGB uint8."""
    rng = np.random.default_rng(semilla)
    base = np.array((0xD2, 0xA4, 0x6A), np.float32)
    img = np.empty((H, W, 3), np.float32)
    tablas, ancho = 4, W // 4
    oscuro = np.zeros((H, W), np.float32)
    claro = np.zeros((H, W), np.float32)
    S = 4
    for i in range(tablas):
        dl = (rng.random() - .5) * 26
        xs = np.linspace(0, 1, ancho)
        f = np.where(xs < .5, dl - 6 + (xs / .5) * 11, dl + 5 - ((xs - .5) / .5) * 9)
        img[:, i * ancho:(i + 1) * ancho, :] = np.clip(base[None, None, :] + f[None, :, None], 0, 255)
        for _ in range(150):
            px = i * ancho + 4 + rng.random() * (ancho - 8)
            py = rng.random() * H
            largo = 120 + rng.random() * 420
            amp = 0.8 + rng.random() * 2.2
            fase = rng.random() * 6.28
            es_osc = rng.random() > .22
            a = (0.05 + rng.random() * 0.13) if es_osc else (0.05 + rng.random() * 0.1)
            gr = max(1, int(round(0.5 + rng.random() * 1.6)))
            capa = oscuro if es_osc else claro
            for k in (-1, 0, 1):
                pts = np.array([(px + math.sin(fase + s / 70) * amp, py + s + k * H) for s in np.arange(0, largo + 1, 12)])
                tmp = np.zeros((H, W), np.float32)
                cv2.polylines(tmp, [np.round(pts * (1 << S)).astype(np.int32)], False, float(a), gr, cv2.LINE_AA, S)
                np.maximum(capa, tmp, out=capa)
        nx, ny = i * ancho + ancho * (0.3 + rng.random() * 0.4), rng.random() * H
        for j in range(7, 0, -1):
            tmp = np.zeros((H, W), np.float32)
            cv2.ellipse(tmp, (int(nx), int(ny)), (int(3 + j * 2.3), int(6 + j * 5.6)), 0, 0, 360, float(0.1 + (7 - j) * 0.035), 1, cv2.LINE_AA)
            np.maximum(oscuro, tmp, out=oscuro)
        cv2.ellipse(oscuro, (int(nx), int(ny)), (3, 7), 0, 0, 360, 0.55, -1, cv2.LINE_AA)
        oscuro[:, max(i * ancho - 1, 0):i * ancho + 1] = 0.5
        claro[:, i * ancho + 1:i * ancho + 2] = 0.28
    osc_col = np.array((120, 76, 32), np.float32)
    cla_col = np.array((255, 236, 196), np.float32)
    img = img * (1 - oscuro[..., None]) + osc_col * oscuro[..., None]
    img = img * (1 - claro[..., None]) + cla_col * claro[..., None]
    return np.clip(img, 0, 255).astype(np.uint8)


def arte():
    """Genera img/mesa/granito-*.webp y placa-*.webp (cortina y pie). Semillas fijas: sale siempre igual."""
    from PIL import Image
    salida = os.path.join(RAIZ, 'img', 'mesa')
    os.makedirs(salida, exist_ok=True)
    letras, izq, der = construir_datos()
    muro = granito_periodico(512, 1, 1.0, (146, 135, 118), 1.0)
    Image.fromarray((muro[..., ::-1] * 255).astype(np.uint8)).save(os.path.join(salida, 'granito-512.webp'), quality=72, method=6)
    Image.fromarray(tex_pino()).save(os.path.join(salida, 'pino-680.webp'), quality=82, method=6)
    Image.fromarray(tex_lino()).save(os.path.join(salida, 'lino-192.webp'), quality=88, method=6)
    info = {}
    for nombre, s in (('lg', 1.0), ('sm', 0.56)):
        h, m = altura_placa(letras, izq, der, s)
        Hc, Wc = h.shape
        n = 2048 if max(Wc, Hc) > 1024 else 1024
        gr = granito_periodico(n, 7, 0.8 * (1.0 if s >= 1 else 0.62), (182, 170, 152), 0.9)
        gr = gr[:Hc, :Wc]
        lam_b, Lz_b = lambert(h, s, (-0.45, -0.45, 0.77))
        lam_r, Lz_r = lambert(h, s, (-0.97, 0.0, 0.24))
        base = np.clip(0.92 + (lam_b - Lz_b) * 1.15, 0.45, 1.25)
        ras = np.clip(0.80 + (lam_r - Lz_r) * 2.2, 0.15, 1.7)
        sh = sombra_rasante(h, 7.0, math.tan(math.radians(13)), s)
        ao = 1 - 0.28 * np.clip(-cv2.GaussianBlur(h, (0, 0), 2.0 * s), 0, 1.4)
        img_b = gr * (base * ao)[..., None] * np.array([1.0, 1.0, 0.985])[None, None, :]
        img_r = gr * (ras * (1 - 0.55 * sh) * ao)[..., None] * np.array([0.90, 0.97, 1.07])[None, None, :]
        img_r = np.clip(img_r, 0, 1)
        img_b = np.clip(img_b, 0, 1)
        placa = m['placa']
        sombra = cv2.GaussianBlur(np.roll(np.roll(placa, int(10 * s), axis=0), int(5 * s), axis=1), (0, 0), 14 * s)
        alfa = np.clip(placa + (1 - placa) * sombra * 0.62, 0, 1)
        sombra_col = np.array([0.05, 0.07, 0.09])[None, None, :]
        for etiqueta, img in (('base', img_b), ('rasante', img_r)):
            out = img * placa[..., None] + (1 - placa)[..., None] * sombra_col
            rgba = np.dstack([(out[..., ::-1] * 255).astype(np.uint8), (alfa * 255).astype(np.uint8)])
            im_c = Image.fromarray(rgba, 'RGBA')
            im_c.save(os.path.join(salida, f'placa-{etiqueta}-{nombre}.webp'), quality=70, method=6)
            try:
                im_c.save(os.path.join(salida, f'placa-{etiqueta}-{nombre}.avif'), quality=46, speed=6)
            except Exception as ex:
                print('sin AVIF:', ex)
        info[nombre] = {'ancho': int(Wc), 'alto': int(Hc), 'escala': s}
        if nombre == 'lg':
            mix = img_b * 0.35 + img_r * 0.65
            out = mix * placa[..., None] + (1 - placa)[..., None] * sombra_col
            rgba = np.dstack([(out[..., ::-1] * 255).astype(np.uint8), (alfa * 255).astype(np.uint8)])
            im = Image.fromarray(rgba, 'RGBA').resize((640, int(round(640 * Hc / Wc))), Image.LANCZOS)
            im.save(os.path.join(salida, 'placa-pie.webp'), quality=76, method=6)
    datos = {'margen': MARGEN, 'placa': [W, H], 'corte_x': CORTE_X,
             'corte_frac': round((MARGEN + CORTE_X) / (W + 2 * MARGEN), 5), 'tamanos': info,
             'nota': 'Generado por scripts/placa.py --arte. corte_frac = posicion de la junta ENTRE|MUROS dentro de la imagen (0-1). Semillas fijas.'}
    with open(os.path.join(salida, 'placa.json'), 'w', encoding='utf-8') as f:
        json.dump(datos, f, indent=1, ensure_ascii=False)
    print('ok img/mesa (granito + placa)', info)


def main():
    medir = '--medir' in sys.argv
    letras, izq, der = construir_datos()
    svg = a_svg(letras, izq, der)
    os.makedirs(os.path.join(RAIZ, 'marca'), exist_ok=True)
    os.makedirs(os.path.join(RAIZ, 'pruebas'), exist_ok=True)
    with open(os.path.join(RAIZ, 'marca', 'placa.svg'), 'w', encoding='utf-8') as f:
        f.write(svg)
    rect = rectificar()
    cv2.imwrite(os.path.join(RAIZ, 'pruebas', 'mesa-placa-foto.jpg'), rect, [cv2.IMWRITE_JPEG_QUALITY, 88])
    # mascaras por grupo
    grupos = {
        'casa': [letras[k] for k in ('C', 'A1', 'S2', 'A2')],
        'entremuros': [letras[k] for k in ('E1', 'N', 'T', 'R1', 'E2', 'M', 'U', 'R2', 'O', 'S')],
    }
    masks = {}
    for nombre, lst in grupos.items():
        m = np.zeros((H, W), np.uint8)
        for v in lst:
            m = cv2.bitwise_or(m, raster_letra(v))
        masks[nombre] = m
    masks['punto'] = cv2.circle(np.zeros((H, W), np.uint8), (1080, 338), 12, 255, -1)
    masks['vieira'] = raster([VIEIRA_CUERPO, VIEIRA_BISAGRA])
    ranuras_v = raster([cuna(a, b, wa, wb) for a, b, wa, wb in VIEIRA_RANURAS])
    ranuras_ab = raster(izq[1] + der[1])
    masks['abanico-izq'] = raster(izq[0])
    masks['abanico-der'] = raster(der[0])
    if medir:
        res = {}
        # paredes de sombra de las letras (zona = cada grupo ensanchado 8 px, sin invadir al otro)
        for nombre in ('casa', 'entremuros'):
            zona = cv2.dilate(masks[nombre], np.ones((17, 17), np.uint8))
            Wm = paredes_foto(rect, zona)
            cob, dist = cobertura_paredes(Wm, masks[nombre])
            ib, prec = iou_bandas(Wm, masks[nombre])
            res[nombre] = {'paredes_cubiertas_5px': round(cob, 3), 'distancia_media_px': round(dist, 2), 'banda_con_pared': round(prec, 3)}
            print(nombre, res[nombre])
        for nombre in ('punto', 'vieira', 'abanico-izq', 'abanico-der'):
            m = masks[nombre]
            ref = referencia(rect, m)
            res[nombre] = {'iou_grabcut': round(iou(m, ref), 3)}
        # ranuras: desplazamiento perpendicular optimo (px) de cada una respecto a la cresta oscura de la foto
        g = cv2.cvtColor(rect, cv2.COLOR_BGR2GRAY).astype(np.float32)
        osc = cv2.GaussianBlur(g, (0, 0), 16) - cv2.GaussianBlur(g, (0, 0), 2.2)
        def desfase(a, b):
            a, b = np.array(a, float), np.array(b, float)
            d = b - a; L = np.hypot(*d); n = np.array([-d[1], d[0]]) / L
            mejor = None
            for off in np.arange(-10, 10.5, 0.5):
                ts = np.linspace(0.08, 0.92, 40)
                pts = a[None] + ts[:, None] * d[None] + off * n[None]
                v = cv2.remap(osc, pts[:, 0:1].astype(np.float32).reshape(1, -1), pts[:, 1:2].astype(np.float32).reshape(1, -1), cv2.INTER_LINEAR).mean()
                if mejor is None or v > mejor[0]:
                    mejor = (v, off)
            return abs(mejor[1])
        gv = [desfase(a, b) for a, b, _, _ in VIEIRA_RANURAS]
        gi = [desfase(t, i) for t, i, *_ in AJUSTADAS['izq']]
        gd = [desfase(t, i) for t, i, *_ in AJUSTADAS['der']]
        res['vieira']['ranuras_desfase_medio_px'] = round(float(np.mean(gv)), 2)
        res['abanico-izq']['ranuras_desfase_medio_px'] = round(float(np.mean(gi)), 2)
        res['abanico-der']['ranuras_desfase_medio_px'] = round(float(np.mean(gd)), 2)
        for k in ('punto', 'vieira', 'abanico-izq', 'abanico-der'):
            print(k, res[k])
        with open(os.path.join(RAIZ, 'marca', 'placa-medidas.json'), 'w', encoding='utf-8') as f:
            json.dump({'foto': 'ref/fotos/instagram/0221_BD5OhMYwNK2_1.jpg', 'esquinas_foto': ESQ.tolist(), 'tamano': [W, H], 'medidas': res}, f, indent=1, ensure_ascii=False)
    print('ok marca/placa.svg')


if __name__ == '__main__':
    if '--arte' in sys.argv:
        arte()
    else:
        main()
