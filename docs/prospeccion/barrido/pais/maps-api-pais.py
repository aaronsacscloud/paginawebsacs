#!/usr/bin/env python3
"""maps-api-pais.py <giro> [isos…] — el barrido por Google Places API (New) en vez de Chromium.

Por qué (15-sep-2026): el dueño pasó su llave de Google Maps «por si te sirve».
Sirve: Text Search con máscara Enterprise trae en UNA llamada lo que antes
costaba dos pasos lentos (el feed con Chromium + abrir la ficha de cada lugar
para el teléfono y la web), da MÁS resultados por consulta (Bogotá: 60 vs 36 del
feed) y no pelea por memoria con los dev servers. Cuesta: SKU Enterprise ≈ 35
USD por 1,000 llamadas (las primeras 1,000 del mes gratis); una consulta son 1-3
llamadas (páginas de 20). El total se imprime al final para que el dueño lo vea.

Escribe EXACTAMENTE lo que esperan carga-pais.py y fichas-pais.sh:
  pool-<iso>-<giro>/<md5 de la consulta>.api.json   (la lista del feed)
  ficha-<iso>/<md5 de la url>.json                   (teléfono, web, reseñas, categoría)
así el cargador no cambia y fichas-pais.sh se salta lo que ya está.
Idempotente: la consulta que ya tiene .api.json no se vuelve a cobrar.
La llave vive en paginawebsacs/.google-maps-key (fuera de git) y NUNCA se imprime.
"""
import json, os, sys, time, hashlib, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
from paises import PAISES

D = os.path.dirname(os.path.abspath(__file__))
KEY = open(os.path.join(D, '..', '..', '..', '..', '.google-maps-key')).read().strip()
GIRO = sys.argv[1]; ISOS = sys.argv[2:] or list(PAISES)
MASK = ('places.id,places.displayName,places.rating,places.userRatingCount,places.primaryType,'
        'places.primaryTypeDisplayName,places.formattedAddress,places.internationalPhoneNumber,'
        'places.websiteUri,places.businessStatus,places.googleMapsUri,nextPageToken')
PAGINAS = 3          # 60 lugares por consulta, como mucho
llamadas = 0

def md5_10(q): return hashlib.md5((q + '\n').encode()).hexdigest()[:10]   # como `echo "$q" | md5sum`
def md5_12(u): return hashlib.md5((u + '\n').encode()).hexdigest()[:12]

def buscar(q, gl):
    """Todas las páginas de una consulta. Devuelve (lugares, llamadas)."""
    global llamadas
    out, token, n = [], None, 0
    for _ in range(PAGINAS):
        body = {'textQuery': q, 'regionCode': gl, 'languageCode': 'en', 'pageSize': 20}
        if token: body['pageToken'] = token
        req = urllib.request.Request('https://places.googleapis.com/v1/places:searchText', data=json.dumps(body).encode(),
                                     headers={'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': MASK})
        for intento in range(3):
            try:
                with urllib.request.urlopen(req, timeout=40) as r: d = json.load(r); break
            except urllib.error.HTTPError as e:
                msg = e.read().decode()[:200]
                if e.code == 429 or e.code >= 500: time.sleep(3 * (intento + 1)); continue
                raise SystemExit(f'HTTP {e.code} en «{q}»: {msg}')
            except Exception:
                time.sleep(2); continue
        else:
            return out, n
        n += 1
        out.extend(d.get('places') or [])
        token = d.get('nextPageToken')
        if not token: break
        time.sleep(0.5)    # el token tarda un poco en estar listo
    llamadas += n
    return out, n

def url_de(p):
    """La URL del lugar sin el `&g_mp=…` que la API pega al final: así el mismo
    lugar tiene la MISMA ficha venga de la API o del feed (feed-curl-pais.py)."""
    return (p.get('googleMapsUri') or '').split('&g_mp=')[0] or None

def a_feed(p):
    n = (p.get('displayName') or {}).get('text') or ''
    return dict(name=n, rating=str(p['rating']) if p.get('rating') is not None else None,
                reviews=str(p['userRatingCount']) if p.get('userRatingCount') is not None else None,
                cat=p.get('primaryTypeDisplayName', {}).get('text') or (p.get('primaryType') or '').replace('_', ' ').capitalize() or None,
                url=url_de(p), web=p.get('websiteUri'), txt='', api=True)

def a_ficha(p):
    f = a_feed(p)
    return dict(name=f['name'], web=f['web'], phone=p.get('internationalPhoneNumber'), address=p.get('formattedAddress'),
                cat=f['cat'], rating=f['rating'], reviews=f['reviews'], ig=None, estado=p.get('businessStatus'))

def una(iso, q):
    pool = os.path.join(D, f'pool-{iso}-{GIRO}'); fdir = os.path.join(D, f'ficha-{iso}')
    os.makedirs(pool, exist_ok=True); os.makedirs(fdir, exist_ok=True)
    fp = os.path.join(pool, md5_10(q) + '.api.json')
    if os.path.exists(fp): return None
    lugares, n = buscar(q, PAISES[iso]['gl'])
    vivos = [p for p in lugares if p.get('businessStatus') != 'CLOSED_PERMANENTLY' and url_de(p)]
    for p in vivos:
        ff = os.path.join(fdir, md5_12(url_de(p)) + '.json')
        if not (os.path.exists(ff) and os.path.getsize(ff) > 0):
            json.dump(a_ficha(p), open(ff, 'w'), ensure_ascii=False)
    json.dump([a_feed(p) for p in vivos], open(fp, 'w'), ensure_ascii=False)
    return (iso, q, len(vivos), n)

cola = []
for l in open(os.path.join(D, f'cola-{GIRO}.tsv'), encoding='utf8'):
    iso, _, q = l.rstrip('\n').partition('\t')
    if q and iso in ISOS: cola.append((iso, q))
print(f'{len(cola)} consultas · países {ISOS}')
t0 = time.time(); hechas = 0; lugares = 0
with ThreadPoolExecutor(4) as ex:
    for r in ex.map(lambda x: una(*x), cola):
        if not r: continue
        hechas += 1; lugares += r[2]
        print(f'[{hechas}] {r[0]} | {r[1]} -> {r[2]} ({r[3]} pág.)', flush=True)
print(f'listo: {hechas} consultas nuevas · {lugares} lugares · {llamadas} llamadas ≈ {llamadas * 0.035:.0f} USD · {time.time() - t0:.0f} s')
