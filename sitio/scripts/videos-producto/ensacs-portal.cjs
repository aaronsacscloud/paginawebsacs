const f = require('./fid-comun.cjs');
module.exports = {
  slug: 'portal-de-clientes', modulo: 'Portal de clientes',
  nota: 'Capturas del Portal de clientes de Sacs (octubre de 2026) con una boutique de ejemplo.',
  pantallas: [
    { id: 'portal', t: 'Portal de clientes', alt: 'Portal de clientes en Sacs: link y QR del portal, configuración rápida y vista previa en celular', maxAlto: 1000, abrir: async (r) => { await f.ir(r, 'Portal de Clientes', 'Editar Portal'); await f.reemplazar(r, [['andyaraujoconsultorias', 'polancoboutique']]); } },
    { id: 'editor', t: 'Editar portal', alt: 'Editor del portal de clientes en Sacs: nombre, color y mensaje de bienvenida con vista previa', altoFijo: 800, abrir: async (r) => { await f.ir(r, 'Portal de Clientes', 'Editar Portal'); await f.clic(r, 'Editar Portal'); await r.p.waitForTimeout(6000); } },
  ],
  pasos: [
    { p: 'portal', ancla: 'Link de tu portal', minW: 400, t: 'Un link y un QR para tus clientas', d: 'Lo pegas en el ticket, en tu Instagram o en el mostrador.' },
    { p: 'portal', ancla: 'Configuración rápida', minW: 400, t: 'Con tu color y tu logo', d: 'Color, logo, banners y secciones activas de tu portal.' },
    { p: 'portal', ancla: '2,450', minW: 200, t: 'Así lo ve tu clienta', d: 'Sus puntos, su nivel, su cashback y sus recompensas en el celular.' },
    { p: 'editor', ancla: 'Tu Marca', minW: 500, t: 'Edítalo tú', d: 'Cambias colores, banners y secciones y ves el resultado al momento.' },
  ],
};
