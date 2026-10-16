const { abrir } = require('./rec.cjs'); const prep = require('./prep.cjs');
(async()=>{
  const r = await abrir(1440, 900); const { p } = r;
  const shot = async t => { await p.screenshot({ path: __dirname+'/recon-nv-'+t+'.png' }); console.log(t, p.url().split('/').slice(-3).join('/')); };
  await r.go('dashboard/list/index', 'Ingresos'); await prep.abrirMenu(r, 'Inventarios', 'Nivelación de inventario', 'Tu analista'); await p.waitForTimeout(3000);
  await shot('tablero'); await p.mouse.move(800,500); await p.mouse.wheel(0,900); await p.waitForTimeout(2500); await shot('tablero-2'); await p.mouse.wheel(0,900); await p.waitForTimeout(2500); await shot('tablero-3');
  await p.mouse.wheel(0,-3000); await p.waitForTimeout(1000);
  for (const t of ['Nivelaciones','Ajustes']) { const [x,y] = await r.punto(t, { ymax: 80 }); await p.mouse.click(x,y); await p.waitForTimeout(7000); await shot(t); await p.mouse.wheel(0,700); await p.waitForTimeout(2000); await shot(t+'-2'); await p.mouse.wheel(0,-2000); }
  await r.go('dashboard/list/index', 'Ingresos'); await prep.abrirMenu(r, 'Inventarios', 'Nivelación de moda'); await p.waitForTimeout(9000); await shot('moda'); await p.mouse.wheel(0,800); await p.waitForTimeout(2500); await shot('moda-2');
  await r.cerrar();
})().catch(e=>{ console.error('FALLO', e.message); process.exit(1); });
