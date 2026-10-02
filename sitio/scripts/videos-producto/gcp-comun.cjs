const prep = require('./prep.cjs');
module.exports.abrir = async (r, item, esp, colapsar = true) => { await r.go('dashboard/list/index', 'Ingresos'); await prep.abrirMenu(r, 'Administración', item, esp); await r.p.waitForTimeout(3000); if (colapsar) await prep.menuColapsado(r); await prep.ocultarFlotantes(r); await r.p.waitForTimeout(1200); };
module.exports.clic = async (r, texto, espera, opts) => { const [x, y] = await r.punto(texto, opts); await r.p.mouse.click(x, y); if (espera) await r.esperaTexto(espera, 150000); await r.p.waitForTimeout(3000); await prep.ocultarFlotantes(r); };
