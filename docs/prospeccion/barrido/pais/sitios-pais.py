#!/usr/bin/env python3
"""Cruce de los que SÍ tienen sitio web, fuera de México: plataforma, http, carrito,
correos, wa.me DECLARADO (validado con e164 del país), Instagram/Facebook.
Lee <giro>-pais-fusion.json (de carga-pais.py prep), escribe <giro>-pais-sitios.json.
Solo páginas públicas: home + contacto + aviso/política de privacidad.
  python3 sitios-pais.py novias [isos…]"""
import json, re, subprocess, sys, os, concurrent.futures as cf
from urllib.parse import urljoin
from paises import PAISES, e164
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
EMAIL_BASURA = re.compile(r'sentry|shopify|\.png|\.jpg|\.gif|\.svg|\.webp|wixpress|@[0-9]|example|dominio|ejemplo|@2x|godaddy|w3\.org|schema\.org|@sentry|noreply|no-reply|yourdomain|email@|correo@|nombre@|usuario@|@email\.|@mail\.com$|\.js$|\.css$|doe\.com|xxxx|test@|prueba@|@test\.', re.I)
WA = re.compile(r'(?:wa\.me|api\.whatsapp\.com/send\?phone=|whatsapp\.com/send\?phone=|wa\.link)/?\+?(\d{7,15})', re.I)
IG = re.compile(r'instagram\.com/([A-Za-z0-9_.]{2,30})/?', re.I)
FB = re.compile(r'facebook\.com/([A-Za-z0-9_.\-]{3,60})/?', re.I)
IG_BASURA = {'p', 'explore', 'reel', 'reels', 'accounts', 'share', 'stories', 'tv', 'oauth'}
FB_BASURA = {'sharer', 'sharer.php', 'plugins', 'tr', 'dialog', 'share', 'login', 'profile.php', 'pages', 'groups', 'hashtag', 'privacy', 'policies', 'help', '2008', 'photo', 'photo.php', 'watch', 'events'}
SUBPAGINAS = ['/contacto', '/contact', '/pages/contacto', '/pages/contact', '/aviso-de-privacidad', '/politica-de-privacidad', '/politica-de-datos', '/policies/privacy-policy', '/policies/legal-notice', '/pages/aviso-de-privacidad', '/sucursales', '/pages/sucursales', '/tiendas', '/nosotros']

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
    try:
        html, cod, seg, final = curl(u)
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
        emails = []
        for m in re.finditer(r'mailto:([^"\'?&\s>]+)', todo, re.I): emails.append(m.group(1).lower())
        for m in EMAIL.finditer(todo): emails.append(m.group(0).lower())
        emails = [e for e in dict.fromkeys(emails) if not EMAIL_BASURA.search(e) and len(e) < 60]
        out['emails'] = emails[:5]
        # wa.me: el número tal cual lo publicó el negocio, validado para SU país
        # (con o sin código). Si no cuadra con el país, no se guarda: nunca se adivina.
        was = []
        for m in WA.finditer(todo):
            d = m.group(1)
            e = e164('+' + d, c['iso']) if d.startswith(PAISES[c['iso']]['lada']) else e164(d, c['iso'])
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
json.dump(res, open(os.path.join(D, GIRO + '-pais-sitios.json'), 'w'), ensure_ascii=False, indent=1)
ok = [r for r in res if r.get('http') == 200]
from collections import Counter
print('respondieron 200:', len(ok), '· caídos/otros:', len(res) - len(ok))
print('plataformas:', Counter(r.get('plataforma') for r in ok).most_common())
print('con email:', sum(1 for r in ok if r.get('emails')), '· con wa.me:', sum(1 for r in ok if r.get('wa')), '· con IG:', sum(1 for r in ok if r.get('ig')), '· con FB:', sum(1 for r in ok if r.get('fb')), '· con carrito:', sum(1 for r in ok if r.get('carrito')))
