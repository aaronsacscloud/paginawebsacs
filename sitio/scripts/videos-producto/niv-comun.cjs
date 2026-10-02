const prep = require('./prep.cjs');
module.exports.abrirTablero = async (r) => { await r.go('dashboard/list/index', 'Ingresos'); await prep.abrirMenu(r, 'Inventarios', 'Nivelación de inventario', 'Tu analista'); await prep.menuColapsado(r); await prep.ocultarFlotantes(r); await prep.ocultarAviso(r, 'Desde el corte'); await r.p.waitForTimeout(2500); };
