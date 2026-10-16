const { abrir } = require('./rec.cjs');
(async()=>{
  const r = await abrir(1440, 900); const { p } = r;
  await r.go('dashboard/list/index', 'Ingresos');
  if (!(await r.hayTexto('Cerrar sesión'))) { await p.mouse.click(32, 875); await p.waitForTimeout(1500); }
  for (const g of (process.env.GRUPOS||'Fidelización').split(',')) {
    const [x,y] = await r.punto(g); await p.mouse.click(x,y); await p.waitForTimeout(2500);
    await p.screenshot({path:`recon-${g.replace(/\W/g,'_')}.png`});
    const [x2,y2] = await r.punto(g).catch(()=>[0,0]); if (x2) { await p.mouse.click(x2,y2); await p.waitForTimeout(1000); }
  }
  await r.cerrar();
})().catch(e=>{ console.error('FALLO', e.message); process.exit(1); });
