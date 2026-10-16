// node recon-mod.cjs "Grupo>Item>TextoEspera" … → recon-m-<item>.png (+ -2 con scroll)
const { abrir } = require('./rec.cjs'); const prep = require('./prep.cjs');
(async()=>{
  const r = await abrir(1440, 900); const { p } = r;
  for (const arg of process.argv.slice(2)) {
    const [g, it, esp] = arg.split('>');
    try {
      await r.go('dashboard/list/index', 'Ingresos'); await prep.abrirMenu(r, g, it, esp);
      for (let i=0;i<60;i++){ if(!(await r.hayTexto('Cargando'))) break; await p.waitForTimeout(1000);} await p.waitForTimeout(4000);
      const t = it.replace(/\W+/g,'_'); await p.screenshot({ path: __dirname+'/recon-m-'+t+'.png' });
      await p.mouse.move(800,500); await p.mouse.wheel(0, 800); await p.waitForTimeout(2500); await p.screenshot({ path: __dirname+'/recon-m-'+t+'-2.png' });
      console.log('ok', it, p.url().split('/').slice(-3).join('/'));
    } catch(e) { console.log('x', it, e.message.split('\n')[0]); }
  }
  await r.cerrar();
})().catch(e=>{ console.error('FALLO', e.message); process.exit(1); });
