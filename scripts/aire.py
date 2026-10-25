#!/usr/bin/env python3
"""
aire.py · ortofoto PNOA (IGN) de Casa Entremuros a cinco escalas encajadas, para el zoom «Del plato al mar».

  - WMS del IGN: https://www.ign.es/wms-inspire/pnoa-ma  (LAYERS=OI.OrthoimageCoverage, EPSG:4326, WMS 1.3.0)
  - Todos los niveles comparten el MISMO centro y la misma proyeccion (plate carree con los metros por grado de la
    latitud del centro en ambos ejes), asi que un nivel es exactamente el anterior a escala 1/r: el cruce es exacto
    por construccion. `--verificar` lo mide de verdad (correlacion de fase entre un nivel y el siguiente).
  - Salida: img/aire/aire-N.{avif,webp,jpg}, img/aire/aire.json (encuadres, rotulos) y img/aire/casa.json.
  Fuente: PNOA, (c) Instituto Geografico Nacional de Espana, CC BY 4.0.

Uso:  python scripts/aire.py              descarga y escribe todo
      python scripts/aire.py --verificar  ademas mide los cruces (error en px y en metros)
"""
import io, json, math, os, sys, time, urllib.request, urllib.parse
import numpy as np
import cv2
from PIL import Image
try:
    import pillow_avif  # noqa: F401
except Exception:
    pass

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(RAIZ, 'img', 'aire')
WMS = 'https://www.ign.es/wms-inspire/pnoa-ma'

# Centro del encuadre: el conjunto de la casa (casa grande, casita de la piscina, piscina, alpendre).
CENTRO = (43.247102, -8.736950)
# Punto de la casa grande (el que se marca). Localizado comparando la ortofoto con la vista aerea de IG 248.
CASA = (43.247028, -8.736777)

# anchos en metros de cada nivel y pixeles de lado
NIVELES = [(160, 2000), (480, 2000), (1500, 2000), (5000, 2000), (16000, 2400), (80000, 3500)]
# cada nivel es un cuadrado de `ancho` metros centrado en CENTRO: un viewport de cualquier proporcion (de 360x640 a 2560x1080) queda cubierto
# si su ancho visible en metros (y el desplazamiento de la camara) cabe dentro; el ultimo nivel es mas ancho que el mayor encuadre final.

# Tejados de la casa en pixeles del nivel 0 (2000 x 2000, 160 m): trazados a mano sobre la ortofoto (casa grande en L, casita de la
# piscina, edificio de piedra pequeno y la propia piscina). Es el contorno que se dibuja un momento con la tinta de la mesa.
TEJADOS = {
    'casa-grande': [(1100, 1000), (1140, 948), (1258, 948), (1258, 1140), (1228, 1180), (1200, 1258), (1172, 1262), (1068, 1205), (1100, 1140), (1130, 1075)],
    'casita': [(800, 888), (955, 888), (955, 1075), (800, 1078)],
    'edificio-piedra': [(725, 668), (865, 668), (865, 775), (725, 775)],
    'piscina': [(700, 862), (810, 862), (810, 955), (700, 955)],
}

# Rotulos (OSM/Nominatim, leidos el 2026-10-25). `min` solo cuando lo dice la casa (DATOS).
LUGARES = [
    {'id': 'casa', 'nombre': 'Casa Entremuros', 'lat': CASA[0], 'lon': CASA[1]},
    {'id': 'cances', 'nombre': 'Cances', 'lat': 43.2473, 'lon': -8.7340, 'nota': 'caserio de Cances Grande (nodo de OSM)'},
    {'id': 'malpica', 'nombre': 'Malpica', 'lat': 43.3252843, 'lon': -8.8292583, 'min': '10 min'},
    {'id': 'sisargas', 'nombre': 'Islas Sisargas', 'lat': 43.3596458, 'lon': -8.8445827},
    {'id': 'razo', 'nombre': 'Razo', 'lat': 43.2904055, 'lon': -8.7062144, 'min': '15 min'},
    {'id': 'baldaio', 'nombre': 'Baldaio', 'lat': 43.2962117, 'lon': -8.6842333, 'min': '15 min'},
    {'id': 'carballo', 'nombre': 'Carballo', 'lat': 43.2134123, 'lon': -8.6891286},
]


def metros_por_grado(lat):
    p = math.radians(lat)
    mlat = 111132.92 - 559.82 * math.cos(2 * p) + 1.175 * math.cos(4 * p)
    mlon = 111412.84 * math.cos(p) - 93.5 * math.cos(3 * p)
    return mlat, mlon


MLAT, MLON = metros_por_grado(CENTRO[0])


def bbox(ancho_m):
    dlat = ancho_m / 2 / MLAT
    dlon = ancho_m / 2 / MLON
    return (CENTRO[0] - dlat, CENTRO[1] - dlon, CENTRO[0] + dlat, CENTRO[1] + dlon)  # latmin, lonmin, latmax, lonmax


def descargar(ancho_m, px):
    s, w, n, e = bbox(ancho_m)
    q = {'SERVICE': 'WMS', 'VERSION': '1.3.0', 'REQUEST': 'GetMap', 'LAYERS': 'OI.OrthoimageCoverage', 'STYLES': '',
         'CRS': 'EPSG:4326', 'BBOX': f'{s:.7f},{w:.7f},{n:.7f},{e:.7f}', 'WIDTH': px, 'HEIGHT': px, 'FORMAT': 'image/jpeg'}
    url = WMS + '?' + urllib.parse.urlencode(q, safe=',:')
    for intento in range(4):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'casa-entremuros-propuesta/1.0 (alvarotaiagu@gmail.com)'})
            with urllib.request.urlopen(req, timeout=120) as r:
                datos = r.read()
                if r.headers.get_content_type() != 'image/jpeg':
                    raise RuntimeError('respuesta no es imagen: ' + datos[:200].decode('utf8', 'ignore'))
                return Image.open(io.BytesIO(datos)).convert('RGB')
        except Exception as ex:
            print('  reintento', intento + 1, ex)
            time.sleep(3 * (intento + 1))
    raise SystemExit('no se pudo descargar ' + url)


def mar_sintetico(a, sin):
    """Niveles muy anchos: el WMS mezcla ortofoto y satelite y deja el mar en teselas grises o vacias. El mar se repinta entero:
    turquesa junto a la costa y azul marino mar adentro (un degradado por distancia a la tierra); la tierra no se toca."""
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    mar = ((sin > 0) | ((a.max(axis=2) < 125) & (a.max(axis=2) - a.min(axis=2) < 32) & (b >= g - 8))).astype(np.uint8)
    mar = cv2.morphologyEx(mar, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    mar = cv2.morphologyEx(mar, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(mar)
    grande = np.zeros_like(mar)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] > 40000:
            grande[lab == i] = 1
    dist = cv2.distanceTransform(grande, cv2.DIST_L2, 5)
    t = np.clip(dist / 16.0, 0, 1)[..., None]
    col = np.array([34, 116, 142], np.float32) * (1 - t) + np.array([8, 34, 62], np.float32) * t
    m = cv2.GaussianBlur(grande.astype(np.float32), (0, 0), 2.2)[..., None]
    out = a.astype(np.float32) * (1 - m) + col * m
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def rellenar_sin_datos(im, ancho_m=0):
    """El WMS devuelve blanco o negro puro donde no hay ortofoto (mar abierto). Se rellena con el azul marino del mar real de la
    propia imagen, con bordes blandos, para que el zoom final no tenga rectangulos vacios ni parches de otro color."""
    a = np.array(im)
    sin = (((a >= 248).all(axis=2)) | ((a <= 6).all(axis=2))).astype(np.uint8)
    if sin.sum() < 500:
        return im
    sin = cv2.morphologyEx(sin, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    sin = cv2.dilate(sin, np.ones((15, 15), np.uint8))
    if ancho_m >= 50000:
        return mar_sintetico(a, sin)
    col = np.array([9, 36, 66], np.float32)
    m = cv2.GaussianBlur(sin.astype(np.float32), (0, 0), 9)[..., None]
    out = a.astype(np.float32) * (1 - m) + col[None, None, :] * m
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def guardar(im, k):
    base = os.path.join(SALIDA, f'aire-{k}')
    im.save(base + '.webp', quality=72, method=6)
    im.save(base + '.jpg', quality=70, optimize=True, progressive=True)
    try:
        im.save(base + '.avif', quality=48, speed=6)
    except Exception as ex:
        print('  sin AVIF:', ex)


def pix_de(lat, lon, ancho_m, px):
    """Pixel (x, y) de un punto en el nivel de ancho `ancho_m`."""
    x = (lon - CENTRO[1]) * MLON / ancho_m * px + px / 2
    y = (CENTRO[0] - lat) * MLAT / ancho_m * px + px / 2
    return x, y


def verificar(imagenes):
    """Mide el cruce entre niveles: recorta del nivel k+1 la parte que cubre el nivel k, la lleva a su tamano y busca el
    desplazamiento (correlacion de fase) respecto al nivel k reducido. Error en px del nivel k y en metros."""
    res = []
    for k in range(len(NIVELES) - 1):
        (wk, pk), (w2, p2) = NIVELES[k], NIVELES[k + 1]
        a = np.array(imagenes[k].convert('L'), np.float32)
        b = np.array(imagenes[k + 1].convert('L'), np.float32)
        r = wk / w2                                  # fraccion del nivel k+1 que cubre el nivel k
        lado = p2 * r
        x0 = p2 / 2 - lado / 2
        # trabajamos a la resolucion del nivel mas grueso (la del recorte), para comparar lo comparable
        n = int(round(lado))
        recorte = cv2.warpAffine(b, np.float32([[1, 0, -x0], [0, 1, -x0]]), (n, n), flags=cv2.INTER_CUBIC)
        ref = cv2.resize(a, (n, n), interpolation=cv2.INTER_AREA)
        # quita el tono de fondo y compara estructura (ventana de Hanning)
        def pre(z):
            z = z - cv2.GaussianBlur(z, (0, 0), 12)
            return z
        win = cv2.createHanningWindow((n, n), cv2.CV_32F)
        (dx, dy), resp = cv2.phaseCorrelate(pre(ref), pre(recorte), win)
        m_por_px = wk / n
        err_px_k = math.hypot(dx, dy) * (pk / n)
        res.append({'nivel': k, 'a_nivel': k + 1, 'dx_px': round(dx, 2), 'dy_px': round(dy, 2), 'respuesta': round(float(resp), 3),
                    'error_px_nivel_k': round(err_px_k, 2), 'error_m': round(math.hypot(dx, dy) * m_por_px, 2),
                    'comparado_a_px': n, 'ancho_recorte_m': wk})
        print(f'  cruce {k}->{k+1}: desplazamiento ({dx:+.2f}, {dy:+.2f}) px a {n} px  = {math.hypot(dx, dy) * m_por_px:.2f} m  (respuesta {resp:.2f})')
    return res


def main():
    os.makedirs(SALIDA, exist_ok=True)
    imagenes = []
    for k, (ancho, px) in enumerate(NIVELES):
        ruta = os.path.join(SALIDA, f'aire-{k}.jpg')
        print(f'nivel {k}: {ancho} m, {px} px ({ancho / px:.2f} m/px)')
        if '--cache' in sys.argv and os.path.exists(ruta):
            im = Image.open(ruta).convert('RGB')
        else:
            im = rellenar_sin_datos(descargar(ancho, px), ancho)
            guardar(im, k)
        imagenes.append(im)
    niveles = []
    for k, (ancho, px) in enumerate(NIVELES):
        s, w, n, e = bbox(ancho)
        niveles.append({'nivel': k, 'ancho_m': ancho, 'px': px, 'm_por_px': round(ancho / px, 4), 'bbox_latlon': [round(s, 7), round(w, 7), round(n, 7), round(e, 7)],
                        'archivo': f'aire-{k}', 'ratio_con_anterior': round(ancho / NIVELES[k - 1][0], 3) if k else None})
    lugares = []
    for l in LUGARES:
        d = dict(l)
        d['x'] = [round(pix_de(l['lat'], l['lon'], a, p)[0] / p, 5) for a, p in NIVELES]   # fraccion 0-1 en cada nivel
        d['y'] = [round(pix_de(l['lat'], l['lon'], a, p)[1] / p, 5) for a, p in NIVELES]
        lugares.append(d)
    datos = {
        'fuente': 'PNOA (c) Instituto Geografico Nacional de Espana, CC BY 4.0 · https://www.ign.es/wms-inspire/pnoa-ma · LAYERS=OI.OrthoimageCoverage · EPSG:4326 · leido el ' + time.strftime('%Y-%m-%d'),
        'centro': {'lat': CENTRO[0], 'lon': CENTRO[1]}, 'casa': {'lat': CASA[0], 'lon': CASA[1]},
        'metros_por_grado': {'lat': round(MLAT, 3), 'lon': round(MLON, 3)},
        'niveles': niveles, 'lugares': lugares,
        'casa_xy': [{'nivel': k, 'x': round(pix_de(CASA[0], CASA[1], a, p)[0] / p, 5), 'y': round(pix_de(CASA[0], CASA[1], a, p)[1] / p, 5)} for k, (a, p) in enumerate(NIVELES)],
    }
    # encuadre final del zoom: lo que la casa quiere ensenar (la casa, Malpica, las Sisargas, Razo, Baldaio y Carballo)
    pts = [(l['lat'], l['lon']) for l in LUGARES if l['id'] in ('casa', 'malpica', 'sisargas', 'razo', 'baldaio', 'carballo')]
    la0, la1 = min(p[0] for p in pts), max(p[0] for p in pts)
    lo0, lo1 = min(p[1] for p in pts), max(p[1] for p in pts)
    datos['encuadre_final'] = {'lat': [round(la0, 6), round(la1, 6)], 'lon': [round(lo0, 6), round(lo1, 6)],
                               'centro_m': [round(((lo0 + lo1) / 2 - CENTRO[1]) * MLON, 1), round(((la0 + la1) / 2 - CENTRO[0]) * MLAT, 1)],
                               'ancho_m': round((lo1 - lo0) * MLON, 1), 'alto_m': round((la1 - la0) * MLAT, 1)}
    datos['tejados_nivel0_px'] = TEJADOS
    datos['casa_m'] = [round((CASA[1] - CENTRO[1]) * MLON, 2), round((CASA[0] - CENTRO[0]) * MLAT, 2)]
    if '--verificar' in sys.argv:
        print('verificando cruces...')
        datos['cruces'] = verificar(imagenes)
    with open(os.path.join(SALIDA, 'aire.json'), 'w', encoding='utf-8') as f:
        json.dump(datos, f, indent=1, ensure_ascii=False)
    casa = {
        'lat': CASA[0], 'lon': CASA[1], 'centro_encuadre': {'lat': CENTRO[0], 'lon': CENTRO[1]}, 'certeza': 'alta, sin confirmar por la casa',
        'como': ('Localizada en la ortofoto PNOA comparandola con la vista aerea de 2015 (IG 248, ref/fotos/instagram/0248_7sB1YDwNH7_1.jpg): '
                 'la piscina rectangular con su terraza de piedra, la casita de teja a cuatro aguas junto a ella, la casa grande de teja en L con '
                 'su patio, el pequeno edificio de piedra con tejado de teja y el cesped con la pista, todo en la misma disposicion (la foto de IG '
                 'esta tomada desde el lado opuesto). Hay otra piscina en el caserio (mas al este); esta es la que cuadra con IG 248. '
                 'El nodo de OSM de Cances Grande (43.24730, -8.73401) es el caserio, no la casa. Pendiente: que la casa confirme el punto.'),
        'punto_marcado': 'casa grande (el tejado de teja en L del extremo este del conjunto)',
    }
    with open(os.path.join(SALIDA, 'casa.json'), 'w', encoding='utf-8') as f:
        json.dump(casa, f, indent=1, ensure_ascii=False)
    print('ok img/aire/aire.json, casa.json')


if __name__ == '__main__':
    main()
