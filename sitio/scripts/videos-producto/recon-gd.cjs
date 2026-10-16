const { abrir } = require('./rec.cjs'); const g = require('./gcp-comun.cjs');
(async()=>{ const r=await abrir(1440,900); const {p}=r;
 for (const op of ['Dashboard de análisis','Flujo proyectado']) { await g.abrir(r,'Gastos','Nuevo gasto'); await g.clic(r,'Más acciones'); await g.clic(r, op); await p.waitForTimeout(6000); await p.screenshot({path:__dirname+'/recon-gd-'+op.split(' ')[0]+'.png'}); await p.mouse.wheel(0,800); await p.waitForTimeout(2000); await p.screenshot({path:__dirname+'/recon-gd-'+op.split(' ')[0]+'-2.png'}); console.log('ok',op); }
 await r.cerrar(); })().catch(e=>console.log('FALLO',e.message));
