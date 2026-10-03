const f = require('./fid-comun.cjs');
const abrirL = async (r, secciones) => { await f.ir(r, 'Programa de Lealtad', 'Cambiar tipo'); await r.p.waitForTimeout(3000); for (const s of secciones) { try { await f.clicXY(r, s, { xmin: 300, xmax: 1000 }); } catch (e) { console.log('⚠', e.message); } await r.p.waitForTimeout(2500); } await f.reemplazar(r, [['xxx', 'Club Polanco Boutique: puntos, cashback y beneficios de moda']]); };
module.exports = {
  slug: 'programa-de-lealtad', modulo: 'Programa de lealtad',
  nota: 'Capturas del Programa de lealtad de Sacs (octubre de 2026) con una boutique de ejemplo.',
  pantallas: [
    { id: 'programa', t: 'Programa de lealtad', alt: 'Programa de lealtad en Sacs: niveles, puntos y cashback por compra, recompensas y avance de configuración', maxAlto: 1300, abrir: async (r) => { await abrirL(r, []); } },
    { id: 'niveles', t: 'Niveles', alt: 'Niveles del programa de lealtad en Sacs con rango de puntos, multiplicador y beneficios', maxAlto: 1500, abrir: async (r) => { await abrirL(r, ['Información', 'Niveles']); } },
    { id: 'recompensas', t: 'Recompensas', alt: 'Recompensas de moda del programa de lealtad en Sacs', maxAlto: 1500, abrir: async (r) => { await abrirL(r, ['Información', 'Recompensas']); } },
  ],
  pasos: [
    { p: 'programa', ancla: 'NIVELES', minW: 1100, t: 'Puntos y cashback en cada compra', d: 'Cuántos niveles, qué porcentaje en puntos y cuánto regresa en cashback.' },
    { p: 'programa', ancla: 'Inscripción automática de clientes', minW: 700, t: 'Se inscriben solos', d: 'Clientas nuevas y existentes entran al programa sin llenar nada.' },
    { p: 'programa', ancla: 'PROGRESO DE CONFIGURACIÓN', minW: 400, t: 'Lo que falta configurar', d: 'Niveles, recompensas, expiración: el avance de tu programa.' },
    { p: 'niveles', ancla: 'Rangos de puntos', minW: 700, t: 'Niveles que se ganan comprando', d: 'Rango de puntos de cada nivel, su multiplicador y sus beneficios.' },
    { p: 'recompensas', ancla: 'Recompensas', minW: 700, t: 'Recompensas que sí se usan', d: '$200 en tu próxima prenda, ajuste de bastilla, envío gratis.' },
  ],
};
