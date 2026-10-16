const { abrir } = require('./rec.cjs'); const prep = require('./prep.cjs');
(async()=>{
  const r = await abrir(1440, 900); const { p } = r;
  const shot = async t => { await p.screenshot({ path: __dirname+'/recon-g-'+t+'.png' }); console.log(t, p.url().split('/').slice(-3).join('/')); };
  const go = async (it, esp) => { await r.go('dashboard/list/index', 'Ingresos'); await prep.abrirMenu(r, 'Administración', it, esp); await p.waitForTimeout(4000); };
  await go('Gastos', 'Nuevo gasto'); try { const [x,y] = await r.punto('OC-D46492'); await p.mouse.click(x,y); await p.waitForTimeout(8000); await shot('gasto-det'); await p.keyboard.press('Escape'); } catch(e){ console.log('x gasto', e.message); }
  await go('Gastos', 'Nuevo gasto'); try { const [x,y] = await r.punto('Más acciones'); await p.mouse.click(x,y); await p.waitForTimeout(2000); await shot('gasto-mas'); } catch(e){}
  await go('Cuentas por pagar', 'Nueva Cuenta'); for (const t of ['Calendario','Agrupada']) { try { const [x,y] = await r.punto(t); await p.mouse.click(x,y); await p.waitForTimeout(5000); await shot('cxp-'+t); await go('Cuentas por pagar', 'Nueva Cuenta'); } catch(e){ console.log('x',t); } }
  try { const [x,y] = await r.punto('GAS-1'); await p.mouse.click(x,y); await p.waitForTimeout(6000); await shot('cxp-det'); } catch(e){ console.log('x det'); }
  await r.cerrar();
})().catch(e=>{ console.error('FALLO', e.message); process.exit(1); });
