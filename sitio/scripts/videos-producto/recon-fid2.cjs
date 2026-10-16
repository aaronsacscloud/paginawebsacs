// Recon de Fidelización: Clientes, Programa de Lealtad y el submenú de Comercio en Línea
const { abrir } = require('./rec.cjs'); const prep = require('./prep.cjs');
(async()=>{
  const r = await abrir(1440, 900); const { p } = r;
  await r.go('dashboard/list/index', 'Ingresos');
  const shot = async (n) => { await p.waitForTimeout(6000); await p.screenshot({path:`recon-f-${n}.png`}); console.log('ok', n, p.url()); };
  try { await prep.abrirMenu(r, 'Fidelización', 'Clientes'); await shot('clientes'); } catch(e){ console.log('x clientes', e.message); }
  try { await prep.abrirMenu(r, 'Fidelización', 'Programa de Lealtad'); await shot('lealtad'); } catch(e){ console.log('x lealtad', e.message); }
  try { const [x,y] = await r.punto('Comercio en Línea'); await p.mouse.click(x,y); await shot('comercio'); } catch(e){ console.log('x comercio', e.message); }
  await r.cerrar();
})().catch(e=>{ console.error('FALLO', e.message); process.exit(1); });
