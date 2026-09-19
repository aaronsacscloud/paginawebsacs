/* Que no se cuele una persona ni se escape un bot. Los casos salen de
   conversaciones reales del inbox (19-sep-2026). */
import { esAutorespuesta } from './autorespuesta';

const CASOS: [string, boolean][] = [
  // Automáticas de verdad, tal como llegaron
  ['Nuestro horario de atención es de Lunes a Sábado de 11:00 a.m. a 7:30 p.m. ⏰ Te daremos respuesta lo antes posible.✨', true],
  ['¡Hola! Gracias por contactarnos, nos alegra poder atenderte.', true],
  ['Gracias por tu mensaje. En este momento no podemos responder, te contestamos mañana.', true],
  ['Este es un mensaje automático, un asesor te atenderá en breve.', true],
  ['Hemos recibido tu mensaje, en cuanto estemos disponibles te respondemos.', true],
  // Personas. Ninguna de éstas puede marcarse: esconderlas cuesta el trato.
  ['Gracias', false],
  ['Sí, me interesa', false],
  ['gracias por contactarnos', false],   // corto: puede ser alguien educado
  ['Ok, entonces en un ratito más te lo mando🙏', false],
  ['Quiero consultoría', false],
  ['Hola, cuánto cuesta? Tengo 3 tiendas y quiero saber si me sirve para tallas y colores', false],
  ['Mañana te confirmo, hoy tengo el horario de atención lleno en la tienda', false],
  ['', false],
];

let mal = 0;
for (const [t, esperado] of CASOS) {
  const r = esAutorespuesta(t);
  if (r !== esperado) { mal++; console.error(`✗ «${t.slice(0, 50)}» → ${r}, se esperaba ${esperado}`); }
}
if (mal) { console.error(`${mal} de ${CASOS.length} mal`); process.exit(1); }
console.log(`✓ autorespuestas: ${CASOS.length} casos`);
