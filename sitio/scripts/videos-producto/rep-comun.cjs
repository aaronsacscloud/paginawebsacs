const prep = require('./prep.cjs');
const domClic = (r, t, xmin = 0, xmax = 320) => r.p.evaluate(([t, xmin, xmax]) => { let hit = null; const w = (root) => root.querySelectorAll('*').forEach((el) => { if (hit) return; if (el.shadowRoot) w(el.shadowRoot); const own = [...el.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join('').replace(/\s+/g, ' ').trim(); if (own === t) { const b = el.getBoundingClientRect(); if (b.width > 0 && b.x >= xmin && b.x < xmax) hit = el; } }); w(document); if (!hit) return false; hit.scrollIntoView({ block: 'center' }); hit.click(); return true; }, [t, xmin, xmax]);
module.exports.domClic = domClic;
module.exports.abrirHub = async (r) => { await r.go('dashboard/list/index', 'Ingresos'); if (!(await r.hayTexto('Cerrar sesión'))) { await r.p.mouse.click(32, (await r.p.evaluate(() => innerHeight)) - 25); await r.p.waitForTimeout(1500); } if (!(await domClic(r, 'Reportes'))) throw new Error('sin Reportes'); await r.p.waitForTimeout(6000); await prep.ocultarFlotantes(r); };
// Análisis de ventas: arma un reporte (agrupar por / métrica) sobre todas las sucursales y lo genera
module.exports.armarAnalisis = async (r, agrupar, metrica) => {
  const { p } = r;
  await module.exports.abrirHub(r); await domClic(r, 'Análisis de ventas', 330, 1440); await r.esperaTexto('Generar reporte', 120000); await p.waitForTimeout(3000);
  const sel = async (val, idx) => p.evaluate(([val, idx]) => { const out = []; const w = (root) => root.querySelectorAll('*').forEach((el) => { if (el.shadowRoot) w(el.shadowRoot); if (el.tagName === 'SELECT' && el.getBoundingClientRect().width > 0) out.push(el); }); w(document); const s = out[idx]; if (!s) return false; s.value = val; s.dispatchEvent(new Event('change', { bubbles: true })); s.dispatchEvent(new Event('input', { bubbles: true })); return true; }, [val, idx]);
  return { sel };
};
// Ventas por vendedor (preset) con los últimos 7 días; opcionalmente cambia «Agrupar por»
module.exports.ventas = async (r, agrupar) => {
  const { p } = r;
  await module.exports.abrirHub(r); { const [vx, vy] = await r.punto('Ventas por Vendedor', { xmin: 330, ymax: 860 }); await p.mouse.click(vx, vy); } await r.esperaTexto('Generar reporte', 120000); await p.waitForTimeout(3500);
  if (agrupar) await p.evaluate((val) => { const out = []; const w = (root) => root.querySelectorAll('*').forEach((el) => { if (el.shadowRoot) w(el.shadowRoot); if (el.tagName === 'SELECT' && el.getBoundingClientRect().width > 0) out.push(el); }); w(document); const s = out[0]; if (s) { s.value = val; s.dispatchEvent(new Event('change', { bubbles: true })); } }, agrupar);
  await p.waitForTimeout(800);
  const [x, y] = await r.punto('Período', { xmin: 900, ymax: 300 }); await p.mouse.click(x + 60, y + 34); await p.waitForTimeout(1500);
  const [ax, ay] = await r.punto('Últimos 7 días'); await p.mouse.click(ax, ay); await p.waitForTimeout(800);
  try { const [bx, by] = await r.punto('Aplicar', { xmin: 800 }); await p.mouse.click(bx, by); } catch (e) {}
  await p.waitForTimeout(1500);
  const [gx, gy] = await r.punto('Generar reporte'); await p.mouse.click(gx, gy); await p.waitForTimeout(12000);
};
