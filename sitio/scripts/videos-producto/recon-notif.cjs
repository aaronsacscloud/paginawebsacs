const { abrir } = require('./rec.cjs');
(async()=>{
  const r = await abrir(1440, 900); const { p } = r;
  await r.go('dashboard/list/index', 'Ingresos');
  if (!(await r.hayTexto('Cerrar sesión'))) { await p.mouse.click(32, 875); await p.waitForTimeout(1500); }
  let [x,y] = await r.punto('Comercio en Línea'); await p.mouse.click(x,y); await p.waitForTimeout(6000);
  [x,y] = await r.punto('Notificaciones', { xmax: 300 }).catch(async()=>await r.punto('Notificaciones')); await p.mouse.click(x,y); await p.waitForTimeout(10000);
  await p.screenshot({path:'recon-notif.png'}); console.log(p.url());
  // configuración general → buscar Notificaciones
  await r.go('dashboard/list/index', 'Ingresos'); if (!(await r.hayTexto('Cerrar sesión'))) { await p.mouse.click(32, 875); await p.waitForTimeout(1500); }
  [x,y] = await r.punto('Configuración'); await p.mouse.click(x,y); await p.waitForTimeout(9000);
  await p.screenshot({path:'recon-config.png'}); console.log(p.url());
  await r.cerrar();
})().catch(e=>{ console.error('FALLO', e.message); process.exit(1); });
