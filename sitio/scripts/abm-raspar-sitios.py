#!/usr/bin/env python3
"""Saca correo, WhatsApp, teléfono y redes del SITIO PROPIO de cada negocio.

Es el PASO 2 de la cascada del manual (MANUAL-PROSPECCION-ABM.md §0): Google
Maps valida y da el sitio; el sitio da lo demás. El correo no es un campo de
Google My Business, así que este raspado es la única forma de obtenerlo sin
comprarlo.

    python3 scripts/abm-raspar-sitios.py entrada.json salida.json

La entrada es una lista de objetos con al menos `id`, `nombre` y `sitio`.

LO QUE SE APRENDIÓ A GOLPES Y VA CODIFICADO AQUÍ
  · TOPE DE 6 MB. Con 600 KB se perdía la mitad: las páginas de Shopify pesan
    ~2 MB y el enlace de WhatsApp de una tienda estaba en el byte 1,122,790.
  · LISTA NEGRA de proveedores. `team@latofonts.com` entró una vez como el
    correo de una casa de novias: se raspó del crédito de tipografía del sitio,
    y el dominio tenía MX, o sea que habría entregado. Volvió a pasar con
    `impallari@gmail.com` —otro diseñador de tipografías, y con dominio
    gratuito, así que la lista negra de dominios no lo atrapaba.
  · POR ESO: un correo que aparece en VARIAS cuentas distintas se descarta
    ENTERO, no solo la repetición. Si dos negocios sin relación publican el
    mismo correo, no es de ninguno de los dos: es de su proveedor. Conservar
    la primera aparición era quedarse justo con la mala.
    PERO CON UNA EXCEPCIÓN: si el correo es del MISMO dominio que el sitio de
    la cuenta, es suyo aunque se repita — una cadena publica el mismo contacto
    en todas sus sucursales. `contacto@elglobo.com.mx` en cinco tiendas El
    Globo es correcto; `impallari@gmail.com` en una óptica y una zapatería no.
    Lo que delata al proveedor es el correo de OTRO dominio en negocios
    distintos.
  · EL DOMINIO PROPIO MANDA. Un correo del dominio del negocio vale más que un
    gmail, y un correo de OTRO dominio se descarta salvo que no haya nada más.
  · EL NÚMERO MÁS REPETIDO. El de la tienda sale en todas las páginas; el del
    que hizo la web, una sola vez.
  · UN SITIO CAÍDO ES UN DATO. HTTP 000, 404 o una página de 169 bytes
    significan que el negocio no mantiene su web: es señal de dolor, no un
    hueco. Se reporta como `sitio_vivo: false`.

Lo que este script NO hace: verificar MX. Eso lo hace
/api/cron/abm-verificar-correos, que además consulta ZeroBounce si hay créditos.
"""
import re, json, sys, ssl, collections, urllib.request, urllib.error
import concurrent.futures as cf

CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/120 Safari/537.36')
PAGS = ['', '/contacto', '/pages/contacto', '/contact', '/pages/contact',
        '/nosotros', '/pages/nosotros', '/aviso-de-privacidad']

WA = re.compile(r'(?:wa\.me/|(?:api|web)\.whatsapp\.com/send/?\?phone=|'
                r'whatsapp://send\?phone=|whatsapp\.com/(?:send|message)/?\?phone=)'
                r'(\+?\d[\d\- ]{7,20})', re.I)
TEL = re.compile(r'tel:(\+?\d[\d\-\(\) ]{7,20})')
MAIL = re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')
IG = re.compile(r'instagram\.com/([A-Za-z0-9._]{2,30})', re.I)
FB = re.compile(r'facebook\.com/([A-Za-z0-9._-]{3,40})', re.I)

BASURA = re.compile(
    r'(latofonts|impallari|fontsquirrel|fontfabric|typeface|fonts?\.|googleapis|gstatic|sentry|wixpress|wix\.com|squarespace|'
    r'shopify|godaddy|hostinger|bluehost|cloudflare|jquery|bootstrap|w3\.org|'
    r'schema\.org|example\.|@2x|\.(png|jpe?g|gif|svg|webp|css|js))', re.I)
GRATIS = {'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'yahoo.com.mx',
          'icloud.com', 'live.com', 'live.com.mx', 'hotmail.es', 'msn.com'}
# Páginas de la propia red social, no cuentas de negocio.
NO_RED = {'p', 'reel', 'explore', 'accounts', 'sharer', 'tr', 'profile.php',
          'pages', 'groups', 'events', 'share', 'plugins', 'dialog'}


def dominio_de(url):
    d = re.sub(r'^https?://', '', str(url or '')).split('/')[0].lower()
    return d[4:] if d.startswith('www.') else d


def norm_tel(s):
    d = re.sub(r'\D', '', str(s))
    if d.startswith('521') and len(d) == 13:
        d = '52' + d[3:]
    if len(d) == 10:
        d = '52' + d
    if len(d) != 12 or not d.startswith('52') or d[2] in '01':
        return None
    return d


def baja(url, ruta):
    """(html, vivo). `vivo` distingue «no publica contacto» de «ya no existe»."""
    try:
        req = urllib.request.Request(url.rstrip('/') + ruta, headers={'User-Agent': UA})
        with urllib.request.urlopen(req, timeout=14, context=CTX) as r:
            h = r.read(6_000_000).decode('utf-8', 'ignore')
            return h, len(h) > 600          # 169 bytes no es un sitio
    except urllib.error.HTTPError as e:
        return '', e.code < 500             # un 404 en /contacto no mata el sitio
    except Exception:
        return '', False


def buscar(c):
    propio = dominio_de(c.get('sitio'))
    wa, tel = collections.Counter(), collections.Counter()
    mails, ig, fb = {}, set(), set()
    vivo = False

    for ruta in PAGS:
        h, ok = baja(c['sitio'], ruta)
        if ruta == '':
            vivo = ok
            if not ok:
                break                        # sitio muerto: no se insiste
        if not h:
            continue

        for m in WA.findall(h):
            n = norm_tel(m)
            if n:
                wa[n] += 1
        for m in TEL.findall(h):
            n = norm_tel(m)
            if n:
                tel[n] += 1
        for m in MAIL.findall(h):
            e = m.strip('.').lower()
            if BASURA.search(e) or len(e) > 80:
                continue
            dom = e.split('@')[1]
            # 0 = dominio propio, 1 = gratuito, 2 = ajeno (se descarta después)
            pri = 0 if dom == propio or dom.endswith('.' + propio) or propio.endswith('.' + dom) \
                else (1 if dom in GRATIS else 2)
            if e not in mails or pri < mails[e]:
                mails[e] = pri
        for m in IG.findall(h):
            if m.lower() not in NO_RED:
                ig.add(m)
        for m in FB.findall(h):
            if m.lower() not in NO_RED:
                fb.add(m)

        if wa and mails and ruta:
            break                            # ya hay lo importante

    correo = None
    for e, pri in sorted(mails.items(), key=lambda kv: (kv[1], len(kv[0]))):
        if pri < 2:                          # un dominio ajeno es lo que metió latofonts
            correo = e
            break

    top = lambda m: m.most_common(1)[0][0] if m else None
    return {**c, 'sitio_vivo': vivo, 'whatsapp': top(wa), 'telefono': top(tel),
            'correo': correo, 'instagram': sorted(ig)[0] if ig else None,
            'facebook': sorted(fb)[0] if fb else None}


def main():
    """La salida se escribe SOBRE LA MARCHA, no al final.

    Escribirla solo al terminar significa que una corrida larga no deja nada si
    se corta. Pasó con 6,000 sitios: los ultimos mil agotaban el tiempo de
    espera uno tras otro y las 5,000 respuestas ya buenas estaban en memoria,
    sin forma de recuperarlas sin esperar horas o perderlo todo.
    """
    cuentas = json.load(open(sys.argv[1]))
    res = []
    with cf.ThreadPoolExecutor(max_workers=12) as ex:
        for r in ex.map(buscar, cuentas):
            res.append(r)
            if len(res) % 100 == 0:
                json.dump(res, open(sys.argv[2], 'w'), ensure_ascii=False, indent=1)
            marca = ('✓' if r['correo'] else 'w' if r['whatsapp'] else
                     't' if r['telefono'] else 'X' if not r['sitio_vivo'] else '·')
            print(f"  {marca} {str(r['correo'] or r['whatsapp'] or r['telefono'] or '—')[:34]:<34}"
                  f"{r['nombre'][:34]}", flush=True)
    json.dump(res, open(sys.argv[2], 'w'), ensure_ascii=False, indent=1)
    n = lambda k: sum(1 for r in res if r.get(k))
    print(f"\nCORREO {n('correo')} · WHATSAPP {n('whatsapp')} · TEL {n('telefono')} · "
          f"IG {n('instagram')} · FB {n('facebook')} · "
          f"CAÍDOS {sum(1 for r in res if not r['sitio_vivo'])} · de {len(res)}")


if __name__ == '__main__':
    main()
