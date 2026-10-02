const prep = require('./prep.cjs');
// OJO: con el menú lateral colapsado, la orden de compra se queda en blanco al abrirla. Se expande antes de navegar y se colapsa después.
const expandir = async (r) => { if (!(await r.hayTexto('Cerrar sesión'))) { await r.p.mouse.click(32, (await r.p.evaluate(() => innerHeight)) - 25); await r.p.waitForTimeout(1500); } };
module.exports.abrirRec = async (r, colapsar = false) => { await r.go('dashboard/list/index', 'Ingresos'); await prep.abrirMenu(r, 'Inventarios', 'Recepción de productos', 'Nueva Recepción'); await r.esperaTexto('Atelier'); if (colapsar) await prep.menuColapsado(r); await prep.ocultarFlotantes(r); await r.p.waitForTimeout(1500); };
module.exports.abrirFolio = async (r, folio, espera) => { await expandir(r); const [x, y] = await r.punto(folio); await r.p.mouse.click(x, y); await r.esperaTexto(espera, 150000); for (let i=0;i<60;i++){ if(!(await r.hayTexto('Cargando'))) break; await r.p.waitForTimeout(1000);} await r.p.waitForTimeout(2500); await prep.menuColapsado(r); await prep.ocultarFlotantes(r); await r.p.waitForTimeout(1500); };

// el folio cambia si se re-siembra la demo: se busca la fila por su total y se toma su folio
module.exports.folioPorTotal = async (r, total, prefijo) => { const y = (await r.punto(total))[1];
  return r.p.evaluate(([y, pre]) => { let hit = null; const w = (root) => root.querySelectorAll('*').forEach((el) => { if (el.shadowRoot) w(el.shadowRoot); const own = [...el.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join('').trim(); if (own.startsWith(pre)) { const b = el.getBoundingClientRect(); if (b.width > 0 && Math.abs(b.y + b.height / 2 - y) < 22) hit = own; } }); w(document); return hit; }, [y, prefijo]); };
