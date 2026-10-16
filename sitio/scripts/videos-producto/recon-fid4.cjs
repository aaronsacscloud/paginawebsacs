// Recon de Fidelización ya sembrado: pantallas completas a 1440
const { abrir } = require('./rec.cjs'); const prep = require('./prep.cjs');
(async()=>{
  const r = await abrir(1440, 900); const { p } = r;
  await r.go('dashboard/list/index', 'Ingresos');
  const shot = async (n) => { await p.waitForTimeout(7000); await prep.menuColapsado(r); await p.waitForTimeout(1500); await p.screenshot({path:`recon-g-${n}.png`, fullPage:true}); console.log('ok', n, p.url()); };
  const ir = async (i) => { await prep.abrirMenu(r, 'Fidelización', i); };
  const tab = async (t) => { const [x,y]=await r.punto(t); await p.mouse.click(x,y); };
  const todo = (process.env.QUE||'clientes,ficha,lealtad,membresias,regalo,campanas,portal').split(',');
  for (const q of todo) { try {
    if (q==='clientes') { await ir('Clientes'); await shot('clientes'); }
    if (q==='ficha') { await ir('Clientes'); await r.esperaTexto('Ximena Ochoa', 60000); await tab('Ximena Ochoa Barrera'); await shot('ficha'); }
    if (q==='lealtad') { await ir('Programa de Lealtad'); await shot('lealtad'); }
    if (q==='membresias') { await ir('Membresías'); await shot('memb-planes'); for (const t of ['Membresías','Tablero']) { await tab(t); await shot('memb-'+t); } }
    if (q==='regalo') { await ir('Tarjetas de regalo'); await shot('regalo'); }
    if (q==='campanas') { await ir('Embudos y Campañas'); await shot('em-tablero'); for (const t of ['Segmentos','Plantillas','Embudos','Campañas','Conversaciones']) { await tab(t); await shot('em-'+t); } }
    if (q==='portal') { await ir('Portal de Clientes'); await shot('portal'); }
  } catch(e){ console.log('x', q, e.message); } }
  await r.cerrar();
})().catch(e=>{ console.error('FALLO', e.message); process.exit(1); });
