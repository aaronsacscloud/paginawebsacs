const { abrir } = require('./rec.cjs'); const prep = require('./prep.cjs');
(async()=>{
  const r = await abrir(1440, 900); const { p } = r;
  const shot = async t => { await p.screenshot({ path: __dirname+'/recon-oc-'+t+'.png' }); console.log(t, p.url().split('/').slice(-3).join('/')); };
  const listo = async () => { await p.waitForTimeout(4000); for (let i=0;i<90;i++){ if(!(await r.hayTexto('Cargando'))) break; await p.waitForTimeout(1000);} await p.waitForTimeout(4000); };
  const abrirRec = async () => { await r.go('dashboard/list/index', 'Ingresos'); await prep.abrirMenu(r, 'Inventarios', 'Recepción de productos', 'Nueva Recepción'); await p.waitForTimeout(3000); };
  await abrirRec(); await shot('lista');
  for (const t of ['Pendientes']) { try { const [x,y] = await r.punto(t, { ymax: 400 }); await p.mouse.click(x,y); await p.waitForTimeout(4000); await shot('pendientes'); } catch(e){ console.log('x',t); } }
  await abrirRec(); await r.esperaTexto('Atelier'); { const [x,y] = await r.punto('OC-774'); await p.mouse.click(x,y); await listo(); await shot('oc'); await p.mouse.move(800,500); await p.mouse.wheel(0,700); await p.waitForTimeout(2500); await shot('oc-2'); }
  await abrirRec(); await r.esperaTexto('Atelier'); { const [x,y] = await r.punto('REC-368'); await p.mouse.click(x,y); await listo(); await shot('rec'); await p.mouse.move(800,500); await p.mouse.wheel(0,700); await p.waitForTimeout(2500); await shot('rec-2'); }
  await abrirRec(); { const [x,y] = await r.punto('Nueva Recepción'); await p.mouse.click(x,y); await listo(); await shot('nueva'); }
  await r.cerrar();
})().catch(e=>{ console.error('FALLO', e.message); process.exit(1); });
