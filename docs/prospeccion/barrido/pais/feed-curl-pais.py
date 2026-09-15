#!/usr/bin/env python3
"""feed-curl-pais.py <giro> [isos…] — el feed de Google Maps con curl, sin Chromium.

Hallazgo (15-sep-2026): la página de Maps pide sus resultados a un XHR
(/search?tbm=map&pb=…) que responde JSON con TODO lo del feed: nombre, las
categorías FINAS («Bridal shop», «Dress store» —las que la Places API no da y
por las que entra un tercio de los lugares del giro—), teléfono, web,
calificación y reseñas. Una página tarda 0.7 s y una consulta da hasta 120
lugares (Bogotá: 85 únicos, contra 36 del feed con Chromium y 60 de la API).
Sustituye a maps-pais.js + lugar-pais.js y no cuesta.

Escribe lo que esperan carga-pais.py y cargar-pais.sh:
  pool-<iso>-<giro>/<md5 de la consulta>.feed.json
  ficha-<iso>/<md5 de la url>.json   (url = https://maps.google.com/?cid=…, la
                                      misma que da la API: el mismo lugar es UNO)
Si la ficha ya existe (la dejó la API) solo se le pone la categoría fina y lo
que le falte. Idempotente: la consulta que ya tiene .feed.json no se repite.

El `pb` de pb-feed.txt es el de una búsqueda real de Maps sin la parte de
sesión; solo se le cambia la consulta (!1s…) y el offset de página (!8i…).
"""
import json, os, sys, time, hashlib, subprocess, urllib.parse
from concurrent.futures import ThreadPoolExecutor
from paises import PAISES

D = os.path.dirname(os.path.abspath(__file__))
GIRO = sys.argv[1]; ISOS = sys.argv[2:] or list(PAISES)
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
PB = open(os.path.join(D, 'pb-feed.txt')).read().strip()
PAGINA, PAGINAS, HILOS = 20, 6, 3
bloqueos = 0

def md5_10(q): return hashlib.md5((q + '\n').encode()).hexdigest()[:10]
def md5_12(u): return hashlib.md5((u + '\n').encode()).hexdigest()[:12]

def pagina(q, gl, off):
    """Una página del feed (20 lugares) ya parseada, o None si Google no contestó JSON."""
    global bloqueos
    pb = PB.replace('!1svestidos de novia Elche', '!1s' + q).replace('!7i20', '!7i20' + (f'!8i{off}' if off else ''))
    url = 'https://www.google.com/search?' + urllib.parse.urlencode({'tbm': 'map', 'authuser': '0', 'hl': 'en', 'gl': gl.lower(), 'q': q, 'pb': pb})
    for intento in range(4):
        r = subprocess.run(['curl', '-s', '--max-time', '25', '-A', UA, '-H', 'Accept-Language: en',
                            '--cookie', 'CONSENT=YES+; SOCS=CAI', url], capture_output=True, text=True).stdout
        if r.startswith(")]}'"):
            try: return json.loads(r[4:])
            except Exception: pass
        bloqueos += 1
        # Google pidió captcha o devolvió HTML: esperar más cada vez en lugar de insistir.
        time.sleep(30 * (intento + 1) if ('sorry' in r[:600].lower() or '<html' in r[:200].lower()) else 3)
    return None

def lugar(e):
    """Un resultado del feed → dict plano. None si no tiene cid (anuncio, sugerencia)."""
    def g(*p):
        o = e
        for i in p:
            if not isinstance(o, list) or len(o) <= i or o[i] is None: return None
            o = o[i]
        return o
    # El cid (el de la URL ?cid= de Maps y de la API) es la segunda mitad hex del
    # feature id «0x…:0x…» de e[10], en decimal. e[227][0][5] parece un cid pero NO es.
    fid = g(10) or ''
    if ':0x' not in fid or not g(11): return None
    cid = int(fid.split(':0x')[1], 16)
    rv = g(37, 1) if isinstance(g(37, 1), (int, float)) else g(4, 8)
    return dict(name=g(11), cats=g(13) or [], cat=(g(13) or [None])[0], web=g(7, 0), rating=g(4, 7), reviews=rv,
                phone=g(178, 0, 1, 1, 0) or g(178, 0, 3), address=g(39), localidad=g(183, 1, 3), cc=g(183, 1, 6),
                url=f'https://maps.google.com/?cid={cid}')

def una(iso, q):
    pool = os.path.join(D, f'pool-{iso}-{GIRO}'); fdir = os.path.join(D, f'ficha-{iso}')
    os.makedirs(pool, exist_ok=True); os.makedirs(fdir, exist_ok=True)
    fp = os.path.join(pool, md5_10(q) + '.feed.json')
    if os.path.exists(fp): return None
    gl = PAISES[iso]['gl']; vistos = {}; paginas = 0
    for off in range(0, PAGINA * PAGINAS, PAGINA):
        d = pagina(q, gl, off)
        if d is None: break
        paginas += 1
        res = d[64] if isinstance(d, list) and len(d) > 64 and isinstance(d[64], list) else []
        nuevos = 0
        for x in res:
            l = lugar(x[1]) if isinstance(x, list) and len(x) > 1 and isinstance(x[1], list) else None
            if l and l['url'] not in vistos: vistos[l['url']] = l; nuevos += 1
        if len(res) < PAGINA or nuevos == 0: break
        time.sleep(0.6)
    feed = []
    for l in vistos.values():
        ff = os.path.join(fdir, md5_12(l['url']) + '.json')
        ficha = {}
        if os.path.exists(ff) and os.path.getsize(ff) > 0:
            try: ficha = json.load(open(ff)) or {}
            except Exception: ficha = {}
        def o(k, v): return ficha.get(k) if ficha.get(k) not in (None, '') else v
        nueva = dict(name=o('name', l['name']), web=o('web', l['web']), phone=o('phone', l['phone']),
                     address=o('address', l['address']), cat=l['cat'] or ficha.get('cat'), cats=l['cats'],
                     rating=o('rating', str(l['rating']) if l['rating'] is not None else None),
                     reviews=o('reviews', str(l['reviews']) if l['reviews'] is not None else None),
                     ig=ficha.get('ig'), estado=ficha.get('estado'), localidad=l['localidad'], feed=True)
        json.dump(nueva, open(ff, 'w'), ensure_ascii=False)
        feed.append(dict(name=l['name'], rating=nueva['rating'], reviews=nueva['reviews'], cat=l['cat'],
                         url=l['url'], web=l['web'], txt='', localidad=l['localidad'], feed=True))
    json.dump(feed, open(fp, 'w'), ensure_ascii=False)
    return (iso, q, len(feed), paginas)

cola = []
for l in open(os.path.join(D, f'cola-{GIRO}.tsv'), encoding='utf8'):
    iso, _, q = l.rstrip('\n').partition('\t')
    if q and iso in ISOS: cola.append((iso, q))
print(f'{len(cola)} consultas · países {ISOS}', flush=True)
t0 = time.time(); hechas = 0; lugares = 0
with ThreadPoolExecutor(HILOS) as ex:
    for r in ex.map(lambda x: una(*x), cola):
        if not r: continue
        hechas += 1; lugares += r[2]
        print(f'[{hechas}] {r[0]} | {r[1]} -> {r[2]} ({r[3]} pág.)', flush=True)
print(f'listo: {hechas} consultas nuevas · {lugares} lugares · {bloqueos} respuestas raras · {time.time() - t0:.0f} s')
