import json, re, html, sys
orig = open(sys.argv[1], encoding='utf-8').read().split('\n')
d = json.load(open(sys.argv[2], encoding='utf-8'))
out_path = sys.argv[3]

# 1) Quitar el runtime que inyecta la plataforma (línea 1) y reponer la cabecera propia
body = '\n'.join(orig[1:])
head = ('<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n')
doc = head + body
def rep(a, b, n=1):
    global doc
    c = doc.count(a)
    assert c == n, (c, a[:80])
    doc = doc.replace(a, b)

def e(s):
    s = html.escape(s, quote=False)
    return re.sub(r'\*([^*]+)\*', r'<em>\1</em>', s)

# 2) CSS nuevo (mismos tokens del documento)
css = r'''
/* ===== Modelo integral (versión consolidada 1.0, 29-oct-2026) ===== */
.kpis{grid-template-columns:repeat(3,minmax(0,1fr))}
@media(max-width:760px){.kpis{grid-template-columns:1fr 1fr}}
.kpis div.n2{background:var(--rosa2);border-color:var(--fucsiaL)}
.rel{display:flex;gap:.6rem;flex-wrap:wrap;align-items:baseline;margin-top:.8rem;font-size:.86rem;color:var(--ink2)}
.rel a{font-family:var(--mono);font-size:.72rem;font-weight:700;color:var(--fucsia);text-decoration:none;padding:.08rem .45rem;border-radius:6px;border:1px solid var(--linea);background:#fff}
.rel a:hover{border-color:var(--fucsia)}
.regla{margin-top:1.6rem;padding:1.1rem 1.3rem;border-radius:16px;background:var(--fucsia);color:#fff}
.regla b{font-family:var(--serif);font-weight:500;font-size:1.15rem;display:block;margin-bottom:.2rem}
.regla p{margin:0;font-size:.95rem}
.mapa{list-style:none;margin:1.6rem 0 0;padding:0;display:flex;flex-wrap:wrap;gap:6px 4px;align-items:center}
.mapa li{font-size:.8rem;padding:.3rem .7rem;border-radius:99px;background:#fff;border:1px solid var(--linea);color:var(--ink)}
.mapa li:not(:last-child):after{content:"→";margin-left:.55rem;color:var(--fucsia);font-weight:700}
.mapa li:not(:last-child){border-right-width:1px}
.alter{margin-top:1rem;font-size:.88rem;color:var(--ink2);max-width:52rem}
.alter b{color:var(--ink)}
.avisos{margin:1.2rem 0 0;padding:0;list-style:none;display:grid;gap:.4rem;font-size:.88rem;color:var(--ink2);max-width:52rem}
.avisos li{padding-left:1.1rem;position:relative}
.avisos li:before{content:"";position:absolute;left:0;top:.6em;width:6px;height:6px;border-radius:50%;background:var(--fucsiaL)}
.herr{display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;margin-top:2rem}
.herr input{font:inherit;font-size:.9rem;padding:.5rem .9rem;border-radius:99px;border:1px solid var(--linea);min-width:0;flex:1 1 16rem;background:#fff;color:var(--ink)}
.herr input:focus{outline:2px solid var(--fucsia);outline-offset:1px}
.herr button{font:inherit;font-size:.82rem;font-weight:500;border:1px solid var(--linea);background:#fff;color:var(--ink);padding:.45rem .9rem;border-radius:99px;cursor:pointer}
.herr button:hover{border-color:var(--fucsia);color:var(--fucsia)}
.bloque{margin-top:2.8rem;scroll-margin-top:64px}
.bh{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:1rem;align-items:baseline;border-bottom:1px solid var(--linea);padding-bottom:.7rem}
.bh .rn{font-family:var(--serif);font-size:2.2rem;line-height:1;color:var(--fucsia)}
.bh h3{font-family:var(--serif);font-weight:500;font-size:clamp(1.3rem,3vw,1.7rem);margin:0;line-height:1.15}
.bh small{font-family:var(--mono);font-size:.72rem;color:var(--humo);white-space:nowrap}
.fl{display:grid;gap:10px;margin-top:1rem}
details.f{border:1px solid var(--linea);border-radius:16px;background:#fff;scroll-margin-top:64px}
details.f[open]{border-color:var(--fucsiaL);box-shadow:0 10px 28px rgba(218,0,105,.07)}
details.f>summary{list-style:none;cursor:pointer;display:grid;grid-template-columns:3rem minmax(0,1fr) auto;gap:.8rem;align-items:center;padding:.85rem 1.1rem}
details.f>summary::-webkit-details-marker{display:none}
details.f>summary .fn{font-family:var(--mono);font-size:.8rem;font-weight:700;color:#fff;background:var(--fucsia);border-radius:10px;text-align:center;padding:.3rem 0}
details.f>summary b{font-weight:600;font-size:1rem;line-height:1.3;display:block}
details.f>summary small{display:block;color:var(--ink2);font-size:.82rem;line-height:1.4;margin-top:.1rem}
details.f>summary:after{content:"+";font-size:1.3rem;color:var(--fucsia);font-weight:500;line-height:1}
details.f[open]>summary:after{content:"–"}
.fb{padding:0 1.1rem 1.1rem 4.9rem;display:grid;gap:.9rem}
@media(max-width:640px){.fb{padding:0 1rem 1rem}}
.fb .lbl{display:block;margin:0 0 .25rem}
.fb p{margin:0;font-size:.92rem;color:var(--ink2);line-height:1.6}
.fb ol{margin:0;padding-left:1.3rem;display:grid;gap:.35rem;font-size:.92rem;color:var(--ink);line-height:1.55}
.fb ol li::marker{color:var(--fucsia);font-family:var(--mono);font-size:.78rem;font-weight:700}
.fb .ctl{background:var(--rosa);border:1px solid var(--linea);border-radius:12px;padding:.75rem .9rem}
.fb .prob{background:var(--fucsia);border-radius:12px;padding:.75rem .9rem}
.fb .prob .lbl,.fb .prob p{color:#fff}
.fb .res{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}
@media(max-width:640px){.fb .res{grid-template-columns:1fr}}
.fb .res>div{border-radius:12px;padding:.75rem .9rem;background:var(--nube);border:1px solid var(--linea2)}
.fb .ori{font-size:.78rem;color:var(--humo)}
.vacio{display:none;margin-top:1.4rem;color:var(--ink2);font-size:.92rem}
.dec{margin:1.4rem 0 0;padding:0;list-style:none;counter-reset:d;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
@media(max-width:760px){.dec{grid-template-columns:1fr}}
.dec li{counter-increment:d;position:relative;padding:.9rem 1rem .9rem 3.2rem;border-radius:14px;background:#fff;border:1px solid var(--linea);font-size:.92rem;color:var(--ink2);line-height:1.55}
.dec li:before{content:counter(d,decimal-leading-zero);position:absolute;left:1rem;top:.95rem;font-family:var(--mono);font-size:.74rem;font-weight:700;color:var(--fucsia)}
.dec li b{color:var(--ink);font-weight:600}
.crit{margin:1.2rem 0 0;padding:0;list-style:none;display:grid;gap:8px}
.crit li{display:grid;grid-template-columns:28px minmax(0,1fr);gap:.7rem;align-items:start;font-size:.93rem;color:var(--ink);padding:.7rem .9rem;border-radius:12px;background:var(--rosa);border:1px solid var(--linea)}
.crit li svg{width:22px;height:22px;margin-top:.1rem}
details.anexo{margin-top:2.2rem;border:1px solid var(--linea);border-radius:16px;background:#fff}
details.anexo>summary{cursor:pointer;padding:1rem 1.2rem;font-weight:600;list-style:none;display:flex;justify-content:space-between;gap:1rem}
details.anexo>summary::-webkit-details-marker{display:none}
details.anexo>summary:after{content:"Ver";font-size:.8rem;color:var(--fucsia)}
details.anexo[open]>summary:after{content:"Ocultar"}
details.anexo .in{padding:0 1.2rem 1.2rem}
details.anexo .tw{margin-top:.6rem}
table.t td a{font-family:var(--mono);font-size:.74rem;font-weight:700;color:var(--fucsia);text-decoration:none;margin-right:.35rem}
@media print{.top,.herr,.chips{display:none}details.f>summary:after{display:none}details.f .fb{display:grid}}
'''
rep('@media(prefers-reduced-motion:reduce)', css.strip() + '\n@media(prefers-reduced-motion:reduce)')

# 3) Navegación
rep('<a href="#pendientes">Por confirmar</a>', '<a href="#modelo">Modelo integral</a><a href="#decisiones">Decisiones</a><a href="#pendientes">Por confirmar</a>')

# 4) Portada: subtítulo, cifras, ficha y fuentes
rep('<span class="eyebrow">Flujos de trabajo por área</span>', '<span class="eyebrow">Flujos de trabajo por área · versión 2 · 30 oct 2026</span>')
rep('<p class="lead">Ordenamos lo que se levantó en las reuniones con el equipo de Vende Tu Clóset: qué hace cada área, en qué orden pasa el trabajo de una a otra y qué mejoras hay que hacer en Sacs para cerrar cada flujo.</p>',
    '<p class="lead">Ordenamos lo que se levantó en las reuniones con el equipo de Vende Tu Clóset: qué hace cada área, en qué orden pasa el trabajo de una a otra y qué mejoras hay que hacer en Sacs para cerrar cada flujo. Esta versión suma el <a href="#modelo" style="color:var(--fucsia)">modelo integral de 60 flujos</a> consolidado el 29 de octubre: quién inicia cada proceso, sus pasos en orden, el control obligatorio y el resultado esperado.</p>')
rep('''    <div><b>16</b><small>reglas por confirmar</small></div>
  </div>''', '''    <div><b>16</b><small>reglas por confirmar</small></div>
    <div class="n2"><b>60</b><small>flujos integrales</small></div>
    <div><b>13</b><small>decisiones de dirección</small></div>
  </div>''')
rep('<p>20 y 21 de octubre de 2026, con el dueño y con cada área. Levantó Andrea Araujo.</p>',
    '<p>20 y 21 de octubre de 2026, con el dueño y con cada área. Levantó Andrea Araujo. Se suman seis reuniones operativas, tres sesiones de revisión de consignación y el caso de ventas del 29 de octubre, consolidados en el modelo integral (versión 1.0).</p>')
rep('<li><span class="src">R</span>Entrevista con el equipo de Consignación sobre su proceso real</li></ul>',
    '<li><span class="src">R</span>Entrevista con el equipo de Consignación sobre su proceso real</li><li><span class="src">M</span>Modelo integral de flujos de trabajo · versión consolidada 1.0 · 29 oct 2026</li></ul>')

# 5) En cada área, liga a los flujos integrales relacionados
rel = {
 'consignacion': ['01','02','03','05','06','07','08','09','36','39','40','56'],
 'preparacion':  ['10','11','12','13','14','15','16','17','18','21'],
 'ecommerce':    ['21','22','25','26','27','32'],
 'ventas':       ['24','25','26','27','28','29','30','35'],
 'logistica':    ['19','31','32','33','34','35','37','38','46'],
 'contabilidad': ['41','42','43','44','45','47','48','49','50','51','52'],
 'direccion':    ['23','52','53','54','55','57','59','60'],
}
for area, fl in rel.items():
    marca = '<section class="area %s" id="%s">' % ('rosa' if area in ('consignacion','ecommerce','logistica','direccion') else 'cla', area)
    i = doc.index(marca); j = doc.index('<p class="ctx">', i)
    links = ''.join('<a href="#f%s">%s</a>' % (n, n) for n in fl)
    doc = doc[:j] + '<div class="rel"><span class="eyebrow">Flujos integrales relacionados</span>' + links + '</div>\n  ' + doc[j:]

# 6) Sección del modelo integral
ok = '<svg viewBox="0 0 24 24" fill="none" stroke="#DA0069" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8 12.5l2.7 2.7L16 9.6"/></svg>'
mapa = ['Alta de consignante','Recepción y prerregistro','Evidencia y clasificación','Valuación','Acuerdo de precio','Contrato firmado','Etiqueta / SKU','Autenticación','Taller si aplica','Fotografía profesional','Publicación y disponibilidad','Venta / apartado','Cobro y validación','Entrega confirmada','Pago al consignante','Conciliación y reporte']
nombres = {'I':'Consignantes, recepción y propuestas','II':'Autenticación y penalizaciones','III':'Taller, limpieza y servicios','IV':'Inventarios, custodia y liberación','V':'Ventas, interesados, apartados y clientes','VI':'Logística, entregas y devoluciones','VII':'Pagos a consignantes y saldos','VIII':'Finanzas, gastos y resultados','IX':'Autorizaciones, alertas, reportes y experiencia'}
h = []
h.append('<section class="blanco" id="modelo" style="background:var(--nube)"><div class="wrap">')
h.append('  <span class="eyebrow">Modelo integral · versión consolidada 1.0 · 29 de octubre de 2026</span>')
h.append('  <h2 class="t2">60 flujos para <em>operar Vende Tu Clóset en Sacs</em></h2>')
h.append('  <p class="lead">Consolidación de seis reuniones operativas, tres sesiones de revisión de consignación y una incidencia comercial adicional: 77 hallazgos trazados quedan agrupados en 60 procesos. Cada flujo dice quién lo inicia, los pasos en orden, el control obligatorio, la excepción y el resultado. Es una especificación funcional para validar con el cliente: describe lo que se necesita, no afirma que todo esté desarrollado.</p>')
h.append('  <div class="regla"><b>Regla transversal</b><p>Ningún artículo estará disponible para venta antes de cumplir los requisitos de precio autorizado, contrato firmado, autenticación aprobada y preparación aplicable.</p></div>')
h.append('  <h3 style="font-family:var(--sans);font-size:.74rem;font-weight:600;letter-spacing:.24em;text-transform:uppercase;margin:2.2rem 0 0;color:var(--ink)">Mapa del recorrido principal</h3>')
h.append('  <ol class="mapa">' + ''.join('<li>%s</li>' % e(x) for x in mapa) + '</ol>')
h.append('  <p class="alter"><b>Rutas alternas:</b> propuesta rechazada; fake o no concluyente; servicio de taller externo; daño o merma; traslado; retiro anticipado o al vencimiento; devolución de comprador; saldo a favor; penalización; pago bancario rechazado; cliente en espera de disponibilidad.</p>')
h.append('  <ul class="avisos"><li><b>Trazabilidad:</b> cada artículo conserva un identificador desde el prerregistro, evidencias, custodios, operaciones y resultado final. Los cargos, pagos y devoluciones llevan referencia al artículo y a su operación de origen.</li><li>Las decisiones de tarifas, sanciones, prioridades, derechos contractuales y devoluciones deben ser aprobadas por dirección.</li><li>Todas las áreas deben poder ver el estado de sus tareas, pero no necesariamente editar información ajena o sensible.</li><li>Las transcripciones automáticas incluyen errores: se preserva el sentido operativo y no se presentan supuestos como decisiones.</li></ul>')
h.append('  <ol class="idx">' + ''.join('<li><span class="ii" style="font-family:var(--serif);color:var(--fucsia);font-size:1.1rem">%s</span><span class="n">%s–%s</span><a href="#b%s">%s</a><small>%d flujos</small></li>' % (b['num'], b['flujos'][0]['n'], b['flujos'][-1]['n'], b['num'], e(nombres[b['num']]), len(b['flujos'])) for b in d['bloques']) + '</ol>')
h.append('  <div class="herr"><input id="buscaF" type="search" placeholder="Buscar en los 60 flujos: apartado, DHL, fake, saldo a favor…" aria-label="Buscar flujos"><button type="button" id="abreF">Abrir todos</button><button type="button" id="cierraF">Cerrar todos</button></div>')
h.append('  <p class="vacio" id="vacioF">Ningún flujo coincide con la búsqueda.</p>')
for b in d['bloques']:
    h.append('  <div class="bloque" id="b%s"><div class="bh"><span class="rn">%s</span><h3>%s</h3><small>flujos %s–%s</small></div><div class="fl">' % (b['num'], b['num'], e(nombres[b['num']]), b['flujos'][0]['n'], b['flujos'][-1]['n']))
    for f in b['flujos']:
        p = ['<details class="f" id="f%s"><summary><span class="fn">%s</span><span><b>%s</b><small>%s</small></span></summary><div class="fb">' % (f['n'], f['n'], e(f['titulo']), e(f['disparador'][0].upper() + f['disparador'][1:]))]
        if f['problema']:
            p.append('<div class="prob"><span class="lbl">Problema reportado</span><p>%s</p></div>' % e(f['problema'][0].upper() + f['problema'][1:]))
        p.append('<div><span class="lbl">Pasos del flujo</span><ol>%s</ol></div>' % ''.join('<li>%s</li>' % e(x) for x in f['pasos']))
        p.append('<div class="ctl"><span class="lbl">Control y excepción</span><p>%s</p></div>' % e(f['control'][0].upper() + f['control'][1:]))
        p.append('<div class="res"><div><span class="lbl">Resultado</span><p>%s</p></div><div><span class="lbl gris">Origen</span><p class="ori">%s</p></div></div>' % (e(f['resultado'][0].upper() + f['resultado'][1:]), e(f['origen'][0].upper() + f['origen'][1:])))
        p.append('</div></details>')
        h.append('   ' + ''.join(p))
    h.append('  </div></div>')
h.append('</div></section>')

# 7) Decisiones, criterios y anexo de hallazgos
h.append('<section class="blanco" id="decisiones"><div class="wrap">')
h.append('  <span class="eyebrow">Modelo integral · lo que decide Vende Tu Clóset</span>')
h.append('  <h2 class="t2">13 reglas que requieren <em>decisión de dirección</em></h2>')
h.append('  <p class="lead">Sin estas definiciones los flujos correspondientes no se pueden configurar con certeza. Complementan las 16 preguntas de la siguiente sección.</p>')
items = []
for x in d['decisiones']:
    t, _, r = x.partition(':')
    items.append('<li><b>%s:</b>%s</li>' % (e(t), e(r)))
h.append('  <ol class="dec">' + ''.join(items) + '</ol>')
h.append('  <h3 style="font-family:var(--sans);font-size:.74rem;font-weight:600;letter-spacing:.24em;text-transform:uppercase;margin:2.6rem 0 0;color:var(--ink)">Criterios mínimos de aceptación transversales</h3>')
h.append('  <ul class="crit">' + ''.join('<li>%s<span>%s</span></li>' % (ok, e(x)) for x in d['criterios']) + '</ul>')
filas = ''.join('<tr><td><code>%s</code></td><td>%s</td><td>%s</td></tr>' % (r['f'], e(r['t']), ''.join('<a href="#f%s">%s</a>' % (n, n) for n in r['flujos'])) for r in d['hallazgos'])
h.append('  <details class="anexo"><summary>Anexo · rastreo individual de los 77 hallazgos (F01–F77) a los 60 flujos</summary><div class="in">')
h.append('   <p class="nota" style="margin-top:0">Los números F01–F77 corresponden a la enumeración de las primeras seis reuniones; la última columna son los flujos consolidados. Las tres sesiones de prueba y ajuste de consignación se incorporan de forma transversal a los flujos 01–18 y 53–58; el caso de compradores que esperan disponibilidad está en los flujos 24 y 30.</p>')
h.append('   <div class="tw"><table class="t"><thead><tr><th>Hallazgo</th><th>Contenido</th><th>Flujos integrales</th></tr></thead><tbody>' + filas + '</tbody></table></div>')
h.append('  </div></details>')
h.append('</div></section>')
h.append('')
nuevo = '\n'.join(h)
rep('<section class="blanco" id="pendientes">', nuevo + '\n<section class="blanco" id="pendientes">')

# 8) Pie de página
rep('· Vende Tu Clóset · octubre de 2026.</p>', '· Vende Tu Clóset · octubre de 2026 · versión 2 del 30 de octubre, con el modelo integral de 60 flujos.</p>')
rep('S = sesión en la guía de consignación. El número', 'S = sesión en la guía de consignación · M = modelo integral de flujos (versión consolidada 1.0, 29 oct 2026). El número')

# 9) JS: buscador y abrir/cerrar
js = r'''
(function(){
  var fs=[].slice.call(document.querySelectorAll('details.f')), bs=[].slice.call(document.querySelectorAll('.bloque')), q=document.getElementById('buscaF'), vacio=document.getElementById('vacioF');
  function norm(s){ return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); }
  var txt=fs.map(function(f){ return norm(f.textContent); });
  q.addEventListener('input',function(){ var t=norm(q.value.trim()), n=0;
    fs.forEach(function(f,i){ var ok=!t||txt[i].indexOf(t)>-1; f.hidden=!ok; if(ok) n++; if(t&&ok) f.open=true; });
    bs.forEach(function(b){ b.hidden=!b.querySelector('details.f:not([hidden])'); });
    vacio.style.display=n?'none':'block'; });
  document.getElementById('abreF').addEventListener('click',function(){ fs.forEach(function(f){ if(!f.hidden) f.open=true; }); });
  document.getElementById('cierraF').addEventListener('click',function(){ fs.forEach(function(f){ f.open=false; }); });
  function abreHash(){ var h=location.hash; if(/^#f\d\d$/.test(h)){ var f=document.querySelector(h); if(f){ f.open=true; } } }
  addEventListener('hashchange',abreHash); abreHash();
  document.addEventListener('click',function(ev){ var a=ev.target.closest('a[href^="#f"]'); if(!a) return; var f=document.querySelector(a.getAttribute('href')); if(f&&f.tagName==='DETAILS') f.open=true; });
})();
'''
rep('</script>\n\n</body></html>', js.strip('\n') + '\n</script>\n\n</body></html>')
doc = doc.replace('<title>Flujos por área · Vende Tu Clóset</title>', '<title>Flujos por área · Vende Tu Clóset</title>')
open(out_path, 'w', encoding='utf-8').write(doc)
print('ok', len(doc))
