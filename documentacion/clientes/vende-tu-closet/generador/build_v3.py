import sys
src, out_pub, out_repo = sys.argv[1:4]
doc = open(src, encoding='utf-8').read()
def rep(a, b, n=1):
    global doc
    c = doc.count(a); assert c == n, (c, a[:90]); doc = doc.replace(a, b)

rep('<title>Flujos por área · Vende Tu Clóset</title>', '<title>Flujos de trabajo y mejoras contempladas para VTC</title>')
rep('<span class="eyebrow">Flujos de trabajo por área · versión 2 · 30 oct 2026</span>', '<span class="eyebrow">Flujos de trabajo y mejoras contempladas · visita del 19 al 24 oct 2026</span>')
rep('<h1>Cada área, su flujo y <em>lo que falta para cerrarlo</em></h1>', '<h1>Flujos de trabajo y <em>mejoras contempladas</em> para VTC</h1>')
a = doc.index('<p class="lead">Ordenamos lo que se levantó'); b = doc.index('</p>', a) + 4
doc = doc[:a] + ('<p class="lead">En la visita del 19 al 24 de octubre de 2026 se documentaron los procesos que cierran el flujo completo de la operación de Vende Tu Clóset, desde que un consignante trae una pieza hasta que recibe su pago. Aquí está qué hace cada área, en qué orden pasa el trabajo de una a otra, las mejoras contempladas en Sacs para cerrar cada flujo y el '
                 '<a href="#modelo" style="color:var(--fucsia)">modelo integral de 60 flujos</a> con sus pasos, controles y resultados. Al final, el documento queda <a href="#firmas" style="color:var(--fucsia)">firmado</a> por Sacs y por Vende Tu Clóset.</p>') + doc[b:]
rep('<span class="eyebrow">Reuniones</span><p>20 y 21 de octubre de 2026, con el dueño y con cada área. Levantó Andrea Araujo. Se suman seis reuniones operativas, tres sesiones de revisión de consignación y el caso de ventas del 29 de octubre, consolidados en el modelo integral (versión 1.0).</p>',
    '<span class="eyebrow">Visita</span><p>Del 19 al 24 de octubre de 2026: reuniones con el dueño y con cada área, seis reuniones operativas y tres sesiones de revisión de consignación. Levantó Andrea Araujo. Se suma el caso de ventas del 29 de octubre; todo queda consolidado en el modelo integral (versión 1.0).</p>')
rep('<a href="#todo">Todas las mejoras</a></nav>', '<a href="#todo">Todas las mejoras</a><a href="#firmas">Firmas</a></nav>')
rep('· Vende Tu Clóset · octubre de 2026 · versión 2 del 30 de octubre, con el modelo integral de 60 flujos.</p>',
    '· Flujos de trabajo y mejoras contempladas para Vende Tu Clóset · visita del 19 al 24 de octubre de 2026 · versión para firma del 30 de octubre.</p>')
rep('<b>Sacs × Andy Araujo Consultorías</b> · Flujos de trabajo por área', '<b>Sacs × Andy Araujo Consultorías</b>')

css = r'''
/* ===== Firmas ===== */
.firmas{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:2rem}
@media(max-width:760px){.firmas{grid-template-columns:1fr}}
.fir{border:1px solid var(--linea);border-radius:18px;background:#fff;padding:1.3rem 1.3rem 1.2rem;display:flex;flex-direction:column;gap:.8rem;min-width:0}
.fir.ok{border-color:var(--fucsia);box-shadow:0 12px 30px rgba(218,0,105,.08)}
.fir h3{font-family:var(--serif);font-weight:500;font-size:1.35rem;margin:0}
.fir .quien{color:var(--ink2);font-size:.9rem;margin:0}
.trazo{height:150px;border-radius:12px;border:1.5px dashed var(--linea);background:var(--nube);display:grid;place-items:center;overflow:hidden;position:relative}
.trazo canvas{width:100%;height:100%;touch-action:none;cursor:crosshair;display:block}
.trazo img{max-width:100%;max-height:100%}
.trazo .ph{position:absolute;inset:auto 0 10px;text-align:center;font-size:.78rem;color:var(--humo);pointer-events:none}
.linea-firma{border-top:1px solid var(--ink);padding-top:.35rem;font-size:.82rem;color:var(--ink2);display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap}
.fir label{font-size:.62rem;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:var(--fucsia)}
.fir input[type=text]{font:inherit;font-size:.95rem;padding:.5rem .8rem;border-radius:10px;border:1px solid var(--linea);background:#fff;color:var(--ink);width:100%}
.fir input[type=text]:focus{outline:2px solid var(--fucsia);outline-offset:1px}
.fir label.acept{font-size:.86rem;font-weight:400;letter-spacing:0;text-transform:none;color:var(--ink2)}
.acept{display:flex;gap:.55rem;align-items:flex-start;font-size:.86rem;color:var(--ink2)}
.acept input{margin-top:.25rem;accent-color:var(--fucsia)}
.fbtn{display:flex;gap:.5rem;flex-wrap:wrap}
.fbtn button{font:inherit;font-size:.86rem;font-weight:600;border-radius:99px;padding:.5rem 1.1rem;cursor:pointer;border:1px solid var(--fucsia);background:var(--fucsia);color:#fff}
.fbtn button.sec{background:#fff;color:var(--fucsia)}
.fbtn button:disabled{opacity:.45;cursor:not-allowed}
.festado{font-size:.84rem;color:var(--ink2);margin:0;min-height:1.2em}
.sello{display:inline-flex;gap:.4rem;align-items:center;font-size:.74rem;font-weight:600;color:var(--fucsia);background:var(--rosa2);border-radius:99px;padding:.2rem .7rem;align-self:flex-start}
.fnota{font-size:.84rem;color:var(--ink2);margin:1.2rem 0 0;max-width:52rem}
'''
rep('@media(prefers-reduced-motion:reduce)', css.strip() + '\n@media(prefers-reduced-motion:reduce)')

def tarjeta(parte, titulo, quien, nombre):
    return f'''<div class="fir" id="fir-{parte}">
      <span class="eyebrow">{titulo}</span>
      <h3 id="nom-{parte}">{nombre}</h3>
      <p class="quien">{quien}</p>
      <div class="trazo" id="trazo-{parte}"><span class="ph">Firma</span></div>
      <div class="linea-firma"><span id="pie-{parte}">Nombre y firma</span><span id="fecha-{parte}">Fecha: ____ / ____ / 2026</span></div>
      <div class="form" id="form-{parte}" hidden>
        <label for="in-{parte}">Nombre completo de quien firma</label>
        <input type="text" id="in-{parte}" autocomplete="name" value="{'' if parte=='sacs' else nombre}">
        <label class="acept"><input type="checkbox" id="ck-{parte}"><span>Revisé este documento y estoy de acuerdo con los flujos de trabajo y las mejoras contempladas.</span></label>
        <div class="fbtn"><button type="button" id="ok-{parte}" disabled>Firmar</button><button type="button" class="sec" id="lim-{parte}">Borrar trazo</button></div>
      </div>
      <p class="festado" id="est-{parte}"></p>
    </div>'''

sec = f'''
<section class="blanco" id="firmas" style="background:var(--nube)"><div class="wrap">
  <span class="eyebrow">Conformidad</span>
  <h2 class="t2">Firmas de <em>conformidad</em></h2>
  <p class="lead">Con su firma, Sacs y Vende Tu Clóset dejan constancia de que este documento recoge los flujos de trabajo y las mejoras contempladas que se documentaron en la visita del 19 al 24 de octubre de 2026. Las reglas marcadas como «por confirmar» y las decisiones de dirección siguen abiertas hasta que se resuelvan.</p>
  <div class="firmas">
    {tarjeta('sacs', 'Por Sacs', 'Sacs · sistema de Vende Tu Clóset', 'Sacs')}
    {tarjeta('vtc', 'Por Vende Tu Clóset', 'Vende Tu Clóset', 'Regina Alarcón')}
  </div>
  <p class="fnota" id="fnota">Para firmar en línea, abre esta liga con tu sesión de Claude: dibuja tu firma con el dedo o el mouse, confirma tu nombre y presiona «Firmar». La firma queda guardada con fecha y hora, y la ve todo el que abra la liga. Si la abres impresa o sin sesión, firma sobre la línea.</p>
</div></section>
'''
rep('\n<footer>', sec + '\n<footer>')

js = r'''
(function(){
  var PARTES=['sacs','vtc'], db=null, me=null, soloLectura=false, fmt=function(iso){ try{ return new Date(iso).toLocaleString('es-MX',{dateStyle:'long',timeStyle:'short'}); }catch(e){ return iso; } };
  function $(id){ return document.getElementById(id); }
  function lienzo(parte){
    var caja=$('trazo-'+parte), c=document.createElement('canvas'), ph=caja.querySelector('.ph');
    caja.innerHTML=''; caja.appendChild(c); if(ph){ ph.textContent='Dibuja tu firma aquí'; caja.appendChild(ph); }
    var r=caja.getBoundingClientRect(), k=2; c.width=Math.max(300,r.width)*k; c.height=150*k;
    var g=c.getContext('2d'); g.scale(k,k); g.lineWidth=2.2; g.lineCap='round'; g.lineJoin='round'; g.strokeStyle='#2B2427';
    var dib=false, hay=false;
    function pt(ev){ var b=c.getBoundingClientRect(); return [ev.clientX-b.left, ev.clientY-b.top]; }
    c.addEventListener('pointerdown',function(ev){ dib=true; c.setPointerCapture(ev.pointerId); var p=pt(ev); g.beginPath(); g.moveTo(p[0],p[1]); });
    c.addEventListener('pointermove',function(ev){ if(!dib) return; var p=pt(ev); g.lineTo(p[0],p[1]); g.stroke(); if(!hay){ hay=true; if(ph) ph.hidden=true; revisa(parte); } });
    addEventListener('pointerup',function(){ dib=false; });
    $('lim-'+parte).onclick=function(){ g.clearRect(0,0,c.width,c.height); hay=false; if(ph) ph.hidden=false; revisa(parte); };
    lienzo[parte]={ vacio:function(){ return !hay; }, png:function(){
      var o=document.createElement('canvas'); o.width=480; o.height=150; var og=o.getContext('2d'); og.drawImage(c,0,0,480,150); return o.toDataURL('image/png'); } };
  }
  function revisa(parte){ var l=lienzo[parte]; $('ok-'+parte).disabled=!(l&&!l.vacio()&&$('ck-'+parte).checked&&$('in-'+parte).value.trim().length>2); }
  function pinta(parte, d){
    var card=$('fir-'+parte), form=$('form-'+parte);
    if(d&&d.firma){
      card.classList.add('ok'); form.hidden=true;
      var caja=$('trazo-'+parte); caja.innerHTML=''; var im=new Image(); im.alt='Firma de '+(d.nombre||''); im.src=d.firma; caja.appendChild(im);
      $('nom-'+parte).textContent=d.nombre||'';
      $('pie-'+parte).textContent=d.nombre||'';
      $('fecha-'+parte).textContent='Firmado el '+fmt(d.fecha);
      $('est-'+parte).innerHTML=''; var s=document.createElement('span'); s.className='sello'; s.textContent='✓ Firmado en línea'; $('est-'+parte).appendChild(s);
    } else if(db&&!soloLectura){
      card.classList.remove('ok'); form.hidden=false;
      if(!lienzo[parte]) lienzo(parte);
    }
  }
  async function firma(parte){
    var btn=$('ok-'+parte); btn.disabled=true; $('est-'+parte).textContent='Guardando la firma…';
    try{
      await db.doc('firmas/'+parte).set({ nombre:$('in-'+parte).value.trim(), firma:lienzo[parte].png(), fecha:new Date().toISOString(), por:me, documento:'Flujos de trabajo y mejoras contempladas para VTC · versión del 30-oct-2026' });
      $('est-'+parte).textContent='';
    }catch(e){
      $('est-'+parte).textContent='No se pudo guardar la firma. Revisa tu conexión e inténtalo de nuevo; si sigue fallando, pide a quien te compartió la liga acceso para colaborar.';
      revisa(parte);
    }
  }
  async function inicia(){
    if(!window.claude||!claude.use) return;
    db=await claude.use('db'); if(!db) return;
    var u=await claude.use('user'), puede=null; if(u){ try{ me=await u.id(); puede=await u.can('data.write'); }catch(e){} }
    if(puede===false){ soloLectura=true; $('fnota').textContent='Tu acceso a esta liga es de solo lectura. Para firmar en línea, pide a quien te la compartió acceso para colaborar.'; }
    PARTES.forEach(function(p){
      $('ck-'+p).addEventListener('change',function(){ revisa(p); }); $('in-'+p).addEventListener('input',function(){ revisa(p); });
      $('ok-'+p).addEventListener('click',function(){ firma(p); });
      db.doc('firmas/'+p).onSnapshot(function(s){ pinta(p, s.exists?s.data():null); }, function(){ $('est-'+p).textContent='No se pudieron cargar las firmas; recarga la página.'; });
    });
  }
  inicia();
})();
'''
rep('</script>\n\n</body></html>', js.strip('\n') + '\n</script>\n\n</body></html>')
open(out_repo, 'w', encoding='utf-8').write(doc)
# Para publicar: sin doctype/html/head propios (la plataforma los pone)
i = doc.index('<title>'); pub = doc[i:].replace('\n</body></html>', '').rstrip() + '\n'
assert '<style>' in pub[:600]
open(out_pub, 'w', encoding='utf-8').write(pub)
print('ok', len(doc))
