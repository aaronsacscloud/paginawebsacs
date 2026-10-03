const f = require('./fid-comun.cjs');
module.exports = {
  slug: 'tarjetas-de-regalo', modulo: 'Tarjetas de regalo',
  nota: 'Capturas del módulo de Tarjetas de regalo de Sacs (octubre de 2026) con una boutique de ejemplo.',
  pantallas: [
    { id: 'lista', t: 'Tarjetas de regalo', alt: 'Tarjetas de regalo en Sacs: pasivo vivo, ingreso reconocido, emitido y lista de tarjetas con saldo', maxAlto: 1500, abrir: async (r) => { await f.ir(r, 'Tarjetas de regalo', 'Emitir tarjetas'); } },
    { id: 'tarjeta', t: 'Tarjeta', alt: 'Detalle de una tarjeta de regalo en Sacs con saldo, canjes y movimientos', maxAlto: 1500, abrir: async (r) => { await f.ir(r, 'Tarjetas de regalo', 'Emitir tarjetas'); await r.esperaTexto('SACS-TJX6-W4P2-H35K', 60000); const [x, y] = await r.punto('SACS-TJX6-W4P2-H35K'); await r.p.mouse.click(x + 640, y); await r.p.waitForTimeout(6000); } },
  ],
  pasos: [
    { p: 'lista', ancla: 'PASIVO VIVO', minW: 1000, t: 'Lo que debes, en vivo', d: 'Saldo por redimir, ingreso ya reconocido y todo lo emitido.' },
    { p: 'lista', ancla: 'CÓDIGO', minW: 1000, t: 'Cada tarjeta con su saldo', d: 'Código, tipo, estado, saldo actual contra el inicial y vigencia.' },
    { p: 'lista', ancla: 'Todas', minW: 600, t: 'Activas, agotadas o expiradas', d: 'Filtra por estado o busca por código.' },
    { p: 'tarjeta', ancla: 'Saldo', minW: 300, t: 'El saldo de una tarjeta', d: 'Cuánto se cargó, cuánto se ha usado y cuánto queda.' },
    { p: 'tarjeta', ancla: 'Movimientos', minW: 500, t: 'Cada canje registrado', d: 'Emisión y canjes con fecha y monto.' },
  ],
};
