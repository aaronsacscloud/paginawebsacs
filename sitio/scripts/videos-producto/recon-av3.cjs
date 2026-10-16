const { abrir } = require('./rec.cjs'); const c = require('./rep-comun.cjs');
(async()=>{ const r=await abrir(1440,900); const {p}=r;
 for (const t of ['Ventas por Vendedor','Cortes de caja','Reporte de Ventas por producto']) { await c.abrirHub(r); const ok=await c.domClic(r,t,330,1440); await p.waitForTimeout(15000); await p.screenshot({path:__dirname+'/recon-av3-'+t.split(' ').pop()+'.png'}); console.log(t,ok,p.url().split('/').slice(-3).join('/')); }
 await r.cerrar(); })().catch(e=>console.log('FALLO',e.message));
