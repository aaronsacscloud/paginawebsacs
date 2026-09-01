// TRABAJO INTELIGENTE · Sembrar el día de DEMO — un escenario por cada layout
// del panel, con contactos marcados y canales falsos (autorizado por el dueño
// 2026-09-01 para probar todo con datos sembrados).
//
//   node scripts/ti-sembrar-demo.mjs            # siembra (idempotente)
//   node scripts/ti-sembrar-demo.mjs --limpiar  # revierte TODO exacto
//
// Seguridad de la siembra:
// - propiedades.demo_ti = true  → la marca para el borrado exacto.
// - whatsapp +5215500010xx / correo @sembrado.demo → si algo intentara enviar,
//   falla sin tocar a nadie real.
// - last_contact_at = ahora → el cron del SLA (leads-sla) no los ve.
// - Todos entran a ti_cadencias → el candado los saca de las secuencias.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
for (const l of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const limpiar = process.argv.includes('--limpiar');
const ahora = new Date();
const iso = d => d.toISOString();
const hace = (h) => new Date(ahora.getTime() - h * 3600e3);

async function idsDemo() {
  const { data } = await supabase.from('contacts').select('id').eq('propiedades->>demo_ti', 'true');
  return (data || []).map(x => x.id);
}

if (limpiar) {
  const ids = await idsDemo();
  if (ids.length) {
    await supabase.from('ti_omisiones').delete().in('tarea_id',
      ((await supabase.from('ti_tareas').select('id').in('contact_id', ids)).data || []).map(x => x.id));
    await supabase.from('ti_faltas').delete().in('contact_id', ids);
    await supabase.from('ti_tareas').delete().in('contact_id', ids);
    await supabase.from('ti_cadencias').delete().in('contact_id', ids);
    await supabase.from('ti_backlog').delete().in('contact_id', ids);
    await supabase.from('contacts').delete().in('id', ids);
  }
  console.log(`limpio: ${ids.length} contactos demo y todo lo suyo, borrado.`);
  process.exit(0);
}

// ── Los 10 contactos demo ──
const DEMO = [
  ['Demo Valeria', 'Nueva', 'nuevo'],        // T1 llamada P2 (speed-to-lead)
  ['Demo Sugar', 'Plantilla', 'sin_respuesta'], // T3 wa_plantilla
  ['Demo Mónica', 'Correo', 'sin_respuesta'],   // T5 correo
  ['Demo Gabriela', 'Promesa', 'contactado'],   // promesa rota (transformación)
  ['Demo Edith', 'Estafeta', 'respondio'],      // estafeta de la IA
  ['Demo Claudia', 'Responde', 'respondio'],    // P1 responder
  ['Demo Erika', 'Cotiza', 'cotizado'],         // avanzar: seguimiento de cotización
  ['Demo Alisson', 'Treinta', 'contactado'],    // veredicto día 30
  ['Demo Brief', 'Demo', 'agendado'],           // preparar: briefing
  ['Demo Kukys', 'Datos', 'contactado'],        // higiene: lote de datos
];
const yaIds = await idsDemo();
if (yaIds.length) { console.log(`ya hay ${yaIds.length} demos — corre --limpiar primero si quieres resembrar.`); process.exit(0); }

const ids = {};
let n = 0;
for (const [nombre, apellido, estatus] of DEMO) {
  n++;
  const { data, error } = await supabase.from('contacts').insert({
    nombre, apellido, lifecycle_stage: 'lead', estatus_lead: estatus,
    whatsapp: `+52155500010${String(n).padStart(2, '0')}`,
    email: `demo${n}@sembrado.demo`,
    last_contact_at: iso(ahora),
    propiedades: { demo_ti: true },
  }).select('id').single();
  if (error) { console.error(nombre, error.message); process.exit(1); }
  ids[nombre] = data.id;
}

// ── Cadencias (para el candado y para que el generador arme T1/T3/T5) ──
const cad = (nombre, paso, extra = {}) => supabase.from('ti_cadencias').insert({
  contact_id: ids[nombre], paso, estado: 'activa', siguiente_at: iso(ahora),
  iniciada_at: iso(new Date(ahora.getTime() - 3 * 86400e3)), ...extra,
});
await cad('Demo Valeria', 'T1', { iniciada_at: iso(ahora) });
await cad('Demo Sugar', 'T3', { intentos_llamada: 2 });
await cad('Demo Mónica', 'T5', { intentos_llamada: 3 });
// Los demás: cadencia en conversación/pausa — existen para el candado, sus
// tareas exóticas se insertan directas abajo.
for (const nom of ['Demo Gabriela', 'Demo Edith', 'Demo Claudia', 'Demo Erika', 'Demo Alisson', 'Demo Brief', 'Demo Kukys'])
  await supabase.from('ti_cadencias').insert({ contact_id: ids[nom], paso: 'T2', estado: 'conversacion', pausa_causa: 'demo', siguiente_at: iso(ahora) });

// ── Tareas exóticas (payload completo = lo que pinta cada layout) ──
const tarea = (nombre, t) => supabase.from('ti_tareas').insert({
  contact_id: ids[nombre], vence_at: iso(ahora), origen: 'manual', ...t,
  payload: { nombre, whatsapp: `+52155500010XX`, ...t.payload },
});

// Promesa rota: se siembra el COMPROMISO VENCIDO — la transformación del
// generador lo convierte (así se prueba el motor, no un mock).
await tarea('Demo Gabriela', {
  familia: 'contactar', tipo: 'compromiso', prioridad: 3, vence_at: iso(hace(19)),
  payload: { instruccion: 'Llámale a Demo Gabriela — lo pediste tú', nombre: 'Demo Gabriela' },
});

await tarea('Demo Edith', {
  familia: 'responder', tipo: 'estafeta', prioridad: 1,
  payload: {
    instruccion: 'Toma la estafeta de Edith — la IA la cubrió anoche',
    porque: 'Escribió ayer 20:47 y su P1 venció sin respuesta tuya. La IA le contestó con la wiki comercial y le interesó la demo.',
    hechos: [['Esperó fuera de SLA', '2 h 10', 'la falta ya está en tu log', 'ambar'], ['La cubrió la IA', '2 mensajes', 'anoche 21:03'], ['Su señal', 'Quiere demo', '«sí me interesa» · 21:10', 'verde']],
    charla: [
      ['ella', '¿El sistema sirve para una papelería? ¿cuánto cuesta?', 'ayer 20:47'],
      ['ia', 'Claro que sí — Sacscloud lleva papelerías todos los días: inventario por pieza, punto de venta y listas escolares. Los planes van desde $X al mes. ¿Te enseño en una demo de 15 min con tus productos?', 'ayer 21:03'],
      ['ella', 'Sí me interesa la demo', 'ayer 21:10'],
    ],
    mensaje: '¡Buenos días! Qué bueno que te interesa. Tengo espacio hoy a las 12 o a las 4:30 — ¿cuál te acomoda? Es en línea, 15 minutos.',
    falta: 'Falta registrada en tu log: P1 atendido fuera del SLA (2 h 10).',
  },
});

await tarea('Demo Claudia', {
  familia: 'responder', tipo: 'responder', prioridad: 1,
  payload: {
    instruccion: 'Claudia respondió — contéstale ya',
    porque: 'Respondió hace 4 minutos. Un lead que responde es lo más importante de tu día.',
    hechos: [['Respondió hace', '4 min', 'cada hora sin contestar cuesta', 'morado'], ['Intención', 'Pide precios', 'boutique en Guadalajara', 'verde'], ['Ventana WA', 'Abierta 24 h', 'puedes escribir libre']],
    entrante: 'Hola sí me interesa, ¿me puedes mandar info de los precios? Tengo una boutique en Guadalajara',
    mensaje: '¡Hola! Claro que sí. Para una boutique, Sacscloud lleva inventario, ventas y hasta tu tienda en línea. Mejor aún: en 15 minutos te enseño cómo se ve con TUS productos. ¿Te marco hoy en la tarde?',
  },
});

await tarea('Demo Erika', {
  familia: 'avanzar', tipo: 'llamada', prioridad: 4, atrasada: true,
  payload: {
    instruccion: 'Llámale a Erika — su cotización lleva 7 días sin decisión',
    porque: 'La ha abierto 3 veces (última: ayer 9 pm). La está pensando — el ángulo es resolver la duda, no presionar.',
    hechos: [['La cotización', '$28,900', '#C-2081 · hace 7 días'], ['La abrió', '3 veces', 'última: ayer 21:04', 'morado'], ['Decisión forzada en', '7 días', 'día 14: extender o rechazar', 'ambar']],
    tipo_llamada: 'Seguimiento de cotización',
    resultados: { la_firma: 'La firma', pidio_cambios: 'Pidió cambios', la_rechazo: 'La rechazó', no_contesto: 'No contestó', buzon: 'Buzón' },
  },
});

await tarea('Demo Alisson', {
  familia: 'decidir', tipo: 'veredicto', prioridad: 4,
  payload: {
    instruccion: 'Alisson llegó al día 30 — decide su destino',
    porque: 'La regla madre: a los 30 días todo lead tiene ciclo de vida claro. La IA ya leyó el historial.',
    hechos: [['Toques', '9', '4 llamadas · 3 WA · 2 correos'], ['Respuestas', '0', 'ni una en 30 días', 'rojo'], ['La IA propone', 'Descartar', 'a nutrición de largo plazo', 'morado']],
    evidencia: ['9 toques por 3 canales en 30 días — cero respuestas.', 'Los 2 correos jamás se abrieron; los WhatsApp en visto desde el día 12.', 'Ninguna señal: no hay cotización, nunca entró al agendador.'],
    resultados: { descartar: 'Descartar → nutrición', reciclar: 'Reciclar con ángulo nuevo', seguir: 'Yo lo sigo trabajando' },
  },
});

await tarea('Demo Brief', {
  familia: 'preparar', tipo: 'briefing', prioridad: 3,
  payload: {
    instruccion: 'En 30 minutos: demo — tu briefing',
    porque: 'La IA lo armó con todo lo que se sabe. Dos minutos de lectura y entras con ventaja.',
    hechos: [['La cita', '11:30', 'en 30 min · videollamada', 'morado'], ['Su negocio', 'Papelería', '2 sucursales'], ['El riesgo', 'Precio', 'preguntó el costo 2 veces', 'ambar']],
    brief: [
      ['Quién es', 'Dueña de una papelería con 2 sucursales. Llegó por TikTok.'],
      ['Qué le duele', 'Controlar inventario entre sucursales y las listas escolares de temporada.'],
      ['Qué enseñarle', 'Inventario por pieza con traspasos · listas escolares · facturar desde la venta.'],
      ['Cómo abrir', '«Vi que lo que más te pesa son las dos sucursales — déjame enseñarte eso primero.»'],
    ],
  },
});

const datos = [
  ['sugerencia', 'Demo Edith — Sucursales', 'La IA lo oyó al minuto 2:10 de la llamada: 2 sucursales.', { campo: 'Sucursales', valor: '2', fuente: 'lo dijo al min 2:10 de la llamada' }],
  ['campo', 'Demo Kukys — Giro del negocio', 'Con el giro, sus mensajes usan casos de SU ramo.', { campo: 'Giro', opciones: ['Papelería', 'Boutique', 'Regalos', 'Dulcería'] }],
  ['campo', 'Demo Kukys — RFC / razón social', 'Se volvió cliente — sin esto no sale su factura (BLOQUEANTE).', { campo: 'RFC', input: 'RFC…' }],
];
for (const [sub, inst, por, extra] of datos) {
  await tarea('Demo Kukys', {
    familia: 'higiene', tipo: 'dato', prioridad: 5, lote_tipo: sub,
    payload: { instruccion: inst, porque: por, ...extra },
  });
}

console.log('sembrado: 10 contactos, 10 cadencias, tareas exóticas listas.');
console.log('Ahora corre el generador (enrolar/cron o POST /api/crm/ti/enrolar) para que arme T1/T3/T5 y transforme la promesa vencida.');
