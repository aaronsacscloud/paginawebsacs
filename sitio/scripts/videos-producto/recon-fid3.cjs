// Recon: resto de módulos de Fidelización y Marketplaces
const { abrir } = require('./rec.cjs'); const prep = require('./prep.cjs');
(async()=>{
  const r = await abrir(1440, 900); const { p } = r;
  await r.go('dashboard/list/index', 'Ingresos');
  const shot = async (n) => { await p.waitForTimeout(7000); await p.screenshot({path:`recon-f-${n}.png`}); console.log('ok', n, p.url()); };
  for (const [g,i,n] of [['Fidelización','Membresías','membresias'],['Fidelización','Portal de Clientes','portal'],['Fidelización','Tarjetas de regalo','regalo'],['Fidelización','Embudos y Campañas','campanas']]) {
    try { await prep.abrirMenu(r, g, i); await shot(n); } catch(e){ console.log('x', n, e.message); }
  }
  // ficha de un cliente
  try { await prep.abrirMenu(r, 'Fidelización', 'Clientes'); await p.waitForTimeout(6000); const [x,y]=await r.punto('Silvia Casillas'); await p.mouse.click(x,y); await shot('ficha'); } catch(e){ console.log('x ficha', e.message); }
  // marketplaces
  try { const [x,y] = await r.punto('Canales de venta'); await p.mouse.click(x,y); await p.waitForTimeout(3000);
    for (const m of ['MercadoLibre','Amazon','SHEIN','Liverpool']) { const [a,b]=await r.punto(m); await p.mouse.click(a,b); await shot('mk-'+m); } } catch(e){ console.log('x mk', e.message); }
  await r.cerrar();
})().catch(e=>{ console.error('FALLO', e.message); process.exit(1); });
