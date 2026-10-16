const { abrir } = require('./rec.cjs');
(async()=>{
  const r = await abrir(1440, 900); const { p } = r;
  const shot = async t => { await p.screenshot({ path: __dirname+'/recon-cf-'+t+'.png' }); console.log(t, p.url().split('/').slice(-4).join('/')); };
  const listo = async () => { await p.waitForTimeout(4000); for (let i=0;i<120;i++){ const c = await r.hayTexto('Cargando') || await r.hayTexto('Analizando') || !(await r.hayTexto('Cerrar sesión')); if(!c && i>3) break; await p.waitForTimeout(1000);} await p.waitForTimeout(4000); };
  const prep = require('./prep.cjs');
  const menu = async () => { await r.go('dashboard/list/index', 'Ingresos'); await prep.abrirMenu(r, 'Inventarios', 'Conteo físico', 'Nuevo Conteo'); };
  await menu();
  const [cx,cy] = await r.punto('CON - 23'); await p.mouse.click(cx,cy); await listo(); await shot('detalle'); await p.mouse.move(800,500); await p.mouse.wheel(0,700); await p.waitForTimeout(2500); await shot('detalle-2');
  await menu();
  const [px,py] = await r.punto('CON-AND-6'); await p.mouse.click(px,py); await listo(); await shot('pendiente'); await p.mouse.move(800,500); await p.mouse.wheel(0,700); await p.waitForTimeout(2500); await shot('pendiente-2');
  await menu();
  const [ax,ay] = await r.punto('Análisis'); await p.mouse.click(ax,ay); await listo(); await shot('analisis'); await p.mouse.move(800,500); await p.mouse.wheel(0,700); await p.waitForTimeout(2500); await shot('analisis-2');
  await r.cerrar();
})().catch(e=>{ console.error('FALLO', e.message); process.exit(1); });
