import sys, re
src, out_pub, out_repo = sys.argv[1:4]
doc = open(src, encoding='utf-8').read()
def rep(a, b, n=1):
    global doc
    c = doc.count(a); assert c == n, (c, a[:100]); doc = doc.replace(a, b)

T = 'Flujos de trabajo: taller, servicios, consignación y trazabilidad · puntos 1 al 8'
A = 'Requerimiento funcional 1: alta del consignante con beneficiario y dirección de devolución'
P = 'Mejora: sugerencia de precios basada en datos históricos'
def s(letra, titulo, n=''): return f'<span class="src" title="{titulo}">{letra}{n}</span>'
def icono(clave):
    i = doc.index(f'<code>{clave}</code>'); a = doc.rindex('<div class="mi">', 0, i)
    return doc[a:doc.index('</div>', a) + 6]
def area_de(clave): return {'CON':('consignacion','Consignación'),'PRE':('preparacion','Certificación, taller y preparación')}[clave[:3]]

nuevas = [
 ('CON-14','CON-09',True,'Sugerencia de precio con datos históricos',
  'La sugerencia de precio se calcula con los artículos que Vende Tu Clóset ya vendió y con sus precios reales de venta. Al valuar una pieza se consulta un precio mínimo y uno máximo sustentados en ese historial, para que la recomendación refleje el comportamiento real del negocio. La homologación de artículos con inteligencia artificial es la base: identifica el producto correspondiente en los registros de años anteriores y conserva la trazabilidad de los precios a los que se vendió. Por defecto no se marcan diferencias ni se generan alertas con precios de la competencia; esa comparación solo se activa cuando la empresa configura los enlaces de los sitios externos que quiere usar como referencia.',
  s('P',P), 'Ver flujos <a href="#f04">04</a>, <a href="#f05">05</a> y <a href="#f59">59</a> del modelo integral.'),
 ('CON-15','CON-02',False,'El consignante acepta o rechaza en línea, con firma',
  'Hoy los rechazos se comunican por WhatsApp o en papel y es difícil comprobar qué decidió cada consignante. Se le comparte la lista de sus artículos por enlace o portal, marca los que acepta y los que rechaza, confirma con firma digital y su respuesta queda guardada con la fecha y los artículos. Si falta respuesta, el sistema avisa; los rechazados pasan a devolución y se registra su entrega o envío.',
  s('T',T,'7'), ''),
 ('CON-16','CON-11',False,'Acuse de entrega o devolución con firma',
  'Al entregar o devolver piezas se genera la relación de artículos, se comparte por el portal o un enlace y el consignante confirma la recepción con firma digital. Se guardan la fecha, el detalle de los artículos y la evidencia; cada artículo cambia de estado y el proceso se cierra, sin depender de conversaciones o archivos sueltos.',
  s('T',T,'8'), ''),
 ('PRE-08','PRE-06',False,'Artículos que solo entran a limpieza',
  'Las piezas de clientes que vienen solo a limpieza se registran como un servicio aparte de la consignación: cliente, artículo y estado al recibirlo, tipo de limpieza, costo y responsable. Se confirma su llegada al taller, se sigue el trabajo y se cierra al entregarla al cliente. Hoy a veces se registran con valor cero sin explicar el motivo, o no se registran.',
  s('T',T,'3'), ''),
 ('PRE-09','PRE-04',False,'Tiempos y costos de taller',
  'Se registra cuándo entra la pieza al proceso, cuándo empieza el trabajo, sus pausas y su conclusión, para separar el tiempo de espera del trabajo efectivo, junto con los costos internos y externos (materiales, servicios y traslados). Con eso salen reportes por artículo, tipo de trabajo, persona, sucursal y proveedor.',
  s('T',T,'5'), ''),
 ('PRE-10','PRE-02',False,'Certificados en la ficha del artículo',
  'Cada artículo guarda el tipo de certificado, la entidad que lo emitió, el enlace, PDF o imagen del documento, la fecha y quién lo cargó. Cuando un cliente lo pide, se consulta desde la ficha sin buscar en varias plataformas, y su cobro sigue la política comercial que defina el negocio.',
  s('T',T,'6'), ''),
 ('PRE-11','PRE-05',False,'Evidencia del estado y de cada intervención',
  'Al recibir la pieza se guardan fotos y observaciones de daños, desgaste, piezas faltantes o rasgos que deben conservarse. Cada intervención que pueda modificarla (color, piezas, limpieza o reparación) se registra con evidencia del resultado, y taller y ventas la consultan desde la ficha del artículo para evitar confusiones al entregarla.',
  s('T',T,'4'), ''),
]
for clave, ref, ancho, titulo, texto, fuente, extra in nuevas:
    aid, anom = area_de(clave)
    p_extra = f'<p class="ori" style="margin-top:.2rem">{extra}</p>' if extra else ''
    card = (f'<li class="{"ancho" if ancho else ""}">{icono(ref)}<div class="mb"><code>{clave}</code><h4>{titulo}</h4>'
            f'<span class="lbl">Proceso que se busca</span><p>{texto}</p>{p_extra}<div class="im">{fuente}<span class="est">Por priorizar</span></div></div></li>')
    # tarjeta al final de la lista del área
    i = doc.index(f'<section class="area', doc.index(f'id="{aid}"') - 40); j = doc.index('</ul>', i)
    doc = doc[:j] + card + doc[j:]
    # renglón en la tabla final, después del último de su área
    filas = [m.end() for m in re.finditer(rf'<tr data-a="{aid}">.*?</tr>', doc, re.S)]
    corta = re.sub(r'<a [^>]*>|</a>', '', texto)
    fila = f'<tr data-a="{aid}"><td><code>{clave}</code></td><td>{anom}</td><td><b>{titulo}</b><br><small>{corta}</small></td><td>{fuente}</td><td><span class="est">Por priorizar</span></td></tr>'
    doc = doc[:filas[-1]] + fila + doc[filas[-1]:]

# CON-01: perfiles existentes y filtro (requerimiento funcional 1)
add01 = '<div class="ps"><div class="pr"><span class="lbl gris">Problema</span><p>Los consignantes que ya están registrados se dieron de alta antes de que existieran estos datos.</p></div><div class="so"><span class="lbl">Solución</span><p>Sus perfiles se pueden editar para agregar o actualizar beneficiario autorizado y dirección de devolución, y un filtro o indicador en el módulo de consignantes muestra los perfiles con esta información incompleta, para actualizarlos poco a poco hasta que todos la tengan.</p></div></div>'
i = doc.index('<code>CON-01</code>'); j = doc.index('<div class="im">', i)
k = doc.index('</div>', j)
doc = doc[:j] + add01 + doc[j:]
i = doc.index('<code>CON-01</code>'); j = doc.index('<div class="im">', i)
doc = doc[:j+16] + s('A',A) + doc[j+16:]
rep('el contrato fija el plazo para devolver lo que no se venda.</small>', 'el contrato fija el plazo para devolver lo que no se venda. Los perfiles existentes se pueden completar, con un filtro de los que tienen estos datos pendientes.</small>')
i = doc.index('<tr data-a="consignacion"><td><code>CON-01'); j = doc.index('</td><td><span class="est">', i)
doc = doc[:j] + s('A',A) + doc[j:]

# PRE-06 y PRE-07: fuentes del documento de taller
for clave, n in (('PRE-06','1'),('PRE-07','2')):
    for marca in (f'<code>{clave}</code><h4>', f'<td><code>{clave}</code></td>'):
        i = doc.index(marca); j = doc.index('<span class="est">', i)
        doc = doc[:j] + s('T',T,n) + doc[j:]
rep('se registra el tipo de servicio, su costo, su estatus y las fechas de salida y regreso.</p>',
    'se registra el tipo de servicio, su costo, su estatus y las fechas de salida y regreso. Igual en el taller interno: motivo del envío, responsable, destino, costo estimado, recepción confirmada en el destino y regreso registrado en la sucursal.</p>')

rep('@media(prefers-reduced-motion:reduce)', '.mb p.ori a{color:var(--fucsia);font-weight:600}\n@media(prefers-reduced-motion:reduce)')
# cifras
rep('<b>56</b><small>mejoras para cerrar</small>', '<b>63</b><small>mejoras para cerrar</small>')
rep('Mejoras para cerrar el flujo <small>13 mejoras</small>', 'Mejoras para cerrar el flujo <small>16 mejoras</small>')
rep('Mejoras para cerrar el flujo <small>7 mejoras</small>', 'Mejoras para cerrar el flujo <small>7 mejoras</small>', 2)
i = doc.index('id="preparacion"'); j = doc.index('Mejoras para cerrar el flujo <small>7 mejoras</small>', i)
doc = doc[:j] + 'Mejoras para cerrar el flujo <small>11 mejoras</small>' + doc[j+len('Mejoras para cerrar el flujo <small>7 mejoras</small>'):]
rep('<a href="#consignacion">Consignación</a><small>13 mejoras</small>', '<a href="#consignacion">Consignación</a><small>16 mejoras</small>')
i = doc.index('<a href="#preparacion">'); j = doc.index('<small>7 mejoras</small>', i)
doc = doc[:j] + '<small>11 mejoras</small>' + doc[j+len('<small>7 mejoras</small>'):]

# fuentes en portada y pie
rep('<li><span class="src">M</span>Modelo integral', f'<li><span class="src">T</span>{T}</li><li><span class="src">A</span>{A}</li><li><span class="src">P</span>{P}</li><li><span class="src">M</span>Modelo integral')
rep('· M = modelo integral de flujos', '· T = flujos de taller, servicios y consignación (puntos 1 al 8) · A = requerimiento funcional de alta del consignante · P = sugerencia de precios con datos históricos · M = modelo integral de flujos')
assert doc.count('<code>CON-')==2*16 and doc.count('<code>PRE-')==2*11, (doc.count('<code>CON-'), doc.count('<code>PRE-'))
open(out_repo, 'w', encoding='utf-8').write(doc)
i = doc.index('<title>'); open(out_pub, 'w', encoding='utf-8').write(doc[i:].replace('\n</body></html>', '').rstrip() + '\n')
print('ok')
