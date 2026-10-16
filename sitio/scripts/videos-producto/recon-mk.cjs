// Recon: Canales de venta → marketplaces
const { abrir } = require('./rec.cjs');
(async()=>{
  const r = await abrir(1440, 900); const { p } = r;
  await r.go('dashboard/list/index', 'Ingresos');
  if (!(await r.hayTexto('Cerrar sesión'))) { await p.mouse.click(32, 875); await p.waitForTimeout(1500); }
  const [x,y] = await r.punto('Canales de venta'); await p.mouse.click(x,y); await p.waitForTimeout(4000);
  for (const m of (process.env.MK||'MercadoLibre,Amazon,SHEIN,Liverpool,Google Merchant Center').split(',')) {
    try { const [a,b]=await r.punto(m); await p.mouse.click(a,b); await p.waitForTimeout(9000); await p.screenshot({path:`recon-mk-${m.replace(/\W/g,'_')}.png`}); console.log('ok', m, p.url()); } catch(e){ console.log('x', m, e.message); }
  }
  await r.cerrar();
})().catch(e=>{ console.error('FALLO', e.message); process.exit(1); });
