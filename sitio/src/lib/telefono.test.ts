/**
 * Pruebas del normalizador de teléfono.
 *
 * Los casos vienen de datos REALES: la hoja de leads de TikTok (68 filas, 5
 * formatos distintos) y los 42 teléfonos que en producción no servían para
 * abrir un chat.
 *
 * Correr:  node --experimental-strip-types src/lib/telefono.test.ts
 */
import { telefonoWhatsApp, normalizarTelefono, telefonoLegible, sirveParaWhatsApp } from './telefono.ts';

let ok = 0; const fallas: string[] = [];
const es = (a: unknown, e: unknown, q: string) => {
  if (JSON.stringify(a) === JSON.stringify(e)) { ok++; return; }
  fallas.push(`${q}\n    esperaba ${JSON.stringify(e)}\n    obtuvo   ${JSON.stringify(a)}`);
};

// ── Los 5 formatos que trae la hoja de TikTok, tal cual ──────────────────
es(telefonoWhatsApp('52 33 1042 8013'), '+523310428013', 'sin + , con 52 y espacios');
es(telefonoWhatsApp('+52 33 3100 5092'), '+523331005092', 'con + y espacios');
es(telefonoWhatsApp('+52 443 214 2826'), '+524432142826', 'lada de 3 dígitos');
es(telefonoWhatsApp('52 933 129 6047'), '+529331296047', 'sin + , lada de 3');
es(telefonoWhatsApp('+1 951-973-4901'), '+19519734901', 'un número de Estados Unidos con guiones');

// ── Los que estaban MAL en la base ───────────────────────────────────────
es(telefonoWhatsApp('5551234567'), '+525551234567', '10 dígitos pelones: se asume México');
es(telefonoWhatsApp('6643171231'), '+526643171231', 'otro de 10');
es(telefonoWhatsApp('+1 (440) 777-5984'), '+14407775984', 'paréntesis y guiones de EUA');
// Sin el + . Once dígitos que empiezan con 1 solo pueden ser Estados Unidos:
// un mexicano son 10, o 12 con el 52. Este caso lo destapó una mutación —los
// demás casos gringos traían + y pasaban por la regla genérica.
es(telefonoWhatsApp('19519734901'), '+19519734901', 'EUA sin el + , por sus 11 dígitos y su 1');
es(telefonoWhatsApp('1 440 777 5984'), '+14407775984', 'lo mismo con espacios');
es(telefonoWhatsApp('985698880777'), null, '12 dígitos sin + no es un país: es un dedazo');

// ── El 1 de móvil, que es EL error clásico de México ─────────────────────
es(telefonoWhatsApp('+521 55 1234 5678'), '+525512345678', 'el 1 de móvil se quita');
es(telefonoWhatsApp('5215512345678'), '+525512345678', 'lo mismo sin el +');
es(telefonoWhatsApp('+52 1 55 1234 5678'), '+525512345678', 'y con el 1 separado');

// ── Prefijo internacional 00 ─────────────────────────────────────────────
es(telefonoWhatsApp('0052 55 1234 5678'), '+525512345678', '00 es el + de toda la vida');
es(telefonoWhatsApp('0034 600 123 456'), '+34600123456', '00 de España');

// ── Lo que NO debe pasar ─────────────────────────────────────────────────
es(telefonoWhatsApp(''), null, 'vacío');
es(telefonoWhatsApp(null), null, 'nulo');
es(telefonoWhatsApp('no tengo'), null, 'texto sin dígitos');
es(telefonoWhatsApp('5512345'), null, '7 dígitos: incompleto');
es(telefonoWhatsApp('525512345'), null, '52 y solo 7: incompleto');
es(telefonoWhatsApp('0000000000'), null, 'puros ceros');
es(telefonoWhatsApp('1111111111'), null, 'todos iguales');
es(telefonoWhatsApp('1234567890'), null, 'la secuencia de prueba');
// El caso que motivó todo: adivinar el país sin señal produce un chat con un
// desconocido. Doce dígitos sin + no autorizan a inventar un código de país.
es(telefonoWhatsApp('349876543210'), null, '12 dígitos sin + no se adivinan');
es(telefonoWhatsApp('+349876543210'), '+349876543210', 'los mismos CON + sí valen');

// ── Extensiones ──────────────────────────────────────────────────────────
es(telefonoWhatsApp('55 1234 5678 ext 102'), '+525512345678', 'la extensión no es parte del número');
es(telefonoWhatsApp('5512345678 x12'), '+525512345678', 'ni la forma corta');

// ── normalizarTelefono: guardar sin perder ───────────────────────────────
es(normalizarTelefono('5551234567'), '+525551234567', 'guarda el bueno cuando se puede');
es(normalizarTelefono('985698880777'), '985698880777', 'y conserva el original cuando no');
es(normalizarTelefono('no tengo'), 'no tengo', 'nunca tira lo que la persona escribió');
es(normalizarTelefono(''), null, 'salvo que no haya nada');
es(normalizarTelefono('  '), null, 'o solo espacios');

// ── auxiliares ───────────────────────────────────────────────────────────
es(sirveParaWhatsApp('5551234567'), true, 'sirve');
es(sirveParaWhatsApp('985698880777'), false, 'no sirve');
es(telefonoLegible('5551234567'), '+52 55 5551 234567'.replace('55 5551 234567', '55 5123 4567'), 'legible México');
es(telefonoLegible('+19519734901'), '+1 951 973 4901', 'legible EUA');
es(telefonoLegible('no tengo'), 'no tengo', 'lo ilegible se muestra tal cual');

console.log(`\n  ${ok} casos pasaron`);
if (fallas.length) {
  console.error(`  ${fallas.length} FALLARON:\n`);
  for (const f of fallas) console.error('  ✗ ' + f + '\n');
  process.exit(1);
}
console.log('  todo bien\n');
