#!/usr/bin/env python3
"""Fusiona todo lo raspado de Google Maps para UN GIRO (argv[2]), tira lo que no tiene
teléfono, agrupa sucursales, deduplica contra abm_cuentas y emite SQL.
  python3 giro-carga.py prep <giro>    -> renta-fusion.json + sqlout/renta-cuentas-NN.sql + reporte
  python3 giro-carga.py hijos <giro>    -> sqlout/renta-hijos-NN.sql (canales + fuentes) con ids reales
"""
import json, glob, re, sys, os, subprocess, unicodedata, hashlib
from collections import defaultdict, Counter
D = os.path.dirname(os.path.abspath(__file__))
GIRO = sys.argv[2] if len(sys.argv) > 2 else 'boutiques'
from giros_config import GIROS
CFG = GIROS[GIRO]
POOL = os.path.join(D, 'pool-' + GIRO)
SQL = os.path.join(D, 'sql.sh')
OUT = os.path.join(D, 'sqlout'); os.makedirs(OUT, exist_ok=True)
import datetime; MES = datetime.date.today().strftime('%Y-%m')   # agente de abm_fuentes: 'carga <giro> <año-mes>'

STEMS = CFG['stems'] + ['renta de vestidos','renta de trajes y smoking','vestidos de xv años','vestidos de novia','renta de trajes','renta de smoking',
         'renta de vestidos de fiesta','renta de vestidos de gala','vestidos de gala','trajes de novio','smokings','renta de smokings',
         'renta de vestidos de novia','renta de vestidos de xv años','renta de vestidos para boda','renta de vestidos de noche',
         'renta de trajes para boda','renta de trajes de gala','vestidos de fiesta','boutique de vestidos','tienda de vestidos',
         'renta de vestidos xv años','renta de vestidos de xv años','renta de vestidos xv','renta de togas y birretes','renta de vestidos de gala']
EXCLUIR_Q = tuple(CFG.get('excluir_q', ()))
CAT_FUERA_RENTA = ('agencia de viajes','disfra','autobuses','visitas tur','televisi','salón para eventos','organizador de eventos','organización de eventos',
             'centro comercial','grandes almacenes','oficinas de empresa','representante comercial','productos de belleza','joyería','galería de arte',
             'sin ánimo de lucro','tintorería','servicio de reparación','alimentación','tienda de regalos','alojamientos','uniformes','ropa infantil',
             'proveedor de ropa','alquiler de tiendas','recinto','hotel','mayorista','estética','laboratorio','lavander','optometr','cafeter','puente','mercado','banda de m','edificio','publicidad','tienda de telas','automóvil','móviles','herbolario','club de','organizador de bodas','religios','joyas','bisuter','premamá','bebé','ropa de playa','maquillador','accesorios para','vintage','florister','florer','fotógrafo','fotograf','banquete','dj','sastre','modista','taller de costura','arreglos de ropa','fábrica de ropa')
CAT_FUERA = tuple(CFG.get('cat_fuera', ())) + ('agencia de viajes','autobuses','centro comercial','grandes almacenes','oficinas de empresa','representante comercial','galería de arte','sin ánimo de lucro','tintorería','alojamientos','recinto','hotel','laboratorio','lavander','optometr','cafeter','puente','mercado','edificio','publicidad','automóvil','club de','religios','restaurante','atracción turística','iglesia','escuela','universidad','banco','farmacia','gimnasio','hospital','clínica','dentista','veterinari','papeler','ferreter','abarrotes','supermercado','tienda departamental','casa de empeño','prestamista','compra de oro','comprador de oro')
CAT_OK = tuple(CFG.get('cat_ok', ()))
NOMBRE_FUERA_GIRO = re.compile(CFG['nombre_fuera'], re.I) if CFG.get('nombre_fuera') else None
NOMBRE_FUERA = re.compile(r'viaje|travel|tintorer|florer|florist|banquete|sal[oó]n de eventos|dj\b|mariachi|\bhotel\b|marriott|sex ?shop|cond[oó]n|er[oó]tic|massimo dutti|lefties|bizzarro|tiffany|cartier|rolex|bulgari|^galer[ií]as |\bmall\b|^plaza |^centro comercial|^paseo |^parque |^forum |nuevo mundo|\bjulio\b|el palacio|sanborns|fábricas de francia|se[nñ]or frog|^plaza |^centro comercial|^tianguis|^pulga\b|^mercado |^tienda de ropa$|^boutique$|^ropa$|santa f[eé] klan|^lust\b|monte de piedad|casa de empe[nñ]o|compro oro|prendamex|prenda f[aá]cil|liverpool|palacio de hierro|coppel|suburbia|\bsears\b|walmart|soriana|chedraui|\bh&m\b|\bzara\b|bershka|pull ?& ?bear|stradivarius|\bc&a\b|old navy|forever 21|\bshasa\b|cuidado con el perro|\bsfera\b|\bmango\b|\bmilano\b|del sol\b|elektra|\bmercado libre|amazon', re.I)
NOMBRE_FUERA_RENTA = re.compile(r'disfra|viaje|travel|toga|birrete|uniforme|tintorer|sastrer|florer|florist|banquete|sal[oó]n de eventos|fotograf|dj\b|mariachi|\bhotel\b|marriott|lienzo charro|^plaza strada', re.I)
# ciudad como aparece en la consulta -> (ciudad canónica, estado)
CIU = {
 'aguascalientes':('Aguascalientes','Aguascalientes'),'mexicali':('Mexicali','Baja California'),'tijuana':('Tijuana','Baja California'),
 'ensenada':('Ensenada','Baja California'),'la paz baja california sur':('La Paz','Baja California Sur'),'la paz':('La Paz','Baja California Sur'),
 'los cabos':('Los Cabos','Baja California Sur'),'campeche':('Campeche','Campeche'),'ciudad del carmen':('Ciudad del Carmen','Campeche'),
 'tuxtla gutiérrez':('Tuxtla Gutiérrez','Chiapas'),'tapachula':('Tapachula','Chiapas'),'chihuahua':('Chihuahua','Chihuahua'),
 'ciudad juárez':('Ciudad Juárez','Chihuahua'),'delicias chihuahua':('Delicias','Chihuahua'),'ciudad de méxico':('Ciudad de México','Ciudad de México'),
 'cdmx':('Ciudad de México','Ciudad de México'),'coyoacán cdmx':('Ciudad de México','Ciudad de México'),'polanco cdmx':('Ciudad de México','Ciudad de México'),
 'iztapalapa cdmx':('Ciudad de México','Ciudad de México'),'gustavo a. madero cdmx':('Ciudad de México','Ciudad de México'),
 'saltillo':('Saltillo','Coahuila'),'torreón':('Torreón','Coahuila'),'monclova':('Monclova','Coahuila'),'piedras negras':('Piedras Negras','Coahuila'),
 'colima':('Colima','Colima'),'manzanillo':('Manzanillo','Colima'),'durango':('Durango','Durango'),'guanajuato':('Guanajuato','Guanajuato'),
 'león guanajuato':('León','Guanajuato'),'león':('León','Guanajuato'),'irapuato':('Irapuato','Guanajuato'),'celaya':('Celaya','Guanajuato'),
 'salamanca guanajuato':('Salamanca','Guanajuato'),'san miguel de allende':('San Miguel de Allende','Guanajuato'),'chilpancingo':('Chilpancingo','Guerrero'),
 'acapulco':('Acapulco','Guerrero'),'zihuatanejo':('Zihuatanejo','Guerrero'),'pachuca':('Pachuca','Hidalgo'),'tulancingo':('Tulancingo','Hidalgo'),
 'guadalajara':('Guadalajara','Jalisco'),'zapopan':('Zapopan','Jalisco'),'tlaquepaque':('Tlaquepaque','Jalisco'),'tonalá jalisco':('Tonalá','Jalisco'),
 'tonalá':('Tonalá','Jalisco'),'puerto vallarta':('Puerto Vallarta','Jalisco'),'tepatitlán':('Tepatitlán','Jalisco'),'toluca':('Toluca','Estado de México'),
 'naucalpan':('Naucalpan','Estado de México'),'ecatepec':('Ecatepec','Estado de México'),'tlalnepantla':('Tlalnepantla','Estado de México'),
 'nezahualcóyotl':('Nezahualcóyotl','Estado de México'),'cuautitlán izcalli':('Cuautitlán Izcalli','Estado de México'),'texcoco':('Texcoco','Estado de México'),
 'morelia':('Morelia','Michoacán'),'uruapan':('Uruapan','Michoacán'),'zamora michoacán':('Zamora','Michoacán'),'cuernavaca':('Cuernavaca','Morelos'),
 'cuautla morelos':('Cuautla','Morelos'),'tepic':('Tepic','Nayarit'),'monterrey':('Monterrey','Nuevo León'),'san pedro garza garcía':('San Pedro Garza García','Nuevo León'),
 'san nicolás de los garza':('San Nicolás de los Garza','Nuevo León'),'guadalupe nuevo león':('Guadalupe','Nuevo León'),'apodaca':('Apodaca','Nuevo León'),
 'oaxaca de juárez':('Oaxaca','Oaxaca'),'oaxaca':('Oaxaca','Oaxaca'),'puebla':('Puebla','Puebla'),'tehuacán':('Tehuacán','Puebla'),'querétaro':('Querétaro','Querétaro'),
 'san juan del río':('San Juan del Río','Querétaro'),'chetumal':('Chetumal','Quintana Roo'),'cancún':('Cancún','Quintana Roo'),'playa del carmen':('Playa del Carmen','Quintana Roo'),
 'san luis potosí':('San Luis Potosí','San Luis Potosí'),'ciudad valles':('Ciudad Valles','San Luis Potosí'),'culiacán':('Culiacán','Sinaloa'),'mazatlán':('Mazatlán','Sinaloa'),
 'los mochis':('Los Mochis','Sinaloa'),'hermosillo':('Hermosillo','Sonora'),'ciudad obregón':('Ciudad Obregón','Sonora'),'nogales sonora':('Nogales','Sonora'),
 'villahermosa':('Villahermosa','Tabasco'),'ciudad victoria':('Ciudad Victoria','Tamaulipas'),'tampico':('Tampico','Tamaulipas'),'reynosa':('Reynosa','Tamaulipas'),
 'matamoros':('Matamoros','Tamaulipas'),'nuevo laredo':('Nuevo Laredo','Tamaulipas'),'tlaxcala':('Tlaxcala','Tlaxcala'),'xalapa':('Xalapa','Veracruz'),
 'veracruz':('Veracruz','Veracruz'),'coatzacoalcos':('Coatzacoalcos','Veracruz'),'poza rica':('Poza Rica','Veracruz'),'córdoba veracruz':('Córdoba','Veracruz'),
 'orizaba':('Orizaba','Veracruz'),'mérida':('Mérida','Yucatán'),'zacatecas':('Zacatecas','Zacatecas'),'fresnillo':('Fresnillo','Zacatecas'),
 'silao':('Silao','Guanajuato'),'dolores hidalgo':('Dolores Hidalgo','Guanajuato'),'san francisco del rincón':('San Francisco del Rincón','Guanajuato'),
 'lagos de moreno':('Lagos de Moreno','Jalisco'),'san luis de la paz':('San Luis de la Paz','Guanajuato'),'acámbaro':('Acámbaro','Guanajuato'),
 'moroleón':('Moroleón','Guanajuato'),'uriangato':('Uriangato','Guanajuato'),'la piedad':('La Piedad','Michoacán'),'ciudad guzmán':('Ciudad Guzmán','Jalisco'),
 'tequisquiapan':('Tequisquiapan','Querétaro'),'pénjamo':('Pénjamo','Guanajuato'),'valle de santiago':('Valle de Santiago','Guanajuato'),'cortazar':('Cortazar','Guanajuato'),
 'apaseo el grande':('Apaseo el Grande','Guanajuato'),'guadalupe':('Guadalupe','Nuevo León'),'santa catarina':('Santa Catarina','Nuevo León'),'san pedro':('San Pedro Garza García','Nuevo León'),
}
ESTADO_POR_CIUDAD = {v[0]: v[1] for v in CIU.values()}
def _norm0(x):
    x = unicodedata.normalize('NFKD', x or '').encode('ascii','ignore').decode().lower()
    return re.sub(r'\s+',' ', re.sub(r'[^a-z0-9 ]',' ', x)).strip()
CIU_N = {_norm0(k): v for k, v in CIU.items()}
CIU_N.update({'leon guanajuato':CIU['león'],'queretaro':CIU['querétaro'],'san luis potosi':CIU['san luis potosí'],'zamora michoacan':CIU['zamora michoacán'],
              'san juan del rio queretaro':CIU['san juan del río'],'morelia michoacan':CIU['morelia'],'guadalajara jalisco':CIU['guadalajara'],'cdmx':CIU['cdmx'],
              'ciudad de mexico':CIU['cdmx'],'estado de mexico':('Estado de México','Estado de México'),'toluca estado de mexico':CIU['toluca'],
              'slp':CIU['san luis potosí'],'tlajomulco':('Tlajomulco','Jalisco'),'salamanca':CIU['salamanca guanajuato'],'guanajuato capital':CIU['guanajuato'],
              'gdl':CIU['guadalajara'],'mty':CIU['monterrey'],'qro':CIU['querétaro'],'ags':CIU['aguascalientes']})
ESTADO_POR_CIUDAD.update({'Tlajomulco':'Jalisco'})
CIUDAD_TOKENS = set()
for k in CIU_N:
    for t in k.split(): CIUDAD_TOKENS.add(t)
CIUDAD_TOKENS |= {'gdl','mty','qro','ags','slp','cdmx','centro','plaza','sur','norte','oriente','poniente'}

def norm(s):
    s = unicodedata.normalize('NFKD', s or '').encode('ascii','ignore').decode().lower()
    return re.sub(r'\s+',' ', re.sub(r'[^a-z0-9 ]',' ', s)).strip()
def tel10(p):
    if not p: return None
    d = re.sub(r'\D','', p)
    if d.startswith('52') and len(d) in (12,13): d = d[-10:]
    if len(d) == 10 and d[0] != '0': return d
    return None
def fmt_tel(d): return f'+52 {d[:2]} {d[2:6]} {d[6:]}' if d[:2] in ('55','56','33','81') else f'+52 {d[:3]} {d[3:6]} {d[6:]}'
def ciudad_de(q):
    ql = _norm0(q)
    if ql in CIU_N: return CIU_N[ql]
    for st in sorted(STEMS, key=len, reverse=True):
        stn = _norm0(st)
        if ql.startswith(stn):
            rest = ql[len(stn):].strip()
            rest = re.sub(r'^(en|de|renta)\s+','',rest)
            if rest in CIU_N: return CIU_N[rest]
            return (rest.title(), None) if rest else (None,None)
    for k in sorted(CIU_N, key=len, reverse=True):
        if ql.endswith(' '+k): return CIU_N[k]
    return (None,None)
def categoria(txt):
    for p in (txt or '').split('|'):
        if '·' in p: return p.split('·')[0].strip()
    return None
GENERICOS = set((CFG.get('genericos','') + ' zapateria zapaterias zapatos calzado shoes joyeria joyerias joyas joyero relojeria relojerias relojes botas vaquera vaqueras vaquero vaqueros western uniformes uniforme medicos medico telas tela merceria outlet outlets deportes deportiva deportivo deportivos sport sports moda modas mayoreo mayorista mayoristas fabrica fabricas confeccion confecciones maquiladora disfraces disfraz vintage tallas talla extra extras grandes plus size charro charra charros sombrereria sublimacion sublimado playeras estampado boutiques store tiendas jeans jean mezclilla denim pantalones pantalon bano banos banador banadores bikinis bikini swimwear beach playa' + ' renta rentas venta ventas tuxedos tuxedo suits dress dresses sucursal suc matriz de del la el los las y e en para con vestidos vestido trajes traje smoking smokings esmoquin esmoquines tuxedo boutique novia novias xv anos quince quinceanera quinceaneras fiesta fiestas gala noche eventos evento sucursal sucursales tienda ropa alquiler etiqueta caballero caballeros dama damas by mx com').split())
def marca(nombre):
    toks = [t for t in norm(nombre).split() if t not in GENERICOS and t not in CIUDAD_TOKENS]
    return ' '.join(toks[:3])
SEMI = set('ceremonias disenos creaciones novedades floreria fashion imperio boutique confecciones exclusivos elegancia elegante glamour princesa princesas quinceanera coleccion collection atelier modas moda dresses vestuario etiqueta caballero padrino catrin marina victoria valentina veronica alejandra fernanda esmeralda'.split())
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
    if any(h in host for h in ('facebook.com','instagram.com','linktr.ee','wa.me','whatsapp.com','sites.google','negocio.site','business.site','tiktok.com','wixsite','google.com','bit.ly')):
        return host + path if path and path != '/' else None
    return host

def consultas_por_md5():
    m = {}
    for f in [os.path.join(D, 'queries-' + GIRO + '.txt')]:
        for l in open(f, encoding='utf8', errors='ignore'):
            l = l.strip()
            if l: m[hashlib.md5((l + '\n').encode()).hexdigest()[:10]] = l
    return m
def leer_crudo():
    rows = []; fuera = Counter()
    md5q = consultas_por_md5()
    files = sorted(glob.glob(os.path.join(POOL, '*.json')))
    for f in files:
        p = f if os.path.isabs(f) else os.path.join(D, f)
        if not os.path.exists(p) or os.path.getsize(p) == 0: continue
        try: data = json.load(open(p))
        except Exception as e: print('  ! no se pudo leer', os.path.basename(f), e, file=sys.stderr); continue
        if isinstance(data, dict): data = list(data.values())
        qf = md5q.get(os.path.basename(p)[:10])
        if qf and any(x in qf for x in EXCLUIR_Q): fuera['consulta excluida'] += len(data); continue
        for r in data:
            if not isinstance(r, dict) or not r.get('name'): continue
            if not r.get('q'):
                if qf: r['q'] = qf
                elif r.get('city'): r['q'] = CFG['stems'][0] + ' ' + r['city']
            cat = categoria(r.get('txt'))
            if cat and cat.lower() in ('abierto','cerrado','abre pronto','cierra pronto','cerrado temporalmente','abierto las 24 horas'): cat = None
            if cat and any(x in cat.lower() for x in CAT_FUERA): fuera['categoría: ' + cat] += 1; continue
            if CAT_OK and not (cat and any(x in cat.lower() for x in CAT_OK)) and not (CFG.get('nombre_ok') and re.search(CFG['nombre_ok'], r['name'], re.I)): fuera['cat no del giro: ' + (cat or '?')] += 1; continue
            if CFG.get('nombre_ok_obligatorio') and not re.search(CFG['nombre_ok'], r['name'] + ' ' + (cat or ''), re.I): fuera['nombre no del giro'] += 1; continue
            if NOMBRE_FUERA.search(r['name']) or (NOMBRE_FUERA_GIRO and NOMBRE_FUERA_GIRO.search(r['name'])): fuera['nombre'] += 1; continue
            r['cat'] = cat
            rows.append(r)
    print('fuera por filtro:', sum(fuera.values()), dict(fuera.most_common(8)))
    return rows

def prep():
    rows = leer_crudo()
    print('filas crudas:', len(rows))
    # 1) por fila: teléfono a 10 dígitos; fuera lo que no tenga
    sin_tel = 0; vistos = {}
    for r in rows:
        t = tel10(r.get('phone'))
        if not t:
            # a veces el teléfono está en txt
            m = re.search(r'(\+?52\s?)?(\d{2,3}[\s\-]\d{3,4}[\s\-]\d{4})', r.get('txt') or '')
            t = tel10(m.group(0)) if m else None
        if not t: sin_tel += 1; continue
        c, e = ciudad_de(r.get('q') if isinstance(r.get('q'), str) else (r.get('q') or [''])[0])
        k = (norm(r['name']), t)
        rv = r.get('reviews'); rv = int(re.sub(r'\D','', str(rv))) if rv not in (None,'') else None
        rt = r.get('rating'); rt = float(str(rt).replace(',','.')) if rt not in (None,'') else None
        cur = vistos.get(k)
        if cur:
            cur['reviews'] = max(cur['reviews'] or 0, rv or 0) or None
            cur['web'] = cur['web'] or r.get('web'); cur['url'] = cur['url'] or r.get('url')
            cur['ciudad'] = cur['ciudad'] or c; cur['estado'] = cur['estado'] or e
            cur['qs'].add(r.get('q') if isinstance(r.get('q'), str) else (r.get('q') or [''])[0])
            continue
        vistos[k] = dict(name=r['name'].strip(), tel=t, reviews=rv, rating=rt, web=r.get('web'), url=r.get('url'), ciudad=c, estado=e, txt=(r.get('txt') or '')[:220],
                         qs={r.get('q') if isinstance(r.get('q'), str) else (r.get('q') or [''])[0]})
    print('sin teléfono (fuera):', sin_tel, '· con teléfono únicos (nombre+tel):', len(vistos))
    # 2) agrupar sucursales: mismo dominio, o misma marca+ciudad
    grupos = defaultdict(list)
    for v in vistos.values():
        dom = dominio(v['web'])
        mk = marca(v['name'])
        key = ('dom', dom) if dom else ('marca', mk) if distintiva(mk) else ('marca', mk or norm(v['name']), v['ciudad'])
        grupos[key].append(v)
    cuentas = []
    for key, vs in grupos.items():
        vs.sort(key=lambda x: (-(x['reviews'] or 0)))
        p = vs[0]
        tels = []; 
        for v in vs:
            if v['tel'] not in tels: tels.append(v['tel'])
        ciudades = Counter(v['ciudad'] for v in vs if v['ciudad'])
        ciudad = ciudades.most_common(1)[0][0] if ciudades else p['ciudad']
        estado = ESTADO_POR_CIUDAD.get(ciudad) or p['estado']
        nombre = re.sub(r'\s*[\(\-–|].*$', '', p['name']).strip() or p['name']
        if len(vs) > 1 and key[0] == 'marca': nombre = p['name']
        cuentas.append(dict(nombre=nombre, nombre_maps=p['name'], ciudad=ciudad, estado=estado, sucursales=len(vs), ciudades=len(ciudades),
                            rating=p['rating'], resenas=max((v['reviews'] or 0) for v in vs) or None, resenas_total=sum((v['reviews'] or 0) for v in vs) or None,
                            web=next((v['web'] for v in vs if v['web']), None), url=p['url'], tels=tels,
                            sucursales_lista=[dict(nombre=v['name'], tel=v['tel'], ciudad=v['ciudad'], url=v['url'], resenas=v['reviews']) for v in vs],
                            qs=sorted(set().union(*[v['qs'] for v in vs]))))
    print('cuentas agrupadas:', len(cuentas), '· con 2+ sucursales:', sum(1 for c in cuentas if c['sucursales']>1))
    # 3) contra la base: por nombre+ciudad (índice único) y por teléfono
    base = json.loads(subprocess.check_output([SQL,'-e',"select a.id, lower(a.nombre) n, coalesce(a.ciudad,'') c, a.giro, a.sitio, (select string_agg(valor,'|') from abm_canales k where k.cuenta_id=a.id and k.tipo in ('telefono','whatsapp_tienda','whatsapp_dueno')) tels from abm_cuentas a"]))
    por_nombre = {(b['n'], b['c']): b for b in base}; por_nombre_solo = defaultdict(list)
    for b in base: por_nombre_solo[b['n']].append(b)
    por_tel = {}
    for b in base:
        for t in (b['tels'] or '').split('|'):
            d = tel10(t)
            if d: por_tel[d] = b
    por_dom = {dominio(b['sitio']): b for b in base if dominio(b['sitio'])}
    por_marca = {}
    for b in base:
        if b['giro'] != GIRO: continue
        mk = marca(b['n'])
        if distintiva(mk, 7): por_marca.setdefault(mk, b)
    nuevas = []; existentes = []
    for c in cuentas:
        hit = por_nombre.get((c['nombre'].lower(), c['ciudad'] or '')) or por_nombre.get((c['nombre_maps'].lower(), c['ciudad'] or ''))
        if not hit:
            for t in c['tels']:
                if t in por_tel: hit = por_tel[t]; break
        if not hit and dominio(c['web']) in por_dom: hit = por_dom[dominio(c['web'])]
        if not hit:
            mk = marca(c['nombre_maps'])
            if distintiva(mk, 7) and mk in por_marca: hit = por_marca[mk]
        if not hit:
            # mismo nombre exacto en otra ciudad y sin ciudad en la base
            cands = por_nombre_solo.get(c['nombre'].lower()) or por_nombre_solo.get(c['nombre_maps'].lower()) or []
            if cands and any(not b['c'] for b in cands): hit = next(b for b in cands if not b['c'])
        if hit: c['id_existente'] = hit['id']; c['giro_existente'] = hit['giro']; existentes.append(c)
        else: nuevas.append(c)
    print('ya en la base:', len(existentes), '· nuevas a cargar:', len(nuevas))
    # 4) SQL de cuentas
    def q(s): return 'null' if s is None else "'" + str(s).replace("'", "''") + "'"
    def puntaje(c):
        suc = c['sucursales']; enc = 10 + (12 if suc>=2 else 0) + (10 if suc>=5 else 0) + (8 if suc>=15 else 0)
        dol = (10 if (c['rating'] or 5) < 4.5 and suc>=3 else 0)
        acc = 8  # teléfono/WhatsApp del mostrador; el email se suma cuando aparezca
        return enc, dol, acc
    vals = []
    for c in nuevas:
        enc, dol, acc = puntaje(c)
        suc = c['sucursales']
        tam = 'grande' if suc>=15 else 'mediana' if suc>=5 else 'chica' if suc>=2 else 'micro'
        ruta = 'diagnostico' if suc>=5 else 'demo'
        sub = CFG['subgiro'](c) if callable(CFG.get('subgiro')) else CFG.get('subgiro')
        nota = f"Google Maps: {c['resenas'] or 0} reseñas" + (f", {suc} sucursales ({c['ciudades']} ciudades)" if suc>1 else '') + f". Consulta: {([q for q in c['qs'] if q] or ['?'])[0]}"
        web = (c['web'] or '').strip(); fb = ig = None
        if re.search(r'facebook\.com|fb\.com|fb\.me', web): fb, web = web, None
        elif 'instagram.com' in web: ig, web = web, None
        c['fb'], c['ig'], c['sitio'] = fb, ig, web or None
        vals.append('(' + ','.join([q(c['nombre']), q(GIRO), q(sub), q(c['ciudad']), q(c['estado']), "'México'", "'MXN'", str(suc), q('alta' if suc==1 else 'media'), q(tam), q(ruta),
                    q(web or None), q(fb), q(ig), q(c['rating']), q(c['resenas']), q(nota), str(enc), str(dol), str(acc), str(enc+dol+acc), "'sin_tocar'"]) + ')')
    head = 'insert into abm_cuentas (nombre,giro,subgiro,ciudad,estado_geo,pais,moneda,sucursales,sucursales_confianza,tamano,ruta,sitio,facebook,instagram,google_rating,google_resenas,nota,encaje,dolor,accesibilidad,puntaje,etapa) values\n'
    for f in glob.glob(os.path.join(OUT,GIRO + '-cuentas-*.sql')): os.remove(f)
    for i in range(0, len(vals), 150):
        open(os.path.join(OUT, f'{GIRO}-cuentas-{i//150:02d}.sql'),'w').write(head + ',\n'.join(vals[i:i+150]) + "\non conflict (lower(nombre), coalesce(ciudad,'')) do nothing;\n")
    print('archivos SQL de cuentas:', (len(vals)+149)//150)
    json.dump(dict(nuevas=nuevas, existentes=existentes), open(os.path.join(D,GIRO + '-fusion.json'),'w'), ensure_ascii=False, indent=1)
    # reporte corto
    print('\n-- top 15 nuevas por reseñas --')
    for c in sorted(nuevas, key=lambda x: -(x['resenas_total'] or 0))[:15]:
        print(f"  {c['nombre'][:45]:45} {c['ciudad'] or '?':22} suc={c['sucursales']} reseñas={c['resenas_total']} web={'sí' if c['web'] else 'no'}")
    print('\n-- por estado (nuevas) --')
    for e, n in Counter(c['estado'] or '?' for c in nuevas).most_common(): print(f'  {e:22} {n}')

def hijos():
    fus = json.load(open(os.path.join(D,GIRO + '-fusion.json')))
    base = json.loads(subprocess.check_output([SQL,'-e',f"select a.id, lower(a.nombre) n, coalesce(a.ciudad,'') c from abm_cuentas a where a.giro='{GIRO}'"]))
    ids = {(b['n'], b['c']): b['id'] for b in base}
    canales_ex = json.loads(subprocess.check_output([SQL,'-e',f"select k.cuenta_id, k.valor from abm_canales k join abm_cuentas a on a.id=k.cuenta_id where a.giro='{GIRO}' and k.tipo in ('telefono','whatsapp_tienda','whatsapp_dueno')"]))
    tel_ex = defaultdict(set)
    for k in canales_ex:
        d = tel10(k['valor']); 
        if d: tel_ex[k['cuenta_id']].add(d)
    def q(s): return 'null' if s is None else "'" + str(s).replace("'", "''") + "'"
    can = []; fue = []; sin_id = 0
    for c in fus['nuevas'] + fus['existentes']:
        cid = c.get('id_existente') or ids.get((c['nombre'].lower(), c['ciudad'] or ''))
        if not cid: sin_id += 1; continue
        for s in c['sucursales_lista']:
            if s['tel'] in tel_ex[cid]: continue
            tel_ex[cid].add(s['tel'])
            can.append(f"({q(cid)},'telefono',{q(fmt_tel(s['tel']))},'alta','sin_probar',true)")
            fue.append(f"({q(cid)},'telefono',{q(fmt_tel(s['tel']))},{q(s['url'] or ('https://www.google.com/maps/search/' + (s['nombre'] + ' ' + (s['ciudad'] or '')).strip().replace(' ','+')))},'google_maps','alta','carga {GIRO} {MES}')")
        if not c.get('id_existente'):
            fue.append(f"({q(cid)},'google_rating',{q(c['rating'])},{q(c['url'] or ('https://www.google.com/maps/search/' + (c['nombre_maps'] + ' ' + (c['ciudad'] or '')).strip().replace(' ','+')))},'google_maps','alta','carga {GIRO} {MES}')")
    # --- lo que salió de los sitios web (renta-sitios.json) ---
    upd = []
    sit_path = os.path.join(D, GIRO + '-sitios.json')
    sitios = json.load(open(sit_path)) if os.path.exists(sit_path) else []
    ex_can = json.loads(subprocess.check_output([SQL,'-e',f"select k.cuenta_id, k.tipo, lower(k.valor) v from abm_canales k join abm_cuentas a on a.id=k.cuenta_id where a.giro='{GIRO}'"]))
    ya = {(k['cuenta_id'], k['tipo'], k['v']) for k in ex_can}
    ya_tel = defaultdict(set)
    for k in ex_can:
        d = tel10(k['v'])
        if d and k['tipo'].startswith('whatsapp'): ya_tel[k['cuenta_id']].add(d)
    por_clave = {(c['nombre'].lower(), c['ciudad'] or ''): c for c in fus['nuevas'] + fus['existentes']}
    GEN = re.compile(r'^(info|contacto|contact|ventas|hola|hello|atencion|atencionaclientes|servicioacliente|servicio|renta|rentas|admin|administracion|clientes|sac|soporte|privacidad|ecommerce|tienda|online|marketing)\b')
    n_mail = n_wa = n_dm = 0
    for s_ in sitios:
        c = por_clave.get((s_['nombre'].lower(), s_['ciudad'] or ''))
        if not c: continue
        cid = c.get('id_existente') or ids.get((c['nombre'].lower(), c['ciudad'] or ''))
        if not cid: continue
        if c.get('id_existente') and c.get('giro_existente') != GIRO: continue
        dom_sitio = dominio(s_.get('final') or s_['web']) or ''
        # canales sociales (la "web" que era Facebook/Instagram también cuenta)
        for tipo, val in (('dm_fb', s_.get('fb') and 'https://www.facebook.com/' + s_['fb']), ('dm_ig', s_.get('ig') and 'https://instagram.com/' + s_['ig']),
                          ('dm_fb', c.get('fb')), ('dm_ig', c.get('ig'))):
            if val and (cid, tipo, val.lower()) not in ya and not any(k[0]==cid and k[1]==tipo for k in ya):
                ya.add((cid, tipo, val.lower())); n_dm += 1
                can.append(f"({q(cid)},{q(tipo)},{q(val)},'media','sin_probar',true)")
                fue.append(f"({q(cid)},{q(tipo)},{q(val)},{q(s_['web'])},'sitio_oficial','media','carga {GIRO} {MES}')")
        if s_.get('http') != 200: continue
        for e in s_.get('emails') or []:
            if (cid, 'email_generico', e) in ya or (cid, 'email_direccion', e) in ya: continue
            usuario, _, dom_mail = e.partition('@')
            tipo = 'email_generico' if GEN.match(usuario) else 'email_direccion'
            gratis = re.search(r'gmail|hotmail|outlook|yahoo|live\.com|icloud', dom_mail)
            conf = 'media' if gratis else 'alta' if dom_sitio and dom_mail.split('.')[0] in dom_sitio else 'baja'
            ya.add((cid, tipo, e)); n_mail += 1
            can.append(f"({q(cid)},{q(tipo)},{q(e)},{q(conf)},'sin_probar',true)")
            fue.append(f"({q(cid)},{q(tipo)},{q(e)},{q(s_['web'])},'sitio_oficial',{q(conf)},'carga {GIRO} {MES}')")
        for w in s_.get('wa') or []:
            if w in ya_tel[cid]: continue
            ya_tel[cid].add(w); n_wa += 1
            can.append(f"({q(cid)},'whatsapp_tienda',{q('https://wa.me/52' + w)},'alta','sin_probar',true)")
            fue.append(f"({q(cid)},'whatsapp_tienda',{q('https://wa.me/52' + w)},{q(s_['web'])},'sitio_oficial','alta','carga {GIRO} {MES}')")
        sets = [f"plataforma_web={q(s_.get('plataforma') or 'A la medida / otro')}", f"sitio_http={s_['http']}", f"sitio_seg={s_.get('seg') or 'null'}", f"sitio_carrito={'true' if s_.get('carrito') else 'false'}"]
        if s_.get('ig') and not c.get('ig'): sets.append(f"instagram={q('https://instagram.com/' + s_['ig'])}")
        if s_.get('fb') and not c.get('fb'): sets.append(f"facebook={q('https://www.facebook.com/' + s_['fb'])}")
        if c.get('id_existente'): sets = [x for x in sets if x.startswith(('sitio_http','sitio_seg','plataforma_web'))]
        upd.append(f"update abm_cuentas set {', '.join(sets)}, updated_at=now() where id={q(cid)};")
    print('de los sitios: emails', n_mail, '· wa.me', n_wa, '· dm ig/fb', n_dm, '· updates de cuenta', len(upd))
    for f in glob.glob(os.path.join(OUT,GIRO + '-hijos-*.sql')): os.remove(f)
    n = 0
    if upd:
        open(os.path.join(OUT, f'{GIRO}-hijos-{n:02d}.sql'),'w').write('\n'.join(upd) + '\n'); n += 1
    for i in range(0, len(can), 200):
        open(os.path.join(OUT, f'{GIRO}-hijos-{n:02d}.sql'),'w').write('insert into abm_canales (cuenta_id,tipo,valor,confianza,estado,es_de_la_tienda) values\n' + ',\n'.join(can[i:i+200]) + '\non conflict (cuenta_id,tipo,lower(valor)) do nothing;\n'); n += 1
    for i in range(0, len(fue), 200):
        open(os.path.join(OUT, f'{GIRO}-hijos-{n:02d}.sql'),'w').write('insert into abm_fuentes (cuenta_id,campo,valor,url,metodo,confianza,agente) values\n' + ',\n'.join(fue[i:i+200]) + ';\n'); n += 1
    print('canales telefono nuevos:', len(can), '· fuentes:', len(fue), '· sin id (no se cargó?):', sin_id, '· archivos:', n)

if __name__ == '__main__':
    {'prep': prep, 'hijos': hijos}[sys.argv[1]]()
