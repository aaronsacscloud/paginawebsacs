// node recon-rutas.cjs ruta1 ruta2 … → recon-<ruta>.png (y -2 con scroll)
const { abrir } = require('./rec.cjs');
(async()=>{
  const r = await abrir(1440, 900); const { p } = r;
  await r.go('dashboard/list/index', 'Ingresos');
  for (const ruta of process.argv.slice(2)) {
    try {
      await p.goto(`http://localhost:8081/lavidaesparadisfrutar/${process.env.CUENTA}/${ruta}`, { waitUntil:'domcontentloaded' });
      await p.waitForTimeout(6000); for (let i=0;i<60;i++){ if(!(await r.hayTexto('Cargando'))) break; await p.waitForTimeout(1000);} await p.waitForTimeout(5000);
      const t = ruta.replace(/\W+/g,'_'); await p.screenshot({ path: __dirname+'/recon-'+t+'.png' });
      await p.mouse.move(800,500); await p.mouse.wheel(0, 800); await p.waitForTimeout(2500); await p.screenshot({ path: __dirname+'/recon-'+t+'-2.png' });
      console.log('ok', ruta, p.url().split('/').slice(-3).join('/'));
    } catch(e) { console.log('x', ruta, e.message.split('\n')[0]); }
  }
  await r.cerrar();
})().catch(e=>{ console.error('FALLO', e.message); process.exit(1); });
