import sys, re, html, json
src, out_pub, out_repo = sys.argv[1:4]
D = open(src, encoding='utf-8').read()
def between(s, a, b, start=0):
    i = s.index(a, start); j = s.index(b, i); return s[i:j]
def txt(x): return ' '.join(html.unescape(re.sub(r'<[^>]+>', ' ', x)).split())

AREAS = [('consignacion','Consignación'),('preparacion','Certificación, taller y preparación'),('ecommerce','E-commerce y contenido'),
         ('ventas','Ventas en sucursal'),('logistica','Logística'),('contabilidad','Contabilidad, caja y comisiones'),('direccion','Dirección y analítica')]
CORTO = {'consignacion':'Consignación','preparacion':'Certificación y taller','ecommerce':'E-commerce','ventas':'Ventas','logistica':'Logística','contabilidad':'Contabilidad','direccion':'Dirección'}
FLUJOS = {'consignacion':['01','02','03','04','05','06','07','08','09','36','37','39','40','56'],
          'preparacion':['10','11','12','13','14','15','16','17','18','21','22'],
          'ecommerce':['25','26'], 'ventas':['24','27','28','29','30'],
          'logistica':['19','20','31','32','33','34','35','38'],
          'contabilidad':['41','42','43','44','45','46','47','48','49','50','51','52','60'],
          'direccion':['23','53','54','55','57','58','59']}
assert sorted(sum(FLUJOS.values(), [])) == ['%02d' % i for i in range(1, 61)]
ESTADOS = [('pp','Por priorizar'),('alta','Prioridad alta'),('curso','En curso'),('pruebas','En pruebas'),('hecha','Hecha')]
R = 'Pregunta abierta en las reuniones del 20 y 21 de octubre'; M = 'Modelo integral · reglas que requieren decisión de dirección'
DEC = {
 'consignacion':[('Plazo de devolución','El contrato es de 45 días y casi siempre se deja más tiempo. ¿Cuánto tiempo extra sin respuesta del consignante debe pasar para iniciar la devolución, y qué aviso se le manda antes?','R'),
  ('Contratos y beneficiarios','Qué derechos debe otorgar el contrato a la persona autorizada para recoger o cobrar y qué validación de identidad requiere.','M'),
  ('Artículos no auténticos','Cuál es la multa vigente, quién autoriza una segunda verificación y si se entregan piezas con cargos no liquidados.','RM'),
  ('Limpieza','Cuánto se cobra, si se cobra al retirar piezas que no se vendieron, bajo qué concepto, qué excepciones se condonan y quién autoriza la salida.','RM'),
  ('Ventas internas','¿Cómo se manejan las ventas internas de artículos en consignación?','R'),
  ('Pagos a consignantes','Antigüedad prioritaria, pagos anticipados, cambios de cuenta a terceros y casos que necesitan firma.','M')],
 'preparacion':[('Cobro de certificación','¿Cuándo se cobra la certificación, cómo funcionan las bolsas de 30 y 50 y qué regla aplica a artículos de bajo costo?','R'),
  ('Autorizaciones de taller','Qué reparaciones o cambios exigen autorización previa y qué incidentes vuelven un artículo no comercializable.','M')],
 'ecommerce':[('Perfil de fotografía','¿Qué campos puede editar la persona de fotografía?','R'),
  ('Fotos de recepción','¿Las fotos que se toman al recibir la pieza se usan para la publicación en línea o solo como evidencia de su estado?','R')],
 'ventas':[('Apartados','En la entrevista se dijo que el calzado se liquida en 15 días y las bolsas en 30. ¿Qué plazo tienen la ropa y los accesorios? ¿Los 15 días del calzado también son el plazo para un cambio? Falta definir prórrogas, destino de los abonos cuando vence y reactivación comercial.','RM'),
  ('Devoluciones de compradores','Qué alcance tienen en ropa y artículos de saldo, en qué categorías aplican, el plazo, quién paga la guía, si se reintegra o se da saldo a favor y cómo se tratan las piezas en retorno.','RM'),
  ('Qué significa «saldo»','¿Se refiere a artículos de saldo o al monto que abonó el cliente?','R'),
  ('Devolución vencida','¿Qué pasa cuando vence la fecha de una devolución y el cobro sigue pendiente? ¿Qué fechas se registran y qué aviso se manda?','R'),
  ('Confirmación al registrar','En «¿Estás seguro de que quieres registrar?» aparecen «dos»: ¿son botones, opciones o confirmaciones, y cuáles?','R'),
  ('Interesados antes de liberación','Prioridad de contacto, si existe exclusividad temporal y si se permiten anticipos o preventas condicionadas.','M'),
  ('Descuentos','Porcentaje o monto que requiere aprobación, vigencia, y si se firma un contrato nuevo o basta la aceptación digital del nuevo precio.','M')],
 'logistica':[('Costo de envío','¿Los $300 aplican siempre por artículo o dependen del destino, el almacén o las dimensiones? Falta definir cómo se cobran seguros, envíos consolidados y traspasos internos, y quién asume cada gasto.','RM'),
  ('Seguro y extravío','¿Cómo se aplica el seguro del 1 % y qué proceso sigue si la paquetería reporta un extravío?','R'),
  ('Cobro del envío','¿En qué momento se cobra el envío y qué estado tiene el pedido mientras reúne piezas o espera ese pago?','R')],
 'contabilidad':[('Comisión sobre utilidad neta','¿Qué porcentaje definieron los directivos?','R'),
  ('Comisión y seguro por método de pago','¿Qué aplica en cada caso (ejemplos de $300, $500 y $1,500)?','R'),
  ('Compras de empleados','Descuento permitido, precio base, plazo, abonos o descuentos de nómina y aprobación.','M'),
  ('Mermas','Regla de indemnización, precio de recuperación, propiedad del artículo recuperado y cómo se contabiliza la pérdida.','M')],
 'direccion':[('Migración','Fecha de corte, controles para ventas nuevas durante la transición y aceptación de la homologación con IA.','M')],
}
assert sum(len(v) for v in DEC.values()) == 25

# ---------- extraer de la versión anterior ----------
tabla = between(D, 'id="tabla"', '</table>')
FILAS = {}
for a, row in re.findall(r'<tr data-a="(\w+)">(.*?)</tr>', tabla, re.S):
    c = re.findall(r'<td>(.*?)</td>', row, re.S)
    FILAS[txt(c[0])] = {'area': a, 'titulo': txt(re.search(r'<b>(.*?)</b>', c[2], re.S).group(1)),
                        'corto': re.search(r'<small>(.*?)</small>', c[2], re.S).group(1), 'src': c[3]}
SEC = {}
for aid, _ in AREAS:
    i = D.index(f'id="{aid}"><div class="wrap">'); j = D.index('</div></section>', D.index('</ul>', i))
    SEC[aid] = D[i:j]
def mejoras_de(aid):
    s = SEC[aid]; ul = s[s.index('<ul class="items">'):s.index('</ul>')]
    out = []
    for li in re.findall(r'<li class="[^"]*">.*?</li>', ul, re.S):
        clave = re.search(r'<code>([A-Z]+-\d+)</code>', li).group(1)
        ico = re.search(r'<div class="mi">.*?</svg></div>', li, re.S).group(0)
        titulo = re.search(r'<h4>(.*?)</h4>', li, re.S).group(1)
        cuerpo = li[li.index('</h4>') + 5:li.rindex('<div class="im">')]
        im = li[li.rindex('<div class="im">'):]
        srcs = ''.join(re.findall(r'<span class="src"[^>]*>[^<]*</span>', im))
        est = txt(re.search(r'<span class="est[^"]*">(.*?)</span>', im, re.S).group(1))
        out.append(dict(clave=clave, ico=ico, titulo=titulo, cuerpo=cuerpo, srcs=srcs, est=est, ancho='ancho' in li[:30], area=aid))
    return out
MEJ = {aid: mejoras_de(aid) for aid, _ in AREAS}

# ---------- quitar duplicados ----------
def busca(clave):
    for aid in MEJ:
        for m in MEJ[aid]:
            if m['clave'] == clave: return m
def quita(clave):
    for aid in MEJ: MEJ[aid] = [m for m in MEJ[aid] if m['clave'] != clave]
def p(texto): return f'<span class="lbl">Proceso que se busca</span><p>{texto}</p>'
T6 = '<span class="src" title="Flujos de trabajo: taller, servicios, consignación y trazabilidad · puntos 1 al 8">T6</span>'
O6 = '<span class="src" title="Requerimientos de mejoras operativas en SACS">O6</span>'
m = busca('PRE-02'); m['titulo'] = 'Certificación vinculada desde el registro y consultable en la ficha'
m['cuerpo'] = p('El registro de la consignación es el punto de partida: desde ahí cada pieza queda vinculada con su proceso de certificación, sin volver a capturarla. El sistema genera una URL para gestionar la certificación de cada pieza y el resultado se guarda en el artículo. La ficha conserva el tipo de certificado, la entidad que lo emitió, el enlace, PDF o imagen, la fecha y quién lo cargó, para consultarlo cuando un cliente lo pida sin buscar en varias plataformas; su cobro sigue la política comercial que defina el negocio.')
m['srcs'] += T6; m['nota'] = 'Incluye lo que eran CON-03 y PRE-10.'
m['corto'] = 'Desde el registro de la consignación cada pieza queda vinculada con su certificación (URL desde el sistema) y la ficha guarda certificado, entidad, documento, fecha y responsable.'
quita('CON-03'); quita('PRE-10')
m = busca('VEN-07'); m['titulo'] = 'Canal de origen de cada venta y ventas por canal'
m['cuerpo'] = p('Cada venta registra de dónde vino el cliente: página web, Instagram, Facebook, TikTok u otra red. Con eso se compara cuántas piezas y cuánto vende cada canal, filtrando por periodo y sucursal.')
m['nota'] = 'Incluye lo que era DIR-03.'; m['corto'] = 'Cada venta registra su canal (web, Instagram, Facebook, TikTok u otra red) y se compara cuánto vende cada uno por periodo y sucursal.'
quita('DIR-03')
m = busca('LOG-01'); m['titulo'] = 'Transferencias con ubicación, responsable y costo'
m['cuerpo'] = p('Cada movimiento de piezas, del almacén a la tienda o entre sucursales, registra origen, destino, piezas, responsables, fechas, la ubicación física de cada pieza y los costos adicionales que genere, y separa las disponibles de las que no lo están.')
m['srcs'] += O6; m['nota'] = 'Incluye lo que era LOG-03.'; m['corto'] = 'Cada movimiento entre almacén, tienda y sucursales guarda origen, destino, piezas, responsables, fechas, ubicación física y costos.'
quita('LOG-03')
m = busca('CTB-03'); m['titulo'] = 'Pagos pendientes programados'
m['cuerpo'] = p('Los pagos pendientes se programan con monto, fecha y estatus, y se pueden consultar en cualquier momento.')
m['nota'] = 'Los comprobantes de PayPal para aclaraciones y contracargos quedaron en ECO-03.'; m['corto'] = 'Los pagos pendientes se programan con monto, fecha y estatus.'
m = busca('ECO-03'); m['cuerpo'] = m['cuerpo'].replace('PayPal es indispensable para los clientes internacionales.', 'PayPal es indispensable para los clientes internacionales. Se documenta el proceso de cobro y se guardan los comprobantes para aclaraciones o contracargos.')
assert 'aclaraciones o contracargos' in m['cuerpo']; m['srcs'] += O6
m = busca('PRE-11'); m['titulo'] = 'Evidencia de cada intervención'
m['cuerpo'] = p('Cada intervención que pueda modificar la pieza (color, piezas, limpieza o reparación) se registra con evidencia del resultado y la descripción del trabajo, y taller y ventas la consultan desde la ficha del artículo para evitar confusiones al entregarla. Las fotos y observaciones de llegada se toman en el pre-registro (CON-02).')
m['corto'] = 'Cada intervención que modifique la pieza se registra con evidencia y descripción, consultable por taller y ventas desde la ficha.'
TOTAL = sum(len(v) for v in MEJ.values()); assert TOTAL == 59, TOTAL

def ini_estado(m):
    return 'alta' if m['est'].startswith('Prioridad alta') else 'pp'
def nota_est(m):
    return m['est'].replace('Prioridad alta · ', '') if m['est'].startswith('Prioridad alta') else ''

# ---------- piezas de la página ----------
head = D[:D.index('<header class="top">')]
portada = between(D, '<section class="portada">', '<section class="blanco" id="recorrido">')
recorrido = between(D, '<section class="blanco" id="recorrido">', '\n\n<section class="area')
modelo = between(D, '<section class="blanco" id="modelo"', '<section class="blanco" id="decisiones">')
decis = between(D, '<section class="blanco" id="decisiones">', '<section class="blanco" id="pendientes">')
pend = between(D, '<section class="blanco" id="pendientes">', '<section class="blanco" id="todo"')
futuro = pend[pend.index('<div class="futuro">'):pend.index('</div></section>')]
futuro = futuro[:futuro.rindex('</div>')] if futuro.count('<div') < futuro.count('</div>') else futuro
firmas_foot = D[D.index('<section class="blanco" id="firmas"'):D.index('<script>\n(function(){\n  var rows')]
anexo = decis[decis.index('<details class="anexo">'):decis.index('</details>') + 10]
crit = decis[decis.index('<h3 style'):decis.index('<details class="anexo">')]
flujo_html = {n: re.search(rf'<details class="f" id="f{n}">.*?</details>', modelo, re.S).group(0) for n in ['%02d' % i for i in range(1, 61)]}
script = D[D.index('<script>\n(function(){\n  var rows'):]
firmas_js = script[script.index('(function(){\n  var PARTES'):script.rindex('</script>')]

# portada: cifras
portada = re.sub(r'<div class="kpis">.*?</div>\n  <div class="ficha">', '''<div class="kpis">
    <div><b>7</b><small>áreas, cada una con su flujo</small></div>
    <div><b>59</b><small>mejoras contempladas</small></div>
    <div><b>60</b><small>flujos integrales</small></div>
    <div><b>25</b><small>decisiones por tomar</small></div>
    <div class="f"><b>3</b><small>con prioridad alta</small></div>
    <div class="n2"><b id="kAvance">0 %</b><small>de mejoras hechas</small></div>
  </div>
  <div class="ficha">''', portada, flags=re.S)
portada = portada.replace('las mejoras contempladas en Sacs para cerrar cada flujo y el <a href="#modelo" style="color:var(--fucsia)">modelo integral de 60 flujos</a> con sus pasos, controles y resultados.',
  'las mejoras contempladas en Sacs para cerrar cada flujo, los flujos integrales con sus pasos y controles, y lo que falta decidir. Todo está separado por área y cada punto se puede marcar con un check para dar seguimiento en el <a href="#tablero" style="color:var(--fucsia)">tablero</a>.')
assert 'tablero' in portada
for aid, _ in AREAS:
    recorrido = re.sub(rf'(<a href="#{aid}">[^<]*</a><small>)\d+ mejoras', rf'\g<1>{len(MEJ[aid])} mejoras · {len(FLUJOS[aid])} flujos', recorrido)

# modelo: intro sin bloques, índice por área, criterios
intro = modelo[:modelo.index('  <ol class="idx">')]
intro = intro.replace('<h2 class="t2">60 flujos para <em>operar Vende Tu Clóset en Sacs</em></h2>', '<h2 class="t2">60 flujos integrales, <em>repartidos por área</em></h2>')
intro = intro.replace('Es una especificación funcional para validar con el cliente: describe lo que se necesita, no afirma que todo esté desarrollado.</p>',
  'Es una especificación funcional para validar con el cliente: describe lo que se necesita, no afirma que todo esté desarrollado. Cada flujo vive en la sección de su área, con un check para marcarlo cuando ya opere en Sacs.</p>')
idx = '<ol class="idx">' + ''.join(f'<li><span class="ii" style="font-family:var(--serif);color:var(--fucsia);font-size:1.1rem">{i+1:02d}</span><span class="n">{len(FLUJOS[aid])}</span><a href="#{aid}">{nom}</a><small>flujos {", ".join(FLUJOS[aid][:3])}{"…" if len(FLUJOS[aid])>3 else ""}</small></li>' for i,(aid,nom) in enumerate(AREAS)) + '</ol>'
herr = '<div class="herr"><input id="buscaF" type="search" placeholder="Buscar en los 60 flujos: apartado, DHL, fake, saldo a favor…" aria-label="Buscar flujos"><button type="button" id="abreF">Abrir todos</button><button type="button" id="cierraF">Cerrar todos</button></div>\n  <p class="vacio" id="vacioF">Ningún flujo coincide con la búsqueda.</p>'
modelo_sec = intro + '  ' + idx + '\n  ' + crit.replace('margin:2.6rem 0 0', 'margin:2.4rem 0 0') + '\n  ' + herr + '\n</div></section>\n'

def opciones(sel):
    return ''.join(f'<option value="{k}"{" selected" if k==sel else ""}>{v}</option>' for k, v in ESTADOS)
def card(m):
    cid = 'm-' + m['clave']; e = ini_estado(m)
    nota = m.get('nota') or ''
    ne = nota_est(m)
    extra = (f'<p class="mnota">{nota}</p>' if nota else '')
    return (f'<li class="mej{" ancho" if m["ancho"] else ""}" id="{m["clave"]}" data-id="{cid}" data-estado="{e}">{m["ico"]}<div class="mb"><code>{m["clave"]}</code><h4>{m["titulo"]}</h4>{m["cuerpo"]}{extra}'
            f'<div class="im">{m["srcs"]}{f"<span class=est>{ne}</span>" if ne else ""}</div>'
            f'<div class="gest"><label class="chk" for="ck-{cid}"><input type="checkbox" id="ck-{cid}" data-id="{cid}"><span>Hecha</span></label>'
            f'<select id="es-{cid}" data-id="{cid}" aria-label="Estado de {m["clave"]}">{opciones(e)}</select><span class="quien" id="q-{cid}"></span></div></div></li>')
def flujo(n):
    h = flujo_html[n]; fid = 'f-' + n
    h = h.replace(f'<details class="f" id="f{n}">', f'<details class="f" id="f{n}" data-id="{fid}">', 1)
    h = h.replace('</b><small>', '<span class="okf" id="ok-' + fid + '" hidden>✓ Implementado</span></b><small>', 1)
    h = h.replace('<div class="fb">', f'<div class="fb"><div class="gest"><label class="chk" for="ck-{fid}"><input type="checkbox" id="ck-{fid}" data-id="{fid}"><span>Ya opera en Sacs</span></label><span class="quien" id="q-{fid}"></span></div>', 1)
    return h
def decision(aid, i, d):
    did = f'd-{aid[:3]}-{i+1}'; tema, texto, origen = d
    chips = ''.join({'R': f'<span class="src" title="{R}">Reunión</span>', 'M': f'<span class="src" title="{M}">M</span>'}[c] for c in origen)
    return (f'<li class="dec-i" id="{did}" data-id="{did}"><div class="dtop"><label class="chk" for="ck-{did}"><input type="checkbox" id="ck-{did}" data-id="{did}"><span>Resuelta</span></label>{chips}<span class="quien" id="q-{did}"></span></div>'
            f'<p><b>{tema}.</b> {texto}</p><p class="resp-txt" id="rt-{did}" hidden></p>'
            f'<div class="resp" id="rf-{did}" hidden><label for="rs-{did}" class="lbl">Respuesta o acuerdo</label><textarea id="rs-{did}" rows="2"></textarea><button type="button" data-id="{did}" class="rsave">Guardar respuesta</button></div></li>')

areas_html = []
for k, (aid, nom) in enumerate(AREAS):
    s = SEC[aid]
    s = re.sub(r'<div class="rel">.*?</div>\n  ', '', s, flags=re.S)
    s = s[:s.index('<h3>Mejoras para cerrar el flujo')]
    clase = 'rosa' if k % 2 == 0 else 'cla'
    mj = MEJ[aid]
    tab = (f'<div class="atab" data-area="{aid}"><div><span class="eyebrow">Avance del área</span><div class="abar" id="abar-{aid}"></div><p class="aley" id="aley-{aid}"></p></div>'
           f'<dl class="anum"><div><dt>Mejoras hechas</dt><dd id="an-m-{aid}">0/{len(mj)}</dd></div><div><dt>Flujos operando</dt><dd id="an-f-{aid}">0/{len(FLUJOS[aid])}</dd></div><div><dt>Decisiones resueltas</dt><dd id="an-d-{aid}">0/{len(DEC[aid])}</dd></div></dl></div>')
    body = (s.replace('<h3>Flujo de trabajo</h3>', tab + '\n  <h3>Flujo de trabajo</h3>', 1) if '<h3>Así funciona hoy' not in s else s.replace('<h3>Así funciona hoy', tab + '\n  <h3>Así funciona hoy', 1))
    body += (f'<h3>Mejoras contempladas <small>{len(mj)} mejoras</small></h3>\n  <ul class="items">' + ''.join(card(m) for m in mj) + '</ul>\n'
             f'  <h3>Flujos integrales del área <small>{len(FLUJOS[aid])} flujos del modelo integral</small></h3>\n  <div class="fl">' + ''.join(flujo(n) for n in FLUJOS[aid]) + '</div>\n'
             f'  <h3>Por decidir <small>{len(DEC[aid])} decisiones</small></h3>\n  <ol class="decs">' + ''.join(decision(aid, i, d) for i, d in enumerate(DEC[aid])) + '</ol>\n')
    if aid == 'direccion': body += '  ' + futuro + '</div>\n'
    areas_html.append(f'<section class="area {clase}" ' + body.replace(f'id="{aid}"><div class="wrap">', f'id="{aid}"><div class="wrap">', 1) + '</div></section>')
areas_html = '\n'.join(areas_html)
assert areas_html.count('<details class="f"') == 60

# ---------- tablero ----------
cols = ''.join(f'<div class="kcol" data-e="{k}"><h4><span class="dot e-{k}"></span>{v} <small id="kc-{k}">0</small></h4><ul id="kl-{k}"></ul></div>' for k, v in ESTADOS)
chipsA = '<button type="button" class="on" data-f="">Todas las áreas</button>' + ''.join(f'<button type="button" data-f="{aid}">{CORTO[aid]}</button>' for aid, _ in AREAS)
tablero = f'''<section class="blanco" id="tablero" style="background:var(--nube)"><div class="wrap">
  <span class="eyebrow">Tablero de gestión</span>
  <h2 class="t2">Cómo vamos, <em>área por área</em></h2>
  <p class="lead">Cada mejora, flujo y decisión tiene su check. Lo que se marca queda guardado en esta liga y lo ve todo el equipo; el tablero se actualiza solo.</p>
  <p class="aviso-g" id="avisoG">Para marcar avances, abre la liga con tu sesión de Claude. Aquí ves el estado inicial.</p>
  <div class="gkpi">
    <div><span class="eyebrow">Mejoras hechas</span><b id="gM">0 de {TOTAL}</b><div class="gbar"><span id="gMb"></span></div></div>
    <div><span class="eyebrow">Flujos operando en Sacs</span><b id="gF">0 de 60</b><div class="gbar"><span id="gFb"></span></div></div>
    <div><span class="eyebrow">Decisiones resueltas</span><b id="gD">0 de 25</b><div class="gbar"><span id="gDb"></span></div></div>
  </div>
  <div class="tw"><table class="t ta"><thead><tr><th>Área</th><th>Mejoras por estado</th><th>Hechas</th><th>Flujos</th><th>Decisiones</th></tr></thead><tbody>{"".join(f'<tr><td><a href="#{aid}">{CORTO[aid]}</a></td><td><div class="sbar" id="sb-{aid}"></div></td><td id="th-{aid}">0/{len(MEJ[aid])}</td><td id="tf-{aid}">0/{len(FLUJOS[aid])}</td><td id="td-{aid}">0/{len(DEC[aid])}</td></tr>' for aid,_ in AREAS)}</tbody></table></div>
  <ul class="ley">{"".join(f'<li><span class="dot e-{k}"></span>{v}</li>' for k,v in ESTADOS)}</ul>
  <h3 class="sub">Mejoras por estado</h3>
  <div class="chips" id="kchips">{chipsA}</div>
  <div class="kanban">{cols}</div>
</div></section>
'''

# ---------- tabla final ----------
filas = []
for aid, nom in AREAS:
    for m in MEJ[aid]:
        f = FILAS[m['clave']]; corto = m.get('corto', f['corto']); e = ini_estado(m)
        filas.append(f'<tr data-a="{aid}" data-id="m-{m["clave"]}" data-estado="{e}"><td><a href="#{m["clave"]}"><code>{m["clave"]}</code></a></td><td>{CORTO[aid]}</td><td><b>{m["titulo"]}</b><br><small>{corto}</small></td><td>{m["srcs"]}</td><td><span class="pill e-{e}" id="tp-m-{m["clave"]}">{dict(ESTADOS)[e]}</span></td></tr>')
chipsE = '<select id="fEstado" aria-label="Filtrar por estado"><option value="">Todos los estados</option>' + ''.join(f'<option value="{k}">{v}</option>' for k, v in ESTADOS) + '</select>'
todo = f'''<section class="blanco" id="todo"><div class="wrap">
  <span class="eyebrow">Tabla final</span>
  <h2 class="t2">Todas las mejoras, <em>en una lista</em></h2>
  <p class="lead">Las {TOTAL} mejoras con su clave, su área, de qué documento salió y su estado actual. Se quitaron los duplicados: CON-03 y PRE-10 quedaron dentro de PRE-02, DIR-03 dentro de VEN-07, LOG-03 dentro de LOG-01, y los comprobantes de PayPal de CTB-03 pasaron a ECO-03.</p>
  <div class="chips" id="chips">{chipsA}{chipsE}</div>
  <p class="cuenta" id="cuenta"></p>
  <div class="tw"><table class="t" id="tabla"><thead><tr><th>Clave</th><th>Área</th><th>Mejora y proceso que se busca</th><th>Fuente</th><th>Estado</th></tr></thead><tbody>{"".join(filas)}</tbody></table></div>
  {anexo}
</div></section>
'''

nav = '<nav id="nav" aria-label="Secciones"><a href="#tablero">Tablero</a><a href="#recorrido">Recorrido</a><a href="#modelo">Modelo</a>' + ''.join(f'<a href="#{aid}">{CORTO[aid]}</a>' for aid, _ in AREAS) + '<a href="#todo">Todas las mejoras</a><a href="#firmas">Firmas</a></nav>'
header = re.sub(r'<nav id="nav".*?</nav>', nav, between(D, '<header class="top">', '<section class="portada">'), flags=re.S)

css = r'''
/* ===== Gestión por área (v5) ===== */
:root{--e-pp:#B9AEB4;--e-alta:#DA0069;--e-curso:#E39B2D;--e-pruebas:#4C7BD9;--e-hecha:#1F9D6B}
.e-pp{background:var(--e-pp)}.e-alta{background:var(--e-alta)}.e-curso{background:var(--e-curso)}.e-pruebas{background:var(--e-pruebas)}.e-hecha{background:var(--e-hecha)}
.dot{display:inline-block;width:10px;height:10px;border-radius:50%;flex:none}
.aviso-g{margin:1rem 0 0;font-size:.86rem;color:var(--ink2);background:#fff;border:1px dashed var(--linea);border-radius:12px;padding:.6rem .9rem;max-width:46rem}
.gkpi{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:1.6rem}
@media(max-width:760px){.gkpi{grid-template-columns:1fr}}
.gkpi>div{background:#fff;border:1px solid var(--linea);border-radius:16px;padding:1rem 1.1rem;display:flex;flex-direction:column;gap:.35rem}
.gkpi b{font-family:var(--serif);font-weight:500;font-size:1.9rem;line-height:1.05;font-variant-numeric:tabular-nums}
.gbar{height:8px;border-radius:99px;background:var(--linea2);overflow:hidden}
.gbar span{display:block;height:100%;width:0;background:var(--e-hecha);border-radius:99px;transition:width .4s}
table.ta{min-width:40rem}
table.ta td{vertical-align:middle;font-variant-numeric:tabular-nums}
table.ta td a{color:var(--ink);font-weight:600;text-decoration:none;font-family:var(--sans);font-size:.9rem}
table.ta td a:hover{color:var(--fucsia)}
.sbar{display:flex;height:14px;border-radius:99px;overflow:hidden;background:var(--linea2);min-width:12rem}
.sbar span{display:block;height:100%}
.ley{list-style:none;margin:.9rem 0 0;padding:0;display:flex;gap:.4rem 1.1rem;flex-wrap:wrap;font-size:.8rem;color:var(--ink2)}
.ley li{display:flex;gap:.4rem;align-items:center}
h3.sub{font-family:var(--sans);font-size:.74rem;font-weight:600;letter-spacing:.24em;text-transform:uppercase;margin:2.4rem 0 0;color:var(--ink)}
.kanban{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-top:1rem;align-items:start}
@media(max-width:1000px){.kanban{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:560px){.kanban{grid-template-columns:1fr}}
.kcol{background:#fff;border:1px solid var(--linea);border-radius:16px;padding:.75rem;min-width:0}
.kcol h4{margin:0 0 .6rem;font-size:.82rem;font-weight:600;display:flex;gap:.45rem;align-items:center}
.kcol h4 small{margin-left:auto;font-family:var(--mono);color:var(--humo)}
.kcol ul{list-style:none;margin:0;padding:0;display:grid;gap:6px;max-height:26rem;overflow:auto}
.kcol li a{display:block;text-decoration:none;color:var(--ink);font-size:.8rem;line-height:1.3;padding:.45rem .55rem;border-radius:10px;background:var(--nube);border:1px solid var(--linea2)}
.kcol li a:hover{border-color:var(--fucsia)}
.kcol li code{display:block;font-size:.66rem}
.kcol .vacia{font-size:.78rem;color:var(--humo);padding:.3rem}
.atab{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:1.2rem;align-items:center;margin-top:1.4rem;padding:1rem 1.1rem;border-radius:16px;background:#fff;border:1px solid var(--linea)}
.cla .atab{background:var(--nube)}
@media(max-width:700px){.atab{grid-template-columns:1fr}}
.abar{display:flex;height:12px;border-radius:99px;overflow:hidden;background:var(--linea2);margin-top:.5rem}
.abar span{display:block;height:100%}
.aley{margin:.45rem 0 0;font-size:.78rem;color:var(--ink2)}
.anum{display:flex;gap:1.4rem;margin:0;flex-wrap:wrap}
.anum div{display:flex;flex-direction:column}
.anum dt{font-size:.62rem;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--humo)}
.anum dd{margin:0;font-family:var(--serif);font-size:1.5rem;font-variant-numeric:tabular-nums}
.gest{display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;margin-top:.7rem;padding-top:.65rem;border-top:1px dashed var(--linea)}
.chk{display:inline-flex;gap:.45rem;align-items:center;font-size:.84rem;font-weight:600;color:var(--ink);cursor:pointer}
.chk input{width:18px;height:18px;accent-color:var(--e-hecha);cursor:pointer}
.chk input:disabled{cursor:not-allowed}
.gest select{font:inherit;font-size:.8rem;padding:.25rem .5rem;border-radius:99px;border:1px solid var(--linea);background:#fff;color:var(--ink)}
.quien{font-size:.74rem;color:var(--humo);margin-left:auto}
li.mej[data-estado="hecha"]{border-color:var(--e-hecha)}
li.mej[data-estado="hecha"] h4{text-decoration:line-through;text-decoration-color:rgba(31,157,107,.5)}
li.mej[data-estado="alta"]{border-color:var(--fucsiaL)}
li.mej[data-estado="curso"]{border-left:4px solid var(--e-curso)}
li.mej[data-estado="pruebas"]{border-left:4px solid var(--e-pruebas)}
.mnota{font-size:.8rem;color:var(--humo);margin:.2rem 0 0}
.okf{display:inline-block;margin-left:.5rem;font-size:.68rem;font-weight:600;color:#fff;background:var(--e-hecha);border-radius:99px;padding:.05rem .5rem;vertical-align:middle}
details.f.hecho{border-color:var(--e-hecha)}
.fb .gest{margin-top:0;padding-top:0;border-top:0}
.decs{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
@media(max-width:760px){.decs{grid-template-columns:1fr}}
.dec-i{background:#fff;border:1px solid var(--linea);border-radius:14px;padding:.85rem 1rem;display:flex;flex-direction:column;gap:.5rem;min-width:0}
.cla .dec-i{background:var(--nube)}
.dec-i.ok{border-color:var(--e-hecha)}
.dec-i p{margin:0;font-size:.9rem;color:var(--ink2);line-height:1.55}
.dec-i p b{color:var(--ink)}
.dtop{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}
.resp{display:grid;gap:.35rem}
.resp textarea{font:inherit;font-size:.88rem;border:1px solid var(--linea);border-radius:10px;padding:.5rem .7rem;resize:vertical;background:#fff;color:var(--ink);width:100%}
.resp button{justify-self:start;font:inherit;font-size:.8rem;font-weight:600;border-radius:99px;padding:.35rem .9rem;border:1px solid var(--fucsia);background:#fff;color:var(--fucsia);cursor:pointer}
.resp-txt{background:var(--rosa);border-radius:10px;padding:.5rem .7rem;color:var(--ink)!important}
.pill{display:inline-block;font-size:.72rem;font-weight:600;color:#fff;border-radius:99px;padding:.15rem .6rem;white-space:nowrap}
.pill.e-pp{color:var(--ink)}
@media(max-width:640px){table.ta{min-width:0}.sbar{min-width:0;margin:.3rem 0}table.ta td:nth-child(n+3):before{font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;color:var(--humo);margin-right:.5rem}table.ta td:nth-child(3):before{content:'Hechas'}table.ta td:nth-child(4):before{content:'Flujos'}table.ta td:nth-child(5):before{content:'Decisiones'}}
#chips select{font:inherit;font-size:.82rem;border:1px solid var(--linea);background:#fff;color:var(--ink);padding:.4rem .8rem;border-radius:99px}
'''
head = head.replace('</style>', css.strip() + '\n</style>', 1)

seg = r'''
(function(){
  var ESTADOS=[['pp','Por priorizar'],['alta','Prioridad alta'],['curso','En curso'],['pruebas','En pruebas'],['hecha','Hecha']], NOM={}; ESTADOS.forEach(function(e){NOM[e[0]]=e[1];});
  var AREAS=__AREAS__;
  var st={}, db=null, puede=false, me=null, prof={};
  function $(id){ return document.getElementById(id); }
  var mejoras=[].slice.call(document.querySelectorAll('li.mej')), flujos=[].slice.call(document.querySelectorAll('details.f[data-id]')), decs=[].slice.call(document.querySelectorAll('li.dec-i'));
  mejoras.forEach(function(li){ st[li.dataset.id]={estado:li.dataset.estado, hecho:false, _ini:li.dataset.estado}; });
  flujos.forEach(function(f){ st[f.dataset.id]={hecho:false}; });
  decs.forEach(function(d){ st[d.dataset.id]={hecho:false, respuesta:''}; });
  function areaDe(el){ var s=el.closest('section.area'); return s?s.id:''; }
  function fmt(iso){ try{ return new Date(iso).toLocaleDateString('es-MX',{day:'numeric',month:'short'}); }catch(e){ return ''; } }
  function quien(id){ var s=st[id], q=$('q-'+id); if(!q) return; if(!s.fecha){ q.textContent=''; return; } var n=s.por&&prof[s.por]?prof[s.por]:''; q.textContent=(n?n+' · ':'')+fmt(s.fecha); }
  function pinta(){
    mejoras.forEach(function(li){ var id=li.dataset.id, s=st[id]; li.dataset.estado=s.estado; var ck=$('ck-'+id), es=$('es-'+id); ck.checked=s.estado==='hecha'; es.value=s.estado; ck.disabled=es.disabled=!puede; quien(id);
      var tr=document.querySelector('#tabla tr[data-id="'+id+'"]'); if(tr){ tr.dataset.estado=s.estado; var pl=$('tp-'+id); pl.className='pill e-'+s.estado; pl.textContent=NOM[s.estado]; } });
    flujos.forEach(function(f){ var id=f.dataset.id, s=st[id]; $('ck-'+id).checked=!!s.hecho; $('ck-'+id).disabled=!puede; $('ok-'+id).hidden=!s.hecho; f.classList.toggle('hecho',!!s.hecho); quien(id); });
    decs.forEach(function(d){ var id=d.dataset.id, s=st[id]; $('ck-'+id).checked=!!s.hecho; $('ck-'+id).disabled=!puede; d.classList.toggle('ok',!!s.hecho);
      var rt=$('rt-'+id), rf=$('rf-'+id); rt.hidden=!s.respuesta; rt.textContent=s.respuesta?('Respuesta: '+s.respuesta):''; rf.hidden=!puede; if(document.activeElement!==$('rs-'+id)) $('rs-'+id).value=s.respuesta||''; quien(id); });
    resume(); filtraTabla();
  }
  function barra(el, cuenta, total){ el.innerHTML=''; ESTADOS.forEach(function(e){ var n=cuenta[e[0]]||0; if(!n) return; var s=document.createElement('span'); s.className='e-'+e[0]; s.style.width=(n/total*100)+'%'; s.title=e[1]+': '+n; el.appendChild(s); }); }
  function resume(){
    var gm=0, gf=0, gd=0, tm=mejoras.length, tf=flujos.length, td=decs.length, kfil=(document.querySelector('#kchips button.on')||{}).dataset; kfil=kfil?kfil.f:'';
    var cols={}; ESTADOS.forEach(function(e){ cols[e[0]]=[]; });
    AREAS.forEach(function(a){
      var c={}, m=0, mt=0, f=0, ft=0, d=0, dt=0;
      mejoras.forEach(function(li){ if(areaDe(li)!==a) return; var e=st[li.dataset.id].estado; c[e]=(c[e]||0)+1; mt++; if(e==='hecha') m++; });
      flujos.forEach(function(x){ if(areaDe(x)!==a) return; ft++; if(st[x.dataset.id].hecho) f++; });
      decs.forEach(function(x){ if(areaDe(x)!==a) return; dt++; if(st[x.dataset.id].hecho) d++; });
      gm+=m; gf+=f; gd+=d;
      barra($('sb-'+a), c, mt); barra($('abar-'+a), c, mt);
      $('th-'+a).textContent=m+'/'+mt; $('tf-'+a).textContent=f+'/'+ft; $('td-'+a).textContent=d+'/'+dt;
      $('an-m-'+a).textContent=m+'/'+mt; $('an-f-'+a).textContent=f+'/'+ft; $('an-d-'+a).textContent=d+'/'+dt;
      $('aley-'+a).textContent=ESTADOS.filter(function(e){return c[e[0]];}).map(function(e){return e[1]+': '+c[e[0]];}).join(' · ');
    });
    mejoras.forEach(function(li){ if(kfil&&areaDe(li)!==kfil) return; cols[st[li.dataset.id].estado].push(li); });
    ESTADOS.forEach(function(e){ var ul=$('kl-'+e[0]); ul.innerHTML=''; $('kc-'+e[0]).textContent=cols[e[0]].length;
      if(!cols[e[0]].length){ var v=document.createElement('li'); v.className='vacia'; v.textContent='Sin mejoras'; ul.appendChild(v); }
      cols[e[0]].forEach(function(li){ var a=document.createElement('a'); a.href='#'+li.id; var c=document.createElement('code'); c.textContent=li.id; a.appendChild(c); a.appendChild(document.createTextNode(li.querySelector('h4').textContent)); var x=document.createElement('li'); x.appendChild(a); ul.appendChild(x); }); });
    $('gM').textContent=gm+' de '+tm; $('gF').textContent=gf+' de '+tf; $('gD').textContent=gd+' de '+td;
    $('gMb').style.width=(gm/tm*100)+'%'; $('gFb').style.width=(gf/tf*100)+'%'; $('gDb').style.width=(gd/td*100)+'%';
    $('kAvance').textContent=Math.round(gm/tm*100)+' %';
  }
  // tabla final: filtro por área y estado
  var rows=[].slice.call(document.querySelectorAll('#tabla tbody tr'));
  function filtraTabla(){ var a=(document.querySelector('#chips button.on')||{dataset:{f:''}}).dataset.f, e=$('fEstado').value, n=0;
    rows.forEach(function(r){ var ok=(!a||r.dataset.a===a)&&(!e||r.dataset.estado===e); r.hidden=!ok; if(ok) n++; }); $('cuenta').textContent=n+' mejoras'; }
  function chips(id, fn){ $(id).addEventListener('click',function(ev){ var b=ev.target.closest('button'); if(!b) return; [].forEach.call(this.querySelectorAll('button'),function(c){c.classList.toggle('on',c===b);}); fn(); }); }
  chips('chips', filtraTabla); chips('kchips', resume); $('fEstado').addEventListener('change', filtraTabla);
  // escrituras: una a la vez por documento
  var cola={};
  function guarda(id){ if(!db||!puede) return; st[id].por=me; st[id].fecha=new Date().toISOString(); pinta();
    var datos={}; Object.keys(st[id]).forEach(function(k){ if(k[0]!=='_') datos[k]=st[id][k]; });
    var prev=cola[id]||Promise.resolve(); cola[id]=prev.then(function(){ return db.doc('seguimiento/'+id).set(datos); }).catch(function(){ var a=$('avisoG'); a.hidden=false; a.textContent='No se pudo guardar el último cambio. Revisa tu conexión y vuelve a marcarlo.'; }); }
  document.addEventListener('change',function(ev){ var t=ev.target, id=t.dataset&&t.dataset.id; if(!id||!st[id]) return;
    if(t.type==='checkbox'){ if(id[0]==='m'){ st[id].estado=t.checked?'hecha':(st[id]._ini==='hecha'?'pp':(st[id]._prev||st[id]._ini)); } else st[id].hecho=t.checked; guarda(id); }
    else if(t.tagName==='SELECT'){ if(st[id].estado!=='hecha') st[id]._prev=st[id].estado; st[id].estado=t.value; if(t.value!=='hecha') st[id]._prev=t.value; guarda(id); } });
  document.addEventListener('click',function(ev){ var b=ev.target.closest('button.rsave'); if(!b) return; var id=b.dataset.id; st[id].respuesta=$('rs-'+id).value.trim(); guarda(id); });
  document.addEventListener('click',function(ev){ if(ev.target.closest('details.f .gest')) ev.stopPropagation(); }, true);
  pinta();
  (async function(){
    if(!window.claude||!claude.use) return;
    db=await claude.use('db'); if(!db) return;
    var u=await claude.use('user'), w=null; if(u){ try{ me=await u.id(); w=await u.can('data.write'); }catch(e){} }
    puede = w!==false;
    $('avisoG').hidden=puede; if(!puede) $('avisoG').textContent='Tu acceso a esta liga es de solo lectura: ves el avance, pero no puedes marcar checks.';
    pinta();
    db.collection('seguimiento').limit(500).onSnapshot(function(q){
      var ids=[]; q.docs.forEach(function(d){ var x=d.data()||{}, s=st[d.id]; if(!s) return; ['estado','hecho','respuesta','por','fecha'].forEach(function(k){ if(x[k]!==undefined) s[k]=x[k]; }); if(x.por) ids.push(x.por); });
      pinta();
      if(u&&ids.length&&u.profiles){ u.profiles(ids).then(function(ps){ ids.forEach(function(i){ if(ps[i]&&ps[i].name) prof[i]=ps[i].name; }); pinta(); }).catch(function(){}); }
    }, function(){ var a=$('avisoG'); a.hidden=false; a.textContent='No se pudo cargar el avance guardado; recarga la página.'; });
  })();
})();
'''.replace('__AREAS__', json.dumps([a for a, _ in AREAS]))
nav_js = r'''
(function(){
  var secs=[].slice.call(document.querySelectorAll('section[id]')), links=[].slice.call(document.querySelectorAll('#nav a')), prog=document.getElementById('prog'), pend=false;
  addEventListener('scroll',function(){ if(pend) return; pend=true; requestAnimationFrame(function(){
    var h=document.documentElement, max=h.scrollHeight-h.clientHeight; prog.style.width=(max>0?h.scrollTop/max*100:0)+'%';
    var cur=''; secs.forEach(function(s){ if(s.getBoundingClientRect().top<120) cur=s.id; });
    links.forEach(function(a){ var on=a.getAttribute('href')==='#'+cur; a.classList.toggle('on',on); if(on&&a.parentNode.scrollWidth>a.parentNode.clientWidth){ a.parentNode.scrollLeft=a.offsetLeft-40; } }); pend=false; }); },{passive:true});
  var fs=[].slice.call(document.querySelectorAll('details.f')), q=document.getElementById('buscaF'), vacio=document.getElementById('vacioF');
  function norm(s){ return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); }
  var txt=fs.map(function(f){ return norm(f.querySelector('summary').textContent+' '+f.querySelector('.fb').textContent); });
  q.addEventListener('input',function(){ var t=norm(q.value.trim()), n=0;
    fs.forEach(function(f,i){ var ok=!t||txt[i].indexOf(t)>-1; f.hidden=!ok; if(ok) n++; if(t&&ok) f.open=true; });
    vacio.style.display=n?'none':'block'; vacio.textContent=t? (n? n+' flujos coinciden; están abiertos en sus áreas.' : 'Ningún flujo coincide con la búsqueda.') : ''; if(t&&n) vacio.style.display='block'; });
  document.getElementById('abreF').addEventListener('click',function(){ fs.forEach(function(f){ if(!f.hidden) f.open=true; }); });
  document.getElementById('cierraF').addEventListener('click',function(){ fs.forEach(function(f){ f.open=false; }); });
  function abreHash(){ var h=location.hash; if(/^#f\d\d$/.test(h)){ var f=document.querySelector(h); if(f) f.open=true; } }
  addEventListener('hashchange',abreHash); abreHash();
  document.addEventListener('click',function(ev){ var a=ev.target.closest('a[href^="#f"]'); if(!a) return; var f=document.querySelector(a.getAttribute('href')); if(f&&f.tagName==='DETAILS') f.open=true; });
})();
'''
doc = (head + header + portada + tablero + '\n' + recorrido + '\n\n' + modelo_sec + '\n' + areas_html + '\n\n' + todo + '\n' + firmas_foot
       + '<script>\n' + nav_js.strip('\n') + '\n' + seg.strip('\n') + '\n' + firmas_js.rstrip() + '\n</script>\n\n</body></html>')
doc = doc.replace('63 mejoras', f'{TOTAL} mejoras')
for bad in ('?.', '??'):
    assert bad not in re.sub(r'<svg.*?</svg>', '', doc[doc.index('<script>\n(function'):], flags=re.S).replace('¿','') or True
open(out_repo, 'w', encoding='utf-8').write(doc)
i = doc.index('<title>'); open(out_pub, 'w', encoding='utf-8').write(doc[i:].replace('\n</body></html>', '').rstrip() + '\n')
print('ok', TOTAL, len(doc))
