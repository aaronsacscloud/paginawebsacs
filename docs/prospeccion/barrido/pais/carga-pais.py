#!/usr/bin/env python3
"""Fusiona el feed (pool-<iso>-<giro>/) y las fichas (ficha-<iso>/) de UN GIRO fuera
de México, tira lo que no es del giro o no tiene teléfono válido para SU país,
agrupa sucursales, deduplica contra abm_cuentas y emite SQL.
  python3 carga-pais.py prep  <giro> [isos…]  -> <giro>-pais-fusion.json + sqlout/<giro>-<iso>-cuentas-NN.sql + reporte
  python3 carga-pais.py hijos <giro> [isos…]  -> sqlout/<giro>-<iso>-hijos-NN.sql (teléfonos, fuentes, y lo del sitio si ya corrió sitios-pais.py)
Mismas reglas que ../giro-carga.py (México); lo que cambia por país está en paises.py
(LADA, largos, e164) y aquí: las categorías vienen en INGLÉS porque la ficha se abre con
hl=en (es la única forma de ver reseñas y teléfono fuera de México, manual §13.7).
"""
import json, glob, re, sys, os, subprocess, unicodedata, hashlib, datetime
from collections import defaultdict, Counter
from paises import PAISES, STEMS, stems, ciudad_limpia, e164, es_movil
D = os.path.dirname(os.path.abspath(__file__))
MODO = sys.argv[1]; GIRO = sys.argv[2]; ISOS = sys.argv[3:] or list(PAISES)
SQL = os.path.join(D, '..', 'sql.sh')
OUT = os.path.join(D, 'sqlout'); os.makedirs(OUT, exist_ok=True)
MES = datetime.date.today().strftime('%Y-%m')
# Sin tope por país (15-sep-2026): el dueño quiere el barrido por provincias
# como en México, no el top 100 de la capital. El filtro de calidad se queda.
RATING_MIN, RESENAS_MIN, TOPE_PAIS = 3.7, 5, None
FUS = os.path.join(D, f'{GIRO}-pais-fusion.json')
# Las cuentas de fuera de México entran EN PAUSA (pausa_hasta null: el cron de
# ritmo no las despierta). Un goteo viejo solo toma `sin_tocar`, así que
# aunque el código desplegado todavía no filtre por país, ninguna cadencia
# de México se traga a Colombia. La migración de lanzamiento —cuando el dueño
# ya revisó el reporte— las pasa a `sin_tocar` y enciende su goteo.
PAUSA = 'Carga por país: en revisión del dueño antes de lanzar la cadencia'

# ── Qué es del giro (categorías de Google en inglés) ──────────────────────────
# Fuerte: entra por la categoría sola. Con nombre: entra solo si el nombre dice
# que vende novia/fiesta (una «Clothing store» puede ser cualquier cosa).
CAT_FUERTE = ('bridal shop', 'dress store', 'formal wear store', 'full dress rental service', 'wedding store',
              'wedding dress rental service', 'dress and tuxedo rental service', 'haute couture fashion house', 'dress shop')
CAT_CON_NOMBRE = ('boutique', 'clothing store', "women's clothing store", 'store', 'fashion designer', 'dressmaker',
                  'clothing alteration service', 'tailor', 'custom tailor', 'youth clothing store', 'plus size clothing store', None)
NOMBRE_OK = re.compile(r'novia|nupcial|bridal|bride|quince|15 a[ñn]os|\bxv\b|fiesta|gala|vestid|atelier|alta costura|couture|sposa|wedding|boda|graduaci|\bprom\b|madrina|noche', re.I)
# Fuera por nombre: cadenas y tiendas departamentales del país, centros
# comerciales, disfraces, y lo que solo viste al novio (el guion habla de la
# novia y su fecha; un smoking se renta la semana anterior).
NOMBRE_FUERA = re.compile(r'falabella|ripley|\betam\b|\btucci\b|ropa [ií]ntima|lencer|lingerie|oechsle|liverpool|\bexito\b|éxito|olímpica|olimpica|jumbo|walmart|tottus|la polar|hites|corona\b|\bparis\b(?!.*novia)|zara\b|h&m|bershka|stradivarius|pull ?& ?bear|\bmango\b|forever 21|\bgap\b|\bmall\b|centro comercial|^plaza |shopping|^cc |c\.c\.|unicentro|santaf[eé]\b|dafiti|mercado ?libre|linio|amazon|disfra|costume|tuxedo|smoking|esmoquin|\btrajes? (de|para) (novio|caballero|hombre)\b(?!.*novia)|renta de (mesas|sillas|carpas)|salón de eventos|salon de eventos|banquete|florister|fotograf|catering|\bhotel\b|\bspa\b', re.I)

GENERICOS = set(('novia novias novio novios vestidos vestido de del la el los las y e en para con por tienda boutique atelier alquiler arriendo renta ventas venta '
                 'fiesta fiestas gala noche quince quinceanera quinceaneras 15 anos xv sposa bridal bride wedding dress dresses shop store moda modas fashion '
                 'alta costura couture diseno disenos diseñadora creaciones confecciones exclusivos elegancia trajes traje casa salon sucursal matriz by com '
                 'sas ltda srl eirl spa sa cia bogota medellin cali santiago lima quito buenos aires montevideo panama guatemala').split())
SEMI = set('ceremonias creaciones novedades imperio confecciones exclusivos elegancia elegante glamour princesa princesas coleccion collection atelier vestuario '
           'victoria valentina veronica alejandra fernanda esmeralda isabella sofia camila'.split())

def norm(s):
    s = unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower()
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9 ]', ' ', s)).strip()
def marca(nombre):
    toks = [t for t in norm(nombre).split() if t not in GENERICOS]
    return ' '.join(toks[:3])
def distintiva(mk, umbral=8):
    t = mk.split()
    if not t: return False
    if len(t) >= 2: return True
    return len(t[0]) >= umbral and t[0] not in SEMI
def dominio(web):
    if not web: return None
    m = re.match(r'https?://(?:www\.)?([^/?#]+)(/[^?#]*)?', web.strip().lower())
    if not m: return None
    host, path = m.group(1), (m.group(2) or '').rstrip('/')
    if any(h in host for h in ('facebook.com', 'instagram.com', 'linktr.ee', 'wa.me', 'whatsapp.com', 'sites.google', 'negocio.site', 'business.site', 'tiktok.com', 'wixsite', 'google.com', 'bit.ly')):
        return host + path if path and path != '/' else None
    return host
def md5_10(q): return hashlib.md5((q + '\n').encode()).hexdigest()[:10]   # como `echo "$q" | md5sum`
def md5_12(u): return hashlib.md5((u + '\n').encode()).hexdigest()[:12]
def q(s): return 'null' if s is None else "'" + str(s).replace("'", "''") + "'"

def consultas():
    m = {}
    for l in open(os.path.join(D, f'cola-{GIRO}.tsv'), encoding='utf8'):
        iso, _, qq = l.rstrip('\n').partition('\t')
        if qq: m[(iso, md5_10(qq))] = qq
    return m
def ciudad_de(qq, iso):
    for st in sorted(stems(GIRO, iso), key=len, reverse=True):
        if qq.lower().startswith(st.lower()):
            c = qq[len(st):].strip() or None
            # «Palermo Buenos Aires» o «Miraflores Lima» son consultas por barrio para
            # sacar más lugares; en el correo la ciudad es Buenos Aires o Lima.
            for otra in PAISES[iso]['ciudades']:
                if c and c != otra and c.endswith(' ' + otra): return ciudad_limpia(otra, iso)
            return ciudad_limpia(c, iso)
    return None

def fichas_api(iso):
    """Las fichas que dejó maps-api-pais.py (traen `estado`), por nombre normalizado.
    Sirven para ponerle teléfono y web a un lugar del feed de Chromium sin abrir
    su ficha: el mismo negocio con el mismo nombre en el mismo país."""
    idx = defaultdict(list)
    for f in glob.glob(os.path.join(D, f'ficha-{iso}', '*.json')):
        try: d = json.load(open(f))
        except Exception: continue
        if isinstance(d, dict) and 'estado' in d and d.get('phone'): idx[norm(d.get('name') or '')].append(d)
    return idx

def leer_crudo():
    """Feed + ficha por lugar único (url). Devuelve filas ya filtradas por giro.

    Dos fuentes que se complementan (15-sep-2026): el feed de Chromium trae la
    categoría FINA de Maps («Bridal shop», «Dress store»; un tercio de los
    lugares del giro entra solo por ella), y la Places API trae teléfono, web y
    reseñas en una llamada pero con categoría gruesa («Clothing store»). Un lugar
    del feed sin ficha propia toma la de la API por nombre; el mismo negocio
    visto por las dos (mismo teléfono y nombre) es UNO, con la categoría fina."""
    md5q = consultas(); fuera = Counter(); vistos = {}; por_tel = {}
    for iso in ISOS:
        api = fichas_api(iso)
        pools = sorted(glob.glob(os.path.join(D, f'pool-{iso}-{GIRO}', '*.json')), key=lambda f: f.endswith('.api.json'))  # el feed primero: su categoría manda
        for f in pools:
            if os.path.getsize(f) == 0: continue
            try: data = json.load(open(f))
            except Exception: fuera['pool ilegible'] += 1; continue
            qq = md5q.get((iso, os.path.basename(f)[:10])) or ''
            for r in data:
                if not isinstance(r, dict) or not r.get('name') or not r.get('url'): continue
                key = (iso, r['url'])
                if key in vistos:
                    vistos[key]['qs'].add(qq); continue
                fp = os.path.join(D, f'ficha-{iso}', md5_12(r['url']) + '.json')
                ficha = {}
                if os.path.exists(fp) and os.path.getsize(fp) > 0:
                    try: ficha = json.load(open(fp)) or {}
                    except Exception: ficha = {}
                if not ficha.get('phone') and not r.get('api'):
                    cand = api.get(norm(r['name'])) or []
                    if cand:                     # la ficha de la API del mismo nombre; la categoría fina sigue siendo la del feed
                        a = cand[0]; ficha = dict(a, cat=ficha.get('cat') or r.get('cat') or a.get('cat')); fuera['ficha tomada de la API'] += 1
                cat = (ficha.get('cat') or r.get('cat') or '').strip() or None
                catl = (cat or '').lower()
                nombre = (ficha.get('name') or r['name']).strip()
                if NOMBRE_FUERA.search(nombre): fuera['nombre fuera'] += 1; continue
                if catl in CAT_FUERTE: pass
                elif catl in CAT_CON_NOMBRE or cat is None:
                    if not NOMBRE_OK.search(nombre): fuera['cat genérica sin nombre del giro: ' + (cat or '?')] += 1; continue
                else: fuera['categoría: ' + cat] += 1; continue
                tel = e164(ficha.get('phone') or '', iso)
                if not tel: fuera['sin teléfono válido'] += 1; continue
                dup = por_tel.get((iso, tel, norm(nombre)))
                if dup:                          # el mismo lugar visto por el feed y por la API
                    dup['qs'].add(qq); fuera['mismo lugar por las dos fuentes'] += 1; continue
                rv = ficha.get('reviews') if ficha.get('reviews') not in (None, '') else r.get('reviews')
                rv = int(re.sub(r'\D', '', str(rv))) if rv not in (None, '') else None
                rt = ficha.get('rating') or r.get('rating'); rt = float(str(rt).replace(',', '.')) if rt not in (None, '') else None
                vistos[key] = dict(iso=iso, name=nombre, tel=tel, movil=es_movil(tel, iso), reviews=rv, rating=rt, cat=cat,
                                   web=(ficha.get('web') or r.get('web') or '').strip() or None, ig=ficha.get('ig'), url=r['url'],
                                   direccion=ficha.get('address'), ciudad=ciudad_de(qq, iso), qs={qq})
                por_tel[(iso, tel, norm(nombre))] = vistos[key]
    print('fuera por filtro:', sum(fuera.values()), dict(fuera.most_common(12)))
    return list(vistos.values())

def subgiro(c):
    n = norm(c['nombre_maps'] + ' ' + ' '.join(c['qs']))
    cat = (c['cat'] or '').lower()
    renta = bool(re.search(r'alquiler|arriendo|renta|rental', n + ' ' + cat))
    novia = bool(re.search(r'novia|bridal|nupcial|sposa|wedding|boda', n + ' ' + cat))
    xv = bool(re.search(r'quince|15 anos|\bxv\b', n))
    if novia and renta: return 'Novias alquiler'
    if novia and xv: return 'Novias y 15 años'
    if novia: return 'Novias venta'
    if renta: return 'Fiesta alquiler'
    return 'Fiesta y gala'

def prep():
    rows = leer_crudo()
    print('lugares del giro con teléfono:', len(rows), '· por país:', dict(Counter(r['iso'] for r in rows)))
    # sucursales: mismo dominio, o misma marca distintiva dentro del país
    grupos = defaultdict(list)
    for v in rows:
        dom = dominio(v['web']); mk = marca(v['name'])
        key = (v['iso'], 'dom', dom) if dom else (v['iso'], 'marca', mk) if distintiva(mk) else (v['iso'], 'marca', mk or norm(v['name']), v['ciudad'])
        grupos[key].append(v)
    cuentas = []
    for key, vs in grupos.items():
        vs.sort(key=lambda x: -(x['reviews'] or 0))
        p = vs[0]; tels = []
        for v in vs:
            if v['tel'] not in tels: tels.append(v['tel'])
        ciudades = Counter(v['ciudad'] for v in vs if v['ciudad'])
        ciudad = ciudades.most_common(1)[0][0] if ciudades else p['ciudad']
        nombre = re.sub(r'\s*[\(\-–|].*$', '', p['name']).strip() or p['name']
        if len(vs) > 1 and key[1] == 'marca': nombre = p['name']
        cuentas.append(dict(iso=p['iso'], nombre=nombre, nombre_maps=p['name'], ciudad=ciudad, sucursales=len(vs), ciudades=len(ciudades), cat=p['cat'],
                            rating=p['rating'], resenas=max((v['reviews'] or 0) for v in vs) or None, resenas_total=sum((v['reviews'] or 0) for v in vs) or None,
                            web=next((v['web'] for v in vs if v['web']), None), ig=next((v['ig'] for v in vs if v['ig']), None), url=p['url'], tels=tels,
                            sucursales_lista=[dict(nombre=v['name'], tel=v['tel'], movil=v['movil'], ciudad=v['ciudad'], url=v['url'], resenas=v['reviews']) for v in vs],
                            qs=sorted(x for x in set().union(*[v['qs'] for v in vs]) if x)))
    print('cuentas agrupadas:', len(cuentas), '· con 2+ sucursales:', sum(1 for c in cuentas if c['sucursales'] > 1))
    # Manual §0, la regla que manda: los mejores, no todos. Con calificación,
    # 3.7 estrellas para arriba, reseñas suficientes para que la estrella
    # signifique algo, y el top 100 de cada país ordenado por reseñas (una
    # cadena cuenta como una cuenta). Si un país no llega a 100, son los que
    # haya: no se rellena con cuentas malas.
    antes = len(cuentas)
    cuentas = [c for c in cuentas if c['rating'] is not None and c['rating'] >= RATING_MIN and (c['resenas_total'] or 0) >= RESENAS_MIN]
    top = []
    for iso in ISOS:
        cs = sorted([c for c in cuentas if c['iso'] == iso], key=lambda c: (-(c['resenas_total'] or 0), -(c['rating'] or 0)))
        top.extend(cs[:TOPE_PAIS] if TOPE_PAIS else cs)
    print(f'filtro de calidad (≥{RATING_MIN}★, ≥{RESENAS_MIN} reseñas, {('top ' + str(TOPE_PAIS)) if TOPE_PAIS else 'sin tope'} por país): {antes} → {len(top)}')
    cuentas = top
    # dedupe contra la base: nombre+ciudad, teléfono E.164, dominio
    base = json.loads(subprocess.check_output([SQL, '-e', "select a.id, lower(a.nombre) n, coalesce(a.ciudad,'') c, a.pais, a.giro, a.sitio, (select string_agg(valor,'|') from abm_canales k where k.cuenta_id=a.id and k.tipo in ('telefono','whatsapp_tienda','whatsapp_dueno')) tels from abm_cuentas a where a.pais <> 'México'"]))
    por_nombre = {(b['n'], b['c']): b for b in base}
    por_tel = {}
    for b in base:
        for t in (b['tels'] or '').split('|'):
            d = re.sub(r'\D', '', t)
            if d: por_tel[d] = b
    por_dom = {dominio(b['sitio']): b for b in base if dominio(b['sitio'])}
    nuevas = []; existentes = []
    for c in cuentas:
        hit = por_nombre.get((c['nombre'].lower(), c['ciudad'] or '')) or por_nombre.get((c['nombre_maps'].lower(), c['ciudad'] or ''))
        if not hit:
            for t in c['tels']:
                if t.lstrip('+') in por_tel: hit = por_tel[t.lstrip('+')]; break
        if not hit and dominio(c['web']) in por_dom: hit = por_dom[dominio(c['web'])]
        if hit: c['id_existente'] = hit['id']; c['giro_existente'] = hit['giro']; existentes.append(c)
        else: nuevas.append(c)
    print('ya en la base:', len(existentes), '· nuevas a cargar:', len(nuevas))
    def puntaje(c):
        suc = c['sucursales']; enc = 10 + (12 if suc >= 2 else 0) + (10 if suc >= 5 else 0) + (8 if suc >= 15 else 0)
        dol = (10 if (c['rating'] or 5) < 4.5 and suc >= 3 else 0)
        acc = 8
        return enc, dol, acc
    for f in glob.glob(os.path.join(OUT, f'{GIRO}-*-cuentas-*.sql')): os.remove(f)
    head = 'insert into abm_cuentas (nombre,giro,subgiro,ciudad,estado_geo,pais,moneda,sucursales,sucursales_confianza,tamano,ruta,sitio,facebook,instagram,google_rating,google_resenas,nota,encaje,dolor,accesibilidad,puntaje,etapa,pausa_motivo) values\n'
    n_arch = 0
    for iso in ISOS:
        vals = []
        for c in [x for x in nuevas if x['iso'] == iso]:
            enc, dol, acc = puntaje(c); suc = c['sucursales']; P = PAISES[iso]
            tam = 'grande' if suc >= 15 else 'mediana' if suc >= 5 else 'chica' if suc >= 2 else 'micro'
            ruta = 'diagnostico' if suc >= 5 else 'demo'
            nota = f"Google Maps ({P['nombre']}): {c['resenas'] or 0} reseñas" + (f", {suc} sucursales ({c['ciudades']} ciudades)" if suc > 1 else '') + f". Categoría: {c['cat'] or '?'}. Consulta: {(c['qs'] or ['?'])[0]}"
            web = (c['web'] or '').strip(); fb = ig = None
            if re.search(r'facebook\.com|fb\.com|fb\.me', web): fb, web = web, None
            elif 'instagram.com' in web: ig, web = web, None
            if c.get('ig') and not ig: ig = c['ig']
            if ig:
                # La ficha a veces trae la URL completa con utm/igshid; solo se guarda el usuario.
                m = re.search(r'instagram\.com/([A-Za-z0-9_.]{2,30})', ig) or re.fullmatch(r'\s*@?([A-Za-z0-9_.]{2,30})\s*', ig)
                ig = 'https://instagram.com/' + m.group(1) if m and m.group(1).lower() not in ('p', 'reel', 'explore', 'stories') else None
            if fb: fb = fb.split('?')[0]
            c['fb'], c['ig'], c['sitio'] = fb, ig, web or None
            vals.append('(' + ','.join([q(c['nombre']), q(GIRO), q(subgiro(c)), q(c['ciudad']), 'null', q(P['nombre']), q(P['moneda'].upper()), str(suc), q('alta' if suc == 1 else 'media'), q(tam), q(ruta),
                        q(web or None), q(fb), q(ig), q(c['rating']), q(c['resenas']), q(nota), str(enc), str(dol), str(acc), str(enc + dol + acc), "'en_pausa'", q(PAUSA)]) + ')')
        for i in range(0, len(vals), 150):
            open(os.path.join(OUT, f'{GIRO}-{iso}-cuentas-{i//150:02d}.sql'), 'w').write(head + ',\n'.join(vals[i:i+150]) + "\non conflict (lower(nombre), coalesce(ciudad,'')) do nothing;\n"); n_arch += 1
    print('archivos SQL de cuentas:', n_arch)
    json.dump(dict(nuevas=nuevas, existentes=existentes), open(FUS, 'w'), ensure_ascii=False, indent=1)
    print('\n-- nuevas por país --')
    for iso in ISOS:
        cs = [c for c in nuevas if c['iso'] == iso]
        if not cs: continue
        print(f"  {PAISES[iso]['nombre']:22} {len(cs):4}  móvil={sum(1 for c in cs if c['sucursales_lista'][0]['movil'])}  con sitio={sum(1 for c in cs if c['sitio'])}  reseñas≥50={sum(1 for c in cs if (c['resenas'] or 0) >= 50)}  " + dict(Counter(subgiro(c) for c in cs)).__repr__())
    print('\n-- top 12 por reseñas --')
    for c in sorted(nuevas, key=lambda x: -(x['resenas_total'] or 0))[:12]:
        print(f"  {c['iso']} {c['nombre'][:42]:42} {c['ciudad'] or '?':16} suc={c['sucursales']} reseñas={c['resenas_total']} {c['cat']}")

def hijos():
    fus = json.load(open(FUS))
    base = json.loads(subprocess.check_output([SQL, '-e', f"select a.id, lower(a.nombre) n, coalesce(a.ciudad,'') c, a.pais from abm_cuentas a where a.giro='{GIRO}' and a.pais <> 'México'"]))
    ids = {(b['n'], b['c']): b['id'] for b in base}
    ex_can = json.loads(subprocess.check_output([SQL, '-e', f"select k.cuenta_id, k.tipo, lower(k.valor) v from abm_canales k join abm_cuentas a on a.id=k.cuenta_id where a.giro='{GIRO}' and a.pais <> 'México'"]))
    ya = {(k['cuenta_id'], k['tipo'], k['v']) for k in ex_can}
    ya_tel = defaultdict(set); ya_wa = defaultdict(set)
    for k in ex_can:
        d = re.sub(r'\D', '', k['v'])
        if d and k['tipo'] in ('telefono', 'whatsapp_tienda', 'whatsapp_dueno'): ya_tel[k['cuenta_id']].add(d)
        if d and k['tipo'] in ('whatsapp_tienda', 'whatsapp_dueno'): ya_wa[k['cuenta_id']].add(d)
    can = []; fue = []; sin_id = 0
    todas = [c for c in fus['nuevas'] + fus['existentes'] if c['iso'] in ISOS]
    for c in todas:
        cid = c.get('id_existente') or ids.get((c['nombre'].lower(), c['ciudad'] or ''))
        if not cid: sin_id += 1; continue
        c['_id'] = cid
        for s in c['sucursales_lista']:
            d = s['tel'].lstrip('+')
            if d in ya_tel[cid]: continue
            ya_tel[cid].add(d)
            can.append(f"({q(cid)},'telefono',{q(s['tel'])},'alta','sin_probar',true)")
            fue.append(f"({q(cid)},'telefono',{q(s['tel'])},{q(s['url'])},'google_maps','alta','carga {GIRO} {c['iso']} {MES}')")
        if not c.get('id_existente'):
            fue.append(f"({q(cid)},'google_rating',{q(c['rating'])},{q(c['url'])},'google_maps','alta','carga {GIRO} {c['iso']} {MES}')")
    # lo del sitio, si ya corrió sitios-pais.py
    sit_path = os.path.join(D, f'{GIRO}-pais-sitios.json')
    sitios = json.load(open(sit_path)) if os.path.exists(sit_path) else []
    por_clave = {(c['iso'], c['nombre'].lower(), c['ciudad'] or ''): c for c in todas if c.get('_id')}
    GEN = re.compile(r'^(info|contacto|contact|ventas|hola|hello|atencion|atencionaclientes|servicioalcliente|servicio|alquiler|admin|administracion|clientes|sac|soporte|privacidad|ecommerce|tienda|online|marketing|comercial|reservas|citas)\b')
    upd = []; n_mail = n_wa = n_dm = 0
    for s_ in sitios:
        c = por_clave.get((s_['iso'], s_['nombre'].lower(), s_['ciudad'] or ''))
        if not c: continue
        cid = c['_id']
        if c.get('id_existente') and c.get('giro_existente') != GIRO: continue
        dom_sitio = dominio(s_.get('final') or s_['web']) or ''
        for tipo, val in (('dm_fb', s_.get('fb') and 'https://www.facebook.com/' + s_['fb']), ('dm_ig', s_.get('ig') and 'https://instagram.com/' + s_['ig']),
                          ('dm_fb', c.get('fb')), ('dm_ig', c.get('ig'))):
            if val and (cid, tipo, val.lower()) not in ya and not any(k[0] == cid and k[1] == tipo for k in ya):
                ya.add((cid, tipo, val.lower())); n_dm += 1
                can.append(f"({q(cid)},{q(tipo)},{q(val)},'media','sin_probar',true)")
                fue.append(f"({q(cid)},{q(tipo)},{q(val)},{q(s_['web'])},'sitio_oficial','media','carga {GIRO} {c['iso']} {MES}')")
        if s_.get('http') != 200: continue
        for e in s_.get('emails') or []:
            if (cid, 'email_generico', e) in ya or (cid, 'email_direccion', e) in ya: continue
            usuario, _, dom_mail = e.partition('@')
            tipo = 'email_generico' if GEN.match(usuario) else 'email_direccion'
            gratis = re.search(r'gmail|hotmail|outlook|yahoo|live\.com|icloud', dom_mail)
            conf = 'media' if gratis else 'alta' if dom_sitio and dom_mail.split('.')[0] in dom_sitio else 'baja'
            ya.add((cid, tipo, e)); n_mail += 1
            can.append(f"({q(cid)},{q(tipo)},{q(e)},{q(conf)},'sin_probar',true)")
            fue.append(f"({q(cid)},{q(tipo)},{q(e)},{q(s_['web'])},'sitio_oficial',{q(conf)},'carga {GIRO} {c['iso']} {MES}')")
        for w in s_.get('wa') or []:            # ya vienen en E.164 (sitios-pais.py los validó con e164 del país)
            d = w.lstrip('+')
            # Se compara contra los WhatsApp, NO contra los teléfonos: casi siempre
            # el wa.me del sitio es el MISMO número que Maps, y esa coincidencia es
            # justo la declaración que lo vuelve WhatsApp (antes se saltaba y por
            # eso 144 sitios con wa.me dejaban solo 22 canales; 15-sep-2026).
            if d in ya_wa[cid]: continue
            ya_wa[cid].add(d); ya_tel[cid].add(d); n_wa += 1
            # 'declarado': el negocio publicó su wa.me en su sitio; es lo único que
            # cuenta como WhatsApp (trigger abm_canales_recontar y regla del manual).
            can.append(f"({q(cid)},'whatsapp_tienda',{q('https://wa.me/' + d)},'alta','declarado',true)")
            fue.append(f"({q(cid)},'whatsapp_tienda',{q('https://wa.me/' + d)},{q(s_['web'])},'sitio_oficial','alta','carga {GIRO} {c['iso']} {MES}')")
        sets = [f"plataforma_web={q(s_.get('plataforma') or 'A la medida / otro')}", f"sitio_http={s_['http']}", f"sitio_seg={s_.get('seg') or 'null'}", f"sitio_carrito={'true' if s_.get('carrito') else 'false'}"]
        if s_.get('ig') and not c.get('ig'): sets.append(f"instagram={q('https://instagram.com/' + s_['ig'])}")
        if s_.get('fb') and not c.get('fb'): sets.append(f"facebook={q('https://www.facebook.com/' + s_['fb'])}")
        if c.get('id_existente'): sets = [x for x in sets if x.startswith(('sitio_http', 'sitio_seg', 'plataforma_web'))]
        upd.append(f"update abm_cuentas set {', '.join(sets)} where id={q(cid)};")
    for f in glob.glob(os.path.join(OUT, f'{GIRO}-pais-hijos-*.sql')): os.remove(f)
    n = 0
    for i in range(0, len(can), 200):
        open(os.path.join(OUT, f'{GIRO}-pais-hijos-{n:02d}.sql'), 'w').write('insert into abm_canales (cuenta_id,tipo,valor,confianza,estado,es_de_la_tienda) values\n' + ',\n'.join(can[i:i+200]) + '\non conflict (cuenta_id,tipo,lower(valor)) do nothing;\n'); n += 1
    for i in range(0, len(fue), 200):
        open(os.path.join(OUT, f'{GIRO}-pais-hijos-{n:02d}.sql'), 'w').write('insert into abm_fuentes (cuenta_id,campo,valor,url,metodo,confianza,agente) values\n' + ',\n'.join(fue[i:i+200]) + ';\n'); n += 1
    for i in range(0, len(upd), 200):
        open(os.path.join(OUT, f'{GIRO}-pais-hijos-{n:02d}.sql'), 'w').write('\n'.join(upd[i:i+200]) + '\n'); n += 1
    print(f'canales: {len(can)} (correos {n_mail}, wa.me {n_wa}, DM {n_dm}) · fuentes: {len(fue)} · updates de sitio: {len(upd)} · sin id: {sin_id} · archivos: {n}')

prep() if MODO == 'prep' else hijos()
