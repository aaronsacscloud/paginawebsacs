/**
 * Pruebas de los recordatorios de reunión.
 *
 * Lo que se protege aquí es lo que rompe una reunión de verdad: que la hora
 * salga mal, que falte el huso, que un recordatorio se dispare dos veces o
 * que la lista quede en el orden equivocado.
 *
 * Correr:  node --experimental-strip-types src/lib/scheduling/recordatorios.test.ts
 */
import {
  aMinutos, etiqueta, leerRecordatorios, fmtFechaLarga, fmtHora, fmtRango,
  inicioMs, textoWhatsApp, TZ_ETIQUETA,
  paramsCliente, paramsHost, etiquetaSerie, horaLocalInvitado,
} from './recordatorios.ts';

let ok = 0; const fallas: string[] = [];
const es = (a: unknown, e: unknown, q: string) => {
  if (JSON.stringify(a) === JSON.stringify(e)) { ok++; return; }
  fallas.push(`${q}\n    esperaba ${JSON.stringify(e)}\n    obtuvo   ${JSON.stringify(a)}`);
};
const cierto = (a: boolean, q: string) => es(a, true, q);

// ── Las cuatro unidades a minutos ────────────────────────────────────────
es(aMinutos({ cantidad: 10, unidad: 'minutos' }), 10, '10 minutos');
es(aMinutos({ cantidad: 3, unidad: 'horas' }), 180, '3 horas');
es(aMinutos({ cantidad: 1, unidad: 'dias' }), 1440, '1 día');
es(aMinutos({ cantidad: 2, unidad: 'semanas' }), 20160, '2 semanas');
es(aMinutos({ cantidad: -5, unidad: 'horas' }), 0, 'una cantidad negativa no manda al pasado');

// ── El singular importa: «1 días antes» se lee como error ────────────────
es(etiqueta({ cantidad: 1, unidad: 'dias' }), '1 día', 'singular en días');
es(etiqueta({ cantidad: 3, unidad: 'horas' }), '3 horas', 'plural en horas');
es(etiqueta({ cantidad: 1, unidad: 'horas' }), '1 hora', 'singular en horas');
es(etiqueta({ cantidad: 10, unidad: 'minutos' }), '10 minutos', 'plural en minutos');

// ── Leer la configuración sin confiar en su forma ────────────────────────
es(leerRecordatorios(null).length, 0, 'null no truena');
es(leerRecordatorios('{}' as any).length, 0, 'una cadena no truena');
es(leerRecordatorios([{ cantidad: 5, unidad: 'horas', email: true, activo: false }]).length, 0,
  'un recordatorio apagado no se envía');
es(leerRecordatorios([{ cantidad: 5, unidad: 'horas', email: false, whatsapp: false }]).length, 0,
  'sin ningún canal no hay nada que enviar');
es(leerRecordatorios([{ cantidad: 0, unidad: 'horas', email: true }]).length, 0,
  'cero de anticipación no es un recordatorio');
es(leerRecordatorios([{ cantidad: 5, unidad: 'lunas', email: true }]).length, 0,
  'una unidad inventada NO se degrada a minutos: se descarta');

// EL ORDEN: de mayor a menor anticipación. Si dos caen en la misma corrida,
// manda el más lejano — decir «falta 1 día» cuando faltan 3 horas es peor
// que no decir nada.
const tres = leerRecordatorios([
  { id: 'r3', cantidad: 10, unidad: 'minutos', whatsapp: true },
  { id: 'r1', cantidad: 1, unidad: 'dias', email: true },
  { id: 'r2', cantidad: 3, unidad: 'horas', email: true },
]);
es(tres.map(r => r.id), ['r1', 'r2', 'r3'], 'se ordenan de mayor a menor anticipación');

// ── La fecha y la hora, como las lee una persona en México ───────────────
es(fmtFechaLarga('2026-09-02'), 'miércoles 2 de septiembre de 2026', 'fecha larga con día de la semana');
es(fmtHora('16:30'), '4:30 p.m.', 'tarde en 12 h');
es(fmtHora('09:05'), '9:05 a.m.', 'mañana con cero a la izquierda');
es(fmtHora('00:00'), '12:00 a.m.', 'medianoche no es 0:00');
es(fmtHora('12:00'), '12:00 p.m.', 'mediodía no es 0:00 p.m.');
es(fmtRango('16:30', 45), '4:30 p.m. a 5:15 p.m.', 'el rango cruza la hora');
es(fmtRango('23:30', 60), '11:30 p.m. a 12:30 a.m.', 'el rango cruza la medianoche');
es(fmtRango('10:00', null), '10:00 a.m.', 'sin duración, solo la hora de inicio');

// ── El instante: la reunión se guarda en hora CDMX (UTC−6 fijo) ──────────
es(new Date(inicioMs('2026-09-02', '16:30')).toISOString(), '2026-09-02T22:30:00.000Z',
  'las 4:30 p.m. de CDMX son las 22:30 UTC');

// ── El texto: SIEMPRE la hora y SIEMPRE el huso ──────────────────────────
const b = {
  invitee_nombre: 'Ana Ruiz', fecha: '2026-09-02', hora_inicio: '16:30',
  google_meet_link: 'https://meet.google.com/abc-defg-hij',
  token_reagendar: 'tok123',
  event_types: { nombre: 'Demo personalizada', duracion_minutos: 60 },
};
const conf = textoWhatsApp(b);
cierto(conf.includes('4:30 p.m.'), 'la confirmación trae la hora');
cierto(conf.includes(TZ_ETIQUETA), 'la confirmación dice el huso horario');
cierto(conf.includes('miércoles 2 de septiembre de 2026'), 'la confirmación trae la fecha completa');
cierto(conf.includes('https://meet.google.com/abc-defg-hij'), 'la confirmación trae la liga de Meet');
cierto(conf.includes('Ana'), 'la confirmación saluda por el nombre de pila');
cierto(!conf.includes('Recordatorio'), 'la confirmación no se anuncia como recordatorio');

const rec = textoWhatsApp(b, '3 horas');
cierto(rec.includes('en 3 horas'), 'el recordatorio dice cuánto falta');
cierto(rec.includes('4:30 p.m.'), 'el recordatorio trae la hora');
cierto(rec.includes(TZ_ETIQUETA), 'el recordatorio dice el huso horario');
cierto(rec.includes('https://meet.google.com/abc-defg-hij'), 'el recordatorio trae la liga de Meet');

// Sin liga de Meet NO se miente: se dice que va a llegar.
const sinMeet = textoWhatsApp({ ...b, google_meet_link: null }, '1 día');
cierto(!sinMeet.includes('meet.google.com'), 'sin liga no se inventa una');
cierto(sinMeet.includes('antes de la sesión'), 'sin liga se dice que llegará');
cierto(sinMeet.includes(TZ_ETIQUETA), 'sin liga, el huso sigue estando');

// ── Los parámetros de las plantillas de Meta ─────────────────────────────
const pc = paramsCliente(b as any, '3 horas');
es(pc.length, 5, 'la plantilla del cliente lleva 5 parámetros');
es(pc[0], 'Ana', 'primer nombre, no el completo');
es(pc[2], '3 horas', 'la anticipación va tal cual');
cierto(pc[3].includes('4:30 p.m.'), 'el parámetro de cuándo trae la hora');
cierto(pc[4].includes('meet.google.com'), 'el quinto es la liga');
// Meta RECHAZA saltos de línea dentro de un parámetro: si uno se cuela, la
// plantilla falla al enviarse y el recordatorio no sale.
cierto(pc.every(x => !/[\n\r\t]/.test(x)), 'ningún parámetro trae saltos de línea');
cierto(pc.every(x => x.length > 0), 'ningún parámetro va vacío (Meta lo rechaza)');

const sinLiga = paramsCliente({ ...b, google_meet_link: null } as any, '1 día');
es(sinLiga[4], 'te mandamos la liga antes de la sesión', 'sin liga, el parámetro NO queda vacío');

// La serie se anuncia: en una capacitación, saber en cuál va cambia si se conecta.
es(etiquetaSerie({ serie_indice: 2, serie_total: 3 }), 'sesión 2 de 3', 'serie de 3');
es(etiquetaSerie({ serie_indice: 1, serie_total: 1 }), '', 'una sola sesión no es serie');
es(etiquetaSerie({}), '', 'sin serie, nada');
cierto(paramsCliente({ ...b, serie_indice: 2, serie_total: 3 } as any, '1 día')[1].includes('sesión 2 de 3'),
  'la serie viaja en el parámetro del tipo de reunión');

// La hora local del invitado, solo cuando NO es CDMX.
es(horaLocalInvitado({ ...b, timezone_invitado: 'America/Mexico_City' } as any), '', 'misma zona: no se repite');
es(horaLocalInvitado(b as any), '', 'sin zona conocida: no se inventa');
/* 3:30 y no 2:30: en septiembre Tijuana SÍ tiene horario de verano (UTC−7) y
   CDMX no (UTC−6 fijo desde 2022), así que la diferencia es de UNA hora, no de
   dos. Lo escribí mal la primera vez — que es exactamente el error que este
   campo le evita al cliente. */
cierto(horaLocalInvitado({ ...b, timezone_invitado: 'America/Tijuana' } as any).includes('3:30 p.m.'),
  'Tijuana ve una hora menos');
cierto(horaLocalInvitado({ ...b, timezone_invitado: 'America/Cancun' } as any).includes('5:30 p.m.'),
  'Cancún ve una hora más');
es(horaLocalInvitado({ ...b, timezone_invitado: 'Zona/Inventada' } as any), '', 'una zona inválida no truena');

const ph = paramsHost({ ...b, invitee_empresa: 'Boutique Mila' } as any, '10 minutos');
es(ph.length, 5, 'la plantilla del host lleva 5 parámetros');
cierto(ph[2].includes('Ana Ruiz') && ph[2].includes('Boutique Mila'), 'el host ve con quién y de dónde');
es(paramsHost({ ...b, google_meet_link: null } as any, '1 día')[4], 'sin liga de Meet todavía',
  'al host se le dice que falta la liga');

// ── Lo que encontró el review, protegido para que no vuelva ──────────────
import { datosEmail } from './recordatorios.ts';
const de = datosEmail(b as any, '3 horas');
// La plantilla booking_reminder lee `d.fecha`. Mandar solo `fecha_larga`
// dejaba el correo SIN fecha: «es en 3 horas —  4:30 p.m.».
cierto(!!de.fecha && de.fecha.includes('septiembre'), 'el correo lleva `fecha`, que es lo que lee la plantilla');
cierto(!!de.fecha_larga, 'y también `fecha_larga`');
cierto(de.zona.includes('CDMX'), 'el correo dice el huso');

// Una unidad desconocida se DESCARTA, no degrada a minutos: «5 semanas» que
// se vuelve «5 minutos» es un recordatorio equivocado, peor que ninguno.
es(leerRecordatorios([{ cantidad: 5, unidad: 'semana', email: true }]).length, 0,
  'unidad en singular: se descarta, no se degrada');
es(leerRecordatorios([{ cantidad: 5, unidad: 'lunas', email: true }]).length, 0,
  'unidad inventada: se descarta');
es(leerRecordatorios([{ cantidad: 5, unidad: 'semanas', email: true }])[0].unidad, 'semanas',
  'la unidad correcta sí pasa');

// La hora local sin el DÍA local manda a alguien el día equivocado cuando su
// zona cruza la medianoche respecto a CDMX.
const madrid = horaLocalInvitado({ ...b, hora_inicio: '20:00', timezone_invitado: 'Europe/Madrid' } as any);
cierto(madrid.includes('jueves 3 de septiembre'), 'Madrid ve el día siguiente, y se le dice');
cierto(!horaLocalInvitado({ ...b, timezone_invitado: 'America/Tijuana' } as any).includes('de septiembre'),
  'dentro de México no se repite la fecha: es el mismo día');

// ── El espejo del inbox: el texto REAL, no un rótulo ─────────────────────
// El inbox mostraba «Recordatorio de reunión (3 horas antes)» —un título— y
// quien abría el chat no podía saber qué le llegó al cliente, que es para lo
// único que existe el espejo.
import { textoPlantillaCliente, textoPlantillaHost } from './recordatorios.ts';
const espejo = textoPlantillaCliente(paramsCliente(b as any, '3 horas'));
cierto(espejo.includes('Ana'), 'el espejo trae el nombre');
cierto(espejo.includes('4:30 p.m.'), 'el espejo trae la hora');
cierto(espejo.includes('hora del centro de México'), 'el espejo trae el huso');
cierto(espejo.includes('meet.google.com'), 'el espejo trae la liga');
cierto(espejo.includes('Reagendar'), 'el espejo dice qué botones vio el cliente');
cierto(!espejo.startsWith('Recordatorio de reunión ('), 'el espejo NO es el rótulo viejo');
const espejoH = textoPlantillaHost(paramsHost({ ...b, invitee_empresa: 'Boutique Mila' } as any, '10 minutos'));
cierto(espejoH.includes('Boutique Mila'), 'el espejo del host dice con quién es');

console.log(`\n  ${ok} casos pasaron`);
if (fallas.length) { console.log(`  ${fallas.length} FALLARON:\n  - ${fallas.join('\n  - ')}\n`); process.exit(1); }
console.log('  todo bien\n');
