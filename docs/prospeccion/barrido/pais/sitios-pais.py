#!/usr/bin/env python3
"""Cruce de los que SÍ tienen sitio web, fuera de México: plataforma, http, carrito,
correos, wa.me DECLARADO (validado con e164 del país), Instagram/Facebook.
Lee <giro>-pais-fusion.json (de carga-pais.py prep), escribe <giro>-pais-sitios.json.
Solo páginas públicas: home + contacto + aviso/política de privacidad.
  python3 sitios-pais.py novias [isos…]"""
import json, re, subprocess, sys, os, threading, concurrent.futures as cf
from urllib.parse import urljoin
from paises import PAISES, e164, es_movil
D = os.path.dirname(os.path.abspath(__file__))
GIRO = sys.argv[1]; ISOS = sys.argv[2:] or list(PAISES)
fus = json.load(open(os.path.join(D, GIRO + '-pais-fusion.json')))
cuentas = [c for c in fus['nuevas'] + fus['existentes'] if c.get('web') and c['iso'] in ISOS]
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36'
FIRMAS = [('Shopify', r'cdn\.shopify\.com|shopify-features|Shopify\.theme|myshopify\.com'), ('VTEX', r'vtexassets\.com|vtex\.com\.br'),
 ('WooCommerce', r'woocommerce'), ('WordPress', r'wp-content|wp-includes'), ('Magento', r'magento|/static/version\d'), ('Wix', r'wix\.com|wixstatic|_wixCssImports'),
 ('Squarespace', r'squarespace\.com|static1\.squarespace'), ('Tiendanube', r'tiendanube|nuvemshop'), ('Jumpseller', r'jumpseller'), ('Bsale', r'bsale'),
 ('Webflow', r'webflow\.(com|io)'), ('PrestaShop', r'prestashop'), ('Next.js', r'/_next/static'), ('GoDaddy/Wsb', r'websitebuilder|godaddy'), ('Jimdo', r'jimdo'), ('Google Sites', r'sites\.google\.com')]
CARRITO = r'(agregar al carrito|añadir al carrito|add to cart|/cart\b|carrito de compras|comprar ahora)'
EMAIL = re.compile(r'[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,8}', re.I)
EMAIL_BASURA = re.compile(r'sentry|shopify|\.png|\.jpg|\.gif|\.svg|\.webp|wixpress|@[0-9]|example|dominio|ejemplo|@2x|godaddy|w3\.org|schema\.org|@sentry|noreply|no-reply|yourdomain|email@|correo@|nombre@|usuario@|@email\.|@mail\.com$|\.js$|\.css$|doe\.com|xxxx|test@|prueba@|@test\.|your@|gdprlocal|linktr\.ee|donweb|rfuenzalida|impallari|pixelspread|nobleui|online-tools|ndiscovered|@pronovias\.com|@morilee|@wix\.com|@squarespace|@webflow|@google\.com|@facebook\.com|@instagram\.com|@apple\.com|^account-name|my-domain|agency@|tedbodin', re.I)
# Proveedores que se cuelan como si fueran el negocio (aprendido con la carga
# Latam de novias): el DPO de linktr.ee/gdprlocal en un link-in-bio, el
# diseñador de la tipografía (impallari, rfuenzalida), el tema de la web
# (nobleui, pixelspread), el corporativo de la marca que distribuyen
# (Pronovias, Morilee). Además, un correo que aparece en 2+ cuentas SIN
# relación se descarta entero (regla del scraper de México).
WA = re.compile(r'(?:wa\.me|api\.whatsapp\.com/send/?\?phone=|whatsapp\.com/send/?\?phone=|wa\.link)/?\+?(\d{7,15})', re.I)
IG = re.compile(r'instagram\.com/([A-Za-z0-9_.]{2,30})/?', re.I)
FB = re.compile(r'facebook\.com/([A-Za-z0-9_.\-]{3,60})/?', re.I)
IG_BASURA = {'p', 'explore', 'reel', 'reels', 'accounts', 'share', 'stories', 'tv', 'oauth', 'rsrc.php', 'static', 'legal', 'about', 'developer', 'directory'}
# Un «sitio» que es Instagram/Facebook no se puede leer sin sesión (muro de
# login): se anota la red y no se pierde tiempo; el contacto saldrá de otro lado.
RED_SOCIAL = re.compile(r'^https?://(www\.)?(instagram\.com|facebook\.com|fb\.com|m\.facebook\.com|tiktok\.com)/', re.I)
# Widgets de WhatsApp: el número vive en la configuración del plugin, no en un
# wa.me (joinchat/creame «"phone":"57…"», Elfsight, GetButton, Chaty, Tochat) o en
# texto plano «WhatsApp: +57 300 123 4567». Es un WhatsApp DECLARADO por el
# negocio igual que un wa.me: se toma solo si es móvil válido de SU país.
WA_WIDGET = re.compile(r'(?:whatsapp|joinchat|wa[_-]?(?:number|phone|chat)|chaty|getbutton|tochat)[^0-9]{0,120}?\+?(\d[\d\s().-]{7,20}\d)', re.I)
WA_LINK = re.compile(r'https?://(?:www\.)?wa\.link/[A-Za-z0-9_-]{3,20}', re.I)
# Correos ofuscados: Cloudflare data-cfemail, «info [at] dominio [dot] com»,
# «info(arroba)dominio.com», entidades &#64;.
CF_EMAIL = re.compile(r'data-cfemail=["\']([0-9a-f]{10,})["\']', re.I)
OFUSCADO = re.compile(r'([a-z0-9._%+-]+)\s*(?:\[at\]|\(at\)|\[arroba\]|\(arroba\)|\s+arroba\s+|&#64;|&#x40;|\{at\})\s*([a-z0-9-]+(?:\s*(?:\[dot\]|\(dot\)|\[punto\]|\(punto\)|\.)\s*[a-z0-9-]+)+)', re.I)
def cf_decode(h):
    try:
        k = int(h[:2], 16); return ''.join(chr(int(h[i:i+2], 16) ^ k) for i in range(2, len(h), 2))
    except Exception: return ''
def resolver_walink(u):
    """wa.link/abc → el teléfono al que redirige (api.whatsapp.com/send?phone=…)."""
    try:
        p = subprocess.run(['curl', '-sSI', '--max-time', '12', '-A', UA, '-o', '/dev/null', '-w', '%{redirect_url}', u], capture_output=True, text=True)
        m = re.search(r'phone=\+?(\d{7,15})', p.stdout or '')
        return m.group(1) if m else None
    except Exception: return None

FB_BASURA = {'sharer', 'sharer.php', 'plugins', 'tr', 'dialog', 'share', 'login', 'profile.php', 'pages', 'groups', 'hashtag', 'privacy', 'policies', 'help', '2008', 'photo', 'photo.php', 'watch', 'events'}
SUBPAGINAS = ['/contacto', '/contact', '/pages/contacto', '/pages/contact', '/aviso-de-privacidad', '/politica-de-privacidad', '/politica-de-datos', '/policies/privacy-policy', '/policies/legal-notice', '/pages/aviso-de-privacidad', '/sucursales', '/pages/sucursales', '/tiendas', '/nosotros']

NAV = threading.Semaphore(3)   # Chromium pesa: máximo tres a la vez
def navegador(u):
    """(html, código, url final) con Chromium; ("", 0, u) si tampoco entra."""
    try:
      with NAV:
        p = subprocess.run(['node', os.path.join(D, 'html-nav.js'), u], capture_output=True, text=True, timeout=90)
      r = json.loads(p.stdout or '[]')
      if r and r[0].get('html') and r[0].get('status', 0) < 400 and len(r[0]['html']) > 200: return r[0]['html'], 200, r[0]['final']
    except Exception: pass
    return '', 0, u

def curl(u, t=20):
    p = subprocess.run(['curl', '-sSL', '--max-time', str(t), '--compressed', '-A', UA, '-w', '\n@@%{http_code}|%{size_download}|%{time_total}|%{url_effective}', u], capture_output=True, text=True, errors='ignore')
    s = p.stdout
    cab = s.rsplit('@@', 1)[-1] if '@@' in s else '0|0|0|'
    cod, peso, tiempo, final = (cab.split('|') + ['', '', '', ''])[:4]
    return s.rsplit('@@', 1)[0] if '@@' in s else s, int(cod or 0), round(float(tiempo or 0), 2), final

def mira(c):
    u = c['web'].strip()
    if not u.startswith('http'): u = 'http://' + u
    out = dict(iso=c['iso'], nombre=c['nombre'], ciudad=c['ciudad'], id_existente=c.get('id_existente'), web=u)
    # El «sitio» de Maps a veces ES un wa.me/api.whatsapp: ese número lo declaró
    # el negocio como su WhatsApp, no hay nada que leer.
    was_url = []
    for m in WA.finditer(u):
        d = m.group(1)
        e = e164('+' + d, c['iso']) if d.startswith(PAISES[c['iso']]['lada']) else e164(d, c['iso'])
        if e and es_movil(e, c['iso']): was_url.append(e)
    if was_url or re.search(r'wa\.me|whatsapp\.com', u, re.I):
        out.update(http=200, plataforma='WhatsApp', emails=[], wa=was_url[:3], ig=None, fb=None, red='whatsapp'); return out
    if RED_SOCIAL.search(u):
        out.update(http=0, plataforma=None, emails=[], wa=[], ig=(IG.search(u).group(1) if IG.search(u) else None), fb=(FB.search(u).group(1) if FB.search(u) else None), red='instagram' if 'instagram' in u else 'facebook'); return out
    try:
        html, cod, seg, final = curl(u)
        # Plan B: muro anti-bots (403/429/409), un 202 de «espere» o un 301
        # que curl no resolvió. Un Chromium de verdad suele entrar; el 0/404/5xx
        # se queda como está porque ahí el sitio sí está muerto (es un dato).
        if cod in (403, 429, 409, 202, 301, 302) or (cod == 200 and len(html) < 200):
            html2, cod2, final2 = navegador(u)
            if cod2 == 200 and len(html2) > len(html): html, cod, final = html2, cod2, final2; out['via'] = 'navegador'
        out.update(http=cod, seg=seg, final=final, https=final.startswith('https'))
        h = html.lower()
        if cod != 200 or len(h) < 200:
            out['plataforma'] = None; out['emails'] = []; out['wa'] = []; out['ig'] = None; out['fb'] = None; return out
        plat = [n for n, rx in FIRMAS if re.search(rx, h)]
        out['plataforma'] = plat[0] if plat else None
        out['carrito'] = bool(re.search(CARRITO, h))
        out['wa_boton'] = bool(re.search(r'wa\.me|api\.whatsapp\.com|wa\.link', h))
        textos = [html]; base = final or u; links = set()
        for m in re.finditer(r'href=["\']([^"\']+)["\']', html, re.I):
            href = m.group(1)
            if re.search(r'contact|aviso|privac|datos|sucursal|tiendas|legal|nosotros', href, re.I):
                full = urljoin(base, href)
                if re.match(r'https?://(www\.)?' + re.escape(re.sub(r'^https?://(www\.)?', '', base).split('/')[0]), full): links.add(full.split('#')[0])
        for sp in SUBPAGINAS: links.add(urljoin(base, sp))
        for l in list(links)[:8]:
            try:
                t, cd, _, _ = curl(l, 15)
                if cd == 200 and len(t) > 200: textos.append(t)
            except Exception: pass
        todo = '\n'.join(textos)
        # Si con curl no aparece ni correo ni WhatsApp, se abre la home con
        # Chromium: los pies de página y widgets de WhatsApp de Wix, Next.js,
        # Squarespace o Webflow (y muchos temas de WordPress) se pintan con JS.
        if not (re.search(r'mailto:|wa\.me|api\.whatsapp|data-cfemail', todo, re.I) or EMAIL.search(todo)):
            html2, cod2, _ = navegador(final or u)
            if cod2 == 200 and len(html2) > 200: todo += '\n' + html2; out['via'] = (out.get('via') or '') + '+nav'
        emails = []
        for m in re.finditer(r'mailto:([^"\'?&\s>]+)', todo, re.I): emails.append(m.group(1).lower())
        for m in EMAIL.finditer(todo): emails.append(m.group(0).lower())
        for m in CF_EMAIL.finditer(todo):
            e = cf_decode(m.group(1)).lower()
            if EMAIL.fullmatch(e): emails.append(e)
        for m in OFUSCADO.finditer(todo):
            e = (m.group(1) + '@' + re.sub(r'\s*(?:\[dot\]|\(dot\)|\[punto\]|\(punto\))\s*', '.', m.group(2))).lower().replace(' ', '')
            if EMAIL.fullmatch(e): emails.append(e)
        # Basura pegada al inicio por el HTML: «%20info@», «http://info@»,
        # «+50762702795info@» (el teléfono y el correo sin espacio).
        emails = [re.sub(r'^(?:%20|https?://|\+?\d{7,15})+', '', e) for e in emails]
        emails = [e for e in dict.fromkeys(emails) if not EMAIL_BASURA.search(e) and len(e) < 60]
        out['emails'] = emails[:5]
        # wa.me: el número tal cual lo publicó el negocio, validado para SU país
        # (con o sin código). Si no cuadra con el país, no se guarda: nunca se adivina.
        was = []
        for m in WA.finditer(todo):
            d = m.group(1)
            e = e164('+' + d, c['iso']) if d.startswith(PAISES[c['iso']]['lada']) else e164(d, c['iso'])
            if e and e not in was: was.append(e)
        for m in WA_WIDGET.finditer(todo):
            d = re.sub(r'\D', '', m.group(1))
            if len(d) < 7: continue
            e = e164('+' + d, c['iso']) if d.startswith(PAISES[c['iso']]['lada']) else e164(d, c['iso'])
            if e and es_movil(e, c['iso']) and e not in was: was.append(e)
        for l in dict.fromkeys(WA_LINK.findall(todo)):
            d = resolver_walink(l)
            e = e164('+' + d, c['iso']) if d else None
            if e and e not in was: was.append(e)
        out['wa'] = was[:3]
        igs = [m.group(1) for m in IG.finditer(todo) if m.group(1).lower() not in IG_BASURA]
        out['ig'] = igs[0] if igs else None
        fbs = [m.group(1) for m in FB.finditer(todo) if m.group(1).lower() not in FB_BASURA and not m.group(1).startswith('v')]
        out['fb'] = fbs[0] if fbs else None
    except Exception as e:
        out['error'] = str(e)[:80]
    return out

print(len(cuentas), 'sitios a revisar', file=sys.stderr)
with cf.ThreadPoolExecutor(10) as ex: res = list(ex.map(mira, cuentas))
# Un correo que publican 2+ negocios distintos no es de ninguno: es de su
# proveedor (tipografía, tema, DPO). Salvo que el dominio del correo sea el
# del sitio de cada uno (una cadena con sucursales cargadas por país).
from collections import Counter
veces = Counter(e for r in res for e in r.get('emails') or [])
for r in res:
    dom = re.sub(r'^https?://(www\.)?', '', r.get('web') or '').split('/')[0].lower()
    r['emails'] = [e for e in r.get('emails') or [] if veces[e] == 1 or (dom and e.endswith('@' + dom))]
json.dump(res, open(os.path.join(D, GIRO + '-pais-sitios.json'), 'w'), ensure_ascii=False, indent=1)
ok = [r for r in res if r.get('http') == 200]
from collections import Counter
print('respondieron 200:', len(ok), '· caídos/otros:', len(res) - len(ok))
print('plataformas:', Counter(r.get('plataforma') for r in ok).most_common())
print('con email:', sum(1 for r in ok if r.get('emails')), '· con wa.me:', sum(1 for r in ok if r.get('wa')), '· con IG:', sum(1 for r in ok if r.get('ig')), '· con FB:', sum(1 for r in ok if r.get('fb')), '· con carrito:', sum(1 for r in ok if r.get('carrito')))
